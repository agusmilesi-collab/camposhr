import { Fragment } from 'react';
import { empresaIdDeToken } from '@/lib/clients';
import { getDatosCliente, type Busqueda } from '@/lib/airtable';

export const dynamic = 'force-dynamic';

/** Traducción de los estados internos a lenguaje de cliente. */
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  'Sin asignar':     { texto: 'Pendiente de asignación',  clase: 'gray' },
  'Por citar':       { texto: 'Pendiente de coordinación', clase: 'gray' },
  'Por entrevistar': { texto: 'Entrevista agendada',       clase: 'amber' },
  'Por analizar':    { texto: 'En análisis',               clase: 'blue' },
  'Entregado':       { texto: 'Informe entregado',         clase: 'green' },
  'Seguimiento':     { texto: 'En seguimiento',            clase: 'violet' },
};

/** Orden del pipeline: agrupa los candidatos por etapa al mostrarlos. */
const ORDEN: Record<string, number> = {
  'Sin asignar': 0,
  'Por citar': 1,
  'Por entrevistar': 2,
  'Por analizar': 3,
  'Entregado': 4,
  'Seguimiento': 5,
};

const TZ = 'America/Argentina/Buenos_Aires';
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function fecha(iso: string | null, conHora = false): string | null {
  if (!iso) return null;

  // Los campos de solo fecha ("2026-07-29") no llevan zona horaria: si los
  // pasáramos por la conversión a Argentina (-3) retrocederían un día.
  // Se formatean tal cual vienen.
  if (SOLO_FECHA.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
    });
  }

  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions = conHora
    ? {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: TZ,
      }
    : { day: '2-digit', month: 'short', timeZone: TZ };
  return d.toLocaleDateString('es-AR', opts);
}

function Acceso() {
  return (
    <div className="gate">
      <div className="gate-box">
        <h1>Enlace no válido</h1>
        <p>
          Este enlace no corresponde a ningún cliente activo. Si creés que es un
          error, escribinos y te enviamos uno nuevo.
        </p>
      </div>
    </div>
  );
}

export default async function Portal({ params }: { params: { token: string } }) {
  const empresaId = empresaIdDeToken(params.token);
  if (!empresaId) return <Acceso />;

  const datos = await getDatosCliente(empresaId);
  if (!datos) return <Acceso />;

  const { empresa, busquedas } = datos;

  // Una búsqueda está "completa" cuando tiene candidatos y todos tienen el
  // informe entregado. Las completas se agrupan al final, separadas del resto.
  const esCompleta = (b: Busqueda) =>
    b.candidatos.length > 0 &&
    b.candidatos.every((c) => c.estado === 'Entregado');

  const ordenadas = [...busquedas].sort(
    (a, b) => Number(esCompleta(a)) - Number(esCompleta(b))
  );

  return (
    <>
      <header className="top">
        <div className="wrap top-inner">
          <div className="brand">
            Campos HR <span>· Portal Clientes</span>
          </div>
          <div className="top-meta">
            Actualizado {new Date().toLocaleDateString('es-AR', { timeZone: TZ })}
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="head">
          <div className="eyebrow">Estado de evaluaciones</div>
          <h1>{empresa}</h1>
        </section>

        <section className="busquedas">
          {busquedas.length === 0 && (
            <div className="card">
              <p className="empty">Todavía no hay búsquedas cargadas.</p>
            </div>
          )}

          {ordenadas.map((b: Busqueda, i: number) => {
            const cands = [...b.candidatos].sort(
              (x, y) =>
                (ORDEN[x.estado] ?? 9) - (ORDEN[y.estado] ?? 9) ||
                x.nombre.localeCompare(y.nombre)
            );
            const n = b.candidatos.length;
            // El separador aparece antes de la primera búsqueda completa,
            // siempre que antes hubiera al menos una búsqueda en curso.
            const mostrarSep =
              i > 0 && esCompleta(b) && !esCompleta(ordenadas[i - 1]);
            return (
              <Fragment key={b.id}>
                {mostrarSep && (
                  <div className="group-sep">
                    <span>Con informes entregados</span>
                  </div>
                )}
              <article className="card">
                <div className="card-head">
                  <div className="card-head-main">
                    <h2>{b.puesto}</h2>
                  </div>
                  <div className="card-head-count">
                    {b.fecha && (
                      <span className="req-date">
                        solicitada el <b>{fecha(b.fecha)}</b>
                      </span>
                    )}
                    <span>{n} {n === 1 ? 'candidato' : 'candidatos'}</span>
                  </div>
                </div>

                {cands.length === 0 ? (
                  <p className="empty">Sin candidatos asignados todavía.</p>
                ) : (
                  <div className="tabla">
                    <div className="tr th">
                      <span>Candidato</span>
                      <span>Estado</span>
                      <span>Evaluadora</span>
                      <span>Entrevista</span>
                      <span>Entrega est.</span>
                    </div>
                    {cands.map((c) => {
                      const e = ESTADOS[c.estado] ?? { texto: c.estado, clase: 'gray' };
                      const fe = fecha(c.fechaEntrevista, true);
                      const fen = fecha(c.fechaEntrega);
                      return (
                        <div className="tr" key={c.id}>
                          <span className="c-name">{c.nombre}</span>
                          <span className="c-estado" data-label="Estado">
                            <i className={`dot ${e.clase}`} />
                            {e.texto}
                          </span>
                          <span className="c-evaluadora" data-label="Evaluadora">
                            {c.evaluadora ?? <span className="dash">—</span>}
                          </span>
                          <span className="c-fecha" data-label="Entrevista">
                            {fe ? (
                              <>
                                {fe}
                                {c.modalidad ? <em>· {c.modalidad}</em> : null}
                              </>
                            ) : (
                              <span className="dash">—</span>
                            )}
                          </span>
                          <span className="c-fecha" data-label="Entrega est.">
                            {fen && c.estado !== 'Entregado' ? (
                              fen
                            ) : (
                              <span className="dash">—</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
              </Fragment>
            );
          })}
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          Los informes psicotécnicos se entregan directamente por los canales
          acordados. Esta vista muestra únicamente el estado de avance.
        </div>
      </footer>
    </>
  );
}
