/**
 * La factura, por correo, a quien la paga.
 *
 * **No sale sola: la manda alguien con un botón** (decisión de Agustín,
 * 7/10/2026). Una factura mandada a una dirección equivocada no se puede
 * retirar, así que antes de mandarla hay que ver a quién va.
 *
 * Va a los contactos del cliente marcados "Recibe la factura" que tengan
 * correo, más el correo de facturación de la empresa si está cargado. La
 * respuesta le cae a la evaluadora que la emitió.
 */

import 'server-only';
import { patch, select } from '@/lib/supabase';
import { direcciones, enviarCorreo, escapar, hayCorreo } from '@/lib/correo';
import { datosDeFactura, type DatosFactura } from '@/lib/factura-datos';
import { pdfParaBajar } from '@/lib/factura-archivo';
import { pesosDeOrden } from '@/lib/orden-compra-tipos';

export type EnvioDeFactura = {
  /** A quién va si se manda ahora. Vacío es que no hay a quién. */
  para: string[];
  /** Cuándo salió la última vez, y a quién. */
  enviadaAt: string | null;
  enviadaA: string[];
  /** Falso mientras el sistema no tenga la clave de Resend. */
  prendido: boolean;
};

type Fila = {
  empresa_id: string | null;
  estado: string;
  enviada_at: string | null;
  enviada_a: string[] | null;
  empresas: { email_facturacion: string | null } | null;
  emisores: { evaluadoras: { email: string | null } | null } | null;
};

async function leer(id: string) {
  const [f] = await select<Fila>(
    'facturas',
    'select=empresa_id,estado,enviada_at,enviada_a,empresas(email_facturacion),' +
      `emisores(evaluadoras(email))&id=eq.${id}&limit=1`
  );
  if (!f) return null;
  const contactos = f.empresa_id
    ? await select<{ nombre: string; email: string | null }>(
        'contactos',
        `select=nombre,email&empresa_id=eq.${f.empresa_id}&facturacion=is.true&activo=is.true&order=nombre.asc`
      )
    : [];
  return { f, contactos };
}

/** Lo que la pantalla necesita para ofrecer el botón y decir a quién va. */
export async function envioDeFactura(id: string): Promise<EnvioDeFactura | null> {
  const d = await leer(id);
  if (!d) return null;
  return {
    para: direcciones([...d.contactos.map((c) => c.email), d.f.empresas?.email_facturacion]),
    enviadaAt: d.f.enviada_at,
    enviadaA: d.f.enviada_a ?? [],
    prendido: hayCorreo(),
  };
}

function cuerpo(d: DatosFactura, nombre: string | null) {
  const papel = `${d.titulo} C N° ${d.numeroLargo}`;
  const saludo = nombre ? `Hola ${nombre}:` : 'Hola:';
  const entrada = d.esNota
    ? `Va adjunta la nota de crédito C N° ${d.numeroLargo} de ${d.emisor.razonSocial}, del ${d.fecha}` +
      (d.anula ? `, que anula la factura N° ${d.anula.numero}.` : '.')
    : `Va adjunta la factura C N° ${d.numeroLargo} de ${d.emisor.razonSocial}, emitida el ${d.fecha} a nombre de ${d.cliente.razonSocial}.`;
  const datos: [string, string][] = d.esNota
    ? [['Importe', pesosDeOrden(d.total)]]
    : [
        ['Importe', pesosDeOrden(d.total)],
        ['Vencimiento del pago', d.vencePago],
        ['Forma de pago', 'Transferencia bancaria'],
        ...(d.cliente.ordenPropia ? ([['Orden de compra', d.cliente.ordenPropia]] as [string, string][]) : []),
      ];
  const importe = (n: number | null) => (n === null ? '' : pesosDeOrden(n));

  const texto = [
    saludo,
    '',
    entrada,
    '',
    ...d.renglones.map((r) => `- ${r.texto}${r.importe === null ? '' : `: ${importe(r.importe)}`}`),
    '',
    ...datos.map(([k, v]) => `${k}: ${v}`),
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
    <p style="font-size:15px;line-height:1.5;margin:0 0 12px;">${escapar(saludo)}</p>
    <p style="font-size:15px;line-height:1.5;margin:0;">${escapar(entrada)}</p>
    <p style="${rotulo}">${escapar(papel)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${d.renglones
        .map(
          (r) => `<tr>
        <td style="${celda}">${escapar(r.texto)}</td>
        <td align="right" valign="top" style="${celda}white-space:nowrap;">${importe(r.importe)}</td>
      </tr>`
        )
        .join('')}
    </table>
    <div style="margin-top:20px;">
      ${datos.map(([k, v]) => `<p style="font-size:13px;line-height:1.5;margin:0 0 4px;"><b>${escapar(k)}:</b> ${escapar(v)}</p>`).join('')}
    </div>
  </div>
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a756b;margin:20px 0 0;">www.camposhr.com</p>
</div>
</body></html>`;

  return { asunto: `${papel} · ${d.emisor.razonSocial}`, html, texto };
}

export type ResultadoDeEnvio = { ok: true; a: string[] } | { ok: false; error: string };

/**
 * Manda la factura. Solo una con CAE: sin CAE no es un comprobante, y mandarla
 * es mandar un papel que no vale.
 */
export async function enviarFactura(id: string): Promise<ResultadoDeEnvio> {
  const [d, datos] = await Promise.all([datosDeFactura(id), leer(id)]);
  if (!d || !datos) return { ok: false, error: 'Esa factura no existe.' };
  if (!d.conCae) return { ok: false, error: 'La factura todavía no tiene CAE: no hay comprobante que mandar.' };
  // La pantalla no ofrece el botón en una anulada, pero la regla va acá: una
  // factura anulada ya no vale, y lo que el cliente necesita es su nota de crédito.
  if (datos.f.estado === 'anulada') {
    return { ok: false, error: 'Esa factura está anulada. Lo que se manda es su nota de crédito.' };
  }
  if (!hayCorreo()) return { ok: false, error: 'El envío de correo no está configurado en este ambiente.' };

  const para = direcciones([
    ...datos.contactos.map((c) => c.email),
    datos.f.empresas?.email_facturacion,
  ]);
  if (para.length === 0) {
    return {
      ok: false,
      error:
        'El cliente no tiene a quién mandársela: cargale el correo a un contacto marcado "Recibe la factura" en su ficha.',
    };
  }

  const pdf = await pdfParaBajar(id);
  if (!pdf) return { ok: false, error: 'No se pudo armar el PDF de la factura.' };

  // Con un solo contacto se lo saluda por el nombre; con varios, a ninguno.
  const conCorreo = datos.contactos.filter((c) => c.email);
  const nombre = conCorreo.length === 1 ? conCorreo[0].nombre.trim().split(/\s+/)[0] : null;

  const envio = await enviarCorreo({
    para,
    ...cuerpo(d, nombre),
    adjuntos: [{ nombre: pdf.nombre, bytes: pdf.bytes }],
    responderA: [datos.f.emisores?.evaluadoras?.email ?? ''],
    // Dos toques seguidos llevan el mismo envío anterior y Resend descarta el
    // segundo. Reenviar más tarde lleva otro, y sale.
    clave: `factura-${id}-${datos.f.enviada_at ?? 'primera'}`,
  });
  if (!envio.ok) {
    return { ok: false, error: `El correo no salió${envio.detalle ? ` (${envio.detalle})` : ''}.` };
  }
  await patch('facturas', `id=eq.${id}`, {
    enviada_at: new Date().toISOString(),
    enviada_a: envio.a,
  }).catch((e) => console.error('[correo de factura] salió y no se pudo anotar', e));
  return { ok: true, a: envio.a };
}
