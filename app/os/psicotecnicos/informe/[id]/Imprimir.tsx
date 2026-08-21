'use client';

/**
 * Abre el diálogo de impresión apenas se muestra el informe.
 *
 * El botón de la ficha dice "Descargar PDF", así que la página tiene que hacer
 * eso y no dejar al usuario buscando cómo. El navegador ofrece guardar en PDF
 * dentro de ese mismo diálogo.
 *
 * Espera a que las fuentes estén listas: imprimir antes deja el texto medido
 * con la tipografía de reemplazo y los saltos de página caen en otro lado.
 */

import { useEffect } from 'react';

export default function Imprimir() {
  useEffect(() => {
    let vivo = true;
    document.fonts?.ready.then(() => {
      if (vivo) window.print();
    });
    return () => {
      vivo = false;
    };
  }, []);
  return null;
}
