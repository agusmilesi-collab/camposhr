'use client';

/**
 * Un dibujo que se agranda al tocarlo.
 *
 * Lo usa el gráfico del Benziger en la ficha: al lado de las cruces mide lo
 * que una de ellas, y para leer dónde cae cada vértice hay que verlo grande.
 * Se cierra tocando fuera, con la cruz o con Escape.
 *
 * El dibujo grande es el mismo que llega como `grande` y no una imagen del
 * chico: un SVG agrandado no pierde definición.
 */

import { useEffect, useState } from 'react';

export default function Ampliable({
  children,
  grande,
  titulo,
}: {
  children: React.ReactNode;
  grande: React.ReactNode;
  titulo: string;
}) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        className="os-ampliable"
        onClick={() => setAbierto(true)}
        title="Ver en grande"
        aria-label={`${titulo}: ver en grande`}
      >
        {children}
      </button>
      {abierto && (
        <div className="os-ampliado" role="dialog" aria-label={titulo} onClick={() => setAbierto(false)}>
          <div className="os-ampliado-caja" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="os-ampliado-cerrar"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar"
            >
              ×
            </button>
            {grande}
          </div>
        </div>
      )}
    </>
  );
}
