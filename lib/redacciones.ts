/**
 * Traduce los índices del Rorschach a lenguaje llano, con su recomendación.
 *
 * Las redacciones salen de `Redacciones códigos Rorschach.docx.md`, el
 * diccionario del método: para cada índice fuera de banda dice qué significa
 * para el trabajo y qué se recomienda hacer. Acá se aplican las reglas sobre el
 * sumario de cada persona, así que la recomendación no la escribe el motor: la
 * escribe el instrumento y el motor la selecciona.
 *
 * Es el port a TypeScript de `redacciones.py`, que venía generando los informes
 * de mapeo. Se portó tal cual: los textos son los que validó la psicóloga.
 *
 * Tres cosas que el diccionario pide expresamente y se respetan:
 *
 *   · Zf bajo no se informa cuando el Raven también dio bajo, porque entonces
 *     el motivo probable es la capacidad y no la motivación.
 *   · De DQv alto se informa la conducta observable y se omite la atribución a
 *     limitaciones intelectuales, que el diccionario marca como no publicable.
 *   · Y alto y Afr fuera de banda no llevan recomendación, así que entran solo
 *     como lectura.
 *
 * Las constelaciones quedan afuera enteras. Su contenido corresponde a la
 * devolución individual con la psicóloga y no entra en un documento de gestión.
 */

export type Lectura = {
  /** Cuál de las lecturas del diccionario es. Para poder editar su texto. */
  clave: string;
  area: string;
  indice: string;
  valor: string;
  dice: string;
  recomienda: string;
};

/** El sumario tal como lo deja el motor Exner, sección por sección. */
export type SumarioCrudo = Record<string, Record<string, unknown>>;

// Bandas del diccionario. Donde el instrumento y el baremo difieren, manda el
// instrumento, porque es el que sostiene la redacción.
const LAMBDA_BANDA: [number, number] = [0.3, 0.8];
const ZD_BANDA = 3.0;
const AFR_BANDA: Record<string, [number, number]> = {
  Introversivo: [0.53, 0.78],
  Ambigual: [0.53, 0.83],
  Extratensivo: [0.6, 0.89],
};

/** Un número del sumario, buscado en las secciones donde puede estar. */
function n(s: SumarioCrudo, seccion: string, clave: string, respaldo = 0): number {
  const v = s[seccion]?.[clave];
  return typeof v === 'number' && Number.isFinite(v) ? v : respaldo;
}

function texto(s: SumarioCrudo, seccion: string, clave: string, respaldo = ''): string {
  const v = s[seccion]?.[clave];
  return typeof v === 'string' ? v : respaldo;
}

/** Decimales con coma, como se escriben en castellano. */
function dec(v: number, d = 2): string {
  return v.toFixed(d).replace('.', ',');
}

function conSigno(v: number, d = 2): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d).replace('.', ',')}`;
}

/** D y AdjD siempre con signo, y con el menos tipográfico. */
function dd(d: number, adjd: number): string {
  return `D ${conSigno(d, 0)} · AdjD ${conSigno(adjd, 0)}`;
}

/** Populares esperadas según la cantidad de respuestas del protocolo. */
function pEsperado(r: number): [number, number] {
  if (r < 17) return [4, 6];
  if (r <= 28) return [5, 7];
  return [6, 9];
}

/** Contenidos humanos esperados, por cantidad de respuestas y estilo. */
function hEsperado(r: number, estilo: string): [number, number] {
  if (r < 17) return estilo === 'Introversivo' ? [4, 6] : [2, 4];
  if (r <= 27) {
    if (estilo === 'Introversivo') return [5, 8];
    if (estilo === 'Ambigual') return [4, 7];
    return [3, 6];
  }
  if (estilo === 'Introversivo') return [7, 11];
  if (estilo === 'Ambigual') return [5, 9];
  return [4, 7];
}

/**
 * Devuelve las lecturas que aplican, en el orden del diccionario.
 *
 * Cada lectura trae el índice que la dispara, qué dice y qué se recomienda.
 * Cuando el diccionario no fija recomendación, el campo queda vacío y la
 * lectura entra igual, porque describe cómo trabaja la persona.
 */
/**
 * Qué dice cada lectura, separado de cuándo se dispara.
 *
 * Arriba, en `leer`, están las condiciones: qué índice, contra qué corte. Acá
 * está lo que se escribe cuando esa condición se cumple. Vivían juntos, y eso
 * hacía que corregir una palabra de un texto obligara a entrar al algoritmo.
 *
 * **La clave es el nombre de la rama y no su posición.** Sumar una rama en el
 * medio no puede correr los textos que alguien ya editó de una lectura a otra.
 *
 * `cuando` es la condición dicha en castellano, para que la pantalla pueda
 * mostrar de qué lectura se trata sin obligar a leer el código.
 */
export type ClaveDeTexto = keyof typeof TEXTOS;

/** Lo que alguien reescribió, por clave. Solo lo que cambió de fábrica. */
export type Textos = Partial<Record<string, { dice?: string; recomienda?: string }>>;

export type Redaccion = {
  area: string;
  indice: string;
  cuando: string;
  dice: string;
  recomienda: string;
};

export const TEXTOS = {
  'lambda-bajo': {
    area: 'Cómo procesa la información',
    indice: 'Lambda',
    cuando: 'menos de 0,30',
    dice: 'Intenta captar todo, sin discriminar entre información relevante y accesoria. No se le escapa nada, y corre el riesgo de llenarse de datos que no sirven para resolver el problema, lo que puede hacer caer su eficacia.',
    recomienda: 'Ayudarlo a separar la información relevante de la accesoria, para que cuando tenga que resolver algo rápido pueda hacerlo sin impulsividad.',
  },
  'lambda-alto': {
    area: 'Cómo procesa la información',
    indice: 'Lambda',
    cuando: 'más de 0,80',
    dice: 'Simplifica sus percepciones más de lo esperado. Con eso evita procesar emociones y que los afectos lo invadan, y puede perder algún dato importante para la tarea.',
    recomienda: 'En situaciones con carga emocional, darle seguimiento para que no pierda datos o información importante.',
  },
  'zd-alto': {
    area: 'Cómo procesa la información',
    indice: 'Zd',
    cuando: 'más de +3,0',
    dice: 'Muy meticuloso en el análisis de la información: dedica más esfuerzo y energía que la mayoría a rastrear y explorar datos, por temor a equivocarse. Bajo presión externa, eso puede hacer fallar la toma de decisiones.',
    recomienda: 'Dar indicaciones claras y concretas para ayudarlo a enfocar en lo importante, y mostrarse abierto a consultas para calmar su temor a cometer errores, sobre todo al decidir.',
  },
  'zd-bajo': {
    area: 'Cómo procesa la información',
    indice: 'Zd',
    cuando: 'menos de −3,0',
    dice: 'Examina el entorno de manera poco cuidadosa: hace un rastreo apresurado, no llega a recoger datos suficientes y decide antes de que aparezcan todos los puntos clave. Puede cometer más errores por responder antes de procesar toda la información disponible.',
    recomienda: 'Establecer instancias de chequeo o procedimientos que incluyan revisar determinados puntos antes de avanzar o decidir, para que no le falten datos en esas decisiones.',
  },
  'w-bajo': {
    area: 'Cómo procesa la información',
    indice: 'W',
    cuando: 'W en menos del 30 % de las localizaciones, con alguna D',
    dice: 'Puede necesitar ayuda para armar una visión global de las situaciones, con tendencia a centrarse en los detalles.',
    recomienda: 'Darle información de contexto para ayudarlo a generar mayor visión de conjunto.',
  },
  'w-alto': {
    area: 'Cómo procesa la información',
    indice: 'W',
    cuando: 'W en más del 50 % de las localizaciones',
    dice: 'Intenta abarcarlo todo y consigue tener visión global de las situaciones.',
    recomienda: '',
  },
  'dd-alto': {
    area: 'Cómo procesa la información',
    indice: 'Dd',
    cuando: 'Dd en más del 15 % de las localizaciones',
    dice: 'Revisa de manera minuciosa para evitar errores, y al fijarse en aspectos poco relevantes pierde la visión de conjunto: se fija en lo que la mayoría no mira y deja de lado datos obvios.',
    recomienda: 'Ayudarlo a priorizar los aspectos centrales de la tarea, para que no se detenga en detalles poco relevantes.',
  },
  'dqv-alto': {
    area: 'Cómo procesa la información',
    indice: 'DQv',
    cuando: 'más de 2',
    dice: 'Aparece un modo de resolver poco reflexivo: puede avanzar sin detenerse a elaborar.',
    recomienda: 'Pedirle que comparta su razonamiento antes de avanzar con una decisión, para chequear criterios sobre todo al principio.',
  },
  'psv-alto': {
    area: 'Cómo procesa la información',
    indice: 'PSV',
    cuando: 'más de 2',
    dice: 'Las preocupaciones pueden interferir en su proceso cognitivo, y eso se nota en el día a día como cierta rigidez para flexibilizarse.',
    recomienda: 'Acompañarlo en los cambios, no dejarlo solo, y darle información y datos concretos para que logre flexibilizar.',
  },
  'zf-bajo': {
    area: 'Cómo procesa la información',
    indice: 'Zf',
    cuando: 'menos del 30 % de R, y el Raven no dio bajo',
    dice: 'Hace pocos esfuerzos por procesar los datos, con menos iniciativa de la esperada para buscar información.',
    recomienda: 'Definir objetivos concretos y hacer seguimiento periódico para sostener su nivel de actividad.',
  },
  'zf-alto': {
    area: 'Cómo procesa la información',
    indice: 'Zf',
    cuando: 'más del 55 % de R',
    dice: 'Tiene una motivación elevada para procesar información, investigar y buscar datos.',
    recomienda: '',
  },
  'w-m-alto': {
    area: 'Cómo procesa la información',
    indice: 'W:M',
    cuando: 'W más de dos veces y media M',
    dice: 'Tiende a comprometerse con asignaciones sin revisar antes si cuenta con los recursos para llevarlas adelante en tiempo y forma. Le cuesta decir que no puede o poner un límite.',
    recomienda: 'Antes de asignarle una tarea nueva, ayudarlo a chequear si realmente tiene con qué responder, porque va a tender a aceptar todo.',
  },
  'xa-bajo-wda-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'XA% / WDA%',
    cuando: 'XA% menos de 0,80 con WDA% de 0,80 o más',
    dice: 'Su percepción es apropiada en las situaciones obvias, y puede no serlo en otras circunstancias.',
    recomienda: 'En situaciones complejas, ayudarlo a validar su interpretación antes de avanzar.',
  },
  'xa-bajo': {
    area: 'Cómo interpreta lo que ve',
    indice: 'XA%',
    cuando: 'XA% menos de 0,80',
    dice: 'Es poco convencional en sus percepciones: en buena parte de las ocasiones no va a ver las cosas como las ve la mayoría, sino de un modo más personal.',
    recomienda: 'Chequear que el mensaje que se le quiere transmitir se entienda, por ejemplo preguntándole qué entendió de lo que se le pidió.',
  },
  'x-menos-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'X−%',
    cuando: 'más de 0,25',
    dice: 'Aparece un apartamiento de lo convencional que puede aumentar el comportamiento desajustado frente a lo que la situación exige, y con eso las dificultades de comunicación con el entorno.',
    recomienda: 'Conviene considerar si lo que el puesto necesita se sostiene con este nivel de interpretación de los datos, porque puede traer roce con otros y caída de productividad.',
  },
  'xu-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'Xu%',
    cuando: 'más de 0,20',
    dice: 'Marcada tendencia a ver las cosas desde su propio punto de vista, con reticencia a sumarse a visiones más convencionales. Si el entorno no lo presiona a ajustarse, no es relevante; si hay exigencia fuerte de ajustarse a lo ya definido, el riesgo de conflicto sube.',
    recomienda: 'Marcarle qué cosas se hacen de una manera establecida y sin modificaciones por más que las vea distinto, y dónde sí puede poner su impronta.',
  },
  'p-bajo': {
    area: 'Cómo interpreta lo que ve',
    indice: 'P',
    cuando: 'menos de lo esperado para la cantidad de respuestas',
    dice: 'Tiene una mirada de las situaciones distinta a la de la mayoría de su entorno. Es alguien singular que, sin violar la realidad, prefiere manejarla de forma menos convencional.',
    recomienda: 'Marcarle qué cosas se necesitan hacer de una manera determinada, y dónde puede ser original.',
  },
  'p-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'P',
    cuando: 'más de lo esperado para la cantidad de respuestas',
    dice: 'Se esfuerza por satisfacer las expectativas que cree que los demás tienen sobre él.',
    recomienda: 'Ayudarlo a clarificar expectativas reales y criterios de desempeño, para que no opere desde supuestos sino desde acuerdos concretos.',
  },
  'eb-introversivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'EB',
    cuando: 'estilo introversivo',
    dice: 'Prefiere la reflexión para resolver problemas: espera a considerar todas las alternativas antes de decidir, no procesa emoción mientras busca soluciones, y se apoya fuerte en su propia evaluación interna para elaborar juicios.',
    recomienda: '',
  },
  'eb-extratensivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'EB',
    cuando: 'estilo extratensivo',
    dice: 'Mezcla los sentimientos con sus decisiones. El contacto con los demás y el procesamiento de la emoción son prioritarios, y el control de esas descargas queda en segundo plano. Usa el ensayo y el error.',
    recomienda: 'Al decidir o resolver un problema, acompañarlo para que distinga la carga emocional que le provoca la situación, y con ese registro llegue a resoluciones mejores.',
  },
  'eb-ambigual': {
    area: 'Cómo decide y cómo piensa',
    indice: 'EB',
    cuando: 'estilo ambigual',
    dice: 'A veces resuelve dejando de lado la emoción y centrándose en las ideas, y otras veces sus afectos influyen en la evaluación. Al no tener un estilo definido, la decisión le puede llevar más tiempo y resultar menos previsible.',
    recomienda: '',
  },
  'a-p-pasivo-cuadruple': {
    area: 'Cómo decide y cómo piensa',
    indice: 'a:p',
    cuando: 'p cuatro veces a o más',
    dice: 'Tiende a aferrarse a sus pensamientos, le cuesta cambiar de punto de vista y aprender pautas nuevas de funcionamiento.',
    recomienda: 'Promover la revisión de sus ideas y la incorporación de otras miradas antes de definir acciones.',
  },
  'a-p-pasivo-triple': {
    area: 'Cómo decide y cómo piensa',
    indice: 'a:p',
    cuando: 'p tres veces a o más',
    dice: 'Tiende a oponerse a los cambios: le cuesta bastante cambiar de punto de vista y aprender pautas nuevas.',
    recomienda: 'Mostrarle información concreta con datos para ayudarlo a ver otro punto de vista.',
  },
  'a-p-pasivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'a:p',
    cuando: 'p mayor que a más uno',
    dice: 'Tiende a adoptar un papel pasivo en sus relaciones: puede quedar como receptor de las acciones de los demás y esperar que otros le resuelvan los problemas.',
    recomienda: 'Diseñar un camino de aprendizaje por etapas, para ir generando autonomía paso a paso.',
  },
  'ma-mp-pasivo-fuerte': {
    area: 'Cómo decide y cómo piensa',
    indice: 'Ma:Mp',
    cuando: 'Mp mayor que Ma más uno',
    dice: 'Evita la responsabilidad y la toma de decisiones, y recurre a la fantasía para negar los aspectos incómodos de la realidad. Eso conlleva cierta dependencia de que otros resuelvan.',
    recomienda: 'Darle lineamientos claros y promover que asuma de a poco la responsabilidad sobre sus decisiones, evitando resolver por él lo que puede abordar solo.',
  },
  'ma-mp-pasivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'Ma:Mp',
    cuando: 'Mp mayor que Ma',
    dice: 'Tiende a refugiarse en la imaginación para compensar frustraciones. Usado de manera creativa suma; usado para evitar dificultades, reemplaza la búsqueda de soluciones, y se acentúa bajo estrés.',
    recomienda: 'Ayudarlo a enfocar las situaciones en acciones concretas, sobre todo en los momentos de mayor exigencia.',
  },
  'intelectualizacion-alta': {
    area: 'Cómo decide y cómo piensa',
    indice: 'Intelectualización',
    cuando: 'más de 5',
    dice: 'Procesa las emociones como si fueran pensamientos. Con eso neutraliza su efecto, y a la vez tiende a distorsionar las situaciones, con lo cual las soluciones pierden eficacia. Se vuelve más vulnerable cuando la situación sube de intensidad.',
    recomienda: 'Ayudarlo con el registro de sus emociones, y darle lugar para procesarlas y encontrar respuestas más eficientes.',
  },
  'm-menos-alto': {
    area: 'Cómo decide y cómo piensa',
    indice: 'M−',
    cuando: 'más de 1',
    dice: 'Aparece cierta probabilidad de dificultades en la calidad de sus ideas.',
    recomienda: '',
  },
  'fm-cero': {
    area: 'Cómo decide y cómo piensa',
    indice: 'FM',
    cuando: 'FM en cero',
    dice: 'Se le dificulta tomar registro de sus propias necesidades.',
    recomienda: 'Puede necesitar ayuda externa para empezar a registrarlas. Un entorno donde se le permita darse prioridad ayuda.',
  },
  'fm-alto': {
    area: 'Cómo decide y cómo piensa',
    indice: 'FM',
    cuando: 'más de 5',
    dice: 'Está con el malestar interno elevado por sus propias necesidades, y eso se manifiesta como tensión: puede afectar la atención, la concentración y el sueño.',
    recomienda: 'Ayudarlo a ordenar prioridades cuando se incrementa la carga de trabajo.',
  },
  'm-alto': {
    area: 'Cómo decide y cómo piensa',
    indice: 'm',
    cuando: 'más de 2',
    dice: 'Hay circunstancias externas que le están causando molestias importantes: está atravesando una situación estresante.',
    recomienda: 'Generar un espacio de charla para consultarle si necesita algo de la empresa o de su jefe para trabajar más tranquilo.',
  },
  'fc-control-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'FC:CF+C',
    cuando: 'sin descarga, o FC más del triple de CF+C',
    dice: 'Controla sus descargas más de lo esperado: casi nunca se relaja cuando maneja emociones, porque desconfía de cualquier expresión abierta del afecto. Le cuesta expresar lo que siente con libertad.',
    recomienda: '',
  },
  'fc-descarga-intensa': {
    area: 'Cómo maneja lo que siente',
    indice: 'FC:CF+C',
    cuando: 'CF+C supera a FC por más de 2',
    dice: 'Tiende a expresarse de manera intensa, y eso da impresión de impulsividad por la dificultad de control emocional.',
    recomienda: '',
  },
  'fc-descarga': {
    area: 'Cómo maneja lo que siente',
    indice: 'FC:CF+C',
    cuando: 'CF+C supera a FC por uno o dos',
    dice: 'Expresa sus afectos sin filtro, de manera más espontánea que el adulto medio. No se esfuerza por controlar sus emociones en el mismo grado que la mayoría, sin que eso implique un problema serio de control.',
    recomienda: 'Mostrarle, sobre todo al principio, los filtros que se esperan y qué información se mantiene reservada.',
  },
  'c-pura-alta': {
    area: 'Cómo maneja lo que siente',
    indice: 'C pura',
    cuando: 'más de 1',
    dice: 'Disfruta de las situaciones vertiginosas, y en ellas es más propenso a desplegar conductas poco reflexivas.',
    recomienda: 'Mostrarle los límites que se esperan incluso en las situaciones más caóticas.',
  },
  'afr-bajo': {
    area: 'Cómo maneja lo que siente',
    indice: 'Afr',
    cuando: 'por debajo de la banda de su estilo',
    dice: 'Prefiere no verse implicado en situaciones con carga emocional. Esa misma tendencia neutraliza los problemas de descontrol, si los hubiera.',
    recomienda: '',
  },
  'afr-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'Afr',
    cuando: 'por encima de la banda de su estilo',
    dice: 'Las situaciones con carga emocional lo estimulan, y puede sentirse más productivo en ellas.',
    recomienda: '',
  },
  's-muy-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'S',
    cuando: 'más de 4',
    dice: 'Actitud de oposición hacia el entorno, difícil de modificar.',
    recomienda: 'Para que pueda flexibilizarla, evitar la confrontación directa y marcar límites claros y consistentes.',
  },
  's-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'S',
    cuando: 'más de 2',
    dice: 'Le cuesta cambiar de opinión.',
    recomienda: 'Ayudarlo a ver los otros puntos de vista mostrándole información concreta.',
  },
  'c-prima-alta': {
    area: 'Cómo maneja lo que siente',
    indice: "C'",
    cuando: 'más de 4',
    dice: 'Está conteniendo una irritación interna fuerte, que puede tardar bastante en bajar.',
    recomienda: 'Generar un espacio de conversación donde se le consulte si necesita algo de la empresa o de su jefe para trabajar más tranquilo.',
  },
  'sumt-cero': {
    area: 'Cómo maneja lo que siente',
    indice: 'SumT',
    cuando: 'SumT en cero',
    dice: 'Es distante en el contacto con los demás: no se siente cómodo en las situaciones de cercanía emocional y tiende a evitarlas. Cuida mantener una distancia de seguridad.',
    recomienda: 'Ver cuánta cercanía emocional pide el puesto. Conviene no forzarla y respetar la distancia que prefiere, dejando una vía por la cual pueda pedir apoyo cuando lo necesite.',
  },
  'sumt-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'SumT',
    cuando: 'más de 1',
    dice: 'Necesita más cercanía y contacto que lo habitual: tiende a sentirse más solo y a depender de la presencia afectiva de otros.',
    recomienda: 'Adoptar un estilo de conducción cercano, que le dé contención.',
  },
  'v-presente': {
    area: 'Cómo maneja lo que siente',
    indice: 'V',
    cuando: 'uno o más',
    dice: 'Cuando se autoevalúa lo hace de manera severa: pocas veces está conforme con su propio desempeño, y se exige mucho.',
    recomienda: 'Evitar sumarle exigencia externa, porque ya se exige por dentro.',
  },
  'y-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'Y',
    cuando: 'más de 1',
    dice: 'Está atravesando una situación que le genera tensión y frente a la cual se siente inundado. Buena parte de ese malestar es reactivo y va a ceder si se resuelven las circunstancias que lo provocan.',
    recomienda: '',
  },
  'ego-bajo': {
    area: 'Cómo se ve a sí mismo',
    indice: 'Ego',
    cuando: 'menos de 0,33',
    dice: 'No se toma a sí mismo como foco de atención en el grado suficiente: tiene una imagen desvalorizada de sí y no confía en sus recursos, con lo cual se puede dejar influenciar por los demás.',
    recomienda: 'Alentar y reconocer su desempeño, para fomentar su autoestima.',
  },
  'ego-alto': {
    area: 'Cómo se ve a sí mismo',
    indice: 'Ego',
    cuando: 'más de 0,55',
    dice: 'Tiende a centrarse en sí mismo más de lo habitual, dando prioridad a su punto de vista, con dificultad para mirar las cosas desde otra óptica y ponerse en el lugar del otro.',
    recomienda: 'En instancias de negociación puede necesitar asistencia: mostrarle datos que lo ayuden a considerar una visión distinta de la suya.',
  },
  'reflejos-presentes': {
    area: 'Cómo se ve a sí mismo',
    indice: 'Fr+rF',
    cuando: 'uno o más',
    dice: 'Necesita confirmación continua de su valor.',
    recomienda: 'El reconocimiento de él y de sus resultados funciona como motor de motivación.',
  },
  'an-xy-alto': {
    area: 'Cómo se ve a sí mismo',
    indice: 'An+Xy',
    cuando: 'más de 3',
    dice: 'Está más preocupado de lo habitual por su funcionamiento corporal.',
    recomienda: '',
  },
  'cop-cero-ag-bajo': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP en cero y AG hasta 1',
    dice: 'No está especialmente interesado en las situaciones interpersonales, y los demás lo pueden percibir como distante.',
    recomienda: 'En las relaciones su alcance va a ser superficial. Si alguna situación necesita más profundidad, conviene asistirlo.',
  },
  'cop-bajo-ag-dos': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP hasta 1 y AG en 2',
    dice: 'La agresividad es un componente natural de sus relaciones, y es más propenso a manifestar conductas de ese tipo.',
    recomienda: '',
  },
  'cop-bajo-ag-alto': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP hasta 2 y AG más de 2',
    dice: 'Buena parte de su actividad interpersonal está marcada por actitudes agresivas hacia los demás, como estrategia defensiva frente a un ambiente que vive como hostil.',
    recomienda: '',
  },
  'cop-alto-ag-bajo': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP de 2 o más y AG hasta 1',
    dice: 'Tiende a mantener actitudes socialmente positivas y a ser percibido como alguien agradable. Entiende la actividad interpersonal como parte importante de su día y busca interacciones armoniosas.',
    recomienda: '',
  },
  'phr-mayor-que-ghr': {
    area: 'Cómo se relaciona',
    indice: 'GHR:PHR',
    cuando: 'PHR mayor que GHR',
    dice: 'Sus herramientas interpersonales no alcanzan para generar vínculos de buena calidad: el estilo de sus intercambios no es el esperado.',
    recomienda: '',
  },
  'aislamiento-muy-alto': {
    area: 'Cómo se relaciona',
    indice: 'Índice de aislamiento',
    cuando: 'más de 0,33',
    dice: 'Logra apenas contactos significativos.',
    recomienda: 'Al asignarle tareas nuevas, tener presente su preferencia por resolver de manera independiente.',
  },
  'aislamiento-alto': {
    area: 'Cómo se relaciona',
    indice: 'Índice de aislamiento',
    cuando: 'más de 0,25',
    dice: 'Está menos implicado de lo habitual en las interacciones, y puede preferir trabajar de manera independiente.',
    recomienda: 'Conviene que la mayoría de sus tareas sean asignaciones individuales.',
  },
  'per-alto': {
    area: 'Cómo se relaciona',
    indice: 'PER',
    cuando: 'más de 2',
    dice: 'Cuando se siente cuestionado puede reaccionar a la defensiva para justificarse.',
    recomienda: 'Hacerle las consultas y los pedidos de forma concreta, para que no los reciba como un cuestionamiento.',
  },
  'fd-presente': {
    area: 'Cómo se relaciona',
    indice: 'Fd',
    cuando: 'uno o más',
    dice: 'Presenta más conductas de dependencia de lo esperable: espera que los demás busquen la solución a los problemas.',
    recomienda: 'Alentar su autonomía paso a paso. Al principio necesita un referente con quien validar sus acciones o ideas.',
  },
  'humanos-alto': {
    area: 'Cómo se relaciona',
    indice: 'Contenidos humanos',
    cuando: 'por encima de lo esperado para su cantidad de respuestas y su estilo',
    dice: 'Marcado interés por los demás.',
    recomienda: '',
  },
  'humanos-alto-cop': {
    area: 'Cómo se relaciona',
    indice: 'Contenidos humanos',
    cuando: 'sigue a la anterior cuando además hay COP',
    dice: ' Con la disposición a la cooperación presente, eso se traduce en una actitud solícita.',
    recomienda: '',
  },
  'h-pura-baja': {
    area: 'Cómo se relaciona',
    indice: 'H pura',
    cuando: 'los otros contenidos humanos superan a H pura',
    dice: 'Tiene una visión poco realista de sí mismo y de los demás: le puede costar ver tanto las fortalezas como las debilidades, propias y ajenas.',
    recomienda: 'Cuando se le marque un error, hacerlo con información concreta para que le resulte más fácil registrarlo.',
  },
  'd-adjd-cero': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'D y AdjD los dos en cero',
    dice: 'Tolera de manera adecuada las tensiones del día a día. Solo ante un estrés intenso, prolongado o inesperado podrían fallar los controles de manera significativa.',
    recomienda: '',
  },
  'adjd-positivo': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'AdjD de 1 o más',
    dice: 'Tiene una capacidad de control y de tolerancia al estrés fuera de lo común: cuenta con muchos más recursos de lo esperado para manejar sus tensiones y responder a las demandas.',
    recomienda: '',
  },
  'adjd-menos-uno': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'AdjD en −1',
    dice: 'Tiene dificultades ante las situaciones nuevas, y funciona mejor en entornos rutinarios y previsibles.',
    recomienda: 'Necesita acompañamiento ante los cambios y ante las situaciones tensionantes en sí mismas.',
  },
  'adjd-sobrecarga': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'AdjD por debajo de −1',
    dice: 'Está en estado de sobrecarga: vive con mucha más tensión de la que puede manejar, y como resultado sus respuestas pierden eficiencia. Al ser negativo también el valor ajustado, la sobrecarga está instalada en su funcionamiento y no es solo del momento.',
    recomienda: 'Regular la carga y priorizar tareas, con apoyo para organizar el trabajo y generar pausas, con el fin de bajar la tensión y mejorar la calidad de sus respuestas.',
  },
  'ea-bajo': {
    area: 'Cuánta exigencia sostiene',
    indice: 'EA',
    cuando: 'menos de 7',
    dice: 'Sus recursos de afrontamiento son limitados.',
    recomienda: '',
  },
  'ea-alto': {
    area: 'Cuánta exigencia sostiene',
    indice: 'EA',
    cuando: 'más de 11, con AdjD positivo',
    dice: 'Confirma un nivel de control elevado.',
    recomienda: '',
  },
  'ea-adecuado': {
    area: 'Cuánta exigencia sostiene',
    indice: 'EA',
    cuando: 'entre 7 y 11, con AdjD en cero',
    dice: 'Confirma una capacidad de control adecuada.',
    recomienda: '',
  },
  'd-menor-que-adjd': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D contra AdjD',
    cuando: 'D por debajo de AdjD',
    dice: 'Hay tensión situacional: su tolerancia al estrés de hoy está por debajo de la habitual.',
    recomienda: '',
  },
} satisfies Record<string, Redaccion>;

/** Hasta dónde puede crecer un texto reescrito. */
const LARGO_MAXIMO = 1200;

/** La redacción que rige: la reescrita si la hay, y si no la de fábrica. */
function redaccion(clave: ClaveDeTexto, textos: Textos): Redaccion {
  const base = TEXTOS[clave] as Redaccion;
  const suyo = textos[clave];
  if (!suyo) return base;
  return {
    ...base,
    dice: suyo.dice ?? base.dice,
    recomienda: suyo.recomienda ?? base.recomienda,
  };
}

/**
 * Lo guardado, si sirve para escribir un informe; null si no.
 *
 * **Un `dice` vacío se rechaza.** La lectura entra igual en el informe, así que
 * quedaría un renglón con el índice y su valor y sin nada que diga qué
 * significa. Vaciar la recomendación sí vale: hay lecturas del diccionario que
 * no llevan ninguna, y sacarla es una decisión.
 */
export function textosValidos(guardados: unknown): Textos | null {
  if (!guardados || typeof guardados !== 'object' || Array.isArray(guardados)) return null;
  const limpios: Textos = {};
  for (const [clave, valor] of Object.entries(guardados as Record<string, unknown>)) {
    if (!(clave in TEXTOS)) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
    const { dice, recomienda } = valor as { dice?: unknown; recomienda?: unknown };
    const uno: { dice?: string; recomienda?: string } = {};
    if (dice !== undefined) {
      if (typeof dice !== 'string' || !dice.trim() || dice.length > LARGO_MAXIMO) return null;
      uno.dice = dice.trim();
    }
    if (recomienda !== undefined) {
      if (typeof recomienda !== 'string' || recomienda.length > LARGO_MAXIMO) return null;
      uno.recomienda = recomienda.trim();
    }
    if (uno.dice !== undefined || uno.recomienda !== undefined) limpios[clave] = uno;
  }
  return limpios;
}

export function leer(s: SumarioCrudo, ravenRango: string, textos: Textos = {}): Lectura[] {
  const salida: Lectura[] = [];
  const sumar = (clave: ClaveDeTexto, valor: string, sigue: ClaveDeTexto | null = null) => {
    const t = redaccion(clave, textos);
    const cola = sigue ? redaccion(sigue, textos).dice : '';
    salida.push({
      clave,
      area: t.area,
      indice: t.indice,
      valor,
      dice: t.dice + cola,
      recomienda: t.recomienda,
    });
  };

  const r = n(s, 'cabecera', 'R');
  const estilo = texto(s, 'control_estres', 'estilo', 'Ambigual');
  const ravenBajo = ravenRango.startsWith('Rango IV') || ravenRango.startsWith('Rango V');

  // ── Cómo procesa la información ────────────────────────────────────────────
  const lam = n(s, 'cabecera', 'Lambda');
  if (lam < LAMBDA_BANDA[0]) {
    sumar('lambda-bajo', dec(lam));
  } else if (lam > LAMBDA_BANDA[1]) {
    sumar('lambda-alto', dec(lam));
  }

  const zd = n(s, 'procesamiento', 'Zd');
  if (zd > ZD_BANDA) {
    sumar('zd-alto', conSigno(zd, 1));
  } else if (zd < -ZD_BANDA) {
    sumar('zd-bajo', conSigno(zd, 1));
  }

  // W vive en la sección de localización, que es donde el motor del OS lo deja.
  const w = n(s, 'localizacion', 'global', n(s, 'procesamiento', 'W'));
  const dLoc = n(s, 'procesamiento', 'D', n(s, 'localizacion', 'D'));
  const ddLoc = n(s, 'procesamiento', 'Dd', n(s, 'localizacion', 'Dd'));
  const totalLoc = w + dLoc + ddLoc;
  if (totalLoc) {
    const wPct = w / totalLoc;
    const ddPct = ddLoc / totalLoc;
    if (wPct < 0.3 && dLoc) {
      sumar('w-bajo', `W:D:Dd ${w}:${dLoc}:${ddLoc}`);
    } else if (wPct > 0.5) {
      sumar('w-alto', `W:D:Dd ${w}:${dLoc}:${ddLoc}`);
    }
    if (ddPct > 0.15) {
      sumar('dd-alto', `Dd ${ddLoc}`);
    }
  }

  const dqv = n(s, 'procesamiento', 'DQv', n(s, 'localizacion', 'DQv'));
  if (dqv > 2) {
    // El diccionario marca la atribución causal como no publicable: acá va la
    // conducta observable y la recomendación, sin el porqué.
    sumar('dqv-alto', `DQv ${dqv}`);
  }

  const psv = n(s, 'procesamiento', 'PSV');
  if (psv > 2) {
    sumar('psv-alto', `PSV ${psv}`);
  }

  const zf = n(s, 'procesamiento', 'Zf');
  if (zf < r * 0.3 && !ravenBajo) {
    // El diccionario pide omitir este indicador cuando el Raven dio bajo.
    sumar('zf-bajo', `Zf ${zf}`);
  } else if (zf > r * 0.55) {
    sumar('zf-alto', `Zf ${zf}`);
  }

  const mTotal = n(s, 'determinantes', 'M');
  if (mTotal && w > mTotal * 2.5) {
    sumar('w-m-alto', `W:M ${w}:${mTotal}`);
  }

  // ── Cómo interpreta lo que ve ──────────────────────────────────────────────
  const xa = n(s, 'calidad_formal', 'XA_pct');
  const wda = n(s, 'calidad_formal', 'WDA_pct');
  if (xa < 0.8 && wda >= 0.8) {
    sumar('xa-bajo-wda-alto', `XA ${dec(xa)} · WDA ${dec(wda)}`);
  } else if (xa < 0.8) {
    sumar('xa-bajo', `XA ${dec(xa)}`);
  }

  const xMenos = n(s, 'calidad_formal', 'X_menos_pct');
  if (xMenos > 0.25) {
    sumar('x-menos-alto', `X− ${dec(xMenos)}`);
  }

  const xu = n(s, 'calidad_formal', 'Xu_pct');
  if (xu > 0.2) {
    sumar('xu-alto', `Xu ${dec(xu)}`);
  }

  const p = n(s, 'procesamiento', 'P', n(s, 'calidad_formal', 'P'));
  const [pMin, pMax] = pEsperado(r);
  if (p < pMin) {
    sumar('p-bajo', `P ${p}`);
  } else if (p > pMax) {
    sumar('p-alto', `P ${p}`);
  }

  // ── Cómo decide y cómo piensa ──────────────────────────────────────────────
  const eb = texto(s, 'control_estres', 'EB');
  if (estilo === 'Introversivo') {
    sumar('eb-introversivo', `${eb} · introversivo`);
  } else if (estilo === 'Extratensivo') {
    sumar('eb-extratensivo', `${eb} · extratensivo`);
  } else {
    sumar('eb-ambigual', `${eb} · ambigual`);
  }

  const a = n(s, 'ideacion', 'a');
  const pas = n(s, 'ideacion', 'p');
  if (a && pas >= a * 4) {
    sumar('a-p-pasivo-cuadruple', `a:p ${a}:${pas}`);
  } else if (a && pas >= a * 3) {
    sumar('a-p-pasivo-triple', `a:p ${a}:${pas}`);
  } else if (pas > a + 1) {
    sumar('a-p-pasivo', `a:p ${a}:${pas}`);
  }

  const ma = n(s, 'ideacion', 'Ma');
  const mp = n(s, 'ideacion', 'Mp');
  if (mp > ma + 1) {
    sumar('ma-mp-pasivo-fuerte', `Ma:Mp ${ma}:${mp}`);
  } else if (mp > ma) {
    sumar('ma-mp-pasivo', `Ma:Mp ${ma}:${mp}`);
  }

  const intel = n(s, 'ideacion', 'Intelectualizacion');
  if (intel > 5) {
    sumar('intelectualizacion-alta', `2AB+(Art+Ay) ${intel}`);
  }

  const mMenos = n(s, 'ideacion', 'M_menos');
  if (mMenos > 1) {
    sumar('m-menos-alto', `M− ${mMenos}`);
  }

  const fm = n(s, 'determinantes', 'FM');
  if (fm === 0) {
    sumar('fm-cero', 'FM 0');
  } else if (fm > 5) {
    sumar('fm-alto', `FM ${fm}`);
  }

  const m = n(s, 'determinantes', 'm');
  if (m > 2) {
    sumar('m-alto', `m ${m}`);
  }

  // ── Cómo maneja lo que siente ──────────────────────────────────────────────
  const fc = n(s, 'afectos', 'FC');
  const cfd = n(s, 'afectos', 'CF');
  const cpuro = n(s, 'afectos', 'C_puro');
  const descarga = cfd + cpuro;
  if (descarga === 0 || (descarga && fc > descarga * 3)) {
    sumar('fc-control-alto', `${fc}:${descarga}`);
  } else if (descarga > fc) {
    if (descarga - fc > 2) {
      sumar('fc-descarga-intensa', `${fc}:${descarga}`);
    } else {
      sumar('fc-descarga', `${fc}:${descarga}`);
    }
  }

  if (cpuro > 1) {
    sumar('c-pura-alta', `C pura ${cpuro}`);
  }

  const afr = n(s, 'afectos', 'Afr');
  const bandaAfr = AFR_BANDA[estilo] ?? [0.53, 0.83];
  if (afr < bandaAfr[0]) {
    sumar('afr-bajo', dec(afr));
  } else if (afr > bandaAfr[1]) {
    sumar('afr-alto', dec(afr));
  }

  const sBlanco = n(s, 'afectos', 'S', n(s, 'localizacion', 'S'));
  if (sBlanco > 4) {
    sumar('s-muy-alto', `S ${sBlanco}`);
  } else if (sBlanco > 2) {
    sumar('s-alto', `S ${sBlanco}`);
  }

  const cPrima = n(s, 'afectos', 'SumC_prima', n(s, 'determinantes', 'SumC_prima'));
  if (cPrima > 4) {
    sumar('c-prima-alta', `C' ${cPrima}`);
  }

  const sumt = n(s, 'interpersonal', 'SumT', n(s, 'determinantes', 'T'));
  if (sumt === 0) {
    sumar('sumt-cero', 'SumT 0');
  } else if (sumt > 1) {
    sumar('sumt-alto', `SumT ${sumt}`);
  }

  const sumv = n(s, 'autopercepcion', 'SumV', n(s, 'determinantes', 'V'));
  if (sumv > 0) {
    sumar('v-presente', `V ${sumv}`);
  }

  const sumy = n(s, 'determinantes', 'SumY', n(s, 'determinantes', 'Y'));
  if (sumy > 1) {
    sumar('y-alto', `Y ${sumy}`);
  }

  // ── Cómo se ve a sí mismo ──────────────────────────────────────────────────
  const ego = n(s, 'autopercepcion', 'Ego');
  if (ego < 0.33) {
    sumar('ego-bajo', dec(ego));
  } else if (ego > 0.55) {
    sumar('ego-alto', dec(ego));
  }

  const reflejos = n(s, 'autopercepcion', 'Fr') + n(s, 'autopercepcion', 'rF');
  if (reflejos > 0) {
    sumar('reflejos-presentes', `Fr+rF ${reflejos}`);
  }

  const anXy = n(s, 'autopercepcion', 'An_plus_Xy');
  if (anXy > 3) {
    sumar('an-xy-alto', `An+Xy ${anXy}`);
  }

  // ── Cómo se relaciona ──────────────────────────────────────────────────────
  const cop = n(s, 'interpersonal', 'COP');
  const ag = n(s, 'interpersonal', 'AG');
  if (cop === 0 && ag <= 1) {
    sumar('cop-cero-ag-bajo', `COP ${cop} · AG ${ag}`);
  } else if (cop <= 1 && ag === 2) {
    sumar('cop-bajo-ag-dos', `COP ${cop} · AG ${ag}`);
  } else if (cop <= 2 && ag > 2) {
    sumar('cop-bajo-ag-alto', `COP ${cop} · AG ${ag}`);
  } else if (cop >= 2 && ag <= 1) {
    sumar('cop-alto-ag-bajo', `COP ${cop} · AG ${ag}`);
  }

  const ghr = n(s, 'interpersonal', 'GHR');
  const phr = n(s, 'interpersonal', 'PHR');
  if (phr > ghr) {
    sumar('phr-mayor-que-ghr', `${ghr}:${phr}`);
  }

  const ais = n(s, 'interpersonal', 'Aislamiento');
  if (ais > 0.33) {
    sumar('aislamiento-muy-alto', dec(ais));
  } else if (ais > 0.25) {
    sumar('aislamiento-alto', dec(ais));
  }

  const per = n(s, 'interpersonal', 'PER');
  if (per > 2) {
    sumar('per-alto', `PER ${per}`);
  }

  const fd = n(s, 'interpersonal', 'Fd');
  if (fd > 0) {
    sumar('fd-presente', `Fd ${fd}`);
  }

  const hPura = n(s, 'autopercepcion', 'H_pura', n(s, 'interpersonal', 'H_pura'));
  const hParen = n(s, 'autopercepcion', 'H_paren');
  const hd = n(s, 'autopercepcion', 'Hd');
  const hdParen = n(s, 'autopercepcion', 'Hd_paren');
  const humanos = hPura + hParen + hd + hdParen;
  const [, hMax] = hEsperado(r, estilo);
  if (humanos > hMax) {
    sumar('humanos-alto', `H total ${humanos}`, cop >= 1 ? 'humanos-alto-cop' : null);
  }

  const otrosH = hParen + hd + hdParen;
  if (otrosH > hPura) {
    sumar('h-pura-baja', `H ${hPura} contra ${otrosH}`);
  }

  // ── Cuánta exigencia sostiene ──────────────────────────────────────────────
  const d = n(s, 'control_estres', 'D');
  const adjd = n(s, 'control_estres', 'AdjD');
  if (adjd === 0 && d === 0) {
    sumar('d-adjd-cero', dd(d, adjd));
  } else if (adjd >= 1) {
    sumar('adjd-positivo', dd(d, adjd));
  } else if (adjd === -1) {
    sumar('adjd-menos-uno', dd(d, adjd));
  } else {
    sumar('adjd-sobrecarga', dd(d, adjd));
  }

  const ea = n(s, 'control_estres', 'EA');
  if (ea < 7) {
    sumar('ea-bajo', `EA ${dec(ea)}`);
  } else if (ea > 11 && adjd > 0) {
    sumar('ea-alto', `EA ${dec(ea)}`);
  } else if (ea >= 7 && ea <= 11 && adjd === 0) {
    sumar('ea-adecuado', `EA ${dec(ea)}`);
  }

  if (d < adjd) {
    sumar('d-menor-que-adjd', dd(d, adjd));
  }

  return salida;
}

/** Agrupa conservando el orden en que las áreas aparecen. */
export function porArea(lecturas: Lectura[]): { area: string; lecturas: Lectura[] }[] {
  const orden: string[] = [];
  const grupos = new Map<string, Lectura[]>();
  for (const l of lecturas) {
    if (!grupos.has(l.area)) {
      orden.push(l.area);
      grupos.set(l.area, []);
    }
    grupos.get(l.area)!.push(l);
  }
  return orden.map((area) => ({ area, lecturas: grupos.get(area)! }));
}

/**
 * Si lo que dice cada lectura suma, está en lo esperado o hay que desarrollarlo.
 *
 * El esqueleto del informe reparte las competencias en tres secciones y la
 * separación no coincide con "tiene recomendación": hay lecturas sin
 * recomendación que describen un problema (GHR:PHR por debajo, M−) y otras que
 * describen una fortaleza (visión global, motivación para procesar).
 *
 * Se resuelve por el texto de la lectura, que es único por regla. Lo que no
 * está en la tabla se toma como esperado, que es el lugar donde una lectura
 * mal clasificada hace menos daño: describe sin recomendar ni destacar.
 */
export type Senal = 'destacada' | 'esperada' | 'desarrollar';

const DESTACADAS = [
  'Intenta abarcarlo todo y consigue',
  'Tiene una motivación elevada para procesar',
  'Tiene una capacidad de control y de tolerancia al estrés fuera de lo común',
  'Confirma un nivel de control elevado',
  'Tiende a mantener actitudes socialmente positivas',
  'Marcado interés por los demás',
  'Las situaciones con carga emocional lo estimulan',
];

const ESPERADAS = [
  'Tolera de manera adecuada las tensiones',
  'Confirma una capacidad de control adecuada',
  'Prefiere la reflexión para resolver problemas',
  'A veces resuelve dejando de lado la emoción',
  'Mezcla los sentimientos con sus decisiones',
  'Prefiere no verse implicado en situaciones con carga emocional',
];

export function senalDe(l: Lectura): Senal {
  if (DESTACADAS.some((t) => l.dice.startsWith(t))) return 'destacada';
  if (ESPERADAS.some((t) => l.dice.startsWith(t))) return 'esperada';
  return 'desarrollar';
}
