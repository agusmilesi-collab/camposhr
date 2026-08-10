/**
 * Palabras inventadas para ver cómo se acomoda la nube antes de tenerla.
 *
 * No se guardan: se arman en memoria y viven lo que dura el render de la
 * pantalla de prueba, igual que las personas de `ficticias.ts`.
 *
 * La lista es el peor caso de la placa 6 de la charla 4: treinta y tres
 * respuestas y ninguna repetida. Es lo que puede pasar de verdad, porque la
 * pregunta es abierta y cada uno tiene la suya.
 */
import type { Aporte } from './ciclo';

/** Emociones plausibles para «Solo de pensarlo, ¿qué sentís?», todas distintas. */
export const PALABRAS: string[] = [
  'Incomodidad', 'Angustia', 'Nervios', 'Tensión', 'Culpa',
  'Miedo', 'Ansiedad', 'Bronca', 'Tristeza', 'Impotencia',
  'Responsabilidad', 'Presión', 'Alivio', 'Injusticia', 'Pena',
  'Inseguridad', 'Vergüenza', 'Frustración', 'Enojo', 'Preocupación',
  'Nada', 'Calma', 'Respeto', 'Empatía', 'Dolor',
  'Desgano', 'Cansancio', 'Temor', 'Duda', 'Rechazo',
  'Molestia', 'Agobio', 'Pesar',
];

export const MAXIMO_PALABRAS = PALABRAS.length;

/**
 * `cuantas` respuestas de una palabra.
 *
 * Con `repeticiones` en cero salen todas distintas, que es el caso que rompe
 * el tamaño: si ninguna se repite, el tope es uno y todas piden el cuerpo más
 * grande a la vez. Con un número mayor, las primeras se repiten esa cantidad
 * de veces, para ver la nube que el diseño supone.
 */
export function aportesDePrueba(
  actividadId: string,
  cuantas: number,
  repeticiones = 0
): Aporte[] {
  const pedidas = Math.max(0, Math.min(cuantas, MAXIMO_PALABRAS * 4));
  const salida: string[] = [];

  if (repeticiones > 1) {
    // Las primeras se repiten y las últimas caen de a una: queda un tope real
    // y un borde de palabras únicas, que es la forma que el diseño supone.
    let i = 0;
    while (salida.length < pedidas) {
      const palabra = PALABRAS[i % MAXIMO_PALABRAS];
      const veces = Math.max(1, repeticiones - i);
      for (let v = 0; v < veces && salida.length < pedidas; v += 1) {
        salida.push(palabra);
      }
      i += 1;
    }
  } else {
    for (let i = 0; i < pedidas; i += 1) {
      salida.push(PALABRAS[i % MAXIMO_PALABRAS]);
    }
  }

  return salida.map((palabra, i) => ({
    id: `prueba-${i}`,
    corrida_id: 'prueba',
    actividad_id: actividadId,
    asistente_id: `prueba-${i}`,
    valor: { tipo: 'palabra', palabra },
    created_at: new Date(0).toISOString(),
  }));
}
