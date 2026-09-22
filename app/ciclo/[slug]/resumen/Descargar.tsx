'use client';

/**
 * Guardar el resumen como PDF.
 *
 * Abre la hoja de imprimir del teléfono, que en iPhone y en Android ofrece
 * guardarlo como PDF. Generar el archivo del lado del servidor pediría otra
 * ruta y volver a armar la página; esto usa la misma que ya está leyendo.
 */
export default function Descargar() {
  return (
    <button type="button" className="cq-btn rs-descargar" onClick={() => window.print()}>
      Descargar en PDF
    </button>
  );
}
