'use client';

/**
 * La pregunta del 25: ¿seguís con tus horas el mes que viene?
 *
 * Tres salidas. Sí y No se contestan de un toque. "Editar horas" abre un
 * renglón para escribir qué quiere cambiar: las bandas las mueve el equipo, así
 * que lo que hace falta es que diga qué quiere, no un calendario para armarlo.
 *
 * Contestada, la tarjeta dice qué contestó y deja cambiarlo: quien dijo que no
 * el 25 y el 28 consiguió un paciente tiene que poder volver atrás.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Respuesta = 'si' | 'no' | 'cambiar';

const DICHO: Record<Respuesta, string> = {
  si: 'Renovás tus horas',
  no: 'No renovás',
  cambiar: 'Pediste cambiar horas',
};

export default function Renovar({
  mes,
  horas,
  respuesta,
  nota,
}: {
  /** El mes que se renueva, escrito: "noviembre". */
  mes: string;
  /** Cuántas horas por semana tiene hoy. */
  horas: number;
  respuesta: Respuesta | null;
  nota: string | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [texto, setTexto] = useState(nota ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function responder(r: Respuesta) {
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/centro/renovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta: r, nota: texto }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError(d?.motivo ?? 'No se pudo guardar. Probá de nuevo.');
        return;
      }
      setEditando(false);
      setCambiando(false);
      router.refresh();
    } catch {
      setError('No se pudo guardar. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const contestada = respuesta !== null && !cambiando;

  return (
    <article className={`centro-tarjeta centro-renovar${editando ? ' abierta' : ''}`}>
      <div className="centro-tarjeta-top">
        <b>{contestada ? DICHO[respuesta as Respuesta] : `¿Renovás ${mes}?`}</b>
        <span>{horas} h por semana</span>
      </div>
      <small title={contestada && respuesta === 'cambiar' ? (nota ?? undefined) : undefined}>
        {contestada
          ? respuesta === 'cambiar' && nota
            ? nota
            : `Para ${mes}`
          : 'Tus mismas horas, un mes más'}
      </small>

      {error && <small className="centro-soltar-error">{error}</small>}

      {contestada ? (
        <button type="button" className="centro-bajar centro-abrir" onClick={() => setCambiando(true)}>
          Cambiar la respuesta
        </button>
      ) : editando ? (
        <>
          <textarea
            className="centro-renovar-nota"
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Por ejemplo: dejo el martes y sumo el jueves de 14 a 18."
            autoFocus
          />
          <div className="centro-renovar-botones">
            <button type="button" onClick={() => setEditando(false)} disabled={enviando}>
              Volver
            </button>
            <button
              type="button"
              className="firme"
              onClick={() => responder('cambiar')}
              disabled={enviando || texto.trim() === ''}
            >
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </>
      ) : (
        <div className="centro-renovar-botones">
          <button type="button" className="firme" onClick={() => responder('si')} disabled={enviando}>
            Sí
          </button>
          <button type="button" onClick={() => responder('no')} disabled={enviando}>
            No
          </button>
          <button type="button" onClick={() => setEditando(true)} disabled={enviando}>
            Editar horas
          </button>
        </div>
      )}
    </article>
  );
}
