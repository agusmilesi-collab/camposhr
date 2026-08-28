'use client';

/**
 * La fecha de nacimiento, que es la primera pregunta de la entrevista.
 *
 * Se carga acá porque es lo primero que se pregunta con la persona enfrente, y
 * porque la edad que sale de ella se congela contra el día de la entrevista: el
 * informe dice qué edad tenía cuando se la evaluó y no cuántos años tiene hoy.
 *
 * La edad se muestra mientras se escribe la fecha, sin guardar todavía, para
 * poder confirmarla en voz alta antes de que quede.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { edadA, enAños } from '@/lib/edad';

export default function Nacimiento({
  id,
  nacimiento,
  entrevista,
}: {
  id: string;
  nacimiento: string | null;
  /** Contra qué día se cuenta. Null mientras no esté agendada: se cuenta contra hoy. */
  entrevista: string | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(nacimiento ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edad = enAños(edadA(valor || null, entrevista));

  async function guardar(fecha: string) {
    if (fecha === (nacimiento ?? '')) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/nacimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, nacimiento: fecha || null }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      router.refresh();
    } catch (e) {
      setValor(nacimiento ?? '');
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="os-nacimiento">
      <label className="os-nacimiento-campo" htmlFor={`nacimiento-${id}`}>
        <span className="os-dato-rotulo">Fecha de nacimiento</span>
        {/* Con el control suave del resto del sistema: lo que se completa no
            pesa más que el dato. */}
        <input
          id={`nacimiento-${id}`}
          className="os-control-suave"
          type="date"
          value={valor}
          disabled={guardando}
          onChange={(e) => setValor(e.target.value)}
          onBlur={(e) => guardar(e.target.value)}
        />
      </label>
      <span className="os-nacimiento-edad">
        {edad ? (
          <>
            <strong>{edad}</strong>
            <small>{entrevista ? 'el día de la entrevista' : 'hoy'}</small>
          </>
        ) : (
          <span className="os-dato-falta">sin cargar</span>
        )}
      </span>
      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
