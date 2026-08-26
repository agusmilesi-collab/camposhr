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
      dice: ['Está excesivamente pendiente de la información que recibe, y al tomar decisiones se ve sobrepasada por los datos y puede tener dificultad para encontrar la prioridad.'],
      recomienda: ['Absorbe demasiados datos y al tomar decisiones necesita ayuda para priorizar la información.'],
    },
    dice: ['Intenta captar todo, sin discriminar entre información relevante y accesoria. No se le escapa nada, y corre el riesgo de llenarse de datos que no sirven para resolver el problema, lo que puede hacer caer su eficacia.'],
    recomienda: ['Ayudarlo a separar la información relevante de la accesoria, para que cuando tenga que resolver algo rápido pueda hacerlo sin impulsividad.'],
  },
  'lambda-alto': {
    area: 'Cómo procesa la información',
    indice: 'Lambda',
    corte: { op: 'mayor', valor: 0.8, decimales: 2 },
    zulliger: {
      dice: ['Simplifica demasiado sus percepciones y deja los afectos fuera de la lectura de las situaciones, con lo cual puede perder algún dato de información. Puede fallar la permeabilidad a las emociones y la empatía.'],
      recomienda: ['En situaciones con carga emocional, indicarle con claridad en qué aspectos debe enfocarse.'],
    },
    dice: ['Simplifica sus percepciones más de lo esperado. Con eso evita procesar emociones y que los afectos lo invadan, y puede perder algún dato importante para la tarea.'],
    recomienda: ['En situaciones con carga emocional, darle seguimiento para que no pierda datos o información importante.'],
  },
  'zd-alto': {
    area: 'Cómo procesa la información',
    indice: 'Zd',
    corte: { op: 'mayor', valor: 3, decimales: 1 },
    dice: ['Muy meticuloso en el análisis de la información: dedica más esfuerzo y energía que la mayoría a rastrear y explorar datos, por temor a equivocarse. Bajo presión externa, eso puede hacer fallar la toma de decisiones.'],
    recomienda: ['Dar indicaciones claras y concretas para ayudarlo a enfocar en lo importante, y mostrarse abierto a consultas para calmar su temor a cometer errores, sobre todo al decidir.'],
  },
  'zd-bajo': {
    area: 'Cómo procesa la información',
    indice: 'Zd',
    corte: { op: 'menor', valor: -3, decimales: 1 },
    dice: ['Examina el entorno de manera poco cuidadosa: hace un rastreo apresurado, no llega a recoger datos suficientes y decide antes de que aparezcan todos los puntos clave. Puede cometer más errores por responder antes de procesar toda la información disponible.'],
    recomienda: ['Establecer instancias de chequeo o procedimientos que incluyan revisar determinados puntos antes de avanzar o decidir, para que no le falten datos en esas decisiones.'],
  },
  'w-bajo': {
    area: 'Cómo procesa la información',
    indice: 'W',
    cuando: 'W en menos del 30 % de las localizaciones, con alguna D',
    zulliger: {
      dice: ['Tiene la visión global disminuida y absorbe los datos del entorno desde los detalles.'],
      recomienda: ['Si se necesita que obtenga una visión más global de las situaciones, guiarla dándole información de contexto.'],
    },
    dice: ['Puede necesitar ayuda para armar una visión global de las situaciones, con tendencia a centrarse en los detalles.'],
    recomienda: ['Darle información de contexto para ayudarlo a generar mayor visión de conjunto.'],
  },
  'w-alto': {
    area: 'Cómo procesa la información',
    indice: 'W',
    cuando: 'W en más del 50 % de las localizaciones',
    dice: ['Intenta abarcarlo todo y consigue tener visión global de las situaciones.'],
    recomienda: [''],
  },
  'dd-alto': {
    area: 'Cómo procesa la información',
    indice: 'Dd',
    cuando: 'Dd en más del 15 % de las localizaciones',
    zulliger: {
      dice: ['Está muy preocupada por la exactitud y tiene miedo a cometer errores, y por eso se fija en cuestiones que para otros pueden ser insignificantes. Este indicador puede mostrar falta de confianza en sí misma.'],
      recomienda: ['Ayudarla a distinguir la información relevante de la accesoria para evitar pérdida de tiempo, y a la vez destacar lo que hace bien para colaborar con su autoestima.'],
    },
    dice: ['Revisa de manera minuciosa para evitar errores, y al fijarse en aspectos poco relevantes pierde la visión de conjunto: se fija en lo que la mayoría no mira y deja de lado datos obvios.'],
    recomienda: ['Ayudarlo a priorizar los aspectos centrales de la tarea, para que no se detenga en detalles poco relevantes.'],
  },
  'dqv-alto': {
    area: 'Cómo procesa la información',
    indice: 'DQv',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: ['Aparece un indicador de impulsividad: puede resolver de manera poco reflexiva.'],
      recomienda: ['Revisar sus decisiones en conjunto, sobre todo al inicio, para ajustar el criterio y evitar las resoluciones apresuradas.'],
    },
    dice: ['Aparece un modo de resolver poco reflexivo: puede avanzar sin detenerse a elaborar.'],
    recomienda: ['Pedirle que comparta su razonamiento antes de avanzar con una decisión, para chequear criterios sobre todo al principio.'],
  },
  'psv-alto': {
    area: 'Cómo procesa la información',
    indice: 'PSV',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: ['Le puede costar cambiar de idea y sostiene su postura aun cuando le muestren otra.'],
      recomienda: ['Mostrarle datos o información concreta para ayudarla a flexibilizar sus ideas.'],
    },
    dice: ['Las preocupaciones pueden interferir en su proceso cognitivo, y eso se nota en el día a día como cierta rigidez para flexibilizarse.'],
    recomienda: ['Acompañarlo en los cambios, no dejarlo solo, y darle información y datos concretos para que logre flexibilizar.'],
  },
  'zf-bajo': {
    area: 'Cómo procesa la información',
    indice: 'Zf',
    cuando: 'menos del 30 % de R, y el Raven no dio bajo',
    dice: ['Hace pocos esfuerzos por procesar los datos, con menos iniciativa de la esperada para buscar información.'],
    recomienda: ['Definir objetivos concretos y hacer seguimiento periódico para sostener su nivel de actividad.'],
  },
  'zf-alto': {
    area: 'Cómo procesa la información',
    indice: 'Zf',
    cuando: 'más del 55 % de R',
    dice: ['Tiene una motivación elevada para procesar información, investigar y buscar datos.'],
    recomienda: [''],
  },
  'w-m-alto': {
    area: 'Cómo procesa la información',
    indice: 'W:M',
    cuando: 'W más de dos veces y media M',
    zulliger: {
      dice: ['Se pone metas más allá de sus posibilidades reales, con una actitud en exceso abarcativa. Cuando recibe una tarea nueva no toma dimensión de lo que requiere para responder en tiempo y forma, y le cuesta decir que ahora no puede.'],
      recomienda: ['Ayudarla a evaluar conscientemente sus pendientes antes de considerar sumar tareas nuevas.'],
    },
    dice: ['Tiende a comprometerse con asignaciones sin revisar antes si cuenta con los recursos para llevarlas adelante en tiempo y forma. Le cuesta decir que no puede o poner un límite.'],
    recomienda: ['Antes de asignarle una tarea nueva, ayudarlo a chequear si realmente tiene con qué responder, porque va a tender a aceptar todo.'],
  },
  'xa-bajo-wda-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'XA% / WDA%',
    cuando: 'XA% menos de 0,80 con WDA% de 0,80 o más',
    zulliger: {
      dice: ['La percepción es generalmente apropiada en las situaciones obvias y tiende a no serlo en otras circunstancias. Ahí despliega una visión diferente a la de la mayoría de las personas.'],
      recomienda: ['Dar consignas claras y hacer chequeos breves de interpretación en las situaciones ambiguas, para alinear criterios antes de que decida o avance.'],
    },
    dice: ['Su percepción es apropiada en las situaciones obvias, y puede no serlo en otras circunstancias.'],
    recomienda: ['En situaciones complejas, ayudarlo a validar su interpretación antes de avanzar.'],
  },
  'xa-bajo': {
    area: 'Cómo interpreta lo que ve',
    indice: 'XA%',
    corte: { op: 'menor', valor: 0.8, decimales: 2 },
    zulliger: {
      dice: ['Le puede costar percibir las situaciones como las percibe la mayoría, de modo que su interpretación de una consigna puede no coincidir con lo que se le pidió.'],
      recomienda: ['Asegurarse de que haya interpretado correctamente las consignas y las prioridades antes de iniciar una tarea, por ejemplo pidiéndole que repita qué entendió.'],
    },
    dice: ['Es poco convencional en sus percepciones: en buena parte de las ocasiones no va a ver las cosas como las ve la mayoría, sino de un modo más personal.'],
    recomienda: ['Chequear que el mensaje que se le quiere transmitir se entienda, por ejemplo preguntándole qué entendió de lo que se le pidió.'],
  },
  'x-menos-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'X−%',
    corte: { op: 'mayor', valor: 0.25, decimales: 2 },
    zulliger: {
      dice: ['Se aparta de lo convencional en un grado que puede traer signos de desadaptación en el ambiente laboral: resulta difícil de entender y aparecen dificultades claras en la comunicación.'],
      recomienda: ['Pedirle que explicite sus ideas para asegurar que el mensaje sea comprendido.'],
    },
    dice: ['Aparece un apartamiento de lo convencional que puede aumentar el comportamiento desajustado frente a lo que la situación exige, y con eso las dificultades de comunicación con el entorno.'],
    recomienda: ['Conviene considerar si lo que el puesto necesita se sostiene con este nivel de interpretación de los datos, porque puede traer roce con otros y caída de productividad.'],
  },
  'xu-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'Xu%',
    corte: { op: 'mayor', valor: 0.2, decimales: 2 },
    zulliger: {
      corte: { op: 'mayor', valor: 0.33, decimales: 2 },
      dice: ['Puede tener visiones más originales que la mayoría de las personas.'],
      recomienda: ['Si necesita ajustarse a lo pautado, pedirle que se centre en datos e información concreta.'],
    },
    dice: ['Marcada tendencia a ver las cosas desde su propio punto de vista, con reticencia a sumarse a visiones más convencionales. Si el entorno no lo presiona a ajustarse, no es relevante; si hay exigencia fuerte de ajustarse a lo ya definido, el riesgo de conflicto sube.'],
    recomienda: ['Marcarle qué cosas se hacen de una manera establecida y sin modificaciones por más que las vea distinto, y dónde sí puede poner su impronta.'],
  },
  'p-bajo': {
    area: 'Cómo interpreta lo que ve',
    indice: 'P',
    cuando: 'menos de lo esperado para la cantidad de respuestas',
    zulliger: {
      dice: ['No ve las cosas como la mayoría. Podría tener dificultad de adaptación si su tarea implica atenerse a lo que ya está pautado, y podría funcionar bien en tareas donde se privilegie la capacidad creativa.'],
      recomienda: ['Si se requiere que siga lo pautado, ayudarla a ver las situaciones a través de información concreta y de datos.'],
    },
    dice: ['Tiene una mirada de las situaciones distinta a la de la mayoría de su entorno. Es alguien singular que, sin violar la realidad, prefiere manejarla de forma menos convencional.'],
    recomienda: ['Marcarle qué cosas se necesitan hacer de una manera determinada, y dónde puede ser original.'],
  },
  'p-alto': {
    area: 'Cómo interpreta lo que ve',
    indice: 'P',
    cuando: 'más de lo esperado para la cantidad de respuestas',
    zulliger: {
      dice: ['Se esfuerza por cumplir con las expectativas que piensa que los demás tienen sobre ella. Es buen indicador para tareas rutinarias y para funcionar apegada a lo convencional.'],
    },
    dice: ['Se esfuerza por satisfacer las expectativas que cree que los demás tienen sobre él.'],
    recomienda: ['Ayudarlo a clarificar expectativas reales y criterios de desempeño, para que no opere desde supuestos sino desde acuerdos concretos.'],
  },
  'eb-introversivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'EB',
    cuando: 'estilo introversivo',
    zulliger: {
      dice: ['Prefiere usar el pensamiento para resolver los problemas y mantiene sus emociones en segundo plano. Puede sentirse más cómoda en tareas donde no necesite interactuar con otros, y puede parecer seria o retraída. Sostiene un buen nivel de concentración durante períodos largos y piensa antes de actuar. Puede preferir la comunicación escrita a la hablada.'],
    },
    dice: ['Prefiere la reflexión para resolver problemas: espera a considerar todas las alternativas antes de decidir, no procesa emoción mientras busca soluciones, y se apoya fuerte en su propia evaluación interna para elaborar juicios.'],
    recomienda: [''],
  },
  'eb-extratensivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'EB',
    cuando: 'estilo extratensivo',
    zulliger: {
      dice: ['Usa el ensayo y el error para resolver los problemas. Puede ser más emocional e incluir sus afectos al hacer evaluaciones. Prefiere tareas con interacción con otros, le gusta el cambio y la acción, y prefiere resolver de manera rápida.'],
    },
    dice: ['Mezcla los sentimientos con sus decisiones. El contacto con los demás y el procesamiento de la emoción son prioritarios, y el control de esas descargas queda en segundo plano. Usa el ensayo y el error.'],
    recomienda: ['Al decidir o resolver un problema, acompañarlo para que distinga la carga emocional que le provoca la situación, y con ese registro llegue a resoluciones mejores.'],
  },
  'eb-ambigual': {
    area: 'Cómo decide y cómo piensa',
    indice: 'EB',
    cuando: 'estilo ambigual',
    zulliger: {
      dice: ['Su estilo para resolver problemas o tomar decisiones no está definido: a veces logra dejar las emociones de lado y en otras circunstancias involucra sus afectos en la decisión. Eso la vuelve poco previsible.'],
    },
    dice: ['A veces resuelve dejando de lado la emoción y centrándose en las ideas, y otras veces sus afectos influyen en la evaluación. Al no tener un estilo definido, la decisión le puede llevar más tiempo y resultar menos previsible.'],
    recomienda: [''],
  },
  'a-p-pasivo-cuadruple': {
    area: 'Cómo decide y cómo piensa',
    indice: 'a:p',
    cuando: 'p cuatro veces a o más',
    dice: ['Tiende a aferrarse a sus pensamientos, le cuesta cambiar de punto de vista y aprender pautas nuevas de funcionamiento.'],
    recomienda: ['Promover la revisión de sus ideas y la incorporación de otras miradas antes de definir acciones.'],
  },
  'a-p-pasivo-triple': {
    area: 'Cómo decide y cómo piensa',
    indice: 'a:p',
    cuando: 'p tres veces a o más',
    zulliger: {
      dice: ['Sus ideas son excesivamente rígidas: va a ser muy difícil alterar tanto sus opiniones como sus actitudes.'],
      recomienda: ['Si se requiere que siga lo pautado, ayudarla a ver las situaciones a través de información concreta y de datos.'],
    },
    dice: ['Tiende a oponerse a los cambios: le cuesta bastante cambiar de punto de vista y aprender pautas nuevas.'],
    recomienda: ['Mostrarle información concreta con datos para ayudarlo a ver otro punto de vista.'],
  },
  'a-p-pasivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'a:p',
    cuando: 'p mayor que a más uno',
    zulliger: {
      dice: ['Aparece una tendencia a adoptar un rol pasivo.'],
      recomienda: ['Asignarle responsabilidades claras para favorecer la toma de iniciativa.'],
    },
    dice: ['Tiende a adoptar un papel pasivo en sus relaciones: puede quedar como receptor de las acciones de los demás y esperar que otros le resuelvan los problemas.'],
    recomienda: ['Diseñar un camino de aprendizaje por etapas, para ir generando autonomía paso a paso.'],
  },
  'ma-mp-pasivo-fuerte': {
    area: 'Cómo decide y cómo piensa',
    indice: 'Ma:Mp',
    cuando: 'Mp mayor que Ma más uno',
    zulliger: {
      dice: ['Suele esperar que otros le indiquen lo que tiene que hacer, y usa sus recursos para evitar enfrentar los problemas.'],
      recomienda: ['Asignarle responsabilidades claras para favorecer la toma de iniciativa.'],
    },
    dice: ['Evita la responsabilidad y la toma de decisiones, y recurre a la fantasía para negar los aspectos incómodos de la realidad. Eso conlleva cierta dependencia de que otros resuelvan.'],
    recomienda: ['Darle lineamientos claros y promover que asuma de a poco la responsabilidad sobre sus decisiones, evitando resolver por él lo que puede abordar solo.'],
  },
  'ma-mp-pasivo': {
    area: 'Cómo decide y cómo piensa',
    indice: 'Ma:Mp',
    cuando: 'Mp mayor que Ma',
    dice: ['Tiende a refugiarse en la imaginación para compensar frustraciones. Usado de manera creativa suma; usado para evitar dificultades, reemplaza la búsqueda de soluciones, y se acentúa bajo estrés.'],
    recomienda: ['Ayudarlo a enfocar las situaciones en acciones concretas, sobre todo en los momentos de mayor exigencia.'],
  },
  'intelectualizacion-alta': {
    area: 'Cómo decide y cómo piensa',
    indice: 'Intelectualización',
    corte: { op: 'mayor', valor: 5, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 1, decimales: 0 },
      dice: ['Procesa las emociones como si fueran pensamientos. En el desempeño laboral concreto, puede tener dificultades para mantener la estabilidad emocional cuando se incrementan las tensiones, internas o externas.'],
      recomienda: ['Ayudarla a distinguir entre lo que siente y lo que piensa en las situaciones de tensión, para que pueda responder con mayor claridad y estabilidad emocional.'],
    },
    dice: ['Procesa las emociones como si fueran pensamientos. Con eso neutraliza su efecto, y a la vez tiende a distorsionar las situaciones, con lo cual las soluciones pierden eficacia. Se vuelve más vulnerable cuando la situación sube de intensidad.'],
    recomienda: ['Ayudarlo con el registro de sus emociones, y darle lugar para procesarlas y encontrar respuestas más eficientes.'],
  },
  'm-menos-alto': {
    area: 'Cómo decide y cómo piensa',
    indice: 'M−',
    corte: { op: 'mayor', valor: 1, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: ['Aparece un indicador poco frecuente en evaluaciones laborales, que puede señalar alguna dificultad en la comunicación.'],
      recomienda: ['Hacer chequeos breves de comprensión para asegurar que el mensaje haya sido entendido correctamente.'],
    },
    dice: ['Aparece cierta probabilidad de dificultades en la calidad de sus ideas.'],
    recomienda: [''],
  },
  'fm-cero': {
    area: 'Cómo decide y cómo piensa',
    indice: 'FM',
    corte: { op: 'menor', valor: 1, decimales: 0 },
    dice: ['Se le dificulta tomar registro de sus propias necesidades.'],
    recomienda: ['Puede necesitar ayuda externa para empezar a registrarlas. Un entorno donde se le permita darse prioridad ayuda.'],
  },
  'fm-alto': {
    area: 'Cómo decide y cómo piensa',
    indice: 'FM',
    corte: { op: 'mayor', valor: 5, decimales: 0 },
    dice: ['Está con el malestar interno elevado por sus propias necesidades, y eso se manifiesta como tensión: puede afectar la atención, la concentración y el sueño.'],
    recomienda: ['Ayudarlo a ordenar prioridades cuando se incrementa la carga de trabajo.'],
  },
  'm-alto': {
    area: 'Cómo decide y cómo piensa',
    indice: 'm',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    dice: ['Hay circunstancias externas que le están causando molestias importantes: está atravesando una situación estresante.'],
    recomienda: ['Generar un espacio de charla para consultarle si necesita algo de la empresa o de su jefe para trabajar más tranquilo.'],
  },
  'fc-control-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'FC:CF+C',
    cuando: 'sin descarga, o FC más del triple de CF+C',
    dice: ['Controla sus descargas más de lo esperado: casi nunca se relaja cuando maneja emociones, porque desconfía de cualquier expresión abierta del afecto. Le cuesta expresar lo que siente con libertad.'],
    recomienda: [''],
  },
  'fc-descarga-intensa': {
    area: 'Cómo maneja lo que siente',
    indice: 'FC:CF+C',
    cuando: 'CF+C supera a FC por más de 2',
    dice: ['Tiende a expresarse de manera intensa, y eso da impresión de impulsividad por la dificultad de control emocional.'],
    recomienda: [''],
  },
  'fc-descarga': {
    area: 'Cómo maneja lo que siente',
    indice: 'FC:CF+C',
    cuando: 'CF+C supera a FC por uno o dos',
    zulliger: {
      dice: ['Puede tratarse de una persona frontal, capaz de mostrarse tal como es, sin filtros.'],
      recomienda: ['Desde el inicio, marcarle los límites que se esperan, por ejemplo en el manejo de información o en el contacto con clientes.'],
    },
    dice: ['Expresa sus afectos sin filtro, de manera más espontánea que el adulto medio. No se esfuerza por controlar sus emociones en el mismo grado que la mayoría, sin que eso implique un problema serio de control.'],
    recomienda: ['Mostrarle, sobre todo al principio, los filtros que se esperan y qué información se mantiene reservada.'],
  },
  'c-pura-alta': {
    area: 'Cómo maneja lo que siente',
    indice: 'C pura',
    corte: { op: 'mayor', valor: 1, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: ['Disfruta cuando está involucrada en situaciones vertiginosas y de cambio. Es más proclive que el resto a desplegar conductas poco reflexivas.'],
      recomienda: ['En las situaciones de cambio rápido, ayudarla a detenerse y evaluar la información relevante antes de decidir o avanzar.'],
    },
    dice: ['Disfruta de las situaciones vertiginosas, y en ellas es más propenso a desplegar conductas poco reflexivas.'],
    recomienda: ['Mostrarle los límites que se esperan incluso en las situaciones más caóticas.'],
  },
  'afr-bajo': {
    area: 'Cómo maneja lo que siente',
    indice: 'Afr',
    cuando: 'por debajo de la banda de su estilo',
    dice: ['Prefiere no verse implicado en situaciones con carga emocional. Esa misma tendencia neutraliza los problemas de descontrol, si los hubiera.'],
    recomienda: [''],
  },
  'afr-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'Afr',
    cuando: 'por encima de la banda de su estilo',
    dice: ['Las situaciones con carga emocional lo estimulan, y puede sentirse más productivo en ellas.'],
    recomienda: [''],
  },
  's-muy-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'S',
    corte: { op: 'mayor', valor: 4, decimales: 0 },
    dice: ['Actitud de oposición hacia el entorno, difícil de modificar.'],
    recomienda: ['Para que pueda flexibilizarla, evitar la confrontación directa y marcar límites claros y consistentes.'],
  },
  's-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'S',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 3, decimales: 0 },
      dice: ['Se detecta un monto de irritación y de enojo mayor que lo convencional.'],
      recomienda: ['Ayudarla a detectar ese enojo y a elegir acciones que la lleven a un estado emocional superador.'],
    },
    dice: ['Le cuesta cambiar de opinión.'],
    recomienda: ['Ayudarlo a ver los otros puntos de vista mostrándole información concreta.'],
  },
  'c-prima-alta': {
    area: 'Cómo maneja lo que siente',
    indice: "C'",
    corte: { op: 'mayor', valor: 4, decimales: 0 },
    zulliger: {
      dice: ['Al no hacer las descargas ni los intercambios emocionales esperados, aumenta su tensión interna y se favorece la derivación de esa tensión al cuerpo.'],
      recomienda: ['Darle espacios donde pueda abrirse emocionalmente y se sienta apoyada y escuchada.'],
    },
    dice: ['Está conteniendo una irritación interna fuerte, que puede tardar bastante en bajar.'],
    recomienda: ['Generar un espacio de conversación donde se le consulte si necesita algo de la empresa o de su jefe para trabajar más tranquilo.'],
  },
  'sumt-cero': {
    area: 'Cómo maneja lo que siente',
    indice: 'SumT',
    corte: { op: 'menor', valor: 1, decimales: 0 },
    // En Zulliger T=0 es la norma y no se informa.
    zulliger: { aplica: false },
    dice: ['Es distante en el contacto con los demás: no se siente cómodo en las situaciones de cercanía emocional y tiende a evitarlas. Cuida mantener una distancia de seguridad.'],
    recomienda: ['Ver cuánta cercanía emocional pide el puesto. Conviene no forzarla y respetar la distancia que prefiere, dejando una vía por la cual pueda pedir apoyo cuando lo necesite.'],
  },
  'sumt-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'SumT',
    corte: { op: 'mayor', valor: 1, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 0, decimales: 0 },
      dice: ['Tiene necesidad de cercanía con los demás. Se adapta mejor a estilos de conducción cercanos y a entornos donde se la aliente y reciba reconocimiento explícito por su desempeño.'],
      recomienda: ['Que su líder sostenga cercanía y la aliente en su desempeño.'],
    },
    dice: ['Necesita más cercanía y contacto que lo habitual: tiende a sentirse más solo y a depender de la presencia afectiva de otros.'],
    recomienda: ['Adoptar un estilo de conducción cercano, que le dé contención.'],
  },
  'v-presente': {
    area: 'Cómo maneja lo que siente',
    indice: 'V',
    corte: { op: 'mayor', valor: 0, decimales: 0 },
    zulliger: {
      dice: ['Cuando se autoevalúa lo hace de manera severa y negativa. Es autoexigente, tiene poca confianza en sí misma y duda de sus posibilidades reales de llevar a cabo una tarea a la que no está habituada.'],
      recomienda: ['Regular la exigencia externa, porque de manera interna ya se exige a sí misma.'],
    },
    dice: ['Cuando se autoevalúa lo hace de manera severa: pocas veces está conforme con su propio desempeño, y se exige mucho.'],
    recomienda: ['Evitar sumarle exigencia externa, porque ya se exige por dentro.'],
  },
  'y-alto': {
    area: 'Cómo maneja lo que siente',
    indice: 'Y',
    corte: { op: 'mayor', valor: 1, decimales: 0 },
    dice: ['Está atravesando una situación que le genera tensión y frente a la cual se siente inundado. Buena parte de ese malestar es reactivo y va a ceder si se resuelven las circunstancias que lo provocan.'],
    recomienda: [''],
  },
  'ego-bajo': {
    area: 'Cómo se ve a sí mismo',
    indice: 'Ego',
    corte: { op: 'menor', valor: 0.33, decimales: 2 },
    zulliger: {
      dice: ['Presenta cierta dificultad para tomarse a sí misma como centro de interés, y puede aparecer una tendencia al decaimiento anímico por falta de autoestima. Es desfavorable en puestos con tareas de riesgo, como vigilancia, conducción o manipulación de materiales peligrosos, porque al no cuidarse queda más expuesta.'],
      recomienda: ['Dar reconocimiento a sus logros para ayudarla a cultivar su autoestima, y si el puesto lo requiere, extremar las medidas de seguridad.'],
    },
    dice: ['No se toma a sí mismo como foco de atención en el grado suficiente: tiene una imagen desvalorizada de sí y no confía en sus recursos, con lo cual se puede dejar influenciar por los demás.'],
    recomienda: ['Alentar y reconocer su desempeño, para fomentar su autoestima.'],
  },
  'ego-alto': {
    area: 'Cómo se ve a sí mismo',
    indice: 'Ego',
    corte: { op: 'mayor', valor: 0.55, decimales: 2 },
    zulliger: {
      corte: { op: 'mayor', valor: 0.56, decimales: 2 },
      dice: ['Tiende a tomarse como centro exclusivo de sus preocupaciones y privilegia su punto de vista al punto de arrasar con los argumentos del interlocutor. Le cuesta entender a otros, negociar y adaptarse a quien tiene enfrente.'],
      recomienda: ['Requiere asistencia para negociar y para ser empática. Le puede servir ver datos concretos sobre los puntos de vista distintos del propio para flexibilizarse.'],
    },
    dice: ['Tiende a centrarse en sí mismo más de lo habitual, dando prioridad a su punto de vista, con dificultad para mirar las cosas desde otra óptica y ponerse en el lugar del otro.'],
    recomienda: ['En instancias de negociación puede necesitar asistencia: mostrarle datos que lo ayuden a considerar una visión distinta de la suya.'],
  },
  'reflejos-presentes': {
    area: 'Cómo se ve a sí mismo',
    indice: 'Fr+rF',
    corte: { op: 'mayor', valor: 0, decimales: 0 },
    zulliger: {
      dice: ['Necesita que le reafirmen su valor constantemente. Con buenos recursos, eso puede funcionar como motor para conseguir logros.'],
    },
    dice: ['Necesita confirmación continua de su valor.'],
    recomienda: ['El reconocimiento de él y de sus resultados funciona como motor de motivación.'],
  },
  'an-xy-alto': {
    area: 'Cómo se ve a sí mismo',
    indice: 'An+Xy',
    corte: { op: 'mayor', valor: 3, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 1, decimales: 0 },
      dice: ['Aparece un indicador que muestra preocupación elevada en torno a su cuerpo.'],
    },
    dice: ['Está más preocupado de lo habitual por su funcionamiento corporal.'],
    recomienda: [''],
  },
  'cop-cero-ag-bajo': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP en cero y AG hasta 1',
    zulliger: {
      dice: ['La ausencia de ambos indicadores suele señalar bajo interés en las relaciones interpersonales.'],
    },
    dice: ['No está especialmente interesado en las situaciones interpersonales, y los demás lo pueden percibir como distante.'],
    recomienda: ['En las relaciones su alcance va a ser superficial. Si alguna situación necesita más profundidad, conviene asistirlo.'],
  },
  'cop-bajo-ag-dos': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP hasta 1 y AG en 2',
    dice: ['La agresividad es un componente natural de sus relaciones, y es más propenso a manifestar conductas de ese tipo.'],
    recomienda: [''],
  },
  'cop-bajo-ag-alto': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP hasta 2 y AG más de 2',
    dice: ['Buena parte de su actividad interpersonal está marcada por actitudes agresivas hacia los demás, como estrategia defensiva frente a un ambiente que vive como hostil.'],
    recomienda: [''],
  },
  'cop-alto-ag-bajo': {
    area: 'Cómo se relaciona',
    indice: 'COP / AG',
    cuando: 'COP de 2 o más y AG hasta 1',
    zulliger: {
      dice: ['Puede ser vista habitualmente como alguien que despliega actitudes de colaboración con otros.'],
    },
    dice: ['Tiende a mantener actitudes socialmente positivas y a ser percibido como alguien agradable. Entiende la actividad interpersonal como parte importante de su día y busca interacciones armoniosas.'],
    recomienda: [''],
  },
  'phr-mayor-que-ghr': {
    area: 'Cómo se relaciona',
    indice: 'GHR:PHR',
    cuando: 'PHR mayor que GHR',
    zulliger: {
      dice: ['La calidad de sus interacciones no es la esperada.'],
      recomienda: ['Darle indicaciones claras sobre lo que se espera en cuanto al estilo de vincularse, tanto dentro del equipo como en la empresa.'],
    },
    dice: ['Sus herramientas interpersonales no alcanzan para generar vínculos de buena calidad: el estilo de sus intercambios no es el esperado.'],
    recomienda: [''],
  },
  'aislamiento-muy-alto': {
    area: 'Cómo se relaciona',
    indice: 'Índice de aislamiento',
    corte: { op: 'mayor', valor: 0.33, decimales: 2 },
    dice: ['Logra apenas contactos significativos.'],
    recomienda: ['Al asignarle tareas nuevas, tener presente su preferencia por resolver de manera independiente.'],
  },
  'aislamiento-alto': {
    area: 'Cómo se relaciona',
    indice: 'Índice de aislamiento',
    corte: { op: 'mayor', valor: 0.25, decimales: 2 },
    zulliger: {
      corte: { op: 'mayor', valor: 0.34, decimales: 2 },
      dice: ['Prefiere el trabajo individual. Es buen pronóstico de desempeño para quien deba trabajar sola o con pocas posibilidades de intercambio personal con otros.'],
      recomienda: ['Favorecer tareas que requieran trabajo individual y autonomía.'],
    },
    dice: ['Está menos implicado de lo habitual en las interacciones, y puede preferir trabajar de manera independiente.'],
    recomienda: ['Conviene que la mayoría de sus tareas sean asignaciones individuales.'],
  },
  'per-alto': {
    area: 'Cómo se relaciona',
    indice: 'PER',
    corte: { op: 'mayor', valor: 2, decimales: 0 },
    zulliger: {
      corte: { op: 'mayor', valor: 1, decimales: 0 },
      dice: ['Cuando se siente cuestionada puede defenderse justificándose. También puede tener un estilo avasallante, tratando de imponer su idea.'],
      recomienda: ['Ser concreto en los pedidos y en las consultas, para evitar que los reciba como un cuestionamiento.'],
    },
    dice: ['Cuando se siente cuestionado puede reaccionar a la defensiva para justificarse.'],
    recomienda: ['Hacerle las consultas y los pedidos de forma concreta, para que no los reciba como un cuestionamiento.'],
  },
  'fd-presente': {
    area: 'Cómo se relaciona',
    indice: 'Fd',
    corte: { op: 'mayor', valor: 0, decimales: 0 },
    zulliger: {
      dice: ['El indicador de dependencia está aumentado. Por un lado, cuando se compromete con la empresa se mantiene estable en sus compromisos y se subordina sin mayores conflictos. Por otro, puede necesitar a alguien cerca que supervise sus tareas y le dé seguridad.'],
      recomienda: ['Necesita que le muestren el camino y que la apuntalen para tomar decisiones, porque naturalmente va a quedar a la espera de indicaciones o de que otros decidan.'],
    },
    dice: ['Presenta más conductas de dependencia de lo esperable: espera que los demás busquen la solución a los problemas.'],
    recomienda: ['Alentar su autonomía paso a paso. Al principio necesita un referente con quien validar sus acciones o ideas.'],
  },
  'humanos-alto': {
    area: 'Cómo se relaciona',
    indice: 'Contenidos humanos',
    cuando: 'por encima de lo esperado para su cantidad de respuestas y su estilo',
    dice: ['Marcado interés por los demás.'],
    recomienda: [''],
  },
  'humanos-alto-cop': {
    area: 'Cómo se relaciona',
    indice: 'Contenidos humanos',
    cuando: 'sigue a la anterior cuando además hay COP',
    dice: [' Con la disposición a la cooperación presente, eso se traduce en una actitud solícita.'],
    recomienda: [''],
  },
  'h-pura-baja': {
    area: 'Cómo se relaciona',
    indice: 'H pura',
    cuando: 'los otros contenidos humanos superan a H pura',
    zulliger: {
      dice: ['No evidencia interés por las demás personas.'],
      recomienda: ['Delegarle asignaciones individuales, y cuando tenga que trabajar en equipo acompañarla, porque sus habilidades interpersonales se detectan disminuidas.'],
    },
    dice: ['Tiene una visión poco realista de sí mismo y de los demás: le puede costar ver tanto las fortalezas como las debilidades, propias y ajenas.'],
    recomienda: ['Cuando se le marque un error, hacerlo con información concreta para que le resulte más fácil registrarlo.'],
  },
  'd-adjd-cero': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'D y AdjD los dos en cero',
    dice: ['Tolera de manera adecuada las tensiones del día a día. Solo ante un estrés intenso, prolongado o inesperado podrían fallar los controles de manera significativa.'],
    recomienda: [''],
  },
  'adjd-positivo': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'AdjD de 1 o más',
    dice: ['Tiene una capacidad de control y de tolerancia al estrés fuera de lo común: cuenta con muchos más recursos de lo esperado para manejar sus tensiones y responder a las demandas.'],
    recomienda: [''],
  },
  'adjd-menos-uno': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'AdjD en −1',
    dice: ['Tiene dificultades ante las situaciones nuevas, y funciona mejor en entornos rutinarios y previsibles.'],
    recomienda: ['Necesita acompañamiento ante los cambios y ante las situaciones tensionantes en sí mismas.'],
  },
  'adjd-sobrecarga': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D / AdjD',
    cuando: 'AdjD por debajo de −1',
    zulliger: {
      dice: ['Los recursos con los que cuenta para afrontar situaciones tensionantes no le alcanzan para mantener el control emocional, y queda expuesta a actuar impulsivamente. Está en malas condiciones para afrontar trabajos tensionantes en sí mismos, porque al malestar interno se le suma el externo.'],
      recomienda: ['Evitar asignarle tareas con alto nivel de presión sostenida y ofrecer apoyo cercano en las situaciones de mayor exigencia.'],
    },
    dice: ['Está en estado de sobrecarga: vive con mucha más tensión de la que puede manejar, y como resultado sus respuestas pierden eficiencia. Al ser negativo también el valor ajustado, la sobrecarga está instalada en su funcionamiento y no es solo del momento.'],
    recomienda: ['Regular la carga y priorizar tareas, con apoyo para organizar el trabajo y generar pausas, con el fin de bajar la tensión y mejorar la calidad de sus respuestas.'],
  },
  'ea-bajo': {
    area: 'Cuánta exigencia sostiene',
    indice: 'EA',
    corte: { op: 'menor', valor: 7, decimales: 0 },
    zulliger: {
      corte: { op: 'menor', valor: 3, decimales: 0 },
      dice: ['Las herramientas para enfrentar situaciones de tensión elevada se encuentran por debajo del rango esperado: le puede costar tolerar situaciones tensas y responder adecuadamente.'],
      recomienda: ['Acompañarla en las situaciones de tensión elevada para que pueda atravesarlas sin sentirse sobrepasada.'],
    },
    dice: ['Sus recursos de afrontamiento son limitados.'],
    recomienda: [''],
  },
  'ea-alto': {
    area: 'Cuánta exigencia sostiene',
    indice: 'EA',
    corte: { op: 'mayor', valor: 11, decimales: 0, ademas: 'con AdjD positivo' },
    zulliger: {
      corte: { op: 'mayor', valor: 5, decimales: 0 },
      dice: ['Cuenta con herramientas sólidas para enfrentar situaciones de tensión elevada, suficientes para mantener el control emocional.'],
    },
    dice: ['Confirma un nivel de control elevado.'],
    recomienda: [''],
  },
  'ea-adecuado': {
    area: 'Cuánta exigencia sostiene',
    indice: 'EA',
    cuando: 'entre los dos cortes de EA, con AdjD en cero',
    zulliger: {
      dice: ['Las herramientas para enfrentar situaciones de tensión elevada se encuentran dentro del rango esperado: puede tolerar situaciones tensas y responder adecuadamente.'],
    },
    dice: ['Confirma una capacidad de control adecuada.'],
    recomienda: [''],
  },
  'd-menor-que-adjd': {
    area: 'Cuánta exigencia sostiene',
    indice: 'D contra AdjD',
    cuando: 'D por debajo de AdjD',
    dice: ['Hay tensión situacional: su tolerancia al estrés de hoy está por debajo de la habitual.'],
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
