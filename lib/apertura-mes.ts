import 'server-only';
import { revalidateTag } from 'next/cache';
import { select, upsert } from '@/lib/supabase';
import {
  contratos as leerContratos,
  cierresEntre,
  escalaVigente,
  listarEspacios,
  listarInquilinos,
} from '@/lib/consultorios';
import {
  cotizar,
  diaSemanaDe,
  finDeMes,
  hora,
  horasSemanalesTotales,
  mesCorrido,
  mesLargo,
  periodoDe,
  sumarDias,
  hoyISO,
  type Contrato,
} from '@/lib/consultorios-calculo';
import { renovacionesDe, type Renovacion } from '@/lib/renovaciones';
import { avisarFallaDeApertura, avisarMesAbierto } from '@/lib/correo-centro';

/**
 * La apertura del mes del Centro: las reservas y los cargos que salen de las
 * bandas fijas.
 *
 * Hasta el 10/11/2026 la hacía un script desde una computadora, y noviembre no
 * se abrió: el calendario quedó vacío, Lucila volvió a la planilla y un
 * inquilino se cargó el mes entero como horas sueltas. Ahora la hace el sistema
 * el último día del mes anterior (`abrirSiToca`, desde el cron diario), o
 * Lucila con el botón de la pestaña "Mes que viene".
 *
 * **Primero los contratos, después las reservas.** Quien contestó que no sigue
 * pierde sus bandas desde el 1; quien marcó horas que deja ve su banda
 * recortada. Recién con los contratos al día se generan las reservas, así el
 * precio sale del volumen que va a tener ese mes y no del que tenía.
 *
 * **El precio es el de `crearReserva`**: `cotizar` sobre la escala vigente, con
 * el tramo de las horas semanales de la persona en todas las salas. No hay una
 * segunda cuenta que se pueda separar de la del alta a mano.
 *
 * **Abrir dos veces no duplica.** Una fecha en la que esa persona ya tiene algo
 * en esa sala y a esa hora (reservado, soltado o cancelado) se saltea: lo que
 * se soltó no vuelve, y lo que se cargó a mano queda como está. Por eso el
 * mismo botón sirve para completar un mes abierto después de sumar una banda.
 *
 * Los feriados no se reservan, salvo los que el inquilino tildó al renovar. Un
 * cierre cargado (mantenimiento, un taller) tampoco.
 */

export type Fila = {
  inquilino_id: string;
  espacio_id: string;
  fecha: string;
  desde_hora: string;
  hasta_hora: string;
  importe: number | null;
};

export type ResumenInquilino = {
  id: string;
  nombre: string;
  respuesta: Renovacion['respuesta'] | null;
  /** Lo que escribió que quiere sumar: lo arma el equipo. */
  nota: string | null;
  /** Cuántas horas por semana deja marcadas sobre sus bandas. */
  horasQueDeja: number;
  /** Cuántas horas por semana sumó él mismo para ese mes, antes de abrirse. */
  horasQueSuma: number;
  feriados: string[];
  horasSemanaAntes: number;
  horasSemana: number;
  reservas: number;
  horas: number;
  importe: number;
};

export type Choque = { inquilino: string; sala: string; fecha: string; desde: string; hasta: string; con: string };

export type Plan = {
  periodo: string;
  abierto: { abierto_at: string; quien: string | null } | null;
  inquilinos: ResumenInquilino[];
  filas: Fila[];
  /** Lo que no se puede reservar porque la sala ya la ocupa otra persona. */
  choques: Choque[];
};

type Segmento = { contrato: Contrato; desde: number; hasta: number };

/** Una banda menos las horas que se dejan, partida en tramos seguidos. */
function recortar(c: Contrato, deja: number[]): { desde: number; hasta: number }[] {
  const tramos: { desde: number; hasta: number }[] = [];
  for (let h = hora(c.desde_hora); h < hora(c.hasta_hora); h++) {
    if (deja.includes(h)) continue;
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.hasta === h) ultimo.hasta = h + 1;
    else tramos.push({ desde: h, hasta: h + 1 });
  }
  return tramos;
}

const hh = (h: number) => `${String(h).padStart(2, '0')}:00:00`;

/** Las horas que deja esa respuesta en ese contrato. */
function horasQueDeja(r: Renovacion | undefined, contratoId: string): number[] {
  if (!r || r.aplicada_at) return [];
  return (r.deja ?? []).filter((d) => d.contrato === contratoId).map((d) => d.hora);
}

export async function planDelMes(periodo: string, soloInquilino?: string): Promise<Plan> {
  const fin = finDeMes(periodo);
  const [espacios, inquilinos, contratos, escala, renovaciones, cierres, existentes, abierto] =
    await Promise.all([
      listarEspacios(),
      listarInquilinos(),
      leerContratos(),
      escalaVigente(periodo),
      renovacionesDe(periodo),
      cierresEntre(periodo, fin),
      select<{
        inquilino_id: string;
        espacio_id: string;
        fecha: string;
        desde_hora: string;
        hasta_hora: string;
        estado: string;
      }>(
        'reservas',
        `select=inquilino_id,espacio_id,fecha,desde_hora,hasta_hora,estado&fecha=gte.${periodo}&fecha=lte.${fin}`
      ),
      select<{ abierto_at: string; quien: string | null }>(
        'centro_meses',
        `select=abierto_at,quien&periodo=eq.${periodo}&limit=1`
      ),
    ]);

  const sala = (id: string) => espacios.find((e) => e.id === id)?.nombre ?? 'Sala';
  const nombre = (id: string) => inquilinos.find((i) => i.id === id)?.nombre ?? 'Sin nombre';
  const activos = new Set(inquilinos.filter((i) => i.activo).map((i) => i.id));
  const vigenteEn = (c: Contrato, f: string) => c.vigente_desde <= f && (c.vigente_hasta === null || c.vigente_hasta >= f);

  // Las bandas de ese mes, con lo que cada uno contestó ya aplicado.
  const delMes = contratos.filter(
    (c) =>
      activos.has(c.inquilino_id) &&
      (!soloInquilino || c.inquilino_id === soloInquilino) &&
      c.vigente_desde <= fin &&
      (c.vigente_hasta === null || c.vigente_hasta >= periodo)
  );
  const segmentos: Segmento[] = delMes.flatMap((c) => {
    const r = renovaciones[c.inquilino_id];
    if (r?.respuesta === 'no' && !r.aplicada_at) return [];
    return recortar(c, horasQueDeja(r, c.id)).map((t) => ({ contrato: c, ...t }));
  });
  // El volumen del mes que se abre, que es el que decide el tramo.
  const comoQueda: Contrato[] = segmentos.map((s) => ({
    ...s.contrato,
    desde_hora: hh(s.desde),
    hasta_hora: hh(s.hasta),
  }));

  const feriados = new Set(cierres.filter((c) => c.feriado).map((c) => c.fecha));
  const cerrado = (espacioId: string, fecha: string, desde: number, hasta: number) =>
    cierres.some(
      (c) =>
        !c.feriado &&
        c.fecha === fecha &&
        (c.espacio_id === null || c.espacio_id === espacioId) &&
        (c.desde_hora === null || (hora(c.desde_hora) < hasta && hora(c.hasta_hora ?? '24:00') > desde))
    );
  const pisa = (r: { desde_hora: string; hasta_hora: string }, desde: number, hasta: number) =>
    hora(r.desde_hora) < hasta && hora(r.hasta_hora) > desde;

  const filas: Fila[] = [];
  const choques: Choque[] = [];
  for (let f = periodo; f <= fin; f = sumarDias(f, 1)) {
    const dia = diaSemanaDe(f);
    for (const s of segmentos) {
      const c = s.contrato;
      if (c.dia_semana !== dia || !vigenteEn(c, f)) continue;
      const r = renovaciones[c.inquilino_id];
      if (feriados.has(f) && !(r?.feriados ?? []).includes(f)) continue;
      if (cerrado(c.espacio_id, f, s.desde, s.hasta)) continue;

      const mismas = existentes.filter((x) => x.fecha === f && x.espacio_id === c.espacio_id);
      // Ya lo tiene, o lo tuvo y lo soltó: no se vuelve a crear.
      if (mismas.some((x) => x.inquilino_id === c.inquilino_id && pisa(x, s.desde, s.hasta))) continue;
      const otra = mismas.find((x) => x.estado === 'activa' && x.inquilino_id !== c.inquilino_id && pisa(x, s.desde, s.hasta));
      if (otra) {
        choques.push({
          inquilino: nombre(c.inquilino_id),
          sala: sala(c.espacio_id),
          fecha: f,
          desde: hh(s.desde),
          hasta: hh(s.hasta),
          con: nombre(otra.inquilino_id),
        });
        continue;
      }

      const horas = s.hasta - s.desde;
      const tramo = Math.max(horasSemanalesTotales(comoQueda, c.inquilino_id, f), horas);
      const precio = cotizar(escala.tarifas, c.espacio_id, tramo)?.precioHora ?? null;
      filas.push({
        inquilino_id: c.inquilino_id,
        espacio_id: c.espacio_id,
        fecha: f,
        desde_hora: hh(s.desde),
        hasta_hora: hh(s.hasta),
        importe: precio === null ? null : precio * horas,
      });
    }
  }

  // Una fila por persona con bandas o con respuesta, aunque no sume reservas:
  // quien dijo que no tiene que aparecer, y quien no contestó también.
  const ids = new Set([
    ...delMes.map((c) => c.inquilino_id),
    ...Object.keys(renovaciones).filter((id) => activos.has(id) && (!soloInquilino || id === soloInquilino)),
  ]);
  const resumen: ResumenInquilino[] = [...ids].map((id) => {
    const r = renovaciones[id];
    const suyas = filas.filter((x) => x.inquilino_id === id);
    return {
      id,
      nombre: nombre(id),
      respuesta: r?.respuesta ?? null,
      nota: r?.nota ?? null,
      horasQueDeja: r?.aplicada_at ? 0 : (r?.deja ?? []).length,
      horasQueSuma: abierto[0]
        ? 0
        : delMes
            .filter((c) => c.inquilino_id === id && c.vigente_desde === periodo)
            .reduce((n, c) => n + hora(c.hasta_hora) - hora(c.desde_hora), 0),
      feriados: r?.feriados ?? [],
      horasSemanaAntes: horasSemanalesTotales(delMes, id, periodo),
      horasSemana: horasSemanalesTotales(comoQueda, id, periodo),
      reservas: suyas.length,
      horas: suyas.reduce((n, x) => n + hora(x.hasta_hora) - hora(x.desde_hora), 0),
      importe: suyas.reduce((n, x) => n + (x.importe ?? 0), 0),
    };
  });
  resumen.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return { periodo, abierto: abierto[0] ?? null, inquilinos: resumen, filas, choques };
}

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

async function rest(metodo: string, ruta: string, cuerpo?: unknown, devolver = false) {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${ruta}`, {
    method: metodo,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: devolver ? 'return=representation' : 'return=minimal',
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${metodo} ${ruta.split('?')[0]} ${res.status}: ${await res.text()}`);
  return devolver ? res.json() : null;
}

/**
 * Pasa a los contratos lo que cada uno contestó: cierra las bandas de quien no
 * sigue y recorta las que dejan horas. Una banda recortada se cierra el día
 * anterior al mes y nace de nuevo, con lo que queda, desde el 1: así la
 * historia dice qué alquilaba cada uno en cada mes.
 */
async function aplicarRespuestas(periodo: string, soloInquilino?: string): Promise<void> {
  const [contratos, renovaciones] = await Promise.all([leerContratos(), renovacionesDe(periodo)]);
  const vispera = sumarDias(periodo, -1);
  const abiertas = (id: string) =>
    contratos.filter((c) => c.inquilino_id === id && (c.vigente_hasta === null || c.vigente_hasta >= periodo));

  for (const r of Object.values(renovaciones)) {
    if (r.aplicada_at || (soloInquilino && r.inquilino_id !== soloInquilino)) continue;
    const afectadas =
      r.respuesta === 'no'
        ? abiertas(r.inquilino_id)
        : abiertas(r.inquilino_id).filter((c) => horasQueDeja(r, c.id).length > 0);

    for (const c of afectadas) {
      // Una banda que recién empieza este mes no tiene historia que guardar.
      if (c.vigente_desde >= periodo) await rest('DELETE', `contratos?id=eq.${c.id}`);
      else await rest('PATCH', `contratos?id=eq.${c.id}`, { vigente_hasta: vispera });
      if (r.respuesta === 'no') continue;
      const nuevas = recortar(c, horasQueDeja(r, c.id)).map((t) => ({
        inquilino_id: c.inquilino_id,
        espacio_id: c.espacio_id,
        dia_semana: c.dia_semana,
        desde_hora: hh(t.desde),
        hasta_hora: hh(t.hasta),
        vigente_desde: c.vigente_desde >= periodo ? c.vigente_desde : periodo,
        vigente_hasta: c.vigente_hasta,
      }));
      if (nuevas.length > 0) await rest('POST', 'contratos', nuevas);
    }
    await rest('PATCH', `renovaciones?id=eq.${r.id}`, { aplicada_at: new Date().toISOString() });
  }
}

/**
 * Abre el mes: aplica las respuestas a los contratos y genera reservas y
 * cargos. Devuelve cuántas reservas creó y por cuánto.
 */
export async function abrirMes(
  periodo: string,
  quien: string,
  /**
   * Solo las bandas de esa persona: es lo que corre al sumarle una banda en un
   * mes ya abierto, para completarle las fechas sin tocar a nadie más.
   */
  soloInquilino?: string
): Promise<{ reservas: number; importe: number; choques: Choque[] }> {
  await aplicarRespuestas(periodo, soloInquilino);
  const plan = await planDelMes(periodo, soloInquilino);
  const espacios = await listarEspacios();
  const sala = (id: string) => espacios.find((e) => e.id === id)?.nombre ?? 'Sala';

  if (plan.filas.length > 0) {
    const creadas = (await rest(
      'POST',
      'reservas',
      plan.filas.map((f) => ({ ...f, origen: 'contrato' })),
      true
    )) as { id: string; inquilino_id: string; espacio_id: string; fecha: string; desde_hora: string; hasta_hora: string; importe: number | null }[];
    const cargos = creadas
      .filter((r) => r.importe !== null)
      .map((r) => ({
        inquilino_id: r.inquilino_id,
        tipo: 'cargo',
        fecha: r.fecha,
        periodo: periodoDe(r.fecha),
        importe: r.importe,
        reserva_id: r.id,
        detalle: `${sala(r.espacio_id)}, ${r.desde_hora.slice(0, 5)} a ${r.hasta_hora.slice(0, 5)}`,
        quien,
      }));
    if (cargos.length > 0) await rest('POST', 'movimientos', cargos);
  }

  const importe = plan.filas.reduce((n, f) => n + (f.importe ?? 0), 0);
  // Si ya estaba abierto queda la primera apertura: completar no la pisa. Ni
  // completar a una sola persona da por abierto el mes de todos. Lucila se
  // entera por correo, abra quien lo abra.
  if (!plan.abierto && !soloInquilino) {
    await upsert(
      'centro_meses',
      { periodo, quien, reservas: plan.filas.length, importe },
      'periodo',
      false
    );
    await avisarMesAbierto({
      periodo,
      mes: mesLargo(periodo),
      reservas: plan.filas.length,
      importe,
      quien,
      choques: plan.choques.length,
    });
  }
  revalidateTag('consultorios', { expire: 0 });
  return { reservas: plan.filas.length, importe, choques: plan.choques };
}

/**
 * Lo que corre el cron todos los días. El último día del mes abre el que
 * sigue; y si el mes en curso quedó sin abrir (el cron no corrió, falló), lo
 * abre al día siguiente. Nunca abre dos veces el mismo mes.
 */
export async function abrirSiToca(hoy: string): Promise<{ periodo: string; reservas: number; importe: number }[]> {
  const actual = periodoDe(hoy);
  const siguiente = mesCorrido(actual, 1);
  const candidatos = [actual, ...(sumarDias(hoy, 1) === siguiente ? [siguiente] : [])];
  const abiertos = await select<{ periodo: string }>(
    'centro_meses',
    `select=periodo&periodo=in.(${candidatos.join(',')})`
  );
  const hechos: { periodo: string; reservas: number; importe: number }[] = [];
  for (const p of candidatos) {
    if (abiertos.some((a) => a.periodo === p)) continue;
    try {
      const r = await abrirMes(p, 'Apertura automática');
      hechos.push({ periodo: p, reservas: r.reservas, importe: r.importe });
    } catch (e) {
      // Sin abrir, el mes queda vacío: que lo sepa alguien hoy y no el día 10.
      await avisarFallaDeApertura({ periodo: p, mes: mesLargo(p), error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  }
  return hechos;
}

/** Los meses ya abiertos desde `periodo` en adelante. */
export async function mesesAbiertosDesde(periodo: string): Promise<string[]> {
  const filas = await select<{ periodo: string }>('centro_meses', `select=periodo&periodo=gte.${periodo}`);
  return filas.map((f) => f.periodo).sort();
}

/**
 * Termina una banda: le pone fecha de fin y saca las reservas que ya había
 * generado después de esa fecha, con su cargo. Una banda que termina no deja
 * horas cobradas en los meses que siguen.
 */
export async function terminarBanda(contratoId: string, hasta: string): Promise<number> {
  const c = (await leerContratos()).find((x) => x.id === contratoId);
  if (!c) throw new Error('Esa banda no existe.');
  if (hasta < c.vigente_desde) {
    await rest('DELETE', `contratos?id=eq.${c.id}`);
  } else {
    await rest('PATCH', `contratos?id=eq.${c.id}`, { vigente_hasta: hasta });
  }
  const futuras = (await select<{ id: string; fecha: string; desde_hora: string; hasta_hora: string }>(
    'reservas',
    `select=id,fecha,desde_hora,hasta_hora&inquilino_id=eq.${c.inquilino_id}&espacio_id=eq.${c.espacio_id}` +
      `&origen=eq.contrato&estado=eq.activa&fecha=gt.${hasta < c.vigente_desde ? sumarDias(c.vigente_desde, -1) : hasta}`
  )).filter(
    (r) =>
      diaSemanaDe(r.fecha) === c.dia_semana &&
      hora(r.desde_hora) >= hora(c.desde_hora) &&
      hora(r.hasta_hora) <= hora(c.hasta_hora)
  );
  if (futuras.length > 0) {
    const ids = futuras.map((r) => r.id).join(',');
    await rest('DELETE', `movimientos?reserva_id=in.(${ids})&tipo=eq.cargo`);
    await rest('PATCH', `reservas?id=in.(${ids})`, { estado: 'cancelada' });
  }
  revalidateTag('consultorios', { expire: 0 });
  return futuras.length;
}

export type EstadoDeLaApertura = {
  /** El mes del que habla, escrito: "diciembre". */
  mes: string;
  titulo: string;
  detalle: string;
  /** En rojo: un mes en curso sin abrir. */
  urgente: boolean;
};

/**
 * Lo que la tarjeta de Inicio dice de la apertura, o null si no hay nada que
 * decir. Desde el 26 habla del mes que viene; antes, solo si el mes en curso
 * quedó sin abrir.
 */
export async function estadoDeLaApertura(hoy = hoyISO()): Promise<EstadoDeLaApertura | null> {
  const actual = periodoDe(hoy);
  const siguiente = mesCorrido(actual, 1);
  const filas = await select<{ periodo: string; reservas: number; importe: number; abierto_at: string }>(
    'centro_meses',
    `select=periodo,reservas,importe,abierto_at&periodo=in.(${actual},${siguiente})`
  );
  const solo = (p: string) => mesLargo(p).split(' ')[0];
  const pesos = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n));

  if (!filas.some((f) => f.periodo === actual)) {
    return {
      mes: solo(actual),
      titulo: `${solo(actual)} sin abrir`,
      detalle: 'El calendario está vacío. Se abre solo mañana a las 10, o tocá "Abrir ahora".',
      urgente: true,
    };
  }
  if (Number(hoy.slice(8, 10)) < 26) return null;

  const abierto = filas.find((f) => f.periodo === siguiente);
  if (abierto) {
    return {
      mes: solo(siguiente),
      titulo: `${solo(siguiente)} abierto`,
      detalle: `${abierto.reservas} reservas por ${pesos(abierto.importe)}.`,
      urgente: false,
    };
  }
  const [contratos, inquilinos, renovaciones] = await Promise.all([
    leerContratos(),
    listarInquilinos(),
    renovacionesDe(siguiente),
  ]);
  const activos = new Set(inquilinos.filter((i) => i.activo).map((i) => i.id));
  const conHoras = new Set(
    contratos
      .filter((c) => activos.has(c.inquilino_id) && (c.vigente_hasta === null || c.vigente_hasta >= siguiente))
      .map((c) => c.inquilino_id)
  );
  const contestaron = [...conHoras].filter((id) => renovaciones[id]).length;
  const dia = Number(sumarDias(siguiente, -1).slice(8, 10));
  return {
    mes: solo(siguiente),
    titulo: `${solo(siguiente)} se abre el ${dia} a las 10`,
    detalle: `Contestaron ${contestaron} de ${conHoras.size}. Quien no contesta renueva sus mismas horas.`,
    urgente: false,
  };
}
