import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';

/**
 * Todo lo de una evaluación, para la ficha del candidato.
 *
 * Cada pestaña de la ficha sale de una tabla distinta, y todas cuelgan de
 * `evaluacion_id`. Se leen juntas y en paralelo: son consultas por clave y la
 * pantalla las necesita a todas para saber qué pestaña tiene contenido.
 *
 * **Lo clínico está vacío hasta que se migre.** Las tablas existen desde
 * `supabase/psicotecnicos.sql` pero hoy no tienen filas: los datos de Rorschach,
 * Benziger, Raven y competencias siguen en Airtable. La ficha las lee igual, así
 * que el día que entren los datos las pestañas se llenan sin tocar código.
 */

export type Cabecera = {
  id: string;
  /** De qué pedido cuelga. Con eso se ordena entre sus hermanos. */
  pedido_id: string | null;
  estado: string;
  mensaje: string | null;
  modalidad: string | null;
  fecha_ingreso: string | null;
  fecha_entrevista: string | null;
  fecha_entrega: string | null;
  /** Si se administró el test de manchas de su batería. */
  proyectivo_administrado: boolean;
  bender_administrado: boolean;
  /** Lo que la evaluadora anotó en la entrevista. Acá no se edita. */
  bender_observaciones: string | null;
  grafico_2_personas_administrado: boolean;
  bender_nombre: string | null;
  grafico_2_personas_observaciones: string | null;
  /** El dibujo que se subió en la entrevista, si hay uno. */
  grafico_2_personas_nombre: string | null;
  recomendacion: string | null;
  /** Por qué cierra así, escrito por la evaluadora. */
  recomendacion_notas: string | null;
  informe_path: string | null;
  /**
   * La entrevista por competencias, escrita por la evaluadora.
   *
   * Es el único test de la batería que no deja más rastro que su redacción, y
   * hasta ahora vivía en un Google Docs por candidato, fuera del sistema.
   */
  entrevista_competencias: string | null;
  facturado: boolean;
  pagado: boolean;
  /** Las listas del informe que tocó la evaluadora. Clave ausente = calculada. */
  informe_listas: Record<string, unknown> | null;
  /** Si entró a trabajar en la empresa. Null es "todavía no se sabe". */
  ingreso: boolean | null;
  fecha_ingreso_empresa: string | null;
  numero_factura: string | null;
  /** Cuándo toca preguntar cómo le fue: noventa días desde que entró. */
  seguimiento_al: string | null;
  seguimiento_resultado: string | null;
  seguimiento_notas: string | null;
  personas: { nombre: string; email: string | null; telefono: string | null } | null;
  evaluadoras: { nombre: string } | null;
  pedidos: {
    puesto: string;
    /** Si el pedido lleva Benziger, que no está en ninguna batería. */
    con_benziger: boolean | null;
    /** Con qué exigencia se leen los puntajes de todo el pedido. */
    exigencia_id: string | null;
    /** El token es el enlace del portal de esa empresa, si lo tiene. */
    empresas: { nombre: string; token_portal: string | null } | null;
    baterias: {
      id: string;
      codigo: string;
      nombre: string | null;
      /** Qué se le administra al candidato en esta batería. */
      tests: string[] | null;
    } | null;
  } | null;
};

export type Mancha = {
  id: string;
  test: string | null;
  lamina: string | null;
  n_respuesta: number | null;
  localizacion: string | null;
  n_localizacion: string | null;
  determinantes: string[] | null;
  fq: string | null;
  par: boolean | null;
  contenidos: string[] | null;
  popular: boolean | null;
  z: number | null;
  cc_ee: string[] | null;
  agc: boolean | null;
};

export type Sumario = Record<string, unknown> & { evaluacion_id: string };
export type Benziger = {
  cuadrante_preferente: string[] | null;
  /** Si los dos cuadrantes pesan lo mismo. Con false, manda el primero. */
  cuadrantes_parejos: boolean | null;
  resumen: string | null;
  pdf_path: string | null;
  /** Cómo se llamaba el archivo que se subió. */
  pdf_nombre: string | null;
  /** Lo extraído del PDF, tal como vino: no se recalcula nada de esto. */
  cuadrantes: Record<string, unknown> | null;
  adjetivos: Record<string, unknown> | null;
  abiertas: Record<string, unknown> | null;
  estres: Record<string, unknown> | null;
};
export type Raven = {
  raw: number | null;
  percentil: number | null;
  desvios: number | null;
  resultado: string | null;
  /** 'test' si lo escribió el test por el enlace, 'manual' si lo cargó la evaluadora. */
  origen: 'test' | 'manual' | null;
  /** Cuánto tardó en responderlo. Null si el puntaje se cargó a mano. */
  duracion_segundos: number | null;
};

/**
 * El test que la persona rindió por su enlace, si lo rindió.
 *
 * El puntaje puede haber entrado por dos caminos: lo escribe el test al
 * cerrarse, o lo carga la evaluadora a mano cuando el Raven se tomó en papel.
 * Los dos guardan en la misma fila, así que sin esto la ficha muestra un
 * número sin decir de dónde salió, y son cosas distintas de leer: un test
 * cortado por el reloj con diez láminas en blanco no se interpreta como uno
 * entregado.
 */
export type SesionRaven = {
  iniciado_at: string | null;
  terminado_at: string | null;
  cierre: string | null;
  respuestas: Record<string, number> | null;
};
export type Cualitativo = {
  id: string;
  test: string | null;
  fecha: string | null;
  observaciones: string | null;
  interpretacion: string | null;
  hallazgos: string | null;
};
/**
 * El análisis discursivo, si se cargó.
 *
 * El nivel lo ubica la evaluadora sobre la pirámide de Jaques y los dos textos
 * los escribe ella: el sistema no deduce nada de acá.
 */
export type Discursivo = {
  nivel: string | null;
  actual: string | null;
  futura: string | null;
};

export type Competencia = {
  id: string;
  competencia: string | null;
  puntaje: number | null;
  indicadores: string[] | null;
  justificacion: string | null;
  texto: string | null;
};

/** Los dos tests de manchas que puede llevar una batería. */
export const PROYECTIVOS = ['Rorschach', 'Zulliger'] as const;
export type Proyectivo = (typeof PROYECTIVOS)[number];

/** El test de manchas que declara la batería que se le vendió al cliente. */
export function proyectivoDeLaBateria(f: Ficha): Proyectivo | null {
  const tests = f.cabecera.pedidos?.baterias?.tests ?? [];
  return PROYECTIVOS.find((t) => tests.includes(t)) ?? null;
}

/** El test de manchas que tiene cargado el protocolo. */
export function proyectivoCargado(f: Ficha): Proyectivo | null {
  const cargado = f.manchas.find((m) => m.test)?.test;
  return PROYECTIVOS.find((t) => t === cargado) ?? null;
}

/**
 * Qué test de manchas es el de esta ficha.
 *
 * Con respuestas cargadas manda lo cargado, que es lo que efectivamente se le
 * tomó; con el protocolo vacío manda la batería, que es lo que se le va a
 * tomar. Cuando los dos existen y no coinciden, uno de los dos está mal y hay
 * que decirlo: ver `desajusteDeProyectivo`.
 */
export function proyectivoDe(f: Ficha): Proyectivo | null {
  return proyectivoCargado(f) ?? proyectivoDeLaBateria(f);
}

/**
 * La batería dice un test y el protocolo tiene cargado el otro.
 *
 * Pasa cuando se codifica sobre la ficha equivocada o cuando el pedido entró
 * con la batería que no era. Los dos casos se arreglan a mano y ninguno se
 * arregla solo, así que el aviso queda a la vista de quien codifica.
 */
export function desajusteDeProyectivo(
  f: Ficha
): { bateria: Proyectivo; cargado: Proyectivo } | null {
  const bateria = proyectivoDeLaBateria(f);
  const cargado = proyectivoCargado(f);
  if (!bateria || !cargado || bateria === cargado) return null;
  return { bateria, cargado };
}

/**
 * La factura que cubre esta evaluación, si ya se emitió.
 *
 * La ficha la muestra y no la deja tocar: se factura desde Facturación, que es
 * donde se elige qué entra en cada comprobante. Acá es el resultado de eso.
 */
export type FacturaDe = {
  id: string;
  numero: number | null;
  punto_venta: number | null;
  fecha: string;
  cobrada_at: string | null;
};

export type Ficha = {
  cabecera: Cabecera;
  /** Null si todavía no entró en ninguna factura. */
  factura: FacturaDe | null;
  /** El precio que regía el día del pedido, no el de hoy. */
  precio: number | null;
  manchas: Mancha[];
  sumario: Sumario | null;
  benziger: Benziger | null;
  raven: Raven | null;
  sesionRaven: SesionRaven | null;
  cualitativos: Cualitativo[];
  discursivo: Discursivo | null;
  competencias: Competencia[];
  /**
   * Qué lugar ocupa este candidato en su pedido, desde cero.
   *
   * El informe lo usa para elegir cuál de las formas de decir cada lectura le
   * toca: el segundo candidato de una búsqueda no repite los párrafos del
   * primero, y el cliente que recibe tres no lee tres veces lo mismo.
   */
  ordenEnPedido: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAMPOS_CABECERA =
  'id,pedido_id,estado,mensaje,modalidad,fecha_ingreso,fecha_entrevista,fecha_entrega,' +
  'proyectivo_administrado,bender_administrado,bender_observaciones,' +
  'grafico_2_personas_administrado,bender_nombre,' +
  'grafico_2_personas_nombre,grafico_2_personas_observaciones,' +
  'recomendacion,recomendacion_notas,informe_path,entrevista_competencias,' +
  'facturado,pagado,numero_factura,ingreso,fecha_ingreso_empresa,informe_listas,' +
  'seguimiento_al,seguimiento_resultado,seguimiento_notas,' +
  'personas(nombre,email,telefono),evaluadoras(nombre),' +
  'pedidos(puesto,con_benziger,exigencia_id,empresas(nombre,token_portal),' +
  'baterias(id,codigo,nombre,tests))';

/** Null si no existe, para que la pantalla conteste 404 en vez de romperse. */
export async function fichaDe(id: string): Promise<Ficha | null> {
  if (!UUID.test(id)) return null;

  const [
    cabeceras,
    manchas,
    sumarios,
    benzigers,
    ravens,
    sesiones,
    cualitativos,
    competencias,
    discursivos,
  ] = await Promise.all([
      select<Cabecera>('evaluaciones', `select=${CAMPOS_CABECERA}&id=eq.${id}`),
      select<Mancha>(
        'rorschach_respuestas',
        `select=*&evaluacion_id=eq.${id}&order=n_respuesta.asc`,
        CACHE_PSICOTECNICOS
      ),
      select<Sumario>('sumario_exner', `select=*&evaluacion_id=eq.${id}`, CACHE_PSICOTECNICOS),
      select<Benziger>(
        'benziger',
        `select=cuadrante_preferente,cuadrantes_parejos,resumen,pdf_path,pdf_nombre,cuadrantes,adjetivos,abiertas,estres&evaluacion_id=eq.${id}`,
        CACHE_PSICOTECNICOS
      ),
      select<Raven>(
        'raven',
        `select=raw,percentil,desvios,resultado,origen,duracion_segundos&evaluacion_id=eq.${id}`,
        CACHE_PSICOTECNICOS
      ),
      select<SesionRaven>(
        'raven_sesiones',
        `select=iniciado_at,terminado_at,cierre,respuestas&evaluacion_id=eq.${id}` +
          '&order=creado_at.desc&limit=1',
        CACHE_PSICOTECNICOS
      ),
      select<Cualitativo>(
        'tests_cualitativos',
        `select=id,test,fecha,observaciones,interpretacion,hallazgos&evaluacion_id=eq.${id}&order=test.asc`,
        CACHE_PSICOTECNICOS
      ),
      select<Competencia>(
        'informe_competencias',
        `select=id,competencia,puntaje,indicadores,justificacion,texto&evaluacion_id=eq.${id}&order=competencia.asc`,
        CACHE_PSICOTECNICOS
      ),
      select<Discursivo>(
        'analisis_discursivo',
        `select=nivel,actual,futura&evaluacion_id=eq.${id}`,
        CACHE_PSICOTECNICOS
      ),
    ]);

  const cabecera = cabeceras[0];
  if (!cabecera) return null;

  // El precio no sale de la batería sino de su historia, a la fecha del pedido:
  // un aumento de hoy no cambia lo que valió una evaluación de marzo.
  const bateriaId = cabecera.pedidos?.baterias?.id;
  let precio: number | null = null;
  if (bateriaId) {
    const historia = await select<{ precio: number; desde: string }>(
      'bateria_precios',
      `select=precio,desde&bateria_id=eq.${bateriaId}&order=desde.desc`
    ).catch(() => []);
    const dia = (cabecera.fecha_ingreso ?? new Date().toISOString()).slice(0, 10);
    const vigente = historia.find((h) => h.desde <= dia);
    precio = vigente ? Number(vigente.precio) : null;
  }

  // La factura se busca por el renglón: es lo que dice en qué comprobante
  // entró esta persona, y no la tilde de la evaluación, que es un espejo.
  const renglones = await select<{ facturas: FacturaDe | null }>(
    'factura_items',
    `select=facturas(id,numero,punto_venta,fecha,cobrada_at)&evaluacion_id=eq.${id}&limit=1`
  ).catch(() => []);

  // Los hermanos de este candidato, por orden de entrada: su posición es lo que
  // corre las formas de decir cada lectura en el informe.
  const hermanos = cabecera.pedido_id
    ? await select<{ id: string }>(
        'evaluaciones',
        `select=id&pedido_id=eq.${cabecera.pedido_id}&order=created_at.asc`
      ).catch(() => [])
    : [];

  return {
    cabecera,
    ordenEnPedido: Math.max(0, hermanos.findIndex((h) => h.id === id)),
    factura: renglones[0]?.facturas ?? null,
    precio,
    manchas,
    sumario: sumarios[0] ?? null,
    benziger: benzigers[0] ?? null,
    raven: ravens[0] ?? null,
    sesionRaven: sesiones[0] ?? null,
    cualitativos,
    competencias,
    discursivo: discursivos[0] ?? null,
  };
}
