import { formatoFecha } from '@/lib/comercial-tipos';
import {
  CONDICIONES,
  PASOS_SIGUIENTES,
  REFERENCIA_EN_LA_HOJA,
  SITIO,
  notasDe,
  pesosDeOrden,
  type Orden,
} from '@/lib/orden-compra-tipos';
import './orden-gracias.css';

/**
 * Lo que ve quien termina de cargar candidatos: el gracias y la orden de
 * compra que se acaba de generar.
 *
 * Es la orden dicha para una pantalla y no para una hoja: primero la
 * confirmación (el tilde y el gracias, que es lo que la persona necesita saber
 * en ese momento), después el contenido de la orden, qué sigue, y de dónde
 * bajarla. El PDF es el documento; esto es el aviso de que se generó.
 *
 * No trae nada del servidor adentro: lo dibujan los formularios del portal,
 * que son componentes de cliente, con la orden que les devuelve la ruta.
 *
 * Pensada primero para el teléfono: el pedido se carga muchas veces desde ahí.
 */
export default function OrdenGracias({
  orden,
  pdf,
  volver,
  children,
}: {
  orden: Orden;
  /** De dónde se baja el PDF. */
  pdf: string;
  /** A dónde lleva "Volver al portal". Sin esto, el botón no sale. */
  volver?: string;
  /** Un botón más, al final: "Cargar otro pedido". */
  children?: React.ReactNode;
}) {
  // En la pantalla, la orden se acaba de generar: el dólar de referencia es
  // el de hoy, y dicho así se entiende sin ir a buscar la fecha.
  const notas = notasDe(orden.filas).map((n) => n.replace(REFERENCIA_EN_LA_HOJA, 'el de hoy'));

  return (
    <div className="orden-gracias">
      <div className="og-tarjeta">
        <div className="og-marca">Campos HR</div>

        <header className="og-cabeza">
          <div className="og-tilde" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h1>Gracias</h1>
          <p>Recibimos tu pedido. Esta es la orden de compra que se generó.</p>
        </header>

        <section className="og-bloque">
          <h2>
            Orden de compra {orden.numero && <span>#{orden.numero}</span>}
          </h2>
          <dl>
            <div>
              <dt>Cliente</dt>
              <dd>{orden.cliente}</dd>
            </div>
            {orden.solicitantes.length > 0 && (
              <div>
                <dt>Solicitado por</dt>
                <dd>{orden.solicitantes.join(' · ')}</dd>
              </div>
            )}
            <div>
              <dt>Fecha</dt>
              <dd>{formatoFecha(orden.fecha)}</dd>
            </div>
          </dl>
        </section>

        <section className="og-bloque">
          <h2>Detalle</h2>
          {orden.filas.map((r, i) => (
            <div className="og-fila" key={i}>
              <div className="og-linea">
                <span className="og-concepto">{r.concepto}</span>
                <span className="og-puntos" />
                <span className="og-importe">
                  {r.importe === null ? 'a confirmar' : pesosDeOrden(r.importe)}
                </span>
              </div>
              {r.detalle && <div className="og-sub">{r.detalle}</div>}
            </div>
          ))}
          {notas.map((n) => (
            <p className="og-nota" key={n}>
              {n}
            </p>
          ))}
        </section>

        <section className="og-bloque og-totales">
          <div className="og-linea">
            <span className="og-concepto">Subtotal</span>
            <span className="og-puntos" />
            <span className="og-importe">{pesosDeOrden(orden.total)}</span>
          </div>
          <div className="og-total">
            <span>Total</span>
            <span>{pesosDeOrden(orden.total)}</span>
          </div>
        </section>

        <section className="og-bloque og-condiciones">
          <h2>Condiciones</h2>
          {CONDICIONES.map((c) => (
            <p key={c.rotulo}>
              <em>{c.rotulo}:</em> {c.texto}
            </p>
          ))}
        </section>

        <section className="og-bloque og-sigue">
          <h2>Qué sigue</h2>
          <ol>
            {PASOS_SIGUIENTES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </section>

        <div className="og-acciones">
          <a className="og-boton" href={pdf}>
            Descargar la orden en PDF
          </a>
          {volver && (
            <a className="og-boton og-boton-claro" href={volver}>
              Volver al portal
            </a>
          )}
          {children}
        </div>

        <footer className="og-pie">{SITIO}</footer>
      </div>
    </div>
  );
}
