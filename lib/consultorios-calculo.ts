/**
 * Las cuentas de los consultorios: precio, grilla y saldos.
 *
 * Está separado de `lib/consultorios.ts` porque acá no hay acceso a la base y
 * entonces se puede importar desde el navegador. Es lo que hace que la pantalla
 * de reserva muestre cuánto sale una hora antes de guardarla, con la misma
 * cuenta que después hace el servidor.
 */

export type Categoria = 'A' | 'B' | 'SUM';

export type Espacio = {
  id: string;
  nombre: string;
  tipo: 'consultorio' | 'sum';
  categoria: Categoria;
  orden: number;
  activo: boolean;
  incluye: { id: string; texto: string }[];
};

export type Tarifa = {
  espacio_id: string;
  horas_semana_desde: number;
  precio_hora: number;
  desde: string;
};

export type Apertura = {
  espacio_id: string;
  dia_semana: number;
  desde_hora: string;
  hasta_hora: string;
};

export type Cierre = {
  id: string;
  espacio_id: string | null;
  fecha: string;
  desde_hora: string | null;
  hasta_hora: string | null;
  motivo: string;
};

export type Reserva = {
  id: string;
  espacio_id: string;
  inquilino_id: string;
  fecha: string;
  desde_hora: string;
  hasta_hora: string;
  origen: 'contrato' | 'suelta';
  estado: 'activa' | 'liberada' | 'cancelada';
  importe: number | null;
  inquilinos: { nombre: string } | null;
  /** Cuándo se creó. De acá sale si todavía se puede deshacer. */
  created_at?: string;
};

/** Cuántas horas se pueden soltar por mes sin que la banda se desarme. */
export const HORAS_LIBERABLES = 2;

/**
 * Con cuánta anticipación se puede soltar una hora y recibir el crédito.
 *
 * Siete días, que es lo que hace falta para revenderla: las consultas por horas
 * sueltas llegan con menos de una semana de anticipación.
 */
export const DIAS_PARA_SOLTAR = 7;

/**
 * Cuánto dura el deshacer de una reserva recién hecha.
 *
 * Soltar y deshacer son dos cosas distintas y por eso tienen reglas distintas.
 * Soltar es devolver una hora que se tomó de verdad: pide una semana de
 * anticipación, tiene tope mensual y deja un crédito, porque la hora se cobró.
 * Deshacer es corregir un error de hace un minuto (la fila equivocada, el
 * consultorio equivocado): ahí no hubo alquiler que devolver, así que no cuenta
 * contra el tope, no mira la fecha y **borra el cargo** en vez de compensarlo
 * con un crédito.
 *
 * Quince minutos: alcanzan para mirar lo que quedó y arrepentirse, y no tantos
 * como para que alguien reserve, ocupe la sala y después deshaga.
 */
export const MINUTOS_PARA_DESHACER = 15;

/** De lunes a sábado, con lunes en 0. El domingo el Centro no abre. */
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Cuántos días abre el Centro por semana. */
export const DIAS_DE_LA_SEMANA = DIAS_CORTOS.length;


export type Inquilino = {
  id: string;
  nombre: string;
  /** Nulo mientras no tenga acceso al sistema: es el usuario con el que entra. */
  correo: string | null;
  telefono: string | null;
  activo: boolean;
  hash: string | null;
  matricula: string | null;
  matricula_vence: string | null;
  dni_archivo: string | null;
  matricula_archivo: string | null;
  llave_entregada: boolean;
  normas_version: string | null;
  normas_aceptadas_at: string | null;
  /** Cuándo se dio de alta. De acá sale su color en el calendario. */
  created_at?: string;
};

export type Contrato = {
  id: string;
  inquilino_id: string;
  espacio_id: string;
  dia_semana: number;
  desde_hora: string;
  hasta_hora: string;
  vigente_desde: string;
  vigente_hasta: string | null;
};

export type Gasto = {
  id: string;
  fecha: string;
  periodo: string;
  concepto: string;
  rubro: 'alquiler' | 'expensas' | 'servicios' | 'limpieza' | 'mantenimiento' | 'insumos' | 'sueldos' | 'otros';
  importe: number;
  fijo: boolean;
  quien: string | null;
};

export const RUBROS: Gasto['rubro'][] = [
  'alquiler',
  'expensas',
  'servicios',
  'limpieza',
  'mantenimiento',
  'insumos',
  'sueldos',
  'otros',
];

export type Movimiento = {
  id: string;
  inquilino_id: string;
  tipo: 'cargo' | 'pago' | 'recargo' | 'credito' | 'ajuste';
  fecha: string;
  periodo: string | null;
  importe: number;
  reserva_id: string | null;
  detalle: string | null;
  quien: string | null;
};

// -------------------------------------------------------------------- precio

/**
 * Lo que sale contratar `horas` por semana en una sala.
 *
 * **El tramo es el último renglón que esas horas ya alcanzaron.** Con 10 horas
 * por semana se paga el precio del renglón de 8: el descuento se gana al
 * completar la franja.
 *
 * Encima corre la regla del importe más bajo: si tomar el renglón siguiente
 * completo sale igual o menos, se cobra eso. Con la escala actual pasa en dos
 * puntos (3 horas contra 4, y 15 contra 16), y en el resto de los cortes la
 * hora que falta para el renglón siguiente cuesta una fracción de lo que cuesta
 * una suelta.
 *
 * `sugerencia` es lo que la pantalla muestra al armar el contrato: cuántas
 * horas conviene tomar y qué diferencia hay. Es lo que hace crecer las horas
 * vendidas, y evita que alguien se entere después de que podía pagar menos.
 */
export function cotizar(
  tarifas: Tarifa[],
  espacioId: string,
  horas: number
): {
  precioHora: number;
  importe: number;
  tramo: number;
  /** Hasta cuántas horas rige ese tramo; null en el último, que no tiene
   *  techo. Va acá y no en la pantalla porque sale de la escala: "tramo de 8"
   *  no dice qué paga quien tiene diez, que es la pregunta. */
  tramoHasta: number | null;
  sugerencia: { horas: number; importe: number; ahorro: number } | null;
} | null {
  const escala = tarifas
    .filter((t) => t.espacio_id === espacioId)
    .sort((a, b) => a.horas_semana_desde - b.horas_semana_desde);
  if (escala.length === 0 || horas <= 0) return null;

  const propio = [...escala].reverse().find((t) => horas >= t.horas_semana_desde) ?? escala[0];
  const importePropio = horas * propio.precio_hora;

  const siguiente = escala.find((t) => t.horas_semana_desde > horas);
  const importeSiguiente = siguiente ? siguiente.horas_semana_desde * siguiente.precio_hora : null;
  const conviene = importeSiguiente !== null && importeSiguiente <= importePropio;

  return {
    precioHora: propio.precio_hora,
    importe: conviene ? (importeSiguiente as number) : importePropio,
    tramo: propio.horas_semana_desde,
    tramoHasta: siguiente ? siguiente.horas_semana_desde - 1 : null,
    sugerencia:
      siguiente && importeSiguiente !== null
        ? {
            horas: siguiente.horas_semana_desde,
            importe: importeSiguiente,
            ahorro: importePropio - importeSiguiente,
          }
        : null,
  };
}

// -------------------------------------------------------------------- fechas

/** El lunes de la semana de `iso`. */
export function lunesDe(iso: string): string {
  const d = new Date(`${iso}T12:00:00-03:00`);
  const dow = d.getDay(); // 0 domingo
  const atras = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - atras);
  return d.toISOString().slice(0, 10);
}

/** Los días que abre el Centro en esa semana, en ISO. */
export function diasDe(lunes: string): string[] {
  return DIAS_CORTOS.map((_, n) => {
    const d = new Date(`${lunes}T12:00:00-03:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  });
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00-03:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "08:00:00" -> 8. Las reservas del Centro son en horas enteras. */
export function hora(t: string): number {
  return Number(t.slice(0, 2));
}

export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}


/**
 * Cuántas horas semanales tiene contratadas alguien en un espacio, a una fecha.
 *
 * Es lo que decide su tramo de la escala: el precio de una hora depende del
 * volumen que ya tiene en esa sala.
 */
export function horasSemanalesEn(
  todos: Contrato[],
  inquilinoId: string,
  espacioId: string,
  al: string
): number {
  return todos
    .filter(
      (c) =>
        c.inquilino_id === inquilinoId &&
        c.espacio_id === espacioId &&
        c.vigente_desde <= al &&
        (c.vigente_hasta === null || c.vigente_hasta >= al)
    )
    .reduce((n, c) => n + (hora(c.hasta_hora) - hora(c.desde_hora)), 0);
}

/** El total de horas semanales de una persona, en todas las salas. Es el tramo
 *  que se le aplica a una hora suelta: quien ya alquila paga menos que quien
 *  viene por una hora. */
export function horasSemanalesTotales(todos: Contrato[], inquilinoId: string, al: string): number {
  return todos
    .filter(
      (c) =>
        c.inquilino_id === inquilinoId &&
        c.vigente_desde <= al &&
        (c.vigente_hasta === null || c.vigente_hasta >= al)
    )
    .reduce((n, c) => n + (hora(c.hasta_hora) - hora(c.desde_hora)), 0);
}


/** Suma deuda o la baja según el tipo. El importe guardado siempre es positivo. */
export function signo(tipo: Movimiento['tipo']): 1 | -1 {
  return tipo === 'pago' || tipo === 'credito' ? -1 : 1;
}

export function saldoDe(ms: Movimiento[]): number {
  return ms.reduce((n, m) => n + signo(m.tipo) * m.importe, 0);
}

/** El primer día del mes de una fecha, que es como se guarda `periodo`. */
export function periodoDe(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function mesLargo(periodo: string): string {
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(
    new Date(`${periodo}T12:00:00-03:00`)
  );
}

/**
 * El recargo por pagar tarde, como manda el documento de convivencia: 15% del
 * 11 al 20 y 25% del 21 en adelante, sobre el mes que se está pagando.
 *
 * Devuelve el porcentaje, no el importe: quién lo aplica y sobre qué saldo es
 * una decisión de la pantalla, porque un pago parcial no arrastra el recargo
 * del total.
 */
export function recargoDelDia(fecha: string, periodo: string): number {
  if (periodoDe(fecha) !== periodo) return 0;
  const dia = Number(fecha.slice(8, 10));
  if (dia <= 10) return 0;
  if (dia <= 20) return 15;
  return 25;
}

/** El día de la semana con lunes en 0, como `DIAS` en `lib/opciones.ts`. */
export function diaSemanaDe(iso: string): number {
  return (new Date(`${iso}T12:00:00-03:00`).getDay() + 6) % 7;
}

export type Celda =
  /** `cierreId` solo cuando hay un cierre cargado detrás: fuera del horario de
   *  apertura la celda también está cerrada y ahí no hay nada que reabrir. */
  | { estado: 'cerrado'; motivo: string; cierreId?: string }
  | { estado: 'libre' }
  | {
      estado: 'ocupado';
      quien: string;
      origen: 'contrato' | 'suelta';
      reservaId: string;
      /** Para pintar la celda del color de esa persona. Ver `tonoDe`. */
      inquilinoId: string;
    };

/**
 * El color de cada inquilino en el calendario, como tono de la rueda.
 *
 * **Por orden de alta y no por un hash del identificador.** El hash reparte
 * bien en abstracto y en concreto choca: con trece personas y catorce tonos,
 * dos personas de nombre parecido salieron del mismo verde, que es justo el par
 * que hay que poder distinguir. Por orden de alta no se repite ninguno mientras
 * quepan en la lista, y quien ya está nunca cambia de color: el que entra toma
 * el siguiente.
 *
 * Tampoco es una columna que se elija al dar de alta: nadie va a entrar a una
 * ficha a decidir de qué color quiere ver sus horas.
 *
 * Los tonos están escritos y no repartidos por la rueda entera: los amarillos y
 * los verde lima quedan ilegibles sobre el fondo claro, y dos tonos separados
 * por veinte grados se ven iguales en dos celdas que no están al lado. Pasados
 * los catorce vuelve a empezar, que es cuando el color deja de alcanzar solo y
 * el nombre de la celda es el que manda.
 */
const TONOS = [210, 12, 145, 275, 32, 190, 330, 95, 250, 55, 165, 300, 230, 78];

export function tonosPorInquilino(inquilinos: Inquilino[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  [...inquilinos]
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
    .forEach((i, k) => {
      mapa[i.id] = TONOS[k % TONOS.length];
    });
  return mapa;
}

/**
 * La semana entera del Centro: una celda por sala, día y hora.
 *
 * Las cuatro salas van en la misma grilla y no en pestañas separadas, porque la
 * pregunta que se contesta acá casi nunca es "cómo viene el consultorio 2":
 * es "el jueves a las 17, ¿qué tengo libre?". Con una sala por pestaña, esa
 * comparación se hace de memoria.
 *
 * Las horas salen de la apertura declarada, así que un horario distinto no
 * necesita código nuevo.
 */
export function armarGrilla(
  espacios: Espacio[],
  dias: string[],
  aperturasDe: Apertura[],
  cierres: Cierre[],
  reservas: Reserva[]
): { horas: number[]; celdas: Record<string, Celda> } {
  const propias = aperturasDe.filter((a) => espacios.some((e) => e.id === a.espacio_id));
  if (propias.length === 0) return { horas: [], celdas: {} };
  const abre = Math.min(...propias.map((a) => hora(a.desde_hora)));
  const cierra = Math.max(...propias.map((a) => hora(a.hasta_hora)));
  const horas: number[] = [];
  for (let h = abre; h < cierra; h++) horas.push(h);

  const celdas: Record<string, Celda> = {};
  for (const espacio of espacios) {
    const suyas = aperturasDe.filter((a) => a.espacio_id === espacio.id);
    for (const fecha of dias) {
      const diaSemana = diaSemanaDe(fecha);
      const apertura = suyas.find((a) => a.dia_semana === diaSemana);
      for (const h of horas) {
        const clave = `${espacio.id}|${fecha}|${h}`;
        if (!apertura || h < hora(apertura.desde_hora) || h >= hora(apertura.hasta_hora)) {
          celdas[clave] = { estado: 'cerrado', motivo: 'Fuera del horario' };
          continue;
        }
        const cierre = cierres.find(
          (c) =>
            c.fecha === fecha &&
            (c.espacio_id === null || c.espacio_id === espacio.id) &&
            (c.desde_hora === null || (h >= hora(c.desde_hora) && h < hora(c.hasta_hora as string)))
        );
        if (cierre) {
          celdas[clave] = { estado: 'cerrado', motivo: cierre.motivo, cierreId: cierre.id };
          continue;
        }
        const r = reservas.find(
          (x) =>
            x.espacio_id === espacio.id &&
            x.fecha === fecha &&
            h >= hora(x.desde_hora) &&
            h < hora(x.hasta_hora)
        );
        celdas[clave] = r
          ? {
              estado: 'ocupado',
              quien: r.inquilinos?.nombre ?? 'Sin nombre',
              origen: r.origen,
              reservaId: r.id,
              inquilinoId: r.inquilino_id,
            }
          : { estado: 'libre' };
      }
    }
  }
  return { horas, celdas };
}

/** "Ana Prueba" -> "Ana".
 *
 * Solo el primer nombre: en una columna de 46 píxeles, "Ana P." ya se recorta y
 * queda "Ana ...", que dice menos que el nombre solo. El nombre completo está en
 * el `title` de la celda, y el equipo son tres personas que conocen a cada
 * inquilino por su nombre. */
export function corto(nombre: string): string {
  return nombre.trim().split(/\s+/)[0];
}


/**
 * Un día del Centro, sala por sala, como lo ve un inquilino.
 *
 * Lo ocupado por otro se muestra ocupado y sin nombre: quién alquila la sala de
 * al lado no es asunto de quien está buscando un hueco. Lo propio sí se
 * reconoce, que es lo que deja soltar una hora desde la misma pantalla.
 */
export function grillaDeUnDia(
  espacios: Espacio[],
  fecha: string,
  aperturasDe: Apertura[],
  cierres: Cierre[],
  reservas: Reserva[],
  miId: string
): {
  horas: number[];
  celdas: Record<string, { estado: 'libre' | 'mia' | 'tomada' | 'cerrada'; reservaId?: string }>;
} {
  const dia = diaSemanaDe(fecha);
  const propias = aperturasDe.filter(
    (a) => a.dia_semana === dia && espacios.some((e) => e.id === a.espacio_id)
  );
  if (propias.length === 0) return { horas: [], celdas: {} };
  const abre = Math.min(...propias.map((a) => hora(a.desde_hora)));
  const cierra = Math.max(...propias.map((a) => hora(a.hasta_hora)));
  const horas: number[] = [];
  for (let h = abre; h < cierra; h++) horas.push(h);

  const celdas: Record<string, { estado: 'libre' | 'mia' | 'tomada' | 'cerrada'; reservaId?: string }> = {};
  for (const espacio of espacios) {
    const apertura = propias.find((a) => a.espacio_id === espacio.id);
    for (const h of horas) {
      const clave = `${espacio.id}|${h}`;
      if (!apertura || h < hora(apertura.desde_hora) || h >= hora(apertura.hasta_hora)) {
        celdas[clave] = { estado: 'cerrada' };
        continue;
      }
      const cierre = cierres.find(
        (c) =>
          c.fecha === fecha &&
          (c.espacio_id === null || c.espacio_id === espacio.id) &&
          (c.desde_hora === null || (h >= hora(c.desde_hora) && h < hora(c.hasta_hora as string)))
      );
      if (cierre) {
        celdas[clave] = { estado: 'cerrada' };
        continue;
      }
      const r = reservas.find(
        (x) =>
          x.espacio_id === espacio.id &&
          x.fecha === fecha &&
          h >= hora(x.desde_hora) &&
          h < hora(x.hasta_hora)
      );
      celdas[clave] = r
        ? { estado: r.inquilino_id === miId ? 'mia' : 'tomada', reservaId: r.id }
        : { estado: 'libre' };
    }
  }
  return { horas, celdas };
}

/**
 * Los días hábiles de las semanas que toca el mes de `iso`.
 *
 * Semanas enteras y no solo los días del mes: la vista mensual apila las
 * grillas de cada semana, y una primera semana que arranca miércoles dejaría
 * dos columnas fantasma o correría los días bajo el rótulo equivocado. Por eso
 * puede traer los últimos días del mes anterior y los primeros del siguiente.
 */
export function diasHabilesDelMes(iso: string): string[] {
  const [a, m] = iso.split('-').map(Number);
  const desde = new Date(Date.UTC(a, m - 1, 1, 12));
  desde.setUTCDate(desde.getUTCDate() - ((desde.getUTCDay() + 6) % 7));
  const hasta = new Date(Date.UTC(a, m, 0, 12));
  hasta.setUTCDate(hasta.getUTCDate() + (DIAS_DE_LA_SEMANA - 1 - ((hasta.getUTCDay() + 6) % 7)));

  const dias: string[] = [];
  for (const d = desde; d <= hasta; d.setUTCDate(d.getUTCDate() + 1)) {
    if ((d.getUTCDay() + 6) % 7 < DIAS_DE_LA_SEMANA) dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

/** Parte una lista de días hábiles en semanas. */
export function porSemanas(dias: string[]): string[][] {
  const semanas: string[][] = [];
  for (let i = 0; i < dias.length; i += DIAS_DE_LA_SEMANA)
    semanas.push(dias.slice(i, i + DIAS_DE_LA_SEMANA));
  return semanas;
}

/** El mes de `iso` corrido `n` meses, como primer día del mes. */
export function mesCorrido(iso: string, n: number): string {
  const [a, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1, 12));
  return d.toISOString().slice(0, 10);
}

/**
 * Las fechas de una reserva que se repite.
 *
 * `cada` dice el paso: una semana para una banda fija ("los martes de 17 a 20"),
 * o un día para una semana entera a la misma hora. Los fines de semana quedan
 * afuera en los dos casos, porque el Centro no abre.
 *
 * Devuelve siempre la primera fecha, incluso sin repetición: así quien la usa
 * recorre una lista y no dos caminos.
 */
export function fechasRepetidas(
  desde: string,
  hasta: string,
  cada: 'no' | 'semana' | 'dia'
): string[] {
  const fechas = [desde];
  if (cada === 'no' || hasta <= desde) return fechas;
  const paso = cada === 'semana' ? 7 : 1;
  // Un tope duro: sin él, una fecha de fin escrita con un año de más pediría
  // miles de reservas.
  for (let i = 0; i < 400; i++) {
    const f = sumarDias(fechas[fechas.length - 1], paso);
    if (f > hasta) break;
    if (diaSemanaDe(f) < DIAS_DE_LA_SEMANA) fechas.push(f);
    else if (cada === 'dia') fechas[fechas.length - 1] = f;
  }
  return fechas;
}

/** El último día del mes de `iso`, que es hasta dónde se propone repetir. */
export function finDeMes(iso: string): string {
  const [a, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0, 12)).toISOString().slice(0, 10);
}


// --------------------------------------------------------------- ocupación

export type Corte = { clave: string; rotulo: string; abiertas: number; vendidas: number; pct: number };

/**
 * Cuánto se ocupa, mirado por todos lados a la vez.
 *
 * La pregunta del negocio no es cuánto se ocupó en total: es **qué hora de qué
 * día está vacía**, para saber qué poner en promoción y qué no tocar. Así que
 * el mismo recorrido deja cuatro cortes (hora, día, sala y la cruza de día por
 * hora) en vez de recorrer las reservas cuatro veces.
 *
 * **Se mide contra lo abierto y no contra el día entero.** Una sala que abre de
 * 8 a 21 tiene trece horas para vender; contra veinticuatro, todas las salas
 * darían mal y ninguna se podría comparar con otra.
 *
 * Los cierres se descuentan de lo abierto: una sala cerrada por refacción no
 * es una hora que no se pudo vender, es una hora que no existió.
 */
export function medirOcupacion(
  espacios: Espacio[],
  dias: string[],
  aperturas: Apertura[],
  reservas: Reserva[],
  cierres: Cierre[] = []
): {
  porHora: Corte[];
  porDia: Corte[];
  porSala: Corte[];
  celdas: Record<string, { abiertas: number; vendidas: number; pct: number }>;
  horas: number[];
  total: { abiertas: number; vendidas: number; pct: number };
} {
  const suma = () => ({ abiertas: 0, vendidas: 0 });
  const porHora = new Map<number, { abiertas: number; vendidas: number }>();
  const porDia = new Map<number, { abiertas: number; vendidas: number }>();
  const porSala = new Map<string, { abiertas: number; vendidas: number }>();
  const cruce = new Map<string, { abiertas: number; vendidas: number }>();
  const total = suma();

  for (const espacio of espacios) {
    const suyas = aperturas.filter((a) => a.espacio_id === espacio.id);
    for (const fecha of dias) {
      const d = diaSemanaDe(fecha);
      const apertura = suyas.find((a) => a.dia_semana === d);
      if (!apertura) continue;
      for (let h = hora(apertura.desde_hora); h < hora(apertura.hasta_hora); h++) {
        const cerrada = cierres.some(
          (c) =>
            (c.espacio_id === null || c.espacio_id === espacio.id) &&
            c.fecha === fecha &&
            (c.desde_hora === null || (h >= hora(c.desde_hora) && h < hora(c.hasta_hora as string)))
        );
        if (cerrada) continue;
        const vendida = reservas.some(
          (r) =>
            r.espacio_id === espacio.id &&
            r.fecha === fecha &&
            h >= hora(r.desde_hora) &&
            h < hora(r.hasta_hora)
        );
        for (const [mapa, clave] of [
          [porHora, h],
          [porDia, d],
          [porSala, espacio.id],
          [cruce, `${d}|${h}`],
        ] as [Map<string | number, { abiertas: number; vendidas: number }>, string | number][]) {
          const v = mapa.get(clave) ?? suma();
          v.abiertas += 1;
          if (vendida) v.vendidas += 1;
          mapa.set(clave, v);
        }
        total.abiertas += 1;
        if (vendida) total.vendidas += 1;
      }
    }
  }

  const pct = (v: { abiertas: number; vendidas: number }) =>
    v.abiertas > 0 ? Math.round((v.vendidas / v.abiertas) * 100) : 0;
  const corte = (mapa: Map<never, never>, rotulo: (k: never) => string): Corte[] =>
    [...(mapa as unknown as Map<string | number, { abiertas: number; vendidas: number }>).entries()]
      .map(([k, v]) => ({ clave: String(k), rotulo: rotulo(k as never), ...v, pct: pct(v) }))
      .sort((a, b) => a.clave.localeCompare(b.clave, undefined, { numeric: true }));

  const celdas: Record<string, { abiertas: number; vendidas: number; pct: number }> = {};
  for (const [k, v] of cruce) celdas[k] = { ...v, pct: pct(v) };

  return {
    porHora: corte(porHora as never, (h) => `${String(h).padStart(2, '0')}:00`),
    porDia: corte(porDia as never, (d) => DIAS_CORTOS[d as unknown as number]),
    // Las salas van en el orden en que se muestran en todas las pantallas y no
    // por su identificador, que es el que traía `corte`: ordenadas por uuid
    // salían 2, 3, 4, 1 y la comparación entre ellas se volvía un rompecabezas.
    porSala: corte(porSala as never, (id) =>
      espacios.find((e) => e.id === (id as unknown as string))?.nombre ?? '—'
    ).sort(
      (a, b) =>
        espacios.findIndex((e) => e.id === a.clave) - espacios.findIndex((e) => e.id === b.clave)
    ),
    celdas,
    horas: [...porHora.keys()].sort((a, b) => a - b),
    total: { ...total, pct: pct(total) },
  };
}

/**
 * El mes de una sola sala: una celda por día y hora.
 *
 * Es la vuelta de `grillaDeUnDia`, que muestra un día con todas las salas.
 * Para quien alquila, la pregunta no es qué hay libre el jueves entre las
 * cinco salas: es dónde hay un hueco en las próximas semanas, y eso con un día
 * por pantalla obliga a recorrer treinta y cinco pantallas.
 *
 * Las claves son `fecha|hora`, y los estados los mismos que el día: lo propio
 * se distingue de lo tomado porque una es una hora que se puede soltar y la
 * otra no es asunto de quien mira.
 */
export function grillaDeUnaSala(
  espacio: Espacio,
  dias: string[],
  aperturasDe: Apertura[],
  cierres: Cierre[],
  reservas: Reserva[],
  miId: string
): {
  horas: number[];
  celdas: Record<string, { estado: 'libre' | 'mia' | 'tomada' | 'cerrada'; reservaId?: string }>;
} {
  const suyas = aperturasDe.filter((a) => a.espacio_id === espacio.id);
  if (suyas.length === 0) return { horas: [], celdas: {} };
  const abre = Math.min(...suyas.map((a) => hora(a.desde_hora)));
  const cierra = Math.max(...suyas.map((a) => hora(a.hasta_hora)));
  const horas: number[] = [];
  for (let h = abre; h < cierra; h++) horas.push(h);

  const celdas: Record<string, { estado: 'libre' | 'mia' | 'tomada' | 'cerrada'; reservaId?: string }> = {};
  for (const fecha of dias) {
    const apertura = suyas.find((a) => a.dia_semana === diaSemanaDe(fecha));
    for (const h of horas) {
      const clave = `${fecha}|${h}`;
      if (!apertura || h < hora(apertura.desde_hora) || h >= hora(apertura.hasta_hora)) {
        celdas[clave] = { estado: 'cerrada' };
        continue;
      }
      const cierre = cierres.find(
        (c) =>
          (c.espacio_id === null || c.espacio_id === espacio.id) &&
          c.fecha === fecha &&
          (c.desde_hora === null || (h >= hora(c.desde_hora) && h < hora(c.hasta_hora as string)))
      );
      if (cierre) {
        celdas[clave] = { estado: 'cerrada' };
        continue;
      }
      const r = reservas.find(
        (x) =>
          x.espacio_id === espacio.id &&
          x.fecha === fecha &&
          h >= hora(x.desde_hora) &&
          h < hora(x.hasta_hora)
      );
      celdas[clave] = r
        ? { estado: r.inquilino_id === miId ? 'mia' : 'tomada', reservaId: r.id }
        : { estado: 'libre' };
    }
  }
  return { horas, celdas };
}
