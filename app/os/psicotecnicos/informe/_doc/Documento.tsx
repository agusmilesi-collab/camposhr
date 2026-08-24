import { BANDAS, bandaDe } from '@/lib/competencias';
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
 * El color de un puntaje.
 *
 * Cinco tramos y no cuatro: las bandas son cuatro, pero Bajo va de 0 a 34 y no
 * es lo mismo estar rozando lo adecuado que estar abajo de todo, así que ese
 * tramo se parte en naranja y rojo. Los otros tres van uno por banda.
 *
 * De arriba abajo: verde, verde claro, azul, naranja, rojo.
 *
 * **Los valores están escritos y no salen de las variables de la hoja**: para
 * aclarar un color contra el fondo hay que tener sus números, y `color-mix` no
 * los devuelve. Si cambia la paleta de `informe.css` hay que cambiarlos acá.
 */
const ESCALA_COLOR: { desde: number; rgb: [number, number, number] }[] = [
  { desde: 80, rgb: [55, 128, 74] }, // --verde, Sobresaliente
  { desde: 65, rgb: [104, 158, 106] }, // verde claro, Alto
  { desde: 35, rgb: [67, 100, 143] }, // --azul, Adecuado
  { desde: 18, rgb: [193, 89, 26] }, // --naranja, la mitad de arriba de Bajo
  { desde: 0, rgb: [140, 59, 59] }, // --rojo, el piso
];

/** El color del puntaje, aclarado contra la hoja: 1 es pleno, 0 es blanco. */
function tono(puntaje: number | null, fuerza: number): string {
  const base = ESCALA_COLOR.find((t) => (puntaje ?? 0) >= t.desde) ?? ESCALA_COLOR[4];
  const c = base.rgb.map((n) => Math.round(n + (255 - n) * (1 - fuerza)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * La escala de las nueve competencias, dibujada.
 *
 * Era una línea de texto con los cuatro nombres y sus números. Dibujada dice
 * dos cosas más que ahí no estaban: de qué color es cada banda, que es lo que
 * después se ve en cada velocímetro, y cuánto ocupa cada una, porque el ancho
 * de cada tramo es el ancho real de la banda. Adecuado es el más ancho: agarra
 * treinta de los cien puntos.
 *
 * La barra tiene los cinco colores de `ESCALA_COLOR` y los rótulos las cuatro
 * bandas, porque Bajo se dibuja partido en naranja y rojo pero se informa como
 * una sola banda.
 */
function EscalaBandas() {
  const tramos = ESCALA_COLOR.slice()
    .reverse()
    .map((t, i, todos) => {
      const hasta = i === todos.length - 1 ? 100 : todos[i + 1].desde;
      return `${tono(t.desde, 1)} ${t.desde}% ${hasta}%`;
    });

  const bandas = BANDAS.slice()
    .reverse()
    .map((b, i, todas) => ({
      nombre: b.nombre,
      desde: b.desde,
      hasta: i === todas.length - 1 ? 100 : todas[i + 1].desde - 1,
    }));

  return (
    <div className="inf-escala-bandas">
      <span
        className="inf-escala-barra"
        style={{ backgroundImage: `linear-gradient(90deg, ${tramos.join(', ')})` }}
      />
      <div
        className="inf-escala-rotulos"
        style={{
          gridTemplateColumns: bandas.map((b) => `${b.hasta + 1 - b.desde}fr`).join(' '),
        }}
      >
        {bandas.map((b) => (
          <span key={b.nombre}>
            <em style={{ color: tono(b.desde === 0 ? 20 : b.desde, 1) }}>{b.nombre}</em>
            {b.desde === 0 ? 'menos de 35' : `${b.desde} a ${b.hasta}`}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * El velocímetro de una competencia: un anillo con el puntaje adentro.
 *
 * Tres cosas a la vez, sin que ninguna tape a la otra. El anillo de fondo, gris,
 * es la escala entera. El arco encima llega hasta el puntaje y va del color que
 * le toca a ese puntaje: aclarado donde arranca y pleno donde termina, así el
 * final del arco es lo que más pesa. Y el número va en el centro, que es donde
 * lo busca el ojo.
 *
 * **Un solo color por velocímetro.** Antes el arco recorría las cuatro bandas y
 * empezaba siempre en rojo, así que una competencia sobresaliente mostraba un
 * cuarto de anillo en rojo antes de llegar al verde.
 *
 * Dónde empieza cada banda se marca por fuera del anillo, con una raya corta:
 * adentro tapaba el arco justo en el tramo que la persona alcanzó.
 *
 * Abre 270 grados y no 360: el hueco de abajo es el que convierte un anillo en
 * un instrumento con principio y fin, y deja lugar para la banda.
 *
 * El degradado va en segmentos y no en un `linearGradient`: un gradiente lineal
 * cruza el dibujo en línea recta y el anillo es un arco, así que los colores
 * caerían donde no va ninguno. Cada segmento es un tramo de dos puntos con el
 * color de su lugar, y con el solape no se ven las juntas.
 *
 * En SVG y no en canvas: es un dibujo de pocos trazos y tiene que sobrevivir a
 * la impresión del PDF.
 */
function Velocimetro({ puntaje }: { puntaje: number | null }) {
  const CAJA = 116;
  const R = 44;
  const c = CAJA / 2;
  /** Arranca abajo a la izquierda y cierra abajo a la derecha: 270 grados. */
  const INICIO = 135;
  const BARRIDO = 270;
  const PASO = 2;

  const punto = (v: number, r: number) => {
    const a = ((INICIO + (Math.min(100, Math.max(0, v)) / 100) * BARRIDO) * Math.PI) / 180;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };

  const arco = (desde: number, hasta: number, r = R) => {
    const [x1, y1] = punto(desde, r);
    const [x2, y2] = punto(hasta, r);
    const largo = ((hasta - desde) / 100) * BARRIDO > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largo} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  /** El arco del puntaje, en tramos que van aclarados a plenos. */
  const lleno = (hasta: number) => {
    const tramos = [];
    for (let v = 0; v < hasta; v += PASO) {
      const fin = Math.min(hasta, v + PASO);
      tramos.push(
        <path
          key={v}
          d={arco(v, fin + (fin < hasta ? 0.6 : 0))}
          stroke={tono(puntaje, 0.42 + 0.58 * (((v + fin) / 2 / hasta) ** 0.7))}
          fill="none"
          strokeWidth="9"
          strokeLinecap={v === 0 || fin === hasta ? 'round' : 'butt'}
        />
      );
    }
    return tramos;
  };

  return (
    <div className="inf-gauge-caja">
      <svg className="inf-gauge" viewBox={`0 0 ${CAJA} ${CAJA}`} aria-hidden="true">
        {/* La escala entera. */}
        <path d={arco(0, 100)} className="inf-gauge-fondo" fill="none" strokeWidth="9" />
        {/* Dónde empieza cada banda, por fuera del anillo. */}
        {BANDAS.filter((b) => b.desde > 0).map((b) => {
          const [x1, y1] = punto(b.desde, R + 6.5);
          const [x2, y2] = punto(b.desde, R + 10);
          return (
            <line
              key={b.nombre}
              x1={x1.toFixed(2)}
              y1={y1.toFixed(2)}
              x2={x2.toFixed(2)}
              y2={y2.toFixed(2)}
              className="inf-gauge-corte"
            />
          );
        })}
        {puntaje !== null && puntaje > 0 && lleno(puntaje)}
      </svg>
      <div className="inf-gauge-centro">
        {puntaje === null ? (
          <span className="inf-gauge-vacio">sin datos</span>
        ) : (
          <>
            <span className="inf-gauge-numero" style={{ color: tono(puntaje, 1) }}>
              {puntaje}
            </span>
            <span className="inf-gauge-escala">de 100</span>
          </>
        )}
      </div>
    </div>
  );
}

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
  /**
   * Lo que hay que aclarar de una competencia sola, para el pie del tablero.
   * Lleva el nombre adelante: abajo de las nueve, un dato suelto no dice de
   * cuál habla.
   */
  const detalles = inf.competencias
    .filter((c) => c.detalle)
    .map((c) => `${c.nombre}: ${c.detalle![0].toLowerCase()}${c.detalle!.slice(1)}`);

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
            {/* Tablero: una tarjeta por competencia, el anillo primero y el
                texto después. El número es lo que el cliente busca, así que va
                donde cae el ojo y no al final de un renglón. Las nueve miden lo
                mismo: lo que solo vale para una va al pie. */}
            <div className="inf-competencias">
              {inf.competencias.map((c) => {
                const banda = bandaDe(c.puntaje);
                return (
                  <article key={c.nombre} className="inf-competencia">
                    <Velocimetro puntaje={c.puntaje} />
                    <h3>{c.nombre}</h3>
                    {c.puntaje !== null && (
                      <span className="inf-banda-texto" style={{ color: tono(c.puntaje, 1) }}>
                        {banda}
                      </span>
                    )}
                    <p className="inf-mide">{c.mide}</p>
                  </article>
                );
              })}
            </div>
            <EscalaBandas />
            <p className="inf-nota">
              La habilidad cognitiva sale del baremo del Raven y no de una cuenta de aciertos: el
              baremo dice qué parte de la población queda por debajo, y ese lugar se lleva a esta
              misma escala tramo por tramo.
              {detalles.map((d) => (
                <span key={d}>
                  <br />
                  {d}
                </span>
              ))}
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
            {CUADRANTES.map((q) => {
              const manda = inf.benziger!.preferentes.some((p) => p.clave === q.clave);
              return (
                <div
                  key={q.clave}
                  className={manda ? `inf-cuadrante ${q.clave} manda` : `inf-cuadrante ${q.clave}`}
                >
                  <span className="inf-cuadrante-rotulo">
                    {manda ? 'Predominante' : 'Cuadrante'}
                  </span>
                  <h3>{q.nombre}</h3>
                  <p>{q.resumen}</p>
                </div>
              );
            })}
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
