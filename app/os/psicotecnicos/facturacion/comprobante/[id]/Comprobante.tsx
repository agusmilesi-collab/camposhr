import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import PedirCae from './PedirCae';
import { SITIO } from '@/lib/orden-compra-tipos';
import { LOGO_ARCA } from '@/lib/marcas/arca';
import { verFactura } from '@/lib/facturas';
import { EJEMPLARES, datosDeFactura } from '@/lib/factura-datos';
import './comprobante.css';
import './factura.css';

/**
 * La factura, como la ve el cliente.
 *
 * **Está a mitad de camino entre el comprobante de ARCA y la orden de compra.**
 * De la orden tiene la hoja: la banda con la marca, los márgenes, las líneas de
 * puntos del total y la barra oscura. Del comprobante de ARCA tiene todo lo
 * que quien lo recibe va a buscar: la letra C con su código, el punto de venta
 * y el número, quién emite y a quién con sus CUIT, el período, la tabla con
 * sus columnas de siempre, y el QR con el CAE al pie. Se probó primero con el
 * armado de ARCA entero, en recuadros, y quedaba lejos del resto de los
 * papeles; con la hoja de la orden a secas, no parecía una factura.
 *
 * **Sale en tres ejemplares**, uno debajo del otro: original, duplicado y
 * triplicado, que es como la entrega Comprobantes en Línea. Son la misma hoja
 * y solo cambia el sello de arriba.
 *
 * Es la misma hoja con CAE y sin él. **Sin CAE lo dice una banda arriba**, y
 * abajo el QR y el CAE quedan vacíos: un documento que se parece a una factura
 * y todavía no lo es tiene que avisarlo antes que nada. Lo mismo el que tiene
 * un CAE de homologación, que ARCA entrega para probar y no autoriza nada.
 *
 * Los datos salen de `lib/factura-datos.ts`, que comparte con el PDF que se
 * guarda y se manda (`lib/factura-pdf.ts`): **un cambio de diseño acá hay que
 * llevarlo allá.**
 */

const pesos = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Comprobante({
  id,
  puedeEmitir = false,
}: {
  id: string;
  /** Solo el OS ofrece pedir el CAE; el portal muestra la misma hoja sin botón. */
  puedeEmitir?: boolean;
}) {
  const d = await datosDeFactura(id);
  if (!d) {
    // Lo que se cobra sin factura no tiene comprobante: tiene una orden de
    // compra. Esta hoja lleva la letra C, el CUIT y el pie de ARCA, que ahí no
    // corresponden.
    const f = await verFactura(id);
    if (f?.sinComprobante) redirect(`/api/os/recibo/${f.id}`);
    notFound();
  }

  // Se ofrece pedirlo mientras no tenga CAE ni un número puesto a mano: con
  // número ya es una factura que salió por Comprobantes en Línea.
  // También la que quedó en borrador con su número reservado: es la que se
  // cortó a medio emitir, y pedir el CAE de nuevo es cómo se recupera.
  const seEmite =
    puedeEmitir && !d.conCae && (d.sinNumero || d.estado === 'borrador') && d.estado !== 'anulada' && !d.esNota;
  const qr = d.qr
    ? await QRCode.toString(d.qr, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
    : null;

  return (
    <div className="cbte">
      {!d.conCae && (
        <div className="aviso">
          <b>Factura sin CAE.</b> Es la factura como la tiene anotada el OS: sirve para revisar
          el detalle, no es el comprobante de ARCA.
          {d.motivo && <div className="motivo">ARCA la rechazó: {d.motivo}</div>}
          {seEmite && <PedirCae id={d.id} />}
        </div>
      )}
      {d.anuladaPor && (
        <div className="aviso">
          <b>Factura anulada.</b> La anuló la{' '}
          <a href={`/os/psicotecnicos/facturacion/comprobante/${d.anuladaPor.id}`}>
            Nota de crédito C N° {d.anuladaPor.numero}
          </a>{' '}
          del {d.anuladaPor.fecha}. Ya no vale como comprobante de una venta.
        </div>
      )}
      {d.conCae && d.dePrueba && (
        <div className="aviso">
          <b>Comprobante de prueba.</b> El CAE es del ARCA de homologación: sirve para probar
          el sistema y no tiene validez fiscal.
        </div>
      )}

      <div className="factura-ch">
        <p className="fc-bajar">
          <a href={`/api/os/factura-pdf/${d.id}`}>Descargar PDF</a>
        </p>
        {EJEMPLARES.map((ejemplar) => (
          <div className={`fc-hoja${d.conCae && d.dePrueba ? ' prueba' : ''}`} key={ejemplar}>
            {/* La marca, sobre la misma banda de la orden de compra. */}
            <header className="fc-banda">
              <div className="fc-marca">{d.emisor.marca}</div>
              {/* Qué ejemplar es, arriba y al medio, donde va en todo comprobante. */}
              <span className="fc-original">{ejemplar}</span>
              <span className="fc-sitio">{SITIO}</span>
            </header>

            <div className="fc-cuerpo">
              {/* -------------------------------------- qué comprobante es */}
              <section className="fc-titulo">
                <div className="fc-letra">
                  <b>C</b>
                  <span>Cód. {d.codigo}</span>
                </div>
                <div className="fc-titulo-datos">
                  <h1>{d.titulo}</h1>
                  <p>
                    <em>Punto de venta:</em> <b>{d.puntoVenta}</b>
                    <em className="fc-sep">Comp. Nro:</em> <b>{d.numero}</b>
                  </p>
                  <p>
                    <em>Fecha de emisión:</em> <b>{d.fecha}</b>
                  </p>
                  {d.anula && (
                    <p>
                      <em>Anula la Factura C N°:</em> <b>{d.anula.numero}</b>
                      <em className="fc-sep">del</em> {d.anula.fecha}
                    </p>
                  )}
                </div>
                <div className="fc-periodo">
                  <p>
                    <em>Período facturado:</em> {d.desde} al {d.hasta}
                  </p>
                  <p>
                    <em>Vto. para el pago:</em> {d.vencePago}
                  </p>
                </div>
              </section>

              {/* ---------------------------- quién emite y a quién, lado a lado */}
              <section className="fc-partes">
                <div>
                  <h2>Emite</h2>
                  <p>
                    <b>{d.emisor.razonSocial}</b>
                  </p>
                  <p>
                    <em>CUIT:</em> {d.emisor.cuit}
                  </p>
                  <p>
                    <em>Condición frente al IVA:</em> {d.emisor.condicionIva}
                  </p>
                  <p>
                    <em>Domicilio comercial:</em> {d.emisor.domicilio}
                  </p>
                  <p>
                    <em>Ingresos Brutos:</em> {d.emisor.ingresosBrutos}
                  </p>
                  <p>
                    <em>Inicio de actividades:</em> {d.emisor.inicio}
                  </p>
                </div>
                <div>
                  <h2>Cliente</h2>
                  <p>
                    <b>{d.cliente.razonSocial}</b>
                  </p>
                  <p>
                    <em>CUIT:</em> {d.cliente.cuit}
                  </p>
                  <p>
                    <em>Condición frente al IVA:</em> {d.cliente.condicionIva}
                  </p>
                  <p>
                    <em>Domicilio:</em> {d.cliente.domicilio}
                  </p>
                  <p>
                    <em>Condición de venta:</em> Transferencia bancaria
                  </p>
                  {/* Son dos números distintos: el que dio el cliente, que exige
                      ver en la factura, y el de nuestra orden de compra, que es
                      con el que se pidió el trabajo. */}
                  {d.cliente.ordenPropia && (
                    <p>
                      <em>Orden de compra del cliente:</em> <b>{d.cliente.ordenPropia}</b>
                    </p>
                  )}
                  {d.cliente.ordenesNuestras.length > 0 && (
                    <p>
                      <em>
                        {d.cliente.ordenesNuestras.length === 1
                          ? 'Orden de compra Campos HR:'
                          : 'Órdenes de compra Campos HR:'}
                      </em>{' '}
                      {d.cliente.ordenesNuestras.map((n) => `#${n}`).join(', ')}
                    </p>
                  )}
                </div>
              </section>

              {/* -------------------------------------------------------- la tabla */}
              <table className="fc-tabla">
                <thead>
                  <tr>
                    <th>Producto / Servicio</th>
                    <th className="num">Cantidad</th>
                    <th>U. medida</th>
                    <th className="num">Precio unit.</th>
                    <th className="num">% Bonif.</th>
                    <th className="num">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {d.renglones.map((r) => (
                    <tr key={r.id}>
                      <td>{r.texto}</td>
                      <td className="num">1,00</td>
                      <td>unidades</td>
                      <td className="num">{r.importe === null ? '—' : pesos(r.importe)}</td>
                      <td className="num">0,00</td>
                      <td className="num">{r.importe === null ? '—' : pesos(r.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="fc-estira" />

              {/* ------------------------------------------------------ los totales */}
              <section className="fc-totales">
                <div className="fc-linea">
                  <span>Subtotal</span>
                  <span className="fc-puntos" />
                  <b>$ {pesos(d.total)}</b>
                </div>
                <div className="fc-linea">
                  <span>Importe otros tributos</span>
                  <span className="fc-puntos" />
                  <b>$ {pesos(0)}</b>
                </div>
                <div className="fc-total">
                  <span>Importe total</span>
                  <span>$ {pesos(d.total)}</span>
                </div>
              </section>

              {/* ---------------------------------------------------------- el CAE */}
              <section className="fc-pie">
                {qr ? (
                  <div className="fc-qr fc-qr-listo" dangerouslySetInnerHTML={{ __html: qr }} />
                ) : (
                  <div className="fc-qr">QR</div>
                )}
                <div className="fc-arca">
                  {/* El logotipo de ARCA, al lado del QR, como en su comprobante. */}
                  <div
                    className="fc-arca-logo"
                    role="img"
                    aria-label="ARCA, Agencia de Recaudación y Control Aduanero"
                    dangerouslySetInnerHTML={{ __html: LOGO_ARCA }}
                  />
                  <b>
                    {d.conCae
                      ? d.dePrueba
                        ? 'Autorizado en homologación'
                        : 'Comprobante autorizado'
                      : 'Comprobante sin autorizar'}
                  </b>
                  <span>
                    Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la
                    operación.
                  </span>
                </div>
                <div className="fc-cae">
                  <p>
                    <em>CAE N°:</em> <b>{d.cae ?? '—'}</b>
                  </p>
                  <p>
                    <em>Fecha de vto. de CAE:</em> <b>{d.caeVence ?? '—'}</b>
                  </p>
                </div>
              </section>
            </div>

            {/* Sin la bajada de la marca: en la orden de compra acompaña, en una
                factura es un texto de más al pie de un comprobante. */}
            <footer className="fc-firma">
              <span className="fc-sitio">{SITIO}</span>
            </footer>
          </div>
        ))}

        <p className="fc-volver">
          {d.numeroLargo} · {d.cliente.nombre} ·{' '}
          <a href="/os/psicotecnicos/facturacion">volver a Facturación</a> ·{' '}
          <a href={`/api/os/factura-pdf/${d.id}`}>bajar el PDF</a> con los tres ejemplares
        </p>
      </div>
    </div>
  );
}
