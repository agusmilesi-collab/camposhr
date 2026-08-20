'use client';

/**
 * Dar la evaluación por entregada.
 *
 * Va al pie del informe porque el informe es lo que se entrega: el botón
 * queda al final de lo que el cliente va a recibir.
 *
 * Necesita la conclusión puesta: una evaluación sin conclusión no está
 * terminada, aunque el informe esté cargado.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Entregar({
  id,
  recomendacion,
}: {
  id: string;
  recomendacion: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entregar() {
    setError(null);
    setTrabajando(true);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo: 'etapa', valor: 'Entregado' }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="os-barra-acciones">
      <button
        className="os-boton os-boton-firme"
        disabled={trabajando || !recomendacion}
        onClick={entregar}
      >
        {trabajando ? 'Entregando…' : 'Entregar'}
      </button>
      <span className="os-columna-monto">
        {recomendacion
          ? 'La evaluación pasa a Entregados.'
          : 'Primero cargá la conclusión, en Recomendación.'}
      </span>
      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
