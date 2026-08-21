'use client';

/**
 * Cerrar la entrevista desde la hoja donde se la tuvo.
 *
 * El mismo botón está en la lista, pero volver a buscar la fila para marcarla
 * es el paso donde la marca se pospone y se pierde: la evaluación queda
 * agendada cuando ya se tomó.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Tomada({ id }: { id: string }) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function marcar() {
    setError(null);
    setTrabajando(true);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo: 'etapa', valor: 'Por analizar' }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        setTrabajando(false);
        return;
      }
      router.push('/os/psicotecnicos/entrevistas');
    } catch {
      setError('No se pudo guardar.');
      setTrabajando(false);
    }
  }

  return (
    <>
      <button className="os-boton os-boton-firme" disabled={trabajando} onClick={marcar}>
        {trabajando ? 'Guardando…' : 'Entrevista tomada'}
      </button>
      {error && <span className="os-form-error">{error}</span>}
    </>
  );
}
