/**
 * Cómo se ve el correo al candidato, sin mandarlo.
 *
 * Dibuja `armarCorreoCandidato` con datos de ejemplo. Sirve para ajustar la
 * redacción y los botones mirando el resultado en el navegador: cada correo de
 * prueba real mueve una evaluación y, si es online, un evento del calendario
 * de una evaluadora.
 *
 *   ?modalidad=online | presencial      (online si no se dice)
 *   ?tipo=nuevo | reprogramado | modalidad
 *   ?whatsapp=no                        (la evaluadora sin número cargado)
 *
 * No lee ni escribe la base, y el botón de confirmar abre la página real con
 * los datos de ejemplo (`VISTA_PREVIA`), que tampoco la toca. Vive bajo /api/os, que solo existe en el host del
 * OS y detrás de su sesión.
 */

import { ICONO_WHATSAPP, VISTA_PREVIA, armarCorreoCandidato } from '@/lib/correo-candidato';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const online = q.get('modalidad') !== 'presencial';
  const tipo = q.get('tipo');

  const c = armarCorreoCandidato({
    nombre: VISTA_PREVIA.nombre,
    puesto: 'Cajera de sucursal',
    con: 'Lorena Campos',
    whatsapp: q.get('whatsapp') === 'no' ? null : '+54 9 3416 40-2533',
    fecha: VISTA_PREVIA.fecha(),
    minutos: 120,
    online: online ? 'https://meet.google.com/abc-defg-hij' : null,
    // Abre la página de confirmar de verdad, con los datos de ejemplo.
    confirmar: online ? `/confirmar/${VISTA_PREVIA.token}` : null,
    tipo: tipo === 'reprogramado' || tipo === 'modalidad' ? tipo : 'nuevo',
  });

  const asunto = `<div style="font:13px Helvetica,Arial,sans-serif;color:#555;background:#fff;padding:10px 24px;border-bottom:1px solid #ddd;">Asunto: <strong>${c.asunto}</strong></div>`;
  // El ícono se pide a esta misma máquina: el del sitio publicado no existe
  // hasta que se publica.
  const html = c.html.split(ICONO_WHATSAPP).join('/correo/whatsapp.png');
  return new Response(html.replace(/<body([^>]*)>/, `<body$1>${asunto}`), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
