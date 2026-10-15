'use client';
/**
 * Correo y contraseña.
 *
 * No hay registro: las cuentas las abren Lorena y Lucila desde el sistema. La
 * contraseña la elige cada uno con un enlace de un solo uso que le llega por
 * correo, tanto la primera vez como cuando se la olvida: abajo del botón se
 * pide desde acá mismo. Hasta el 15/10/2026 ese enlace iba por WhatsApp.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Entrar() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  /** La misma tarjeta, con el formulario de pedir el enlace en lugar del de entrar. */
  const [pidiendo, setPidiendo] = useState(false);
  const [correo, setCorreo] = useState('');
  const [mandando, setMandando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

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

  async function pedirEnlace(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    setMandando(true);
    const res = await fetch('/api/centro/recuperar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setMandando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo mandar el enlace.');
    setMensaje(r.mensaje ?? 'Te mandamos el enlace.');
  }

  function cambiar(aPedir: boolean) {
    setError(null);
    setMensaje(null);
    setPidiendo(aPedir);
  }

  return (
    <div className="centro-entrar">
      <div className="centro-marca" style={{ marginBottom: 18 }}>
        Centro Integral Santiago
        <span>Santiago 1269, Rosario</span>
      </div>
      {pidiendo ? (
        <form className="centro-panel" onSubmit={pedirEnlace}>
          <h2>Cambiar la contraseña</h2>
          {error && <p className="centro-error">{error}</p>}
          {mensaje ? (
            <p className="centro-nota" style={{ margin: '0 0 14px' }}>
              {mensaje} Si no te llega, mirá la carpeta de spam o pedíselo a Lorena o a Lucila.
            </p>
          ) : (
            <>
              <p className="centro-nota" style={{ margin: '0 0 12px' }}>
                Escribí tu correo y te mandamos un enlace para elegir una nueva.
              </p>
              <input
                className="centro-campo"
                name="correo"
                type="email"
                placeholder="Correo"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                autoFocus
              />
              <button className="centro-boton centro-ancho" type="submit" disabled={mandando}>
                {mandando ? 'Mandando…' : 'Mandarme el enlace'}
              </button>
            </>
          )}
          <p className="centro-nota">
            <button type="button" className="centro-enlace-texto" onClick={() => cambiar(false)}>
              Volver a entrar
            </button>
          </p>
        </form>
      ) : (
        <form className="centro-panel" onSubmit={entrar}>
          <h2>Entrar</h2>
          {error && <p className="centro-error">{error}</p>}
          <input
            className="centro-campo"
            name="correo"
            type="email"
            placeholder="Correo"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
          <input className="centro-campo" name="clave" type="password" placeholder="Contraseña" required />
          <button className="centro-boton centro-ancho" type="submit" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="centro-nota">
            <button type="button" className="centro-enlace-texto" onClick={() => cambiar(true)}>
              ¿Olvidaste tu contraseña?
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
