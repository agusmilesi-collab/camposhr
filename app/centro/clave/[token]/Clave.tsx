'use client';

/**
 * La contraseña, y nada más. Las normas se leen y se aceptan adentro, desde
 * la tarjeta de Inicio: hasta el 15/10/2026 se aceptaban acá, antes de poder
 * leerlas completas.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Clave({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    if (String(d.get('clave')) !== String(d.get('otra'))) {
      return setError('Las dos contraseñas tienen que ser iguales.');
    }
    setGuardando(true);
    const res = await fetch('/api/centro/clave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, clave: d.get('clave') }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    router.push('/centro');
    router.refresh();
  }

  return (
    <div className="centro-entrar">
      <div className="centro-marca" style={{ marginBottom: 18 }}>
        Centro Integral Santiago
        <span>Santiago 1269, Rosario</span>
      </div>

      <form className="centro-panel" onSubmit={guardar}>
        <h2>Elegí tu contraseña</h2>
        {error && <p className="centro-error">{error}</p>}
        <input
          className="centro-campo"
          name="clave"
          type="password"
          placeholder="Contraseña, mínimo 8 caracteres"
          minLength={8}
          required
        />
        <input
          className="centro-campo"
          name="otra"
          type="password"
          placeholder="Repetila"
          minLength={8}
          required
        />
        <button className="centro-boton centro-ancho" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </div>
  );
}
