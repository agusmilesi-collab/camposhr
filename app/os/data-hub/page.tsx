import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';
import { datosDelHub, type Medida, type Reparto } from '@/lib/data-hub';
import { enDias } from '@/lib/hora';

export const dynamic = 'force-dynamic';

/**
 * Data hub: los números del negocio, y lo que todavía no se puede medir.
 *
 * Cada medida lleva al lado sobre cuántos casos se calculó. Con quince
 * evaluaciones una mediana es una anécdota, y un número sin su `n` invita a
 * decidir sobre nada.
 *
 * La segunda mitad de la pantalla es la más útil: lo que falta para poder medir
 * el acierto. Sin eso el tablero muestra lo que sobra y calla lo que importa,
 * y nadie carga un seguimiento que no ve para qué sirve.
 */

function Cifra({
  rotulo,
  valor,
  unidad,
  n,
  detalle,
}: {
  rotulo: string;
  valor: number | string | null;
  unidad?: string;
  n?: number;
  detalle?: string;
}) {
  return (
    <div className="os-hub-cifra">
      <span className="os-hub-rotulo">{rotulo}</span>
      <span className="os-hub-valor">
        {valor === null ? <span className="os-dato-falta">sin datos</span> : valor}
        {valor !== null && unidad && <em>{unidad}</em>}
      </span>
      {/* Sobre cuántos casos: un número sin esto no se puede leer. */}
      {n !== undefined && (
        <span className="os-hub-n">{n === 1 ? 'sobre 1 caso' : `sobre ${n} casos`}</span>
      )}
      {detalle && <span className="os-hub-n">{detalle}</span>}
    </div>
  );
}

/** Un reparto, con la barra proporcional al más grande. */
function Barras({ datos, vacio }: { datos: Reparto; vacio: string }) {
  if (datos.length === 0) return <p className="os-vacio">{vacio}</p>;
  const tope = Math.max(...datos.map((d) => d.n));
  return (
    <ul className="os-hub-barras">
      {datos.map((d) => (
        <li key={d.nombre}>
          <span className="os-hub-barra-nombre">{d.nombre}</span>
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
    <section className="os-panel os-panel-separado">
      <div className="os-panel-top">
        <h2>{titulo}</h2>
        {nota && <span className="os-columna-monto">{nota}</span>}
      </div>
      <div className="os-panel-cuerpo">{children}</div>
    </section>
  );
}

function dias(m: Medida & { peor: number | null }) {
  return m.valor === null ? null : m.valor;
}

export default async function DataHub() {
  const [yo, d] = await Promise.all([quienSoy(), datosDelHub()]);

  return (
    <Shell titulo="Data hub" identidad={yo.nombre} ancho>
      <div className="os-encabezado">
        <h1>Data hub</h1>
        <p>
          Lo que el sistema puede afirmar hoy con lo que tiene cargado, y lo que le falta para poder
          decir el resto. Cada número dice sobre cuántos casos se calcula.
        </p>
      </div>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>El trabajo</h2>
          <span className="os-columna-monto">{d.total} evaluaciones en el sistema</span>
        </div>
        <div className="os-panel-cuerpo os-hub-cifras">
          <Cifra rotulo="Entregadas" valor={d.entregadas} />
          <Cifra
            rotulo="En curso"
            valor={d.tiempos.enCurso.n}
            detalle={
              d.tiempos.enCurso.masViejo === null
                ? undefined
                : `la más vieja espera ${enDias(d.tiempos.enCurso.masViejo)}`
            }
          />
          <Cifra
            rotulo="De la solicitud a la entrega"
            valor={dias(d.tiempos.solicitudAEntrega)}
            unidad=" días"
            n={d.tiempos.solicitudAEntrega.n}
            detalle={
              d.tiempos.solicitudAEntrega.peor === null
                ? undefined
                : `mediana · la peor tardó ${enDias(d.tiempos.solicitudAEntrega.peor)}`
            }
          />
          <Cifra
            rotulo="De la entrevista a la entrega"
            valor={dias(d.tiempos.entrevistaAEntrega)}
            unidad=" días"
            n={d.tiempos.entrevistaAEntrega.n}
            detalle="mediana · es el tiempo de análisis"
          />
        </div>
      </section>

      <div className="os-hub-dos">
        <Panel titulo="Quién lo hizo" nota="todas las etapas">
          <Barras datos={d.porEvaluadora} vacio="Nadie tiene evaluaciones asignadas." />
        </Panel>
        <Panel titulo="En qué etapa está">
          <Barras datos={d.porEtapa} vacio="No hay evaluaciones cargadas." />
        </Panel>
        <Panel titulo="Qué se pide" nota="por familia de puesto">
          <Barras datos={d.porFamilia} vacio="Ningún pedido tiene familia cargada." />
        </Panel>
        <Panel titulo="Con qué batería">
          <Barras datos={d.porBateria} vacio="Ningún pedido tiene batería." />
        </Panel>
        <Panel titulo="Cómo se cerraron" nota="conclusión del informe">
          <Barras datos={d.porRecomendacion} vacio="Todavía no hay informes cerrados." />
        </Panel>
        <Panel titulo="Entregas por mes">
          {d.entregasPorMes.length === 0 ? (
            <p className="os-vacio">Todavía no se entregó ninguna.</p>
          ) : (
            <Barras
              datos={d.entregasPorMes.map((m) => ({ nombre: m.mes, n: m.n }))}
              vacio=""
            />
          )}
        </Panel>
      </div>

      <Panel
        titulo="Raven"
        nota={d.raven.mediana === null ? 'sin puntajes' : `mediana ${d.raven.mediana} de percentil`}
      >
        {d.raven.ranking.length === 0 ? (
          <p className="os-vacio">Nadie tiene el Raven puntuado todavía.</p>
        ) : (
          <ul className="os-hub-ranking">
            {d.raven.ranking.map((r, i) => (
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
        )}
      </Panel>

      {/* La mitad que importa: sin esto, el tablero muestra lo que sobra. */}
      <section className="os-panel os-panel-separado">
        <div className="os-panel-top">
          <h2>Lo que todavía no se puede medir</h2>
          <span className="os-columna-monto">y cuánto falta para poder</span>
        </div>
        <div className="os-panel-cuerpo">
          <p className="os-nota-bloque">
            El acierto de una evaluación se mide cruzando lo que se recomendó contra cómo le fue a
            la persona a los noventa días de entrar. Ese segundo dato se carga en la ficha, y es lo
            único que separa al sistema de poder decir si acierta.
          </p>
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
    </Shell>
  );
}
