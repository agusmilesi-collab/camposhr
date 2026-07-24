'use client';

import { useState } from 'react';

/** Token crypto-fuerte de 32 caracteres base64url (24 bytes de aleatoriedad). */
function nuevoToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function GenerarToken() {
  const [token, setToken] = useState('');
  const [copiado, setCopiado] = useState(false);

  function generar() {
    setToken(nuevoToken());
    setCopiado(false);
  }

  async function copiar() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = token;
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
    <div className="gen">
      <div className="gen-row">
        <button type="button" className="gen-btn" onClick={generar}>
          Generar token
        </button>
        {token && (
          <>
            <code className="gen-out">{token}</code>
            <button
              type="button"
              className={`copiar${copiado ? ' ok' : ''}`}
              onClick={copiar}
            >
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </>
        )}
      </div>
      {token && (
        <p className="gen-hint">
          Pegalo en el campo <b>Token portal</b> de la empresa en Airtable. El
          portal queda activo en <b>clientes.camposhr.com/{token}</b>.
        </p>
      )}
    </div>
  );
}
