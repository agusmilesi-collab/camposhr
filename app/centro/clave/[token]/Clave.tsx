'use client';

/**
 * La contraseña y la aceptación de las normas, en un solo paso.
 *
 * Las normas se aceptan acá porque es el único momento en que se sabe que la
 * persona las tuvo delante. Queda registrada la versión y la fecha, que es lo
 * que reemplaza a la firma en papel.
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
      body: JSON.stringify({ token, clave: d.get('clave'), acepta: d.get('acepta') === 'on' }),
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
        <label className="centro-fila" style={{ margin: '8px 0 14px', fontSize: '0.86rem' }}>
          <input type="checkbox" name="acepta" required />
          <span>
            Leí y acepto las normas de convivencia del Centro: se paga toda hora
            reservada, el alquiler se abona del 1 al 10, y solo se usa la sala
            reservada en el horario reservado.
          </span>
        </label>
        <button className="centro-boton centro-ancho" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </div>
  );
}
