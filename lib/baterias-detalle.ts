import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';

/**
 * Qué se le toma a la persona y qué recibe el cliente, por batería.
 *
 * Son las dos listas que se tildan en Configuración → Baterías (`tests` y
 * `outputs`), y las lee la página de precios para contar qué incluye cada una.
 * Van aparte de `lib/baterias-portal.ts` porque ahí se leen los textos de venta
 * y acá el contenido, y el portal no necesita ni una cosa ni la otra completa.
 *
 * Vacío si la lectura falla: la página muestra igual el precio y los textos, que
 * es lo que no puede faltar.
 */
export type ContenidoDeBateria = { tests: string[]; entrega: string[] };

export async function bateriasConContenido(): Promise<Record<string, ContenidoDeBateria>> {
  try {
    const filas = await select<{ codigo: string; tests: string[] | null; outputs: string[] | null }>(
      'baterias',
      'select=codigo,tests,outputs&order=codigo.asc',
      CACHE_PSICOTECNICOS
    );
    return Object.fromEntries(
      filas.map((f) => [f.codigo, { tests: f.tests ?? [], entrega: f.outputs ?? [] }])
    );
  } catch {
    return {};
  }
}
