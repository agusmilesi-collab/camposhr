'use client';

/**
 * La barra del informe en hojas: volver al portal y descargar.
 *
 * El informe del cliente es el mismo que la evaluadora revisa en su ficha
 * (`EnHojas`), así que lo que se descarga es esa misma página impresa: no hay
 * partes para elegir ni un documento aparte escondido. El botón abre el
 * diálogo de impresión del navegador, que es donde se guarda como PDF.
 *
 * Espera a que las fuentes estén listas: imprimir antes deja el texto medido
 * con la tipografía de reemplazo y los saltos de página caen en otro lado.
 */
export default function BarraHojas({ volver }: { volver: string }) {
  return (
    <header className="sitio-barra">
      <a className="sitio-volver" href={volver}>
        ← Volver al portal
      </a>
      <button
        type="button"
        className="sitio-boton"
        onClick={() => {
          (document.fonts?.ready ?? Promise.resolve()).then(() => window.print());
        }}
      >
        Descargar PDF
      </button>
    </header>
  );
}
