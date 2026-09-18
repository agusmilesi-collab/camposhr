'use client';

import { useState } from 'react';

/**
 * El guion, un solo campo.
 *
 * Se guarda al salir del campo y también con el botón, que existe porque con
 * un texto largo nadie quiere adivinar si lo que escribió quedó. El estado de
 * al lado dice en qué anda.
 */

type Estado = 'quieto' | 'guardando' | 'guardado' | 'error';

export default function Editor({
  token,
  inicial,
  propio,
}: {
  token: string;
  inicial: string;
  /** Falso cuando todavía es el borrador armado con las notas del deck. */
  propio: boolean;
}) {
  const [texto, setTexto] = useState(inicial);
  const [guardado, setGuardado] = useState(propio ? inicial : null);
  const [estado, setEstado] = useState<Estado>('quieto');

  const sinGuardar = texto !== guardado;

  async function guardar() {
    if (!sinGuardar) return;
    setEstado('guardando');
    try {
      const res = await fetch(`/api/guion/${token}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) throw new Error(await res.text());
      setGuardado(texto);
      setEstado('guardado');
    } catch {
      setEstado('error');
    }
  }

  return (
    <div className="guion">
      <div className="guion-barra">
        <span className={`guion-estado guion-estado-${estado}`}>
          {estado === 'guardando' && 'Guardando…'}
          {estado === 'error' && 'No se guardó. Probá de nuevo.'}
          {estado !== 'guardando' && estado !== 'error' && sinGuardar && 'Sin guardar'}
          {estado === 'guardado' && !sinGuardar && 'Guardado'}
          {estado === 'quieto' && !sinGuardar && guardado !== null && 'Al día'}
        </span>
        <button
          type="button"
          className="hub-btn"
          onClick={guardar}
          disabled={!sinGuardar || estado === 'guardando'}
        >
          Guardar
        </button>
      </div>

      <textarea
        className="guion-texto"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          if (estado !== 'quieto') setEstado('quieto');
        }}
        onBlur={guardar}
        spellCheck
      />
    </div>
  );
}
