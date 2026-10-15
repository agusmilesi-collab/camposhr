'use client';
/**
 * El circulito de asistencia de un turno: gris sin marcar, verde si vino,
 * rojo si no vino. Cada toque pasa al estado siguiente y vuelve al principio,
 * así un error se corrige tocando de nuevo.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const SIGUIENTE: Record<string, boolean | null> = { null: true, true: false, false: null };
const TITULO: Record<string, string> = {
  null: 'Marcar si vino',
  true: 'Vino. Tocá para marcar que no vino',
  false: 'No vino. Tocá para desmarcar',
};

export default function Asistencia({ id, asistio }: { id: string; asistio: boolean | null }) {
  const router = useRouter();
  const [valor, setValor] = useState<boolean | null>(asistio);
  const [enviando, setEnviando] = useState(false);

  async function cambiar() {
    const nuevo = SIGUIENTE[String(valor)];
    setValor(nuevo);
    setEnviando(true);
    try {
      const res = await fetch('/api/centro/turnos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, asistio: nuevo }),
      });
      if (!res.ok) setValor(valor);
      else router.refresh();
    } catch {
      setValor(valor);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <button
      type="button"
      className={`centro-asistencia${valor === true ? ' vino' : valor === false ? ' no-vino' : ''}`}
      title={TITULO[String(valor)]}
      aria-label={TITULO[String(valor)]}
      onClick={cambiar}
      disabled={enviando}
    />
  );
}
