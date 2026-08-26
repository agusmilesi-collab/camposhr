'use client';

/**
 * La dirección de las láminas, lista para pegar.
 *
 * Sirve para abrirlas en la otra pantalla, o para pasárselas a la evaluadora
 * que va a administrar. Es la misma dirección del botón de al lado: acá se
 * copia en vez de abrirse.
 *
 * El enlace pide sesión del OS, así que no sirve para mandárselo a la persona
 * evaluada: ella ve las láminas por la pantalla compartida.
 *
 * **Copiado se dice en el mismo botón**, tres segundos, y no en un aviso al
 * lado: el botón vive en una celda de la fila de acciones, y un segundo
 * elemento corría el resto de los botones de su columna.
 */

import { useState } from 'react';

export default function LinkLaminas({ href }: { href: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <button className="os-boton" type="button" onClick={copiar}>
      {copiado ? 'Copiado' : 'Copiar link'}
    </button>
  );
}
