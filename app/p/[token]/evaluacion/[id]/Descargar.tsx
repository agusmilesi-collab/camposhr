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
 *
 * **En la muestra el botón está pero no baja nada.** Ese informe se le enseña a
 * quien pregunta por los precios, y una copia suelta de un informe psicolaboral
 * que circula por ahí no se distingue de uno real. El botón se deja a la vista
 * porque forma parte de lo que se está mostrando; apretarlo dice por qué no.
 */

import { useState } from 'react';

export default function Descargar({ muestra = false }: { muestra?: boolean }) {
  const [aviso, setAviso] = useState(false);

  if (muestra) {
    return (
      <span className="pinf-descargar-muestra">
        <button
          className="pinf-descargar"
          type="button"
          onClick={() => setAviso(true)}
          aria-describedby={aviso ? 'pinf-aviso-descarga' : undefined}
        >
          Descargar en PDF
        </button>
        {aviso && (
          <span className="pinf-aviso-descarga" id="pinf-aviso-descarga" role="status">
            En el informe de muestra la descarga está desactivada. En el tuyo el botón
            guarda el PDF.
          </span>
        )}
      </span>
    );
  }

  return (
    <button className="pinf-descargar" type="button" onClick={() => window.print()}>
      Descargar en PDF
    </button>
  );
}
