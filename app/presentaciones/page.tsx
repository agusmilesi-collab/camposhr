import {
  listarPresentaciones,
  porCiclo,
  formatoFecha,
} from '@/lib/presentaciones';
export const dynamic = 'force-dynamic';

const BASE = 'https://tools.camposhr.com/pres';

export default function Presentaciones() {
  const todas = listarPresentaciones();
  const ciclos = porCiclo(todas);

  return (
    <main className="wrap wrap-ancho">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Material de los encuentros</div>
          <a href="/" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Herramientas
          </a>
        </div>
        <h1>Presentaciones</h1>
        <p className="head-nota">
          Cada presentación es un archivo que funciona sin internet: las
          tipografías y las imágenes viajan adentro. Para dar un encuentro,
          descargala antes y abrila desde la máquina. Se avanza con las flechas,
          la tecla F la pone en pantalla completa y la N abre las notas del
          orador en una ventana aparte, para la pantalla de la notebook.
        </p>
      </section>

      <section className="presentaciones">
        {todas.length === 0 ? (
          <p className="empty">Todavía no hay presentaciones cargadas.</p>
        ) : (
          ciclos.map((g) => (
            <div className="pres-ciclo" key={`${g.ciclo}-${g.cliente}`}>
              <div className="pres-ciclo-titulo">
                <h2>{g.ciclo}</h2>
                <em>{g.cliente}</em>
              </div>

              <div className="card pres-tabla">
                <div className="pres-row pres-th">
                  <span>Fecha</span>
                  <span>Encuentro</span>
                  <span className="pres-num">Placas</span>
                  <span />
                  <span />
                </div>

                {g.encuentros.map((p) => {
                  const url = `${BASE}/${p.token}`;
                  return (
                    <div className="pres-row" key={p.token}>
                      <span className="cot-fecha">{formatoFecha(p.fecha)}</span>
                      <span className="pres-encuentro">
                        <b>
                          {p.orden}. {p.titulo}
                        </b>
                        <em>{p.subtitulo}</em>
                      </span>
                      <span className="pres-num">{p.placas}</span>
                      <span className="pres-accion">
                        <a
                          className="copiar pres-ver"
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver presentación
                        </a>
                      </span>
                      <span className="pres-accion">
                        <a
                          className="copiar"
                          href={`/pres/${p.archivo}`}
                          download
                        >
                          Descargar
                        </a>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      <p className="cot-pie">
        Para dar de alta una presentación:{' '}
        <code>
          node scripts/publicar-presentacion.mjs &lt;html&gt; &lt;token&gt;
        </code>
        , sumar la fila en <code>data/presentaciones.json</code> y publicar. El
        script la deja sin rastro para los buscadores y sin tocar el contenido.
        Se publica la versión final, la que se va a dar: cada archivo pesa más de
        1 MB y el repositorio guarda todas las versiones para siempre.
      </p>
    </main>
  );
}
