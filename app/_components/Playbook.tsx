'use client';

import { useState } from 'react';
import type { DimensionArmada, Semana } from '@/lib/playbook';

/**
 * Las seis dimensiones (plegadas, se abren de a una) y las cinco semanas.
 * El líder abre esto en el celular: una cosa por vez, no un documento.
 */
export default function Playbook({
  dimensiones,
  semanas,
  faltantes,
}: {
  dimensiones: DimensionArmada[];
  semanas: Semana[];
  faltantes: number;
}) {
  const [solapa, setSolapa] = useState<'playbook' | 'semanas'>('playbook');
  const [abierta, setAbierta] = useState<string | null>(dimensiones[0]?.id ?? null);
  const [semana, setSemana] = useState(1);
  const [hechas, setHechas] = useState<Record<number, boolean>>({});

  const actual = semanas.find((s) => s.n === semana);

  return (
    <div className="pb">
      <div className="pb-solapas no-print">
        <button
          className={solapa === 'playbook' ? 'pb-solapa pb-solapa-on' : 'pb-solapa'}
          onClick={() => setSolapa('playbook')}
        >
          Playbook
        </button>
        <button
          className={solapa === 'semanas' ? 'pb-solapa pb-solapa-on' : 'pb-solapa'}
          onClick={() => setSolapa('semanas')}
        >
          Acción semanal
        </button>
      </div>

      {solapa === 'playbook' && (
        <div className="pb-dims">
          {dimensiones.map((d) => {
            const abierto = abierta === d.id;
            return (
              <article className={abierto ? 'pb-dim pb-dim-on' : 'pb-dim'} key={d.id}>
                <button
                  className="pb-dim-top"
                  onClick={() => setAbierta(abierto ? null : d.id)}
                  aria-expanded={abierto}
                >
                  <span>
                    <span className="pb-dim-titulo">{d.titulo}</span>
                    {!abierto && <span className="pb-dim-avance">{d.core}</span>}
                  </span>
                  <span className="pb-mas" aria-hidden="true">{abierto ? '−' : '+'}</span>
                </button>

                {abierto && (
                  <div className="pb-dim-cuerpo">
                    <p className="pb-core">{d.core}</p>

                    <div className="pb-porque">
                      <span className="pb-rotulo">Por qué</span>
                      <p>{d.porque}</p>
                    </div>

                    {d.propio.length > 0 && (
                      <div className="pb-propio">
                        <span className="pb-rotulo">En su caso</span>
                        <ul>
                          {d.propio.map((x, i) => (
                            <li key={i}>{x.texto}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(d.verde || d.alerta) && (
                      <div className="pb-senales">
                        {d.verde && (
                          <div className="pb-senal pb-verde">
                            <span className="pb-rotulo">Señal verde</span>
                            <p>{d.verde}</p>
                          </div>
                        )}
                        {d.alerta && (
                          <div className="pb-senal pb-alerta">
                            <span className="pb-rotulo">Señal de alerta</span>
                            <p>{d.alerta}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {(d.funciona || d.nofunciona) && (
                      <div className="pb-frases">
                        {d.funciona && (
                          <>
                            <span className="pb-rotulo pb-si">Funciona</span>
                            <p className="pb-frase">{d.funciona}</p>
                          </>
                        )}
                        {d.nofunciona && (
                          <>
                            <span className="pb-rotulo pb-no">No funciona</span>
                            <p className="pb-frase">{d.nofunciona}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {faltantes > 0 && (
            <p className="pb-pendiente">
              Faltan {faltantes} {faltantes === 1 ? 'dimensión' : 'dimensiones'} de
              contenido para este perfil.
            </p>
          )}
        </div>
      )}

      {solapa === 'semanas' && (
        <div className="pb-semanas">
          {semanas.length === 0 ? (
            <p className="pb-pendiente">
              Todavía no hay acciones semanales cargadas para este perfil.
            </p>
          ) : (
            <>
              <p className="pb-bajada">Una acción concreta por semana. Una sola.</p>

              <div className="pb-numeros">
                {semanas.map((s) => (
                  <button
                    key={s.n}
                    className={
                      semana === s.n
                        ? 'pb-numero pb-numero-on'
                        : hechas[s.n]
                        ? 'pb-numero pb-numero-hecha'
                        : 'pb-numero'
                    }
                    onClick={() => setSemana(s.n)}
                  >
                    {hechas[s.n] ? '✓' : s.n}
                  </button>
                ))}
              </div>

              {actual && (
                <article className="pb-semana">
                  <header>
                    <div>
                      <span className="pb-rotulo">Semana {actual.n}</span>
                      <h3>{actual.titulo}</h3>
                    </div>
                    <button
                      className={hechas[actual.n] ? 'pb-tilde pb-tilde-on' : 'pb-tilde'}
                      onClick={() =>
                        setHechas((p) => ({ ...p, [actual.n]: !p[actual.n] }))
                      }
                      aria-label="Marcar como hecha"
                    >
                      ✓
                    </button>
                  </header>
                  <div className="pb-semana-cuerpo">
                    <p className="pb-accion">{actual.accion}</p>
                    <div className="pb-porque">
                      <span className="pb-rotulo">Por qué esta semana</span>
                      <p>{actual.porque}</p>
                    </div>
                  </div>
                </article>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
