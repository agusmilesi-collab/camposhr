'use client';

import { useState } from 'react';

export default function AccionesQR({
  url,
  slug,
}: {
  url: string;
  slug: string;
}) {
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
    <div className="qr-acciones no-print">
      <button type="button" className="btn" onClick={copiar}>
        {copiado ? 'Link copiado' : 'Copiar link'}
      </button>
      <button type="button" className="btn-ghost" onClick={() => window.print()}>
        Imprimir
      </button>
      <a className="btn-ghost" href={url} target="_blank" rel="noreferrer">
        Abrir cuestionario
      </a>
      <a className="btn-ghost" href={`/cuestionario/${slug}/matriz`}>
        Ver matriz
      </a>
    </div>
  );
}
