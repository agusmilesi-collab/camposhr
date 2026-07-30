'use client';

import { useState } from 'react';
import type { DimensionArmada, Semana } from '@/lib/playbook';

export type Informe = {
  preferido: { nombre: string; puntaje: number; descripcion: string; nivel: string };
  opuesto: { nombre: string; puntaje: number; descripcion: string; nivel: string };
  /** Si el perfil es marcado o parejo. */
  lectura: string;
  /** Lo que marcó en cada placa, de mayor a menor puntaje. */
  marcadas: { cuadrante: string; puntaje: number; frases: string[] }[];
};

type Solapa = 'informe' | 'playbook' | 'semanas';

/**
 * El informe de una persona, en tres solapas: quién es, cómo conducirla, y qué
 * hacer esta semana. El líder lo abre en el celular, así que cada solapa
 * muestra una cosa por vez.
 */
export default function Playbook({
  informe,
  dimensiones,
  semanas,
  faltantes,
}: {
  informe: Informe;
  dimensiones: DimensionArmada[];
  semanas: Semana[];
  faltantes: number;
}) {
  const [solapa, setSolapa] = useState<Solapa>('informe');
  const [abierta, setAbierta] = useState<string | null>(dimensiones[0]?.id ?? null);
  const [semana, setSemana] = useState(1);
  const [hechas, setHechas] = useState<Record<number, boolean>>({});

  const actual = semanas.find((s) => s.n === semana);

  const solapas: [Solapa, string][] = [
    ['informe', 'Informe'],
    ['playbook', 'Cómo conducirla'],
    ['semanas', 'Acción semanal'],
  ];

  return (
    <div className="pb">
      <nav className="pb-solapas no-print">
        {solapas.map(([id, texto]) => (
          <button
            key={id}
            className={solapa === id ? 'pb-solapa pb-solapa-on' : 'pb-solapa'}
            onClick={() => setSolapa(id)}
          >
            {texto}
          </button>
        ))}
      </nav>

      {/* ------------------------------------------------------- informe */}
      {solapa === 'informe' && (
        <div className="pb-informe">
          <p className="pb-lectura">{informe.lectura}</p>

          <div className="pb-cuadros">
            <article className="pb-cuadro pb-cuadro-fuerte">
              <span className="pb-rotulo">Su cuadrante preferido</span>
              <h3>
                {informe.preferido.nombre} <em>{informe.preferido.puntaje}/20</em>
              </h3>
              <p className="pb-cuadro-desc">{informe.preferido.descripcion}</p>
              <p className="pb-cuadro-nivel">{informe.preferido.nivel}</p>
            </article>

            <article className="pb-cuadro">
              <span className="pb-rotulo">Lo que más le cuesta</span>
              <h3>
                {informe.opuesto.nombre} <em>{informe.opuesto.puntaje}/20</em>
              </h3>
              <p className="pb-cuadro-desc">{informe.opuesto.descripcion}</p>
              <p className="pb-cuadro-nivel">{informe.opuesto.nivel}</p>
              <p className="pb-cuadro-pie">
                Es el opuesto en diagonal de su cuadrante preferido: las tareas de
                este tipo le demandan más esfuerzo, aunque pueda hacerlas.
              </p>
            </article>
          </div>

          <section className="pb-dijo">
            <h3>Lo que marcó de sí</h3>
            <p className="pb-dijo-bajada">
              De las quince frases de cada placa, éstas son las que eligió como
              descriptivas. Es lo que dijo, sin interpretación nuestra.
            </p>
            {informe.marcadas.map((m) => (
              <div className="pb-dijo-grupo" key={m.cuadrante}>
                <h4>
                  {m.cuadrante}
                  <em>{m.puntaje}</em>
                  <span>{m.frases.length} de 15</span>
                </h4>
                {m.frases.length > 0 ? (
                  <ul>
                    {m.frases.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="pb-dijo-vacio">No marcó ninguna.</p>
                )}
              </div>
            ))}
          </section>
        </div>
      )}

      {/* ------------------------------------------------------ playbook */}
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
                  <span className="pb-dim-titulo">{d.titulo}</span>
                  <span className="pb-mas" aria-hidden="true">
                    {abierto ? '−' : '+'}
                  </span>
                </button>

                {abierto && (
                  <div className="pb-dim-cuerpo">
                    <p className="pb-core">{d.core}</p>
                    <p className="pb-porque">{d.porque}</p>

                    {d.propio.length > 0 && (
                      <div className="pb-propio">
                        <span className="pb-rotulo">Por lo que marcó de sí</span>
                        <ul>
                          {d.propio.map((x, i) => (
                            <li key={i}>{x.texto}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(d.verde || d.alerta) && (
                      <dl className="pb-senales">
                        {d.verde && (
                          <div className="pb-senal pb-verde">
                            <dt>Va bien si</dt>
                            <dd>{d.verde}</dd>
                          </div>
                        )}
                        {d.alerta && (
                          <div className="pb-senal pb-alerta">
                            <dt>Prestá atención si</dt>
                            <dd>{d.alerta}</dd>
                          </div>
                        )}
                      </dl>
                    )}

                    {(d.funciona || d.nofunciona) && (
                      <div className="pb-frases">
                        {d.funciona && (
                          <p className="pb-frase pb-si">
                            <span>Funciona</span>
                            {d.funciona}
                          </p>
                        )}
                        {d.nofunciona && (
                          <p className="pb-frase pb-no">
                            <span>No funciona</span>
                            {d.nofunciona}
                          </p>
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

      {/* ------------------------------------------------------- semanas */}
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
                    <p className="pb-porque">{actual.porque}</p>
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
