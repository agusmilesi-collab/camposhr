import { notFound } from 'next/navigation';
import { verFactura } from '@/lib/facturas';
import { select } from '@/lib/supabase';
import { formatoFecha, numeroDe } from '@/lib/facturas-tipos';
import './comprobante.css';

export const dynamic = 'force-dynamic';

/**
 * El comprobante, como lo vería el cliente.
 *
 * Es el diseño de `CAMPOS OS/SPECS-facturacion-muestra.html` con los datos
 * reales de la factura. **Sale con la banda de muestra mientras no haya CAE**,
 * que es siempre hasta que se conecte ARCA: un documento que se parece a una
 * factura y no lo es tiene que decirlo arriba de todo y no en una nota al pie.
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
};

type Cliente = {
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  direccion_fiscal: string | null;
  condicion_iva: string | null;
};

export default async function Comprobante({ params }: { params: { id: string } }) {
  const factura = await verFactura(params.id);
  if (!factura) notFound();

  const [emisores, clientes] = await Promise.all([
    select<Emisor>(
      'emisores',
      'select=razon_social,nombre_fantasia,cuit,domicilio,condicion_iva,inicio_actividades' +
        `&id=eq.${factura.emisorId}&limit=1`
    ),
    select<Cliente>(
      'empresas',
      `select=nombre,razon_social,cuit,direccion_fiscal,condicion_iva&id=eq.${factura.empresaId}&limit=1`
    ),
  ]);

  const emisor = emisores[0];
  const cliente = clientes[0];
  const total = factura.renglones.reduce((n, r) => n + (r.importe ?? 0), 0) || factura.importe || 0;
  const conCae = Boolean(factura.cae);

  return (
    <div className="cbte">
      {!conCae && (
        <div className="aviso">
          <b>Comprobante sin CAE.</b> Lo armó el OS con los datos reales de la factura, pero
          todavía no se pidió la autorización a ARCA: no es un comprobante válido. Falta el
          certificado y, antes, una cuenta por persona.
        </div>
      )}

      <div className="marco">
        <div className={`hoja${conCae ? '' : ' muestra'}`}>
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
                Ingresos Brutos <b>Régimen Simplificado</b>
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
                Condición de venta <b>Cuenta corriente</b>
              </div>
              <div>
                Concepto <b>{factura.concepto ?? 'Evaluaciones psicotécnicas'}</b>
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
                    <div className="d">{factura.concepto ?? 'Evaluaciones psicotécnicas'}</div>
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
            <div className="qr-hueco">
              {conCae ? 'QR' : (
                <>
                  QR
                  <span>al emitir</span>
                </>
              )}
            </div>
            <div className="arca">
              <b>{conCae ? 'Comprobante autorizado' : 'Sin autorizar'}</b>
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
