import Shell from '../../Shell';
import Buscador from './Buscador';
import './calidad-formal.css';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';
import { LAMINAS, Z, leerRenglon, plano, type Entrada } from '@/lib/rorschach-tabla-a';

export const metadata = { title: 'Calidad formal del Rorschach — Campos OS' };

/** Las dos áreas donde el libro tiene un error y rige Exner, consultado a la UNLP. */
const DE_EXNER = new Set(['VII·D6', 'VIII·D4']);

const NOMBRE_CALIDAD: Record<string, string> = { '+': 'más', o: 'ordinaria', u: 'única', '-': 'menos' };

/** Los puntajes Z con coma, como se escriben a mano. */
const z = (n: number) => String(n).replace('.', ',');

type Grupo = { areas: string[]; entradas: Entrada[] };

/**
 * Las áreas de una lámina con sus respuestas. Las que el libro titula juntas
 * comparten la misma lista y salen en un solo bloque ("D2 / D6"). Solo la
 * lámina derecha: las giradas son pocas y se buscan en el capturador.
 */
function gruposDe(lamina: string): Grupo[] {
  const grupos = new Map<string[], string[]>();
  for (const [area, renglones] of Object.entries(LAMINAS[lamina].areas)) {
    const g = grupos.get(renglones);
    if (g) g.push(area);
    else grupos.set(renglones, [area]);
  }
  return [...grupos].map(([renglones, areas]) => ({
    areas,
    entradas: renglones.map(leerRenglon).filter((e) => !e.posicion),
  }));
}

/**
 * Las tablas de calidad formal del Rorschach (Lunazzi, 2019), para consultar o
 * imprimir.
 *
 * Salen de la misma Tabla A que usa el capturador: si se corrige una entrada,
 * esta página cambia con ella. Arriba, el índice de las diez láminas y un
 * buscador que filtra todas a la vez; al imprimir, una lámina por hoja.
 */
export default async function CalidadFormal() {
  const [yo, cuentas] = await Promise.all([quienSoy(), cuentasDeLaBarra()]);
  const laminas = Object.keys(LAMINAS);
  const datos = laminas.map((l) => {
    const grupos = gruposDe(l);
    return { lamina: l, grupos, total: grupos.reduce((n, g) => n + g.entradas.length, 0) };
  });
  const total = datos.reduce((n, d) => n + d.total, 0);

  return (
    <Shell titulo="Calidad formal del Rorschach" identidad={yo.nombre} cuentas={cuentas}>
      <div className="os-encabezado os-cf-encabezado">
        <h1>Tablas de calidad formal</h1>
        <p>
          Las {total.toLocaleString('es-AR')} respuestas de las tablas argentinas de Lunazzi (2019,
          UNLP), lámina por lámina y área por área, con la lámina derecha. Son las mismas que usa el
          capturador para proponer el FQ.
        </p>
      </div>

      <div className="os-cf-barra">
        <nav className="os-cf-indice" aria-label="Láminas">
          {datos.map((d) => (
            <a key={d.lamina} href={`#lamina-${d.lamina}`} data-cf-indice={d.lamina}>
              {d.lamina}
            </a>
          ))}
        </nav>
        <Buscador />
      </div>

      <div className="os-cf-leyenda">
        {(['o', 'u', '-'] as const).map((c) => (
          <span key={c}>
            <b className={`os-cf-fq os-cf-fq-${c === '-' ? 'menos' : c}`}>{c === '-' ? '−' : c}</b>
            {NOMBRE_CALIDAD[c]}
          </span>
        ))}
        <span>
          <i className="os-cf-cambio">↑ ↓</i> un nivel respecto de Exner
        </span>
        <span>
          <i className="os-cf-cambio">↑↑ ↓↓</i> dos niveles
        </span>
      </div>

      <div className="os-cf-laminas" id="os-cf-laminas">
        {datos.map((d) => {
          const lam = LAMINAS[d.lamina];
          const valores = Z[d.lamina];
          return (
            <section key={d.lamina} id={`lamina-${d.lamina}`} className="os-panel os-cf-lamina" data-cf-lamina={d.lamina}>
              <header className="os-cf-lamina-top">
                <div>
                  <p className="os-cf-sobre">Lámina</p>
                  <h2>{d.lamina}</h2>
                </div>
                <dl className="os-cf-datos">
                  <div>
                    <dt>Popular</dt>
                    <dd>
                      {lam.popular.areas.join(' o ')} · {lam.popular.respuestas.join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt>Puntaje Z</dt>
                    <dd className="os-cf-z">
                      <span>ZW {z(valores.ZW)}</span>
                      <span>ZA {z(valores.ZA)}</span>
                      <span>ZD {z(valores.ZD)}</span>
                      <span>ZS {z(valores.ZS)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Respuestas</dt>
                    <dd>{d.total.toLocaleString('es-AR')}</dd>
                  </div>
                </dl>
              </header>
              <div className="os-cf-areas">
                {d.grupos.map((g) => {
                  const exner = g.areas.some((a) => DE_EXNER.has(`${d.lamina}·${a}`));
                  return (
                    <div key={g.areas.join('/')} className="os-cf-area" data-cf-area>
                      <h3>
                        <span className="os-cf-area-nombre">{g.areas.join(' / ')}</span>
                        {exner && (
                          <span className="os-cf-exner" title="El libro tiene un error en esta área: rige Exner">
                            Exner
                          </span>
                        )}
                        <span className="os-cf-cuenta">{g.entradas.length}</span>
                      </h3>
                      <ul>
                        {g.entradas.map((e, i) => (
                          <li key={i} data-cf={plano(e.respuesta)}>
                            <b
                              className={`os-cf-fq os-cf-fq-${e.calidad === '-' ? 'menos' : e.calidad === '+' ? 'mas' : e.calidad}`}
                              title={NOMBRE_CALIDAD[e.calidad]}
                            >
                              {e.calidad === '-' ? '−' : e.calidad}
                            </b>
                            <span>{e.respuesta}</span>
                            {e.cambio && (
                              <i className="os-cf-cambio" title="Cambio respecto de Exner">
                                {e.cambio}
                              </i>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
