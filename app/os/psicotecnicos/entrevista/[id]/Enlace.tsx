'use client';

/**
 * El enlace de la videollamada.
 *
 * Vive acá porque acá se lo necesita: a la hora de la entrevista online, el
 * enlace está en el calendario o en el chat donde se acordó, y buscarlo con la
 * persona esperando es el minuto peor puesto del día.
 *
 * Se guarda al salir del campo y no con un botón: es un dato que se pega una
 * vez y no se vuelve a mirar hasta que hace falta abrirlo, y un botón de
 * guardar sin apretar deja el enlace escrito y perdido.
 *
 * Cuando hay uno cargado, lo que se ve es el botón para entrar. El campo
 * aparece al tocar "Cambiar": lo que se hace todos los días es entrar, no
 * editar.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Enlace({ id, enlace }: { id: string; enlace: string | null }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [valor, setValor] = useState(enlace ?? '');
  const [editando, setEditando] = useState(!enlace);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const limpio = valor.trim();
    if (limpio === (enlace ?? '')) {
      setEditando(!limpio);
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo: 'enlaceEntrevista', valor: limpio || null }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      setEditando(!limpio);
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo guardar.');
    }
  }

  if (!editando && enlace) {
    return (
      <span className="os-entrevista-enlace">
        <a className="os-boton os-boton-firme" href={enlace} target="_blank" rel="noreferrer">
          Entrar a la videollamada
        </a>
        <button className="os-enlace-boton" type="button" onClick={() => setEditando(true)}>
          Cambiar
        </button>
      </span>
    );
  }

  return (
    <span className="os-entrevista-enlace">
      <input
        className="os-campo"
        type="url"
        inputMode="url"
        placeholder="Pegá el enlace de la videollamada"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        aria-label="Enlace de la videollamada"
      />
      {error && <span className="os-form-error">{error}</span>}
    </span>
  );
}
