'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * El botón de la card de quien escribió la más votada. Lo toca la expositora
 * con el mouse de la compu que proyecta, cuando la sala terminó de contestar:
 * abre los teléfonos y a quien la escribió le aparece "Reclamar el premio".
 * Así no tiene que ir al panel a buscar la tarjeta de los Deer Coins, que dice
 * otra placa.
 */
export default function AbrirReclamo({
  slug,
  actividadId,
}: {
  slug: string;
  actividadId: string;
}) {
  const router = useRouter();
  const [yendo, setYendo] = useState(false);

  async function abrir() {
    setYendo(true);
    try {
      await fetch(`/api/ciclo/${slug}/revelar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reclamo: actividadId }),
      });
      router.refresh();
    } finally {
      setYendo(false);
      // Con el foco adentro del marco, las flechas dejan de pasar placas.
      (document.activeElement as HTMLElement | null)?.blur();
      try {
        window.parent.focus();
      } catch {}
    }
  }

  return (
    <button type="button" className="cp-revelar" disabled={yendo} onClick={abrir}>
      {yendo ? 'Un segundo…' : 'Reclamar pozo'}
    </button>
  );
}
