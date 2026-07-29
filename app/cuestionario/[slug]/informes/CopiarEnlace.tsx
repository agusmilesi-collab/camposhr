'use client';

import { useState } from 'react';

/** Copia el enlace propio del líder para mandárselo. */
export default function CopiarEnlace({ token }: { token: string | null }) {
  const [copiado, setCopiado] = useState(false);

  if (!token) {
    return <span className="inf-sin-link">Sin enlace</span>;
  }

  const url = `https://camposhr.com/l/${token}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <button
      type="button"
      className={copiado ? 'inf-link inf-link-ok' : 'inf-link'}
      onClick={copiar}
      title="Copiar el enlace personal de este líder"
    >
      {copiado ? 'Enlace copiado' : 'Copiar enlace'}
    </button>
  );
}
