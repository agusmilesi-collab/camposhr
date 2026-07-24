'use client';

import { useState } from 'react';

export default function CopyLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

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
    setTimeout(() => setCopiado(false), 1600);
  }

  return (
    <button
      type="button"
      className={`copiar${copiado ? ' ok' : ''}`}
      onClick={copiar}
      aria-label="Copiar link del cliente"
    >
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
}
