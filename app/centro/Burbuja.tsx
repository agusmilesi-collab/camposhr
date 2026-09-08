'use client';

/**
 * La burbuja que se abre al lado de la hora que se tocó.
 *
 * Reemplaza al panel que estaba arriba de la grilla: ahí, para saber de qué
 * hora hablaba había que volver a mirar la fila, y con el mes entero en
 * pantalla el panel podía quedar a dos pantallas de la celda elegida.
 *
 * Se dibuja colgada de `.centro` y no donde está la celda: adentro la recortan
 * el marco de la semana y el panel, los dos con `overflow`. De `.centro` y no
 * del `body` porque ahí viven las variables de color de esta zona.
 *
 * El anclaje y el cierre al tocar afuera son los de `lib/burbuja.ts`, los
 * mismos que usa el calendario de las psicólogas.
 */

import { createPortal } from 'react-dom';
import { useBurbuja } from '@/lib/burbuja';

export default function Burbuja({
  ancla,
  cerrar,
  children,
}: {
  ancla: () => DOMRect | null;
  cerrar: () => void;
  children: React.ReactNode;
}) {
  const { caja, sitio } = useBurbuja(ancla, cerrar);

  const host = typeof document === 'undefined' ? null : document.querySelector('.centro');
  if (!host) return null;

  return createPortal(
    <div
      ref={caja}
      className={`centro-burbuja centro-burbuja-${sitio?.lado ?? 'derecha'}`}
      style={{
        top: sitio?.top ?? -9999,
        left: sitio?.left ?? -9999,
        ['--punta' as string]: `${sitio?.punta ?? 20}px`,
        visibility: sitio ? 'visible' : 'hidden',
      }}
      role="dialog"
    >
      {children}
    </div>,
    host
  );
}
