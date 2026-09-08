'use client';

/**
 * La burbuja que se abre al lado de lo que se tocó en el calendario.
 *
 * Reemplaza al panel que estaba arriba de la grilla: ahí, para saber de qué
 * hora hablaba había que volver a mirar la fila, y al abrirse corría la grilla
 * de lugar. Colgada al lado de la celda, la respuesta está donde estaba la
 * pregunta.
 *
 * **Se dibuja colgada de `.os` y no donde está la celda.** Adentro la recortan
 * el marco de la tabla y el panel, los dos con `overflow`, y en las últimas
 * filas no se vería nada. De `.os` y no del `body` porque ahí viven las
 * variables de color.
 *
 * El anclaje y el cierre al tocar afuera viven en `lib/burbuja.ts`, que
 * comparte con la burbuja del inquilino: el mecanismo es el mismo y lo que
 * cambia es el marcado, porque cada zona tiene su hoja de estilo.
 */

import { createPortal } from 'react-dom';
import { useBurbuja } from '@/lib/burbuja';
import { anfitrion } from '../anclar';

export default function Burbuja({
  ancla,
  cerrar,
  children,
}: {
  /** Dónde está lo que se tocó. Se vuelve a preguntar por cuadro, porque la
   *  selección crece mientras se arrastra. */
  ancla: () => DOMRect | null;
  cerrar: () => void;
  children: React.ReactNode;
}) {
  const { caja, sitio } = useBurbuja(ancla, cerrar);

  const host = anfitrion();
  if (!host) return null;

  return createPortal(
    <div
      ref={caja}
      className={`os-burbuja os-burbuja-${sitio?.lado ?? 'derecha'}`}
      style={{
        top: sitio?.top ?? -9999,
        left: sitio?.left ?? -9999,
        // La punta se ubica con una variable y no con un estilo suelto, para
        // que la hoja siga decidiendo de qué lado sale.
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
