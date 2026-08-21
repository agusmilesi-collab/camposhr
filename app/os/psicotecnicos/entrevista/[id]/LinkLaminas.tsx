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
 */

import { useState } from 'react';

export default function LinkLaminas({ href, apagado }: { href: string; apagado?: boolean }) {
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
    <>
      <button className="os-boton" type="button" onClick={copiar} disabled={apagado}>
        Copiar link
      </button>
      {copiado && <span className="os-form-ok">Copiado</span>}
    </>
  );
}
