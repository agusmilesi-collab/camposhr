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
    que: 'Estrato IV · procesamiento paralelo · de 2 a 5 años',
    horizonte: 'Aproximadamente entre 2 y 5 años.',
    actual:
      'Puede integrar diferentes líneas de trabajo que avanzan simultáneamente y se afectan entre sí. Es capaz de coordinar proyectos, recursos y decisiones interdependientes, manteniendo su sincronización y ajustando cada componente en función del conjunto. En este nivel ya no alcanza con construir caminos alternativos de manera secuencial: es necesario sostener a la vez múltiples procesos, proyectos o líneas de acción, comprendiendo cómo las modificaciones en uno repercuten sobre los demás.',
    proyeccion:
      'El siguiente nivel de complejidad corresponde al Estrato V, que se ubica por encima del alcance de este instrumento. Describirlo exige incorporar los criterios propios de ese estrato, y por eso no se asigna de manera automática a quien queda en Liderazgo 2.',
  },
  {
    nombre: 'Liderazgo 1',
    estrato: 3,
    romano: 'III',
    procesamiento: 'Serial',
    que: 'Estrato III · procesamiento serial · de 1 a 2 años',
    horizonte: 'Aproximadamente entre 1 y 2 años.',
    actual:
      'Puede abordar situaciones en las que no existe un único camino predeterminado. Examina el problema, construye diferentes cursos de acción y anticipa qué podría ocurrir al seguir cada uno. Puede elegir una alternativa, avanzar sobre ella y modificarla cuando deja de resultar adecuada. Este nivel requiere articular necesidades de corto plazo con objetivos de mayor alcance, evaluando una tras otra las alternativas hasta encontrar un camino viable.',
    proyeccion:
      'El siguiente nivel de complejidad implica pasar de construir y evaluar caminos alternativos en secuencia a gestionar a la vez múltiples líneas de acción interdependientes. Requiere integrar proyectos, recursos, prioridades y decisiones que evolucionan en paralelo, manteniendo su coherencia como un sistema.',
  },
  {
    nombre: 'Especialista',
    estrato: 2,
    romano: 'II',
    procesamiento: 'Acumulativo',
    que: 'Estrato II · procesamiento acumulativo · de 3 meses a 1 año',
    horizonte: 'Aproximadamente entre 3 meses y 1 año.',
    actual:
      'Puede abordar tareas que requieren interpretar situaciones, reunir información relevante y construir progresivamente una respuesta. Además de resolver obstáculos inmediatos, puede identificar señales de posibles problemas, seleccionar los datos significativos y tomar medidas para anticiparlos o superarlos. En este nivel no se limita a aplicar un procedimiento conocido: necesita observar lo que ocurre, acumular información, interpretarla y usarla para determinar cómo avanzar.',
    proyeccion:
      'El siguiente nivel de complejidad requiere pasar del análisis acumulativo de información a la construcción y comparación de diferentes cursos de acción. Supone anticipar consecuencias, evaluar alternativas y articular decisiones de corto plazo con objetivos de mayor alcance temporal.',
  },
  {
    nombre: 'Operativo',
    estrato: 1,
    romano: 'I',
    procesamiento: 'Declarativo',
    que: 'Estrato I · procesamiento declarativo · hasta 3 meses',
    horizonte: 'Desde tareas inmediatas hasta aproximadamente 3 meses.',
    actual:
      'Puede abordar tareas concretas cuyos objetivos, métodos y recursos se encuentran claramente establecidos. Frente a obstáculos utiliza procedimientos conocidos, experiencia práctica y ensayo y error, y cuando la situación excede las alternativas disponibles pide orientación a un nivel superior. En este nivel la resolución de problemas se apoya sobre todo en aplicar métodos ya conocidos y en el juicio práctico dentro de un marco de trabajo definido.',
    proyeccion:
      'El siguiente nivel de complejidad supone avanzar desde la ejecución de procedimientos definidos hacia tareas que requieren mayor interpretación, diagnóstico y selección de información relevante. Implica ampliar la autonomía para reconocer problemas potenciales, reunir información significativa y construir respuestas a partir de los datos que se acumulan durante el trabajo.',
  },
] as const;

/** Los cuatro textos de un nivel, que se editan desde Configuración. */
export type TextoDeNivel = {
  /** El resumen que va al lado del escalón en la pirámide. */
  que: string;
  /** Qué lapso de tiempo abarca la tarea más larga de ese nivel. */
  horizonte: string;
  /** Qué complejidad de trabajo puede abordar hoy. */
  actual: string;
  /** Qué exige el nivel siguiente. */
  proyeccion: string;
};

/** Cuánto puede medir cada texto. */
export const LARGO_MAXIMO = 2000;

/** Los campos editables, en el orden en que se muestran. */
export const CAMPOS_DE_NIVEL = ['que', 'horizonte', 'actual', 'proyeccion'] as const;

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
    proyeccion: movidos[n.nombre]?.proyeccion ?? n.proyeccion,
  }));
}

/**
 * De qué depende que esa capacidad se aplique en un rol.
 *
 * El análisis estima el nivel de complejidad de trabajo que la persona puede
 * abordar hoy. Que llegue a ejercerlo en un puesto depende además de estas
 * tres, y por eso van en el informe al lado del escalón.
 */
export const CONDICIONES = [
  'Contar con los conocimientos, habilidades y experiencia requeridos.',
  'Disponer de la oportunidad de asumir trabajos de ese nivel de complejidad.',
  'Valorar ese tipo de trabajo y estar motivado por él.',
];

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
