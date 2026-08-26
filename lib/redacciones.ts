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
 * Lo que cada lectura escribe y, en las que se disparan contra un número fijo,
 * ese número, se mueven desde Sistema → Configuración → Redacciones. El
 * algoritmo queda igual: elige las mismas lecturas, contra el corte que rija.
 * El sumario estructural pinta sus indicadores con esos mismos cortes
 * (`bandasDeLaHoja`), así que la hoja y el informe no pueden discrepar.
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
//
// Los cortes contra un número fijo viven en `TEXTOS`, con la lectura que
// disparan, porque se editan desde Sistema. Acá quedan los que no son un
// número fijo por lectura: la banda de Afr, que depende del estilo, y el piso
// de WDA%, que no dispara una lectura propia sino que parte en dos la de XA%
// bajo.
const WDA_ACEPTABLE = 0.8;
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
 * Qué dice cada lectura, y contra qué número entra.
 *
 * `leer` recorre el sumario y decide qué lecturas aplican. Acá está lo que se
 * escribe cuando cada una se cumple y, en las que se disparan contra un número
 * fijo, ese número. Todo vivía adentro del algoritmo, y eso hacía que corregir
 * una palabra, o mover un corte medio punto, obligara a tocar el código.
 *
 * **La clave es el nombre de la rama y no su posición.** Sumar una rama en el
 * medio no puede correr los textos que alguien ya editó de una lectura a otra.
 *
 * Una lectura dice cuándo entra de una de dos formas:
 *
 *   · `corte`, cuando se dispara contra un número fijo ("menos de 0,30"). Ese
 *     número se edita desde Sistema y el castellano se escribe con él, así que
 *     mover el corte no puede dejar en pantalla una condición que ya no rige.
 *   · `cuando`, el castellano escrito a mano, para las que se disparan contra
 *     algo que no es un número fijo: una banda que depende del estilo (Afr),
 *     de la cantidad de respuestas (Zf, P, contenidos humanos) o una relación
 *     entre dos índices (a:p, COP y AG, GHR:PHR). Esas no se editan.
 */
export type ClaveDeTexto = keyof typeof TEXTOS;

/**
 * Lo que alguien reescribió, por clave. Solo lo que cambió de fábrica.
 *
 * Cada campo es la lista de formas de decirlo, de una a tres. `recomiendaZ` es
 * la del Zulliger, que se escribe aparte porque lo que se sugiere hacer depende
 * de con qué se midió.
 */
export type Textos = Partial<
  Record<
    string,
    { dice?: string[]; recomienda?: string[]; diceZ?: string[]; recomiendaZ?: string[] }
  >
>;

/** Los dos tests de manchas. El diccionario se lee distinto según cuál se tomó. */
export type TestDeManchas = 'Rorschach' | 'Zulliger';

/**
 * El número contra el que entra una lectura.
 *
 * `menor` entra por debajo y `mayor` por encima, los dos estrictos: el número
 * es el último valor que **no** dispara la lectura. `decimales` es con cuántos
 * se escribe y se edita, y `ademas` es lo que la condición pide aparte del
 * número, cuando pide algo.
 */
export type Corte = {
  op: 'menor' | 'mayor';
  valor: number;
  decimales: number;
  ademas?: string;
};

/** Los cortes movidos desde Sistema, por clave. Solo los que cambiaron. */
export type Cortes = Partial<Record<string, number>>;

/**
 * Lo que cambia entre un test y el otro.
 *
 * Los dos tests tienen su propio diccionario: normas distintas, cortes
 * distintos y redacciones distintas, cada una escrita para lo que ese test
 * puede leer. Están en dos documentos separados y así se editan, en dos
 * pestañas.
 *
 * Lo que no se escribe acá cae en lo del Rorschach, que es de donde salió el
 * diccionario: mientras una lectura diga lo mismo en los dos, escribirla dos
 * veces sería mantener dos textos que se desincronizan a la primera corrección.
 * Cuando la psicóloga quiere que diga otra cosa, la escribe y manda la suya.
 */
export type PorTest = {
  corte?: Corte;
  dice?: string[];
  recomienda?: string[];
  /**
   * `false` cuando la lectura no corre en ese test.
   *
   * Hay valores que en un test son un hallazgo y en el otro son la norma: T=0
   * en Zulliger es lo esperado, y decir ahí que la persona evita la cercanía
   * sería informar como rasgo lo que tiene casi todo el mundo.
   */
  aplica?: boolean;
};

export type Redaccion = {
  area: string;
  indice: string;
  /** El castellano escrito a mano, en las lecturas que no tienen corte. */
  cuando?: string;
  corte?: Corte;
  /**
   * Qué dice la lectura, en hasta tres formas de decir lo mismo.
   *
   * El informe toma una, elegida por la evaluación y no al azar en cada
   * dibujo: un informe entregado no puede cambiar de texto cuando se vuelve a
   * abrir. Entre candidatos del mismo pedido salen distintas, así que el
   * cliente que recibe tres no lee tres veces el mismo párrafo.
   *
   * La primera es la que validó la psicóloga. Las otras son opcionales.
   */
  dice: string[];
  /** Qué se recomienda hacer, con las mismas tres formas. */
  recomienda: string[];
  /** Lo propio del Zulliger, donde el corte o la recomendación difieren. */
  zulliger?: PorTest;
};

export const TEXTOS = {
  'lambda-bajo': {
    area: 'Cómo procesa la información',
    indice: 'Lambda',
    corte: { op: 'menor', valor: 0.3, decimales: 2 },
    zulliger: {
      corte: { op: 'menor', valor: 0.29, decimales: 2 },
      dice: [
        'Está excesivamente pendiente de la información que recibe, y al tomar decisiones se ve sobrepasada por los datos y puede tener dificultad para encontrar la prioridad.',
        'Registra más información de la que puede manejar, y al decidir queda sobrepasada por los datos, con dificultad para establecer la prioridad.',
        'Atiende a todo lo que recibe, y ese volumen de datos la desborda en el momento de decidir y le complica ordenar qué va primero.',
      ],
      recomienda: [
        'Absorbe demasiados datos y al tomar decisiones necesita ayuda para priorizar la información.',
        'Absorbe muchos datos y necesita ayuda para ordenar cuál pesa más al decidir.',
        'Acompañarla a jerarquizar la información antes de que tome la decisión.',
      ],
    },
    dice: [
      'Intenta captar todo, sin discriminar entre información relevante y accesoria. No se le escapa nada, y corre el riesgo de llenarse de datos que no sirven para resolver el problema, lo que puede hacer caer su eficacia.',
      'Toma todo lo que llega sin separar lo que sirve de lo que sobra. No pierde detalle, y al mismo tiempo junta más datos de los que el problema necesita, lo que le puede restar eficacia.',
      'Registra la información sin filtrarla, y al momento de resolver queda con un volumen de datos que excede lo que la situación pide. Eso puede enlentecer su respuesta.',
    ],
    recomienda: [
      'Ayudarlo a separar la información relevante de la accesoria, para que cuando tenga que resolver algo rápido pueda hacerlo sin impulsividad.',
      'Acompañarlo a distinguir lo central de lo accesorio, para que las decisiones rápidas no le salgan apuradas.',
      'Marcarle cuáles son los datos que definen la decisión, para que resolver rápido no le implique resolver sin criterio.',
    ],
  },
  'lambda-alto': {
    area: 'Cómo procesa la información',
    indice: 'Lambda',
    corte: { op: 'mayor', valor: 0.8, decimales: 2 },
    zulliger: {
      dice: [
        'Simplifica demasiado sus percepciones y deja los afectos fuera de la lectura de las situaciones, con lo cual puede perder algún dato de información. Puede fallar la permeabilidad a las emociones y la empatía.',
        'Reduce demasiado lo que percibe y deja los afectos afuera al leer las situaciones, con lo cual algún dato se le puede escapar. La permeabilidad emocional y la empatía le pueden fallar.',
        'Simplifica en exceso su lectura de las situaciones y no toma en cuenta los afectos, de modo que puede perder información. Registrar lo emocional y ponerse en el lugar del otro le cuesta.',
      ],
      recomienda: [
        'En situaciones con carga emocional, indicarle con claridad en qué aspectos debe enfocarse.',
        'Cuando la situación tenga carga emocional, decirle con precisión en qué tiene que poner el foco.',
        'En los temas cargados de emoción, señalarle explícitamente qué aspectos debe considerar.',
      ],
    },
    dice: [
      'Simplifica sus percepciones más de lo esperado. Con eso evita procesar emociones y que los afectos lo invadan, y puede perder algún dato importante para la tarea.',
      'Reduce las situaciones a lo mínimo indispensable. Con eso se ahorra el trabajo emocional, y al mismo tiempo puede dejar afuera información que la tarea necesitaba.',
      'Recorta lo que percibe más de lo esperado. Le sirve para que los afectos no lo invadan, y le cuesta caro cuando el dato que descarta era importante.',
    ],
    recomienda: [
      'En situaciones con carga emocional, darle seguimiento para que no pierda datos o información importante.',
      'Cuando la situación tenga carga emocional, hacer seguimiento para chequear que no se le haya escapado información.',
      'En los temas emocionalmente cargados, revisar con él qué datos tuvo en cuenta antes de que avance.',
    ],
  },
  'zd-alto': {
    area: 'Cómo procesa la información',
    indice: 'Zd',
    corte: { op: 'mayor', valor: 3, decimales: 1 },
    zulliger: {
      dice: [
        'Analiza la información con mucho más detalle que la mayoría: rastrea, revisa y gasta energía extra para no equivocarse. Cuando la presión externa aprieta, esa manera de decidir le puede fallar.',
        'Dedica al examen de los datos más tiempo del que la tarea pide, movida por el temor a errar. Bajo apuro, ese mismo cuidado le complica la decisión.',
        'Explora la información con un nivel de detalle superior al esperado. El miedo a equivocarse la lleva a revisar de más, y con presión encima eso le entorpece el resolver.',
      ],
      recomienda: [
        'Darle indicaciones concretas que le acoten dónde mirar, y quedar disponible para sus consultas, sobre todo al decidir.',
        'Delimitarle qué hay que revisar y qué no, y responderle las dudas para que el temor a errar no le trabe la decisión.',
        'Precisarle el alcance de cada revisión y sostener la puerta abierta a preguntas en el momento de decidir.',
      ],
    },
    dice: [
      'Muy meticuloso en el análisis de la información: dedica más esfuerzo y energía que la mayoría a rastrear y explorar datos, por temor a equivocarse. Bajo presión externa, eso puede hacer fallar la toma de decisiones.',
      'Analiza la información con mucho más detalle que la mayoría: rastrea, vuelve sobre los datos y gasta energía extra en no equivocarse. Cuando la presión externa aprieta, esa manera de decidir le puede fallar.',
      'Dedica al examen de los datos más tiempo y más esfuerzo del que la tarea pide, movido por el temor a errar. Bajo apuro, ese mismo cuidado le complica la decisión.',
    ],
    recomienda: [
      'Dar indicaciones claras y concretas para ayudarlo a enfocar en lo importante, y mostrarse abierto a consultas para calmar su temor a cometer errores, sobre todo al decidir.',
      'Darle consignas concretas que le acoten dónde mirar, y dejar abierta la consulta para que el miedo a equivocarse no le trabe la decisión.',
      'Delimitarle qué hay que revisar y qué no, y estar disponible para responderle dudas, sobre todo en el momento de decidir.',
    ],
  },
  'zd-bajo': {
    area: 'Cómo procesa la información',
    indice: 'Zd',
    corte: { op: 'menor', valor: -3, decimales: 1 },
    zulliger: {
      dice: [
        'Recorre el entorno de manera apresurada: junta menos datos de los necesarios y decide antes de que aparezcan todos los puntos clave. Por eso puede cometer más errores.',
        'Explora la información sin detenerse lo suficiente y resuelve con una parte de los datos. Esa prisa le hace pasar por alto puntos que después pesan.',
        'Su rastreo de los datos es rápido e incompleto, y decide antes de tener el cuadro entero, con más margen de error del esperable.',
      ],
      recomienda: [
        'Sumar un paso de control previo, con los puntos que tiene que haber mirado antes de resolver.',
        'Fijar instancias de revisión previas a la decisión, para que no le falten datos al resolver.',
        'Definir qué hay que chequear antes de cerrar una decisión, y sostener ese paso como parte del procedimiento.',
      ],
    },
    dice: [
      'Examina el entorno de manera poco cuidadosa: hace un rastreo apresurado, no llega a recoger datos suficientes y decide antes de que aparezcan todos los puntos clave. Puede cometer más errores por responder antes de procesar toda la información disponible.',
      'Recorre el entorno de manera apresurada: junta menos datos de los necesarios y resuelve antes de que aparezcan todos los elementos en juego. Por eso puede errar más de lo esperable.',
      'Explora la información sin detenerse lo suficiente y decide con una parte de los datos. Esa prisa le hace pasar por alto puntos que después pesan en el resultado.',
    ],
    recomienda: [
      'Establecer instancias de chequeo o procedimientos que incluyan revisar determinados puntos antes de avanzar o decidir, para que no le falten datos en esas decisiones.',
      'Incorporar un punto de control antes de avanzar, con una lista breve de qué mirar sí o sí antes de decidir.',
      'Fijar instancias de revisión previas a la decisión, para que no le falten datos al momento de resolver.',
    ],
  },
  'w-bajo': {
    area: 'Cómo procesa la información',
    indice: 'W',
    cuando: 'W en menos del 30 % de las localizaciones, con alguna D',
    zulliger: {
      dice: [
        'Tiene la visión global disminuida y absorbe los datos del entorno desde los detalles.',
        'Su mirada de conjunto es escasa y la lectura del entorno le entra por los detalles.',
        'Su mirada de conjunto es escasa: toma la información del entorno por partes.',
      ],
      recomienda: [
        'Si se necesita que obtenga una visión más global de las situaciones, guiarla dándole información de contexto.',
        'Si se necesita que obtenga una visión más global, guiarla dándole información de contexto.',
        'Cuando haga falta el panorama completo, aportárselo, porque su lectura arranca por el detalle.',
      ],
    },
    dice: [
      'Puede necesitar ayuda para armar una visión global de las situaciones, con tendencia a centrarse en los detalles.',
      'Se apoya en los detalles y le cuesta llegar a una lectura de conjunto de las situaciones.',
      'Su mirada tiende a quedarse en las partes, y puede necesitar ayuda para armar el panorama completo.',
    ],
    recomienda: [
      'Darle información de contexto para ayudarlo a generar mayor visión de conjunto.',
      'Darle el contexto de la situación para que pueda componer la mirada completa.',
      'Aportarle el marco general de lo que está pasando, porque solo no lo va a construir.',
    ],
  },
  'w-alto': {
    area: 'Cómo procesa la información',
    indice: 'W',
    cuando: 'W en más del 50 % de las localizaciones',
    zulliger: {
      dice: [
        'Busca abarcar la situación completa y consigue una visión global.',
        'Mira el panorama entero y logra formarse una lectura de conjunto.',
        'Su forma de tomar la información apunta al conjunto, y llega a una mirada global de las situaciones.',
      ],
    },
    dice: [
      'Intenta abarcarlo todo y consigue tener visión global de las situaciones.',
      'Busca abarcar la situación completa y logra formarse una mirada de conjunto.',
      'Tiende a mirar el panorama entero y consigue una visión global de lo que pasa.',
    ],
    recomienda: [''],
  },
  'dd-alto': {
    area: 'Cómo procesa la información',
    indice: 'Dd',
    cuando: 'Dd en más del 15 % de las localizaciones',
    zulliger: {
      dice: [
        'Está muy preocupada por la exactitud y tiene miedo a cometer errores, y por eso se fija en cuestiones que para otros pueden ser insignificantes. Este indicador puede mostrar falta de confianza en sí misma.',
        'Está muy preocupada por la exactitud y teme cometer errores, y por eso se detiene en cuestiones que para otros son insignificantes. Puede mostrar falta de confianza en sí misma.',
        'El miedo a equivocarse la lleva a buscar la exactitud en detalles que el resto no mira, y eso puede señalar poca confianza en sus propios recursos.',
      ],
      recomienda: [
        'Ayudarla a distinguir la información relevante de la accesoria para evitar pérdida de tiempo, y a la vez destacar lo que hace bien para colaborar con su autoestima.',
        'Ayudarla a separar lo relevante de lo accesorio para no perder tiempo, y destacar lo que hace bien para sostener su autoestima.',
        'Marcarle dónde está lo importante, y reconocerle sus aportes para reforzar la confianza.',
      ],
    },
    dice: [
      'Revisa de manera minuciosa para evitar errores, y al fijarse en aspectos poco relevantes pierde la visión de conjunto: se fija en lo que la mayoría no mira y deja de lado datos obvios.',
      'Controla cada detalle para no equivocarse, y al detenerse en aspectos menores pierde el conjunto: mira lo que casi nadie mira y deja pasar lo evidente.',
      'Su revisión es minuciosa hasta en lo que no hace falta. Al poner el foco en lo pequeño, se le escapan los datos centrales de la situación.',
    ],
    recomienda: [
      'Ayudarlo a priorizar los aspectos centrales de la tarea, para que no se detenga en detalles poco relevantes.',
      'Marcarle qué es lo central de la tarea, para que no se quede en detalles de poco peso.',
      'Indicarle explícitamente dónde poner el foco, así el tiempo no se le va en cuestiones menores.',
    ],
  },
  'dqv-alto': {
    area: 'Cómo procesa la información',
    indice: 'DQv',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: [
        'Aparece un indicador de impulsividad: puede resolver de manera poco reflexiva.',
        'Se detecta impulsividad al resolver, con decisiones que no pasan por la reflexión.',
        'Se detecta impulsividad en su modo de resolver, con decisiones poco elaboradas.',
      ],
      recomienda: [
        'Revisar sus decisiones en conjunto, sobre todo al inicio, para ajustar el criterio y evitar las resoluciones apresuradas.',
        'Revisar sus decisiones en conjunto, sobre todo al inicio, para ajustar el criterio.',
        'Acompañar sus primeras decisiones para corregir el criterio antes de que se instale.',
      ],
    },
    dice: [
      'Aparece un modo de resolver poco reflexivo: puede avanzar sin detenerse a elaborar.',
      'Resuelve sin detenerse a elaborar: puede avanzar con lo primero que aparece.',
      'Aparece una forma de resolver poco trabajada, con tendencia a decidir sin pasar por la reflexión.',
    ],
    recomienda: [
      'Pedirle que comparta su razonamiento antes de avanzar con una decisión, para chequear criterios sobre todo al principio.',
      'Pedirle que cuente cómo llegó a la decisión antes de ejecutarla, sobre todo en las primeras semanas.',
      'Revisar con él el criterio de sus decisiones al principio, para poder corregirlo a tiempo.',
    ],
  },
  'psv-alto': {
    area: 'Cómo procesa la información',
    indice: 'PSV',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: [
        'Le puede costar cambiar de idea y sostiene su postura aun cuando le muestren otra.',
        'Moverse de una idea le cuesta: mantiene su postura aunque le presenten otra.',
        'Cambiar de posición le resulta difícil: mantiene su idea aunque aparezcan otras.',
      ],
      recomienda: [
        'Mostrarle datos o información concreta para ayudarla a flexibilizar sus ideas.',
        'Acercarle información específica para que pueda revisar lo que sostiene.',
        'Acercarle información específica como vía para que revise lo que sostiene.',
      ],
    },
    dice: [
      'Las preocupaciones pueden interferir en su proceso cognitivo, y eso se nota en el día a día como cierta rigidez para flexibilizarse.',
      'Las preocupaciones le ocupan el pensamiento, y eso se ve en el día a día como dificultad para cambiar de posición.',
      'Aparece una rigidez en el modo de pensar: lo que le preocupa le ocupa lugar y le cuesta moverse de ahí.',
    ],
    recomienda: [
      'Acompañarlo en los cambios, no dejarlo solo, y darle información y datos concretos para que logre flexibilizar.',
      'Acompañarlo durante los cambios y darle datos concretos que le permitan revisar su posición.',
      'No dejarlo solo frente a un cambio, y mostrarle información específica para que pueda flexibilizar.',
    ],
  },
  'zf-bajo': {
    area: 'Cómo procesa la información',
    indice: 'Zf',
    cuando: 'menos del 30 % de R, y el Raven no dio bajo',
    zulliger: {
      dice: [
        'Trabaja poco la información que recibe y no toma la iniciativa de buscar más.',
        'El esfuerzo que dedica a elaborar los datos es escaso, y esperar que salga a buscarlos por su cuenta no da resultado.',
        'Procesa lo que recibe con poco esfuerzo y no toma la iniciativa de ampliar la información.',
      ],
      recomienda: [
        'Fijarle objetivos concretos y revisarlos cada tanto para sostener su nivel de actividad.',
        'Ponerle metas puntuales con fechas de revisión, porque la iniciativa propia no le alcanza.',
        'Darle objetivos definidos y momentos pautados de revisión, así el ritmo no depende de su iniciativa.',
      ],
    },
    dice: [
      'Hace pocos esfuerzos por procesar los datos, con menos iniciativa de la esperada para buscar información.',
      'Invierte poco esfuerzo en procesar los datos y busca información con menos iniciativa de la esperada.',
      'Su trabajo sobre la información es escaso: no sale a buscar datos por cuenta propia como sería esperable.',
    ],
    recomienda: [
      'Definir objetivos concretos y hacer seguimiento periódico para sostener su nivel de actividad.',
      'Fijarle objetivos concretos y revisarlos cada tanto para sostener el nivel de actividad.',
      'Marcarle metas puntuales con seguimiento periódico, porque el impulso propio no le alcanza.',
    ],
  },
  'zf-alto': {
    area: 'Cómo procesa la información',
    indice: 'Zf',
    cuando: 'más del 55 % de R',
    zulliger: {
      dice: [
        'Se motiva con la información: la trabaja, investiga y busca más datos.',
        'Se involucra activamente en procesar lo que recibe y en ampliar la información.',
        'Dedica esfuerzo a elaborar los datos y a buscar más de lo que se le da.',
      ],
    },
    dice: [
      'Tiene una motivación elevada para procesar información, investigar y buscar datos.',
      'Tiene mucha motivación para trabajar la información, investigar y buscar datos.',
      'Se involucra activamente en procesar lo que recibe y en buscar más información.',
    ],
    recomienda: [''],
  },
  'w-m-alto': {
    area: 'Cómo procesa la información',
    indice: 'W:M',
    cuando: 'W más de dos veces y media M',
    zulliger: {
      dice: [
        'Se pone metas más allá de sus posibilidades reales, con una actitud en exceso abarcativa. Cuando recibe una tarea nueva no toma dimensión de lo que requiere para responder en tiempo y forma, y le cuesta decir que ahora no puede.',
        'Asume compromisos por encima de lo que puede sostener. Al recibir una tarea nueva no dimensiona lo que le va a demandar cumplirla en tiempo y forma, y decir que no puede le resulta difícil.',
        'Asume más de lo que puede sostener. Al recibir una tarea no mide lo que le va a demandar, y decir que no le resulta difícil.',
      ],
      recomienda: [
        'Ayudarla a evaluar conscientemente sus pendientes antes de considerar sumar tareas nuevas.',
        'Ayudarla a evaluar sus pendientes antes de considerar sumarle tareas nuevas.',
        'Revisar con ella la carga que ya tiene antes de asignarle algo más.',
      ],
    },
    dice: [
      'Tiende a comprometerse con asignaciones sin revisar antes si cuenta con los recursos para llevarlas adelante en tiempo y forma. Le cuesta decir que no puede o poner un límite.',
      'Acepta asignaciones sin chequear antes si tiene los recursos para cumplirlas en tiempo y forma. Le cuesta poner un límite o decir que no puede.',
      'Se compromete con más de lo que puede sostener, porque no evalúa de antemano con qué cuenta. Decir que no le resulta difícil.',
    ],
    recomienda: [
      'Antes de asignarle una tarea nueva, ayudarlo a chequear si realmente tiene con qué responder, porque va a tender a aceptar todo.',
      'Antes de sumarle una tarea, revisar con él si tiene con qué responder, porque por su cuenta va a aceptar.',
      'Chequear con él la carga que ya tiene antes de asignarle algo nuevo, ya que no va a poner el límite solo.',
    ],
  },
  'xa-bajo-wda-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'XA% / WDA%',
    cuando: 'XA% menos de 0,80 con WDA% de 0,80 o más',
    zulliger: {
      dice: [
        'La percepción es generalmente apropiada en las situaciones obvias y tiende a no serlo en otras circunstancias. Ahí despliega una visión diferente a la de la mayoría de las personas.',
        'Percibe apropiadamente en las situaciones obvias y tiende a no hacerlo en las demás, donde despliega una visión diferente a la de la mayoría.',
        'Frente a lo evidente su percepción es correcta; en las circunstancias menos claras se aparta de la lectura común.',
      ],
      recomienda: [
        'Dar consignas claras y hacer chequeos breves de interpretación en las situaciones ambiguas, para alinear criterios antes de que decida o avance.',
        'Dar consignas claras y hacer chequeos breves de interpretación en las situaciones ambiguas, antes de que decida o avance.',
        'En los casos poco definidos, alinear criterios con una consulta corta antes de que actúe.',
      ],
    },
    dice: [
      'Su percepción es apropiada en las situaciones obvias, y puede no serlo en otras circunstancias.',
      'Interpreta bien lo evidente, y en las situaciones menos claras su lectura puede apartarse de la de los demás.',
      'Frente a lo obvio percibe como el resto; cuando la situación se vuelve ambigua, su interpretación toma un rumbo propio.',
    ],
    recomienda: [
      'En situaciones complejas, ayudarlo a validar su interpretación antes de avanzar.',
      'Ante situaciones poco claras, pedirle que cuente cómo las está entendiendo antes de que avance.',
      'En los casos complejos, confirmar con él la interpretación antes de pasar a la acción.',
    ],
  },
  'xa-bajo': {
    area: 'Cómo interpreta lo que ve',
    indice: 'XA%',
    corte: { op: 'menor', valor: 0.8, decimales: 2 },
    zulliger: {
      dice: [
        'Le puede costar percibir las situaciones como las percibe la mayoría, de modo que su interpretación de una consigna puede no coincidir con lo que se le pidió.',
        'Le puede costar percibir las situaciones como las percibe la mayoría, de modo que lo que entiende de una consigna puede no coincidir con lo que se le pidió.',
        'Su lectura de las situaciones puede apartarse de la común, y entonces lo que interpreta de un pedido puede diferir de lo que se quiso transmitir.',
      ],
      recomienda: [
        'Asegurarse de que haya interpretado correctamente las consignas y las prioridades antes de iniciar una tarea, por ejemplo pidiéndole que repita qué entendió.',
        'Confirmar que entendió bien la consigna y las prioridades antes de que empiece, por ejemplo pidiéndole que las repita.',
        'Antes del inicio de la tarea, verificar qué entendió del pedido y en qué orden lo va a encarar.',
      ],
    },
    dice: [
      'Es poco convencional en sus percepciones: en buena parte de las ocasiones no va a ver las cosas como las ve la mayoría, sino de un modo más personal.',
      'Interpreta las situaciones de una manera personal: buena parte de las veces no va a leer las cosas como las lee la mayoría.',
      'Su lectura de la realidad se aparta con frecuencia de la convencional y toma un sesgo propio.',
    ],
    recomienda: [
      'Chequear que el mensaje que se le quiere transmitir se entienda, por ejemplo preguntándole qué entendió de lo que se le pidió.',
      'Confirmar que entendió lo que se le pidió, por ejemplo pidiéndole que lo repita con sus palabras.',
      'Verificar la comprensión de cada consigna antes de que empiece, para descartar malentendidos.',
    ],
  },
  'x-menos-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'X−%',
    corte: { op: 'mayor', valor: 0.25, decimales: 2 },
    zulliger: {
      dice: [
        'Se aparta de lo convencional en un grado que puede traer signos de desadaptación en el ambiente laboral: resulta difícil de entender y aparecen dificultades claras en la comunicación.',
        'Se aparta de lo convencional en un grado que puede traer signos de desadaptación en el trabajo: resulta difícil de entender y aparecen dificultades claras en la comunicación.',
        'Su distancia respecto de lo convencional es grande y puede derivar en desadaptación laboral, con problemas evidentes para hacerse entender.',
      ],
      recomienda: [
        'Pedirle que explicite sus ideas para asegurar que el mensaje sea comprendido.',
        'Pedirle que explique sus ideas para asegurar que el mensaje se comprenda.',
        'Hacer que ponga en palabras su razonamiento, así se confirma que el otro lo entendió.',
      ],
    },
    dice: [
      'Aparece un apartamiento de lo convencional que puede aumentar el comportamiento desajustado frente a lo que la situación exige, y con eso las dificultades de comunicación con el entorno.',
      'Se aleja de lo convencional en un grado que puede volver su conducta poco ajustada a lo que la situación pide, y eso complica la comunicación con el entorno.',
      'Su lectura de la realidad se aparta lo suficiente como para generar respuestas desajustadas y roce en el intercambio con los demás.',
    ],
    recomienda: [
      'Conviene considerar si lo que el puesto necesita se sostiene con este nivel de interpretación de los datos, porque puede traer roce con otros y caída de productividad.',
      'Evaluar si el puesto tolera este nivel de interpretación propia, porque puede traer conflicto con otros y caída del rendimiento.',
      'Considerar cuánta interpretación personal admite la tarea, ya que este grado puede afectar el vínculo con el equipo y los resultados.',
    ],
  },
  'xu-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'Xu%',
    corte: { op: 'mayor', valor: 0.2, decimales: 2 },
    zulliger: {
      corte: { op: 'mayor', valor: 0.33, decimales: 2 },
      dice: [
        'Puede tener visiones más originales que la mayoría de las personas.',
        'Su mirada de las situaciones tiende a ser más propia que la del promedio de las personas.',
        'Su mirada de las situaciones tiende a ser más propia que la del promedio.',
      ],
      recomienda: [
        'Si necesita ajustarse a lo pautado, pedirle que se centre en datos e información concreta.',
        'Si necesita ajustarse a lo pautado, pedirle que se apoye en datos e información concreta.',
        'Cuando la tarea exija seguir lo establecido, orientarla hacia los datos concretos de la situación.',
      ],
    },
    dice: [
      'Marcada tendencia a ver las cosas desde su propio punto de vista, con reticencia a sumarse a visiones más convencionales. Si el entorno no lo presiona a ajustarse, no es relevante; si hay exigencia fuerte de ajustarse a lo ya definido, el riesgo de conflicto sube.',
      'Ve las cosas desde su propio ángulo y se resiste a adoptar la mirada más convencional. Si el entorno no le exige ajustarse, no trae problema; si la exigencia de seguir lo definido es fuerte, sube el riesgo de conflicto.',
      'Sostiene una mirada propia y no se pliega fácil a la versión compartida. En contextos flexibles funciona bien, y en los que piden apego estricto a lo pautado puede chocar.',
    ],
    recomienda: [
      'Marcarle qué cosas se hacen de una manera establecida y sin modificaciones por más que las vea distinto, y dónde sí puede poner su impronta.',
      'Dejarle claro qué se hace de una única manera y en qué puntos puede aportar su enfoque.',
      'Delimitar qué es fijo y qué queda abierto a su criterio, para que sepa dónde ajustarse.',
    ],
  },
  'p-bajo': {
    area: 'Cómo interpreta lo que ve',
    indice: 'P',
    cuando: 'menos de lo esperado para la cantidad de respuestas',
    zulliger: {
      dice: [
        'No ve las cosas como la mayoría. Podría tener dificultad de adaptación si su tarea implica atenerse a lo que ya está pautado, y podría funcionar bien en tareas donde se privilegie la capacidad creativa.',
        'No ve las cosas como la mayoría. Podría tener dificultad de adaptación si la tarea implica atenerse a lo pautado, y funcionar bien donde se privilegie la capacidad creativa.',
        'Su lectura se aparta de la del resto. En tareas que exigen seguir un procedimiento fijo puede costarle, y en las que piden creatividad puede rendir bien.',
      ],
      recomienda: [
        'Si se requiere que siga lo pautado, ayudarla a ver las situaciones a través de información concreta y de datos.',
        'Si se requiere que siga lo pautado, ayudarla a leer las situaciones a través de datos e información concreta.',
        'Cuando la tarea tenga un procedimiento fijo, apoyarla con información específica para que se ajuste.',
      ],
    },
    dice: [
      'Tiene una mirada de las situaciones distinta a la de la mayoría de su entorno. Es alguien singular que, sin violar la realidad, prefiere manejarla de forma menos convencional.',
      'Mira las situaciones de un modo distinto al de la mayoría de su entorno. Es alguien singular que maneja la realidad de forma menos convencional, sin desconocerla.',
      'Su lectura de las cosas se aparta de la del resto sin perder contacto con la realidad: prefiere resolver por caminos menos transitados.',
    ],
    recomienda: [
      'Marcarle qué cosas se necesitan hacer de una manera determinada, y dónde puede ser original.',
      'Precisarle qué tareas tienen un procedimiento fijo y en cuáles puede aportar su propia forma.',
      'Separar con claridad lo que se hace de una manera establecida de lo que admite su impronta.',
    ],
  },
  'p-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'P',
    cuando: 'más de lo esperado para la cantidad de respuestas',
    zulliger: {
      dice: [
        'Se esfuerza por cumplir con las expectativas que piensa que los demás tienen sobre ella. Es buen indicador para tareas rutinarias y para funcionar apegada a lo convencional.',
        'Se esfuerza por cumplir con las expectativas que piensa que los demás tienen sobre ella. Es buen indicador para tareas rutinarias y para trabajar apegada a lo convencional.',
        'Orienta su desempeño a satisfacer lo que supone que se espera de ella, lo que favorece las tareas rutinarias y el apego a lo establecido.',
      ],
    },
    dice: [
      'Se esfuerza por satisfacer las expectativas que cree que los demás tienen sobre él.',
      'Se esfuerza por responder a lo que supone que los demás esperan de él.',
      'Orienta su conducta a cumplir con las expectativas que atribuye a los otros.',
    ],
    recomienda: [
      'Ayudarlo a clarificar expectativas reales y criterios de desempeño, para que no opere desde supuestos sino desde acuerdos concretos.',
      'Explicitarle qué se espera y con qué se lo va a evaluar, para que no trabaje sobre suposiciones.',
      'Acordar con él criterios de desempeño concretos, así deja de operar sobre lo que imagina que le piden.',
    ],
  },
  'eb-introversivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'EB',
    cuando: 'estilo introversivo',
    zulliger: {
      dice: [
        'Prefiere usar el pensamiento para resolver los problemas y mantiene sus emociones en segundo plano. Puede sentirse más cómoda en tareas donde no necesite interactuar con otros, y puede parecer seria o retraída. Sostiene un buen nivel de concentración durante períodos largos y piensa antes de actuar. Puede preferir la comunicación escrita a la hablada.',
        'Resuelve pensando y deja las emociones en segundo plano. Se siente más cómoda en tareas sin demasiada interacción y puede parecer seria o reservada. Sostiene la concentración durante períodos largos, piensa antes de actuar y puede preferir escribir a hablar.',
        'Su vía para resolver es el pensamiento, con la emoción corrida del centro. El trabajo sin mucho intercambio le resulta más cómodo, puede dar impresión de distancia, se concentra por largo rato y prefiere la comunicación escrita.',
      ],
    },
    dice: [
      'Prefiere la reflexión para resolver problemas: espera a considerar todas las alternativas antes de decidir, no procesa emoción mientras busca soluciones, y se apoya fuerte en su propia evaluación interna para elaborar juicios.',
      'Resuelve pensando: repasa las alternativas antes de decidir, mantiene la emoción al margen mientras busca la solución y confía sobre todo en su propia evaluación.',
      'Su manera de decidir pasa por la reflexión. Considera las opciones, deja los afectos fuera del proceso y se apoya en su juicio interno para concluir.',
    ],
    recomienda: [''],
  },
  'eb-extratensivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'EB',
    cuando: 'estilo extratensivo',
    zulliger: {
      dice: [
        'Usa el ensayo y el error para resolver los problemas. Puede ser más emocional e incluir sus afectos al hacer evaluaciones. Prefiere tareas con interacción con otros, le gusta el cambio y la acción, y prefiere resolver de manera rápida.',
        'Resuelve probando y corrigiendo. Puede ser más emocional y sumar sus afectos al evaluar. Prefiere tareas con contacto con otros, le atraen el cambio y la acción, y resuelve rápido.',
        'Su forma de resolver pasa por el ensayo. Los afectos entran en sus evaluaciones, elige el trabajo con gente, se mueve bien en el cambio y tiende a decidir con velocidad.',
      ],
    },
    dice: [
      'Mezcla los sentimientos con sus decisiones. El contacto con los demás y el procesamiento de la emoción son prioritarios, y el control de esas descargas queda en segundo plano. Usa el ensayo y el error.',
      'Sus sentimientos participan de la decisión. Prioriza el contacto con los demás y el procesamiento de la emoción, deja el control de esas descargas en segundo plano y avanza probando.',
      'Decide con los afectos puestos en juego. El intercambio con otros y lo que siente pesan en la resolución, y el método es el de probar y corregir.',
    ],
    recomienda: [
      'Al decidir o resolver un problema, acompañarlo para que distinga la carga emocional que le provoca la situación, y con ese registro llegue a resoluciones mejores.',
      'Al decidir, ayudarlo a identificar qué le está generando la situación, para que ese registro mejore la resolución.',
      'Acompañarlo a separar la carga emocional del problema en sí, y decidir con esa distinción hecha.',
    ],
  },
  'eb-ambigual': {
    area: 'Cómo decide y cómo piensa',
    indice: 'EB',
    cuando: 'estilo ambigual',
    zulliger: {
      dice: [
        'Su estilo para resolver problemas o tomar decisiones no está definido: a veces logra dejar las emociones de lado y en otras circunstancias involucra sus afectos en la decisión. Eso la vuelve poco previsible.',
        'No tiene un estilo definido para resolver o decidir: unas veces deja las emociones de lado y otras las involucra. Eso la vuelve poco previsible.',
        'Alterna entre decidir con la emoción afuera y decidir con la emoción adentro, sin un modo estable, y por eso resulta difícil anticipar cómo va a resolver.',
      ],
    },
    dice: [
      'A veces resuelve dejando de lado la emoción y centrándose en las ideas, y otras veces sus afectos influyen en la evaluación. Al no tener un estilo definido, la decisión le puede llevar más tiempo y resultar menos previsible.',
      'A veces decide desde las ideas dejando la emoción afuera, y otras veces sus afectos entran en la evaluación. Sin un estilo fijo, la decisión le lleva más tiempo y resulta menos anticipable.',
      'Alterna entre resolver con la cabeza y resolver con lo que siente. Esa falta de un modo estable le agrega tiempo a la decisión y la vuelve difícil de prever.',
    ],
    recomienda: [''],
  },
  'a-p-pasivo-cuadruple': {
    area: 'Cómo decide y cómo piensa',
    indice: 'a:p',
    cuando: 'p cuatro veces a o más',
    zulliger: {
      dice: [
        'Sostiene sus pensamientos con firmeza y le cuesta mucho revisar su punto de vista o incorporar formas nuevas de trabajar.',
        'Sus ideas están fijas: adoptar otra mirada o aprender una pauta distinta le demanda un esfuerzo grande.',
        'Sostiene sus pensamientos con mucha firmeza, y tanto revisar su posición como aprender un modo nuevo de hacer las cosas le demanda un esfuerzo grande.',
      ],
      recomienda: [
        'Pedirle que confronte su idea con otro punto de vista antes de definir cómo avanzar.',
        'Poner una revisión con otra persona antes de que cierre la decisión.',
        'Sumar una mirada externa a sus definiciones antes de que las lleve a la acción.',
      ],
    },
    dice: [
      'Tiende a aferrarse a sus pensamientos, le cuesta cambiar de punto de vista y aprender pautas nuevas de funcionamiento.',
      'Se aferra a lo que piensa: cambiar de punto de vista o incorporar formas nuevas de trabajar le cuesta mucho.',
      'Sus ideas quedan fijas y le resulta muy difícil revisarlas o adoptar pautas distintas de las que ya tiene.',
    ],
    recomienda: [
      'Promover la revisión de sus ideas y la incorporación de otras miradas antes de definir acciones.',
      'Pedirle que contraste su idea con otra mirada antes de definir el curso de acción.',
      'Incorporar una instancia de revisión con otros antes de que cierre una decisión.',
    ],
  },
  'a-p-pasivo-triple': {
    area: 'Cómo decide y cómo piensa',
    indice: 'a:p',
    cuando: 'p tres veces a o más',
    zulliger: {
      dice: [
        'Sus ideas son excesivamente rígidas: va a ser muy difícil alterar tanto sus opiniones como sus actitudes.',
        'Sus ideas son excesivamente rígidas: alterar sus opiniones y sus actitudes va a ser muy difícil.',
        'Sostiene sus ideas con mucha rigidez, y mover tanto lo que opina como su actitud costará bastante.',
      ],
      recomienda: [
        'Si se requiere que siga lo pautado, ayudarla a ver las situaciones a través de información concreta y de datos.',
        'Si se requiere que siga lo pautado, ayudarla a leer las situaciones a través de datos e información concreta.',
        'Presentarle información específica como vía para que revise su posición.',
      ],
    },
    dice: [
      'Tiende a oponerse a los cambios: le cuesta bastante cambiar de punto de vista y aprender pautas nuevas.',
      'Se resiste a los cambios: revisar su punto de vista o aprender una pauta nueva le demanda bastante.',
      'Frente a un cambio tiende a oponerse, y modificar su posición o incorporar otra forma de hacer las cosas le cuesta.',
    ],
    recomienda: [
      'Mostrarle información concreta con datos para ayudarlo a ver otro punto de vista.',
      'Mostrarle datos concretos que le permitan ver la situación desde otro ángulo.',
      'Presentarle información específica como vía para que considere otro punto de vista.',
    ],
  },
  'a-p-pasivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'a:p',
    cuando: 'p mayor que a más uno',
    zulliger: {
      dice: [
        'Aparece una tendencia a adoptar un rol pasivo.',
        'Se inclina a ocupar un lugar pasivo en la relación con los demás.',
        'Se inclina a ocupar un lugar pasivo.',
      ],
      recomienda: [
        'Asignarle responsabilidades claras para favorecer la toma de iniciativa.',
        'Asignarle responsabilidades claras para favorecer que tome iniciativa.',
        'Darle a cargo tareas definidas, para que la iniciativa salga de ella.',
      ],
    },
    dice: [
      'Tiende a adoptar un papel pasivo en sus relaciones: puede quedar como receptor de las acciones de los demás y esperar que otros le resuelvan los problemas.',
      'Ocupa un lugar pasivo en el vínculo: tiende a recibir la acción de los demás y a esperar que otros le resuelvan.',
      'En sus relaciones suele quedar en el lugar de quien espera, dejando que la iniciativa y la solución vengan de otro.',
    ],
    recomienda: [
      'Diseñar un camino de aprendizaje por etapas, para ir generando autonomía paso a paso.',
      'Armar un recorrido de aprendizaje por etapas para que gane autonomía de a poco.',
      'Darle responsabilidades crecientes, de menor a mayor, para que construya autonomía paso a paso.',
    ],
  },
  'ma-mp-pasivo-fuerte': {
    area: 'Cómo decide y cómo piensa',
    indice: 'Ma:Mp',
    cuando: 'Mp mayor que Ma más uno',
    zulliger: {
      dice: [
        'Suele esperar que otros le indiquen lo que tiene que hacer, y usa sus recursos para evitar enfrentar los problemas.',
        'Suele esperar que otros le indiquen qué hacer, y usa sus recursos para no enfrentar los problemas.',
        'Aguarda la indicación ajena y destina su energía a evitar los problemas en lugar de abordarlos.',
      ],
      recomienda: [
        'Asignarle responsabilidades claras para favorecer la toma de iniciativa.',
        'Asignarle responsabilidades claras para favorecer que tome iniciativa.',
        'Definirle qué queda a su cargo, para empujar la iniciativa propia.',
      ],
    },
    dice: [
      'Evita la responsabilidad y la toma de decisiones, y recurre a la fantasía para negar los aspectos incómodos de la realidad. Eso conlleva cierta dependencia de que otros resuelvan.',
      'Esquiva la responsabilidad y la decisión, y recurre a la fantasía para no ver lo que le incomoda de la realidad. Eso lo deja dependiendo de que otros resuelvan.',
      'Deja en manos ajenas lo que hay que decidir y se apoya en la imaginación para negar lo incómodo. El resultado es que espera la solución de otro.',
    ],
    recomienda: [
      'Darle lineamientos claros y promover que asuma de a poco la responsabilidad sobre sus decisiones, evitando resolver por él lo que puede abordar solo.',
      'Darle lineamientos precisos y que vaya asumiendo de a poco la decisión, sin resolverle lo que puede hacer solo.',
      'Fijar con claridad qué le corresponde decidir y sostener que lo haga, evitando reemplazarlo.',
    ],
  },
  'ma-mp-pasivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'Ma:Mp',
    cuando: 'Mp mayor que Ma',
    zulliger: {
      dice: [
        'Se refugia en la imaginación para compensar lo que la frustra. Puesta al servicio de crear, suma; usada para evitar dificultades, ocupa el lugar de la búsqueda de soluciones. Bajo estrés se acentúa.',
        'Frente a la frustración recurre a la imaginación. Puesta a crear aporta, y puesta a evitar ocupa el lugar de la solución. La exigencia la intensifica.',
        'Ante lo que no sale, se apoya en la imaginación. Eso puede ser productivo o puede ocupar el lugar de la solución, y cuando la exigencia sube se nota más.',
      ],
      recomienda: [
        'Llevarla a definir acciones concretas frente a cada situación, en especial cuando la exigencia sube.',
        'Cuando la carga sube, pedirle pasos y fechas concretas para que la idea baje a la acción.',
        'Traducir cada situación en acciones puntuales, sobre todo en los momentos de mayor demanda.',
      ],
    },
    dice: [
      'Tiende a refugiarse en la imaginación para compensar frustraciones. Usado de manera creativa suma; usado para evitar dificultades, reemplaza la búsqueda de soluciones, y se acentúa bajo estrés.',
      'Se refugia en la imaginación para compensar lo que lo frustra. Puesto al servicio de crear, suma; puesto a evitar dificultades, ocupa el lugar de la búsqueda de soluciones. Bajo estrés se acentúa.',
      'Usa la fantasía frente a la frustración. Como recurso creativo aporta, y como vía de evitación reemplaza el trabajo de resolver. La exigencia lo intensifica.',
    ],
    recomienda: [
      'Ayudarlo a enfocar las situaciones en acciones concretas, sobre todo en los momentos de mayor exigencia.',
      'Llevarlo a definir acciones concretas frente a cada situación, en especial cuando la exigencia sube.',
      'Pedirle pasos concretos y plazos cuando la carga aumenta, para que no quede en el plano de la idea.',
    ],
  },
  'intelectualizacion-alta': {
    area: 'Cómo decide y cómo piensa',
    indice: 'Intelectualización',
    corte: { op: 'mayor', valor: 5, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 1, decimales: 0 },
      dice: [
        'Procesa las emociones como si fueran pensamientos. En el desempeño laboral concreto, puede tener dificultades para mantener la estabilidad emocional cuando se incrementan las tensiones, internas o externas.',
        'Procesa las emociones como si fueran pensamientos. En el trabajo concreto, puede costarle mantener la estabilidad emocional cuando la tensión aumenta, venga de adentro o de afuera.',
        'Convierte lo que siente en razonamiento, y cuando la tensión crece le cuesta sostener la estabilidad emocional en el desempeño.',
      ],
      recomienda: [
        'Ayudarla a distinguir entre lo que siente y lo que piensa en las situaciones de tensión, para que pueda responder con mayor claridad y estabilidad emocional.',
        'Ayudarla a distinguir lo que siente de lo que piensa en los momentos de tensión, para que responda con más claridad.',
        'En situaciones tensas, acompañarla a separar el afecto del razonamiento antes de que resuelva.',
      ],
    },
    dice: [
      'Procesa las emociones como si fueran pensamientos. Con eso neutraliza su efecto, y a la vez tiende a distorsionar las situaciones, con lo cual las soluciones pierden eficacia. Se vuelve más vulnerable cuando la situación sube de intensidad.',
      'Convierte lo que siente en razonamiento. Así le baja intensidad al afecto, y a la vez deforma la lectura de la situación, con lo que la solución pierde eficacia. Cuando la intensidad sube, queda más expuesto.',
      'Trata las emociones como si fueran ideas. Eso neutraliza su efecto y deforma la situación, y las respuestas que salen de ahí funcionan peor. A mayor tensión, mayor vulnerabilidad.',
    ],
    recomienda: [
      'Ayudarlo con el registro de sus emociones, y darle lugar para procesarlas y encontrar respuestas más eficientes.',
      'Trabajar el registro de lo que siente y darle lugar para procesarlo, para que sus respuestas ganen eficacia.',
      'Ayudarlo a poner nombre a lo que le pasa antes de resolver, así la solución no sale solo del razonamiento.',
    ],
  },
  'm-menos-alto': {
    area: 'Cómo decide y cómo piensa',
    indice: 'M−',
    corte: { op: 'mayor', valor: 1, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: [
        'Aparece un indicador poco frecuente en evaluaciones laborales, que puede señalar alguna dificultad en la comunicación.',
        'Se detecta un indicador infrecuente en evaluaciones laborales, que apunta a una posible dificultad para comunicarse.',
        'Se detecta un indicador infrecuente en este tipo de evaluaciones, que apunta a una posible dificultad para comunicarse.',
      ],
      recomienda: [
        'Hacer chequeos breves de comprensión para asegurar que el mensaje haya sido entendido correctamente.',
        'Hacer chequeos breves de comprensión para confirmar que el mensaje se entendió.',
        'Verificar con preguntas cortas que recibió el mensaje tal como se lo quiso dar.',
      ],
    },
    dice: [
      'Aparece cierta probabilidad de dificultades en la calidad de sus ideas.',
      'Aparece cierta probabilidad de que la calidad de sus ideas se vea afectada.',
      'Se detecta un riesgo de que sus razonamientos pierdan calidad.',
    ],
    recomienda: [''],
  },
  'fm-cero': {
    area: 'Cómo decide y cómo piensa',
    indice: 'FM',
    corte: { op: 'menor', valor: 1, decimales: 0 },
    zulliger: {
      dice: [
        'Le cuesta registrar lo que ella misma necesita.',
        'Sus propias necesidades no le llegan al registro.',
        'Sus necesidades le pasan desapercibidas.',
      ],
      recomienda: [
        'Puede necesitar ayuda de afuera para empezar a registrarlas. Un entorno donde pueda darse prioridad la favorece.',
        'Un contexto que le habilite ocuparse de sí la ayuda, y al principio va a necesitar que alguien se lo señale.',
        'Señalarle lo que necesita cuando ella no lo ve, y dejarle lugar para atenderlo.',
      ],
    },
    dice: [
      'Se le dificulta tomar registro de sus propias necesidades.',
      'Le cuesta registrar lo que él mismo necesita.',
      'No llega a tomar nota de sus propias necesidades.',
    ],
    recomienda: [
      'Puede necesitar ayuda externa para empezar a registrarlas. Un entorno donde se le permita darse prioridad ayuda.',
      'Puede necesitar ayuda de afuera para empezar a registrarlas. Un entorno donde pueda darse prioridad lo favorece.',
      'Un contexto que le habilite ocuparse de sí lo ayuda, y al principio va a necesitar que alguien se lo señale.',
    ],
  },
  'fm-alto': {
    area: 'Cómo decide y cómo piensa',
    indice: 'FM',
    corte: { op: 'mayor', valor: 5, decimales: 0 },
    zulliger: {
      dice: [
        'Sus necesidades sin resolver le generan un malestar interno alto que se traduce en tensión, y puede afectarle la atención, la concentración y el descanso.',
        'Carga una tensión interna elevada que nace de lo que necesita y no atiende, con impacto posible en cómo se concentra y cómo duerme.',
        'El malestar por lo que necesita y no resuelve le sube la tensión, con impacto posible en cómo se concentra y cómo descansa.',
      ],
      recomienda: [
        'Ayudarla a ordenar prioridades cuando la carga de trabajo aumenta.',
        'Cuando sube el volumen de trabajo, definir con ella qué va primero.',
        'Acompañarla a jerarquizar las tareas en los momentos de mayor carga.',
      ],
    },
    dice: [
      'Está con el malestar interno elevado por sus propias necesidades, y eso se manifiesta como tensión: puede afectar la atención, la concentración y el sueño.',
      'Sus propias necesidades le están generando un malestar interno alto, que se traduce en tensión: puede afectarle la atención, la concentración y el sueño.',
      'Carga con una tensión interna elevada que viene de necesidades no resueltas, y eso se le nota en la concentración, en la atención y en el descanso.',
    ],
    recomienda: [
      'Ayudarlo a ordenar prioridades cuando se incrementa la carga de trabajo.',
      'Ayudarlo a ordenar prioridades cuando la carga de trabajo aumenta.',
      'Cuando sube el volumen de trabajo, definir con él qué va primero.',
    ],
  },
  'm-alto': {
    area: 'Cómo decide y cómo piensa',
    indice: 'm',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    zulliger: {
      dice: [
        'Hay circunstancias externas que la están afectando de manera importante: atraviesa una situación estresante.',
        'Algo de su situación actual le genera molestia considerable y viene de afuera.',
        'Está atravesando un momento de tensión cuya causa está en el entorno y no en ella.',
      ],
      recomienda: [
        'Abrir una conversación para preguntarle si necesita algo de la empresa o de su jefe para trabajar más tranquila.',
        'Preguntarle de manera directa qué necesitaría del trabajo para pasar este momento con menos tensión.',
        'Darle un espacio de charla donde pueda decir qué le haría falta para estar más tranquila.',
      ],
    },
    dice: [
      'Hay circunstancias externas que le están causando molestias importantes: está atravesando una situación estresante.',
      'Hay circunstancias externas que lo están afectando de manera importante: atraviesa una situación estresante.',
      'Algo de su situación actual le está generando molestia considerable y proviene de afuera.',
    ],
    recomienda: [
      'Generar un espacio de charla para consultarle si necesita algo de la empresa o de su jefe para trabajar más tranquilo.',
      'Abrir una conversación para preguntarle si necesita algo de la empresa o de su jefe para trabajar más tranquilo.',
      'Consultarle directamente qué necesitaría del trabajo para atravesar el momento con menos tensión.',
    ],
  },
  'fc-control-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'FC:CF+C',
    cuando: 'sin descarga, o FC más del triple de CF+C',
    zulliger: {
      dice: [
        'Controla sus descargas más de lo esperado: casi nunca se afloja al manejar emociones, porque desconfía de mostrarlas, y expresar lo que siente le cuesta.',
        'Su control sobre la expresión del afecto es mayor al habitual. Mostrarse le genera desconfianza y por eso rara vez suelta lo que siente.',
        'Sostiene un control estricto sobre lo que muestra. La expresión abierta del afecto le genera desconfianza y la evita.',
      ],
    },
    dice: [
      'Controla sus descargas más de lo esperado: casi nunca se relaja cuando maneja emociones, porque desconfía de cualquier expresión abierta del afecto. Le cuesta expresar lo que siente con libertad.',
      'Mantiene sus descargas bajo un control mayor al esperado: rara vez se afloja al manejar emociones, porque desconfía de mostrarlas. Expresar lo que siente le cuesta.',
      'Controla la expresión del afecto más de lo habitual. Desconfía de mostrarse y por eso casi nunca se permite soltar lo que siente.',
    ],
    recomienda: [''],
  },
  'fc-descarga-intensa': {
    area: 'Cómo maneja lo que siente',
    indice: 'FC:CF+C',
    cuando: 'CF+C supera a FC por más de 2',
    zulliger: {
      dice: [
        'Se expresa con mucha intensidad, y el control emocional le falla, con lo cual da impresión de impulsividad.',
        'Sus manifestaciones salen intensas y sin modular, y desde afuera se leen como impulsividad.',
        'Muestra lo que siente con mucha carga y poco filtro, y desde afuera se percibe como falta de control.',
      ],
    },
    dice: [
      'Tiende a expresarse de manera intensa, y eso da impresión de impulsividad por la dificultad de control emocional.',
      'Se expresa con intensidad, y eso da impresión de impulsividad porque el control emocional le falla.',
      'Sus manifestaciones son intensas y quedan poco moduladas, lo que se lee como impulsividad.',
    ],
    recomienda: [''],
  },
  'fc-descarga': {
    area: 'Cómo maneja lo que siente',
    indice: 'FC:CF+C',
    cuando: 'CF+C supera a FC por uno o dos',
    zulliger: {
      dice: [
        'Puede tratarse de una persona frontal, capaz de mostrarse tal como es, sin filtros.',
        'Se muestra de manera frontal, tal como es, sin poner filtros.',
        'Se muestra de manera directa y sin filtro, tal como es.',
      ],
      recomienda: [
        'Desde el inicio, marcarle los límites que se esperan, por ejemplo en el manejo de información o en el contacto con clientes.',
        'Desde el inicio, marcarle qué límites se esperan, por ejemplo en el manejo de información o en el trato con clientes.',
        'Dejarle claro desde el primer día qué se dice, qué se reserva y cómo se trata al cliente.',
      ],
    },
    dice: [
      'Expresa sus afectos sin filtro, de manera más espontánea que el adulto medio. No se esfuerza por controlar sus emociones en el mismo grado que la mayoría, sin que eso implique un problema serio de control.',
      'Muestra lo que siente de manera más espontánea que el adulto promedio. No se esfuerza tanto como la mayoría por controlarlo, sin que eso llegue a ser un problema serio de control.',
      'Expresa el afecto sin demasiado filtro y con más soltura que el promedio, dentro de un rango que no compromete el control.',
    ],
    recomienda: [
      'Mostrarle, sobre todo al principio, los filtros que se esperan y qué información se mantiene reservada.',
      'Al principio, dejarle en claro qué filtros se esperan y qué información se maneja con reserva.',
      'Explicitarle desde el inicio los límites de lo que se dice y de lo que se guarda.',
    ],
  },
  'c-pura-alta': {
    area: 'Cómo maneja lo que siente',
    indice: 'C pura',
    corte: { op: 'mayor', valor: 1, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: [
        'Disfruta cuando está involucrada en situaciones vertiginosas y de cambio. Es más proclive que el resto a desplegar conductas poco reflexivas.',
        'Disfruta las situaciones vertiginosas y de cambio, y en ellas es más proclive que el resto a resolver sin reflexionar.',
        'Los contextos de mucha velocidad y cambio le resultan atractivos, y ahí tiende más que otros a actuar sin pensarlo.',
      ],
      recomienda: [
        'En las situaciones de cambio rápido, ayudarla a detenerse y evaluar la información relevante antes de decidir o avanzar.',
        'En los cambios rápidos, ayudarla a frenar y revisar la información relevante antes de decidir.',
        'Cuando todo se acelera, pedirle que se detenga a mirar los datos antes de avanzar.',
      ],
    },
    dice: [
      'Disfruta de las situaciones vertiginosas, y en ellas es más propenso a desplegar conductas poco reflexivas.',
      'Las situaciones vertiginosas le resultan atractivas, y en ellas es más propenso a actuar sin reflexionar.',
      'Se siente cómodo en contextos de mucha velocidad, donde tiende a resolver sin pensarlo demasiado.',
    ],
    recomienda: [
      'Mostrarle los límites que se esperan incluso en las situaciones más caóticas.',
      'Marcarle qué límites siguen vigentes también en las situaciones más caóticas.',
      'Dejar claros los límites que no cambian aunque la situación se acelere.',
    ],
  },
  'afr-bajo': {
    area: 'Cómo maneja lo que siente',
    indice: 'Afr',
    cuando: 'por debajo de la banda de su estilo',
    zulliger: {
      dice: [
        'Prefiere no quedar involucrada en situaciones con carga emocional. Esa misma tendencia le compensa cualquier problema de descontrol.',
        'Se corre de las situaciones donde hay emoción en juego, y ese mismo retiro le frena cualquier descontrol.',
        'Se corre de los contextos emocionalmente cargados, lo que a la vez le sirve de contención.',
      ],
    },
    dice: [
      'Prefiere no verse implicado en situaciones con carga emocional. Esa misma tendencia neutraliza los problemas de descontrol, si los hubiera.',
      'Prefiere no quedar involucrado en situaciones con carga emocional. Esa misma tendencia le compensa cualquier problema de descontrol.',
      'Evita meterse donde hay emoción en juego, y ese retiro le funciona como freno de un eventual descontrol.',
    ],
    recomienda: [''],
  },
  'afr-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'Afr',
    cuando: 'por encima de la banda de su estilo',
    zulliger: {
      dice: [
        'Las situaciones con carga emocional la estimulan y en ellas se puede sentir más productiva.',
        'Los contextos emocionalmente cargados la activan, y ahí es donde más rinde.',
        'Se moviliza con lo emocional y encuentra ahí un terreno donde se siente productiva.',
      ],
    },
    dice: [
      'Las situaciones con carga emocional lo estimulan, y puede sentirse más productivo en ellas.',
      'Las situaciones con carga emocional lo estimulan y en ellas se puede sentir más productivo.',
      'Frente a los contextos emocionalmente cargados se activa, y ahí rinde más.',
    ],
    recomienda: [''],
  },
  's-muy-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'S',
    corte: { op: 'mayor', valor: 4, decimales: 0 },
    zulliger: {
      dice: [
        'Sostiene una oposición hacia el entorno que resulta muy difícil de mover.',
        'Se ubica en contra de lo que llega del entorno, y esa posición no cede con facilidad.',
        'Su oposición al entorno es marcada y muy resistente al cambio.',
      ],
      recomienda: [
        'Evitar el choque de frente y sostener límites claros y parejos, que es lo que le permite aflojar.',
        'No confrontarla de frente y mantener reglas firmes y consistentes, que es lo que le permite flexibilizar.',
        'Marcarle límites estables sin entrar en discusión directa, que es la vía por la que puede ceder.',
      ],
    },
    dice: [
      'Actitud de oposición hacia el entorno, difícil de modificar.',
      'Sostiene una actitud de oposición hacia el entorno que resulta difícil de mover.',
      'Se planta en contra de lo que viene del entorno, y esa posición no cede con facilidad.',
    ],
    recomienda: [
      'Para que pueda flexibilizarla, evitar la confrontación directa y marcar límites claros y consistentes.',
      'Evitar el choque frontal y sostener límites claros y parejos, para que pueda aflojar la posición.',
      'No confrontarlo de frente y mantener reglas firmes y consistentes, que es lo que le permite flexibilizar.',
    ],
  },
  's-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'S',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 3, decimales: 0 },
      dice: [
        'Se detecta un monto de irritación y de enojo mayor que lo convencional.',
        'Aparece un nivel de enojo y de irritación por encima de lo habitual.',
        'Aparece un nivel de enojo e irritación por encima de lo habitual.',
      ],
      recomienda: [
        'Ayudarla a detectar ese enojo y a elegir acciones que la lleven a un estado emocional superador.',
        'Ayudarla a reconocer ese enojo y a elegir acciones que la lleven a un estado mejor.',
        'Acompañarla a identificar cuándo está enojada y a decidir desde otro lugar.',
      ],
    },
    dice: [
      'Le cuesta cambiar de opinión.',
      'Cambiar de opinión le cuesta.',
      'Le resulta difícil moverse de la posición que ya tomó.',
    ],
    recomienda: [
      'Ayudarlo a ver los otros puntos de vista mostrándole información concreta.',
      'Mostrarle información concreta para que pueda ver los otros puntos de vista.',
      'Acercarle datos específicos como vía para que registre otras miradas.',
    ],
  },
  'c-prima-alta': {
    area: 'Cómo maneja lo que siente',
    indice: "C'",
    corte: { op: 'mayor', valor: 4, decimales: 0 },
    zulliger: {
      dice: [
        'Al no hacer las descargas ni los intercambios emocionales esperados, aumenta su tensión interna y se favorece la derivación de esa tensión al cuerpo.',
        'Al no hacer las descargas ni los intercambios emocionales esperados, su tensión interna sube y esa tensión se deriva al cuerpo.',
        'Retiene lo que debería descargar en el intercambio con otros, la tensión interna crece y termina expresándose en el cuerpo.',
      ],
      recomienda: [
        'Darle espacios donde pueda abrirse emocionalmente y se sienta apoyada y escuchada.',
        'Darle espacios donde pueda abrirse emocionalmente y sentirse apoyada y escuchada.',
        'Generarle instancias de conversación donde encuentre escucha y respaldo.',
      ],
    },
    dice: [
      'Está conteniendo una irritación interna fuerte, que puede tardar bastante en bajar.',
      'Está conteniendo una irritación interna importante, que puede tardar en bajar.',
      'Guarda un enojo interno de peso, y ese estado no se disipa rápido.',
    ],
    recomienda: [
      'Generar un espacio de conversación donde se le consulte si necesita algo de la empresa o de su jefe para trabajar más tranquilo.',
      'Abrir un espacio de conversación para consultarle qué necesita de la empresa o de su jefe para trabajar más tranquilo.',
      'Preguntarle en un momento tranquilo qué le haría falta del trabajo para descargar esa tensión.',
    ],
  },
  'sumt-cero': {
    area: 'Cómo maneja lo que siente',
    indice: 'SumT',
    corte: { op: 'menor', valor: 1, decimales: 0 },
    // En Zulliger T=0 es la norma: la lectura queda escrita por si alguna vez
    // se decide informarla, y hoy no sale.
    zulliger: {
      aplica: false,
      dice: [
        'Cuida su distancia con los demás y no se acerca más allá de lo necesario.',
        'La cercanía emocional la incomoda y se maneja con reserva en el trato.',
        'Sostiene el contacto en un plano formal y esquiva la intimidad emocional.',
      ],
      recomienda: [
        'Sostener un trato respetuoso de su distancia, con un espacio definido para cuando necesite consultar.',
        'Dejarle un canal claro para pedir ayuda, sin empujar el acercamiento.',
        'Evaluar cuánta cercanía exige el puesto antes de pedirle más contacto del que elige.',
      ],
    },
    dice: [
      'Es distante en el contacto con los demás: no se siente cómodo en las situaciones de cercanía emocional y tiende a evitarlas. Cuida mantener una distancia de seguridad.',
      'Mantiene distancia en el contacto: la cercanía emocional lo incomoda y tiende a esquivarla, cuidando dejar un margen.',
      'Se maneja con reserva en el vínculo. Las situaciones de intimidad emocional no le resultan cómodas y las evita.',
    ],
    recomienda: [
      'Ver cuánta cercanía emocional pide el puesto. Conviene no forzarla y respetar la distancia que prefiere, dejando una vía por la cual pueda pedir apoyo cuando lo necesite.',
      'Medir cuánta cercanía pide el puesto. Conviene respetar la distancia que elige y dejar abierta una vía para que pida apoyo.',
      'No forzar el acercamiento y dejarle un canal claro por donde pedir ayuda cuando la necesite.',
    ],
  },
  'sumt-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'SumT',
    corte: { op: 'mayor', valor: 1, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: [
        'Tiene necesidad de cercanía con los demás. Se adapta mejor a estilos de conducción cercanos y a entornos donde se la aliente y reciba reconocimiento explícito por su desempeño.',
        'Necesita cercanía en el vínculo. Se adapta mejor a jefaturas presentes y a lugares donde se la aliente y el reconocimiento por su desempeño se diga en voz alta.',
        'Necesita proximidad en el vínculo. Rinde mejor con jefaturas presentes y en lugares donde el reconocimiento se dice.',
      ],
      recomienda: [
        'Que su líder sostenga cercanía y la aliente en su desempeño.',
        'Que quien la conduce mantenga contacto frecuente y le reconozca lo que logra.',
        'Que quien la conduce mantenga contacto frecuente y le reconozca los avances.',
      ],
    },
    dice: [
      'Necesita más cercanía y contacto que lo habitual: tiende a sentirse más solo y a depender de la presencia afectiva de otros.',
      'Precisa más contacto y cercanía que lo habitual: se siente solo con facilidad y depende de la presencia afectiva de otros.',
      'Necesita más proximidad que la mayoría, y la falta de contacto le pesa.',
    ],
    recomienda: [
      'Adoptar un estilo de conducción cercano, que le dé contención.',
      'Conducirlo de cerca, con un estilo que le dé contención.',
      'Que su jefe sostenga presencia y contacto frecuente.',
    ],
  },
  'v-presente': {
    area: 'Cómo maneja lo que siente',
    indice: 'V',
    corte: { op: 'mayor', valor: 0, decimales: 0 },
    zulliger: {
      dice: [
        'Cuando se autoevalúa lo hace de manera severa y negativa. Es autoexigente, tiene poca confianza en sí misma y duda de sus posibilidades reales de llevar a cabo una tarea a la que no está habituada.',
        'Se autoevalúa con dureza y en negativo. Se exige mucho, confía poco en sí misma y duda de poder llevar adelante una tarea a la que no está habituada.',
        'Se juzga con dureza y en negativo. La exigencia hacia sí misma es alta, la confianza baja, y ante una tarea desconocida duda de poder hacerla.',
      ],
      recomienda: [
        'Regular la exigencia externa, porque de manera interna ya se exige a sí misma.',
        'Moderar la exigencia que se le pone desde afuera, porque la propia ya es alta.',
        'Moderar la presión que se le pone desde afuera, ya que la propia es alta.',
      ],
    },
    dice: [
      'Cuando se autoevalúa lo hace de manera severa: pocas veces está conforme con su propio desempeño, y se exige mucho.',
      'Se juzga con dureza: rara vez queda conforme con lo que hizo y se exige mucho.',
      'Su autoevaluación es severa. Le cuesta darse por satisfecho con su propio desempeño.',
    ],
    recomienda: [
      'Evitar sumarle exigencia externa, porque ya se exige por dentro.',
      'No sumarle exigencia desde afuera, porque ya se la impone él.',
      'Moderar la presión externa, que la interna ya la tiene alta.',
    ],
  },
  'y-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'Y',
    corte: { op: 'mayor', valor: 1, decimales: 0 },
    zulliger: {
      dice: [
        'Atraviesa una situación que le genera tensión y frente a la cual se siente desbordada. Buena parte de ese malestar es reactivo y va a ceder cuando se resuelvan las circunstancias que lo provocan.',
        'Está bajo una tensión que la excede. El malestar responde a lo que está pasando y debería bajar cuando eso se resuelva.',
        'La situación actual la tiene sobrepasada, con un malestar que depende de esas circunstancias y no de su funcionamiento habitual.',
      ],
    },
    dice: [
      'Está atravesando una situación que le genera tensión y frente a la cual se siente inundado. Buena parte de ese malestar es reactivo y va a ceder si se resuelven las circunstancias que lo provocan.',
      'Atraviesa una situación que le genera tensión y frente a la cual se siente desbordado. Buena parte de ese malestar es reactivo y va a ceder cuando se resuelvan las circunstancias que lo provocan.',
      'Está bajo una tensión que lo excede. El malestar responde a lo que está pasando y debería bajar cuando eso se resuelva.',
    ],
    recomienda: [''],
  },
  'ego-bajo': {
    area: 'Cómo se ve a sí mismo',
    indice: 'Ego',
    corte: { op: 'menor', valor: 0.33, decimales: 2 },
    zulliger: {
      dice: [
        'Presenta cierta dificultad para tomarse a sí misma como centro de interés, y puede aparecer una tendencia al decaimiento anímico por falta de autoestima. Es desfavorable en puestos con tareas de riesgo, como vigilancia, conducción o manipulación de materiales peligrosos, porque al no cuidarse queda más expuesta.',
        'Le cuesta tomarse a sí misma como centro de interés, y esa falta de autoestima puede derivar en decaimiento anímico. En puestos con tareas de riesgo, como vigilancia, conducción o manipulación de materiales peligrosos, queda más expuesta porque no se cuida.',
        'Le cuesta ponerse en el centro de su propio interés, y esa falta de autoestima puede derivar en decaimiento anímico. En puestos de riesgo queda más expuesta, porque el cuidado de sí no aparece.',
      ],
      recomienda: [
        'Dar reconocimiento a sus logros para ayudarla a cultivar su autoestima, y si el puesto lo requiere, extremar las medidas de seguridad.',
        'Reconocerle los logros para sostener su autoestima, y si el puesto lo requiere, reforzar las medidas de seguridad.',
        'Señalarle explícitamente lo que logra, y reforzar las medidas de seguridad si la tarea implica riesgo.',
      ],
    },
    dice: [
      'No se toma a sí mismo como foco de atención en el grado suficiente: tiene una imagen desvalorizada de sí y no confía en sus recursos, con lo cual se puede dejar influenciar por los demás.',
      'No se pone a sí mismo en foco lo suficiente: tiene una imagen desvalorizada y desconfía de sus recursos, con lo cual se deja influir por los demás.',
      'Se considera menos de lo que corresponde y no confía en lo que tiene, y por eso queda expuesto a la influencia ajena.',
    ],
    recomienda: [
      'Alentar y reconocer su desempeño, para fomentar su autoestima.',
      'Reconocer lo que hace bien, para que su autoestima crezca.',
      'Señalarle sus logros de manera explícita, porque solo no se los adjudica.',
    ],
  },
  'ego-alto': {
    area: 'Cómo se ve a sí mismo',
    indice: 'Ego',
    corte: { op: 'mayor', valor: 0.55, decimales: 2 },
    zulliger: {
      corte: { op: 'mayor', valor: 0.56, decimales: 2 },
      dice: [
        'Tiende a tomarse como centro exclusivo de sus preocupaciones y privilegia su punto de vista al punto de arrasar con los argumentos del interlocutor. Le cuesta entender a otros, negociar y adaptarse a quien tiene enfrente.',
        'Se toma como centro exclusivo de sus preocupaciones y pone su punto de vista por encima del ajeno, al punto de arrasar con los argumentos del otro. Entenderlo, negociar y adaptarse le cuesta.',
        'Se ubica en el centro y sostiene su mirada por sobre la del otro, pasando por encima de sus argumentos. Entender al interlocutor, negociar y flexibilizar le resulta difícil.',
      ],
      recomienda: [
        'Requiere asistencia para negociar y para ser empática. Le puede servir ver datos concretos sobre los puntos de vista distintos del propio para flexibilizarse.',
        'Requiere asistencia para negociar y para ser empática. Le puede servir ver datos concretos sobre los puntos de vista distintos del propio.',
        'En las negociaciones va a necesitar apoyo, y acercarle datos de la posición ajena la ayuda a flexibilizar.',
      ],
    },
    dice: [
      'Tiende a centrarse en sí mismo más de lo habitual, dando prioridad a su punto de vista, con dificultad para mirar las cosas desde otra óptica y ponerse en el lugar del otro.',
      'Se pone en el centro más de lo habitual y da prioridad a su punto de vista, con dificultad para mirar desde otro lugar y ponerse en el del otro.',
      'Su propia mirada pesa más de lo esperable, y le cuesta considerar la perspectiva ajena.',
    ],
    recomienda: [
      'En instancias de negociación puede necesitar asistencia: mostrarle datos que lo ayuden a considerar una visión distinta de la suya.',
      'En una negociación va a necesitar apoyo: mostrarle datos que lo ayuden a considerar una visión distinta de la suya.',
      'Al negociar, acercarle información que sostenga el punto de vista del otro, porque solo no lo va a incorporar.',
    ],
  },
  'reflejos-presentes': {
    area: 'Cómo se ve a sí mismo',
    indice: 'Fr+rF',
    corte: { op: 'mayor', valor: 0, decimales: 0 },
    zulliger: {
      dice: [
        'Necesita que le reafirmen su valor constantemente. Con buenos recursos, eso puede funcionar como motor para conseguir logros.',
        'Necesita reafirmación permanente de su valor. Cuando cuenta con buenos recursos, eso puede funcionar como motor para conseguir logros.',
        'Requiere confirmación permanente de lo que vale, y cuando cuenta con recursos, esa necesidad la empuja a conseguir resultados.',
      ],
    },
    dice: [
      'Necesita confirmación continua de su valor.',
      'Necesita que le confirmen su valor de manera constante.',
      'Requiere reafirmación permanente de lo que vale.',
    ],
    recomienda: [
      'El reconocimiento de él y de sus resultados funciona como motor de motivación.',
      'Reconocerlo a él y a sus resultados funciona como motor de motivación.',
      'El reconocimiento explícito de lo que logra lo impulsa.',
    ],
  },
  'an-xy-alto': {
    area: 'Cómo se ve a sí mismo',
    indice: 'An+Xy',
    corte: { op: 'mayor', valor: 3, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 1, decimales: 0 },
      dice: [
        'Aparece un indicador que muestra preocupación elevada en torno a su cuerpo.',
        'Se detecta una preocupación en torno a su cuerpo por encima de lo esperado.',
        'Se detecta una preocupación por el cuerpo por encima de lo esperado.',
      ],
    },
    dice: [
      'Está más preocupado de lo habitual por su funcionamiento corporal.',
      'Está más pendiente de lo habitual de su funcionamiento corporal.',
      'Su cuerpo le ocupa más atención de la esperada.',
    ],
    recomienda: [''],
  },
  'cop-cero-ag-bajo': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP en cero y AG hasta 1',
    zulliger: {
      dice: [
        'La ausencia de ambos indicadores suele señalar bajo interés en las relaciones interpersonales.',
        'Que no aparezca ninguno de los dos indicadores suele señalar bajo interés en las relaciones interpersonales.',
        'Que no aparezca ninguno de los dos indicadores apunta a poco interés por el vínculo con otros.',
      ],
    },
    dice: [
      'No está especialmente interesado en las situaciones interpersonales, y los demás lo pueden percibir como distante.',
      'Las situaciones interpersonales no le despiertan mayor interés, y los demás lo pueden ver como alguien distante.',
      'Muestra poco interés por el intercambio con otros, y desde afuera puede leerse como distancia.',
    ],
    recomienda: [
      'En las relaciones su alcance va a ser superficial. Si alguna situación necesita más profundidad, conviene asistirlo.',
      'Sus vínculos van a quedar en lo superficial. Si alguna situación pide más profundidad, conviene asistirlo.',
      'Cuando la tarea requiera un vínculo más comprometido, va a necesitar acompañamiento.',
    ],
  },
  'cop-bajo-ag-dos': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP hasta 1 y AG en 2',
    zulliger: {
      dice: [
        'La agresividad forma parte natural de su modo de relacionarse, y es más propensa a manifestarla.',
        'La agresividad aparece como un componente habitual de su modo de vincularse.',
        'El componente agresivo aparece con naturalidad en sus relaciones.',
      ],
    },
    dice: [
      'La agresividad es un componente natural de sus relaciones, y es más propenso a manifestar conductas de ese tipo.',
      'La agresividad forma parte natural de su modo de relacionarse, y es más propenso a manifestarla.',
      'En su manera de vincularse la agresividad está presente como un componente habitual.',
    ],
    recomienda: [''],
  },
  'cop-bajo-ag-alto': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP hasta 2 y AG más de 2',
    zulliger: {
      dice: [
        'Buena parte de su intercambio con los demás pasa por actitudes agresivas, que usa como defensa ante un ambiente que vive como hostil.',
        'Se vincula sobre todo desde la agresión, que le sirve de resguardo frente a un entorno que percibe amenazante.',
        'Su intercambio con otros está marcado por la agresión, como respuesta defensiva a un ambiente que siente en contra.',
      ],
    },
    dice: [
      'Buena parte de su actividad interpersonal está marcada por actitudes agresivas hacia los demás, como estrategia defensiva frente a un ambiente que vive como hostil.',
      'Gran parte de su actividad con los demás pasa por actitudes agresivas, que usa como defensa frente a un ambiente que vive como hostil.',
      'Se relaciona mayormente desde la agresión, que le funciona como resguardo ante un entorno que percibe amenazante.',
    ],
    recomienda: [''],
  },
  'cop-alto-ag-bajo': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP de 2 o más y AG hasta 1',
    zulliger: {
      dice: [
        'Puede ser vista habitualmente como alguien que despliega actitudes de colaboración con otros.',
        'Suele ser vista como una persona que colabora con los demás.',
        'Suele ser percibida como una persona colaboradora.',
      ],
    },
    dice: [
      'Tiende a mantener actitudes socialmente positivas y a ser percibido como alguien agradable. Entiende la actividad interpersonal como parte importante de su día y busca interacciones armoniosas.',
      'Sostiene actitudes socialmente positivas y suele resultar agradable. Le da un lugar importante a la actividad con otros y busca que los intercambios sean armoniosos.',
      'Se maneja de manera cordial y es percibido como alguien grato. El contacto con los demás ocupa un lugar central en su día y lo busca sin conflicto.',
    ],
    recomienda: [''],
  },
  'phr-mayor-que-ghr': {
    area: 'Cómo se relaciona',
    indice: 'GHR:PHR',
    cuando: 'PHR mayor que GHR',
    zulliger: {
      dice: [
        'La calidad de sus interacciones no es la esperada.',
        'Sus interacciones no alcanzan la calidad esperada.',
        'Sus intercambios con otros quedan por debajo de la calidad esperable.',
      ],
      recomienda: [
        'Darle indicaciones claras sobre lo que se espera en cuanto al estilo de vincularse, tanto dentro del equipo como en la empresa.',
        'Darle indicaciones claras sobre el estilo de vínculo que se espera, dentro del equipo y en la empresa.',
        'Explicitarle cómo se espera que se relacione con el equipo y con el resto de la empresa.',
      ],
    },
    dice: [
      'Sus herramientas interpersonales no alcanzan para generar vínculos de buena calidad: el estilo de sus intercambios no es el esperado.',
      'Sus recursos para vincularse no alcanzan para generar relaciones de buena calidad: el modo en que intercambia no es el esperado.',
      'La calidad de sus intercambios queda por debajo de lo esperable, porque las herramientas con las que se vincula no le alcanzan.',
    ],
    recomienda: [''],
  },
  'aislamiento-muy-alto': {
    area: 'Cómo se relaciona',
    indice: 'Índice de aislamiento',
    corte: { op: 'mayor', valor: 0.33, decimales: 2 },
    zulliger: {
      dice: [
        'Consigue apenas contactos significativos.',
        'Las relaciones con algún peso son muy pocas.',
        'Establece muy pocas relaciones de peso.',
      ],
      recomienda: [
        'Al asignarle una tarea nueva, tener en cuenta que va a preferir resolverla sola.',
        'Contemplar en cada asignación su inclinación a trabajar de manera independiente.',
        'Considerar en cada asignación que va a elegir el camino individual.',
      ],
    },
    dice: [
      'Logra apenas contactos significativos.',
      'Alcanza apenas contactos significativos.',
      'Los vínculos con algún grado de significación son muy escasos.',
    ],
    recomienda: [
      'Al asignarle tareas nuevas, tener presente su preferencia por resolver de manera independiente.',
      'Al darle una tarea nueva, contemplar que va a preferir resolverla por su cuenta.',
      'Tener presente, al asignarle trabajo, su inclinación a hacerlo de manera independiente.',
    ],
  },
  'aislamiento-alto': {
    area: 'Cómo se relaciona',
    indice: 'Índice de aislamiento',
    corte: { op: 'mayor', valor: 0.25, decimales: 2 },
    zulliger: {
      corte: { op: 'mayor', valor: 0.34, decimales: 2 },
      dice: [
        'Prefiere el trabajo individual. Es buen pronóstico de desempeño para quien deba trabajar sola o con pocas posibilidades de intercambio personal con otros.',
        'Prefiere trabajar de manera individual, lo que da buen pronóstico de desempeño en puestos con poco intercambio personal con otros.',
        'Se inclina al trabajo por cuenta propia, lo que la favorece en puestos con poco intercambio con otras personas.',
      ],
      recomienda: [
        'Favorecer tareas que requieran trabajo individual y autonomía.',
        'Asignarle tareas que requieran trabajo individual y autonomía.',
        'Orientarla a asignaciones que resuelva sola y con margen de decisión propio.',
      ],
    },
    dice: [
      'Está menos implicado de lo habitual en las interacciones, y puede preferir trabajar de manera independiente.',
      'Participa menos de lo habitual en el intercambio con otros y puede preferir trabajar solo.',
      'Su implicación en las relaciones es menor a la esperada, con inclinación al trabajo independiente.',
    ],
    recomienda: [
      'Conviene que la mayoría de sus tareas sean asignaciones individuales.',
      'Que el grueso de sus tareas sean asignaciones individuales.',
      'Orientar su carga hacia trabajos que pueda resolver por su cuenta.',
    ],
  },
  'per-alto': {
    area: 'Cómo se relaciona',
    indice: 'PER',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 1, decimales: 0 },
      dice: [
        'Cuando se siente cuestionada puede defenderse justificándose. También puede tener un estilo avasallante, tratando de imponer su idea.',
        'Cuando vive algo como un cuestionamiento se justifica, y puede pasar a un estilo avasallante, imponiendo su idea.',
        'Ante lo que vive como cuestionamiento se justifica, y puede pasar a imponer su punto de vista por sobre el del otro.',
      ],
      recomienda: [
        'Ser concreto en los pedidos y en las consultas, para evitar que los reciba como un cuestionamiento.',
        'Ser concreto en los pedidos y en las consultas, para que no los reciba como un cuestionamiento.',
        'Formular los pedidos con precisión, así no los lee como un reproche.',
      ],
    },
    dice: [
      'Cuando se siente cuestionado puede reaccionar a la defensiva para justificarse.',
      'Ante lo que siente como un cuestionamiento, puede ponerse a la defensiva para justificarse.',
      'Cuando cree que lo están cuestionando, responde defendiéndose y explicando.',
    ],
    recomienda: [
      'Hacerle las consultas y los pedidos de forma concreta, para que no los reciba como un cuestionamiento.',
      'Hacerle los pedidos y las consultas de manera concreta, para que no los tome como un cuestionamiento.',
      'Ser específico al pedirle o preguntarle algo, así no lo lee como un reproche.',
    ],
  },
  'fd-presente': {
    area: 'Cómo se relaciona',
    indice: 'Fd',
    corte: { op: 'mayor', valor: 0, decimales: 0 },
    zulliger: {
      dice: [
        'El indicador de dependencia está aumentado. Por un lado, cuando se compromete con la empresa se mantiene estable en sus compromisos y se subordina sin mayores conflictos. Por otro, puede necesitar a alguien cerca que supervise sus tareas y le dé seguridad.',
        'El indicador de dependencia está por encima de lo esperado. Por un lado, una vez que se compromete con la empresa sostiene sus compromisos y se subordina sin mayores conflictos. Por otro, puede necesitar a alguien cerca que supervise su tarea y le dé seguridad.',
        'Su nivel de dependencia está por encima de lo esperado. Eso le da estabilidad en el compromiso una vez que se involucra con la empresa, y a la vez la deja necesitando supervisión cercana para sentirse segura.',
      ],
      recomienda: [
        'Necesita que le muestren el camino y que la apuntalen para tomar decisiones, porque naturalmente va a quedar a la espera de indicaciones o de que otros decidan.',
        'Necesita que le muestren el camino y que la apuntalen para decidir, porque va a quedar a la espera de indicaciones.',
        'Marcarle el rumbo y sostenerla en las decisiones, ya que por sí sola espera que otro defina.',
      ],
    },
    dice: [
      'Presenta más conductas de dependencia de lo esperable: espera que los demás busquen la solución a los problemas.',
      'Muestra más conductas de dependencia de lo esperable: espera que los demás encuentren la solución.',
      'Su nivel de dependencia está por encima de lo habitual, y tiende a esperar que otro resuelva.',
    ],
    recomienda: [
      'Alentar su autonomía paso a paso. Al principio necesita un referente con quien validar sus acciones o ideas.',
      'Alentar su autonomía de a poco. Al comienzo necesita un referente con quien validar lo que hace o piensa.',
      'Darle un referente para consultar al principio, e ir corriéndolo a medida que gane confianza.',
    ],
  },
  'humanos-alto': {
    area: 'Cómo se relaciona',
    indice: 'Contenidos humanos',
    cuando: 'por encima de lo esperado para su cantidad de respuestas y su estilo',
    zulliger: {
      dice: [
        'El interés por los demás aparece de manera marcada.',
        'Las otras personas ocupan un lugar importante para ella.',
        'El interés por la gente aparece con fuerza.',
      ],
    },
    dice: [
      'Marcado interés por los demás.',
      'Muestra un interés marcado por los demás.',
      'Las otras personas le importan de manera notoria.',
    ],
    recomienda: [''],
  },
  'humanos-alto-cop': {
    area: 'Cómo se relaciona',
    indice: 'Contenidos humanos',
    cuando: 'sigue a la anterior cuando además hay COP',
    zulliger: {
      dice: [
        ' Con la disposición a cooperar presente, eso se traduce en ofrecerse a ayudar.',
        ' Como además está dispuesta a cooperar, se traduce en ofrecerse a ayudar.',
        ' Sumada la disposición a colaborar, se muestra dispuesta a dar una mano.',
      ],
    },
    dice: [
      ' Con la disposición a la cooperación presente, eso se traduce en una actitud solícita.',
      ' Con la disposición a cooperar presente, eso deriva en una actitud servicial.',
      ' Como además está dispuesto a cooperar, se traduce en ofrecerse a ayudar.',
    ],
    recomienda: [''],
  },
  'h-pura-baja': {
    area: 'Cómo se relaciona',
    indice: 'H pura',
    cuando: 'los otros contenidos humanos superan a H pura',
    zulliger: {
      dice: [
        'No evidencia interés por las demás personas.',
        'El interés por las demás personas no aparece.',
        'El interés por los otros no aparece.',
      ],
      recomienda: [
        'Delegarle asignaciones individuales, y cuando tenga que trabajar en equipo acompañarla, porque sus habilidades interpersonales se detectan disminuidas.',
        'Delegarle asignaciones individuales, y acompañarla cuando tenga que trabajar en equipo, porque sus habilidades interpersonales se detectan disminuidas.',
        'Darle trabajo individual, y sostenerla en las instancias de equipo, donde sus recursos de vínculo son escasos.',
      ],
    },
    dice: [
      'Tiene una visión poco realista de sí mismo y de los demás: le puede costar ver tanto las fortalezas como las debilidades, propias y ajenas.',
      'Su visión de sí mismo y de los demás es poco realista: le cuesta ver tanto las fortalezas como las debilidades, propias y ajenas.',
      'No logra una imagen ajustada de sí ni de los otros, y por eso se le escapan tanto los méritos como los defectos.',
    ],
    recomienda: [
      'Cuando se le marque un error, hacerlo con información concreta para que le resulte más fácil registrarlo.',
      'Al marcarle un error, apoyarse en información concreta para que le resulte más fácil registrarlo.',
      'Señalarle las fallas con datos específicos, porque de otro modo le cuesta reconocerlas.',
    ],
  },
  'd-adjd-cero': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'D y AdjD los dos en cero',
    zulliger: {
      dice: [
        'Tolera bien la tensión cotidiana. Haría falta un estrés intenso, prolongado o inesperado para que sus controles fallaran de manera significativa.',
        'Las exigencias del día a día no le desbordan el control, y solo una tensión fuerte o sostenida lo pondría en riesgo.',
        'Sostiene sin dificultad la tensión habitual, y solo una situación fuera de lo común pondría en riesgo su control.',
      ],
    },
    dice: [
      'Tolera de manera adecuada las tensiones del día a día. Solo ante un estrés intenso, prolongado o inesperado podrían fallar los controles de manera significativa.',
      'Tolera bien las tensiones cotidianas. Solo un estrés intenso, prolongado o inesperado podría hacer fallar sus controles de manera significativa.',
      'Las exigencias del día a día no le desbordan los controles. Haría falta una tensión fuerte o sostenida para que eso ocurra.',
    ],
    recomienda: [''],
  },
  'adjd-positivo': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'AdjD de 1 o más',
    zulliger: {
      dice: [
        'Su control y su tolerancia al estrés están por encima de lo común: dispone de más recursos de los esperados para manejar la tensión y responder a lo que se le pide.',
        'Cuenta con recursos de control muy por encima del promedio, que le permiten sostener tensión sin que caiga su rendimiento.',
        'Maneja la tensión con holgura: tiene más herramientas de las esperables para responder a lo que se le pide.',
      ],
    },
    dice: [
      'Tiene una capacidad de control y de tolerancia al estrés fuera de lo común: cuenta con muchos más recursos de lo esperado para manejar sus tensiones y responder a las demandas.',
      'Su capacidad de control y de tolerancia al estrés está por encima de lo común: dispone de muchos más recursos de lo esperado para manejar la tensión y responder a las demandas.',
      'Cuenta con recursos de control muy por encima del promedio, lo que le permite sostener tensión y responder sin que le afecte el rendimiento.',
    ],
    recomienda: [''],
  },
  'adjd-menos-uno': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'AdjD en −1',
    zulliger: {
      dice: [
        'Las situaciones nuevas la complican, y su mejor rendimiento aparece en entornos rutinarios y previsibles.',
        'Ante lo desconocido tiene dificultades, y funciona mejor donde las cosas son estables.',
        'Lo desconocido la complica, y su mejor rendimiento aparece en contextos previsibles.',
      ],
      recomienda: [
        'Acompañarla en los cambios y en las situaciones que de por sí generan tensión.',
        'Sostenerla cuando algo cambia y cuando la tarea es tensionante en sí misma.',
        'Estar cerca en cada cambio y en las tareas que ya traen tensión propia.',
      ],
    },
    dice: [
      'Tiene dificultades ante las situaciones nuevas, y funciona mejor en entornos rutinarios y previsibles.',
      'Las situaciones nuevas le resultan difíciles, y rinde mejor en entornos rutinarios y previsibles.',
      'Frente a lo nuevo tiene dificultades, y se desempeña mejor donde las cosas son estables y conocidas.',
    ],
    recomienda: [
      'Necesita acompañamiento ante los cambios y ante las situaciones tensionantes en sí mismas.',
      'Acompañarlo en los cambios y en las situaciones que de por sí generan tensión.',
      'Sostenerlo cuando algo cambia y cuando la tarea es tensionante en sí misma.',
    ],
  },
  'adjd-sobrecarga': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'AdjD por debajo de −1',
    zulliger: {
      dice: [
        'Los recursos con los que cuenta para afrontar situaciones tensionantes no le alcanzan para mantener el control emocional, y queda expuesta a actuar impulsivamente. Está en malas condiciones para afrontar trabajos tensionantes en sí mismos, porque al malestar interno se le suma el externo.',
        'Los recursos con los que cuenta no le alcanzan para mantener el control emocional frente a la tensión, y queda expuesta a actuar impulsivamente. Un trabajo tensionante en sí mismo le sumaría carga externa a la interna que ya tiene.',
        'No dispone de lo necesario para sostener el control cuando la situación tensiona, con riesgo de respuesta impulsiva. Ubicarla en una tarea de por sí tensionante agravaría el cuadro.',
      ],
      recomienda: [
        'Evitar asignarle tareas con alto nivel de presión sostenida y ofrecer apoyo cercano en las situaciones de mayor exigencia.',
        'No asignarle tareas con presión sostenida, y acompañarla de cerca cuando la exigencia sube.',
        'Mantenerla fuera de las posiciones de presión continua y darle apoyo cercano en los momentos exigentes.',
      ],
    },
    dice: [
      'Está en estado de sobrecarga: vive con mucha más tensión de la que puede manejar, y como resultado sus respuestas pierden eficiencia. Al ser negativo también el valor ajustado, la sobrecarga está instalada en su funcionamiento y no es solo del momento.',
      'Vive con más tensión de la que puede manejar, y por eso sus respuestas pierden eficiencia. Como el valor ajustado también da negativo, la sobrecarga es parte de su funcionamiento y no del momento.',
      'Está sobrecargado: la tensión que carga excede sus recursos y le baja la calidad de las respuestas. El valor ajustado confirma que no se trata de algo pasajero.',
    ],
    recomienda: [
      'Regular la carga y priorizar tareas, con apoyo para organizar el trabajo y generar pausas, con el fin de bajar la tensión y mejorar la calidad de sus respuestas.',
      'Bajarle la carga y ordenar prioridades, con apoyo para organizar el trabajo y generar pausas.',
      'Reducir el volumen de tareas y ayudarlo a ordenarlas, con cortes previstos, para que la tensión baje.',
    ],
  },
  'ea-bajo': {
    area: 'Cuánta exigencia sostiene',
    indice: 'EA',
    corte: { op: 'menor', valor: 7, decimales: 0 },
    zulliger: {
      corte: { op: 'menor', valor: 3, decimales: 0 },
      dice: [
        'Las herramientas para enfrentar situaciones de tensión elevada se encuentran por debajo del rango esperado: le puede costar tolerar situaciones tensas y responder adecuadamente.',
        'Sus herramientas para enfrentar tensión elevada están por debajo de lo esperado: tolerar situaciones tensas y responder bien le puede costar.',
        'Cuenta con menos recursos de los esperables para sostener situaciones de mucha tensión, y ahí su respuesta puede fallar.',
      ],
      recomienda: [
        'Acompañarla en las situaciones de tensión elevada para que pueda atravesarlas sin sentirse sobrepasada.',
        'Acompañarla en los momentos de tensión alta para que los atraviese sin quedar desbordada.',
        'Estar cerca cuando la exigencia sube, así no queda sola frente a la tensión.',
      ],
    },
    dice: [
      'Sus recursos de afrontamiento son limitados.',
      'Sus recursos para afrontar la tensión son limitados.',
      'Dispone de pocas herramientas de afrontamiento.',
    ],
    recomienda: [''],
  },
  'ea-alto': {
    area: 'Cuánta exigencia sostiene',
    indice: 'EA',
    corte: { op: 'mayor', valor: 11, decimales: 0, ademas: 'con AdjD positivo' },
    zulliger: {
      corte: { op: 'mayor', valor: 5, decimales: 0 },
      dice: [
        'Cuenta con herramientas sólidas para enfrentar situaciones de tensión elevada, suficientes para mantener el control emocional.',
        'Dispone de herramientas sólidas para sostener situaciones de tensión elevada y mantener el control emocional.',
        'Sus recursos de afrontamiento son firmes y le alcanzan para conservar el control cuando la tensión sube.',
      ],
    },
    dice: [
      'Confirma un nivel de control elevado.',
      'Su nivel de control está por encima de lo esperado.',
      'Su capacidad de control está por encima de lo esperado.',
    ],
    recomienda: [''],
  },
  'ea-adecuado': {
    area: 'Cuánta exigencia sostiene',
    indice: 'EA',
    cuando: 'entre los dos cortes de EA, con AdjD en cero',
    zulliger: {
      dice: [
        'Las herramientas para enfrentar situaciones de tensión elevada se encuentran dentro del rango esperado: puede tolerar situaciones tensas y responder adecuadamente.',
        'Sus herramientas para enfrentar tensión elevada están dentro de lo esperado: tolera situaciones tensas y responde adecuadamente.',
        'Dispone de los recursos esperables para sostener la tensión y dar una respuesta apropiada.',
      ],
    },
    dice: [
      'Confirma una capacidad de control adecuada.',
      'Su capacidad de control se ubica dentro de lo esperado.',
      'Su nivel de control se ubica dentro de lo esperado.',
    ],
    recomienda: [''],
  },
  'd-menor-que-adjd': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D contra AdjD',
    cuando: 'D por debajo de AdjD',
    zulliger: {
      dice: [
        'Aparece tensión situacional: hoy tolera menos estrés del que le es propio.',
        'Una circunstancia del momento le bajó la tolerancia al estrés por debajo de lo habitual.',
        'Algo del momento le bajó la tolerancia a la tensión respecto de lo que le es propio.',
      ],
    },
    dice: [
      'Hay tensión situacional: su tolerancia al estrés de hoy está por debajo de la habitual.',
      'Hay tensión situacional: hoy tolera menos estrés que de costumbre.',
      'Su tolerancia al estrés está por debajo de la habitual por una circunstancia del momento.',
    ],
    recomienda: [''],
  },
} satisfies Record<string, Redaccion>;

/** Hasta dónde puede crecer un texto reescrito. */
const LARGO_MAXIMO = 1200;

/**
 * Las formas de decir cada cosa que rigen para esa lectura y ese test.
 *
 * La recomendación puede ser propia del Zulliger; lo que la lectura significa
 * es lo mismo en los dos, así que el "qué dice" es uno solo.
 */
function formas(
  clave: ClaveDeTexto,
  textos: Textos,
  test: TestDeManchas
): { dice: string[]; recomienda: string[] } {
  const base = TEXTOS[clave] as Redaccion;
  const suyo = textos[clave] ?? {};
  const z = test === 'Zulliger';

  /** Lo propio del test si está escrito, y si no lo del Rorschach. */
  const cual = (
    propio: string[] | undefined,
    propioFabrica: string[] | undefined,
    comun: string[] | undefined,
    comunFabrica: string[]
  ) =>
    (z ? propio ?? propioFabrica : undefined)?.length
      ? (z ? propio ?? propioFabrica : undefined)!
      : comun?.length
        ? comun
        : comunFabrica;

  return {
    dice: cual(suyo.diceZ, base.zulliger?.dice, suyo.dice, base.dice),
    recomienda: cual(suyo.recomiendaZ, base.zulliger?.recomienda, suyo.recomienda, base.recomienda),
  };
}

/**
 * Un número estable a partir de un texto.
 *
 * Sirve para correr la elección de una lectura a otra: sin esto, un informe
 * usaría la primera forma en las sesenta y ocho y el siguiente la segunda en
 * todas, y se leerían como dos plantillas en vez de como dos informes.
 */
function huella(texto: string): number {
  let n = 0;
  for (let i = 0; i < texto.length; i++) n = (n * 31 + texto.charCodeAt(i)) % 100003;
  return n;
}

/**
 * Cuál de las formas de decirlo le toca.
 *
 * **No es al azar.** Un informe entregado no puede cambiar de texto cuando se
 * vuelve a abrir, así que la elección sale de dónde está el candidato en su
 * pedido y de qué lectura es: la misma evaluación lee siempre lo mismo, y el
 * segundo candidato de un pedido no repite los párrafos del primero.
 */
function cual(cuantas: number, clave: string, vuelta: number): number {
  if (cuantas <= 1) return 0;
  return (((vuelta + huella(clave)) % cuantas) + cuantas) % cuantas;
}

/**
 * Con qué rótulo aparece cada índice en la hoja del sumario estructural.
 *
 * La hoja está escrita en la nomenclatura de Exner y el diccionario nombra los
 * índices con la suya, así que hacen falta las dos: Lambda es "L" en la hoja,
 * y hay índices que la hoja repite en dos bloques (V y T salen en Controles y
 * vuelven en Autopercepción e Interpersonal). Los que no están acá no se
 * pintan, que es lo que corresponde a los que no tienen banda fija.
 */
const ROTULOS_DE_HOJA: Record<string, string[]> = {
  Lambda: ['L'],
  Zd: ['Zd'],
  DQv: ['DQv'],
  PSV: ['PSV'],
  'XA%': ['XA%'],
  'X−%': ['X−%'],
  'Xu%': ['Xu%'],
  Intelectualización: ['2AB+(Art+Ay)'],
  'M−': ['M−'],
  FM: ['FM'],
  m: ['m'],
  'C pura': ['C pura'],
  S: ['S'],
  "C'": ["C'"],
  SumT: ['T', 'SumT'],
  V: ['V', 'SumV'],
  Y: ['Y'],
  Ego: ['3r+(2)/R'],
  // Solo el rótulo que trae los dos: la hoja del Zulliger muestra Fr a secas, y
  // la lectura del diccionario es sobre Fr+rF, así que ahí no hay banda.
  'Fr+rF': ['Fr+rF'],
  'An+Xy': ['An+Xy'],
  'Índice de aislamiento': [
    'Aislamiento (Bt+2Cl+Ge+Ls+2Na/R)',
    'Bt+2Cl+Ge+Ls+2Na/R',
  ],
  PER: ['PER'],
  Fd: ['Fd'],
  EA: ['EA'],
};

/** Hasta dónde puede moverse un corte. Fuera de esto no es un criterio. */
const CORTE_MAXIMO = 1000;

/**
 * El corte que rige para esa lectura: el movido si lo hay, y si no el de
 * fábrica.
 *
 * Las normas de cada test son distintas, así que una lectura puede tener su
 * propio corte en Zulliger. Lo movido desde Sistema se guarda por test, con la
 * clave `zulliger:` adelante.
 */
export function corteDe(
  clave: ClaveDeTexto,
  cortes: Cortes = {},
  test: TestDeManchas = 'Rorschach'
): number {
  const t = TEXTOS[clave] as Redaccion;
  const base = (test === 'Zulliger' ? t.zulliger?.corte : undefined) ?? t.corte;
  if (!base) return NaN;
  const suyo = cortes[test === 'Zulliger' ? `zulliger:${clave}` : clave] ?? cortes[clave];
  return typeof suyo === 'number' && Number.isFinite(suyo) ? suyo : base.valor;
}

/** El número de un corte escrito como se lee en castellano. */
export function numeroDeCorte(c: Corte, valor: number): string {
  const escrito = Math.abs(valor).toFixed(c.decimales).replace('.', ',');
  return valor < 0 ? `−${escrito}` : c.op === 'mayor' && c.decimales > 0 ? `+${escrito}` : escrito;
}

/**
 * Cuándo entra esa lectura, dicho en castellano.
 *
 * Con corte se escribe con el número que rige hoy, no con el de fábrica: si
 * alguien movió Lambda a 0,35, la pantalla dice "menos de 0,35". Sin corte se
 * devuelve el castellano escrito a mano.
 */
export function cuandoDe(clave: ClaveDeTexto, cortes: Cortes = {}): string {
  const t = TEXTOS[clave] as Redaccion;
  if (!t.corte) return t.cuando ?? '';
  const lado = t.corte.op === 'menor' ? 'menos de' : 'más de';
  const cola = t.corte.ademas ? `, ${t.corte.ademas}` : '';
  return `${lado} ${numeroDeCorte(t.corte, corteDe(clave, cortes))}${cola}`;
}

/**
 * La banda esperada de cada índice de la hoja, con los cortes que rigen.
 *
 * Se arma con las mismas lecturas que escribe el informe, así que la pantalla
 * no puede pintar una cosa y el informe decir otra: el mínimo es el corte de
 * "menos de" más exigente y el máximo, el de "más de" más exigente. Un índice
 * con dos cortes por arriba (S entra a los 2 y vuelve a entrar a los 4) se
 * queda con el primero, que es donde deja de estar dentro de lo esperado.
 *
 * Devuelve la banda por rótulo de la hoja, que es con lo que la pantalla la
 * busca. Los índices que no tienen banda fija no están: un corte que depende
 * del estilo o de la cantidad de respuestas no se puede decidir mirando el
 * rótulo, así que ese indicador queda sin pintar.
 */
export type Banda = {
  indice: string;
  minimo: number | null;
  maximo: number | null;
  /** Con cuántos decimales se escribe, para decir la banda como el corte. */
  decimales: number;
};

export function bandasDeLaHoja(cortes: Cortes = {}): Record<string, Banda> {
  const porIndice = new Map<string, Banda>();
  for (const [clave, t] of Object.entries(TEXTOS as Record<string, Redaccion>)) {
    if (!t.corte || !ROTULOS_DE_HOJA[t.indice]) continue;
    const v = corteDe(clave as ClaveDeTexto, cortes);
    const b =
      porIndice.get(t.indice) ??
      ({ indice: t.indice, minimo: null, maximo: null, decimales: 0 } as Banda);
    b.decimales = Math.max(b.decimales, t.corte.decimales);
    if (t.corte.op === 'menor') b.minimo = b.minimo === null ? v : Math.max(b.minimo, v);
    else b.maximo = b.maximo === null ? v : Math.min(b.maximo, v);
    porIndice.set(t.indice, b);
  }

  const porRotulo: Record<string, Banda> = {};
  for (const [indice, banda] of porIndice) {
    for (const rotulo of ROTULOS_DE_HOJA[indice]) porRotulo[rotulo] = banda;
  }
  return porRotulo;
}

/**
 * Los cortes guardados, si sirven; null si no.
 *
 * Un corte tiene que ser de una lectura que exista y que tenga corte: mover el
 * de una lectura que se dispara contra una banda del estilo o contra otra
 * lectura no querría decir nada, y quedaría guardado sin efecto.
 */
export function cortesValidos(guardados: unknown): Cortes | null {
  if (!guardados || typeof guardados !== 'object' || Array.isArray(guardados)) return null;
  const limpios: Cortes = {};
  for (const [clave, valor] of Object.entries(guardados as Record<string, unknown>)) {
    // El corte del Zulliger va con su test adelante: las normas de cada uno son
    // distintas y una lectura puede cortar en otro número según con qué se midió.
    const suelta = clave.startsWith('zulliger:') ? clave.slice('zulliger:'.length) : clave;
    const t = (TEXTOS as Record<string, Redaccion>)[suelta];
    if (!t?.corte) return null;
    if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
    if (Math.abs(valor) > CORTE_MAXIMO) return null;
    // Se guarda con los decimales con los que se escribe: un corte con más
    // cifras que las que la pantalla muestra se dispararía contra un número
    // que nadie puede leer.
    const deFabrica =
      (clave.startsWith('zulliger:') ? t.zulliger?.corte : undefined) ?? t.corte;
    const redondeado = Number(valor.toFixed(deFabrica.decimales));
    if (redondeado !== deFabrica.valor) limpios[clave] = redondeado;
  }
  return limpios;
}

/**
 * Lo guardado, si sirve para escribir un informe; null si no.
 *
 * **Un `dice` vacío se rechaza.** La lectura entra igual en el informe, así que
 * quedaría un renglón con el índice y su valor y sin nada que diga qué
 * significa. Vaciar la recomendación sí vale: hay lecturas del diccionario que
 * no llevan ninguna, y sacarla es una decisión.
 */
/** Hasta cuántas formas de decir lo mismo se aceptan por campo. */
export const VARIANTES = 3;

/**
 * Una lista de formas de decirlo, si sirve.
 *
 * Las vacías se descartan y no cuentan: un campo sin escribir no es una
 * variante, es un campo sin escribir, y si entrara el informe saldría en blanco
 * una de cada tres veces.
 */
function lista(valor: unknown, puedeEstarVacia: boolean): string[] | null | undefined {
  if (valor === undefined) return undefined;
  if (!Array.isArray(valor)) return null;
  if (valor.length > VARIANTES) return null;
  const limpias: string[] = [];
  for (const v of valor) {
    if (typeof v !== 'string' || v.length > LARGO_MAXIMO) return null;
    const t = v.trim();
    if (t) limpias.push(t);
  }
  // Todas vacías: para el "qué dice" es un error, porque la lectura entra
  // igual en el informe y quedaría con su índice y sin nada que lo explique.
  if (limpias.length === 0) return puedeEstarVacia ? [''] : null;
  return limpias;
}

export function textosValidos(guardados: unknown): Textos | null {
  if (!guardados || typeof guardados !== 'object' || Array.isArray(guardados)) return null;
  const limpios: Textos = {};
  for (const [clave, valor] of Object.entries(guardados as Record<string, unknown>)) {
    if (!(clave in TEXTOS)) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
    const { dice, recomienda, diceZ, recomiendaZ } = valor as {
      dice?: unknown;
      recomienda?: unknown;
      diceZ?: unknown;
      recomiendaZ?: unknown;
    };

    const uno: Textos[string] = {};
    const d = lista(dice, false);
    if (d === null) return null;
    if (d) uno.dice = d;

    const r = lista(recomienda, true);
    if (r === null) return null;
    if (r) uno.recomienda = r;

    const dz = lista(diceZ, true);
    if (dz === null) return null;
    if (dz) uno.diceZ = dz;

    const rz = lista(recomiendaZ, true);
    if (rz === null) return null;
    if (rz) uno.recomiendaZ = rz;

    if (uno.dice || uno.recomienda || uno.diceZ || uno.recomiendaZ) limpios[clave] = uno;
  }
  return limpios;
}

/** Con qué se tomó y qué lugar ocupa el candidato en su pedido. */
export type Contexto = {
  test?: TestDeManchas;
  /**
   * El orden del candidato dentro de su pedido, desde cero.
   *
   * Es lo que hace que el segundo informe de un pedido no repita los párrafos
   * del primero: corre la elección de las formas de decirlo.
   */
  vuelta?: number;
};

export function leer(
  s: SumarioCrudo,
  ravenRango: string,
  textos: Textos = {},
  cortes: Cortes = {},
  contexto: Contexto = {}
): Lectura[] {
  const test = contexto.test ?? 'Rorschach';
  const vuelta = contexto.vuelta ?? 0;
  const salida: Lectura[] = [];
  /** El corte que rige para esa lectura. Ver `corteDe`. */
  const c = (clave: ClaveDeTexto) => corteDe(clave, cortes, test);
  const sumar = (clave: ClaveDeTexto, valor: string, sigue: ClaveDeTexto | null = null) => {
    const base = TEXTOS[clave] as Redaccion;
    if (test === 'Zulliger' && base.zulliger?.aplica === false) return;
    const f = formas(clave, textos, test);
    const cola = sigue
      ? (() => {
          const g = formas(sigue, textos, test);
          return g.dice[cual(g.dice.length, sigue, vuelta)] ?? '';
        })()
      : '';
    salida.push({
      clave,
      area: base.area,
      indice: base.indice,
      valor,
      dice: (f.dice[cual(f.dice.length, clave, vuelta)] ?? '') + cola,
      recomienda: f.recomienda[cual(f.recomienda.length, clave, vuelta)] ?? '',
    });
  };

  const r = n(s, 'cabecera', 'R');
  const estilo = texto(s, 'control_estres', 'estilo', 'Ambigual');
  const ravenBajo = ravenRango.startsWith('Rango IV') || ravenRango.startsWith('Rango V');

  // ── Cómo procesa la información ────────────────────────────────────────────
  const lam = n(s, 'cabecera', 'Lambda');
  if (lam < c('lambda-bajo')) {
    sumar('lambda-bajo', dec(lam));
  } else if (lam > c('lambda-alto')) {
    sumar('lambda-alto', dec(lam));
  }

  const zd = n(s, 'procesamiento', 'Zd');
  if (zd > c('zd-alto')) {
    sumar('zd-alto', conSigno(zd, 1));
  } else if (zd < c('zd-bajo')) {
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
  if (dqv > c('dqv-alto')) {
    // El diccionario marca la atribución causal como no publicable: acá va la
    // conducta observable y la recomendación, sin el porqué.
    sumar('dqv-alto', `DQv ${dqv}`);
  }

  const psv = n(s, 'procesamiento', 'PSV');
  if (psv > c('psv-alto')) {
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
  if (xa < c('xa-bajo') && wda >= WDA_ACEPTABLE) {
    sumar('xa-bajo-wda-alto', `XA ${dec(xa)} · WDA ${dec(wda)}`);
  } else if (xa < c('xa-bajo')) {
    sumar('xa-bajo', `XA ${dec(xa)}`);
  }

  const xMenos = n(s, 'calidad_formal', 'X_menos_pct');
  if (xMenos > c('x-menos-alto')) {
    sumar('x-menos-alto', `X− ${dec(xMenos)}`);
  }

  const xu = n(s, 'calidad_formal', 'Xu_pct');
  if (xu > c('xu-alto')) {
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
  if (intel > c('intelectualizacion-alta')) {
    sumar('intelectualizacion-alta', `2AB+(Art+Ay) ${intel}`);
  }

  const mMenos = n(s, 'ideacion', 'M_menos');
  if (mMenos > c('m-menos-alto')) {
    sumar('m-menos-alto', `M− ${mMenos}`);
  }

  const fm = n(s, 'determinantes', 'FM');
  if (fm < c('fm-cero')) {
    sumar('fm-cero', 'FM 0');
  } else if (fm > c('fm-alto')) {
    sumar('fm-alto', `FM ${fm}`);
  }

  const m = n(s, 'determinantes', 'm');
  if (m > c('m-alto')) {
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

  if (cpuro > c('c-pura-alta')) {
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
  if (sBlanco > c('s-muy-alto')) {
    sumar('s-muy-alto', `S ${sBlanco}`);
  } else if (sBlanco > c('s-alto')) {
    sumar('s-alto', `S ${sBlanco}`);
  }

  const cPrima = n(s, 'afectos', 'SumC_prima', n(s, 'determinantes', 'SumC_prima'));
  if (cPrima > c('c-prima-alta')) {
    sumar('c-prima-alta', `C' ${cPrima}`);
  }

  const sumt = n(s, 'interpersonal', 'SumT', n(s, 'determinantes', 'T'));
  if (sumt < c('sumt-cero')) {
    sumar('sumt-cero', 'SumT 0');
  } else if (sumt > c('sumt-alto')) {
    sumar('sumt-alto', `SumT ${sumt}`);
  }

  const sumv = n(s, 'autopercepcion', 'SumV', n(s, 'determinantes', 'V'));
  if (sumv > c('v-presente')) {
    sumar('v-presente', `V ${sumv}`);
  }

  const sumy = n(s, 'determinantes', 'SumY', n(s, 'determinantes', 'Y'));
  if (sumy > c('y-alto')) {
    sumar('y-alto', `Y ${sumy}`);
  }

  // ── Cómo se ve a sí mismo ──────────────────────────────────────────────────
  const ego = n(s, 'autopercepcion', 'Ego');
  if (ego < c('ego-bajo')) {
    sumar('ego-bajo', dec(ego));
  } else if (ego > c('ego-alto')) {
    sumar('ego-alto', dec(ego));
  }

  const reflejos = n(s, 'autopercepcion', 'Fr') + n(s, 'autopercepcion', 'rF');
  if (reflejos > c('reflejos-presentes')) {
    sumar('reflejos-presentes', `Fr+rF ${reflejos}`);
  }

  const anXy = n(s, 'autopercepcion', 'An_plus_Xy');
  if (anXy > c('an-xy-alto')) {
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
  if (ais > c('aislamiento-muy-alto')) {
    sumar('aislamiento-muy-alto', dec(ais));
  } else if (ais > c('aislamiento-alto')) {
    sumar('aislamiento-alto', dec(ais));
  }

  const per = n(s, 'interpersonal', 'PER');
  if (per > c('per-alto')) {
    sumar('per-alto', `PER ${per}`);
  }

  const fd = n(s, 'interpersonal', 'Fd');
  if (fd > c('fd-presente')) {
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
  if (ea < c('ea-bajo')) {
    sumar('ea-bajo', `EA ${dec(ea)}`);
  } else if (ea > c('ea-alto') && adjd > 0) {
    sumar('ea-alto', `EA ${dec(ea)}`);
  } else if (ea >= c('ea-bajo') && ea <= c('ea-alto') && adjd === 0) {
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
