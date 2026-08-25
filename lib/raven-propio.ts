import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { RANGOS, rangoDe, type Rango } from '@/lib/raven';

/**
 * Qué tan raro es cada rango del Raven entre nuestros propios candidatos.
 *
 * El manual trae su baremo, hecho sobre población española que rinde casi tres
 * puntos menos que la que evalúa Campos HR. Decirle a un cliente que su
 * candidato está en el 5 % superior sirve si ese 5 % es del universo del que
 * salen sus candidatos, y no de otro.
 *
 * Así que la frecuencia se cuenta: cada Raven que se carga entra en la cuenta y
 * la corrige. **Hasta {@link META} casos es una estimación de una muestra
 * chica**, y por eso la pantalla muestra cuántos van: sin el contador, "1 de
 * cada 2" sobre catorce personas se lee con la misma confianza que sobre
 * doscientas.
 *
 * Se cuenta contra los rangos que rigen, no contra los de fábrica: mover un
 * corte cambia cuánta gente cae de cada lado, que es justamente lo que se está
 * decidiendo cuando se lo mueve.
 */

/** Cuántos casos propios hacen falta para dejar de estimar. */
export const META = 200;

export type Propio = {
  /** Cuántos Raven propios hay cargados. */
  casos: number;
  /** Aciertos promedio, para comparar contra los 18,19 del manual. */
  media: number | null;
  /** Cuántos cayeron en cada rango, por numeral. */
  porRango: Record<string, number>;
};

type Fila = { raw: number | null };

export async function ravenPropio(rangos: Rango[] = RANGOS): Promise<Propio> {
  const porRango: Record<string, number> = Object.fromEntries(rangos.map((r) => [r.numeral, 0]));
  try {
    const filas = await select<Fila>(
      'raven',
      'select=raw&raw=not.is.null&limit=2000',
      CACHE_PSICOTECNICOS
    );
    const raws = filas
      .map((f) => Number(f.raw))
      .filter((n) => Number.isFinite(n) && n >= 0);
    for (const raw of raws) {
      const r = rangoDe(raw, rangos);
      if (r) porRango[r.numeral] += 1;
    }
    const casos = raws.length;
    return {
      casos,
      media: casos ? Math.round((raws.reduce((n, x) => n + x, 0) / casos) * 100) / 100 : null,
      porRango,
    };
  } catch {
    // Sin la cuenta la pantalla dice que todavía no hay casos, que es lo que se
    // ve igual cuando recién se empieza. Un baremo no puede tumbar una ficha.
    return { casos: 0, media: null, porRango };
  }
}

/**
 * Qué tan raro es, dicho como se lee.
 *
 * "1 de cada 2 candidatos" y no "48 %": el informe habla de una persona contra
 * las demás, no de una proporción.
 */
export function queTanRaro(casos: number, enEsteRango: number): string {
  if (casos === 0) return 'sin casos todavía';
  if (enEsteRango === 0) return `ninguno de ${casos}`;
  return `1 de cada ${Math.max(1, Math.round(casos / enEsteRango))} candidatos`;
}

/** El texto de cada rango, listo para la escala y para la tabla. */
export function frecuencias(p: Propio, rangos: Rango[] = RANGOS): Record<string, string> {
  return Object.fromEntries(
    rangos.map((r) => [r.numeral, queTanRaro(p.casos, p.porRango[r.numeral] ?? 0)])
  );
}
