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
    que: 'Gerencia General.',
    lapso: 'De 2 a 5 años.',
    caracteristicas:
      'Es el mundo del gerenciamiento general, de quien tiene proyectos a cargo o de quien investiga. No alcanza con avanzar por un solo camino: construye caminos en serie y alternativas, que funcionan todas al mismo tiempo e interconectadas. Puede llevar adelante varios subproyectos distintos de manera simultánea y entrelazada, o derivarlos en personas a cargo que avanzan cada una por el suyo, y mantenerlas en sincronía tanto en los planes como en los recursos, guiándolas por caminos alternativos. Procesa en paralelo proyectos que interactúan entre sí y los armoniza.',
  },
  {
    nombre: 'Liderazgo 1',
    estrato: 3,
    que: 'Mando Medio, Gerencia.',
    lapso: 'De 1 a 2 años.',
    caracteristicas:
      'Gerencia de mandos medios, con hasta 250 personas a cargo de manera indirecta. Para seguir adelante con su trabajo, incluida la superación de los obstáculos y la acumulación diagnóstica, examina la situación y establece varios caminos alternativos por los que podría resolverse el problema. Tiene que encontrar uno que responda a los requerimientos de corto plazo, de semanas o meses, y que al mismo tiempo dé los pasos iniciales hacia metas de un año o más. Tiene que ser capaz de cambiar de camino si el primero no resulta. Construir esas alternativas es un proceso en serie: imagina qué pasa si sigue cada ruta.',
  },
  {
    nombre: 'Especialista',
    estrato: 2,
    que: 'Tareas que exigen interpretación y conocimientos específicos.',
    lapso: 'De 3 meses a 1 año.',
    caracteristicas:
      'Tareas de especialista, que pueden ser un trabajo gerencial de primera línea. La producción de cada tarea exige cierta interpretación: expone y acumula datos significativos a medida que avanza, de modo de contar con la información apropiada para resolver el problema. No solo supera los obstáculos inmediatos con su acción directa, también reflexiona sobre lo que ocurre para detectar aquello que pueda indicar problemas potenciales, y acumula y selecciona datos que le permiten anticiparlos y tomar medidas para impedirlos o superarlos. Se aplica el orden verbal simbólico de complejidad de la información, con un procesamiento acumulativo.',
  },
  {
    nombre: 'Operativo',
    estrato: 1,
    que: 'Tareas concretas a realizar de forma determinada de antemano.',
    lapso: 'De 1 día a 3 meses.',
    caracteristicas:
      'Primera línea de trabajo. Las tareas que se le asignan pueden ilustrarse con un ejemplo de lo que se pretende, y se le especifican tanto el camino y el método como los recursos para realizarlas. Al toparse con un obstáculo usa alguno de los métodos en los que fue capacitada, además del juicio práctico por ensayo y error. Si aun así no puede superar el problema, recurre a su gerente. Se aplica el orden verbal simbólico de complejidad de la información, con un procesamiento declarativo.',
  },
] as const;

/** Los tres textos de un nivel, que se editan desde Configuración. */
export type TextoDeNivel = { que: string; lapso: string; caracteristicas: string };

/** Cuánto puede medir cada texto. */
export const LARGO_MAXIMO = 2000;

/**
 * Lo guardado para los niveles, si sirve; null si no.
 *
 * Se rechaza un nivel que no exista, un campo que no sea de los tres, un texto
 * que no sea una cadena o que pase el largo, y dejar sin resumen a un nivel: el
 * informe lo dibuja en la pirámide y sin él queda un escalón mudo.
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
      if (campo !== 'que' && campo !== 'lapso' && campo !== 'caracteristicas') return null;
      if (typeof texto !== 'string' || texto.length > LARGO_MAXIMO) return null;
      const limpio = texto.trim();
      if (campo === 'que' && !limpio) return null;
      if (limpio) uno[campo] = limpio;
    }
    if (Object.keys(uno).length > 0) limpios[nombre] = uno;
  }
  return limpios;
}

/** Los cuatro niveles con lo que rige: lo escrito desde Configuración, o lo del código. */
export function nivelesQueRigen(
  movidos: Record<string, Partial<TextoDeNivel>> = {}
): { nombre: NivelDiscursivo; estrato: number; que: string; lapso: string; caracteristicas: string }[] {
  return NIVELES.map((n) => ({
    nombre: n.nombre,
    estrato: n.estrato,
    que: movidos[n.nombre]?.que ?? n.que,
    lapso: movidos[n.nombre]?.lapso ?? n.lapso,
    caracteristicas: movidos[n.nombre]?.caracteristicas ?? n.caracteristicas,
  }));
}

/** Lo que hace falta para que ese nivel se alcance. Las tres, o no pasa. */
export const CONDICIONES = [
  'Desarrollo necesario para lograrlo (habilidades, conocimientos).',
  'Se le presentan las posibilidades u oportunidades de conseguirlo.',
  'Tenga la motivación, deseo de hacerlo.',
];

/** El test, como se llama en la batería. */
export const TEST = 'Análisis discursivo (Elliot Jaques)';

export function esNivel(v: unknown): v is NivelDiscursivo {
  return typeof v === 'string' && NIVELES.some((n) => n.nombre === v);
}

/** Si a esta persona le corresponde, según lo que dice su batería. */
export function llevaDiscursivo(tests: string[] | null | undefined): boolean {
  return Boolean(tests?.includes(TEST));
}
