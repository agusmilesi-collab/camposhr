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
 *
 * **Si al agendar se creó una sala de Meet, se muestra esa y no se edita.** Es
 * la que recibió el candidato por correo y la que está en el calendario de la
 * evaluadora: un enlace pegado a mano al lado serían dos puertas para la misma
 * entrevista. El campo queda para la online sin calendario conectado, que no
 * tiene sala propia.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Enlace({
  id,
  enlace,
  meet = null,
  confirmo = false,
}: {
  id: string;
  enlace: string | null;
  /** La sala de Meet creada al agendar, si la entrevista es online y existe. */
  meet?: string | null;
  /** Si el candidato tocó "Confirmar asistencia" en el correo. */
  confirmo?: boolean;
}) {
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

  if (meet) {
    return (
      <span className="os-entrevista-enlace">
        <a className="os-boton os-boton-firme" href={meet} target="_blank" rel="noreferrer">
          Entrar a la videollamada
        </a>
        <span className={`os-sello-estado ${confirmo ? 'os-verde' : 'os-gris'}`}>
          {confirmo ? 'Confirmó asistencia' : 'Sin confirmar'}
        </span>
      </span>
    );
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
