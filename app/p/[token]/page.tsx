import { getDatosCliente, type Busqueda, type Candidato } from '@/lib/airtable';
import { datosDemoConAirtable, esDemo } from '@/lib/portal-demo';
import TablaEntregados, { type FilaEntregada } from './TablaEntregados';
import NuevoPedido from './NuevoPedido';
import { COBROS, cobro } from '@/lib/cobro';

export const dynamic = 'force-dynamic';

/** Traducción de los estados internos a lenguaje de cliente. */
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  'Sin asignar':     { texto: 'A asignar',   clase: 'gray' },
  'Por citar':       { texto: 'A coordinar', clase: 'gray' },
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

/** Conclusión del informe: color del punto, texto que se muestra y lugar que
 *  ocupa al ordenar (del apto al no apto). Las claves son las opciones del
 *  campo Recomendación de Airtable; si mañana se agrega una opción nueva, la
 *  fila la escribe tal cual, en gris y al final del orden hasta sumarla acá. */
const RECOMENDACIONES: Record<
  string,
  { texto: string; clase: string; orden: number }
> = {
  'Apto':                   { texto: 'Apto',             clase: 'green',  orden: 0 },
  'Apto con observaciones': { texto: 'Apto con obs.',    clase: 'amber',  orden: 1 },
  'Apto con alertas':       { texto: 'Apto con alertas', clase: 'orange', orden: 2 },
  'No apto':                { texto: 'No apto',          clase: 'red',    orden: 3 },
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

/** Una fila de la tabla de entregados: el candidato con los datos del pedido. */
type Entregado = { cand: Candidato; puesto: string; fechaPedido: string | null };

export default async function Portal({ params }: { params: { token: string } }) {
  const demo = esDemo(params.token);
  const datos = demo
    ? await datosDemoConAirtable()
    : await getDatosCliente(params.token);
  if (!datos) return <Acceso />;

  const { empresa, busquedas } = datos;

  // Los informes ya entregados salen de la tarjeta de su búsqueda y se juntan
  // en una sola tabla al final, ordenada por fecha de pedido: el cliente los
  // lee como una lista de entregas, no búsqueda por búsqueda.
  const entregados: Entregado[] = busquedas
    .flatMap((b) =>
      b.candidatos
        .filter((c) => c.estado === 'Entregado')
        .map((c) => ({ cand: c, puesto: b.puesto, fechaPedido: b.fecha }))
    )
    .sort(
      (a, b) =>
        (b.fechaPedido ?? '').localeCompare(a.fechaPedido ?? '') ||
        a.cand.nombre.localeCompare(b.cand.nombre)
    );

  // La tabla de entregados se ordena en el navegador, apretando cualquiera de
  // sus encabezados: acá se le pasa cada fila ya resuelta.
  const filasEntregadas: FilaEntregada[] = entregados.map(
    ({ cand: c, puesto, fechaPedido }) => {
      const r = c.recomendacion
        ? RECOMENDACIONES[c.recomendacion] ?? {
            texto: c.recomendacion,
            clase: 'gray',
            orden: 9,
          }
        : null;
      return {
        id: c.id,
        fechaOrden: fechaPedido ?? '',
        fechaTexto: fecha(fechaPedido),
        puesto,
        nombre: c.nombre,
        evaluadora: c.evaluadora,
        recoTexto: r?.texto ?? null,
        recoCompleta: c.recomendacion,
        recoClase: r?.clase ?? 'gray',
        recoOrden: r?.orden ?? 9,
        informe: c.tieneInforme
          ? `/p/${params.token}/informe/${c.id}`
          : null,
        cobro: cobro(c),
      };
    }
  );

  // En curso: las búsquedas que todavía tienen algún candidato sin entregar,
  // más las que aún no tienen ningún candidato asignado.
  const enCurso = busquedas
    .map((b) => ({
      ...b,
      candidatos: b.candidatos.filter((c) => c.estado !== 'Entregado'),
    }))
    .filter((b, i) => b.candidatos.length > 0 || busquedas[i].candidatos.length === 0);

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
        <section className="head head-cliente">
          <div>
            <div className="eyebrow">Estado de evaluaciones</div>
            <h1>{empresa}</h1>
          </div>
          {/* El alta de pedidos se está probando con el cliente de prueba: hasta
              que el formulario escriba en Airtable, el portal real no lo
              muestra. */}
          {demo && <NuevoPedido empresa={empresa} />}
        </section>

        <section className="busquedas">
          {busquedas.length === 0 && (
            <div className="card">
              <p className="empty">Todavía no hay búsquedas cargadas.</p>
            </div>
          )}

          {enCurso.map((b: Busqueda) => {
            const cands = [...b.candidatos].sort(
              (x, y) =>
                (ORDEN[x.estado] ?? 9) - (ORDEN[y.estado] ?? 9) ||
                x.nombre.localeCompare(y.nombre)
            );
            const n = cands.length;
            return (
              <article className="card" key={b.id}>
                <div className="card-head">
                  <div className="card-head-main">
                    <h2>{b.puesto}</h2>
                  </div>
                  <div className="card-head-count">
                    {n > 0 && (
                      <span>
                        <b>{n}</b> {n === 1 ? 'candidato' : 'candidatos'}
                      </span>
                    )}
                    {b.fecha && (
                      <span className="req-date">
                        solicitud <b>{fecha(b.fecha)}</b>
                      </span>
                    )}
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
                      <span>Modalidad</span>
                      <span>Entrega</span>
                      <span>Facturación</span>
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
                            {fe ?? <span className="dash">—</span>}
                          </span>
                          <span className="c-modalidad" data-label="Modalidad">
                            {c.modalidad ?? <span className="dash">—</span>}
                          </span>
                          <span className="c-fecha" data-label="Entrega">
                            {fen ? fen : <span className="dash">—</span>}
                          </span>
                          {/* El cobro también en curso: una evaluación se puede
                              facturar antes de entregar el informe, así que el
                              estado corre desde que el candidato entra. */}
                          <span className="c-cobro" data-label="Facturación">
                            <i className={`dot ${COBROS[cobro(c)].clase}`} />
                            <span className="cobro-txt" title={COBROS[cobro(c)].detalle}>
                              {COBROS[cobro(c)].texto}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}

          {entregados.length > 0 && (
            <>
              <div className="group-sep">
                <span>Informes entregados</span>
              </div>
              <article className="card">
                <TablaEntregados filas={filasEntregadas} descargaAbierta={demo} />
              </article>
            </>
          )}
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          Los informes quedan disponibles en esta pantalla y se envían también
          por los canales acordados.
        </div>
      </footer>
    </>
  );
}
