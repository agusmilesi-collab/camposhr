import { getDatosCliente, type Busqueda, type Candidato } from '@/lib/airtable';
import { datosDemoConAirtable, esDemo } from '@/lib/portal-demo';
import { datosClienteDeSupabase, vaPorAirtable } from '@/lib/portal-supabase';
import TablaEntregados, { type FilaEntregada } from './TablaEntregados';
import { yaEntregada } from '@/lib/psicotecnicos-tipos';
import NuevoPedido from './NuevoPedido';
import { bateriasDelPortal } from '@/lib/baterias-portal';
import { COBROS, COBRO_PUBLICADO, cobro } from '@/lib/cobro';
import { informeDe, serviciosDe } from '@/lib/servicios';

export const dynamic = 'force-dynamic';

/** Traducción de los estados internos a lenguaje de cliente. */
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  'Sin asignar':     { texto: 'A asignar',         clase: 'gray' },
  'Por citar':       { texto: 'A coordinar',       clase: 'gray' },
  'Por entrevistar': { texto: 'Agendada',          clase: 'green' },
  'Por analizar':    { texto: 'En análisis',       clase: 'blue' },
  'Entregado':       { texto: 'Informe entregado', clase: 'green' },
  'Seguimiento':     { texto: 'En seguimiento',    clase: 'violet' },
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
 *  ocupa al ordenar. Las claves son las opciones del campo Recomendación de
 *  Airtable; si mañana se agrega una opción nueva, la fila la escribe tal cual,
 *  en gris y al final del orden hasta sumarla acá.
 *
 *  Son dos juegos que nunca conviven en un mismo cliente. Las de arriba son de
 *  Selección, sobre un candidato externo. Las de abajo son de Mapeo, donde la
 *  persona ya trabaja en la empresa y lo que se mide es su encaje con el puesto
 *  que ocupa hoy: ahí "no apto" sería una sentencia sobre alguien que ya está
 *  adentro, y en varios casos el desencaje es del puesto y no de la persona.
 *  El texto va corto porque la columna es angosta; el largo aparece al pasar
 *  el cursor. */
const RECOMENDACIONES: Record<
  string,
  { texto: string; clase: string; orden: number }
> = {
  'Apto':                   { texto: 'Apto',             clase: 'green',  orden: 0 },
  'Apto con observaciones': { texto: 'Apto con obs.',    clase: 'amber',  orden: 1 },
  'Apto con alertas':       { texto: 'Apto con alertas', clase: 'orange', orden: 2 },
  'No apto':                { texto: 'No apto',          clase: 'red',    orden: 3 },

  'Encaja con el puesto':            { texto: 'Encaja',           clase: 'green',  orden: 0 },
  'Encaja, con desarrollo':          { texto: 'Con desarrollo',   clase: 'amber',  orden: 1 },
  'Encaja si cambia el puesto':      { texto: 'Cambia el puesto', clase: 'orange', orden: 2 },
  'Sin puesto contra el cual medir': { texto: 'Sin puesto',       clase: 'gray',   orden: 4 },
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

/** Los candidatos de una búsqueda, agrupados por etapa del pipeline. */
function ordenar(cands: Candidato[]): Candidato[] {
  return [...cands].sort(
    (x, y) =>
      (ORDEN[x.estado] ?? 9) - (ORDEN[y.estado] ?? 9) ||
      x.nombre.localeCompare(y.nombre)
  );
}

/**
 * En qué punto del pipeline está una búsqueda.
 *
 * La del candidato menos avanzado, que es lo que todavía falta de esa
 * búsqueda: con uno agendado y otro en análisis, lo que queda por delante es
 * la entrevista. Una búsqueda sin candidatos va primero, porque no arrancó.
 */
function etapaDe(b: Busqueda): number {
  const etapas = b.candidatos.map((c) => ORDEN[c.estado] ?? 9);
  return etapas.length ? Math.min(...etapas) : -1;
}

/** Encabezado de las columnas de una tabla de candidatos en curso. */
function Encabezado({ conCobro }: { conCobro: boolean }) {
  return (
    <div className={`tr th${conCobro ? '' : ' sin-cobro'}`}>
      <span>Candidato</span>
      <span>Estado</span>
      <span>Evaluadora</span>
      <span>Entrevista</span>
      <span>Modalidad</span>
      <span>Entrega</span>
      {conCobro && <span>Facturación</span>}
    </div>
  );
}

/** Una fila de candidato en curso. */
function FilaCandidato({ c, conCobro }: { c: Candidato; conCobro: boolean }) {
  const e = ESTADOS[c.estado] ?? { texto: c.estado, clase: 'gray' };
  const fe = fecha(c.fechaEntrevista, true);
  const fen = fecha(c.fechaEntrega);
  return (
    <div className={`tr${conCobro ? '' : ' sin-cobro'}`}>
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
      {/* El cobro también en curso: una evaluación se puede facturar antes de
          entregar el informe, así que el estado corre desde que el candidato
          entra. */}
      {conCobro && (
        <span className="c-cobro" data-label="Facturación">
          <i className={`dot ${COBROS[cobro(c)].clase}`} />
          <span className="cobro-txt" title={COBROS[cobro(c)].detalle}>
            {COBROS[cobro(c)].texto}
          </span>
        </span>
      )}
    </div>
  );
}

/** Una fila de la tabla de entregados: el candidato con los datos del pedido. */
type Entregado = { cand: Candidato; puesto: string; fechaPedido: string | null };

export default async function Portal({ params }: { params: { token: string } }) {
  const demo = esDemo(params.token);
  // El enlace se resuelve primero contra Supabase, que es donde viven las
  // empresas ya migradas, y después contra Airtable, que es donde siguen las
  // demás. Un token existe en uno de los dos, nunca en los dos.
  //
  // Mientras el OS se termina, las evaluadoras siguen cargando en Airtable: los
  // clientes marcados leen de ahí, que es donde está su trabajo al día. Se
  // apaga por cliente, cuando el suyo pase a llevarse en el OS.
  const porAirtable = demo ? false : await vaPorAirtable(params.token);
  const deSupabase =
    demo || porAirtable ? null : await datosClienteDeSupabase(params.token);
  const datos = demo
    ? await datosDemoConAirtable()
    : (deSupabase ?? (await getDatosCliente(params.token)));
  if (!datos) return <Acceso />;

  const { empresa, empresaId, busquedas, informesVisibles } = datos;

  // Lo que el cliente lee al elegir sale de donde se edita, no de una copia.
  const baterias = await bateriasDelPortal();

  // Los documentos del trabajo de estructura, si el cliente lo tiene contratado.
  const servicios = serviciosDe(empresaId, params.token);

  // La facturación se publica donde el dato es cierto: en las empresas ya
  // migradas sale de las facturas emitidas en el OS. En las que siguen en
  // Airtable son dos tildes que nadie carga, y publicarlas le diría "sin
  // facturar" a informes ya cobrados. Ver la nota en lib/cobro.ts.
  const conCobro = COBRO_PUBLICADO || demo || Boolean(deSupabase);

  // Los informes ya entregados salen de la tarjeta de su búsqueda y se juntan
  // en una sola tabla al final, ordenada por fecha de pedido: el cliente los
  // lee como una lista de entregas, no búsqueda por búsqueda.
  const entregados: Entregado[] = busquedas
    .flatMap((b) =>
      b.candidatos
        .filter((c) => yaEntregada(c.estado))
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
        // De dónde sale el informe depende de dónde vive la evaluación. En
        // Supabase se arma con los datos cargados y se muestra en su página; en
        // Airtable es un archivo escrito a mano, y en el cliente de prueba
        // manda la tilde que trae la tabla.
        // Con los informes apagados no se arma ningún enlace: la tabla sale
        // sin esa columna y no hay dirección que probar. Ver `informesVisibles`.
        informe: !informesVisibles
          ? null
          : deSupabase
            ? c.tieneInforme
              ? `/p/${params.token}/evaluacion/${c.id}`
              : null
            : (demo ? c.tieneInforme : informeDe(empresaId, c.nombre))
              ? `/p/${params.token}/informe/${c.id}`
              : null,
        cobro: cobro(c),
      };
    }
  );

  // En curso: las búsquedas que todavía tienen algún candidato sin entregar,
  // más las que aún no tienen ningún candidato asignado.
  // Las búsquedas se leen como el pipeline: arriba lo que falta empezar y abajo
  // lo que está por salir, que es el orden en que se pregunta por ellas. Antes
  // salían por fecha de pedido y las etapas quedaban intercaladas.
  const enCurso = busquedas
    .map((b) => ({
      ...b,
      candidatos: b.candidatos.filter((c) => !yaEntregada(c.estado)),
    }))
    .filter((b, i) => b.candidatos.length > 0 || busquedas[i].candidatos.length === 0)
    .sort(
      (a, b) => etapaDe(a) - etapaDe(b) || (b.fecha ?? '').localeCompare(a.fecha ?? '')
    );

  /**
   * Cuántos informes hay en camino.
   *
   * Se cuentan candidatos y no búsquedas, para que la cuenta signifique lo
   * mismo de los dos lados: abajo dice cuántos informes se entregaron, y acá,
   * cuántos faltan. Una búsqueda con tres candidatos son tres informes.
   */
  const informesEnCurso = enCurso.reduce((n, b) => n + b.candidatos.length, 0);

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
          {/* El alta va en su propia pantalla y no en un cajón: el cliente
              está decidiendo una compra, no completando un trámite al costado
              de lo que estaba mirando. */}
          <a className="btn-primario" href={`/p/${params.token}/pedido`}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Nuevo pedido
          </a>
        </section>

        {/* El trabajo de fondo va arriba: las evaluaciones son una parte de él,
            no al revés. */}
        {servicios.map((sv) => (
          <section className="servicio" key={sv.titulo}>
            <div className="group-sep primera">
              <span>{sv.titulo}</span>
            </div>
            <article className="card servicio-card">
              <div className="docs">
                {sv.documentos.map((d) => (
                  <a className="doc" href={d.href} target="_blank" rel="noreferrer" key={d.nombre}>
                    <span className="doc-n">
                      {d.nombre}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M7 7h10v10" /></svg>
                    </span>
                    <span className="doc-d">{d.detalle}</span>
                  </a>
                ))}
              </div>
            </article>
          </section>
        ))}

        <section className="busquedas">
          {busquedas.length === 0 && (
            <div className="card">
              <p className="empty">Todavía no hay búsquedas cargadas.</p>
            </div>
          )}

          {/* Las dos mitades de la pantalla se anuncian igual: lo que está
              corriendo arriba y lo que ya se entregó abajo. Con la cuenta al
              lado: cuántas búsquedas hay abiertas y cuántos informes se
              entregaron es lo primero que se pregunta al abrir el portal. */}
          {enCurso.length > 0 && (
            <div className="group-sep primera">
              <span>Informes en curso ({informesEnCurso})</span>
            </div>
          )}

          {enCurso.map((b: Busqueda) => {
            const cands = ordenar(b.candidatos);
            return (
              <article className="card" key={b.id}>
                <div className="card-head">
                  <h2>{b.puesto}</h2>
                  {/* La fecha de solicitud, entre paréntesis y sin rótulo: en
                      una lista de búsquedas, una fecha ahí sólo puede ser esa. */}
                  {b.fecha && <span className="card-fecha">({fecha(b.fecha)})</span>}
                </div>

                {cands.length === 0 ? (
                  <p className="empty">Sin candidatos asignados todavía.</p>
                ) : (
                  <div className="tabla">
                    <Encabezado conCobro={conCobro} />
                    {cands.map((c) => (
                      <FilaCandidato c={c} conCobro={conCobro} key={c.id} />
                    ))}
                  </div>
                )}
              </article>
            );
          })}

          {entregados.length > 0 && (
            <>
              <div className="group-sep">
                <span>Informes entregados ({filasEntregadas.length})</span>
              </div>
              <article className="card">
                <TablaEntregados
                  filas={filasEntregadas}
                  conCobro={conCobro}
                  conInforme={informesVisibles}
                />
              </article>
            </>
          )}
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          {informesVisibles
            ? 'Los informes quedan disponibles en esta pantalla y se envían también por los canales acordados.'
            : 'Los informes se envían por los canales acordados.'}
        </div>
      </footer>
    </>
  );
}
