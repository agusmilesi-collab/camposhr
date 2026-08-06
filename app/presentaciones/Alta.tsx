'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Alta de un encuentro.
 *
 * Se escribe el nombre del cliente y sale todo lo demás: la dirección, el
 * código de entrada y el enlace del control con su clave. El material no se
 * toca, porque las cinco charlas son las mismas para todos.
 */

/** Igual que en el servidor: sirve para mostrar la dirección antes de crearla. */
function slugDe(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function Alta({
  ciclos,
}: {
  ciclos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState('');
  const [cicloId, setCicloId] = useState(ciclos[0]?.id ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ slug: string; clave: string } | null>(null);

  const slug = slugDe(empresa);
  const valido = empresa.trim().length >= 2 && slug.length >= 2 && cicloId;

  async function crear() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/encuentros', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ empresa: empresa.trim(), cicloId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setListo({ slug: json.slug, clave: json.clave });
      setEmpresa('');
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg && msg.length < 90 ? msg : 'No se pudo dar de alta.');
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    const base = 'https://camposhr.com/ciclo/' + listo.slug;
    return (
      <div className="card alta alta-listo">
        <h3>Encuentro creado</h3>
        <p className="alta-nota">
          Guardá el enlace del control: la clave está adentro y no se vuelve a
          mostrar. Si se pierde, se da de alta el encuentro otra vez.
        </p>

        <dl className="alta-datos">
          <dt>Entra el asistente</dt>
          <dd>
            <code>{base.replace(/^https:\/\//, '')}</code>
          </dd>

          <dt>Control de la expositora</dt>
          <dd>
            <code>{`${base}/control?k=${listo.clave}`.replace(/^https:\/\//, '')}</code>
          </dd>

          <dt>Código para proyectar</dt>
          <dd>
            <a href={`/ciclo/${listo.slug}/qr`} target="_blank" rel="noreferrer">
              Verlo
            </a>
          </dd>
        </dl>

        <button className="btn" onClick={() => setListo(null)}>
          Dar de alta otro
        </button>
      </div>
    );
  }

  return (
    <div className="card alta">
      <h3>Nuevo encuentro</h3>
      <p className="alta-nota">
        El material es el mismo para todos los clientes: no hay que preparar
        presentaciones. Con esto queda la dirección, el código y el control.
      </p>

      <div className="alta-campos">
        <label>
          <span>Cliente</span>
          <input
            className="cq-input"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="John Deere"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valido && !enviando) crear();
            }}
          />
        </label>

        <label>
          <span>Ciclo</span>
          <select
            className="cq-select"
            value={cicloId}
            onChange={(e) => setCicloId(e.target.value)}
          >
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {slug && (
        <p className="alta-vista">
          Va a entrar por <code>camposhr.com/ciclo/{slug}</code>
        </p>
      )}
      {error && <p className="cq-error">{error}</p>}

      <button className="btn" disabled={!valido || enviando} onClick={crear}>
        {enviando ? 'Creando…' : 'Crear el encuentro'}
      </button>
    </div>
  );
}
