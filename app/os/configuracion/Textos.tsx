'use client';

/**
 * El diccionario de lecturas, editable: qué dice cada una y contra qué entra.
 *
 * **Se guarda la diferencia y no el diccionario entero**, igual que el baremo y
 * los pesos: lo que quedó como estaba no se guarda, así que una corrección que
 * mañana entre en el código le llega a quien no la tocó.
 *
 * **El corte se edita al lado del texto.** El número contra el que la lectura
 * entra es criterio clínico, no decisión técnica, y hasta ahora vivía adentro
 * del algoritmo: corregir "más de 4" sin poder mover el cuatro era escribir
 * algo que no se iba a cumplir. Ahora el castellano se escribe con el número
 * que rige, así que los dos no pueden separarse.
 *
 * Las lecturas que entran contra una banda que depende del estilo o de la
 * cantidad de respuestas (Afr, Zf, P, contenidos humanos) o contra la relación
 * entre dos índices (a:p, COP y AG) no llevan corte: ahí la condición se lee y
 * no se mueve.
 *
 * **Las lecturas del mismo índice van en el mismo bloque.** Lambda por abajo y
 * Lambda por arriba son dos ramas de una decisión sola, y separadas en dos
 * tarjetas obligaban a leer dos veces el mismo encabezado para entender que
 * hablaban del mismo número. El índice manda: se lee "Lambda" y adentro, qué
 * pasa por abajo y qué por arriba.
 *
 * Son sesenta y ocho lecturas en veintitantos índices, así que hay dos formas
 * de llegar a una: el índice de áreas, que baja a la que corresponda, y el
 * buscador, donde escribir "Lambda" o "aislamiento" deja a la vista solo esas.
 * El filtro esconde renglones, no los descarta: lo editado en uno que dejó de
 * verse se guarda igual.
 */

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';

export type Corte = {
  op: 'menor' | 'mayor';
  decimales: number;
  /** Lo que la condición pide además del número, si pide algo. */
  ademas: string | null;
  /** El que rige hoy. */
  valor: number;
  /** El que trae el código, para saber si se movió. */
  fabrica: number;
};

/** Los tres campos de una lectura, cada uno con sus tres formas de decirlo. */
/** Lo que se guarda de una lectura: los cuatro textos, cuando no son los del código. */
type Campos4 = { dice?: string[]; recomienda?: string[]; diceZ?: string[]; recomiendaZ?: string[] };

export type Campos = {
  dice: string[];
  recomienda: string[];
  /** Lo del Zulliger. Vacío quiere decir "vale lo del Rorschach". */
  diceZ: string[];
  recomiendaZ: string[];
};

export type Renglon = Campos & {
  clave: string;
  area: string;
  indice: string;
  cuando: string;
  diceFabrica: string[];
  recomiendaFabrica: string[];
  diceZFabrica: string[];
  recomiendaZFabrica: string[];
  corte: Corte | null;
  /** El del Zulliger, cuando las normas de ese test cortan en otro número. */
  corteZ: Corte | null;
};

/**
 * Un campo que crece con lo que tiene escrito, sin fijarle la altura.
 *
 * `estirar` pone la altura en `height`, y un elemento de grilla con altura
 * propia deja de estirarse a la de su fila: los dos campos de una lectura
 * quedaban con alturas distintas y el más corto, con el borde a media
 * columna. Acá lo medido va a `min-height`, así que la fila la define el
 * texto más largo y el otro se estira hasta igualarlo.
 */
/** Dónde vuelve "Volver arriba": el panel del buscador, con el índice. */
const ARRIBA = 'redacciones-indice';

/** El ancla de un índice. Sale de la clave de su primera rama, que es única. */
function anclaDeIndice(clave: string): string {
  return `indice-${clave}`;
}

/** El identificador del ancla de un área, para que el índice pueda bajar a ella. */
function anclaDe(area: string): string {
  return `area-${area
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

/**
 * El número de un corte escrito como se lee: con coma decimal y con el menos
 * tipográfico, igual que en el informe. Sin el más de los positivos: adentro
 * del campo un "+3,0" invita a borrar el signo antes de escribir.
 */
function escribir(c: Corte, valor: number): string {
  const n = Math.abs(valor).toFixed(c.decimales).replace('.', ',');
  return valor < 0 ? `−${n}` : n;
}

export default function Textos({
  renglones,
  tocado,
}: {
  renglones: Renglon[];
  tocado: boolean;
}) {
  const router = useRouter();

  const puestos: Record<string, Campos> = useMemo(
    () =>
      Object.fromEntries(
        renglones.map((r) => [
          r.clave,
          {
            dice: [...r.dice],
            recomienda: [...r.recomienda],
            diceZ: [...r.diceZ],
            recomiendaZ: [...r.recomiendaZ],
          },
        ])
      ),
    [renglones]
  );

  // El corte se guarda como el texto del campo y no como número: mientras
  // alguien escribe "0," el valor todavía no es un número, y convertirlo en
  // cada tecla le borraría la coma que acaba de escribir.
  const cortesPuestos = useMemo(
    () =>
      Object.fromEntries([
        ...renglones
          .filter((r) => r.corte)
          .map((r) => [r.clave, escribir(r.corte!, r.corte!.valor)]),
        ...renglones
          .filter((r) => r.corteZ)
          .map((r) => [`zulliger:${r.clave}`, escribir(r.corteZ!, r.corteZ!.valor)]),
      ]),
    [renglones]
  );

  /**
   * El número de cada área, como los capítulos de un documento.
   *
   * Se cuenta sobre el diccionario entero y no sobre lo que el buscador deja a
   * la vista: si se renumerara con el filtro, un área sería la 6 con la
   * pantalla completa y la 1 buscando algo suyo, y el número dejaría de servir
   * para nombrarla.
   */
  const numeroDeArea = useMemo(() => {
    const numero = new Map<string, number>();
    for (const r of renglones) {
      if (!numero.has(r.area)) numero.set(r.area, numero.size + 1);
    }
    return numero;
  }, [renglones]);

  const [textos, setTextos] = useState<Record<string, Campos>>(puestos);
  const [cortes, setCortes] = useState<Record<string, string>>(cortesPuestos);
  const [filtro, setFiltro] = useState('');
  /**
   * Qué test se está editando.
   *
   * Son dos diccionarios: normas distintas, cortes distintos y redacciones
   * escritas para lo que cada test puede leer. En Zulliger, un campo vacío
   * quiere decir "vale lo del Rorschach", y se dice.
   */
  const [test, setTest] = useState<'Rorschach' | 'Zulliger'>('Rorschach');
  const esZulliger = test === 'Zulliger';
  /** Cuántas lecturas tienen en Zulliger un corte distinto del de Rorschach. */
  const cortesPropios = renglones.filter(
    (r) => r.corte && r.corteZ && r.corte.fabrica !== r.corteZ.fabrica
  ).length;
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  // Guardar vuelve a dibujar del servidor, pero eso no reinicia el estado de un
  // componente de cliente: sin esto, volver a lo de fábrica dejaba en pantalla
  // los textos que se acababan de borrar.
  const firma = JSON.stringify([puestos, cortesPuestos]);
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setTextos(puestos);
    setCortes(cortesPuestos);
  }

  /** Dos listas de formas de decirlo son la misma si dicen lo mismo en orden. */
  const igual = (a: string[], b: string[]) => a.join('\u0000') === b.join('\u0000');

  const sinGuardar = renglones.filter(
    (r) =>
      !igual(textos[r.clave].dice, r.dice) ||
      !igual(textos[r.clave].recomienda, r.recomienda) ||
      !igual(textos[r.clave].recomiendaZ, r.recomiendaZ) ||
      (r.corte && cortes[r.clave] !== cortesPuestos[r.clave]) ||
      (r.corteZ && cortes[`zulliger:${r.clave}`] !== cortesPuestos[`zulliger:${r.clave}`])
  );
  const cambiado = sinGuardar.length > 0;

  /** Lo escrito en un campo de corte, ya como número; null si todavía no lo es. */
  function numero(clave: string): number | null {
    const crudo = (cortes[clave] ?? '').replace(',', '.').trim();
    if (!crudo || crudo === '-' || crudo === '−') return null;
    const n = Number(crudo.replace('−', '-'));
    return Number.isFinite(n) ? n : null;
  }

  const rotos = renglones.filter((r) => r.corte && numero(r.clave) === null);

  const busca = filtro.trim().toLowerCase();
  const visibles = renglones.filter(
    (r) =>
      !busca ||
      `${r.area} ${r.indice} ${r.cuando} ${textos[r.clave].dice} ${textos[r.clave].recomienda}`
        .toLowerCase()
        .includes(busca)
  );

  // Dos niveles: el área, y adentro cada índice con sus ramas. Se agrupa por
  // lo que viene seguido y no por el nombre suelto, porque el orden es el del
  // diccionario y es parte de cómo se lee.
  const areas = visibles.reduce<
    { area: string; indices: { indice: string; renglones: Renglon[] }[]; cuantas: number }[]
  >((acc, r) => {
    let area = acc[acc.length - 1];
    if (!area || area.area !== r.area) {
      area = { area: r.area, indices: [], cuantas: 0 };
      acc.push(area);
    }
    const indice = area.indices[area.indices.length - 1];
    if (indice && indice.indice === r.indice) indice.renglones.push(r);
    else area.indices.push({ indice: r.indice, renglones: [r] });
    area.cuantas += 1;
    return acc;
  }, []);

  async function mandar(clave: string, valor: unknown): Promise<void> {
    const res = await fetch('/api/os/ajustes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, valor }),
    });
    const r = await res.json();
    if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
  }

  /**
   * Manda los textos y los cortes, cada uno con su clave.
   *
   * Van los dos siempre, aunque uno no haya cambiado: mandar solo lo que se
   * tocó dejaría guardado lo anterior del otro, que es justo lo que "volver a
   * lo de fábrica" tiene que borrar.
   *
   * Sin diferencias se manda null, que borra la clave: guardar un objeto vacío
   * dejaría una fila diciendo "acá hay algo movido" cuando no hay nada.
   */
  async function guardar(deTextos: unknown, deCortes: unknown) {
    const algo = (v: unknown) =>
      v && typeof v === 'object' && Object.keys(v).length > 0 ? v : null;
    setGuardando(true);
    setError(null);
    try {
      await mandar('redacciones_textos', algo(deTextos));
      await mandar('redacciones_cortes', algo(deCortes));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  /**
   * Solo lo que quedó distinto de lo que trae el código.
   *
   * Las casillas vacías se descartan: tres formas donde la segunda está en
   * blanco son dos formas, no tres, y si entrara el informe saldría vacío una
   * de cada tres veces.
   */
  function diferencias() {
    const lleno = (v: string[]) => v.map((x) => x.trim()).filter(Boolean);
    const d: Record<string, Campos4> = {};
    for (const r of renglones) {
      const uno: Campos4 = {};
      const suyo = textos[r.clave];
      for (const cual of ['dice', 'recomienda', 'diceZ', 'recomiendaZ'] as const) {
        const fabrica = r[`${cual}Fabrica` as const];
        if (!igual(lleno(suyo[cual]), lleno(fabrica))) uno[cual] = lleno(suyo[cual]);
      }
      if (uno.dice || uno.recomienda || uno.diceZ || uno.recomiendaZ) d[r.clave] = uno;
    }
    return d;
  }

  /** Los cortes que quedaron distintos del que trae el código, por test. */
  function cortesMovidos() {
    const d: Record<string, number> = {};
    for (const r of renglones) {
      for (const [clave, corte] of [
        [r.clave, r.corte] as const,
        [`zulliger:${r.clave}`, r.corteZ] as const,
      ]) {
        if (!corte) continue;
        const n = numero(clave);
        if (n === null) continue;
        const redondeado = Number(n.toFixed(corte.decimales));
        if (redondeado !== corte.fabrica) d[clave] = redondeado;
      }
    }
    return d;
  }

  function escribirTexto(
    clave: string,
    cual: keyof Campos,
    n: number,
    valor: string
  ) {
    setTextos((t) => {
      const lista = [...t[clave][cual]];
      lista[n] = valor;
      return { ...t, [clave]: { ...t[clave], [cual]: lista } };
    });
  }

  /**
   * Un campo con sus tres formas de decir lo mismo, las tres a la vista.
   *
   * El informe elige una de las tres según el lugar que ocupa el candidato en
   * su pedido, así que las tres pesan igual y se corrigen juntas.
   */
  function campo(r: Renglon, cual: keyof Campos, rotulo: string) {
    const valores = textos[r.clave][cual];

    return (
      <div className="os-redaccion-campo">
        <label className="os-etiqueta-campo" htmlFor={`${cual}-${r.clave}-0`}>
          {rotulo}
        </label>
        {[0, 1, 2].map((n) => (
          <div className="os-variante" key={n}>
            <span className="os-variante-n">{n + 1}</span>
            <textarea
              id={`${cual}-${r.clave}-${n}`}
              className="os-campo"
              rows={1}
              value={valores[n] ?? ''}
              placeholder="Lo mismo, dicho de otra forma"
              onChange={(e) => escribirTexto(r.clave, cual, n, e.target.value)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Cada test tiene su diccionario: sus normas, sus cortes y sus textos.
          El selector va como dos tarjetas y no como una fila de pestañas más,
          porque arriba ya hay una (Baterías, Baremos, Velocímetro,
          Redacciones) y dos filas iguales no dejaban ver cuál manda. */}
      <div className="os-diccionarios" role="radiogroup" aria-label="Test que se está editando">
        {(
          [
            ['Rorschach', 'Diez láminas, cortes de Exner'],
            ['Zulliger', `Tres láminas, ${cortesPropios} cortes propios`],
          ] as const
        ).map(([t, pie]) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={test === t}
            className={`os-diccionario${test === t ? ' os-diccionario-puesto' : ''}`}
            onClick={() => setTest(t)}
          >
            <span className="os-diccionario-marca" aria-hidden="true" />
            <span className="os-diccionario-texto">
              <strong>{t}</strong>
              <small>{pie}</small>
            </span>
          </button>
        ))}
      </div>

      <section className="os-panel" id={ARRIBA}>
        <div className="os-panel-top">
          <h2>Índice</h2>
        </div>
        <div className="os-panel-cuerpo">
          <input
            className="os-campo os-redaccion-buscar"
            type="search"
            value={filtro}
            placeholder="Buscar por índice, área o texto"
            aria-label="Buscar una lectura"
            onChange={(e) => setFiltro(e.target.value)}
          />
          {/* La cuenta sale solo cuando hay algo escrito en el buscador: sin
              filtro son siempre las mismas sesenta y ocho, y el índice ya las
              reparte área por área. Buscando sí hace falta, porque dice cuánto
              quedó de lo que hay. */}
          {busca && (
            <p className="os-form-nota">
              {visibles.length} de {renglones.length} lecturas
            </p>
          )}

          {/* Índice de áreas: son siete y cada una tiene entre cuatro y quince
              lecturas, así que sin esto llegar a la última es bajar a ciegas.
              Van en columnas del mismo ancho, con el nombre contra el borde
              izquierdo y la cuenta contra el derecho, como el índice de un
              libro: en fila y al ancho de cada nombre, las cuentas caían en
              siete lugares distintos y no se podían comparar. */}
          <nav className="os-indice" aria-label="Áreas del diccionario">
            {areas.map((g) => (
              <div key={g.area} className="os-indice-item">
                <a className="os-indice-area" href={`#${anclaDe(g.area)}`}>
                  <span className="os-indice-nombre">
                    <span className="os-numero">{numeroDeArea.get(g.area)}.</span> {g.area}
                  </span>
                  <span className="os-indice-cuenta">{g.cuantas}</span>
                </a>
                {/* Debajo del área, sus índices: llegar a Lambda era bajar al
                    área y después buscarla entre las doce tarjetas. */}
                <div className="os-indice-hijos">
                  {g.indices.map((ind) => (
                    <a
                      key={ind.renglones[0].clave}
                      className="os-indice-hijo"
                      href={`#${anclaDeIndice(ind.renglones[0].clave)}`}
                    >
                      <span>{ind.indice}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </section>

      <div className="os-redacciones" ref={caja}>
        {areas.map((g) => (
          <div key={`${g.area}-${g.indices[0].renglones[0].clave}`}>
            {/* El área es el nivel de arriba y se lee como un capítulo: entre
                una y la siguiente hay hasta quince lecturas, y un rótulo chico
                se perdía entre las tarjetas. Al lado, la vuelta al índice, que
                es lo que se busca después de leer un área entera. */}
            <div className="os-area" id={anclaDe(g.area)}>
              <h2 className="os-area-titulo">
                <span className="os-numero">{numeroDeArea.get(g.area)}.</span> {g.area}
              </h2>
              <span className="os-area-cuenta">
                {g.cuantas} {g.cuantas === 1 ? 'lectura' : 'lecturas'}
              </span>
              <a className="os-area-volver" href={`#${ARRIBA}`}>
                Volver arriba
              </a>
            </div>

            {g.indices.map((ind) => (
              <section
                className="os-panel os-indice-panel"
                key={ind.renglones[0].clave}
                id={anclaDeIndice(ind.renglones[0].clave)}
              >
                {/* El índice manda sobre sus ramas: Lambda por abajo y Lambda
                    por arriba son dos ramas de una decisión sola, y en dos
                    tarjetas obligaban a leer dos veces el mismo encabezado para
                    entender que hablaban del mismo número. */}
                <div className="os-panel-top">
                  <h3 className="os-indice-nombre-titulo">{ind.indice}</h3>
                  {ind.renglones.length > 1 && (
                    <span className="os-indice-ramas">{ind.renglones.length} lecturas</span>
                  )}
                  {/* La vuelta al índice en cada indicador y no solo en el área:
                      con cuarenta y un tarjetas, el que corrige una está casi
                      siempre lejos del encabezado de su área. */}
                  <a className="os-area-volver" href={`#${ARRIBA}`}>
                    Volver arriba
                  </a>
                </div>

                {ind.renglones.map((r) => {
                  // Lo que se marca es lo de la pestaña abierta: en Zulliger,
                  // "reescrita" quiere decir que esa lectura tiene texto propio
                  // de ese test, y no que alguien tocó la del Rorschach.
                  const propio = esZulliger
                    ? !igual(textos[r.clave].diceZ, r.diceZFabrica) ||
                      !igual(textos[r.clave].recomiendaZ, r.recomiendaZFabrica)
                    : !igual(textos[r.clave].dice, r.diceFabrica) ||
                      !igual(textos[r.clave].recomienda, r.recomiendaFabrica);
                  const corte = esZulliger ? r.corteZ : r.corte;
                  const claveCorte = esZulliger ? `zulliger:${r.clave}` : r.clave;
                  const movido = Boolean(corte) && numero(claveCorte) !== corte!.fabrica;
                  return (
                    <div className="os-rama" key={r.clave}>
                      <div className="os-rama-cabeza">
                        {corte ? (
                          <span className="os-lectura-corte">
                            <span className="os-rama-cuando">
                              {corte.op === 'menor' ? 'menos de' : 'más de'}
                            </span>
                            <input
                              className="os-campo os-campo-umbral"
                              type="text"
                              inputMode="decimal"
                              aria-label={`Corte de ${r.indice} en ${test}, ${
                                corte.op === 'menor' ? 'menos de' : 'más de'
                              }`}
                              value={cortes[claveCorte] ?? ''}
                              onChange={(e) =>
                                setCortes((c) => ({ ...c, [claveCorte]: e.target.value }))
                              }
                            />
                            {corte.ademas && (
                              <span className="os-rama-cuando">, {corte.ademas}</span>
                            )}
                          </span>
                        ) : (
                          <span className="os-rama-cuando">{r.cuando}</span>
                        )}
                        <span className="os-lectura-marcas">
                          {movido && (
                            <span
                              className="os-dato-falta"
                              title={`De fábrica: ${escribir(corte!, corte!.fabrica)}`}
                            >
                              corte movido
                            </span>
                          )}
                          {propio && <span className="os-dato-falta">reescrita</span>}
                        </span>
                      </div>

                      {/* Los dos textos, uno al lado del otro: son las dos
                          mitades de la misma lectura, qué significa y qué
                          hacer, y se corrigen mirando una contra la otra. Uno
                          abajo del otro obligaba a subir para comparar. */}
                      <div className="os-redaccion os-redaccion-doble">
                        {campo(r, esZulliger ? 'diceZ' : 'dice', 'Qué dice')}
                        {campo(
                          r,
                          esZulliger ? 'recomiendaZ' : 'recomienda',
                          'Qué se recomienda'
                        )}
                      </div>

                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        ))}
      </div>

      <section className="os-panel">
        <div className="os-panel-cuerpo">
          <p className="os-form-nota">
            Una lectura sin qué dice se rechaza: entraría en el informe con su índice y su
            valor y sin nada que explique qué significa. Dejar la recomendación vacía sí vale,
            y hay lecturas del diccionario que van así.
          </p>
          <p className="os-form-nota">
            El corte que se mueve acá es el mismo que pinta el sumario estructural: un
            indicador queda en verde mientras cae dentro de lo esperado y en rojo cuando lo
            cruza. Las lecturas sin campo entran contra una banda que depende del estilo o de
            la cantidad de respuestas, o contra otro índice, y esas no se mueven.
          </p>

          {tocado && !cambiado && (
            <div className="os-barra-acciones">
              <button
                className="os-boton"
                disabled={guardando}
                onClick={() => guardar(null, null)}
                title="Borra lo guardado y vuelve a los textos y a los cortes del código"
              >
                Volver a los de fábrica
              </button>
            </div>
          )}
          {error && !cambiado && <p className="os-form-error">{error}</p>}
        </div>
      </section>

      {/* Guardar sigue en pantalla mientras haya algo sin guardar.

          Vivía al pie de las sesenta y ocho lecturas: corregir la primera y
          guardarla era bajar la pantalla entera, y el que no bajaba se iba con
          lo escrito sin cargar. Se guarda todo junto igual, porque lo que se
          manda es la diferencia contra el código y no una lectura suelta, pero
          el botón está donde se lo necesita. */}
      {cambiado && (
        <div className="os-guardar-barra">
          <span className="os-guardar-cuenta">
            {rotos.length > 0 ? (
              <span className="os-form-error">
                {rotos.length === 1
                  ? `El corte de ${rotos[0].indice} no es un número.`
                  : `Hay ${rotos.length} cortes que no son un número: ${rotos
                      .map((r) => r.indice)
                      .join(', ')}.`}
              </span>
            ) : error ? (
              <span className="os-form-error">{error}</span>
            ) : (
              `${sinGuardar.length} ${
                sinGuardar.length === 1 ? 'lectura cambiada' : 'lecturas cambiadas'
              }`
            )}
          </span>
          <button
            className="os-boton"
            disabled={guardando}
            onClick={() => {
              setTextos(puestos);
              setCortes(cortesPuestos);
            }}
          >
            Deshacer
          </button>
          <button
            className="os-boton os-boton-azul"
            disabled={guardando || rotos.length > 0}
            onClick={() => guardar(diferencias(), cortesMovidos())}
          >
            {guardando ? 'Guardando…' : 'Guardar los cambios'}
          </button>
        </div>
      )}
    </>
  );
}
