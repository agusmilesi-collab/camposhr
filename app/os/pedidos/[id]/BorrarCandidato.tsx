'use client';

/**
 * Sacar a un candidato de la búsqueda, desde la lista del pedido.
 *
 * Es el mismo borrado que el de la ficha (`DELETE /api/os/candidatos`): arrastra
 * manchas, tests e informe por cascade y queda anotado en `accesos`. Está acá
 * porque el error se ve acá: se cargaron tres candidatos, uno entró repetido o
 * al pedido equivocado, y la lista es donde se nota.
 *
 * **Pide confirmación en el mismo lugar**, sin ventana encima: el botón se
 * convierte en "Borrar / Cancelar". Un borrado que arrastra la codificación de
 * una persona no puede pasar por un solo clic distraído, y una ventana modal
 * para dos palabras es más pantalla de la que hace falta.
 *
 * **Lo entregado no se borra desde acá**, y eso lo decide el servidor
 * (`borrarCandidato`): el informe ya salió y el cliente lo tiene.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function BorrarCandidato({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function borrar() {
    setError(null);
    setBorrando(true);
    try {
      const res = await fetch('/api/os/candidatos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo borrar.');
        setConfirmando(false);
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo borrar.');
      setConfirmando(false);
    } finally {
      setBorrando(false);
    }
  }

  if (error) {
    return <span className="os-dato-falta">{error}</span>;
  }

  if (confirmando) {
    return (
      <span className="os-borrar-confirma">
        <button
          type="button"
          className="os-boton os-boton-peligro"
          onClick={borrar}
          disabled={borrando}
        >
          {borrando ? 'Borrando…' : 'Borrar'}
        </button>
        <button type="button" className="os-boton" onClick={() => setConfirmando(false)}>
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="os-pendiente-accion os-borrar-x"
      onClick={() => setConfirmando(true)}
      title={`Sacar a ${nombre} de esta búsqueda`}
      aria-label={`Sacar a ${nombre} de esta búsqueda`}
    >
      ×
    </button>
  );
}
