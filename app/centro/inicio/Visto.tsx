'use client';
/**
 * El "Ok" de un aviso de Inicio. La tarjeta se va en el acto y el aviso se
 * guarda por detrás; si no se pudo guardar, vuelve a aparecer.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Visto({ clave }: { clave: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function marcar(ev: React.MouseEvent<HTMLButtonElement>) {
    const tarjeta = ev.currentTarget.closest('article');
    if (tarjeta) tarjeta.hidden = true;
    setEnviando(true);
    try {
      const res = await fetch('/api/centro/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      if (tarjeta) tarjeta.hidden = false;
      setEnviando(false);
    }
  }

  return (
    <button type="button" className="centro-tarjeta-ok" onClick={marcar} disabled={enviando}>
      Ok
    </button>
  );
}
