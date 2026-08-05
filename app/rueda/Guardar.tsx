'use client';

import { useState } from 'react';

/**
 * Botón para llevarse la rueda al teléfono.
 *
 * Un enlace con `download` guarda el archivo en Archivos, no en la fototeca: en
 * iOS no hay forma de escribir en Fotos desde una página web. El único camino es
 * la hoja de compartir del sistema, que incluye "Guardar imagen" y esa sí va a
 * Fotos. Por eso el botón comparte el archivo en lugar de descargarlo.
 *
 * Donde no existe compartir archivos (escritorio, navegadores viejos) cae en la
 * descarga de siempre, que ahí es lo que se espera.
 */
export default function Guardar({ src }: { src: string }) {
  const [estado, setEstado] = useState<'listo' | 'trabajando'>('listo');

  async function guardar() {
    setEstado('trabajando');
    try {
      const datos = await fetch(src).then((r) => r.blob());
      const archivo = new File([datos], 'rueda-de-emociones.jpg', {
        type: 'image/jpeg',
      });

      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo] });
        setEstado('listo');
        return;
      }
      descargar();
    } catch {
      // Cancelar la hoja de compartir también entra acá: no es un error que
      // haya que mostrar, alcanza con dejar el botón como estaba.
      descargar();
    }
    setEstado('listo');
  }

  function descargar() {
    const a = document.createElement('a');
    a.href = src;
    a.download = 'rueda-de-emociones.jpg';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <button
      type="button"
      className="rd-btn"
      onClick={guardar}
      disabled={estado === 'trabajando'}
    >
      {estado === 'trabajando' ? 'Preparando…' : 'Descargar imagen'}
    </button>
  );
}
