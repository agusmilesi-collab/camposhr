import type { Cruce, DataHub, Distribucion, Reparto } from '@/lib/data-hub';
import { Barras, Eje, Panel } from './piezas';

/**
 * La pestaña de candidatos: cómo es la gente que se evalúa y cómo se cruza con
 * el puesto al que se presenta.
 *
 * **Todo lo de acá describe, nada predice.** Los cruces dicen qué perfil llega a
 * cada familia de puesto y a cada nivel, y cómo cierra su informe. Qué perfil
 * rinde mejor una vez adentro no se puede decir sin el seguimiento, y por eso
 * la pestaña termina con cuánto falta cargar para poder.
 *
 * Los gráficos son SVG y HTML armados acá, sin librería: la página se arma en
 * el servidor y el detalle de cada marca sale al pasar el cursor.
 */

type Tono = 'alto' | 'medio' | 'alerta' | 'bajo' | 'a' | 'b' | 'c' | 'd' | 'neutro';

export const TONO_CONCLUSION: Record<string, Tono> = {
  'Ajuste alto': 'alto',
  'Ajuste con aspectos a desarrollar': 'medio',
  'Ajuste con alertas': 'alerta',
  'Ajuste bajo': 'bajo',
};

const TONO_CUADRANTE: Record<string, Tono> = {
  FI: 'a',
  FD: 'b',
  BI: 'c',
  BD: 'd',
  'Más de uno': 'neutro',
};

const TONO_ESTILO: Record<string, Tono> = {
  Introversivo: 'a',
  Ambigual: 'neutro',
  Extratensivo: 'b',
};

const CUADRANTE_LARGO: Record<string, string> = {
  FI: 'Frontal izquierdo',
  FD: 'Frontal derecho',
  BI: 'Basal izquierdo',
  BD: 'Basal derecho',
};

const CONCLUSION_CORTA: Record<string, string> = {
  'Ajuste alto': 'Alto',
  'Ajuste con aspectos a desarrollar': 'A desarrollar',
  'Ajuste con alertas': 'Con alertas',
  'Ajuste bajo': 'Bajo',
};

/**
 * Los nombres de columna con el guion blando puesto: el encabezado mide lo que
 * mide un número, y sin un lugar donde cortar las palabras se pisan entre sí.
 */
const CON_CORTE: Record<string, string> = {
  Autogestión: 'Auto\u00adgestión',
  'Control emocional': 'Control emo\u00adcional',
  'Habilidad interpersonal': 'Inter\u00adpersonal',
  Proactividad: 'Pro\u00adactividad',
  'Capacidad intelectual': 'Inte\u00adlectual',
  Liderazgo: 'Lide\u00adrazgo',
  Introversivo: 'Intro\u00adversivo',
  Extratensivo: 'Extra\u00adtensivo',
};

const porciento = (n: number, de: number) => (de === 0 ? 0 : Math.round((n / de) * 100));

/**
 * Un punto por persona, en semicírculo, pintado según su categoría.
 *
 * Sirve cuando el total es chico y cada caso importa: ochenta puntos se cuentan
 * con la vista, y una barra del nueve por ciento no deja ver que son ocho
 * personas.
 */
/** Cuántas filas de puntos hacen falta para que entren sin amontonarse. */
export function filasPara(total: number): number {
  return total <= 24 ? 2 : total <= 45 ? 3 : total <= 70 ? 4 : 5;
}

export function Hemiciclo({
  datos,
  tonos,
  unidad,
  largos,
  filas: filasPedidas,
}: {
  datos: Reparto;
  tonos: Record<string, Tono>;
  unidad: string;
  largos?: Record<string, string>;
  /**
   * Cuántas filas de puntos lleva, cuando hay que igualarlo con otro.
   *
   * Dos hemiciclos lado a lado con distinta cantidad de filas salen con puntos
   * de distinto tamaño, porque cada dibujo se estira hasta el mismo ancho.
   */
  filas?: number;
}) {
  const total = datos.reduce((a, d) => a + d.n, 0);
  if (total === 0) return <p className="os-vacio">Todavía no hay casos.</p>;

  const filas = filasPedidas ?? filasPara(total);
  const PRIMERO = 58;
  const PASO = 17;
  const RADIO = 6;
  const radios = Array.from({ length: filas }, (_, k) => PRIMERO + k * PASO);
  const suma = radios.reduce((a, r) => a + r, 0);
  // Cada fila lleva asientos en proporción a su largo, y la de afuera absorbe
  // lo que sobra o falta por el redondeo.
  const porFila = radios.map((r) => Math.round((total * r) / suma));
  porFila[filas - 1] += total - porFila.reduce((a, n) => a + n, 0);

  const asientos: { x: number; y: number; angulo: number; r: number }[] = [];
  radios.forEach((r, k) => {
    const m = porFila[k];
    for (let j = 0; j < m; j++) {
      const angulo = m === 1 ? Math.PI / 2 : Math.PI - (j * Math.PI) / (m - 1);
      asientos.push({ x: r * Math.cos(angulo), y: -r * Math.sin(angulo), angulo, r });
    }
  });
  // De izquierda a derecha, para que cada categoría ocupe una cuña entera.
  asientos.sort((a, b) => b.angulo - a.angulo || a.r - b.r);
  const dueños = datos.flatMap((d) => Array.from({ length: d.n }, () => d.nombre));

  const borde = radios[filas - 1] + RADIO + 2;

  return (
    <div className="os-hub-hemiciclo">
      <svg
        viewBox={`${-borde} ${-borde} ${borde * 2} ${borde + RADIO + 2}`}
        role="img"
        aria-label={datos.map((d) => `${d.nombre}: ${d.n}`).join(', ')}
      >
        {asientos.map((a, i) => (
          <circle
            key={i}
            cx={a.x.toFixed(1)}
            cy={a.y.toFixed(1)}
            r={RADIO}
            className={`os-hub-tono-${tonos[dueños[i]] ?? 'neutro'}`}
          >
            <title>{largos?.[dueños[i]] ?? dueños[i]}</title>
          </circle>
        ))}
        <text x="0" y="-16" textAnchor="middle" className="os-hub-hemiciclo-total">
          {total}
        </text>
        <text x="0" y="-2" textAnchor="middle" className="os-hub-hemiciclo-unidad">
          {unidad}
        </text>
      </svg>
      <ul className="os-hub-leyenda">
        {datos.map((d) => (
          <li key={d.nombre}>
            <span className={`os-hub-muestra os-hub-tono-${tonos[d.nombre] ?? 'neutro'}`} />
            <span className="os-hub-leyenda-nombre">
              {largos?.[d.nombre] ? `${d.nombre} · ${largos[d.nombre]}` : d.nombre}
            </span>
            <span className="os-hub-barra-n">{d.n}</span>
            <span className="os-hub-leyenda-parte">{porciento(d.n, total)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cómo se reparte un puntaje entre los evaluados: la curva, la mediana y la
 * franja donde cae la mitad central.
 *
 * La curva es una densidad suavizada sobre los puntajes reales, que van
 * marcados uno por uno debajo del eje. Los puntajes de competencias salen de
 * promediar indicadores en tres niveles, así que se repiten mucho: las marcas
 * de abajo muestran dónde están de verdad.
 */
function Curva({ d, unidad }: { d: Distribucion; unidad?: string }) {
  const ANCHO = 240;
  const ALTO = 62;
  const SUAVIZADO = 8;
  const xs = Array.from({ length: 51 }, (_, i) => i * 2);
  const densidad = xs.map((x) =>
    d.valores.reduce((a, v) => a + Math.exp(-0.5 * ((x - v) / SUAVIZADO) ** 2), 0),
  );
  const tope = Math.max(...densidad, 1e-9);
  const px = (x: number) => (x / 100) * ANCHO;
  const py = (v: number) => ALTO - (v / tope) * (ALTO - 6);
  const linea = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'}${px(x).toFixed(1)},${py(densidad[i]).toFixed(1)}`)
    .join(' ');

  return (
    <figure className="os-hub-curva">
      <figcaption>
        <span className="os-hub-curva-nombre">{d.nombre}</span>
        <span className="os-hub-curva-mediana">
          {d.mediana === null ? '·' : Math.round(d.mediana)}
          {unidad && <em> {unidad}</em>}
        </span>
      </figcaption>
      <svg
        viewBox={`-6 -4 ${ANCHO + 12} ${ALTO + 28}`}
        role="img"
        aria-label={`${d.nombre}: mediana ${d.mediana}, la mitad central entre ${d.p25} y ${d.p75}, sobre ${d.n} casos`}
      >
        <path d={`${linea} L${ANCHO},${ALTO} L0,${ALTO} Z`} className="os-hub-curva-area" />
        <path d={linea} className="os-hub-curva-linea" />
        <line x1="0" x2={ANCHO} y1={ALTO} y2={ALTO} className="os-hub-curva-eje" />
        {d.p25 !== null && d.p75 !== null && (
          <rect
            x={px(d.p25)}
            y={ALTO - 1.5}
            width={Math.max(2, px(d.p75) - px(d.p25))}
            height="3"
            rx="1.5"
            className="os-hub-curva-mitad"
          >
            <title>{`La mitad central puntúa entre ${d.p25} y ${d.p75}`}</title>
          </rect>
        )}
        {d.valores.map((v, i) => (
          <line
            key={i}
            x1={px(v)}
            x2={px(v)}
            y1={ALTO + 4}
            y2={ALTO + 9}
            className="os-hub-curva-marca"
          />
        ))}
        {d.mediana !== null && (
          <line
            x1={px(d.mediana)}
            x2={px(d.mediana)}
            y1="0"
            y2={ALTO}
            className="os-hub-curva-centro"
          />
        )}
        {[0, 50, 100].map((t) => (
          <text
            key={t}
            x={px(t)}
            y={ALTO + 21}
            textAnchor={t === 0 ? 'start' : t === 100 ? 'end' : 'middle'}
            className="os-hub-curva-rotulo"
          >
            {t}
          </text>
        ))}
      </svg>
      <span className="os-hub-n">
        mediana sobre {d.n} · la mitad central entre {d.p25} y {d.p75}
      </span>
    </figure>
  );
}

/**
 * Un cruce como tabla sombreada: cuanto más alto el valor, más oscura la celda.
 *
 * En modo `mediana` la celda es un puntaje de 0 a 100. En modo `cuenta` es
 * cuánta gente del grupo cae en esa categoría, y el sombreado sigue la parte
 * que representa dentro de su fila.
 */
function Mapa({
  cruce,
  modo,
  grupo,
  cortas,
}: {
  cruce: Cruce;
  modo: 'mediana' | 'cuenta';
  grupo: string;
  cortas?: Record<string, string>;
}) {
  if (cruce.filas.length === 0) {
    return <p className="os-vacio">Ningún grupo llega a cinco casos todavía.</p>;
  }
  return (
    <>
      <div className="os-hub-mapa-caja">
        <table className="os-hub-mapa">
          <thead>
            <tr>
              <th scope="col">{grupo}</th>
              <th scope="col" className="os-hub-mapa-n">
                n
              </th>
              {cruce.columnas.map((c) => (
                <th key={c} scope="col" title={c}>
                  {cortas?.[c] ?? c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cruce.filas.map((f) => (
              <tr key={f.nombre}>
                <th scope="row" title={f.nombre}>
                  {f.nombre}
                </th>
                <td className="os-hub-mapa-n">{f.n}</td>
                {f.celdas.map((c, i) => {
                  const columna = cruce.columnas[i];
                  if (modo === 'mediana') {
                    // Con menos de tres casos en la celda, el número sería de
                    // una o dos personas.
                    if (c.valor === null || c.n < 3) {
                      return (
                        <td
                          key={columna}
                          className="os-hub-mapa-vacia"
                          title={`${columna}: ${c.n} casos, no alcanza`}
                        >
                          ·
                        </td>
                      );
                    }
                    return (
                      <td
                        key={columna}
                        style={{ ['--carga' as string]: `${Math.round(c.valor * 0.65)}%` }}
                        title={`${columna}: mediana ${c.valor} sobre ${c.n} casos`}
                      >
                        {c.valor}
                      </td>
                    );
                  }
                  const cuantos = c.valor ?? 0;
                  if (cuantos === 0) {
                    return (
                      <td
                        key={columna}
                        className="os-hub-mapa-vacia"
                        title={`${columna}: ninguno de ${c.n}`}
                      >
                        ·
                      </td>
                    );
                  }
                  const parte = porciento(cuantos, c.n);
                  return (
                    <td
                      key={columna}
                      style={{ ['--carga' as string]: `${Math.round(parte * 0.6)}%` }}
                      title={`${columna}: ${cuantos} de ${c.n} (${parte} %)`}
                    >
                      {cuantos}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cruce.afuera.length > 0 && (
        <span className="os-hub-n">
          Sin fila por tener menos de cinco casos:{' '}
          {cruce.afuera.map((a) => `${a.nombre} (${a.n})`).join(', ')}.
        </span>
      )}
    </>
  );
}

/** Cada grupo como una barra entera partida según cómo cierran sus informes. */
function Apiladas({ cruce, tonos }: { cruce: Cruce; tonos: Record<string, Tono> }) {
  if (cruce.filas.length === 0) {
    return <p className="os-vacio">Ningún grupo llega a cinco informes cerrados.</p>;
  }
  return (
    <>
      <ul className="os-hub-apiladas">
        {cruce.filas.map((f) => (
          <li key={f.nombre}>
            <span className="os-hub-barra-nombre" title={f.nombre}>
              {f.nombre}
            </span>
            <span className="os-hub-apilada">
              {f.celdas.map((c, i) =>
                c.valor ? (
                  <span
                    key={cruce.columnas[i]}
                    className={`os-hub-tono-${tonos[cruce.columnas[i]] ?? 'neutro'}`}
                    style={{ flexGrow: c.valor }}
                    title={`${cruce.columnas[i]}: ${c.valor} de ${f.n} (${porciento(c.valor, f.n)} %)`}
                  />
                ) : null,
              )}
            </span>
            <span className="os-hub-barra-n">{f.n}</span>
          </li>
        ))}
      </ul>
      <ul className="os-hub-leyenda os-hub-leyenda-fila">
        {cruce.columnas.map((c) => (
          <li key={c}>
            <span className={`os-hub-muestra os-hub-tono-${tonos[c] ?? 'neutro'}`} />
            <span className="os-hub-leyenda-nombre">{CONCLUSION_CORTA[c] ?? c}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Un punto por persona sobre el eje del percentil, con la mediana marcada. */
function Tiras({ grupos }: { grupos: Distribucion[] }) {
  if (grupos.length === 0) {
    return <p className="os-vacio">Ningún nivel llega a cinco personas con Raven.</p>;
  }
  return (
    <ul className="os-hub-tiras">
      {grupos.map((g) => (
        <li key={g.nombre}>
          <span className="os-hub-barra-nombre">
            {g.nombre} <span className="os-hub-tira-n">{g.n}</span>
          </span>
          <span
            className="os-hub-tira"
            role="img"
            aria-label={`${g.nombre}: mediana ${g.mediana} de percentil sobre ${g.n} personas`}
          >
            {g.valores.map((v, i) => (
              <span
                key={i}
                className="os-hub-tira-punto"
                style={{ left: `${v}%` }}
                title={`Percentil ${v}`}
              />
            ))}
            {g.mediana !== null && (
              <span
                className="os-hub-tira-centro"
                style={{ left: `${g.mediana}%` }}
                title={`Mediana ${g.mediana}`}
              />
            )}
          </span>
          <span className="os-hub-barra-n">{g.mediana === null ? '·' : Math.round(g.mediana)}</span>
        </li>
      ))}
      <li className="os-hub-tiras-eje" aria-hidden="true">
        <span />
        <span>
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </span>
        <span />
      </li>
    </ul>
  );
}

export default function Candidatos({ d }: { d: DataHub }) {
  const { fit, raven } = d.candidatos;
  const cerrados = fit.conclusiones.reduce((a, c) => a + c.n, 0);
  const conBenziger = fit.cuadrantes.reduce((a, c) => a + c.n, 0);
  const conEstilo = fit.estilos.reduce((a, c) => a + c.n, 0);

  return (
    <>
      {/* Antes que cualquier cruce: con cuánta gente se cuenta para cada cosa. */}
      <div className="os-hub-tapa">
        {fit.cobertura.map((c) => (
          <div key={c.pieza} className="os-hub-kpi">
            <span className="os-hub-rotulo">{c.pieza}</span>
            <span className="os-hub-valor">{c.hechas}</span>
            <span className="os-hub-n">
              de {c.de} personas evaluadas · {porciento(c.hechas, c.de)} %
            </span>
          </div>
        ))}
      </div>

      <Eje
        titulo="Cómo cierran los informes"
        bajada="Cada punto es una persona evaluada con el informe cerrado. A la derecha, la misma conclusión partida por nivel y por familia de puesto: muestra a qué tipo de búsqueda llega gente con más reservas."
      >
        <div className="os-hub-dos">
          <Panel titulo="Conclusión final" nota={`${cerrados} informes cerrados`}>
            <Hemiciclo datos={fit.conclusiones} tonos={TONO_CONCLUSION} unidad="informes" />
          </Panel>
          <Panel titulo="Conclusión por nivel del puesto">
            <Apiladas cruce={fit.conclusionPorNivel} tonos={TONO_CONCLUSION} />
          </Panel>
          <Panel titulo="Conclusión por familia de puesto">
            <Apiladas cruce={fit.conclusionPorFamilia} tonos={TONO_CONCLUSION} />
          </Panel>
        </div>
      </Eje>

      <Eje
        titulo="El baremo de la casa"
        bajada="Cómo puntúa en cada competencia la gente que Campos HR evaluó. La línea vertical es la mediana y la franja gruesa sobre el eje marca dónde cae la mitad central. Un puntaje individual se puede leer contra esta referencia además de contra las bandas de la literatura."
      >
        <section className="os-panel">
          <div className="os-panel-cuerpo">
            {fit.distribuciones.length === 0 ? (
              <p className="os-vacio">Hace falta al menos un sumario cargado.</p>
            ) : (
              <div className="os-hub-curvas">
                {fit.distribuciones.map((dist) => (
                  <Curva key={dist.nombre} d={dist} />
                ))}
              </div>
            )}
          </div>
        </section>
      </Eje>

      <Eje
        titulo="Qué perfil llega a cada puesto"
        bajada="La mediana de cada competencia según a qué se presenta la persona. Las celdas más oscuras son puntajes más altos. Sirve para decirle a un cliente cómo se ubica su candidato frente a quienes se presentan a puestos parecidos."
      >
        <div className="os-hub-dos os-hub-anchos">
          <Panel titulo="Competencias por familia de puesto" nota="mediana de 0 a 100">
            <Mapa
              cruce={fit.competenciaPorFamilia}
              modo="mediana"
              grupo="Familia"
              cortas={CON_CORTE}
            />
          </Panel>
          <Panel titulo="Competencias por nivel" nota="mediana de 0 a 100">
            <Mapa cruce={fit.competenciaPorNivel} modo="mediana" grupo="Nivel" cortas={CON_CORTE} />
          </Panel>
        </div>
      </Eje>

      <Eje
        titulo="Capacidad intelectual"
        bajada="El percentil del Raven de cada persona. Abajo, por nivel del puesto: cada punto es una persona y la marca vertical es la mediana del nivel."
      >
        <div className="os-hub-dos">
          <Panel
            titulo="Raven por nivel del puesto"
            nota={
              raven.mediana === null
                ? 'sin puntajes'
                : `mediana general ${raven.mediana} · ${raven.n} casos`
            }
          >
            <Tiras grupos={fit.ravenPorNivel} />
          </Panel>
          <Panel titulo="Raven por rango" nota="baremo del test">
            <Barras datos={raven.reparto} vacio="Nadie tiene el Raven puntuado." />
          </Panel>
        </div>
      </Eje>

      <Eje
        titulo="Estilo de pensamiento y estilo vivencial"
        bajada="El cuadrante preferente del Benziger y el estilo vivencial del Rorschach o el Zulliger, y cómo se reparten por familia de puesto. El Benziger tiene pocos casos todavía: las tablas muestran personas, y con estos números todavía no marcan una tendencia."
      >
        <div className="os-hub-dos">
          <Panel titulo="Cuadrante Benziger" nota={`${conBenziger} perfiles leídos`}>
            <Hemiciclo
              datos={fit.cuadrantes}
              tonos={TONO_CUADRANTE}
              unidad="perfiles"
              largos={CUADRANTE_LARGO}
            />
          </Panel>
          <Panel titulo="Cuadrante por familia de puesto" nota="personas">
            <Mapa cruce={fit.cuadrantePorFamilia} modo="cuenta" grupo="Familia" />
          </Panel>
          <Panel titulo="Estilo vivencial" nota={`${conEstilo} protocolos`}>
            <Hemiciclo datos={fit.estilos} tonos={TONO_ESTILO} unidad="protocolos" />
          </Panel>
          <Panel titulo="Estilo vivencial por familia de puesto" nota="personas">
            <Mapa cruce={fit.estiloPorFamilia} modo="cuenta" grupo="Familia" cortas={CON_CORTE} />
          </Panel>
        </div>
      </Eje>

      <Eje
        titulo="Lo que falta para medir el ajuste"
        bajada="El ajuste se mide comparando a la persona con el puesto y después con cómo le fue. De la persona hay datos. Del puesto y del resultado casi no hay, y estos son los que hay que empezar a cargar."
      >
        <section className="os-panel">
          <div className="os-panel-cuerpo">
            <ul className="os-hub-pendientes">
              {fit.faltantes.map((f) => (
                <li key={f.pieza}>
                  <div className="os-hub-pend-top">
                    <span className="os-hub-pend-nombre">{f.pieza}</span>
                    <span className="os-hub-barra-n">
                      {f.hechas} de {f.de}
                    </span>
                  </div>
                  <span className="os-hub-barra">
                    <span
                      style={{
                        width: `${f.de === 0 ? 0 : Math.min(100, (f.hechas / f.de) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="os-hub-n">{f.paraQue}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </Eje>
    </>
  );
}
