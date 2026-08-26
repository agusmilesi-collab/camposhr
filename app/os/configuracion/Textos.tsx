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
import { useEffect, useMemo, useRef, useState } from 'react';

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

export type Renglon = {
  clave: string;
  area: string;
  indice: string;
  cuando: string;
  dice: string;
  recomienda: string;
  diceFabrica: string;
  recomiendaFabrica: string;
  corte: Corte | null;
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
function estirarCampo(caja: HTMLTextAreaElement | null): void {
  if (!caja) return;
  const antes = caja.style.minHeight;
  caja.style.minHeight = '0';
  caja.style.height = 'auto';
  const alto = caja.scrollHeight + (caja.offsetHeight - caja.clientHeight);
  caja.style.height = '';
  caja.style.minHeight = alto > 0 ? `${alto}px` : antes;
}

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

  const puestos = useMemo(
    () =>
      Object.fromEntries(
        renglones.map((r) => [r.clave, { dice: r.dice, recomienda: r.recomienda }])
      ),
    [renglones]
  );

  // El corte se guarda como el texto del campo y no como número: mientras
  // alguien escribe "0," el valor todavía no es un número, y convertirlo en
  // cada tecla le borraría la coma que acaba de escribir.
  const cortesPuestos = useMemo(
    () =>
      Object.fromEntries(
        renglones.filter((r) => r.corte).map((r) => [r.clave, escribir(r.corte!, r.corte!.valor)])
      ),
    [renglones]
  );

  const [textos, setTextos] = useState(puestos);
  const [cortes, setCortes] = useState(cortesPuestos);
  const [filtro, setFiltro] = useState('');
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

  const cambiado =
    renglones.some(
      (r) => textos[r.clave].dice !== r.dice || textos[r.clave].recomienda !== r.recomienda
    ) || renglones.some((r) => r.corte && cortes[r.clave] !== cortesPuestos[r.clave]);

  /** Lo escrito en un campo de corte, ya como número; null si todavía no lo es. */
  function numero(clave: string): number | null {
    const crudo = (cortes[clave] ?? '').replace(',', '.').trim();
    if (!crudo || crudo === '-' || crudo === '−') return null;
    const n = Number(crudo.replace('−', '-'));
    return Number.isFinite(n) ? n : null;
  }

  const rotos = renglones.filter((r) => r.corte && numero(r.clave) === null);

  // Los campos crecen con lo que tienen escrito, y esa altura se calcula una
  // vez, al dibujarlos. Al angostar la ventana el mismo texto pasa a ocupar más
  // renglones y la altura vieja lo cortaba: acá se vuelve a medir.
  useEffect(() => {
    const alRedimensionar = () => {
      caja.current?.querySelectorAll('textarea').forEach((t) => estirarCampo(t));
    };
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, []);

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

  /** Solo lo que quedó distinto de lo que trae el código. */
  function diferencias() {
    const d: Record<string, { dice?: string; recomienda?: string }> = {};
    for (const r of renglones) {
      const uno: { dice?: string; recomienda?: string } = {};
      if (textos[r.clave].dice !== r.diceFabrica) uno.dice = textos[r.clave].dice;
      if (textos[r.clave].recomienda !== r.recomiendaFabrica)
        uno.recomienda = textos[r.clave].recomienda;
      if (uno.dice !== undefined || uno.recomienda !== undefined) d[r.clave] = uno;
    }
    return d;
  }

  /** Los cortes que quedaron distintos del que trae el código. */
  function cortesMovidos() {
    const d: Record<string, number> = {};
    for (const r of renglones) {
      if (!r.corte) continue;
      const n = numero(r.clave);
      if (n === null) continue;
      const redondeado = Number(n.toFixed(r.corte.decimales));
      if (redondeado !== r.corte.fabrica) d[r.clave] = redondeado;
    }
    return d;
  }

  function escribirTexto(clave: string, campo: 'dice' | 'recomienda', valor: string) {
    setTextos((t) => ({ ...t, [clave]: { ...t[clave], [campo]: valor } }));
  }

  return (
    <>
      <section className="os-panel" id={ARRIBA}>
        <div className="os-panel-cuerpo">
          <input
            className="os-campo os-redaccion-buscar"
            type="search"
            value={filtro}
            placeholder="Buscar por índice, área o texto"
            aria-label="Buscar una lectura"
            onChange={(e) => setFiltro(e.target.value)}
          />
          <p className="os-form-nota">
            {visibles.length === renglones.length
              ? `${renglones.length} lecturas`
              : `${visibles.length} de ${renglones.length} lecturas`}
          </p>

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
                  <span className="os-indice-nombre">{g.area}</span>
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
                      {ind.indice}
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
              <h2 className="os-area-titulo">{g.area}</h2>
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
                </div>

                {ind.renglones.map((r) => {
                  const propio =
                    textos[r.clave].dice !== r.diceFabrica ||
                    textos[r.clave].recomienda !== r.recomiendaFabrica;
                  const movido = Boolean(r.corte) && numero(r.clave) !== r.corte!.fabrica;
                  return (
                    <div className="os-rama" key={r.clave}>
                      <div className="os-rama-cabeza">
                        {r.corte ? (
                          <span className="os-lectura-corte">
                            <span className="os-rama-cuando">
                              {r.corte.op === 'menor' ? 'menos de' : 'más de'}
                            </span>
                            <input
                              className="os-campo os-campo-umbral"
                              type="text"
                              inputMode="decimal"
                              aria-label={`Corte de ${r.indice}, ${
                                r.corte.op === 'menor' ? 'menos de' : 'más de'
                              }`}
                              value={cortes[r.clave] ?? ''}
                              onChange={(e) =>
                                setCortes((c) => ({ ...c, [r.clave]: e.target.value }))
                              }
                            />
                            {r.corte.ademas && (
                              <span className="os-rama-cuando">, {r.corte.ademas}</span>
                            )}
                          </span>
                        ) : (
                          <span className="os-rama-cuando">{r.cuando}</span>
                        )}
                        <span className="os-lectura-marcas">
                          {movido && (
                            <span
                              className="os-dato-falta"
                              title={`De fábrica: ${escribir(r.corte!, r.corte!.fabrica)}`}
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
                        <div className="os-redaccion-campo">
                          <label className="os-etiqueta-campo" htmlFor={`dice-${r.clave}`}>
                            Qué dice
                          </label>
                          <textarea
                            id={`dice-${r.clave}`}
                            className="os-campo"
                            rows={1}
                            value={textos[r.clave].dice}
                            ref={estirarCampo}
                            onChange={(e) => {
                              estirarCampo(e.target);
                              escribirTexto(r.clave, 'dice', e.target.value);
                            }}
                          />
                        </div>

                        <div className="os-redaccion-campo">
                          <label className="os-etiqueta-campo" htmlFor={`rec-${r.clave}`}>
                            Qué se recomienda
                          </label>
                          <textarea
                            id={`rec-${r.clave}`}
                            className="os-campo"
                            rows={1}
                            value={textos[r.clave].recomienda}
                            placeholder="El diccionario no fija recomendación para esta lectura"
                            ref={estirarCampo}
                            onChange={(e) => {
                              estirarCampo(e.target);
                              escribirTexto(r.clave, 'recomienda', e.target.value);
                            }}
                          />
                        </div>
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

          <div className="os-barra-acciones">
            <button
              className="os-boton os-boton-firme"
              disabled={!cambiado || guardando || rotos.length > 0}
              onClick={() => guardar(diferencias(), cortesMovidos())}
            >
              {guardando ? 'Guardando…' : 'Guardar los cambios'}
            </button>
            {cambiado && (
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
            )}
            {tocado && !cambiado && (
              <button
                className="os-boton"
                disabled={guardando}
                onClick={() => guardar(null, null)}
                title="Borra lo guardado y vuelve a los textos y a los cortes del código"
              >
                Volver a los de fábrica
              </button>
            )}
          </div>
          {rotos.length > 0 && (
            <p className="os-form-error">
              {rotos.length === 1
                ? `El corte de ${rotos[0].indice} no es un número.`
                : `Hay ${rotos.length} cortes que no son un número: ${rotos
                    .map((r) => r.indice)
                    .join(', ')}.`}
            </p>
          )}
          {error && <p className="os-form-error">{error}</p>}
        </div>
      </section>
    </>
  );
}
