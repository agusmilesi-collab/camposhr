import 'server-only';
import { select } from '@/lib/supabase';

/**
 * La base de conocimiento, leída de Supabase.
 *
 * Los archivos viven en el repo privado `campos-kb` y se copian a la tabla con
 * `node scripts/kb-sync.mjs`. Este repositorio es público: el material de
 * clientes no puede viajar en él.
 */
export type Doc = {
  ruta: string;
  clase: 'tema' | 'ejercicio' | 'armado' | 'suelto';
  titulo: string;
  meta: Record<string, string>;
  contenido: string;
  actualizado_at: string;
};

export async function listarKb(): Promise<Doc[]> {
  try {
    return await select<Doc>('kb_docs', 'select=*&order=ruta.asc', 'kb');
  } catch {
    return [];
  }
}

export async function leerKb(ruta: string): Promise<Doc | null> {
  const filas = await listarKb();
  return filas.find((d) => d.ruta === ruta) ?? null;
}
