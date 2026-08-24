import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';
import { datosDelHub, type PorEvaluadora, type Reparto } from '@/lib/data-hub';
import { enDias } from '@/lib/hora';

export const dynamic = 'force-dynamic';

/**
 * Data hub: los números del negocio, en tres ejes.
 *
 * Cómo trabaja cada evaluadora, qué piden los clientes y cómo es la gente que
 * se evalúa. **Los tres son de cosas que no cambian mañana.** En qué etapa está
 * cada ficha no entra: eso es la foto de hoy, se contesta mirando el pipeline y
 * no deja aprender nada.
 *
 * Cada medida lleva al lado sobre cuántos casos se calculó, y lo que todavía no
 * alcanza dice cuántos faltan en lugar de mostrarse igual.
 */

function Barras({ datos, vacio }: { datos: Reparto; vacio: string }) {
  if (datos.length === 0) return <p className="os-vacio">{vacio}</p>;
  const tope = Math.max(...datos.map((d) => d.n));
  return (
    <ul className="os-hub-barras">
      {datos.map((d) => (
        <li key={d.nombre}>
          <span className="os-hub-barra-nombre" title={d.nombre}>
            {d.nombre}
          </span>
          <span className="os-hub-barra">
            <span style={{ width: `${(d.n / tope) * 100}%` }} />
          </span>
          <span className="os-hub-barra-n">{d.n}</span>
        </li>
      ))}
    </ul>
  );
}

function Panel({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="os-panel">
      <div className="os-panel-top">
        <h2>{titulo}</h2>
        {nota && <span className="os-columna-monto">{nota}</span>}
      </div>
      <div className="os-panel-cuerpo">{children}</div>
    </section>
  );
}

/** Un eje del tablero, con su título y lo que agrupa. */
function Eje({ titulo, bajada, children }: { titulo: string; bajada: string; children: React.ReactNode }) {
  return (
    <section className="os-hub-eje">
      <div className="os-hub-eje-top">
        <h2>{titulo}</h2>
        <p>{bajada}</p>
      </div>
      {children}
    </section>
  );
}

/** La ficha de una evaluadora: sus números, no los del sistema. */
function FichaEvaluadora({ e }: { e: PorEvaluadora }) {
  return (
    <section className="os-panel os-hub-persona">
      <div className="os-panel-top">
        <h3>{e.nombre}</h3>
        <span className="os-columna-monto">
          {e.enCurso === 0 ? 'sin nada en curso' : `${e.enCurso} en curso`}
        </span>
      </div>
      <div className="os-panel-cuerpo">
        <div className="os-hub-kpis">
          <div className="os-hub-cifra">
            <span className="os-hub-rotulo">Entregadas</span>
            <span className="os-hub-valor">{e.entregadas}</span>
          </div>
          <div className="os-hub-cifra">
            <span className="os-hub-rotulo">Análisis</span>
            <span className="os-hub-valor">
              {e.analisis.mediana === null ? (
                <span className="os-dato-falta">sin datos</span>
              ) : (
                <>
                  {e.analisis.mediana}
                  <em> días</em>
                </>
              )}
            </span>
            <span className="os-hub-n">
              {e.analisis.n === 0
                ? 'de la entrevista a la entrega'
                : `mediana sobre ${e.analisis.n} · de la entrevista a la entrega`}
            </span>
          </div>
          <div className="os-hub-cifra">
            <span className="os-hub-rotulo">Puerta a puerta</span>
            <span className="os-hub-valor">
              {e.total.mediana === null ? (
                <span className="os-dato-falta">sin datos</span>
              ) : (
                <>
                  {e.total.mediana}
                  <em> días</em>
                </>
              )}
            </span>
            <span className="os-hub-n">
              {e.total.n === 0
                ? 'de la solicitud a la entrega'
                : `mediana sobre ${e.total.n} · lo que ve el cliente`}
            </span>
          </div>
          <div className="os-hub-cifra">
            <span className="os-hub-rotulo">Seguimientos hechos</span>
            <span className="os-hub-valor">{e.seguimientos}</span>
            <span className="os-hub-n">a los noventa días del ingreso</span>
          </div>
        </div>

        <div className="os-hub-conclusiones">
          <span className="os-hub-rotulo">Cómo cierra sus informes</span>
          <Barras datos={e.conclusiones} vacio="Todavía no cerró ninguno." />
        </div>
      </div>
    </section>
  );
}

export default async function DataHub() {
  const [yo, d] = await Promise.all([quienSoy(), datosDelHub()]);

  return (
    <Shell titulo="Data hub" identidad={yo.nombre} ancho>
      <div className="os-encabezado">
        <h1>Data hub</h1>
        <p>
          Cómo trabaja cada evaluadora, qué piden los clientes y cómo es la gente que se evalúa.
          Cada número dice sobre cuántos casos se calcula, y lo que todavía no se puede medir dice
          cuánto falta.
        </p>
      </div>

      {/* Los cuatro que contestan cómo va el negocio. Van arriba y solos: si hay
          que bajar para encontrarlos, el resto del tablero los tapa. */}
      <div className="os-hub-tapa">
        <div className="os-hub-kpi">
          <span className="os-hub-rotulo">Entregadas</span>
          <span className="os-hub-valor">{d.entregadas}</span>
          <span className="os-hub-n">de {d.total} evaluaciones cargadas</span>
        </div>
        <div className="os-hub-kpi">
          <span className="os-hub-rotulo">El informe pone condiciones</span>
          <span className="os-hub-valor">
            {d.discriminacion.cerrados === 0 ? (
              <span className="os-dato-falta">sin cerrar</span>
            ) : (
              <>
                {Math.round((d.discriminacion.conReserva / d.discriminacion.cerrados) * 100)}
                <em> %</em>
              </>
            )}
          </span>
          <span className="os-hub-n">
            {d.discriminacion.cerrados === 0
              ? 'todavía no hay informes cerrados'
              : `${d.discriminacion.conReserva} de ${d.discriminacion.cerrados} · el resto cierra en un sí liso`}
          </span>
        </div>
        <div className="os-hub-kpi">
          <span className="os-hub-rotulo">Del cliente más grande</span>
          <span className="os-hub-valor">
            {d.concentracion.delMayor === null ? (
              <span className="os-dato-falta">sin datos</span>
            ) : (
              <>
                {d.concentracion.delMayor}
                <em> %</em>
              </>
            )}
          </span>
          <span className="os-hub-n">
            {d.concentracion.nombreMayor
              ? `${d.concentracion.nombreMayor} · ${d.concentracion.clientes} clientes en total`
              : 'sin clientes cargados'}
          </span>
        </div>
        <div className="os-hub-kpi">
          <span className="os-hub-rotulo">Clientes que repiten</span>
          <span className="os-hub-valor">{d.concentracion.repiten}</span>
          <span className="os-hub-n">pidieron más de una búsqueda</span>
        </div>
      </div>

      <Eje
        titulo="Cada evaluadora"
        bajada="Volumen, tiempos y criterio de cierre. Los tiempos son medianas: una evaluación que se atrasó por el cliente no le mueve el número."
      >
        {d.evaluadoras.length === 0 ? (
          <section className="os-panel">
            <p className="os-vacio">Ninguna evaluación tiene evaluadora asignada.</p>
          </section>
        ) : (
          <div className="os-hub-personas">
            {d.evaluadoras.map((e) => (
              <FichaEvaluadora key={e.nombre} e={e} />
            ))}
          </div>
        )}
      </Eje>

      <Eje
        titulo="Qué tan completo está el protocolo"
        bajada="Cuántas evaluaciones tienen cada pieza cargada. Lo que falta acá es lo que después no se puede medir en ningún lado."
      >
        <div className="os-hub-dos">
          {d.completitud.map((c) => (
            <Panel key={c.pieza} titulo={c.pieza} nota={c.de === 0 ? 'no corresponde' : `${c.hechas} de ${c.de}`}>
              {c.de === 0 ? (
                <p className="os-vacio">Ningún pedido lo pide.</p>
              ) : (
                <>
                  <span className="os-hub-barra">
                    <span
                      className={c.hechas >= c.de ? 'completa' : undefined}
                      style={{ width: `${Math.min(100, (c.hechas / c.de) * 100)}%` }}
                    />
                  </span>
                  <span className="os-hub-n">
                    {c.hechas >= c.de
                      ? 'completo'
                      : `faltan ${c.de - c.hechas}`}
                  </span>
                </>
              )}
            </Panel>
          ))}
        </div>
      </Eje>

      <Eje
        titulo="Qué se pide"
        bajada="Con qué llegan los clientes. Es lo que dice qué batería conviene tener afilada y para qué puestos se vende de verdad."
      >
        <div className="os-hub-dos">
          <Panel titulo="Familia de puesto" nota={`${d.total} evaluaciones`}>
            <Barras datos={d.pedido.porFamilia} vacio="Ningún pedido tiene familia cargada." />
          </Panel>
          <Panel titulo="Nivel del puesto">
            <Barras datos={d.pedido.porNivel} vacio="Ningún pedido tiene nivel cargado." />
          </Panel>
          <Panel titulo="Batería">
            <Barras datos={d.pedido.porBateria} vacio="Ningún pedido tiene batería." />
          </Panel>
          <Panel
            titulo="Con Benziger"
            nota={`${d.pedido.conBenziger.con} de ${d.pedido.conBenziger.con + d.pedido.conBenziger.sin}`}
          >
            <Barras
              datos={[
                { nombre: 'Lo lleva', n: d.pedido.conBenziger.con },
                { nombre: 'No lo lleva', n: d.pedido.conBenziger.sin },
              ].filter((x) => x.n > 0)}
              vacio="Sin pedidos cargados."
            />
          </Panel>
          <Panel titulo="Por cliente">
            <Barras datos={d.pedido.porEmpresa} vacio="Sin empresas cargadas." />
          </Panel>
          <Panel titulo="Entregas por mes" nota={`${d.entregadas} en total`}>
            <Barras
              datos={d.pedido.entregasPorMes.map((m) => ({ nombre: m.mes, n: m.n }))}
              vacio="Todavía no se entregó ninguna."
            />
          </Panel>
        </div>
      </Eje>

      <Eje
        titulo="Los candidatos"
        bajada="Cómo es la gente que se presenta a estos puestos. Con casos suficientes, esto pasa a ser el baremo de la casa: un puntaje se lee contra quienes se presentan y no solo contra la literatura."
      >
        <div className="os-hub-dos">
          <Panel
            titulo="Raven"
            nota={
              d.candidatos.raven.mediana === null
                ? 'sin puntajes'
                : `mediana ${d.candidatos.raven.mediana} de percentil · ${d.candidatos.raven.n} casos`
            }
          >
            <Barras datos={d.candidatos.raven.reparto} vacio="Nadie tiene el Raven puntuado." />
            {d.candidatos.raven.mejores.length > 0 && (
              <>
                <span className="os-hub-rotulo os-hub-sub">Los más altos</span>
                <ul className="os-hub-ranking">
                  {d.candidatos.raven.mejores.map((r, i) => (
                    <li key={r.nombre}>
                      <span className="os-hub-puesto">{i + 1}</span>
                      <span className="os-hub-barra-nombre">{r.nombre}</span>
                      <span className="os-hub-barra">
                        <span style={{ width: `${r.percentil}%` }} />
                      </span>
                      <span className="os-hub-barra-n">{r.percentil}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel titulo="Cómo cierran los informes" nota="conclusión final">
            <Barras datos={d.candidatos.conclusiones} vacio="Todavía no hay informes cerrados." />
          </Panel>

          <Panel titulo="Cuadrante Benziger" nota="el preferente de cada uno">
            <Barras datos={d.candidatos.cuadrantes} vacio="Todavía no hay perfiles cargados." />
          </Panel>

          {/* La mediana de cada competencia sobre los evaluados: es el baremo
              propio, y hoy es lo que no existe. */}
          <Panel
            titulo="Competencias"
            nota={
              d.candidatos.competencias.length === 0
                ? 'sin sumarios'
                : `mediana sobre ${d.candidatos.competencias[0].n} ${
                    d.candidatos.competencias[0].n === 1 ? 'evaluado' : 'evaluados'
                  }`
            }
          >
            {d.candidatos.competencias.length === 0 ? (
              <p className="os-vacio">Hace falta al menos un sumario cargado.</p>
            ) : (
              <ul className="os-hub-barras">
                {d.candidatos.competencias.map((c) => (
                  <li key={c.nombre}>
                    <span className="os-hub-barra-nombre" title={`sobre ${c.n} casos`}>
                      {c.nombre}
                    </span>
                    <span className="os-hub-barra">
                      <span style={{ width: `${c.mediana ?? 0}%` }} />
                    </span>
                    <span className="os-hub-barra-n">{c.mediana ?? '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Eje>

      <Eje
        titulo="Lo que todavía no se puede medir"
        bajada="El acierto de una evaluación se mide cruzando lo que se recomendó contra cómo le fue a la persona a los noventa días de entrar. Ese dato se carga en la ficha, y es lo único que separa al sistema de poder decir si acierta."
      >
        <section className="os-panel">
          <div className="os-panel-cuerpo">
            <ul className="os-hub-pendientes">
              {d.pendientes.map((p) => {
                const listo = p.hoy >= p.hacenFalta;
                return (
                  <li key={p.medida}>
                    <div className="os-hub-pend-top">
                      <span className="os-hub-pend-nombre">{p.medida}</span>
                      <span className={`os-sello-estado ${listo ? 'os-verde' : 'os-ambar'}`}>
                        {listo ? 'ya se puede' : `faltan ${p.hacenFalta - p.hoy}`}
                      </span>
                    </div>
                    <span className="os-hub-barra">
                      <span
                        className={listo ? 'completa' : undefined}
                        style={{ width: `${Math.min(100, (p.hoy / p.hacenFalta) * 100)}%` }}
                      />
                    </span>
                    <span className="os-hub-n">
                      {p.hoy} de {p.hacenFalta} · {p.porque}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </Eje>
    </Shell>
  );
}
