import { listarAsistentes, listarCiclos, listarCorridas } from '@/lib/ciclo';
import Alta from './Alta';

/**
 * Los encuentros en curso, y el alta de uno nuevo.
 *
 * Vive en el hub interno y no en el control de la expositora. Son dos momentos
 * distintos: dar de alta un cliente se hace la semana antes, sentada, y abrir
 * una actividad se hace en vivo con la sala esperando.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Encuentros — Campos HR',
  robots: { index: false, follow: false },
};

export default async function Encuentros() {
  const [corridas, ciclos] = await Promise.all([listarCorridas(), listarCiclos()]);

  const filas = [];
  for (const c of corridas) {
    filas.push({
      slug: c.empresas.slug,
      empresa: c.empresas.nombre,
      ciclo: c.ciclos.nombre,
      clave: c.clave_control,
      registrados: (await listarAsistentes(c.id)).length,
      abierta: Boolean(c.actividad_abierta_id),
    });
  }

  return (
    <main className="wrap">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Ciclos con actividades desde el teléfono</div>
          <a href="/presentaciones" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Presentaciones
          </a>
        </div>
        <h1>Encuentros</h1>
        <p className="head-nota">
          Cada cliente que recorre un ciclo tiene su propia dirección, su código
          de entrada y su clave de control. Las charlas son las mismas para
          todos: lo único que cambia es de dónde salen las respuestas.
        </p>
      </section>

      <section className="enc-tabla">
        {filas.length === 0 ? (
          <p className="empty">Todavía no hay ningún encuentro en curso.</p>
        ) : (
          <div className="card">
            {filas.map((f) => (
              <div className="enc-fila" key={f.slug}>
                <div className="enc-fila-quien">
                  <b>{f.empresa}</b>
                  <em>{f.ciclo}</em>
                </div>
                <span className="enc-fila-dato">
                  {f.registrados}{' '}
                  {f.registrados === 1 ? 'persona' : 'personas'}
                </span>
                <span className={`enc-fila-estado ${f.abierta ? 'abierta' : ''}`}>
                  {f.abierta ? 'Actividad abierta' : 'En reposo'}
                </span>
                <a
                  className="copiar"
                  href={`https://camposhr.com/ciclo/${f.slug}/control?k=${f.clave}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Control
                </a>
                <a className="copiar" href={`/ciclo/${f.slug}/qr`} target="_blank" rel="noreferrer">
                  Código
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="enc-alta">
        <Alta ciclos={ciclos.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      </section>
    </main>
  );
}
