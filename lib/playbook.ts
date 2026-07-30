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
import { cuadrantesALeer, facetasActivas, type Faceta } from './facetas';

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

  // Fuentes: [B] Benziger (modos y qué agota a cada uno), [H] Herrmann (qué
  // frustra y cómo comunicarse), [SM] material de clase de Sentir Mindfulness.
  BI: {
    motivar: {
      core: 'Reconocé la consistencia, no el golpe de efecto. Decile qué salió bien porque el proceso estaba en orden.',
      porque:
        'Su fortaleza es la confiabilidad y el cumplimiento de plazos mediante cronogramas. Es un aporte que sólo se nota cuando falla.',
      verde: 'Avisa antes de que algo se venza y mantiene sus registros al día.',
      alerta: 'Empieza a cumplir literal, sin anticipar. Deja de avisar problemas.',
      funciona: '"Esto salió sin sobresaltos porque tenías el seguimiento al día."',
      nofunciona: '"Sos ordenado", como rasgo de carácter y no como aporte.',
    },
    feedback: {
      core: 'Concreto y con el criterio explícito: cuál es el estándar y en qué punto se apartó.',
      porque:
        'Lo que lo frustra son las instrucciones ambiguas. Sin saber contra qué se lo mide, su reacción es pedir más instrucciones, no menos.',
      verde: 'Pregunta por el criterio, toma nota, repregunta hasta entender.',
      alerta: 'Pide autorización para cosas que antes resolvía solo.',
      funciona: '"El procedimiento pide tres controles y se hicieron dos. Ese es el ajuste."',
      nofunciona: '"Fijate de mejorar eso", sin decir qué es eso.',
    },
    autonomia: {
      porque:
        'Se agota cuando lo obligan a operar fuera de un marco sistemático: la ambigüedad no la lee como libertad sino como falta de definición.',
      verde: 'Organiza su semana sin que se lo pidas.',
      alerta: 'Consulta cada paso: señal de que el objetivo no está claro.',
    },
    comunicar: {
      core: 'Por escrito y con el detalle completo. Es el único cuadrante donde un mensaje largo funciona mejor que una charla.',
      porque:
        'Su comunicación es escrita, específica y paso a paso. Aprende con procedimientos e instrucciones, y necesita poder volver a leer.',
      verde: 'Responde con el detalle y en el formato que le pediste.',
      alerta: 'Pide que le repitan cosas ya dichas de palabra.',
      funciona: 'Dejar por escrito lo acordado en la reunión.',
      nofunciona: 'Cambiar algo acordado sin avisar, aunque el cambio sea menor.',
    },
    tareas: {
      core: 'Energiza: ordenar procesos, controlar, planificar, sostener lo que ya está andando. Agota: improvisar, arrancar sin marco, cambios de último momento.',
      porque:
        'Se agota rápido cuando le hacen abandonar procesos establecidos, y los procesos caóticos lo frustran. Las interrupciones lo sacan de foco y empieza a hacer chequeos.',
      verde: 'Trae el trabajo terminado antes de la fecha.',
      alerta: 'Se traba y pospone cuando la consigna es abierta.',
      funciona: 'Si hay que innovar, darle el marco y el objetivo, no la hoja en blanco.',
      nofunciona: 'Cambiarle la prioridad tres veces en la misma semana.',
    },
    animo: {
      core: 'Devolvele previsibilidad: qué va a pasar, cuándo, y qué depende de él.',
      porque:
        'Lo que lo desgasta no es la carga sino la incertidumbre. La rutina es lo que le permite predecir y controlar el tiempo.',
      verde: 'Pregunta por los próximos pasos y se anticipa.',
      alerta: 'Se pone rígido con el reglamento, o repite la misma consulta.',
      funciona: '"Esto se define el jueves. Hasta entonces seguimos como está."',
      nofunciona: '"Todavía no sabemos, ya vemos."',
    },
  },

  FD: {
    motivar: {
      core: 'Dale el problema entero y espacio para reformularlo. Lo que lo mueve es lo que todavía no existe.',
      porque:
        'Capta conceptos completos a partir de información incompleta y se adapta rápido a lo nuevo. Su objetivo es crear soluciones o generar un cambio, y para eso necesita desafiar los límites.',
      verde: 'Aparece con ideas que nadie pidió y conecta cosas de áreas distintas.',
      alerta: 'Se aburre, empieza cosas y no las cierra.',
      funciona: '"Necesito que repensemos cómo hacemos esto. No hay formato previo."',
      nofunciona: '"Seguí el procedimiento tal como está."',
    },
    feedback: {
      core: 'Empezá por la idea, no por el error de forma. Separá el concepto de la prolijidad.',
      porque:
        'Su dificultad declarada es detectar el detalle y adecuarse a las normas, y las restricciones minuciosas lo frustran. Si el primer mensaje es sobre la forma, lee que su aporte no interesó.',
      verde: 'Toma el ajuste y vuelve con una versión mejor.',
      alerta: 'Deja de proponer y se limita a cumplir el pedido literal.',
      funciona: '"La idea es buena. Para que la puedan usar hay que ordenarla así."',
      nofunciona: 'Devolver un trabajo marcando sólo los errores de forma.',
    },
    autonomia: {
      porque:
        'La autonomía no es su problema: terminar sí. La bibliografía le atribuye dificultad de finalización y de sistematización, así que lo que necesita son hitos de cierre, no supervisión.',
      verde: 'Avanza solo y aparece con algo mejor de lo pedido.',
      alerta: 'Muchos frentes abiertos y ninguno cerrado.',
    },
    comunicar: {
      core: 'Con imágenes, ejemplos y metáforas. Poco texto y mucho para ver.',
      porque:
        'Piensa en voz alta usando metáforas y lenguaje visual. Se toma su tiempo en silencio para resolver y después comunica con imágenes; aprende mejor mirando.',
      verde: 'Devuelve la idea reformulada y mejorada.',
      alerta: 'Asiente sin repreguntar: no lo procesó.',
      funciona: 'Dibujarlo, mostrarle un ejemplo, hacerlo en una pizarra.',
      nofunciona: 'Un instructivo de doce pasos por escrito.',
    },
    tareas: {
      core: 'Energiza: diseñar, imaginar escenarios, arrancar cosas, integrar mundos distintos. Agota: seguimiento de detalle, control de rutina, carga administrativa.',
      porque:
        'Se vuelve inquieto y se desengancha en entornos rutinarios y predecibles, y los procedimientos rígidos lo frustran. Su cuadrante opuesto es Basal Izquierdo.',
      verde: 'Arranca proyectos y contagia entusiasmo.',
      alerta: 'Acumula lo administrativo hasta el último día.',
      funciona: 'Emparejarlo con alguien de perfil basal para el seguimiento.',
      nofunciona: 'Darle a él la planilla de control.',
    },
    animo: {
      core: 'Devolvele horizonte: para qué sirve lo que está haciendo y hacia dónde va.',
      porque:
        'Lo suyo son las ideas nuevas y las grandes tendencias. Sin horizonte queda sosteniendo una máquina andando, que es justo su zona de agotamiento.',
      verde: 'Pregunta por el largo plazo y propone hacia dónde seguir.',
      alerta: 'Deja de mirar más allá de la semana.',
      funciona: '"Esto que estás armando es la base de lo que viene después."',
      nofunciona: '"Por ahora hacé esto y después vemos", sostenido en el tiempo.',
    },
  },

  FI: {
    motivar: {
      core: 'Mostrale el problema, no la tarea. Y dejale la decisión sobre cómo resolverlo.',
      porque:
        'Está orientado a resultados y decide por análisis de causa y efecto: no sólo descubre el problema, además analiza la causa. Un encargo cerrado le saca la parte que le interesa.',
      verde: 'Propone alternativas que no le pediste y discute el enfoque.',
      alerta: 'Ejecuta sin opinar. En este cuadrante el silencio no es acuerdo.',
      funciona: '"Tenemos este problema y estas restricciones. ¿Cómo lo resolverías?"',
      nofunciona: '"Hacé esto así", cuando había margen para decidir.',
    },
    feedback: {
      core: 'Directo, con datos y sin rodeos. El preámbulo amable le resulta ruido.',
      porque:
        'Su comunicación es concisa y no emocional, y lo frustran las apelaciones emocionales sin datos y las afirmaciones vagas. Disfruta del debate enérgico.',
      verde: 'Discute el punto, pide precisión, acepta si el argumento cierra.',
      alerta: 'Concede rápido sin discutir: dejó de considerarlo relevante.',
      funciona: '"El costo se fue 15% arriba de lo previsto. Quiero entender dónde."',
      nofunciona: 'Dar vueltas diez minutos antes de decir el problema.',
    },
    autonomia: {
      porque:
        'Se agota operando sin objetivos claros ni resultados medibles. Lo que necesita no es supervisión sino restricciones explícitas: presupuesto, plazo, qué no se negocia.',
      verde: 'Toma decisiones dentro de su marco y las informa después.',
      alerta:
        'Pide autorización para todo: el marco no está claro, o alguna decisión suya fue desautorizada.',
    },
    comunicar: {
      core: 'Breve, con la conclusión primero y el detalle disponible si lo pide.',
      porque:
        'Usa lenguaje analítico y responde a la argumentación basada en evidencia. Aprende analizando lo global para llegar a las causas.',
      verde: 'Responde corto y concreto.',
      alerta: 'Deja de leer los hilos largos.',
      funciona: '"Necesito una decisión sobre X. Contexto abajo."',
      nofunciona: 'Reuniones para algo que era un párrafo.',
    },
    tareas: {
      core: 'Energiza: analizar, diagnosticar, optimizar, decidir con números. Agota: sostener climas, mediar tensiones, reuniones sin decisión.',
      porque:
        'Se agota cuando le exigen trabajo emocional prolongado; su mayor obstáculo declarado es detectar emociones. Su cuadrante opuesto es Basal Derecho.',
      verde: 'Llega con energía a las reuniones donde se decide algo.',
      alerta: 'Se impacienta o se desconecta en las conversaciones de clima.',
      funciona: 'Si hay que manejar algo sensible, darle el objetivo y acompañarlo.',
      nofunciona: 'Cadenas de reuniones informativas sin nada que resolver.',
    },
    animo: {
      core: 'Devolvele control: sobre su agenda, sobre un proyecto, sobre una decisión que venía pidiendo.',
      porque:
        'El modelo lo describe orientado a metas y a controlar las decisiones clave. Ver un problema evidente y no poder tocarlo lo apaga más que la carga de trabajo.',
      verde: 'Trae propuestas de mejora sin que se las pidan.',
      alerta: 'Deja de proponer y se limita a cumplir.',
      funciona: '"Esta decisión es tuya. Contame qué definiste."',
      nofunciona: 'Pedirle opinión y después resolver distinto sin explicar por qué.',
    },
  },
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

  // Salen de las cuatro placas generacionales del propio cuestionario.
  boomer: {
    motivar: {
      porque:
        'A esta generación la mueve la estabilidad, la lealtad y poder compartir su conocimiento con otras generaciones.',
    },
    autonomia: {
      core: 'Acordá el seguimiento en lugar de imponerlo. Prefiere estructura y jerarquía, con reglas claras y respetadas.',
      porque:
        'Valora la experiencia acumulada, así que un control que la pase por alto se lee como desautorización.',
      funciona: 'Definir juntos cada cuánto se conversa el avance, y sostenerlo.',
      nofunciona: 'Cambiar el esquema de seguimiento sin avisar.',
    },
    comunicar: {
      porque:
        'Prefiere el cara a cara o el teléfono antes que lo digital, y valora un feedback más formal y reservado.',
    },
    animo: {
      porque:
        'Aprende con interacción directa con expertos y material presencial; el cambio sin explicación lo desorienta.',
    },
  },

  y: {
    motivar: {
      porque:
        'A esta generación la mueve el equilibrio entre vida laboral y personal, la flexibilidad, poder innovar y un propósito más allá del salario.',
    },
    autonomia: {
      core: 'Alta, con las ideas circulando y trabajo en equipo. No confundas frecuencia de contacto con control.',
      porque:
        'Se siente cómoda donde las ideas fluyen libremente y el trabajo tiene un propósito que trasciende cumplir tareas.',
      funciona: 'Conversaciones frecuentes y cortas sobre el sentido de lo que está haciendo.',
      nofunciona: 'Reuniones de control sin espacio para que proponga.',
    },
    comunicar: {
      porque:
        'Se maneja con plataformas digitales, con un enfoque equilibrado, formal y textual.',
    },
    animo: {
      porque:
        'Aprende con videos, plataformas y aplicaciones, y espera devolución rápida y continua, no una vez por semestre.',
    },
  },

  z: {
    motivar: {
      porque:
        'A esta generación la mueven los entornos ágiles, el trabajo digital y que se priorice el bienestar personal.',
    },
    autonomia: {
      core: 'Alta en horario y lugar, con objetivos explícitos. La ambigüedad sobre lo que se espera la frena más que a otras generaciones.',
      porque:
        'Busca flexibilidad de horario y de ubicación, con acceso a tecnología y aprendizaje continuo.',
      funciona: 'Dejar el objetivo por escrito y no el procedimiento.',
      nofunciona: 'Horario fijo sin motivo operativo.',
    },
    comunicar: {
      porque:
        'Se comunica de manera informal, directa, rápida y visual.',
    },
    animo: {
      porque:
        'Aprende con videos cortos y contenido disponible cuando lo necesita; los plazos largos sin señales intermedias la desconectan.',
    },
  },
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
  /** Lo que suma de las frases que la persona marcó (capa 3). */
  propio: { faceta: string; texto: string }[];
};

export type PlaybookPersona = {
  dimensiones: DimensionArmada[];
  semanas: Semana[];
  /** Dimensiones sin contenido cargado todavía, para no publicar a medias. */
  faltantes: DimensionId[];
  /** Cuadrantes que se leyeron: el dominante y el segundo si está cerca. */
  leidos: Perfil[];
  /** Facetas activas, por cuadrante, para mostrarlas si hace falta. */
  facetas: { perfil: Perfil; faceta: Faceta }[];
};

/**
 * Arma el playbook de una persona a partir de su cuadrante y su generación.
 * Las dimensiones sin contenido quedan afuera y se listan en `faltantes`.
 */
export function armarPlaybook(
  perfil: Perfil,
  generacion: Generacion | null,
  /** Frases marcadas por cuadrante. Sin esto el playbook queda en las capas 1 y 2. */
  marcadas: Partial<Record<Perfil, number[]>> = {},
  totales?: Puntajes
): PlaybookPersona {
  const porCuadrante = BLOQUES_CUADRANTE[perfil] ?? {};
  const porGeneracion = generacion ? BLOQUES_GENERACION[generacion] ?? {} : {};

  // Capa 3: se leen el cuadrante dominante y, si está cerca, el segundo.
  const leidos = totales ? cuadrantesALeer(totales, perfil) : [perfil];
  const facetas = leidos.flatMap((p) =>
    facetasActivas(p, marcadas[p] ?? []).map((faceta) => ({ perfil: p, faceta }))
  );

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

    const propio = facetas
      .map(({ faceta }) => ({ faceta: faceta.titulo, texto: faceta.aporta[d.id] }))
      .filter((x): x is { faceta: string; texto: string } => Boolean(x.texto));

    dimensiones.push({
      id: d.id,
      titulo: d.titulo,
      core: principal.core,
      porque: [principal.porque, secundario?.porque].filter(Boolean).join(' '),
      verde: principal.verde ?? secundario?.verde,
      alerta: principal.alerta ?? secundario?.alerta,
      funciona: principal.funciona ?? secundario?.funciona,
      nofunciona: principal.nofunciona ?? secundario?.nofunciona,
      propio,
    });
  }

  return { dimensiones, semanas: SEMANAS[perfil] ?? [], faltantes, leidos, facetas };
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
