import 'server-only';

/**
 * El IPC mensual (Nivel General, INDEC), de la API pública de
 * argentinadatos.com, que lo publica por mes como "2026-09-30": 1,9.
 *
 * Se pide una vez por día. Si la API no contesta, devuelve un mapa vacío y
 * quien lo usa no aplica lo que no puede calcular.
 */
export async function ipcMensual(): Promise<Map<string, number>> {
  try {
    const r = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion', {
      next: { revalidate: 86_400 },
    });
    if (!r.ok) return new Map();
    const filas: { fecha: string; valor: number }[] = await r.json();
    if (!Array.isArray(filas)) return new Map();
    // La clave es el mes, "2026-09": la API pone el último día.
    return new Map(
      filas
        .filter((f) => typeof f.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && Number.isFinite(f.valor))
        .map((f) => [f.fecha.slice(0, 7), f.valor])
    );
  } catch {
    return new Map();
  }
}
