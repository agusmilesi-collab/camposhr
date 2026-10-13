'use client';

/**
 * El enlace de las láminas para la persona evaluada, desde Herramientas.
 *
 * La tarjeta abre las láminas en el OS, que pide la clave del equipo: esa
 * dirección no se le puede mandar a nadie de afuera. Este botón copia una con
 * token, que abre sin clave y vence al día.
 *
 * El token queda guardado en este navegador: la pantalla de láminas lo lee
 * para decirle a la de la persona en cuál va.
 */

import { useState } from 'react';

export default function CopiarLinkLaminas({
  test,
  texto = 'Copiar link para el candidato',
}: {
  test: string;
  texto?: string;
}) {
  const [estado, setEstado] = useState<'quieto' | 'copiado' | 'error'>('quieto');

  async function copiar() {
    const clave = `laminas-enlace-${test}`;
    try {
      let token: string | null = null;
      try {
        token = window.localStorage.getItem(clave);
      } catch {
        // Sin almacenamiento se genera uno nuevo cada vez.
      }
      const res = await fetch('/api/os/laminas-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test, token: token ?? undefined }),
      });
      const r = await res.json().catch(() => null);
      if (!r?.ok) throw new Error('sin enlace');
      try {
        window.localStorage.setItem(clave, r.token);
      } catch {
        // Ídem.
      }
      await navigator.clipboard.writeText(r.enlace);
      setEstado('copiado');
    } catch {
      setEstado('error');
    }
    setTimeout(() => setEstado('quieto'), 3000);
  }

  return (
    <button className="os-boton os-boton-fila" type="button" onClick={copiar}>
      {estado === 'copiado' ? 'Copiado' : estado === 'error' ? 'No se pudo copiar' : texto}
    </button>
  );
}
