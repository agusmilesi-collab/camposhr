/**
 * El test de Raven, tomado desde el OS.
 *
 * Treinta y seis láminas, ocho opciones numeradas cada una, cuarenta y cinco
 * minutos. Se puede volver a cualquier lámina y cambiar lo respondido mientras
 * quede tiempo: lo que vale es lo que está cargado cuando el reloj se acaba.
 *
 * El reloj lo lleva el servidor. El navegador muestra la cuenta, pero quien
 * decide si una respuesta llegó a tiempo es el momento en que se abrió la
 * primera lámina, guardado del lado de acá.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { MINUTOS, RAVEN_MAXIMO } from '@/lib/raven';

/**
 * Cuál de las ocho opciones es la correcta en cada lámina.
 *
 * Es la clave del manual y vive del lado del servidor: si estuviera en el
 * paquete que se le manda al navegador, cualquiera que rinde el test podría
 * leerla antes de contestar.
 */
export const CLAVE: Record<number, number> = {
  1: 5, 2: 1, 3: 7, 4: 4, 5: 3, 6: 1,
  7: 6, 8: 1, 9: 8, 10: 4, 11: 5, 12: 6,
  13: 2, 14: 1, 15: 2, 16: 4, 17: 6, 18: 7,
  19: 3, 20: 8, 21: 8, 22: 7, 23: 6, 24: 3,
  25: 7, 26: 2, 27: 7, 28: 5, 29: 6, 30: 5,
  31: 4, 32: 8, 33: 5, 34: 1, 35: 3, 36: 2,
};

export function hayClave(): boolean {
  return Object.keys(CLAVE).length === RAVEN_MAXIMO;
}

/** Cuántas acertó, o null si todavía no está cargada la clave. */
export function corregir(respuestas: Record<string, number>): number | null {
  if (!hayClave()) return null;
  let aciertos = 0;
  for (let lamina = 1; lamina <= RAVEN_MAXIMO; lamina++) {
    if (respuestas[String(lamina)] === CLAVE[lamina]) aciertos++;
  }
  return aciertos;
}

export type Sesion = {
  id: string;
  evaluacion_id: string;
  token: string;
  iniciado_at: string | null;
  terminado_at: string | null;
  cierre: string | null;
  respuestas: Record<string, number>;
};

export async function sesionPorToken(token: string): Promise<Sesion | null> {
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(token)) return null;
  const filas = await select<Sesion>(
    'raven_sesiones',
    `select=id,evaluacion_id,token,iniciado_at,terminado_at,cierre,respuestas&token=eq.${token}&limit=1`
  );
  return filas[0] ?? null;
}

/** Cuántos segundos le quedan, contados desde que abrió la primera lámina. */
export function segundosRestantes(iniciado: string | null, ahora = new Date()): number {
  if (!iniciado) return MINUTOS * 60;
  const pasados = (ahora.getTime() - new Date(iniciado).getTime()) / 1000;
  return Math.max(0, Math.round(MINUTOS * 60 - pasados));
}

/** El tiempo se terminó: lo que llegue después de esto no entra. */
export function seAcabo(s: Sesion, ahora = new Date()): boolean {
  if (s.terminado_at) return true;
  return s.iniciado_at !== null && segundosRestantes(s.iniciado_at, ahora) <= 0;
}
