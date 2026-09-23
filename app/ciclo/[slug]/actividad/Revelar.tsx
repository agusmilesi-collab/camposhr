'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * El botón de la placa del ranking que revela la pregunta siguiente.
 *
 * Lo tocan las expositoras con el mouse de la compu que proyecta, cuando ya se
 * contestó la que está a la vista. Manda el paso que se ve en pantalla, así un
 * doble toque no avanza dos.
 */
export default function Revelar({
  slug,
  revelado,
  etiqueta,
}: {
  slug: string;
  revelado: number;
  etiqueta: string;
}) {
  const router = useRouter();
  const [yendo, setYendo] = useState(false);

  async function revelar() {
    setYendo(true);
    try {
      await fetch(`/api/ciclo/${slug}/revelar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ desde: revelado }),
      });
      router.refresh();
    } finally {
      setYendo(false);
      // El botón vive dentro del marco de la placa: si se queda con el foco,
      // las flechas dejan de pasar placas hasta que alguien toque afuera.
      (document.activeElement as HTMLElement | null)?.blur();
      try {
        window.parent.focus();
      } catch {}
    }
  }

  return (
    <button type="button" className="cp-revelar" disabled={yendo} onClick={revelar}>
      {yendo ? 'Un segundo…' : etiqueta}
    </button>
  );
}
