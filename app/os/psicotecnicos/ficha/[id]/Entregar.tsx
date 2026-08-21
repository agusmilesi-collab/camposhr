'use client';

/**
 * Subir el informe al portal del cliente.
 *
 * Es la misma acción que antes se llamaba entregar: la evaluación pasa a
 * Entregados y con eso el informe aparece en el portal de la empresa. El nombre
 * dice lo que ocurre, que es que el cliente pasa a verlo.
 *
 * Necesita la conclusión puesta: sin conclusión el informe sale sin nivel de
 * ajuste, que es lo primero que el cliente busca.
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

  async function subir() {
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

  // Sin contenedor propio: el botón se acomoda en la fila de acciones de la
  // pantalla que lo use. Por qué está apagado se dice al apoyar el mouse, que
  // es donde se busca cuando un botón no responde.
  return (
    <>
      <button
        className="os-boton os-boton-firme"
        disabled={trabajando || !recomendacion}
        onClick={subir}
        title={recomendacion ? '' : 'Primero cargá la conclusión, en Recomendación.'}
      >
        {trabajando ? 'Subiendo…' : 'Subir al portal'}
      </button>
      {error && <span className="os-form-error">{error}</span>}
    </>
  );
}
