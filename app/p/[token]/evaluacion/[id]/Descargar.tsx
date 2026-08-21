'use client';

/**
 * Guardar el informe como PDF.
 *
 * Usa la impresión del navegador, que en "Destino" ofrece guardar en PDF. Es lo
 * mismo que haría el cliente con Ctrl+P, con el botón a la vista para que no
 * haya que saberlo.
 *
 * La hoja ya tiene sus reglas de impresión: cada capítulo en su página, y sin
 * la barra de arriba.
 */

export default function Descargar() {
  return (
    <button className="pinf-descargar" type="button" onClick={() => window.print()}>
      Descargar en PDF
    </button>
  );
}
