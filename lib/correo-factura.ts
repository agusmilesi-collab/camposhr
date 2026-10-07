/**
 * La factura y el recibo de pago, por correo.
 *
 * **La factura no sale sola: la manda alguien con un botón** (decisión de
 * Agustín, 7/10/2026). Una factura mandada a una dirección equivocada no se
 * puede retirar, así que antes de mandarla hay que ver a quién va.
 *
 * **El recibo de pago sí sale solo**, al confirmar el cobro, a los mismos que
 * la factura: ya se vio a quién iba cuando se la mandó.
 *
 * A quién van lo decide la ficha del cliente (`lib/correo-destinos.ts`): a
 * quien pidió esos candidatos, si recibe facturas, y a los que reciben las de
 * toda la empresa, como compras. La respuesta le cae a la evaluadora que emitió.
 */

import 'server-only';
import { patch, select } from '@/lib/supabase';
import { direcciones, enviarCorreo, escapar, hayCorreo } from '@/lib/correo';
import { datosDeFactura, type DatosFactura } from '@/lib/factura-datos';
import { pdfParaBajar } from '@/lib/factura-archivo';
import { pesosDeOrden } from '@/lib/orden-compra-tipos';
import { formaDelRecibo, reciboDePago } from '@/lib/orden-compra';
import { archivoDeOrden, pdfDeOrden } from '@/lib/orden-pdf';
import { PARRAFO, destinosDe, hoja, type Destinos } from '@/lib/correo-destinos';

export type EnvioDeFactura = {
  /** A quién va si se manda ahora, con los que van en copia. Vacío es que no hay a quién. */
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
  recibo_enviado_at: string | null;
  empresas: { email_facturacion: string | null } | null;
  emisores: { evaluadoras: { email: string | null } | null } | null;
  factura_items: {
    evaluaciones: { solicitante_id: string | null; pedidos: { solicitante_id: string | null } | null } | null;
  }[];
};

async function leer(id: string): Promise<{ f: Fila; destinos: Destinos } | null> {
  const [f] = await select<Fila>(
    'facturas',
    'select=empresa_id,estado,enviada_at,enviada_a,recibo_enviado_at,empresas(email_facturacion),' +
      'emisores(evaluadoras(email)),factura_items(evaluaciones(solicitante_id,pedidos(solicitante_id)))' +
      `&id=eq.${id}&limit=1`
  );
  if (!f) return null;
  const pidieron = f.factura_items.map(
    (i) => i.evaluaciones?.solicitante_id ?? i.evaluaciones?.pedidos?.solicitante_id
  );
  const d = await destinosDe('factura', f.empresa_id, pidieron);
  // El correo de facturación de la empresa, si está cargado, va siempre.
  const fijo = direcciones([f.empresas?.email_facturacion]).filter((x) => !d.para.includes(x));
  const destinos =
    d.para.length === 0
      ? { ...d, para: fijo }
      : { ...d, copia: [...new Set([...d.copia, ...fijo])] };
  return { f, destinos };
}

/** Lo que la pantalla necesita para ofrecer el botón y decir a quién va. */
export async function envioDeFactura(id: string): Promise<EnvioDeFactura | null> {
  const d = await leer(id);
  if (!d) return null;
  return {
    para: [...d.destinos.para, ...d.destinos.copia],
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

  const { para, copia, nombre } = datos.destinos;
  if (para.length === 0) {
    return {
      ok: false,
      error:
        'No hay a quién mandársela: en la ficha del cliente, tildale "Factura y recibo de pago" a un contacto con correo.',
    };
  }

  const pdf = await pdfParaBajar(id);
  if (!pdf) return { ok: false, error: 'No se pudo armar el PDF de la factura.' };

  const envio = await enviarCorreo({
    para,
    copia,
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

/**
 * Manda el recibo de pago, una sola vez, al confirmar el cobro.
 *
 * No tira: el cobro ya quedó marcado cuando esto corre. Desmarcar y volver a
 * marcar no lo manda de nuevo.
 */
export async function avisarRecibo(id: string): Promise<void> {
  try {
    if (!hayCorreo()) return;
    const [datos, recibo] = await Promise.all([leer(id), reciboDePago(id)]);
    if (!datos || !recibo || datos.f.recibo_enviado_at) return;
    const { para, copia, nombre } = datos.destinos;
    if (para.length === 0) return;

    const { papel, pagadoEl, comprobante, formaPago } = recibo;
    const forma = formaDelRecibo(papel, pagadoEl, comprobante, formaPago);
    const titulo = `Recibo de pago${papel.numero ? ` #${papel.numero}` : ''}`;
    const entrada =
      `Registramos el pago de ${pesosDeOrden(papel.total)}` +
      // Contra qué se pagó: la factura y, detrás, sus órdenes de compra.
      (comprobante ? `, correspondiente a ${/^Órdenes/.test(comprobante) ? 'las' : 'la'} ${comprobante}` : '') +
      '. El recibo va adjunto en PDF.';
    const saludo = nombre ? `Hola ${nombre}:` : 'Hola:';

    const envio = await enviarCorreo({
      para,
      copia,
      asunto: `${titulo} · Campos HR`,
      texto: [saludo, '', entrada, '', 'Campos HR · www.camposhr.com'].join('\n'),
      html: hoja(
        `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n    <p style="${PARRAFO}margin:0;">${escapar(entrada)}</p>`
      ),
      adjuntos: [{ nombre: archivoDeOrden(papel, forma.archivo), bytes: await pdfDeOrden(papel, forma) }],
      responderA: [datos.f.emisores?.evaluadoras?.email ?? ''],
      clave: `recibo-${id}`,
    });
    if (envio.ok) {
      await patch('facturas', `id=eq.${id}`, { recibo_enviado_at: new Date().toISOString() });
    }
  } catch (e) {
    console.error('[correo de recibo]', e);
  }
}
