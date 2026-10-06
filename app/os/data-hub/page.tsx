import Link from 'next/link';
import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';
import { datosDelHub, type PorEvaluadora } from '@/lib/data-hub';
import { Barras, Eje, Panel } from './piezas';
import Candidatos, { Hemiciclo, TONO_CONCLUSION, filasPara } from './Candidatos';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

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

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Las entregas de cada mes, en columnas.
 *
 * El tope es el mismo en todas las fichas: con cada una medida contra su propio
 * mes más alto, dos columnas iguales de alto querrían decir cantidades
 * distintas según la ficha en la que estén.
 */
function Meses({ datos, tope }: { datos: PorEvaluadora['porMes']; tope: number }) {
  if (datos.length === 0) return <p className="os-vacio">Todavía no entregó ninguna.</p>;
  return (
    <ol className="os-hub-meses">
      {datos.map((m) => (
        <li
          key={m.mes}
          title={`${m.n} entregadas en ${MESES[Number(m.mes.slice(5)) - 1]} de ${m.mes.slice(0, 4)}`}
        >
          <span className="os-hub-mes-n">{m.n === 0 ? '' : m.n}</span>
          <span className="os-hub-mes-columna">
            {m.n > 0 && <span style={{ height: `${(m.n / tope) * 100}%` }} />}
          </span>
          <span className="os-hub-mes-nombre">{MESES[Number(m.mes.slice(5)) - 1]}</span>
        </li>
      ))}
    </ol>
  );
}

/** La ficha de una evaluadora: sus números, no los del sistema. */
function FichaEvaluadora({
  e,
  topeMes,
  filas,
}: {
  e: PorEvaluadora;
  topeMes: number;
  filas: number;
}) {
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

        <div className="os-hub-conclusiones os-hub-entregas">
          <span className="os-hub-rotulo">Entregas por mes</span>
          <Meses datos={e.porMes} tope={topeMes} />
        </div>

        <div className="os-hub-conclusiones">
          <span className="os-hub-rotulo">Cómo cierra sus informes</span>
          <Hemiciclo
            datos={e.conclusiones}
            tonos={TONO_CONCLUSION}
            unidad="informes"
            filas={filas}
          />
        </div>
      </div>
    </section>
  );
}

/** Las pestañas del tablero: de quién son los números que se miran. */
const PESTANAS = [
  { clave: 'evaluadoras', texto: 'Evaluadoras' },
  { clave: 'candidatos', texto: 'Candidatos' },
] as const;

export default async function DataHub({ searchParams }: { searchParams: { ver?: string } }) {
  const pedida = searchParams.ver ?? '';
  const ver = PESTANAS.some((p) => p.clave === pedida) ? pedida : 'evaluadoras';

  const [yo, d] = await Promise.all([quienSoy(), datosDelHub()]);

  const cuentas = await cuentasDeLaBarra();
  // Las fichas se comparan una al lado de la otra: mismo tope y mismas filas.
  const filasHemiciclo = filasPara(
    Math.max(0, ...d.evaluadoras.map((e) => e.conclusiones.reduce((a, c) => a + c.n, 0))),
  );
  const topeMes = Math.max(1, ...d.evaluadoras.flatMap((e) => e.porMes.map((m) => m.n)));

  return (
    <Shell titulo="Data hub" identidad={yo.nombre} cuentas={cuentas} ancho>
      <div className="os-encabezado">
        <h1>Data hub</h1>
        <p>
          Cómo trabaja cada evaluadora, qué piden los clientes y cómo es la gente que se evalúa.
          Cada número dice sobre cuántos casos se calcula, y lo que todavía no se puede medir dice
          cuánto falta.
        </p>
      </div>

      <nav className="os-pestanas">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/os/data-hub?ver=${p.clave}`}
            className={`os-pestana${ver === p.clave ? ' activa' : ''}`}
            aria-current={ver === p.clave ? 'page' : undefined}
          >
            {p.texto}
          </Link>
        ))}
      </nav>

      {ver === 'evaluadoras' && (
        <>
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
                  <FichaEvaluadora key={e.nombre} e={e} topeMes={topeMes} filas={filasHemiciclo} />
                ))}
              </div>
            )}
          </Eje>

          <Eje
            titulo="Qué tan completo está el protocolo"
            bajada="Cuántas evaluaciones tienen cada pieza cargada. Lo que falta acá es lo que después no se puede medir en ningún lado."
          >
            <div className="os-hub-dos os-hub-cuatro">
              {d.completitud.map((c) => (
                <Panel
                  key={c.pieza}
                  titulo={c.pieza}
                  nota={c.de === 0 ? 'no corresponde' : `${c.hechas} de ${c.de}`}
                >
                  {c.de === 0 ? (
                    <p className="os-vacio">Ningún pedido lo pide.</p>
                  ) : (
                    <>
                      <span className="os-hub-barra">
                        <span
                          className={c.hechas >= c.de ? 'completa' : undefined}
                          style={{
                            width: `${Math.min(100, (c.hechas / c.de) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="os-hub-n">
                        {c.hechas >= c.de ? 'completo' : `faltan ${c.de - c.hechas}`}
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
                  datos={d.pedido.entregasPorMes.map((m) => ({
                    nombre: m.mes,
                    n: m.n,
                  }))}
                  vacio="Todavía no se entregó ninguna."
                />
              </Panel>
            </div>
          </Eje>
        </>
      )}

      {ver === 'candidatos' && <Candidatos d={d} />}

      {ver === 'evaluadoras' && (
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
                          style={{
                            width: `${Math.min(100, (p.hoy / p.hacenFalta) * 100)}%`,
                          }}
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
      )}
    </Shell>
  );
}
