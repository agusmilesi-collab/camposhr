import Link from 'next/link';
import Shell from '../Shell';
import { listarPedidos, loQueFalta, type Pedido } from '@/lib/pedidos';
import { quienSoy } from '@/lib/identidad';
import { baterias as listarBaterias, empresas as listarEmpresas } from '@/lib/altas';
import { ABIERTO } from '@/lib/pedido-campos';
import { diasDesde, fecha, haceCuanto } from '@/lib/hora';
import Bateria from '../psicotecnicos/Bateria';
import Abrir from './Abrir';

export const dynamic = 'force-dynamic';

/**
 * Los pedidos: qué busca cada cliente y cuáles siguen abiertos.
 *
 * En curso arriba y terminados abajo, porque lo que se hace en esta pantalla
 * es cerrar los que ya no reciben candidatos. Un pedido abierto para siempre
 * ensucia el selector de la tarjeta de alta, que ofrece búsquedas terminadas
 * hace meses.
 *
 * Cada fila contesta las tres preguntas que se hacen mirando esta lista: cómo
 * viene (el avance), hace cuánto que está (la antigüedad al lado de la fecha) y
 * qué le falta para poder trabajarlo. Antes las dos primeras había que
 * calcularlas de cabeza, restando una columna de otra y una fecha contra hoy, y
 * la tercera obligaba a abrir los pedidos de a uno.
 */

/**
 * Cómo viene la búsqueda: cuántas evaluaciones se entregaron de las que tiene.
 *
 * Estaba en dos columnas de números, "3" y "1", y lo que se quiere saber
 * (cuánto falta) salía de restarlas. La barra dice de un vistazo lo mismo que
 * el texto, para poder recorrer la columna sin leer.
 */
function Avance({ p }: { p: Pedido }) {
  if (p.candidatos === 0) {
    return <span className="os-dato-falta">sin candidatos</span>;
  }
  const parte = Math.round((p.entregados / p.candidatos) * 100);
  const listo = p.entregados === p.candidatos;
  return (
    <span className="os-avance" title={`${p.entregados} de ${p.candidatos} entregados`}>
      <span className="os-avance-texto">
        {p.entregados} de {p.candidatos}
      </span>
      <span className="os-avance-barra" aria-hidden="true">
        <span
          className={`os-avance-parte${listo ? ' completa' : ''}`}
          style={{ width: `${parte}%` }}
        />
      </span>
    </span>
  );
}

/**
 * Lo que le falta al pedido, en una línea.
 *
 * Es lo único accionable de la fila: mientras diga algo, hay una llamada que
 * hacer o un dato que cargar.
 */
function Falta({ p }: { p: Pedido }) {
  const falta = loQueFalta(p);
  if (falta.length === 0) {
    return <span className="os-sello-estado os-verde">Completo</span>;
  }
  return (
    <span className="os-sello-estado os-ambar" title={`Falta ${falta.join(', ')}`}>
      Falta {falta.join(', ')}
    </span>
  );
}

/**
 * Las dos tablas tienen las mismas columnas y la última cambia de contenido:
 * en curso, lo que le falta al pedido; cerrado, cómo terminó, que hasta ahora
 * no se veía en ninguna parte de la lista. Dos tablas apiladas de distinto
 * ancho se leen como si no tuvieran que ver entre sí.
 */
function Filas({ pedidos, cerrados = false }: { pedidos: Pedido[]; cerrados?: boolean }) {
  return (
    <div className="os-tabla-marco">
      <table className="os-tabla os-tabla-trabajo os-tabla-pedidos">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Batería</th>
            <th>Nivel</th>
            <th>Pedido el</th>
            <th>Avance</th>
            <th>{cerrados ? 'Cómo terminó' : 'Para trabajarlo'}</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td data-campo="Pedido">
                <Link className="os-tabla-nombre os-tabla-ficha" href={`/os/pedidos/${p.id}`}>
                  {p.puesto}
                </Link>
                <div className="os-tabla-flojo">{p.empresa}</div>
              </td>
              <td data-campo="Batería">
                <Bateria codigo={p.bateria} conBenziger={p.conBenziger} />
              </td>
              <td data-campo="Nivel">
                {p.seniority ?? <span className="os-dato-falta">sin definir</span>}
              </td>
              {/* La fecha ubica el pedido en el mes; el "hace" dice sin contar
                  si ya lleva demasiado abierto. */}
              <td data-campo="Pedido el">
                {fecha(p.fechaPedido) ?? <span className="os-dato-falta">sin fecha</span>}
                {p.fechaPedido && (
                  <div className="os-tabla-flojo">{haceCuanto(diasDesde(p.fechaPedido))}</div>
                )}
              </td>
              <td data-campo="Avance">
                <Avance p={p} />
              </td>
              <td data-campo={cerrados ? 'Cómo terminó' : 'Para trabajarlo'}>
                {cerrados ? (
                  <span
                    className={`os-sello-estado ${p.estado === 'Cancelado' ? 'os-rojo' : 'os-gris'}`}
                  >
                    {p.estado}
                  </span>
                ) : (
                  <Falta p={p} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Pedidos() {
  const [yo, pedidos, empresas, baterias] = await Promise.all([
    quienSoy(),
    listarPedidos(),
    listarEmpresas(),
    listarBaterias(),
  ]);

  const abiertos = pedidos.filter((p) => p.estado === ABIERTO);
  const cerrados = pedidos.filter((p) => p.estado !== ABIERTO);
  const incompletos = abiertos.filter((p) => loQueFalta(p).length > 0).length;

  return (
    <Shell
      titulo="Pedidos"
      identidad={yo.nombre}
      ancho
      nota={abiertos.length === 1 ? '1 en curso' : `${abiertos.length} en curso`}
      cuentas={{ '/os/pedidos': abiertos.length }}
    >
      <div className="os-encabezado os-encabezado-con-accion">
        <h1>Pedidos</h1>
        <Abrir empresas={empresas} baterias={baterias} />
      </div>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>En curso</h2>
          {/* Cuántos tienen algo sin completar: es el trabajo que deja esta
              pantalla, y sin el número hay que recorrer la columna contando. */}
          <span className="os-columna-monto">
            {abiertos.length === 0
              ? 'ninguno'
              : incompletos === 0
                ? `${abiertos.length === 1 ? '1 pedido' : `${abiertos.length} pedidos`}, todos completos`
                : `${abiertos.length === 1 ? '1 pedido' : `${abiertos.length} pedidos`} · ${incompletos} sin completar`}
          </span>
        </div>
        {abiertos.length === 0 ? (
          <p className="os-vacio">No hay ninguna búsqueda abierta.</p>
        ) : (
          <Filas pedidos={abiertos} />
        )}
      </section>

      {cerrados.length > 0 && (
        <section className="os-panel os-panel-separado">
          <div className="os-panel-top">
            <h2>Cerrados</h2>
            <span className="os-columna-monto">
              {cerrados.length === 1 ? '1 pedido' : `${cerrados.length} pedidos`}
            </span>
          </div>
          <Filas pedidos={cerrados} cerrados />
        </section>
      )}
    </Shell>
  );
}
