'use client';

/**
 * El botón que le manda la factura por correo al cliente, en la banda de
 * arriba del comprobante.
 *
 * Va en dos toques y dice a quién va antes de mandar: un correo que salió no
 * se retira. Ya enviada, muestra cuándo y a quién, y deja reenviar.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EnvioDeFactura } from '@/lib/correo-factura';

const cuando = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Cordoba',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function EnviarFactura({ id, envio }: { id: string; envio: EnvioDeFactura }) {
  const router = useRouter();
  const [mandando, setMandando] = useState(false);
  const [seguro, setSeguro] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mandar() {
    setMandando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'enviar', id }),
      });
      const r = await res.json().catch(() => null);
      if (!res.ok) setError(r?.error ?? 'No se pudo mandar.');
      router.refresh();
    } catch {
      setError('No se pudo llegar al servidor. Recargá para ver si salió antes de reintentar.');
    } finally {
      setMandando(false);
      setSeguro(false);
    }
  }

  const ya = envio.enviadaAt
    ? `Enviada el ${cuando(envio.enviadaAt)} a ${envio.enviadaA.join(', ')}.`
    : null;

  if (!envio.prendido) return null;
  if (envio.para.length === 0) {
    return (
      <div className="aviso aviso-envio">
        {ya ?? <b>Sin enviar.</b>} El cliente no tiene un contacto que reciba la factura con correo
        cargado: se agrega en su ficha.
      </div>
    );
  }
  return (
    <div className="aviso aviso-envio">
      {seguro ? (
        <>
          <span className="pregunta">¿Mandar esta factura a {envio.para.join(', ')}?</span>
          <button type="button" className="pedir" onClick={mandar} disabled={mandando}>
            {mandando ? 'Mandando…' : 'Sí, enviar'}
          </button>
          <button type="button" className="pedir pedir-no" onClick={() => setSeguro(false)} disabled={mandando}>
            No
          </button>
        </>
      ) : (
        <>
          {ya ?? (
            <>
              <b>Sin enviar.</b> Va a {envio.para.join(', ')}.
            </>
          )}
          <button type="button" className="pedir" onClick={() => setSeguro(true)}>
            {ya ? 'Reenviar' : 'Enviar por correo'}
          </button>
        </>
      )}
      {error && <div className="motivo">{error}</div>}
    </div>
  );
}
