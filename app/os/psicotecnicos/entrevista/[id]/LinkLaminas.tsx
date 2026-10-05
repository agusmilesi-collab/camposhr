'use client';

/**
 * La dirección de las láminas, lista para pegar.
 *
 * Sirve para abrirlas en la otra pantalla, o para pasárselas a la evaluadora
 * que va a administrar. Es la misma dirección del botón de al lado: acá se
 * copia en vez de abrirse.
 *
 * Esa dirección pide sesión del OS, así que no sirve para la persona evaluada.
 * Cuando el enlace es para ella (`paraCandidato`), se pide uno con token, que
 * abre sin clave y vence al día.
 *
 * **Copiado se dice en el mismo botón**, tres segundos, y no en un aviso al
 * lado: el botón vive en una celda de la fila de acciones, y un segundo
 * elemento corría el resto de los botones de su columna.
 */

import { useState } from 'react';

export default function LinkLaminas({
  href,
  numero,
  /** Para que entre en la fila donde lo usen, con la altura de sus vecinos. */
  clase = 'os-boton',
  paraCandidato,
}: {
  href: string;
  numero?: number;
  clase?: string;
  /** Para quién es: con esto se copia el enlace con token y no el del OS. */
  paraCandidato?: { evaluacionId: string; test: string; lamina?: number };
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      let enlace = new URL(href, window.location.origin).toString();
      if (paraCandidato) {
        const res = await fetch('/api/os/laminas-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evaluacionId: paraCandidato.evaluacionId,
            test: paraCandidato.test,
          }),
        });
        const r = await res.json().catch(() => null);
        if (!r?.ok) return;
        enlace = r.enlace;
        // El enlace nace sin lámina marcada: se le pone la que la evaluadora
        // tiene adelante, para que la persona no abra en la primera cuando la
        // encuesta ya va por la cuarta.
        if (paraCandidato.lamina) {
          fetch('/api/os/laminas-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paraCandidato),
          }).catch(() => {});
        }
      }
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <button className={clase} type="button" onClick={copiar}>
      {/* El número dice en qué paso del test va: el orden de los botones es el
          orden en que se administra, y numerados no hay que deducirlo. */}
      {numero && !copiado && <span className="os-boton-paso">{numero}</span>}
      {copiado ? 'Copiado' : 'Copiar link'}
    </button>
  );
}
