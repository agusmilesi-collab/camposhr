'use client';

/**
 * Marcar que la persona se dio de baja del proceso de selección.
 *
 * Vive en el cajón de "Editar datos y CV", al lado de eliminar: las dos sacan a
 * la persona del proceso, una dejando el registro y la otra no. Pide
 * confirmación porque mueve muchas cosas a la vez: la saca de los tableros, el
 * portal del cliente la muestra como "Baja" y deja de estar para facturar. Se
 * deshace desde el mismo lugar.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fechaCorta } from '@/lib/hora';

export default function Baja({
  id,
  nombre,
  baja,
}: {
  id: string;
  nombre: string;
  /** El día de la baja, o null si sigue en el proceso. */
  baja: string | null;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mandar(valor: boolean) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/baja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, baja: valor }),
      });
      const r = await res.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      setConfirmando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  if (baja) {
    return (
      <span className="os-baja">
        <span className="os-baja-tag">Baja · {fechaCorta(baja)}</span>
        <button className="os-boton" disabled={guardando} onClick={() => mandar(false)}>
          {guardando ? 'Guardando…' : 'Deshacer la baja'}
        </button>
        {error && <span className="os-form-error">{error}</span>}
      </span>
    );
  }

  if (confirmando) {
    return (
      <span className="os-baja os-baja-confirma">
        <span className="os-baja-texto">
          {nombre} sale de los tableros, figura como Baja en el portal y no se factura.
        </span>
        <button
          className="os-boton os-boton-firme"
          disabled={guardando}
          onClick={() => mandar(true)}
        >
          {guardando ? 'Guardando…' : 'Confirmar la baja'}
        </button>
        <button className="os-boton" disabled={guardando} onClick={() => setConfirmando(false)}>
          Cancelar
        </button>
        {error && <span className="os-form-error">{error}</span>}
      </span>
    );
  }

  return (
    <button className="os-boton" onClick={() => setConfirmando(true)}>
      Se dio de baja
    </button>
  );
}
