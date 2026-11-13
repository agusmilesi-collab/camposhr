/**
 * Aviso a Soporte de Yellow, que atiende los tickets del OS.
 *
 * Con cada ticket nuevo y cada mensaje que escribe alguien de Campos HR, se dispara
 * la rutina "Soporte de Yellow" (Claude Code en la nube). Esa rutina clasifica el
 * ticket, le contesta en la conversación o lo resuelve.
 *
 * - Sin YELLOW_SOPORTE_URL y YELLOW_SOPORTE_TOKEN no hace nada.
 * - Los mensajes de Soporte se escriben directo en la base, no por la API del OS:
 *   no disparan un aviso, así que no hay ida y vuelta infinita.
 * - El aviso dice solo qué ticket mirar, sin el texto. Soporte lo lee de la base.
 */
export async function avisarSoporte(motivo: string) {
  const url = process.env.YELLOW_SOPORTE_URL;
  const token = process.env.YELLOW_SOPORTE_TOKEN;
  if (!url || !token) return;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: motivo }),
      cache: 'no-store',
    });
    if (!r.ok) console.error('[soporte-yellow] no salió el aviso', r.status, await r.text());
  } catch (e) {
    console.error('[soporte-yellow] no salió el aviso', e);
  }
}
