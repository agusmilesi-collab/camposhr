/**
 * La forma de una evaluación, común a los dos orígenes.
 *
 * Vive en su propio archivo porque la importan el lector de Airtable, el de
 * Supabase y la capa que los junta: si estuviera en cualquiera de ellos, los
 * otros dos tendrían que importar de quien no les corresponde.
 */

export type Origen = 'airtable' | 'supabase';

/** Las etapas, en el orden del trabajo. */
export const ETAPAS = [
  'Sin asignar',
  'Por citar',
  'Por entrevistar',
  'Por analizar',
  'Entregado',
  'Seguimiento',
] as const;

export type Etapa = (typeof ETAPAS)[number];

/** La dirección de cada etapa dentro del OS. */
export const RUTA: Record<string, string> = {
  'Sin asignar': 'sin-asignar',
  'Por citar': 'por-citar',
  'Por entrevistar': 'por-entrevistar',
  'Por analizar': 'por-analizar',
  Entregado: 'entregados',
  Seguimiento: 'seguimiento',
};

export const ETAPA_DE_RUTA: Record<string, Etapa> = Object.fromEntries(
  Object.entries(RUTA).map(([etapa, ruta]) => [ruta, etapa as Etapa])
) as Record<string, Etapa>;

/**
 * Las secciones de la barra lateral.
 *
 * Una sección puede juntar más de una etapa: citar y entrevistar son dos
 * estados distintos en la base, pero un solo trabajo en la pantalla. Quien cita
 * es la misma que entrevista, y separarlas obligaba a saltar de una lista a la
 * otra para ver a la misma persona.
 *
 * Las etapas siguen siendo las de `ETAPAS`: esto agrupa la navegación, no
 * cambia el pipeline.
 */
export type Seccion = { ruta: string; texto: string; etapas: Etapa[] };

export const SECCIONES: Seccion[] = [
  { ruta: 'sin-asignar', texto: 'Sin asignar', etapas: ['Sin asignar'] },
  { ruta: 'entrevistas', texto: 'Entrevistas', etapas: ['Por citar', 'Por entrevistar'] },
  { ruta: 'por-analizar', texto: 'Por analizar', etapas: ['Por analizar'] },
  { ruta: 'entregados', texto: 'Entregados', etapas: ['Entregado'] },
];

export const SECCION_DE_RUTA: Record<string, Seccion> = Object.fromEntries(
  SECCIONES.map((s) => [s.ruta, s])
);

/** Dónde vive cada etapa dentro de la barra. */
export const SECCION_DE_ETAPA: Record<string, Seccion> = Object.fromEntries(
  SECCIONES.flatMap((s) => s.etapas.map((e) => [e, s]))
);


/**
 * El color del punto de cada etapa.
 *
 * Vive acá y no en una pantalla porque lo usan el panel de inicio y el reparto,
 * y dos mapas separados terminan pintando la misma etapa de dos colores. Las
 * clases están en `app/os/os.css`, junto a `.os-sello-estado`, que es quien
 * dibuja el punto.
 *
 * Una etapa sin entrada cae en gris, que es lo que corresponde a lo que ya
 * está cerrado y no pide nada.
 */
/**
 * El color de cada recomendación.
 *
 * Verde lo que pasa, ámbar lo que pasa con reparos, rojo lo que no. Los cuatro
 * de "Encaja" son del segundo juego de dimensiones, el que mide capacidad
 * contra demanda del puesto.
 */
export const COLOR_RECOMENDACION: Record<string, string> = {
  Apto: 'os-verde',
  'Apto con observaciones': 'os-ambar',
  'Apto con alertas': 'os-ambar',
  'No apto': 'os-rojo',
  'Encaja con el puesto': 'os-verde',
  'Encaja, con desarrollo': 'os-ambar',
  'Encaja si cambia el puesto': 'os-violeta',
  'Sin puesto contra el cual medir': 'os-gris',
};

export const COLOR_ETAPA: Record<string, string> = {
  'Sin asignar': 'os-gris',
  'Por citar': 'os-ambar',
  'Por entrevistar': 'os-verde',
  'Por analizar': 'os-azul',
  Seguimiento: 'os-violeta',
};

export type Evaluacion = {
  id: string;
  /** De qué lado vive esta fila. Decide a dónde va un guardado. */
  origen: Origen;
  nombre: string;
  empresa: string;
  puesto: string;
  /** A qué pedido entra. Solo lo traen las filas de Supabase. */
  pedidoId: string | null;
  bateria: string | null;
  email: string | null;
  telefono: string | null;
  evaluadora: string | null;
  etapa: string;
  mensaje: string | null;
  modalidad: string | null;
  fechaIngreso: string | null;
  fechaEntrevista: string | null;
  fechaEntrega: string | null;
  benderAdministrado: boolean;
  graficoAdministrado: boolean;
  linkRaven: string | null;
  recomendacion: string | null;
  tieneInforme: boolean;
  /** Si la persona tiene el CV guardado. Solo lo saben las filas de Supabase. */
  tieneCv: boolean;
  servicio: string | null;
  /** Días desde la entrevista, cuando ya se tomó. */
  dias: number | null;
  /** Días esperando desde que entró, cuando todavía no hay entrevista. */
  diasEsperando: number | null;
  /**
   * Días desde la solicitud, siempre.
   *
   * Se cuenta en el servidor y viaja como número: hecha en el navegador, la
   * cuenta cambia con el huso de quien mira y la primera pintura no coincide
   * con la que llega del servidor.
   */
  diasSolicitud: number | null;
  prueba: boolean;
};
