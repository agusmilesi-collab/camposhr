'use client';

/**
 * Dónde corta cada indicador y cuánto pesa, editables.
 *
 * **Se guarda la diferencia y no la tabla entera**: lo que quedó en su valor de
 * fábrica no se guarda, así que un corte o un peso que mañana cambie en el
 * código le llega a quien no lo tocó. Son dos ajustes distintos y se guardan
 * juntos, en una sola pasada, porque quien corrige una competencia toca las dos
 * cosas a la vez.
 *
 * **La columna que se mira es la del aporte, no la del peso.** Un peso de 2 no
 * dice nada solo; lo que se decide es qué parte del puntaje de la competencia se
 * lleva ese indicador, y eso depende de los otros. Por eso el porcentaje se
 * recalcula mientras se escribe.
 *
 * Un indicador en cero sigue a la vista en el detalle del informe y no entra al
 * promedio, que es lo que se quiere cuando se desconfía de uno.
 */

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { columnas } from '../psicotecnicos/piezas';
import { comoNumero, reglaDeBanda, type Escala } from '@/lib/escalas';

const MAXIMO = 5;

/**
 * Un corte como se escribe en su casilla.
 *
 * Los que van en porcentaje se editan en escala de cero a cien, que es como se
 * los nombra: "W desde el 45%" y no "desde 0,45". La coma es la decimal de acá.
 */
function enCaja(v: number, e: Escala): string {
  const n = e.porcentaje ? v * 100 : v;
  const dec = e.porcentaje ? 0 : (e.decimales ?? 0);
  return n.toFixed(dec).replace('.', ',');
}

/** Lo escrito en una casilla, de vuelta a número. Null si no se entiende. */
function deCaja(t: string, e: Escala): number | null {
  const limpio = t.trim().replace(',', '.');
  if (!limpio) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n)) return null;
  return e.porcentaje ? n / 100 : n;
}

/**
 * Qué parte del puntaje se lleva cada indicador, en enteros que suman 100.
 *
 * Redondear cada uno por su cuenta no cierra: tres indicadores del mismo peso
 * dan 33, 33 y 33, y la columna suma 99 sin que nada esté mal. Se reparte por
 * resto mayor, así que ningún aporte se corre más de un punto del que le toca y
 * el total dice lo que tiene que decir. Con todos los pesos en cero no hay nada
 * que repartir y la competencia queda sin puntaje: eso se devuelve como null y
 * la tabla lo dice.
 */
function aportes(pesos: number[]): number[] | null {
  const total = pesos.reduce((n, p) => n + p, 0);
  if (total === 0) return null;
  const exactos = pesos.map((p) => (p / total) * 100);
  const enteros = exactos.map(Math.floor);
  let sobran = 100 - enteros.reduce((n, x) => n + x, 0);
  const orden = exactos
    .map((x, i) => ({ i, resto: x - Math.floor(x) }))
    .sort((a, b) => b.resto - a.resto);
  for (const { i } of orden) {
    if (sobran <= 0) break;
    // Un indicador en cero no se lleva el redondeo de otro: sale del promedio y
    // tiene que verse en cero.
    if (pesos[i] === 0) continue;
    enteros[i] += 1;
    sobran -= 1;
  }
  return enteros;
}

const COLUMNAS = ['Indicador', 'Qué mide', 'Alto', 'Medio', 'Bajo', 'Peso', 'Aporte'];

/* Medidos en pantalla contra el contenido más largo de cada columna, más los 28
   px de padding de la celda. Sin anchos declarados, cada competencia repartía
   los suyos según lo que le tocó y la misma columna caía en otro lugar en cada
   panel: nueve tablas de lo mismo y ninguna alineada con la anterior.

   `columnas` los pasa a porcentajes, así que lo que se declara es el reparto y
   no el ancho: en una ventana angosta todas se achican juntas. Peso y Aporte se
   llevan una parte que no les corresponde por lo que muestran, sino porque son
   las dos que se miran y las únicas que no se pueden recortar: un campo de dos
   dígitos apretado a cincuenta píxeles deja el número cortado. Lo que cede el
   ancho es "Dónde corta", que es texto de referencia y se lee entero en el
   informe. */
const MEDIDAS = columnas(COLUMNAS, {
  Indicador: 150,
  'Qué mide': 260,
  Alto: 175,
  Medio: 175,
  Bajo: 155,
  Peso: 110,
  Aporte: 115,
});

/** Dónde vuelve "Volver arriba": el panel con el índice, al principio. */
const ARRIBA = 'ponderaciones-indice';

/** El ancla de un test o de una competencia, para poder bajar a ella. */
function anclaDe(...partes: string[]): string {
  return partes
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export type Indicador = {
  clave: string;
  nombre: string;
  mide: string;
  /** Los números que definen las bandas. Null cuando la banda no sale de un umbral. */
  escala: Escala | null;
  /** Qué dice cada banda cuando no hay números: se compara un índice con otro. */
  reglas: string[] | null;
  /** Qué se compara, cuando no es el índice a secas. */
  sobre: string | null;
  cortes: number[];
  cortesFabrica: number[];
  peso: number;
  fabrica: number;
};

export type Hoja = {
  test: string;
  competencias: { nombre: string; mide: string; indicadores: Indicador[] }[];
};

export default function Pesos({
  hojas,
  tocado,
  cortesTocados,
}: {
  hojas: Hoja[];
  tocado: boolean;
  cortesTocados: boolean;
}) {
  const router = useRouter();

  /** Todos los indicadores por clave, para no recorrer las dos hojas cada vez. */
  const todos = useMemo(
    () =>
      new Map(
        hojas.flatMap((h) => h.competencias.flatMap((c) => c.indicadores.map((i) => [i.clave, i])))
      ),
    [hojas]
  );

  const puestos = useMemo(
    () =>
      Object.fromEntries(
        hojas.flatMap((h) =>
          h.competencias.flatMap((c) => c.indicadores.map((i) => [i.clave, i.peso]))
        )
      ) as Record<string, number>,
    [hojas]
  );
  const fabrica = useMemo(
    () =>
      Object.fromEntries(
        hojas.flatMap((h) =>
          h.competencias.flatMap((c) => c.indicadores.map((i) => [i.clave, i.fabrica]))
        )
      ) as Record<string, number>,
    [hojas]
  );

  /**
   * Los cortes como texto y no como número.
   *
   * Se escriben con coma y, en los que van en porcentaje, en escala de cero a
   * cien: guardar el número mientras se tipea dejaba un campo a medio escribir
   * valiendo cero, y con eso la banda de abajo se comía la tabla entera.
   */
  const escritos = useMemo(() => {
    const d: Record<string, string[]> = {};
    for (const i of todos.values()) {
      if (i.escala) d[i.clave] = i.cortes.map((v) => enCaja(v, i.escala as Escala));
    }
    return d;
  }, [todos]);

  const [pesos, setPesos] = useState<Record<string, number>>(puestos);
  const [cortes, setCortes] = useState<Record<string, string[]>>(escritos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guardar vuelve a dibujar del servidor, pero eso no reinicia el estado de un
  // componente de cliente: sin esto, volver a los de fábrica dejaba la tabla
  // mostrando los pesos que se acababan de borrar. Se compara por valor y no por
  // identidad porque cada dibujo del servidor manda un objeto nuevo, y compararlo
  // por identidad borraría lo que se está escribiendo.
  const firma = JSON.stringify([puestos, escritos]);
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setPesos(puestos);
    setCortes(escritos);
  }

  const pesosSinGuardar = Object.keys(puestos).filter((k) => pesos[k] !== puestos[k]);
  const cortesSinGuardar = Object.keys(escritos).filter(
    (k) => cortes[k]?.join('|') !== escritos[k].join('|')
  );
  const sinGuardar = [...pesosSinGuardar, ...cortesSinGuardar];
  const cambiado = sinGuardar.length > 0;

  /** Los números que rigen ahora para un indicador, con lo que se está escribiendo. */
  function numerosDe(i: Indicador): number[] | null {
    if (!i.escala) return null;
    const leidos = (cortes[i.clave] ?? []).map((t) => deCaja(t, i.escala as Escala));
    return leidos.some((n) => n === null) ? null : (leidos as number[]);
  }

  async function mandar(clave: string, valor: unknown) {
    const res = await fetch('/api/os/ajustes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, valor }),
    });
    const r = await res.json();
    if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
  }

  /** Los dos ajustes en una pasada: se corrigen juntos y se guardan juntos. */
  async function guardar(pesosNuevos: unknown, cortesNuevos: unknown) {
    setGuardando(true);
    setError(null);
    try {
      await mandar('competencias_pesos', pesosNuevos);
      await mandar('competencias_cortes', cortesNuevos);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  /** Solo los pesos que se movieron de su valor de fábrica. */
  function pesosMovidos(): Record<string, number> {
    const d: Record<string, number> = {};
    for (const [k, v] of Object.entries(pesos)) if (v !== fabrica[k]) d[k] = v;
    return d;
  }

  /**
   * Solo los cortes que se movieron.
   *
   * Un campo vacío o a medio escribir no se guarda: queda el que estaba, y la
   * pantalla lo dice en rojo hasta que se complete.
   */
  function cortesMovidos(): Record<string, number[]> {
    const d: Record<string, number[]> = {};
    for (const i of todos.values()) {
      const n = numerosDe(i);
      if (!n || n.join('|') === i.cortesFabrica.join('|')) continue;
      d[i.clave] = n;
    }
    return d;
  }

  /** Qué campos quedaron sin un número legible. */
  const rotos = [...todos.values()].filter((i) => i.escala && numerosDe(i) === null);

  /** Una casilla de corte, con su número editable. */
  function casilla(i: Indicador, n: number, etiqueta: string) {
    const e = i.escala as Escala;
    const texto = cortes[i.clave]?.[n] ?? '';
    const roto = deCaja(texto, e) === null;
    // Contra el número del código y no contra lo último guardado: la marca dice
    // que ese corte está movido, y eso sigue siendo cierto después de guardarlo.
    const movido = !roto && deCaja(texto, e) !== i.cortesFabrica[n];
    return (
      <span className={`os-corte-caja${roto ? ' os-corte-roto' : ''}`}>
        <input
          className="os-campo os-campo-umbral"
          type="text"
          inputMode="decimal"
          aria-label={etiqueta}
          value={texto}
          onChange={(ev) =>
            setCortes((c) => {
              const lista = [...(c[i.clave] ?? [])];
              lista[n] = ev.target.value;
              return { ...c, [i.clave]: lista };
            })
          }
        />
        {e.porcentaje && <span className="os-corte-unidad">%</span>}
        {movido && !roto && (
          <span className="os-dato-falta" title={`De fábrica: ${enCaja(i.cortesFabrica[n], e)}`}>
            de {enCaja(i.cortesFabrica[n], e)}
          </span>
        )}
      </span>
    );
  }

  /**
   * La celda de una banda: alto, medio o bajo.
   *
   * La de abajo no lleva campos. No tiene números propios: es todo lo que no
   * entró en las otras dos, y ponerle casillas invitaría a moverla por su
   * cuenta y a dejar un hueco donde el indicador no cae en ninguna banda.
   */
  function banda(i: Indicador, cual: 0 | 1 | 2) {
    const nombre = ['Alto', 'Medio', 'Bajo'][cual];
    const e = i.escala;
    if (!e || cual === 2) {
      const texto = reglaDeBanda(e, numerosDe(i) ?? undefined, cual, i.reglas ?? undefined);
      return (
        <td className="os-tabla-flojo os-banda-regla" data-campo={nombre}>
          {texto === 'no se usa' ? <span className="os-banda-nula">no se usa</span> : texto}
        </td>
      );
    }
    const etiqueta = (n: number) => `${nombre} de ${i.nombre}, corte ${n + 1}`;
    return (
      <td data-campo={nombre}>
        <span className="os-banda-celda">
          {e.forma === 'umbral' ? (
            <>
              <span className="os-banda-palabra">{e.mayorEsMejor ? 'desde' : 'hasta'}</span>
              {casilla(i, cual, etiqueta(cual))}
            </>
          ) : (
            <>
              <span className="os-banda-palabra">entre</span>
              {casilla(i, cual * 2, etiqueta(cual * 2))}
              <span className="os-banda-palabra">y</span>
              {casilla(i, cual * 2 + 1, etiqueta(cual * 2 + 1))}
            </>
          )}
        </span>
      </td>
    );
  }

  return (
    <>
      {/* Cómo se llega al número, arriba y no al pie: es la primera pregunta
          de quien abre esta pantalla, y sin la respuesta las tres columnas de
          bandas se leen como tres datos sueltos. */}
      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Cómo sale el puntaje</h2>
        </div>
        <div className="os-panel-cuerpo">
          <ol className="os-pasos-calculo">
            <li>
              <strong>Cada indicador cae en una banda.</strong> Se mira su valor en el protocolo
              y se ve en cuál de las tres entra, según los cortes de esta pantalla.
            </li>
            <li>
              <strong>La banda vale un número.</strong> Alto cien, medio cincuenta, bajo cero. No
              hay valores intermedios: un indicador aporta uno de esos tres.
            </li>
            <li>
              <strong>La competencia es el promedio.</strong> Se suman los aportes multiplicados
              por su peso y se divide por la suma de los pesos. Un indicador sin dato queda
              afuera del promedio, y con dos o más sin dato la competencia sale sin puntaje.
            </li>
            <li>
              <strong>Ese promedio es la aguja.</strong> Va de 0 a 100 y el informe lo nombra
              Bajo hasta 34, Adecuado hasta 64, Alto hasta 79 y Sobresaliente desde 80.
            </li>
          </ol>
          <p className="os-form-nota">
            Un ejemplo con cinco indicadores donde el de peso 2 sale alto, dos de peso 1 salen
            medio y otros dos de peso 1 salen bajo: (2×100 + 1×50 + 1×50 + 1×0 + 1×0) ÷ 6 = 50,
            que se informa como Adecuado.
          </p>
        </div>
      </section>

      {/* El índice: dos hojas de nueve competencias cada una, y la que hay que
          corregir está casi siempre a media pantalla de distancia. */}
      <section className="os-panel" id={ARRIBA}>
        <div className="os-panel-top">
          <h2>Índice</h2>
        </div>
        <div className="os-panel-cuerpo">
          <nav className="os-indice" aria-label="Competencias por test">
            {hojas.map((h, n) => (
              <div key={h.test} className="os-indice-item">
                <a className="os-indice-area" href={`#${anclaDe(h.test)}`}>
                  <span className="os-indice-nombre">
                    <span className="os-numero">{n + 1}.</span> {h.test}
                  </span>
                  <span className="os-indice-cuenta">{h.competencias.length}</span>
                </a>
                <div className="os-indice-hijos">
                  {h.competencias.map((c) => (
                    <a
                      key={c.nombre}
                      className="os-indice-hijo"
                      href={`#${anclaDe(h.test, c.nombre)}`}
                    >
                      <span>{c.nombre}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </section>

      <div className="os-redacciones">
        {hojas.map((h, n) => (
        <div key={h.test}>
          <div className="os-area" id={anclaDe(h.test)}>
            <h2 className="os-area-titulo">
              <span className="os-numero">{n + 1}.</span> {h.test}
            </h2>
            <span className="os-area-cuenta">{h.competencias.length} competencias</span>
            <a className="os-area-volver" href={`#${ARRIBA}`}>
              Volver arriba
            </a>
          </div>

          {h.competencias.map((c) => {
            const suyos = c.indicadores.map((i) => pesos[i.clave] ?? 0);
            const total = suyos.reduce((n, p) => n + p, 0);
            const parte = aportes(suyos);
            return (
              <section
                className="os-panel os-indice-panel"
                key={`${h.test}-${c.nombre}`}
                id={anclaDe(h.test, c.nombre)}
              >
                <div className="os-panel-top">
                  <h3 className="os-indice-nombre-titulo">{c.nombre}</h3>
                  <span className="os-columna-monto">{c.mide}</span>
                  <a className="os-area-volver" href={`#${ARRIBA}`}>
                    Volver arriba
                  </a>
                </div>

                <div className="os-tabla-marco">
                  <table className="os-tabla os-tabla-trabajo os-tabla-fija">
                    <colgroup>
                      {COLUMNAS.map((x, n) => (
                        <col key={x} style={{ width: MEDIDAS[n] }} />
                      ))}
                    </colgroup>
                    {/* Las tres bandas con lo que aporta cada una en el
                        encabezado: la pregunta que se hace quien mira esta
                        tabla es qué le pasa al puntaje si el indicador cae acá,
                        y la respuesta es ese número. */}
                    <thead>
                      <tr>
                        <th>Indicador</th>
                        <th>Qué mide</th>
                        <th>
                          Alto <span className="os-banda-vale">100</span>
                        </th>
                        <th>
                          Medio <span className="os-banda-vale">50</span>
                        </th>
                        <th>
                          Bajo <span className="os-banda-vale">0</span>
                        </th>
                        <th className="os-tabla-num">Peso</th>
                        <th className="os-tabla-num">Aporte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.indicadores.map((i, n) => {
                        const peso = suyos[n];
                        return (
                          <tr key={i.clave}>
                            <td className="os-tabla-nombre" data-campo="Indicador">
                              {i.nombre}
                            </td>
                            <td className="os-tabla-flojo" data-campo="Qué mide">
                              {i.mide}
                            </td>
                            {banda(i, 0)}
                            {banda(i, 1)}
                            {banda(i, 2)}
                            <td className="os-tabla-num" data-campo="Peso">
                              <div className="os-peso-celda">
                                <input
                                  className="os-campo"
                                  type="number"
                                  min={0}
                                  max={MAXIMO}
                                  value={peso}
                                  aria-label={`Cuánto pesa ${i.nombre} en ${c.nombre}`}
                                  onChange={(e) =>
                                    setPesos((p) => ({ ...p, [i.clave]: Number(e.target.value) }))
                                  }
                                />
                                {peso !== i.fabrica && (
                                  <span className="os-dato-falta">de {i.fabrica}</span>
                                )}
                              </div>
                            </td>
                            <td className="os-tabla-num os-tabla-flojo" data-campo="Aporte">
                              {parte ? `${parte[n]} %` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* La comprobación de la columna: los aportes de una
                        competencia reparten su puntaje entero, así que tienen
                        que sumar cien. Con todos los pesos en cero no suman
                        nada y la competencia sale sin puntaje, que es lo que la
                        ruta rechaza al guardar. */}
                    <tfoot>
                      <tr>
                        <td colSpan={5}>Suma de la competencia</td>
                        <td className="os-tabla-num" data-campo="Peso">
                          {total}
                        </td>
                        <td
                          className={`os-tabla-num${parte ? '' : ' os-suma-vacia'}`}
                          data-campo="Aporte"
                        >
                          {parte ? '100 %' : 'sin puntaje'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
        ))}
      </div>

      <section className="os-panel">
        <div className="os-panel-cuerpo">
          <p className="os-form-nota">
            El aporte es la parte del puntaje de la competencia que se lleva cada indicador, y
            los de una competencia suman cien: el pie de cada tabla lo muestra. Un indicador en
            cero sigue apareciendo en el detalle del informe y no entra al promedio; una
            competencia entera en cero se rechaza, porque saldría sin puntaje en todos los
            informes.
          </p>
          <p className="os-form-nota">
            Los indicadores que comparan dos índices entre sí, como GHR : PHR o FC : CF + C, no
            tienen número que mover: la banda sale de cuál de los dos es mayor y por eso su fila
            va escrita y no en casillas.
          </p>

          {(tocado || cortesTocados) && !cambiado && (
            <div className="os-barra-acciones">
              <button
                className="os-boton"
                disabled={guardando}
                onClick={() => guardar(null, null)}
                title="Borra lo guardado y vuelve a los cortes y a los pesos del código"
              >
                Volver a los de fábrica
              </button>
            </div>
          )}
          {error && !cambiado && <p className="os-form-error">{error}</p>}
        </div>
      </section>

      {/* Guardar sigue en pantalla mientras haya algo sin guardar: mover un
          peso de la primera competencia y guardarlo era bajar las dieciocho
          tablas. Se guarda todo junto igual, porque lo que se manda es la
          diferencia contra el código y no un valor suelto. */}
      {cambiado && (
        <div className="os-guardar-barra">
          <span className="os-guardar-cuenta">
            {error ? (
              <span className="os-form-error">{error}</span>
            ) : rotos.length > 0 ? (
              <span className="os-form-error">
                {rotos.length === 1
                  ? `Falta el número de ${rotos[0].nombre}`
                  : `Faltan números en ${rotos.length} indicadores`}
              </span>
            ) : (
              `${sinGuardar.length} ${sinGuardar.length === 1 ? 'cambio' : 'cambios'}`
            )}
          </span>
          <button
            className="os-boton"
            disabled={guardando}
            onClick={() => {
              setPesos(puestos);
              setCortes(escritos);
            }}
          >
            Deshacer
          </button>
          <button
            className="os-boton os-boton-azul"
            disabled={guardando || rotos.length > 0}
            onClick={() => guardar(pesosMovidos(), cortesMovidos())}
          >
            {guardando ? 'Guardando…' : 'Guardar los cambios'}
          </button>
        </div>
      )}
    </>
  );
}
