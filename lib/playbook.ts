/**
 * Playbook de conducción: qué hacer con cada persona, para su líder.
 *
 * El contenido no se escribe persona por persona. Se escribe una vez por
 * cuadrante y por generación, y acá se combina con los datos de cada uno.
 * Con 4 cuadrantes y 4 generaciones, esta biblioteca cubre las 128 personas
 * del cuestionario de liderazgo y se corrige en un solo lugar.
 *
 * Para cada dimensión hay un eje que manda (casi siempre el cuadrante, que
 * es lo estructural) y otro que matiza. El "por qué" siempre suma los dos.
 */

import { INFO, PERFILES, type Perfil, type Puntajes } from './perfiles';
import { INFO_GENERACION, type Generacion } from './generaciones';

export type DimensionId =
  | 'motivar'
  | 'feedback'
  | 'autonomia'
  | 'comunicar'
  | 'tareas'
  | 'animo';

export type Dimension = {
  id: DimensionId;
  titulo: string;
  /** Quién gobierna el contenido de esta dimensión. */
  eje: 'cuadrante' | 'generacion';
};

// Los títulos van en neutro: el mismo playbook se usa para cualquier persona.
export const DIMENSIONES: Dimension[] = [
  { id: 'motivar', titulo: 'Cómo motivar', eje: 'cuadrante' },
  { id: 'feedback', titulo: 'Cómo dar feedback', eje: 'cuadrante' },
  { id: 'autonomia', titulo: 'Cuánta autonomía dar', eje: 'generacion' },
  { id: 'comunicar', titulo: 'Cómo comunicarse', eje: 'cuadrante' },
  { id: 'tareas', titulo: 'Qué tareas energizan y cuáles agotan', eje: 'cuadrante' },
  { id: 'animo', titulo: 'Cómo levantar el ánimo', eje: 'cuadrante' },
];

/** Lo que aporta un cuadrante o una generación a una dimensión. */
export type Bloque = {
  /** La instrucción central. Sólo la escribe el eje que manda. */
  core?: string;
  /** Fundamento. Se suman los dos ejes. */
  porque: string;
  verde?: string;
  alerta?: string;
  funciona?: string;
  nofunciona?: string;
};

type PorDimension = Partial<Record<DimensionId, Bloque>>;

// ------------------------------------------------------- bloques por cuadrante

export const BLOQUES_CUADRANTE: Record<Perfil, PorDimension> = {
  BD: {
    motivar: {
      core: 'Conectá siempre la tarea con el impacto en personas concretas. No alcanza con el qué, necesita el para quién.',
      porque:
        'Su cuadrante BD tiene como motor la conexión con otros. El trabajo sin impacto humano visible le resulta vacío, aunque lo ejecute bien.',
      verde:
        'Se ofrece a ayudar a otros espontáneamente, propone iniciativas de clima, pregunta cómo están antes de arrancar.',
      alerta:
        'Cumple pero sin iniciativa. Se apaga. Empieza a quejarse de falta de reconocimiento sin decirlo directamente.',
      funciona:
        '"Necesito que cierres esto porque el equipo está esperando para poder avanzar tranquilo."',
      nofunciona: '"Necesito que cierres este proceso para el jueves."',
    },
    feedback: {
      core: 'Primero validá la intención relacional que había detrás. Después entrás al ajuste. Siempre en persona, nunca por escrito para cosas importantes.',
      porque:
        'El BD procesa el feedback primero desde lo emocional. Sin sentir vínculo y buena intención detrás, el mensaje no entra y activa defensas. No es susceptibilidad, es cómo jerarquiza la información.',
      verde: 'Escucha activamente, hace preguntas, toma nota.',
      alerta: 'Se cierra, responde monosílabos, asiente pero no procesa.',
      funciona:
        '"Sé que lo hiciste pensando en el equipo, y eso se valora. Lo que necesito ajustar es esto puntual."',
      nofunciona: '"Esto no es lo que te pedí", sin contexto ni reconocimiento previo.',
    },
    autonomia: {
      porque: 'Su BD necesita espacio para gestionar las relaciones del equipo a su manera.',
      verde: 'Entrega en tiempo. Te avisa si hay algo que puede afectar el resultado.',
      alerta:
        'Hace preguntas de validación excesivas: señal de que no confía en su propio criterio o no tiene claro el objetivo.',
    },
    comunicar: {
      core: 'Presencial o por teléfono para todo lo importante. Para lo operativo el texto está bien, pero con el dato clave en la primera línea.',
      porque:
        'Su BD capta señales no verbales como fuente primaria de información. Un mensaje escrito le da una parte del mensaje; el resto lo completa con suposiciones, que en un BD suelen ser emocionales.',
      verde: 'Responde rápido, hace preguntas, propone alternativas.',
      alerta: 'Tarda en responder, contesta con "ok" a cosas que normalmente lo movilizarían.',
      funciona:
        'Preguntarle cómo está antes de entrar al tema. Es información real, no protocolo.',
      nofunciona:
        'Mensajes largos con instrucciones complejas. Los lee pero queda con dudas que no te hace para no molestar.',
    },
    tareas: {
      core: 'Energiza: mediar conflictos, coordinar trabajo colaborativo, comunicar cambios al equipo. Agota: análisis de datos fríos, decisiones sólo con números.',
      porque:
        'Usar el cuadrante no preferido consume el doble de energía. Un día entero de planillas agota aunque técnicamente pueda hacerlo.',
      verde:
        'Llega con energía a las reuniones con interacción. Propone soluciones relacionales espontáneamente.',
      alerta: 'Llega tarde a entregas de reportes, hace el mínimo en tareas analíticas.',
      funciona:
        'Si tiene que hacer tareas analíticas, combinalas en la misma semana con algo relacional.',
      nofunciona: 'Varios días consecutivos de trabajo individual sin interacción con personas.',
    },
    animo: {
      core: 'Reconocé algo específico que hizo por alguien. No genérico. Preguntale cómo está esa persona, no el equipo.',
      porque:
        'El BD da mucho emocionalmente y su mayor vulnerabilidad es no recibir lo mismo. Cuando el balance es asimétrico por mucho tiempo, se agota en silencio. Su punto débil es poner límites.',
      verde: 'Está disponible, pregunta cómo están los demás, propone antes de que le pidas.',
      alerta:
        'Se vuelve más formal, deja de preguntar cómo están los demás, responde más corto.',
      funciona: '"Lo que hiciste con X la semana pasada hizo una diferencia real para el equipo."',
      nofunciona: '"Buen trabajo." Los reconocimientos genéricos no llegan de la misma manera.',
    },
  },

  // Pendientes: mismo formato que BD, uno por dimensión.
  FI: {},
  FD: {},
  BI: {},
};

// ------------------------------------------------------ bloques por generación

export const BLOQUES_GENERACION: Record<Generacion, PorDimension> = {
  x: {
    motivar: {
      porque: 'La Generación X valora el crecimiento profesional y el propósito más allá del salario.',
    },
    autonomia: {
      core: 'Mucha. Trabaja bien sin supervisión. Lo que necesita es saber que puede venir a vos con los problemas del equipo.',
      porque:
        'La Generación X valora resultados sobre proceso. Controlar paso a paso activa resistencia porque se lee como desconfianza.',
      funciona:
        'Checkpoints espaciados, enmarcados como "¿cómo venís vos?" más que "¿cómo viene la tarea?".',
      nofunciona: 'Pedirle avances por pasos o preguntar el estado de cada tarea por separado.',
    },
    comunicar: {
      porque: 'Prefiere el contacto personal o los medios tradicionales antes que lo digital.',
    },
    animo: {
      porque:
        'Puede necesitar que le adviertan sobre los límites saludables para no llegar al agotamiento.',
    },
  },

  // Pendientes: mismo formato que la Generación X.
  boomer: {},
  y: {},
  z: {},
};

// ------------------------------------------------------------ acción semanal

export type Semana = {
  n: number;
  titulo: string;
  dimension: DimensionId;
  accion: string;
  porque: string;
};

export const SEMANAS: Partial<Record<Perfil, Semana[]>> = {
  BD: [
    {
      n: 1,
      titulo: 'Escuchar a la persona',
      dimension: 'animo',
      accion:
        'Antes de tu próxima reunión, dedicá los primeros dos minutos a preguntarle cómo está. No por el equipo ni por la tarea: por la persona. Escuchá sin dar consejos ni resolver nada.',
      porque:
        'Da mucho emocionalmente y casi nadie le pregunta cómo está. Este gesto simple establece el tipo de relación que van a tener y abre el canal para todo lo que viene después.',
    },
    {
      n: 2,
      titulo: 'Auditá su carga',
      dimension: 'tareas',
      accion:
        'Revisá las tareas que tiene asignadas esta semana. Contá cuántas son analíticas o de datos fríos y cuántas son relacionales. Si el balance está invertido, reasigná o compensá antes del viernes.',
      porque:
        'Hacer demasiadas tareas frías consecutivas agota sin que lo diga. Prevenir es más fácil que reconocer el agotamiento después.',
    },
    {
      n: 3,
      titulo: 'Reconocimiento específico',
      dimension: 'motivar',
      accion:
        'Esta semana decile algo concreto sobre el impacto que tuvo en alguien del equipo. No "bien hecho", sino "lo que hiciste con X cuando pasó Y generó esto".',
      porque:
        'El BD se recarga con el reconocimiento del impacto humano de sus acciones, no con elogios genéricos. La especificidad es lo que hace que llegue de verdad.',
    },
    {
      n: 4,
      titulo: 'Canal correcto',
      dimension: 'comunicar',
      accion:
        'Si tenés algo importante que decirle (una corrección, un cambio, una novedad) buscá a la persona o llamala. No lo resuelvas por mensaje aunque sea más rápido.',
      porque:
        'Sin lenguaje corporal ni tono procesa sólo una parte del mensaje y completa el resto con suposiciones emocionales. El canal cambia por completo cómo recibe lo que le decís.',
    },
    {
      n: 5,
      titulo: 'Usá su radar',
      dimension: 'autonomia',
      accion:
        'Preguntale cómo ve el clima del equipo, como consulta genuina y no como control. "¿Cómo notás al equipo últimamente?" y después escuchá sin filtrar ni defender.',
      porque:
        'Percibe el estado emocional del equipo antes que vos. Ese radar es información real que ningún dato te da. Esta semana usalo como fuente de inteligencia del equipo.',
    },
  ],
};

// -------------------------------------------------------------- construcción

export type DimensionArmada = {
  id: DimensionId;
  titulo: string;
  core: string;
  porque: string;
  verde?: string;
  alerta?: string;
  funciona?: string;
  nofunciona?: string;
};

export type PlaybookPersona = {
  dimensiones: DimensionArmada[];
  semanas: Semana[];
  /** Dimensiones sin contenido cargado todavía, para no publicar a medias. */
  faltantes: DimensionId[];
};

/**
 * Arma el playbook de una persona a partir de su cuadrante y su generación.
 * Las dimensiones sin contenido quedan afuera y se listan en `faltantes`.
 */
export function armarPlaybook(
  perfil: Perfil,
  generacion: Generacion | null
): PlaybookPersona {
  const porCuadrante = BLOQUES_CUADRANTE[perfil] ?? {};
  const porGeneracion = generacion ? BLOQUES_GENERACION[generacion] ?? {} : {};

  const dimensiones: DimensionArmada[] = [];
  const faltantes: DimensionId[] = [];

  for (const d of DIMENSIONES) {
    const cuadrante = porCuadrante[d.id];
    const gen = porGeneracion[d.id];
    const principal = d.eje === 'generacion' ? gen : cuadrante;
    const secundario = d.eje === 'generacion' ? cuadrante : gen;

    // Sin la instrucción central no hay nada útil que mostrar.
    if (!principal?.core) {
      faltantes.push(d.id);
      continue;
    }

    dimensiones.push({
      id: d.id,
      titulo: d.titulo,
      core: principal.core,
      porque: [principal.porque, secundario?.porque].filter(Boolean).join(' '),
      verde: principal.verde ?? secundario?.verde,
      alerta: principal.alerta ?? secundario?.alerta,
      funciona: principal.funciona ?? secundario?.funciona,
      nofunciona: principal.nofunciona ?? secundario?.nofunciona,
    });
  }

  return { dimensiones, semanas: SEMANAS[perfil] ?? [], faltantes };
}

/** Cuadrante opuesto en diagonal: el que más energía le consume. */
export function opuesto(perfil: Perfil): Perfil {
  const pares: Record<Perfil, Perfil> = { FI: 'BD', BD: 'FI', FD: 'BI', BI: 'FD' };
  return pares[perfil];
}

/** Los cuatro puntajes ordenados de mayor a menor. */
export function ranking(totales: Puntajes): { perfil: Perfil; total: number }[] {
  return [...PERFILES]
    .map((p) => ({ perfil: p, total: totales[p] }))
    .sort((a, b) => b.total - a.total);
}

export const NOMBRE_PERFIL = (p: Perfil) => INFO[p].nombre;
export const NOMBRE_GENERACION = (g: Generacion) => INFO_GENERACION[g].nombre;
