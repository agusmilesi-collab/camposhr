import { BANDAS, RANGOS_RAVEN, REFERENCIA_BANDAS, bandaDe } from '@/lib/competencias';
import type { Informe } from '@/lib/informe';
import {
  CONFIDENCIALIDAD,
  CUADRANTES,
  FIRMAS,
  NIVELES,
  NOTA_AJUSTE,
} from '@/lib/informe-textos';
import Cerebro from './Cerebro';
import './informe.css';

/**
 * El velocímetro de una competencia: media luna, cuatro zonas y una aguja.
 *
 * El arco va de 180 a 360 grados, o sea de izquierda a derecha por arriba. Cada
 * zona ocupa el ángulo que le toca por su ancho en la escala, así que mirar
 * dónde cayó la aguja es leer la banda sin leer el número.
 *
 * La habilidad cognitiva no lleva zonas: su número es un percentil del baremo
 * del Raven y no un puntaje de competencia, así que compararlo contra estas
 * bandas sería mezclar dos escalas que solo comparten el ir de 0 a 100.
 */
function Velocimetro({
  puntaje,
  escala,
}: {
  puntaje: number | null;
  escala: 'promedio' | 'percentil';
}) {
  const R = 34;
  const ancho = 82;
  const alto = 48;
  const cx = ancho / 2;
  const cy = 40;

  /** Un punto del arco, para un valor de 0 a 100. */
  const punto = (v: number, r: number) => {
    const a = Math.PI + (Math.min(100, Math.max(0, v)) / 100) * Math.PI;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const tramo = (desde: number, hasta: number) => {
    const [x1, y1] = punto(desde, R);
    const [x2, y2] = punto(hasta, R);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  // El Raven trae su propio baremo: sus cinco rangos son las zonas del arco.
  const zonas = escala === 'percentil' ? RANGOS_RAVEN : ZONAS;

  return (
    <svg
      className="inf-gauge"
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={puntaje === null ? 'sin puntaje' : `${puntaje} de 100`}
    >
      {zonas.map((z) => (
        <path
          key={z.nombre}
          d={tramo(z.desde, z.hasta)}
          data-banda={z.nombre}
          fill="none"
          strokeWidth="7"
          strokeLinecap="butt"
        />
      ))}
      {puntaje !== null &&
        (() => {
          const [x1, y1] = punto(puntaje, R - 10.5);
          const [x2, y2] = punto(puntaje, R + 4.5);
          return (
            <line
              className="inf-gauge-aguja"
              x1={x1.toFixed(2)}
              y1={y1.toFixed(2)}
              x2={x2.toFixed(2)}
              y2={y2.toFixed(2)}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          );
        })()}
    </svg>
  );
}

/** Las cuatro zonas de la escala, con el ancho que le toca a cada una. */
const ZONAS = BANDAS.slice()
  .reverse()
  .map((b, i, todas) => ({
    nombre: b.nombre,
    desde: b.desde,
    hasta: i === todas.length - 1 ? 100 : todas[i + 1].desde,
  }));

function Capitulo({
  numero,
  titulo,
  sub,
  children,
}: {
  numero: string;
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="inf-capitulo">
      <header className="inf-capitulo-top">
        <span className="inf-numero">{numero}</span>
        <div>
          <h2>{titulo}</h2>
          {sub && <p className="inf-sub">{sub}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * El documento en sí, con el informe ya armado.
 *
 * Lo usan las dos pantallas: la pestaña de la ficha, que lo muestra mientras se
 * carga, y la página suelta, que es la que se imprime. Un solo molde, para que
 * lo que se revisa en pantalla sea exactamente lo que sale en el PDF.
 */
export default function Documento({
  inf,
  interno = false,
}: {
  inf: Informe;
  /**
   * Lo que solo mira el equipo: qué falta cargar y de dónde sale cada
   * porcentaje. Va apagado por defecto, así una pantalla nueva que muestre el
   * informe no filtra por olvido: para que el cliente lo vea hay que pedirlo.
   */
  interno?: boolean;
}) {
  const firma = inf.evaluadora ? FIRMAS[inf.evaluadora] : undefined;

  return (
    <article className="inf">
      {interno && inf.faltantes.length > 0 && (
        <aside className="inf-pendientes">
          <strong>Falta cargar para que el informe salga completo:</strong>
          <ul>
            {inf.faltantes.map((f) => (
              <li key={f.que}>
                {f.que}, en {f.donde}.
              </li>
            ))}
          </ul>
          <span className="inf-pendientes-nota">Este aviso no se imprime.</span>
        </aside>
      )}



      {/* ── 01 · Conclusiones ───────────────────────────────────────────── */}
      {/* La marca, arriba de todo y en la primera hoja del impreso. */}
      <header className="inf-marca">
        <div>
          Campos <em>HR</em>
          <span>Consulting Services</span>
        </div>
        <span className="inf-sitio">www.camposhr.com</span>
      </header>

      {/* Quién es y para qué puesto, una sola vez y antes de todo: repetirlo
          debajo del nombre era decir dos veces lo mismo en dos renglones. */}
      <header className="inf-encabezado">
        <h1>{inf.nombre}</h1>
        <div className="inf-datos">
          {inf.puesto && (
            <p>
              <span>Rol aspirado:</span> {inf.puesto}
            </p>
          )}
          {inf.empresa && (
            <p>
              <span>Empresa:</span> {inf.empresa}
            </p>
          )}
          <p>
            <span>Evaluación:</span> {inf.cuando}
          </p>
        </div>
      </header>

      <Capitulo numero="01" titulo="Conclusiones">
        <div className="inf-semaforo">
          {NIVELES.map((nv) => {
            const elegido = inf.nivel?.clave === nv.clave;
            return (
              <article
                key={nv.clave}
                className={`inf-nivel ${nv.color}${elegido ? ' elegido' : ''}`}
                aria-current={elegido ? 'true' : undefined}
              >
                <h3>{nv.titulo}</h3>
                <p>{nv.texto}</p>
              </article>
            );
          })}
        </div>
        <p className="inf-nota">{NOTA_AJUSTE}</p>

        <h3 className="inf-subtitulo">Resumen</h3>
        {inf.resumen.parrafos.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </Capitulo>

      {/* ── 02 · Competencias ───────────────────────────────────────────── */}
      <Capitulo numero="02" titulo="Competencias evaluadas">
        {inf.competencias.length === 0 ? (
          <p className="inf-vacio">
            Sin sumario cargado no se pueden calcular las competencias.
          </p>
        ) : (
          <>
            <div className="inf-competencias">
              {inf.competencias.map((c) => (
                <article key={c.nombre} className="inf-competencia">
                  <div className="inf-competencia-top">
                    <h3>{c.nombre}</h3>
                    {/* Sin el signo de porcentaje: es un puntaje sobre cien y
                        no una proporción de aciertos. Con `%`, un sesenta se
                        lee como nota de examen. */}
                    {/* El percentil no se lee con las bandas de competencia:
                        los dos números van de 0 a 100 y significan cosas
                        distintas. El del Raven dice qué parte de la población
                        queda por debajo, y su referencia es el baremo del test. */}
                    <span className="inf-porcentaje">
                      {c.puntaje === null ? (
                        'sin datos'
                      ) : c.escala === 'percentil' ? (
                        <>
                          <em className="inf-de-cien">percentil</em>
                          {c.puntaje}
                          <em className="inf-banda-texto" data-banda="Percentil">
                            {c.referencia}
                          </em>
                        </>
                      ) : (
                        <>
                          {c.puntaje}
                          <em className="inf-de-cien">/100</em>
                          <em className="inf-banda-texto" data-banda={bandaDe(c.puntaje) ?? ''}>
                            {bandaDe(c.puntaje)}
                          </em>
                        </>
                      )}
                    </span>
                  </div>
                  {/* El velocímetro: media luna con las cuatro zonas y una
                      aguja donde cae la persona. Una barra recta obligaba a
                      medir con la vista dónde caía el número; el arco lo dice
                      con la posición de la aguja, que es como se lee un
                      instrumento. En SVG y no en canvas: es un dibujo de cinco
                      trazos y tiene que sobrevivir a la impresión del PDF. */}
                  <Velocimetro puntaje={c.puntaje} escala={c.escala} />

                  <p className="inf-mide">{c.mide}</p>
                </article>
              ))}
            </div>
            <p className="inf-nota">
              {REFERENCIA_BANDAS}
              <br />
              La habilidad cognitiva va en percentil del baremo del Raven: dice qué parte de la
              población de referencia queda por debajo, y por eso se lee con los rangos del test y
              no con estas bandas.
            </p>
          </>
        )}
      </Capitulo>

      {/* ── 03 · Análisis cualitativo ───────────────────────────────────── */}
      <Capitulo numero="03" titulo="Análisis cualitativo de las competencias">
        {(
          [
            ['Competencias con desarrollo destacado', inf.analisis.destacadas],
            ['Competencias con desarrollo esperado', inf.analisis.esperadas],
            ['Competencias con necesidad de desarrollo', inf.analisis.desarrollar],
          ] as const
        ).map(([titulo, lecturas]) => (
          <div key={titulo} className="inf-bloque">
            <h3 className="inf-subtitulo">{titulo}</h3>
            {lecturas.length === 0 ? (
              <p className="inf-vacio">Sin registros en este grupo.</p>
            ) : (
              <ul className="inf-lista">
                {lecturas.map((l, i) => (
                  <li key={`${l.indice}-${i}`}>{l.dice}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Capitulo>

      {/* ── 04 · Recomendaciones ────────────────────────────────────────── */}
      <Capitulo numero="04" titulo="Recomendaciones para su líder directo">
        {inf.recomendaciones.length === 0 ? (
          <p className="inf-vacio">
            No surgen indicadores fuera de los rangos esperados que requieran una
            gestión particular.
          </p>
        ) : (
          <ol className="inf-recomendaciones">
            {inf.recomendaciones.map((r, i) => (
              <li key={i}>
                <span className="inf-orden">{String(i + 1).padStart(2, '0')}</span>
                <p>{r}</p>
              </li>
            ))}
          </ol>
        )}
      </Capitulo>

      {/* ── 05 · Benziger ───────────────────────────────────────────────── */}
      {inf.benziger && (
        <Capitulo
          numero="05"
          titulo="Estilos de pensamiento predominantes"
          sub="Según BTSA (Benziger Thinking Styles Assessment)"
        >
          <div className="inf-referencia-perfil">
            <span className="inf-ref adulto">Perfil adulto</span>
            <span className="inf-ref joven">Perfil adolescente</span>
          </div>

          <div className="inf-benziger">
            {CUADRANTES.map((q) => (
              <div key={q.clave} className={`inf-cuadrante ${q.clave}`}>
                <span className="inf-cuadrante-rotulo">Cuadrante</span>
                <h3>{q.nombre}</h3>
                <p>{q.resumen}</p>
              </div>
            ))}
            <Cerebro adulto={inf.benziger.adulto} joven={inf.benziger.joven} />
          </div>

          {inf.benziger.preferentes.length > 0 && (
            <p className="inf-rotulo-preferente">
              {inf.benziger.preferentes.length === 1
                ? 'Cuadrante predominante'
                : 'Cuadrantes predominantes'}
            </p>
          )}
          {inf.benziger.preferentes.map((q) => (
            <div key={q.clave} className="inf-bloque">
              <h3 className="inf-subtitulo">{q.nombre}</h3>
              <ul className="inf-lista">
                {q.caracteristicas.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </Capitulo>
      )}

      {/* ── 06 · Técnicas ───────────────────────────────────────────────── */}
      <Capitulo numero="06" titulo="Técnicas de evaluación utilizadas">
        <ul className="inf-lista">
          {inf.tecnicas.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Capitulo>

      {/* ── 07 · Profesional a cargo ────────────────────────────────────── */}
      <Capitulo numero="07" titulo="Profesional a cargo">
        <p className="inf-confidencial">{CONFIDENCIALIDAD}</p>
        <div className="inf-firma">
          <strong>{inf.evaluadora ?? 'Sin evaluadora asignada'}</strong>
          {firma && (
            <>
              <span>
                {firma.titulo} · Mat. {firma.matricula}
              </span>
              <span>{firma.correo}</span>
            </>
          )}
        </div>
      </Capitulo>

      {/* De dónde sale cada puntaje. Está para revisar contra casos reales las
          dos cosas que se decidieron acá y no salen de las hojas de la
          psicóloga: dónde corta cada indicador entre bajo, medio y alto, y
          cuánto pesa dentro de su competencia. */}
      {interno && inf.competencias.some((c) => c.renglones.length > 1) && (
        <details className="inf-desglose">
          <summary>Cómo se calculó cada competencia</summary>
          {inf.competencias.map((c) => (
            <div key={c.nombre}>
              <strong>
                {c.nombre} · {c.puntaje === null ? 'sin puntaje' : `${c.puntaje} de 100`}
              </strong>
              <ul>
                {c.renglones.map((r) => (
                  <li key={r.indicador}>
                    {r.indicador} · {r.mide} ·{' '}
                    {r.valor ?? (r.nivel === null ? 'sin dato' : ['bajo', 'medio', 'alto'][r.nivel - 1])}{' '}
                    ({r.corte})
                    {r.peso !== 1 && <b> · pesa ×{r.peso}</b>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <span className="inf-pendientes-nota">Tampoco se imprime.</span>
        </details>
      )}
    </article>
  );
}
