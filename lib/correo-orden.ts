/**
 * La orden de compra, por correo, a quien la pidió.
 *
 * Sale sola cuando se cargan candidatos, del portal o del OS: es el mismo
 * contenido que la pantalla de confirmación, con el PDF adjunto. Va a quien
 * figura como solicitante de la orden y, si la orden no lo tiene, al del
 * pedido. **Si esa persona no tiene correo cargado, no sale nada**: no se le
 * manda a otro contacto de la empresa por las dudas.
 */

import 'server-only';
import { patch, select } from '@/lib/supabase';
import { direcciones, enviarCorreo, escapar, type Envio } from '@/lib/correo';
import { archivoDeOrden, pdfDeOrden } from '@/lib/orden-pdf';
import {
  CONDICIONES,
  PASOS_SIGUIENTES,
  REFERENCIA_EN_LA_HOJA,
  notasDe,
  pesosDeOrden,
  type Orden,
} from '@/lib/orden-compra-tipos';

const PORTAL = 'https://clientes.camposhr.com';

type Quien = { nombre: string; email: string | null } | null;

async function aQuien(ordenId: string): Promise<Quien> {
  const [o] = await select<{ solicitante: Quien; pedidos: { solicitante: Quien } | null }>(
    'ordenes_compra',
    'select=solicitante:contactos!solicitante_id(nombre,email),' +
      'pedidos(solicitante:contactos!solicitante_id(nombre,email))' +
      `&id=eq.${ordenId}&limit=1`
  );
  return o?.solicitante ?? o?.pedidos?.solicitante ?? null;
}

/**
 * A quién le cae la respuesta: la evaluadora de los candidatos de la orden.
 *
 * Una orden que sale del portal todavía no tiene evaluadora, porque se asigna
 * después. Ahí la respuesta va a todas las activas: es mejor que la lean dos
 * que no saber a cuál de las dos le tocaba.
 */
async function quienResponde(ordenId: string): Promise<string[]> {
  const [items, todas] = await Promise.all([
    select<{ evaluaciones: { evaluadoras: { email: string | null } | null } | null }>(
      'orden_items',
      `select=evaluaciones(evaluadoras(email))&orden_id=eq.${ordenId}`
    ),
    select<{ email: string | null }>('evaluadoras', 'select=email&activa=is.true'),
  ]);
  const suyas = direcciones(items.map((i) => i.evaluaciones?.evaluadoras?.email));
  return suyas.length > 0 ? suyas : direcciones(todas.map((e) => e.email));
}

function cuerpo(orden: Orden, nombre: string) {
  const personas = [...new Set(orden.filas.map((f) => f.detalle).filter(Boolean))];
  const cuantas = personas.length === 1 ? '1 candidato' : `${personas.length} candidatos`;
  const titulo = `Orden de compra #${orden.numero}`;
  const entrada = `Recibimos tu pedido de evaluación de ${cuantas} para ${orden.cliente}. La orden de compra va adjunta en PDF.`;
  // En el correo el dólar de referencia es el del día en que se lee, igual que
  // en la pantalla de confirmación.
  const notas = notasDe(orden.filas).map((n) => n.replace(REFERENCIA_EN_LA_HOJA, 'el de hoy'));
  const bajar = orden.token ? `${PORTAL}/api/portal/orden/${orden.token}` : null;
  const importe = (n: number | null) => (n === null ? 'A confirmar' : pesosDeOrden(n));

  const texto = [
    `Hola ${nombre}:`,
    '',
    entrada,
    '',
    titulo,
    ...orden.filas.map((f) => `- ${f.concepto} · ${f.detalle}: ${importe(f.importe)}`),
    `Total: ${pesosDeOrden(orden.total)}`,
    ...(notas.length > 0 ? ['', ...notas] : []),
    '',
    'Condiciones',
    ...CONDICIONES.map((c) => `- ${c.rotulo}: ${c.texto}`),
    '',
    'Qué sigue',
    ...PASOS_SIGUIENTES.map((p, i) => `${i + 1}. ${p}`),
    ...(bajar ? ['', `Bajar la orden: ${bajar}`] : []),
    '',
    'Campos HR · www.camposhr.com',
  ].join('\n');

  const celda = 'padding:10px 0;border-bottom:1px solid #e6e1d6;font-size:14px;line-height:1.4;';
  const rotulo = 'font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a756b;margin:28px 0 8px;';
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f0e6;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Helvetica,Arial,sans-serif;color:#16202b;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;margin-bottom:24px;">Campos HR</div>
  <div style="background:#ffffff;padding:28px 28px 24px;">
    <p style="font-size:15px;line-height:1.5;margin:0 0 12px;">Hola ${escapar(nombre)}:</p>
    <p style="font-size:15px;line-height:1.5;margin:0;">${escapar(entrada)}</p>
    <p style="${rotulo}">${escapar(titulo)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${orden.filas
        .map(
          (f) => `<tr>
        <td style="${celda}">${escapar(f.concepto)}<br><span style="color:#7a756b;">${escapar(f.detalle)}</span></td>
        <td align="right" valign="top" style="${celda}white-space:nowrap;">${importe(f.importe)}</td>
      </tr>`
        )
        .join('')}
      <tr>
        <td style="padding:12px 0 0;font-size:15px;font-weight:bold;">Total</td>
        <td align="right" style="padding:12px 0 0;font-size:15px;font-weight:bold;white-space:nowrap;">${pesosDeOrden(orden.total)}</td>
      </tr>
    </table>
    ${notas.map((n) => `<p style="font-size:12px;line-height:1.5;color:#7a756b;margin:14px 0 0;">${escapar(n)}</p>`).join('')}
    <p style="${rotulo}">Condiciones</p>
    ${CONDICIONES.map((c) => `<p style="font-size:13px;line-height:1.5;margin:0 0 4px;"><b>${escapar(c.rotulo)}:</b> ${escapar(c.texto)}</p>`).join('')}
    <p style="${rotulo}">Qué sigue</p>
    <ol style="font-size:13px;line-height:1.6;margin:0;padding-left:18px;">
      ${PASOS_SIGUIENTES.map((p) => `<li>${escapar(p)}</li>`).join('')}
    </ol>
    ${
      bajar
        ? `<p style="margin:28px 0 0;"><a href="${bajar}" style="display:inline-block;background:#16202b;color:#ffffff;text-decoration:none;font-size:14px;padding:12px 20px;">Bajar la orden en PDF</a></p>`
        : ''
    }
  </div>
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a756b;margin:20px 0 0;">www.camposhr.com</p>
</div>
</body></html>`;

  return { asunto: `${titulo} · Campos HR`, html, texto };
}

/**
 * Manda la orden a quien la pidió y deja anotado a quién y cuándo.
 *
 * No tira: la carga de candidatos ya está hecha cuando esto corre.
 */
export async function avisarOrden(orden: Orden | null): Promise<Envio | null> {
  if (!orden?.numero) return null;
  try {
    const quien = await aQuien(orden.id);
    if (!quien?.email) return { ok: false, motivo: 'sin destinatario' };

    const envio = await enviarCorreo({
      para: [quien.email],
      ...cuerpo(orden, quien.nombre.trim().split(/\s+/)[0]),
      adjuntos: [{ nombre: archivoDeOrden(orden), bytes: await pdfDeOrden(orden) }],
      responderA: await quienResponde(orden.id).catch(() => []),
      clave: `orden-${orden.id}`,
    });
    if (envio.ok) {
      // Las columnas son de `supabase/ordenes-compra-envio.sql`. Si todavía no
      // se corrió, el correo salió igual y lo único que falta es la anotación.
      await patch('ordenes_compra', `id=eq.${orden.id}`, {
        enviada_at: new Date().toISOString(),
        enviada_a: envio.a,
        envio_id: envio.id,
      }).catch((e) => console.error('[correo de orden] salió y no se pudo anotar', e));
    }
    return envio;
  } catch (e) {
    console.error('[correo de orden]', e);
    return null;
  }
}
