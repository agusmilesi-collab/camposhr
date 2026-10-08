'use client';

/**
 * El botón que le pide el CAE a ARCA y manda la factura, en la banda de arriba
 * del comprobante.
 *
 * Va acá y no en la tabla de facturas porque antes de pedirlo hay que leer lo
 * que se va a autorizar: una factura con CAE no se corrige, se anula con una
 * nota de crédito. Solo lo dibuja el OS; el portal usa la misma hoja sin él.
 *
 * **Es un solo botón para las dos cosas**: autorizada, la factura sale por
 * correo sin otro paso. Por eso la pregunta dice a quién va antes de emitir.
 * La excepción es el cliente que la recibe por su portal de proveedores: a ese
 * no se le manda, se descarga y se carga ahí a mano.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PedirCae({
  id,
  para,
  portal,
  seManda,
}: {
  id: string;
  /** A quién le va a llegar. Vacío es que no hay a quién. */
  para: string[];
  /** El cliente la recibe por su portal de proveedores. */
  portal: boolean;
  /** Falso cuando el correo está apagado o la factura es de prueba. */
  seManda: boolean;
}) {
  const router = useRouter();
  const [pidiendo, setPidiendo] = useState(false);
  /** El primer toque pregunta; el segundo emite. */
  const [seguro, setSeguro] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sale = seManda && !portal && para.length > 0;

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
      // Emitida pero sin correo: se dice, que si no parece que salió todo.
      else if (r?.correo?.que === 'sin enviar') {
        setError(`La factura quedó emitida, pero el correo no salió: ${r.correo.motivo}`);
      }
      router.refresh();
    } catch {
      setError('No se pudo llegar al servidor. No se sabe si se emitió: recargá antes de reintentar.');
    } finally {
      setPidiendo(false);
      setSeguro(false);
    }
  }

  // Qué va a pasar con el correo, dicho antes de emitir.
  const destino = portal
    ? 'Este cliente la recibe por su portal de proveedores: no se manda por correo. Después se descarga y se carga ahí.'
    : !seManda
      ? 'No se manda por correo.'
      : para.length > 0
        ? `Se le manda a ${para.join(', ')}.`
        : 'No se manda por correo: el cliente no tiene un contacto que reciba la factura. Se puede agregar en su ficha y enviarla después.';

  return (
    <>
      {/* En dos toques: lo que sale de acá es una factura en ARCA, que no se
          borra ni se corrige, y un correo, que no se retira. */}
      {seguro ? (
        <>
          <span className="pregunta">
            ¿Emitir esta factura en ARCA? Después no se borra ni se corrige. {destino}
          </span>
          <button type="button" className="pedir" onClick={pedir} disabled={pidiendo}>
            {pidiendo ? 'Emitiendo…' : sale ? 'Sí, emitir y enviar' : 'Sí, emitir'}
          </button>
          <button type="button" className="pedir pedir-no" onClick={() => setSeguro(false)} disabled={pidiendo}>
            No
          </button>
        </>
      ) : (
        <button type="button" className="pedir" onClick={() => setSeguro(true)}>
          {sale ? 'Pedir CAE y enviar' : 'Pedir CAE a ARCA'}
        </button>
      )}
      {error && <div className="motivo">{error}</div>}
    </>
  );
}
