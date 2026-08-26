'use client';

/**
 * Con qué exigencia se leen los puntajes de este informe.
 *
 * Dos desplegables y no uno: uno cambia solo a esta persona y el otro a todo su
 * pedido. Con un control solo había que adivinar cuál de las dos cosas hacía, y
 * las dos se usan: el pedido entero cuando el puesto es el que pide otra vara,
 * y un candidato suelto cuando se lo compara contra un rol distinto al del
 * resto de la búsqueda.
 *
 * **No recalcula ningún puntaje**: cambia a partir de qué número una
 * competencia se llama Adecuada, Alta o Sobresaliente.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { bandasDe, type Exigencia as Perfil } from '@/lib/exigencia';

export default function Exigencia({
  evaluacionId,
  pedidoId,
  deLaEvaluacion,
  delPedido,
  perfiles,
  rige,
}: {
  evaluacionId: string;
  pedidoId: string | null;
  /** La elegida para esta persona. Null quiere decir "la del pedido". */
  deLaEvaluacion: string | null;
  /** La elegida para el pedido. Null quiere decir "la predeterminada". */
  delPedido: string | null;
  perfiles: Perfil[];
  /** La que termina rigiendo, ya resuelta. */
  rige: Perfil;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const predeterminada = perfiles.find((p) => p.predeterminada);
  const delPedidoNombre =
    perfiles.find((p) => p.id === delPedido)?.nombre ?? predeterminada?.nombre ?? 'Estándar';

  async function asignar(cuerpo: Record<string, unknown>, cual: string) {
    setGuardando(cual);
    setError(null);
    try {
      const res = await fetch('/api/os/exigencia-asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.error ?? 'No se pudo guardar.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="os-exigencia-elegir">
      <div className="os-exigencia-fila">
        <label htmlFor="exigencia-candidato">Esta persona</label>
        <select
          id="exigencia-candidato"
          className="os-campo"
          value={deLaEvaluacion ?? ''}
          disabled={guardando !== null}
          onChange={(e) =>
            asignar({ evaluacionId, exigenciaId: e.target.value }, 'candidato')
          }
        >
          <option value="">La del pedido ({delPedidoNombre})</option>
          {perfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {pedidoId && (
        <div className="os-exigencia-fila">
          <label htmlFor="exigencia-pedido">Todo el pedido</label>
          <select
            id="exigencia-pedido"
            className="os-campo"
            value={delPedido ?? ''}
            disabled={guardando !== null}
            onChange={(e) => asignar({ pedidoId, exigenciaId: e.target.value }, 'pedido')}
          >
            <option value="">
              La predeterminada{predeterminada ? ` (${predeterminada.nombre})` : ''}
            </option>
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Con qué vara se está leyendo, en números: es lo que hay que ver para
          saber si el cambio hizo lo que se quería. */}
      <p className="os-exigencia-rige">
        Rige <strong>{rige.nombre}</strong>:{' '}
        {bandasDe(rige)
          .slice()
          .reverse()
          .map((b) => `${b.nombre} ${b.desde === 0 ? `menos de ${rige.adecuado}` : `${b.desde} a ${b.hasta}`}`)
          .join(' · ')}
        .
      </p>

      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
