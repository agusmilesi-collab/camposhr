import {
  BAJADA,
  SITIO,
  formaDeOrden,
  notasDe,
  pesosDeOrden,
  type FormaDelPapel,
  type Orden,
} from '@/lib/orden-compra-tipos';
import './hoja-papel.css';

/**
 * La hoja de Campos HR, en pantalla: la orden de compra, el recibo de pago y
 * la factura que todavía no tiene CAE.
 *
 * Los tres papeles son el mismo diseño con otro título, otros datos arriba y
 * otro cierre: eso es `forma`. Sin ella, se dibuja una orden de compra.
 *
 * **Acá se decide el diseño.** El PDF (`lib/orden-pdf.ts`) copia las medidas
 * de esta hoja pasadas de píxeles a puntos, así que un cambio acá hay que
 * llevarlo allá.
 */
export default function HojaPapel({
  orden,
  forma = formaDeOrden(orden),
  arriba,
}: {
  orden: Orden;
  forma?: FormaDelPapel;
  /** Un aviso por encima de la hoja, fuera del papel: no se imprime. */
  arriba?: React.ReactNode;
}) {
  const notas = notasDe(orden.filas);
  return (
    <div className="orden-compra">
      {arriba && <div className="oc-arriba">{arriba}</div>}
      <div className="oc-hoja">
        <header className="oc-banda">
          <div className="oc-marca">Campos HR</div>
          <div className="oc-donde">
            <div className="oc-sitio">{SITIO}</div>
          </div>
        </header>

        <main className="oc-cuerpo">
          <section className="oc-datos">
            <h1>
              {forma.titulo}{' '}
              {orden.numero && (
                <span>
                  {forma.prefijo ?? '#'}
                  {orden.numero}
                </span>
              )}
            </h1>
            {forma.datos.map((d) => (
              <p key={d.rotulo}>
                <em>{d.rotulo}:</em> {d.valor}
              </p>
            ))}
          </section>

          <section className="oc-detalle">
            <h2>Detalle</h2>
            {orden.filas.map((r, i) => (
              <div className="oc-fila" key={i}>
                <div className="oc-linea">
                  <span className="oc-concepto">{r.concepto}</span>
                  <span className="oc-puntos" />
                  <span className="oc-importe">{r.importe === null ? '' : pesosDeOrden(r.importe)}</span>
                </div>
                {r.detalle && <div className="oc-sub">{r.detalle}</div>}
              </div>
            ))}
            {notas.map((n) => (
              <p className="oc-nota" key={n}>
                {n}
              </p>
            ))}
          </section>

          <section className="oc-totales">
            <div className="oc-linea">
              <span className="oc-subtotal">Subtotal</span>
              <span className="oc-puntos" />
              <span className="oc-importe">{pesosDeOrden(orden.total)}</span>
            </div>
            <div className="oc-total">
              <span>{forma.rotuloTotal}</span>
              <span>{pesosDeOrden(orden.total)}</span>
            </div>
          </section>

          <section className="oc-pago">
            <p className="oc-pago-linea">
              <b>{forma.cierre.titulo}</b>
            </p>
            {forma.cierre.lineas.map((c) => (
              <p key={c.rotulo}>
                <em>{c.rotulo}:</em> {c.texto}
              </p>
            ))}
          </section>
        </main>

        <footer className="oc-pie">
          <div className="oc-bajada">
            {BAJADA.map((b, i) => (
              <span key={b}>
                {i > 0 && <i>·</i>}
                {b}
              </span>
            ))}
          </div>
          <span className="oc-sitio">{SITIO}</span>
        </footer>
      </div>
    </div>
  );
}
