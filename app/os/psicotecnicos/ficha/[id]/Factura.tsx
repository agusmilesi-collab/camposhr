'use client';

/**
 * Si se facturó, y con qué número.
 *
 * El número aparece recién cuando se marca facturado: pedirlo antes es pedir
 * un dato que todavía no existe. Guarda solo, como el resto de la ficha.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Factura({
  id,
  facturado,
  numero,
}: {
  id: string;
  facturado: boolean;
  numero: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [puesto, setPuesto] = useState(facturado);
  const [error, setError] = useState<string | null>(null);

  async function guardar(campos: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios: campos }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return false;
      }
      empezar(() => router.refresh());
      return true;
    } catch {
      setError('No se pudo guardar.');
      return false;
    }
  }

  async function alternar() {
    const v = !puesto;
    setPuesto(v);
    // Al desmarcar se limpia el número: quedaría un número de una factura que
    // ya no está emitida.
    const ok = await guardar(v ? { facturado: true } : { facturado: false, numeroFactura: null });
    if (!ok) setPuesto(!v);
  }

  return (
    <div className="os-factura">
      <button
        type="button"
        className={`os-ingreso-opcion os-factura-tilde${puesto ? ' puesta' : ''}`}
        onClick={alternar}
        aria-pressed={puesto}
      >
        {puesto ? 'Sí' : 'Todavía no'}
      </button>

      {puesto && (
        <input
          className="os-campo os-factura-numero"
          defaultValue={numero ?? ''}
          placeholder="Nº de factura"
          maxLength={40}
          onBlur={(e) => guardar({ numeroFactura: e.target.value.trim() || null })}
          aria-label="Número de factura"
        />
      )}

      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
