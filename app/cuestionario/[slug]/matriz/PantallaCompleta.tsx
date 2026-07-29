'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Envuelve la matriz y la lleva a pantalla completa, para proyectarla en el
 * salón. En pantalla completa se ve solo la matriz, sin el resto de la página.
 */
export default function PantallaCompleta({
  children,
}: {
  children: React.ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [activa, setActiva] = useState(false);

  useEffect(() => {
    const cambio = () => setActiva(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', cambio);
    return () => document.removeEventListener('fullscreenchange', cambio);
  }, []);

  async function alternar() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await caja.current?.requestFullscreen();
    } catch {
      // Algunos navegadores la bloquean; la matriz se sigue viendo igual.
    }
  }

  return (
    <div ref={caja} className="mx-caja">
      <button
        type="button"
        className={activa ? 'mx-full mx-full-on' : 'mx-full'}
        onClick={alternar}
      >
        {activa ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
            </svg>
            Salir
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
            </svg>
            Pantalla completa
          </>
        )}
      </button>
      {children}
    </div>
  );
}
