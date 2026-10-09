'use client';

/**
 * Cómo se toma la entrevista, y cómo se cambia.
 *
 * Igual que `Cuando.tsx`: se lee como texto y se edita detrás de "Cambiar". La
 * modalidad se mueve junto con la fecha (la persona avisa que no puede venir y
 * se pasa a online), y con la fecha editable acá y la modalidad no, la mitad de
 * la reprogramación obligaba a volver al tablero.
 *
 * Guarda al elegir y vuelve al texto. El guardado es el mismo de la tarjeta, así
 * que en una entrevista ya agendada el cambio crea o saca la sala de Meet y le
 * vuelve a escribir al candidato, porque cambió por dónde entra.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const MODALIDADES = ['Presencial', 'Online'];

export default function Modalidad({ id, modalidad }: { id: string; modalidad: string | null }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(valor: string) {
    if (!valor || valor === modalidad) {
      setEditando(false);
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios: { modalidad: valor } }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      setEditando(false);
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  if (editando) {
    return (
      <span className="os-dato-valor os-cuando-editar">
        <select
          className="os-campo"
          defaultValue={modalidad ?? ''}
          disabled={guardando}
          autoFocus
          aria-label="Modalidad de la entrevista"
          onChange={(e) => guardar(e.target.value)}
        >
          {!modalidad && <option value="">Sin definir</option>}
          {MODALIDADES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button type="button" className="os-cuando-volver" onClick={() => setEditando(false)}>
          Dejar como estaba
        </button>
        {error && <span className="os-dato-falta">{error}</span>}
      </span>
    );
  }

  return (
    <span className="os-dato-valor os-cuando">
      {modalidad ?? 'Sin definir'}
      <button type="button" className="os-cuando-boton" onClick={() => setEditando(true)}>
        Cambiar
      </button>
    </span>
  );
}
