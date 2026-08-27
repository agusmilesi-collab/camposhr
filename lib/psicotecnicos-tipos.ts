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

/**
 * Si el informe de esa evaluación ya se entregó.
 *
 * Seguimiento viene después de entregar: la persona ingresó a la empresa y a
 * los noventa días se mira cómo le fue. El informe que se entregó sigue siendo
 * suyo, así que mover la evaluación a seguimiento no puede sacárselo al cliente
 * de su portal.
 */
export function yaEntregada(estado: string): boolean {
  return estado === 'Entregado' || estado === 'Seguimiento';
}

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
  // El circuito entero de una entrevista en un tablero: repartir, citar,
  // agendar y analizar. Son el trabajo de la misma persona sobre el mismo
  // caso, y tenerlas en pantallas distintas obligaba a saltar de una a otra
  // para seguir a alguien. La etapa se cambia arrastrando la tarjeta.
  //
  // **Sin asignar era su propia sección hasta el 27/8/2026.** Repartir es el
  // primer paso de esa misma entrevista, y en una pantalla aparte había que
  // salir del tablero para ver quién no tenía dueño y volver para ver qué se
  // hizo con esa persona. Como columna, además, se ve contra qué se reparte:
  // la cola que ya tiene cada evaluadora está al lado.
  {
    ruta: 'entrevistas',
    texto: 'Entrevistas',
    etapas: ['Sin asignar', 'Por citar', 'Por entrevistar', 'Por analizar'],
  },
  // El cierre: el informe salió, y a los noventa días de que la persona entró
  // se llama al cliente para preguntar cómo le fue. Es el mismo tramo, y con
  // Seguimiento en su propia pantalla la segunda mitad del circuito quedaba
  // donde nadie entra salvo que se acuerde.
  { ruta: 'entregados', texto: 'Entregados', etapas: ['Entregado', 'Seguimiento'] },
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
  // Verde: el trabajo salió. Caía en gris, que es el color de lo que no pide
  // nada, y el informe entregado es justamente el final que se busca.
  Entregado: 'os-verde',
  Seguimiento: 'os-violeta',
};

/**
 * El tablero de la home: en qué anda hoy cada evaluación.
 *
 * No es la etapa. La etapa dice dónde va la evaluación en el circuito; esto
 * dice qué está haciendo la evaluadora con ella ahora. Se puede estar
 * escribiendo un informe que figura como "Por analizar" y no haber empezado
 * otro que está en esa misma etapa, y esa diferencia es justamente la que hay
 * que ver al abrir el OS.
 *
 * Sin valor es backlog: lo que entró y todavía nadie eligió para hoy.
 *
 * **La cuarta columna, Listo, no está acá porque no se guarda.** La decide la
 * etapa: entregar el informe manda la tarjeta ahí. Guardada, había que
 * arrastrar a mano lo que ya estaba terminado, y lo que nadie movía se quedaba
 * en curso para siempre.
 */
export const COLUMNAS_TABLERO = ['backlog', 'hoy', 'en_curso'] as const;

export type ColumnaTablero = (typeof COLUMNAS_TABLERO)[number];

export function esColumnaTablero(x: unknown): x is ColumnaTablero {
  return typeof x === 'string' && (COLUMNAS_TABLERO as readonly string[]).includes(x);
}

/** Las tres prioridades, de la que más apura a la que menos. */
export const PRIORIDADES = ['alta', 'media', 'baja'] as const;

export type Prioridad = (typeof PRIORIDADES)[number];

export function esPrioridad(x: unknown): x is Prioridad {
  return typeof x === 'string' && (PRIORIDADES as readonly string[]).includes(x);
}

export const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  alta: 'os-rojo',
  media: 'os-ambar',
  baja: 'os-verde',
};

/** Desde cuántos días de solicitada una evaluación pasa a cada prioridad. */
export const CORTE_PRIORIDAD = { alta: 10, media: 5 } as const;

/**
 * La prioridad que le toca a una evaluación que nadie fijó a mano.
 *
 * La da la espera: a los diez días de solicitada es alta, del quinto al noveno
 * media, antes baja. Se calcula en vez de guardarse porque el número cambia
 * solo con el paso de los días, y una prioridad escrita el día que entró
 * envejecería sin que nadie la toque.
 *
 * Sin fecha de solicitud no hay espera que contar, así que queda baja: lo que
 * no se sabe no puede desplazar a lo que sí espera hace días.
 */
export function prioridadPorDefecto(diasSolicitud: number | null): Prioridad {
  if (diasSolicitud === null) return 'baja';
  if (diasSolicitud >= CORTE_PRIORIDAD.alta) return 'alta';
  if (diasSolicitud >= CORTE_PRIORIDAD.media) return 'media';
  return 'baja';
}

/** La que vale: la fijada a mano, y si no la que dan los días de espera. */
export function prioridadDe(e: {
  prioridad: Prioridad | null;
  diasSolicitud: number | null;
}): Prioridad {
  return e.prioridad ?? prioridadPorDefecto(e.diasSolicitud);
}

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
  /** Si el pedido lleva Benziger, que no está en ninguna batería. */
  conBenziger: boolean;
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
  /** Si entró a trabajar. Null es "todavía no se sabe". */
  ingreso: boolean | null;
  /** Cuándo toca preguntar cómo le fue: noventa días desde que entró. */
  seguimientoAl: string | null;
  /** Cómo le fue en la empresa: Bien, Regular o Mal. Null es "sin preguntar". */
  seguimientoResultado: string | null;
  /** Si entró en alguna factura. Lo mantiene la sección Facturación. */
  facturado: boolean;
  /** Si esa factura se cobró. */
  pagado: boolean;
  tieneInforme: boolean;
  /** Si la persona tiene el CV guardado. Solo lo saben las filas de Supabase. */
  tieneCv: boolean;
  servicio: string | null;
  /** Días desde la entrevista, cuando ya se tomó. */
  dias: number | null;
  /**
   * Los mismos días, contando solo de lunes a viernes.
   *
   * Es lo que se mira para saber si un informe se está demorando: el trabajo es
   * de lunes a viernes, y contando corridos todo lo del fin de semana aparecía
   * demorado los lunes a la mañana.
   */
  diasHabiles: number | null;
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
  /** En qué columna del tablero de inicio está. Null es "por hacer". */
  tablero: ColumnaTablero | null;
  /** La prioridad fijada a mano. Null: la que dan los días de espera. */
  prioridad: Prioridad | null;
  prueba: boolean;
};
