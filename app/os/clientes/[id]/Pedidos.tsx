'use client';

/**
 * Los pedidos de un cliente, abiertos arriba y cerrados abajo.
 *
 * Es la pantalla de Pedidos, ya filtrada por quien las pidió: acá no hace falta
 * la columna del cliente, que era la mitad del ancho de aquella tabla, y el
 * pedido nuevo nace con el cliente puesto.
 *
 * **Un pedido se cierra solo cuando se entregaron todos sus informes**, que es
 * lo que significa que terminó (`lib/pedido-completo.ts`). El botón
 * de reabrir está para el caso que el cierre automático no puede saber: el
 * cliente pide sumar a alguien más a un pedido que ya se había dado por
 * terminado.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Bateria from '../../psicotecnicos/Bateria';
import Abrir from '../../pedidos/Abrir';
import type { BateriaOpcion, Opcion } from '../../psicotecnicos/Agregar';
import { ABIERTO } from '@/lib/pedido-campos';
import { diasDesde, fecha, haceCuanto } from '@/lib/hora';
import type { Pedido } from '@/lib/pedidos-tipos';
import { loQueFalta } from '@/lib/pedidos-tipos';

/** Cómo viene el pedido: cuántos informes salieron de los que tiene. */
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

/** Lo único accionable de la fila: mientras diga algo, hay un dato que cargar. */
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

/** Vuelve a poner en curso un pedido que se había dado por terminado. */
function Reabrir({ id }: { id: string }) {
  const router = useRouter();
  const [tocando, setTocando] = useState(false);

  async function reabrir() {
    setTocando(true);
    try {
      await fetch('/api/os/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo: 'estado', valor: ABIERTO }),
      });
      router.refresh();
    } finally {
      setTocando(false);
    }
  }

  return (
    <button className="os-boton" disabled={tocando} onClick={reabrir}>
      {tocando ? '…' : 'Reabrir'}
    </button>
  );
}

function Filas({ pedidos, cerrados = false }: { pedidos: Pedido[]; cerrados?: boolean }) {
  return (
    <div className="os-tabla-marco">
      <table className="os-tabla os-tabla-trabajo os-tabla-pedidos">
        <thead>
          <tr>
            <th>Puesto</th>
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
              <td data-campo="Puesto">
                <Link className="os-tabla-nombre os-tabla-ficha" href={`/os/pedidos/${p.id}`}>
                  {p.puesto}
                </Link>
              </td>
              <td data-campo="Batería">
                <Bateria codigo={p.bateria} conBenziger={p.conBenziger} />
              </td>
              <td data-campo="Nivel">
                {p.seniority ?? <span className="os-dato-falta">sin definir</span>}
              </td>
              {/* La fecha ubica el pedido en el mes; el "hace" dice sin contar
                  si ya lleva demasiado abierto. Reabierto, la que vale es la de
                  la reapertura, y se dice: la solicitud en curso es la nueva. */}
              <td data-campo="Pedido el">
                {fecha(p.fechaPedido) ?? <span className="os-dato-falta">sin fecha</span>}
                {p.reabierto && (
                  <div
                    className="os-tabla-flojo"
                    title={`Se pidió por primera vez el ${fecha(p.fechaOriginal) ?? 'sin fecha'}.`}
                  >
                    reabierto
                  </div>
                )}
                {p.fechaPedido && (
                  <div className="os-tabla-flojo">{haceCuanto(diasDesde(p.fechaPedido))}</div>
                )}
              </td>
              <td data-campo="Avance">
                <Avance p={p} />
              </td>
              <td data-campo={cerrados ? 'Cómo terminó' : 'Para trabajarlo'}>
                {cerrados ? (
                  <span className="os-cerrado-fila">
                    <span
                      className={`os-sello-estado ${
                        p.estado === 'Cancelado' ? 'os-rojo' : 'os-gris'
                      }`}
                    >
                      {p.estado}
                    </span>
                    <Reabrir id={p.id} />
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

export default function Pedidos({
  pedidos,
  empresaId,
  empresas,
  baterias,
}: {
  pedidos: Pedido[];
  empresaId: string;
  empresas: Opcion[];
  baterias: BateriaOpcion[];
}) {
  const abiertos = pedidos.filter((p) => p.estado === ABIERTO);
  const cerrados = pedidos.filter((p) => p.estado !== ABIERTO);
  const incompletos = abiertos.filter((p) => loQueFalta(p).length > 0).length;

  return (
    <>
      <section className="os-panel os-panel-separado">
        <div className="os-panel-top">
          <h2>Pedidos abiertos</h2>
          <span className="os-columna-monto">
            {abiertos.length === 0
              ? 'ninguna'
              : incompletos === 0
                ? `${abiertos.length === 1 ? '1 pedido' : `${abiertos.length} pedidos`}, todos completos`
                : `${abiertos.length === 1 ? '1 pedido' : `${abiertos.length} pedidos`} · ${incompletos} sin completar`}
          </span>
        </div>
        {abiertos.length === 0 ? (
          <p className="os-vacio">Este cliente no tiene pedidos abiertos.</p>
        ) : (
          <Filas pedidos={abiertos} />
        )}
        <div className="os-panel-cuerpo">
          <Abrir empresas={empresas} baterias={baterias} empresaFija={empresaId} />
        </div>
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
    </>
  );
}
