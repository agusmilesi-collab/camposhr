import Link from 'next/link';
import Shell from '../Shell';
import { listarPedidos, type Pedido } from '@/lib/pedidos';
import { quienSoy } from '@/lib/identidad';
import { ABIERTO } from '@/lib/pedido-campos';
import { fecha } from '@/lib/hora';

export const dynamic = 'force-dynamic';

/**
 * Los pedidos: qué busca cada cliente y cuáles siguen abiertos.
 *
 * En curso arriba y terminados abajo, porque lo que se hace en esta pantalla
 * es cerrar los que ya no reciben candidatos. Un pedido abierto para siempre
 * ensucia el selector de la tarjeta de alta, que ofrece búsquedas terminadas
 * hace meses.
 *
 * El avance ("3 de 4") es cuántas de sus evaluaciones ya se entregaron: es el
 * dato que dice si el pedido está listo para cerrarse.
 */

function Filas({ pedidos }: { pedidos: Pedido[] }) {
  return (
    <div className="os-tabla-marco">
      <table className="os-tabla os-tabla-trabajo">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Batería</th>
            <th>Nivel</th>
            <th>Pedido el</th>
            <th className="os-tabla-num">Candidatos</th>
            <th className="os-tabla-num">Entregados</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id}>
              <td>
                <Link className="os-tabla-nombre os-tabla-ficha" href={`/os/pedidos/${p.id}`}>
                  {p.puesto}
                </Link>
                <div className="os-tabla-flojo">{p.empresa}</div>
              </td>
              <td>
                {p.bateria ?? <span className="os-dato-falta">a definir</span>}
                {p.conBenziger && <div className="os-tabla-flojo">con Benziger</div>}
              </td>
              <td>{p.seniority ?? <span className="os-dato-falta">sin definir</span>}</td>
              <td>{fecha(p.fechaPedido) ?? <span className="os-dato-falta">sin fecha</span>}</td>
              <td className="os-tabla-num">{p.candidatos}</td>
              <td className="os-tabla-num">{p.entregados}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Pedidos() {
  const [yo, pedidos] = await Promise.all([quienSoy(), listarPedidos()]);

  const abiertos = pedidos.filter((p) => p.estado === ABIERTO);
  const cerrados = pedidos.filter((p) => p.estado !== ABIERTO);

  return (
    <Shell
      titulo="Pedidos"
      identidad={yo.nombre}
      ancho
      nota={abiertos.length === 1 ? '1 en curso' : `${abiertos.length} en curso`}
      cuentas={{ '/os/pedidos': abiertos.length }}
    >
      <div className="os-encabezado">
        <h1>Pedidos</h1>
      </div>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>En curso</h2>
          <span className="os-columna-monto">
            {abiertos.length === 1 ? '1 pedido' : `${abiertos.length} pedidos`}
          </span>
        </div>
        {abiertos.length === 0 ? (
          <p className="os-vacio">No hay ninguna búsqueda abierta.</p>
        ) : (
          <Filas pedidos={abiertos} />
        )}
      </section>

      {cerrados.length > 0 && (
        <section className="os-panel" style={{ marginTop: 26 }}>
          <div className="os-panel-top">
            <h2>Cerrados</h2>
            <span className="os-columna-monto">
              {cerrados.length === 1 ? '1 pedido' : `${cerrados.length} pedidos`}
            </span>
          </div>
          <Filas pedidos={cerrados} />
        </section>
      )}
    </Shell>
  );
}
