'use client';

import { useEffect, useState } from 'react';

/**
 * La pantalla de la expositora, en su propio teléfono.
 *
 * Es lo único que se toca durante la charla: abrir la actividad cuando llega el
 * momento y cerrarla cuando termina. El deck no le avisa nada al servidor, así
 * sigue funcionando sin internet.
 *
 * El cierre es la señal de guardar el teléfono, y por eso el botón de cerrar
 * está siempre a la vista mientras hay algo abierto.
 */

type ActividadControl = {
  id: string;
  clave: string;
  charla: number;
  tipo: string;
  titulo: string;
  abierta: boolean;
};

const SONDEO_MS = 4000;

export default function Control({
  slug,
  empresa,
  actividades,
  clave,
  registrados,
}: {
  slug: string;
  empresa: string;
  actividades: ActividadControl[];
  clave: string;
  registrados: number;
}) {
  const [abiertaId, setAbiertaId] = useState<string | null>(
    actividades.find((a) => a.abierta)?.id ?? null
  );
  const [total, setTotal] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El conteo en vivo: es lo que le dice a la expositora si puede seguir o si
  // todavía falta gente. Sale del mismo endpoint que mira el teléfono.
  useEffect(() => {
    let vivo = true;
    async function mirar() {
      try {
        const res = await fetch(`/api/ciclo/${slug}/estado`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!vivo) return;
        setAbiertaId(json.actividad?.id ?? null);
        setTotal(json.total ?? 0);
      } catch {
        // Sin conexión: reintenta solo en el próximo tic.
      }
    }
    mirar();
    const id = setInterval(mirar, SONDEO_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [slug]);

  async function mandar(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(`/api/ciclo/${slug}/control`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...cuerpo, clave }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      if (json.ok) {
        setAbiertaId(cuerpo.accion === 'abrir' ? String(cuerpo.actividadId) : null);
        setTotal(0);
      }
    } catch {
      setError('No se pudo. Fijate la conexión y probá otra vez.');
    } finally {
      setOcupado(false);
    }
  }

  const abierta = actividades.find((a) => a.id === abiertaId) ?? null;
  const porCharla = new Map<number, ActividadControl[]>();
  for (const a of actividades) {
    porCharla.set(a.charla, [...(porCharla.get(a.charla) ?? []), a]);
  }

  return (
    <div className="ct">
      <header className="ct-top">
        <span className="brand">
          Campos HR <span>· control</span>
        </span>
        <span className="ct-empresa">
          {empresa} · {registrados} {registrados === 1 ? 'persona' : 'personas'}
        </span>
      </header>

      <div className={`ct-estado ${abierta ? 'ct-estado-on' : ''}`}>
        {abierta ? (
          <>
            <div className="ct-estado-texto">
              <strong>{abierta.titulo}</strong>
              <span>
                {total} {total === 1 ? 'respuesta' : 'respuestas'} de {registrados}
              </span>
            </div>
            <button
              className="ct-cerrar"
              disabled={ocupado}
              onClick={() => mandar({ accion: 'cerrar' })}
            >
              Cerrar
            </button>
          </>
        ) : (
          <div className="ct-estado-texto">
            <strong>Nada abierto</strong>
            <span>Los teléfonos están guardados.</span>
          </div>
        )}
      </div>

      {error && <p className="cq-error ct-error">{error}</p>}

      <main className="ct-lista">
        {[...porCharla.entries()].map(([charla, items]) => (
          <section key={charla} className="ct-charla">
            <h2>Charla {charla}</h2>
            {items.map((a) => (
              <button
                key={a.id}
                className={`ct-item ${a.id === abiertaId ? 'ct-item-on' : ''}`}
                disabled={ocupado}
                onClick={() =>
                  a.id === abiertaId
                    ? mandar({ accion: 'cerrar' })
                    : mandar({ accion: 'abrir', actividadId: a.id })
                }
              >
                <span className="ct-item-titulo">{a.titulo}</span>
                <span className="ct-item-tipo">{a.tipo}</span>
              </button>
            ))}
          </section>
        ))}

        {actividades.length === 0 && (
          <p className="ct-vacio">
            Todavía no hay actividades cargadas para este ciclo.
          </p>
        )}
      </main>
    </div>
  );
}
