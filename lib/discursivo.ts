/**
 * El análisis discursivo: hasta qué nivel de rol puede llegar la persona.
 *
 * Sale del modelo de Elliot Jaques, que ordena los roles por el lapso de tiempo
 * que abarca la tarea más larga que el puesto exige: cuanto más lejos tiene que
 * proyectar quien lo ocupa, más alto el nivel. Se toma sobre unos cinco minutos
 * de discurso del candidato y lo ubica la evaluadora, que es quien lo escuchó:
 * **el sistema no lo calcula**, guarda su lectura y la dibuja.
 *
 * Va solo en las baterías que lo incluyen (hoy la 3). En las demás la sección
 * no existe, ni en la ficha ni en el informe.
 *
 * Sin `server-only`: lo lee la pantalla donde se elige.
 */

export type NivelDiscursivo = (typeof NIVELES)[number]['nombre'];

/**
 * Los cuatro escalones, del más alto al más bajo.
 *
 * En ese orden porque así se dibuja la pirámide y así se lee el informe. Los
 * textos son los del documento que entrega hoy la psicóloga, y se corrigen
 * desde Configuración → Potencial: lo que se escriba ahí manda sobre esto.
 *
 * El número de estrato es el del modelo de Jaques: el 1 es la primera línea de
 * trabajo y el 4 la gerencia general.
 */
export const NIVELES = [
  {
    nombre: 'Liderazgo 2',
    estrato: 4,
    romano: 'IV',
    procesamiento: 'Paralelo',
    que: 'Gerencia General, Dirección de áreas o proyectos de alta complejidad.',
    horizonte: 'Aproximadamente entre 2 y 5 años.',
    actual:
      'Puede desenvolverse en trabajos donde hay que conducir al mismo tiempo diferentes frentes de acción relacionados entre sí. No se trata solo de elegir entre alternativas: tiene que lograr que distintos proyectos, equipos, prioridades y recursos avancen a la vez de manera coordinada. Una decisión tomada en un área puede afectar a las demás, así que necesita comprender las relaciones entre ellas, anticipar impactos y mantener el conjunto alineado con un objetivo común. La complejidad de este nivel está en integrar y sincronizar caminos de trabajo que funcionan al mismo tiempo y son interdependientes.',
    ejemplos:
      'Gerencias generales\nDirecciones de áreas\nConducción de unidades de negocio\nLiderazgo de programas o proyectos de alta complejidad\nPosiciones senior que integran equipos, proyectos y recursos\nRoles donde las decisiones de un frente impactan sobre otros',
    proyeccion:
      'El siguiente nivel de complejidad corresponde al Estrato V, que está por encima del alcance de este instrumento. Describirlo exigiría incorporar sus características dentro del marco de Organización Requerida, y por eso no se asigna de manera automática a quien queda en Liderazgo 2.',
  },
  {
    nombre: 'Liderazgo 1',
    estrato: 3,
    romano: 'III',
    procesamiento: 'Serial',
    que: 'Mando medio, Gerencia, Liderazgo de proyectos.',
    horizonte: 'Aproximadamente entre 1 y 2 años.',
    actual:
      'Puede desenvolverse en trabajos donde existen distintos caminos posibles para alcanzar un resultado y hay que evaluar cuál conviene. Frente a un problema construye alternativas, anticipa qué podría ocurrir al seguir cada una, elige un curso de acción y lo modifica cuando deja de resultar adecuado. También sostiene las necesidades de corto plazo sin perder de vista objetivos de un período más largo. La complejidad de este nivel está en que ya no hay un único camino dado de antemano: hay que construir, comparar y recorrer los caminos posibles.',
    ejemplos:
      'Posiciones de gerencia media\nResponsables de equipos o áreas\nLíderes de proyectos\nEspecialistas senior\nRoles que requieren decidir entre distintas alternativas\nPosiciones que articulan objetivos de corto y mediano plazo',
    proyeccion:
      'El siguiente nivel de complejidad implica pasar de construir y evaluar caminos alternativos uno tras otro a conducir a la vez múltiples líneas de acción que se afectan entre sí. Requiere integrar proyectos, equipos, prioridades, recursos y decisiones que evolucionan en paralelo, manteniendo la coherencia entre todas las partes.',
  },
  {
    nombre: 'Especialista',
    estrato: 2,
    romano: 'II',
    procesamiento: 'Acumulativo',
    que: 'Tareas que exigen interpretación y conocimientos específicos.',
    horizonte: 'Aproximadamente entre 3 meses y 1 año.',
    actual:
      'Puede desenvolverse en trabajos donde no alcanza con seguir un procedimiento: necesita analizar información, interpretar lo que está ocurriendo y usar sus conocimientos para decidir cómo resolver una situación. Además de responder a los problemas inmediatos, identifica señales de posibles dificultades, reúne datos relevantes, distingue qué información importa y toma medidas para prevenir o resolver. En este nivel va construyendo una comprensión de la situación a medida que acumula información y la usa para decidir cómo avanzar.',
    ejemplos:
      'Especialistas\nAnalistas\nProfesionales técnicos\nPosiciones que requieren diagnóstico y criterio profesional\nAlgunas funciones de supervisión o primera línea de conducción',
    proyeccion:
      'El siguiente nivel de complejidad requiere pasar de reunir e interpretar información a construir diferentes cursos de acción. Supone pensar alternativas, anticipar qué podría ocurrir con cada una, elegir un camino y modificarlo si las condiciones cambian.',
  },
  {
    nombre: 'Operativo',
    estrato: 1,
    romano: 'I',
    procesamiento: 'Declarativo',
    que: 'Tareas concretas a realizar de forma determinada de antemano.',
    horizonte: 'Desde tareas inmediatas hasta aproximadamente 3 meses.',
    actual:
      'Puede desenvolverse en trabajos donde el objetivo está claro y existen procedimientos, métodos o pautas conocidas para alcanzar el resultado. En el día a día resuelve las dificultades con su experiencia, los procedimientos aprendidos y el criterio práctico. Cuando aparece una situación que se sale de lo previsto y no tiene una respuesta disponible, necesita recurrir a otra persona para definir cómo continuar. En este nivel la complejidad del trabajo está sobre todo en ejecutar correctamente una tarea dentro de un marco ya definido.',
    ejemplos:
      'Ejecución de procesos establecidos\nTareas operativas, administrativas o técnicas con procedimientos conocidos\nResolución de problemas concretos del día a día\nTrabajos donde el método y los recursos están definidos de antemano',
    proyeccion:
      'El siguiente nivel de complejidad supone avanzar desde la ejecución de procedimientos definidos hacia tareas donde hay que interpretar situaciones, reunir información y decidir cómo actuar. Implica ganar autonomía para detectar problemas, identificar la información relevante y construir respuestas cuando el procedimiento conocido ya no alcanza.',
  },
] as const;

/** Los cuatro textos de un nivel, que se editan desde Configuración. */
export type TextoDeNivel = {
  /** La referencia laboral que va al lado del escalón en la pirámide. */
  que: string;
  /** Qué lapso de tiempo abarca la tarea más larga de ese nivel. */
  horizonte: string;
  /** Qué complejidad de trabajo puede abordar hoy. */
  actual: string;
  /** Dónde suele verse ese nivel, uno por renglón. */
  ejemplos: string;
  /** Qué exige el nivel siguiente. */
  proyeccion: string;
};

/** Cuánto puede medir cada texto. */
export const LARGO_MAXIMO = 2000;

/** Los campos editables, en el orden en que se muestran. */
export const CAMPOS_DE_NIVEL = [
  'que',
  'horizonte',
  'actual',
  'ejemplos',
  'proyeccion',
] as const;

/**
 * Lo guardado para los niveles, si sirve; null si no.
 *
 * Se rechaza un nivel que no exista, un campo que no sea de los cuatro, un
 * texto que no sea una cadena o que pase el largo, y dejar sin resumen a un
 * nivel: el informe lo dibuja en la pirámide y sin él queda un escalón mudo.
 */
export function nivelesValidos(
  guardados: unknown
): Record<string, Partial<TextoDeNivel>> | null {
  if (!guardados || typeof guardados !== 'object' || Array.isArray(guardados)) return null;
  const limpios: Record<string, Partial<TextoDeNivel>> = {};
  for (const [nombre, valor] of Object.entries(guardados as Record<string, unknown>)) {
    if (!esNivel(nombre)) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
    const uno: Partial<TextoDeNivel> = {};
    for (const [campo, texto] of Object.entries(valor as Record<string, unknown>)) {
      if (!(CAMPOS_DE_NIVEL as readonly string[]).includes(campo)) return null;
      if (typeof texto !== 'string' || texto.length > LARGO_MAXIMO) return null;
      const limpio = texto.trim();
      if (campo === 'que' && !limpio) return null;
      if (limpio) uno[campo as keyof TextoDeNivel] = limpio;
    }
    if (Object.keys(uno).length > 0) limpios[nombre] = uno;
  }
  return limpios;
}

/** Un nivel con lo que rige: lo escrito desde Configuración, o lo del código. */
export type NivelQueRige = TextoDeNivel & {
  nombre: NivelDiscursivo;
  estrato: number;
  romano: string;
  procesamiento: string;
};

/** Los cuatro niveles con lo que rige. */
export function nivelesQueRigen(
  movidos: Record<string, Partial<TextoDeNivel>> = {}
): NivelQueRige[] {
  return NIVELES.map((n) => ({
    nombre: n.nombre,
    estrato: n.estrato,
    romano: n.romano,
    procesamiento: n.procesamiento,
    que: movidos[n.nombre]?.que ?? n.que,
    horizonte: movidos[n.nombre]?.horizonte ?? n.horizonte,
    actual: movidos[n.nombre]?.actual ?? n.actual,
    ejemplos: movidos[n.nombre]?.ejemplos ?? n.ejemplos,
    proyeccion: movidos[n.nombre]?.proyeccion ?? n.proyeccion,
  }));
}

/**
 * De qué depende que esa capacidad llegue a aplicarse en un rol.
 *
 * El análisis estima el nivel de complejidad que la persona puede abordar hoy,
 * que no es lo mismo que el cargo que ocupa ni que su desempeño: se puede tener
 * capacidad para un nivel y no estar usándola en el puesto actual. Por eso el
 * informe pone estas tres al lado del escalón.
 */
export const CONDICIONES = [
  'Los conocimientos, las habilidades y la experiencia que el trabajo pide.',
  'La oportunidad de asumir trabajos de ese nivel de complejidad.',
  'El interés y la valoración por ese tipo de trabajo.',
];

/**
 * Qué es de Jaques y qué es nuestro.
 *
 * Los estratos, el horizonte temporal del rol y las formas de procesamiento son
 * del modelo. Las descripciones no: están escritas en lenguaje laboral para que
 * se entienda cómo se expresa cada nivel en el trabajo concreto, y decirlo es
 * lo que separa el marco teórico de nuestra adaptación.
 *
 * Va en Configuración y no en el informe: es para quien escribe, que necesita
 * saber qué puede corregir y qué no, y no para el cliente que lo recibe.
 */
export const NOTA_ADAPTACION =
  'Los estratos, el horizonte temporal del rol y las formas de procesamiento son del modelo ' +
  'de Organización Requerida de Elliott Jaques. Las descripciones no son citas del autor: ' +
  'son una adaptación al lenguaje laboral, para hacer más comprensible cómo se expresa cada ' +
  'nivel de complejidad en el trabajo concreto.';

/**
 * Por qué los ejemplos de puestos no atan un estrato a un cargo.
 *
 * Como la anterior, va en Configuración: es el criterio con el que se elige el
 * escalón, y quien lo elige es la evaluadora.
 */
export const NOTA_EJEMPLOS =
  'Son referencias orientativas y no una asociación rígida entre estrato y cargo. Un ' +
  'especialista sin gente a cargo puede hacer trabajo de alta complejidad, y la cantidad de ' +
  'personas que reportan a una posición no determina por sí sola el nivel: lo determinan la ' +
  'complejidad del trabajo y el horizonte de tiempo de su responsabilidad.';

/**
 * Por qué el capítulo dice "Proyección de desarrollo" y no capacidad futura.
 *
 * En Jaques, la capacidad potencial futura no es el estrato siguiente: es qué
 * nivel podría alcanzar la persona en un momento dado, estimando su trayectoria
 * de maduración. Eso exige un horizonte explícito y una metodología para
 * proyectar esa curva, que este instrumento no tiene. Lo que sí puede decir es
 * qué exige el nivel siguiente, y eso es lo que se informa.
 */
export const NOTA_PROYECCION =
  'Describe el siguiente nivel de complejidad. No es una capacidad potencial futura: ' +
  'afirmar eso exigiría estimar la trayectoria de maduración de la persona y un horizonte ' +
  'de tiempo explícito, que este instrumento no mide.';

/** El test, como se llama en la batería. */
export const TEST = 'Análisis discursivo (Elliot Jaques)';

export function esNivel(v: unknown): v is NivelDiscursivo {
  return typeof v === 'string' && NIVELES.some((n) => n.nombre === v);
}

/** Si a esta persona le corresponde, según lo que dice su batería. */
export function llevaDiscursivo(tests: string[] | null | undefined): boolean {
  return Boolean(tests?.includes(TEST));
}
