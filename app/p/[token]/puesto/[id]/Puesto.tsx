'use client';

/**
 * El formulario del perfil del puesto que completa el cliente.
 *
 * Las mismas nueve escalas del formulario de pedido, y el alcance del puesto
 * (plazo y cinco preguntas) solo cuando la batería lleva análisis de
 * potencial. Se escribe en el idioma del cliente: sin estratos ni nombres del
 * modelo, con lo que significa cada opción y un ejemplo en cada pregunta.
 */

import { useState } from 'react';
import type { Pregunta } from '@/lib/pedido-campos';
import { AVISO_HORIZONTE, PREGUNTAS, UNIDADES, desdeDias, type Unidad } from '@/lib/potencial';

export default function Puesto({
  token,
  pedidoId,
  empresa,
  puesto,
  delPuesto,
  delJefe,
  perfilInicial,
  conPotencial,
  diasInicial,
  complejidadInicial,
}: {
  token: string;
  pedidoId: string;
  empresa: string;
  puesto: string;
  delPuesto: Pregunta[];
  delJefe: Pregunta[];
  perfilInicial: Record<string, string>;
  conPotencial: boolean;
  diasInicial: number | null;
  complejidadInicial: Record<string, boolean>;
}) {
  const [perfil, setPerfil] = useState<Record<string, string>>(perfilInicial);
  const inicial = diasInicial ? desdeDias(diasInicial) : null;
  const [cantidad, setCantidad] = useState(inicial ? String(inicial.cantidad) : '');
  const [unidad, setUnidad] = useState<Unidad>(inicial?.unidad ?? 'meses');
  const [complejidad, setComplejidad] = useState<Record<string, boolean>>(complejidadInicial);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  /* Dos pestañas cuando la batería lleva potencial: el perfil y el alcance.
     Lo contestado en una se conserva al pasar a la otra, y se guarda todo
     junto. */
  const [vista, setVista] = useState<'perfil' | 'alcance'>('perfil');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/puesto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          pedidoId,
          perfil,
          ...(conPotencial ? { spanCantidad: cantidad, spanUnidad: unidad, complejidad } : {}),
        }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(r.error ?? 'No se pudo guardar. Probá de nuevo en un rato.');
        return;
      }
      setListo(true);
    } catch {
      setError('No se pudo guardar. Probá de nuevo en un rato.');
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <main className="pedir">
        <div className="pedir-listo">
          <h1>Gracias</h1>
          <p>Guardamos cómo es el puesto de {puesto}.</p>
          <p className="pedir-listo-n">
            Con esto la recomendación de cada candidato dice cómo le va a ir en este puesto y con
            este jefe. Si algo cambia, podés volver a este mismo enlace y corregirlo.
          </p>
          <div className="pedir-acciones">
            <a className="btn-primario" href={`/p/${token}`}>
              Ir al portal
            </a>
            <button type="button" className="btn-sec" onClick={() => setListo(false)}>
              Revisar las respuestas
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pedir">
      <header className="pedir-top">
        <a className="pedir-volver" href={`/p/${token}`}>
          ← {empresa}
        </a>
        <h1>Cómo es el puesto de {puesto}</h1>
      </header>

      {conPotencial && (
        <nav className="pedir-tabs" aria-label="Partes del formulario">
          {(
            [
              { clave: 'perfil', texto: 'Perfil del puesto' },
              { clave: 'alcance', texto: 'Alcance del puesto' },
            ] as const
          ).map((t) => (
            <button
              type="button"
              key={t.clave}
              className={`pedir-tab${vista === t.clave ? ' activa' : ''}`}
              aria-current={vista === t.clave ? 'page' : undefined}
              onClick={() => setVista(t.clave)}
            >
              {t.texto}
            </button>
          ))}
        </nav>
      )}

      <form className="pedir-cuerpo pedir-cuerpo-solo" onSubmit={enviar}>
        <div className="pedir-campos">
          {vista === 'perfil' && (
            <section className="pedir-bloque">
              <div className="pedir-perfil">
                {[
                  { titulo: 'Del puesto', preguntas: delPuesto },
                  { titulo: 'De quien lo conduce', preguntas: delJefe },
                ].map((grupo) => (
                  <div key={grupo.titulo}>
                    <h3>{grupo.titulo}</h3>
                    {grupo.preguntas.map((p) => (
                      <div className="pedir-pregunta" key={p.campo}>
                        <span className="pedir-pregunta-t">{p.rotulo}</span>
                        <div className="pedir-opciones" role="group" aria-label={p.rotulo}>
                          {p.opciones.map((o, i) => (
                            <button
                              type="button"
                              key={o}
                              aria-pressed={perfil[p.campo] === o}
                              className={`pedir-opcion${perfil[p.campo] === o ? ' pedir-elegida' : ''}`}
                              onClick={() =>
                                setPerfil((v) => ({ ...v, [p.campo]: v[p.campo] === o ? '' : o }))
                              }
                            >
                              <span className="pedir-opcion-n">{o}</span>
                              {p.ayudas[i] && <span className="pedir-opcion-q">{p.ayudas[i]}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* El alcance, solo si la batería lleva análisis de potencial: el
              informe compara lo que la persona puede contra lo que el puesto
              exige, y esa segunda mitad la sabe el cliente. */}
          {conPotencial && vista === 'alcance' && (
            <section className="pedir-bloque">
              <h2>El alcance del puesto</h2>
              <p className="pedir-ayuda">
                La evaluación incluye el análisis de potencial, que dice hasta qué complejidad de
                trabajo puede llegar la persona. Para decir si eso alcanza, necesitamos saber qué
                exige el puesto.
              </p>

              <div className="pedir-pregunta">
                <span className="pedir-pregunta-t">
                  ¿Cuál es la tarea de mayor alcance temporal de la que responde este puesto, y
                  cuándo se sabe si su resultado salió bien?
                </span>
                <p className="pedir-nota">{AVISO_HORIZONTE}</p>
                <p className="pedir-nota">
                  Si no sos el jefe directo del puesto, confirmá con él qué tarea le asigna y para
                  cuándo espera el resultado.
                </p>
                <div className="pedir-span">
                  <input
                    className="pedir-input pedir-span-num"
                    inputMode="decimal"
                    value={cantidad}
                    placeholder="0"
                    onChange={(e) =>
                      setCantidad(e.target.value.replace(/[^\d,.]/g, '').slice(0, 5))
                    }
                  />
                  <select
                    className="pedir-input pedir-span-unidad"
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value as Unidad)}
                  >
                    {UNIDADES.map((u) => (
                      <option key={u.clave} value={u.clave}>
                        {u.texto}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pedir-pregunta">
                <span className="pedir-pregunta-t">
                  ¿Qué exige el trabajo que va a hacer quien ocupe el puesto?
                </span>
                {PREGUNTAS.map((p) => (
                  <div className="pedir-si-no" key={p.estrato}>
                    <span className="pedir-si-no-t">
                      <strong>{p.corto}</strong>
                      <small>{p.simple}</small>
                      <small className="pedir-ejemplo">Por ejemplo: {p.ejemplo}</small>
                    </span>
                    <div className="pedir-opciones" role="group" aria-label={p.corto}>
                      {[
                        { v: true, t: 'Sí' },
                        { v: false, t: 'No' },
                      ].map((o) => (
                        <button
                          type="button"
                          key={o.t}
                          aria-pressed={complejidad[String(p.estrato)] === o.v}
                          className={`pedir-opcion${
                            complejidad[String(p.estrato)] === o.v ? ' pedir-elegida' : ''
                          }`}
                          onClick={() =>
                            setComplejidad((c) => {
                              const nueva = { ...c };
                              if (nueva[String(p.estrato)] === o.v) delete nueva[String(p.estrato)];
                              else nueva[String(p.estrato)] = o.v;
                              return nueva;
                            })
                          }
                        >
                          {o.t}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {error && <p className="pedir-error">{error}</p>}
          <div className="pedir-acciones">
            {/* Desde el perfil, el paso siguiente es el alcance: se guarda al
                final, con las dos partes contestadas. */}
            {conPotencial && vista === 'perfil' ? (
              <button className="btn-primario" type="button" onClick={() => setVista('alcance')}>
                Seguir con el alcance
              </button>
            ) : (
              <button className="btn-primario" type="submit" disabled={enviando}>
                {enviando ? 'Guardando…' : 'Guardar'}
              </button>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
