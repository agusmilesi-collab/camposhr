'use client';

/**
 * Correo y contraseña.
 *
 * No hay registro: las cuentas las abren Lorena y Lucila desde el sistema y
 * mandan el enlace para poner la contraseña. Quien alquila y no tiene acceso,
 * lo pide.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Entrar() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    setEntrando(true);
    const res = await fetch('/api/centro/entrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: d.get('correo'), clave: d.get('clave') }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setEntrando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo entrar.');
    router.push('/centro');
    router.refresh();
  }

  return (
    <div className="centro-entrar">
      <div className="centro-marca" style={{ marginBottom: 18 }}>
        Centro Integral Santiago
        <span>Santiago 1269, Rosario</span>
      </div>

      <form className="centro-panel" onSubmit={entrar}>
        <h2>Entrar</h2>
        {error && <p className="centro-error">{error}</p>}
        <input className="centro-campo" name="correo" type="email" placeholder="Correo" required />
        <input className="centro-campo" name="clave" type="password" placeholder="Contraseña" required />
        <button className="centro-boton centro-ancho" type="submit" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="centro-nota">
          Si todavía no tenés contraseña, pedile el enlace a Lorena o a Lucila.
        </p>
      </form>
    </div>
  );
}
