/**
 * Cómo se ve el correo de seguimiento a los noventa días, sin mandarlo.
 *
 * Dibuja `armarCorreoSeguimiento` con datos de ejemplo, para ajustar la
 * redacción mirando el resultado en el navegador en vez de mandarse correos de
 * prueba.
 *
 *   ?recordatorio=1     el segundo correo, a los siete días
 *
 * No lee ni escribe la base. Los botones abren la página real con el enlace de
 * ejemplo (`VISTA_PREVIA_SEGUIMIENTO`), que contesta sin guardar. Vive bajo
 * /api/os, que solo existe en el host del OS y detrás de su sesión.
 */

import { VISTA_PREVIA_SEGUIMIENTO, armarCorreoSeguimiento } from '@/lib/seguimiento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const c = armarCorreoSeguimiento({
    nombre: 'Martina',
    persona: 'Lucía Barrientos',
    pila: 'Lucía',
    puesto: 'Cajera de sucursal',
    enlace: `/seguimiento/${VISTA_PREVIA_SEGUIMIENTO}`,
    recordatorio: q.get('recordatorio') === '1',
  });
  const asunto = `<div style="font:13px Helvetica,Arial,sans-serif;color:#555;background:#fff;padding:10px 24px;border-bottom:1px solid #ddd;">Asunto: <strong>${c.asunto}</strong></div>`;
  return new Response(c.html.replace(/<body([^>]*)>/, `<body$1>${asunto}`), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
