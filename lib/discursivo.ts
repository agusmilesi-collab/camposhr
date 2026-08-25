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
 * textos son los del documento que entrega hoy la psicóloga.
 */
export const NIVELES = [
  { nombre: 'Liderazgo 2', que: 'Gerencia General.' },
  { nombre: 'Liderazgo 1', que: 'Mando Medio, Gerencia.' },
  {
    nombre: 'Especialista',
    que: 'Tareas que exigen interpretación y conocimientos específicos.',
  },
  {
    nombre: 'Operativo',
    que: 'Tareas concretas a realizar de forma determinada de antemano.',
  },
] as const;

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
