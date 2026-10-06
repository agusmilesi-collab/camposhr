'use client';

/**
 * El botón que le pide el CAE a ARCA, en la banda de arriba del comprobante.
 *
 * Va acá y no en la tabla de facturas porque antes de pedirlo hay que leer lo
 * que se va a autorizar: una factura con CAE no se corrige, se anula con una
 * nota de crédito. Solo lo dibuja el OS; el portal usa la misma hoja sin él.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PedirCae({ id }: { id: string }) {
  const router = useRouter();
  const [pidiendo, setPidiendo] = useState(false);
  /** El primer toque pregunta; el segundo emite. */
  const [seguro, setSeguro] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedir() {
    setPidiendo(true);
    setError(null);
    try {
      const res = await fetch('/api/os/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'arca', id }),
      });
      const r = await res.json().catch(() => null);
      if (!res.ok) setError(r?.error ?? 'No se pudo pedir el CAE.');
      router.refresh();
    } catch {
      setError('No se pudo llegar al servidor. No se sabe si se emitió: recargá antes de reintentar.');
    } finally {
      setPidiendo(false);
      setSeguro(false);
    }
  }

  return (
    <>
      {/* En dos toques: lo que sale de acá es una factura en ARCA, que no se
          borra ni se corrige. Se anula con una nota de crédito. */}
      {seguro ? (
        <>
          <span className="pregunta">¿Emitir esta factura en ARCA? Después no se borra ni se corrige.</span>
          <button type="button" className="pedir" onClick={pedir} disabled={pidiendo}>
            {pidiendo ? 'Pidiendo el CAE…' : 'Sí, emitir'}
          </button>
          <button type="button" className="pedir pedir-no" onClick={() => setSeguro(false)} disabled={pidiendo}>
            No
          </button>
        </>
      ) : (
        <button type="button" className="pedir" onClick={() => setSeguro(true)}>
          Pedir CAE a ARCA
        </button>
      )}
      {error && <div className="motivo">{error}</div>}
    </>
  );
}
