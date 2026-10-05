import { notFound, redirect } from 'next/navigation';
import { verFactura } from '@/lib/facturas';
import { select } from '@/lib/supabase';
import { formatoFecha, numeroDe } from '@/lib/facturas-tipos';
import QRCode from 'qrcode';
import PedirCae from './PedirCae';
import './comprobante.css';

/**
 * El comprobante, como lo vería el cliente.
 *
 * Es el diseño de `CAMPOS OS/SPECS-facturacion-muestra.html` con los datos
 * reales de la factura. **Sale con la banda de muestra mientras no haya CAE**:
 * un documento que se parece a una factura y no lo es tiene que decirlo arriba
 * de todo y no en una nota al pie. Lo mismo el que tiene un CAE de
 * homologación, que ARCA entrega para probar y no autoriza nada.
 *
 * El detalle de las líneas no viaja a ARCA (autoriza un total, no renglones),
 * así que los nombres, los puestos, la batería y la orden de compra existen
 * solo en este documento y en la base. Por eso el comprobante lo tiene que
 * armar el sistema.
 */

const pesos = (n: number) =>
  `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const cuitLindo = (c: string | null) =>
  c && c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c ?? '—';

type Emisor = {
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string | null;
  domicilio: string | null;
  condicion_iva: string;
  inicio_actividades: string | null;
  ingresos_brutos: string | null;
};

/** Lo que ARCA autorizó, que es lo que el QR tiene que repetir tal cual. */
type Autorizado = {
  ambiente: 'homologacion' | 'produccion' | null;
  cbte_tipo: number;
  doc_tipo: number | null;
  doc_nro: string | null;
  estado: string;
  respuesta: unknown;
};

/**
 * El QR que ARCA exige en todo comprobante electrónico (RG 4892): la dirección
 * de su verificador con los datos del comprobante en base64.
 */
function direccionQr(d: {
  fecha: string;
  cuit: string;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  tipoDocRec: number;
  nroDocRec: number;
  codAut: string;
}): string {
  const datos = { ver: 1, ...d, moneda: 'PES', ctz: 1, tipoCodAut: 'E', codAut: Number(d.codAut) };
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(datos)).toString('base64')}`;
}

/** Por qué ARCA no la autorizó, cuando lo dijo. */
function motivoDe(respuesta: any): string | null {
  const errores: { Msg?: string }[] = respuesta?.Errors?.Err ?? [];
  const obs: { Msg?: string }[] =
    respuesta?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs ?? [];
  const textos = [...errores, ...obs].map((e) => e.Msg).filter(Boolean);
  return textos.length > 0 ? textos.join(' · ') : null;
}

type Cliente = {
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  direccion_fiscal: string | null;
  condicion_iva: string | null;
};

export default async function Comprobante({
  id,
  puedeEmitir = false,
}: {
  id: string;
  /** Solo el OS ofrece pedir el CAE; el portal muestra la misma hoja sin botón. */
  puedeEmitir?: boolean;
}) {
  const factura = await verFactura(id);
  if (!factura) notFound();
  // Lo que se cobra sin factura no tiene comprobante: tiene un recibo. Esta
  // hoja lleva la letra C, el CUIT y el pie de ARCA, que ahí no corresponden.
  if (factura.sinComprobante) redirect(`/api/os/recibo/${factura.id}`);

  // El receptor es una empresa o un inquilino del Centro, nunca los dos: el
  // comprobante es el mismo y lo que cambia es a nombre de quién sale.
  const [emisores, clientes, inquilinos, autorizados] = await Promise.all([
    select<Emisor>(
      'emisores',
      'select=razon_social,nombre_fantasia,cuit,domicilio,condicion_iva,inicio_actividades,ingresos_brutos' +
        `&id=eq.${factura.emisorId}&limit=1`
    ),
    factura.empresaId
      ? select<Cliente>(
          'empresas',
          `select=nombre,razon_social,cuit,direccion_fiscal,condicion_iva&id=eq.${factura.empresaId}&limit=1`
        )
      : Promise.resolve([]),
    factura.inquilinoId
      ? select<Cliente>(
          'inquilinos',
          'select=nombre,razon_social,cuit,condicion_iva,domicilio_fiscal' +
            `&id=eq.${factura.inquilinoId}&limit=1`
        )
      : Promise.resolve([]),
    select<Autorizado>(
      'facturas',
      `select=ambiente,cbte_tipo,doc_tipo,doc_nro,estado,respuesta&id=eq.${id}&limit=1`
    ),
  ]);

  const emisor = emisores[0];
  const delCentro = inquilinos[0] as (Cliente & { domicilio_fiscal?: string | null }) | undefined;
  const cliente =
    clientes[0] ??
    (delCentro
      ? { ...delCentro, direccion_fiscal: delCentro.domicilio_fiscal ?? null }
      : undefined);
  const total = factura.renglones.reduce((n, r) => n + (r.importe ?? 0), 0) || factura.importe || 0;
  const conCae = Boolean(factura.cae);
  const autorizado = autorizados[0];
  const dePrueba = autorizado?.ambiente === 'homologacion';
  // Se ofrece pedirlo mientras no tenga CAE ni un número puesto a mano: con
  // número ya es una factura que salió por Comprobantes en Línea.
  const seEmite =
    puedeEmitir && !conCae && factura.numero === null && factura.estado !== 'anulada';
  const motivo = !conCae && factura.estado === 'rechazada' ? motivoDe(autorizado?.respuesta) : null;

  const qr =
    conCae && emisor?.cuit && factura.numero !== null && factura.puntoVenta !== null
      ? await QRCode.toString(
          direccionQr({
            fecha: factura.fecha.slice(0, 10),
            cuit: emisor.cuit,
            ptoVta: factura.puntoVenta,
            tipoCmp: autorizado?.cbte_tipo ?? 11,
            nroCmp: factura.numero,
            importe: total,
            tipoDocRec: autorizado?.doc_tipo ?? 80,
            nroDocRec: Number(autorizado?.doc_nro ?? cliente?.cuit ?? 0),
            codAut: factura.cae!,
          }),
          { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }
        )
      : null;

  return (
    <div className="cbte">
      {!conCae && (
        <div className="aviso">
          <b>Comprobante sin CAE.</b> Lo armó el OS con los datos de la factura, pero ARCA
          todavía no lo autorizó: no es un comprobante válido.
          {motivo && <div className="motivo">ARCA lo rechazó: {motivo}</div>}
          {seEmite && <PedirCae id={factura.id} />}
        </div>
      )}
      {conCae && dePrueba && (
        <div className="aviso">
          <b>Comprobante de prueba.</b> El CAE es del ARCA de homologación: sirve para probar
          el sistema y no tiene validez fiscal.
        </div>
      )}

      <div className="marco">
        <div className={`hoja${conCae ? (dePrueba ? ' prueba' : '') : ' muestra'}`}>
          <div className="cabeza">
            <div>
              <div className="fantasia">{emisor?.nombre_fantasia ?? emisor?.razon_social}</div>
              <div className="linea" style={{ marginTop: 10 }}>
                {emisor?.razon_social}
              </div>
              <div className="linea">{emisor?.domicilio ?? 'Domicilio sin cargar'}</div>
              <div className="linea">{emisor?.condicion_iva ?? 'Monotributo'}</div>
            </div>
            <div className="letra">
              <b>C</b>
              <span>CÓD. 11</span>
            </div>
            <div className="der">
              <div className="titulo">Factura</div>
              <div className="linea" style={{ marginTop: 10 }}>
                Punto de venta{' '}
                <b>{factura.puntoVenta === null ? '—' : String(factura.puntoVenta).padStart(5, '0')}</b>
                &nbsp; Comp. Nº <b>{factura.numero === null ? '—' : String(factura.numero).padStart(8, '0')}</b>
              </div>
              <div className="linea">
                Fecha de emisión <b>{formatoFecha(factura.fecha)}</b>
              </div>
              <div className="linea">
                CUIT <b>{cuitLindo(emisor?.cuit ?? null)}</b>
              </div>
              <div className="linea">
                Ingresos Brutos <b>{emisor?.ingresos_brutos ?? 'Régimen Simplificado'}</b>
              </div>
              {emisor?.inicio_actividades && (
                <div className="linea">
                  Inicio de actividades <b>{formatoFecha(emisor.inicio_actividades)}</b>
                </div>
              )}
            </div>
          </div>

          <div className="bloque">
            <div className="par">
              <div>
                Razón social <b>{cliente?.razon_social ?? cliente?.nombre ?? '—'}</b>
              </div>
              <div>
                CUIT <b>{cuitLindo(cliente?.cuit ?? null)}</b>
              </div>
              <div>
                Domicilio <b>{cliente?.direccion_fiscal ?? '—'}</b>
              </div>
              <div>
                Condición frente al IVA <b>{cliente?.condicion_iva ?? '—'}</b>
              </div>
              <div>
                Condición de venta <b>Transferencia bancaria</b>
              </div>
              <div>
                Concepto <b>{factura.concepto ?? 'Servicios profesionales'}</b>
              </div>
            </div>
            {factura.ordenCompra && (
              <div className="oc">
                Orden de compra <b>{factura.ordenCompra}</b>
              </div>
            )}
          </div>

          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="num" style={{ width: 88 }}>
                  Cantidad
                </th>
                <th className="num" style={{ width: 132 }}>
                  Precio unit.
                </th>
                <th className="num" style={{ width: 132 }}>
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {factura.renglones.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="d">{r.descripcion}</div>
                    {r.detalle && <div className="s">{r.detalle}</div>}
                  </td>
                  <td className="num">1,00</td>
                  <td className="num">{r.importe === null ? '—' : pesos(r.importe)}</td>
                  <td className="num">{r.importe === null ? '—' : pesos(r.importe)}</td>
                </tr>
              ))}
              {factura.renglones.length === 0 && (
                <tr>
                  <td>
                    <div className="d">{factura.concepto ?? 'Servicios profesionales'}</div>
                  </td>
                  <td className="num">1,00</td>
                  <td className="num">{pesos(total)}</td>
                  <td className="num">{pesos(total)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="totales">
            <table>
              <tbody>
                <tr>
                  <td>Subtotal</td>
                  <td className="num">{pesos(total)}</td>
                </tr>
                <tr>
                  <td>Otros tributos</td>
                  <td className="num">{pesos(0)}</td>
                </tr>
                <tr className="grande">
                  <td>Total</td>
                  <td className="num">{pesos(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pie">
            {qr ? (
              <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
            ) : (
              <div className="qr-hueco">
                QR
                <span>al emitir</span>
              </div>
            )}
            <div className="arca">
              <b>
                {conCae
                  ? dePrueba
                    ? 'Autorizado en homologación'
                    : 'Comprobante autorizado'
                  : 'Sin autorizar'}
              </b>
              {conCae
                ? 'Esta Administración Federal no se responsabiliza por los datos ingresados en el detalle de la operación.'
                : 'El CAE y el código QR los devuelve ARCA al emitir. Hasta entonces este documento sirve para revisar el detalle con el cliente, no para cobrar.'}
            </div>
            <div className="cae">
              CAE Nº
              <div className="n">{factura.cae ?? '—'}</div>
              <div className="v">
                {factura.caeVenceEl
                  ? `Vencimiento del CAE ${formatoFecha(factura.caeVenceEl)}`
                  : 'Vencimiento del CAE —'}
              </div>
            </div>
          </div>
        </div>

        <p className="volver">
          {numeroDe(factura)} · {factura.cliente} ·{' '}
          <a href="/os/psicotecnicos/facturacion">volver a Facturación</a> ·{' '}
          <span className="imprimir">para el PDF, imprimir y guardar como PDF</span>
        </p>
      </div>
    </div>
  );
}
