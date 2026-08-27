'use client';

/**
 * Cuándo cae la entrevista, y cómo se cambia cuando se reprograma.
 *
 * Se muestra como texto porque es lo que se lee al abrir la hoja, y se edita
 * detrás de "Reprogramar": las entrevistas se mueven (la persona avisa que no
 * puede, se corre una hora), y hasta ahora eso obligaba a volver al tablero a
 * buscar la tarjeta. Un campo de fecha siempre abierto en el encabezado invita
 * a tocarlo sin querer sobre el dato que más se mira.
 *
 * Guarda al elegir y vuelve al texto: no hay botón de confirmar, como en el
 * resto de la hoja.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cuandoCae, desdeInput, hoy, paraInput } from '@/lib/hora';

export default function Cuando({ id, cuando }: { id: string; cuando: string | null }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(valor: string) {
    const iso = desdeInput(valor);
    if (!iso) return;
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios: { fechaEntrevista: iso } }),
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
        <input
          className="os-campo"
          type="datetime-local"
          defaultValue={paraInput(cuando)}
          disabled={guardando}
          autoFocus
          aria-label="Cuándo es la entrevista"
          onChange={(e) => guardar(e.target.value)}
        />
        <button type="button" className="os-cuando-volver" onClick={() => setEditando(false)}>
          Dejar como estaba
        </button>
        {error && <span className="os-dato-falta">{error}</span>}
      </span>
    );
  }

  return (
    <span className="os-dato-valor os-cuando">
      {cuandoCae(cuando, hoy()) ?? 'Sin fecha'}
      <button
        type="button"
        className="os-cuando-boton"
        onClick={() => setEditando(true)}
      >
        Reprogramar
      </button>
    </span>
  );
}
