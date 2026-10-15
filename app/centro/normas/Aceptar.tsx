'use client';
/**
 * El botón de aceptar las normas, al pie de la hoja.
 *
 * Va al final y no en Inicio a propósito: para apretarlo hay que haber
 * llegado hasta la última norma. Aparece solo con sesión y mientras la
 * persona no tenga aceptada la versión vigente; al aceptar vuelve a Inicio.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Aceptar({ actualizadas }: { actualizadas: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/centro/normas', { method: 'POST' });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError(d?.motivo ?? 'No se pudo guardar. Probá de nuevo.');
        return;
      }
      router.push('/centro/inicio');
      router.refresh();
    } catch {
      setError('No se pudo guardar. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="centro-hoja-aceptar">
      <p>
        {actualizadas
          ? 'Las normas cambiaron desde la última vez que las aceptaste. Si llegaste hasta acá, las leíste enteras.'
          : 'Si llegaste hasta acá, las leíste enteras.'}
      </p>
      {error && <p className="centro-error">{error}</p>}
      <button className="centro-boton" type="button" onClick={aceptar} disabled={enviando}>
        {enviando ? 'Guardando…' : 'Las leí y las acepto'}
      </button>
    </div>
  );
}
