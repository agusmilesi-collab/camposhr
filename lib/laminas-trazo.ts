/**
 * El trazo que la persona evaluada hace sobre la lámina, como viaja de su
 * pantalla a la de codificación.
 *
 * Cada punto es `[x, y, edad]`: x e y van de 0 a 1 sobre la imagen de la
 * lámina (no sobre la pantalla, que en un celular y en una computadora no se
 * parecen en nada), y la edad son los milisegundos desde que se dibujó, para
 * que del otro lado se borre al mismo ritmo.
 */

export type PuntoSenal = [number, number, number];

export type Senal = {
  /** El número de lámina en el orden del test, de 1 en adelante. */
  lamina: number;
  trazos: PuntoSenal[][];
};

/** Cuánto vive cada punto: lo mismo que en la pantalla de la persona. */
export const VIDA_SENAL_MS = 5000;

const MAX_TRAZOS = 30;
const MAX_PUNTOS = 600;

/** Lo que llegó, si tiene la forma esperada y un tamaño razonable; si no, null. */
export function trazoValido(datos: unknown, laminas: number): Senal | null {
  if (!datos || typeof datos !== 'object') return null;
  const { lamina, trazos } = datos as { lamina?: unknown; trazos?: unknown };
  if (typeof lamina !== 'number' || !Number.isInteger(lamina) || lamina < 1 || lamina > laminas) {
    return null;
  }
  if (!Array.isArray(trazos) || trazos.length > MAX_TRAZOS) return null;
  const limpios: PuntoSenal[][] = [];
  for (const t of trazos) {
    if (!Array.isArray(t) || t.length > MAX_PUNTOS) return null;
    const puntos: PuntoSenal[] = [];
    for (const p of t) {
      if (!Array.isArray(p) || p.length !== 3) return null;
      const [x, y, edad] = p;
      if (![x, y, edad].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
      if (x < -1 || x > 2 || y < -1 || y > 2 || edad < 0 || edad > VIDA_SENAL_MS * 2) return null;
      puntos.push([x, y, edad]);
    }
    if (puntos.length > 0) limpios.push(puntos);
  }
  return { lamina, trazos: limpios };
}
