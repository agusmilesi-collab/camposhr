import { listarCotizaciones, formatoImporte, formatoFecha, ABIERTOS } from '@/lib/cotizaciones';
import CopyLink from '../informes/CopyLink';

export const dynamic = 'force-dynamic';

const BASE = 'https://camposhr.com/q';

export default async function Cotizaciones() {
  const todas = await listarCotizaciones();

  const abiertas = todas.filter((c) => ABIERTOS.includes(c.estado)).length;
  const aprobadas = todas.filter((c) => c.estado === 'Aprobada');
  const montoAprobado = aprobadas.reduce((a, c) => a + c.importe, 0);

  return (
    <main className="wrap wrap-ancho">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Propuestas enviadas</div>
          <a href="/" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Herramientas
          </a>
        </div>
        <h1>Cotizaciones</h1>
        <p className="head-nota">
          Cada cotización tiene su enlace para mandarle al cliente. El estado se
          sigue desde el OS, en Comercial.
        </p>
      </section>

      <section className="cot-resumen">
        <div className="cot-dato">
          <b>{todas.length}</b>
          <span>cotizaciones</span>
        </div>
        <div className="cot-dato">
          <b>{abiertas}</b>
          <span>esperando respuesta</span>
        </div>
        <div className="cot-dato">
          <b>{aprobadas.length}</b>
          <span>aprobadas</span>
        </div>
        <div className="cot-dato">
          <b>{formatoImporte(montoAprobado)}</b>
          <span>aprobado</span>
        </div>
      </section>

      <section className="cotizaciones">
        {todas.length === 0 ? (
          <p className="empty">Todavía no hay cotizaciones cargadas.</p>
        ) : (
          <div className="card cot-tabla">
            <div className="cot-row cot-th">
              <span>Fecha</span>
              <span>Cliente</span>
              <span>Concepto</span>
              <span className="cot-num">Importe</span>
              <span>Estado</span>
              <span>Enlace</span>
            </div>

            {todas.map((c) => {
              // Una oportunidad puede existir sin propuesta escrita: es un Lead
              // que todavía no tiene documento que mandar.
              const url = c.token ? `${BASE}/${c.token}` : null;
              return (
                <div className="cot-row" key={c.id}>
                  <span className="cot-fecha">{formatoFecha(c.fecha)}</span>
                  <span className="cot-cliente">{c.cliente}</span>
                  <span className="cot-concepto">
                    {c.concepto}
                    <em className="cot-version">v{c.version}</em>
                                      </span>
                  <span className="cot-num cot-importe">
                    {formatoImporte(c.importe)}
                  </span>
                  <span>
                    <em className={`cot-estado e-${c.estado.toLowerCase()}`}>
                      {c.estado}
                    </em>
                  </span>
                  {/* El token no se muestra: lo que se hace con el enlace es
                      abrirlo o copiarlo, y verlo escrito no aporta nada. */}
                  <span className="cot-accion">
                    {url ? (
                      <>
                        <a className="cot-abrir" href={url} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                        <CopyLink url={url} />
                      </>
                    ) : (
                      <em className="cot-version">sin propuesta escrita</em>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
