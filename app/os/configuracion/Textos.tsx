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
 * Son sesenta y ocho, así que hay dos formas de llegar a una: el índice de
 * áreas, que baja a la que corresponda, y el buscador, donde escribir "Lambda"
 * o "aislamiento" deja a la vista solo esas. El filtro esconde renglones, no
 * los descarta: lo editado en uno que dejó de verse se guarda igual.
 */

import { useRouter } from 'next/navigation';
import { estirar } from '../psicotecnicos/piezas';
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

  const busca = filtro.trim().toLowerCase();
  const visibles = renglones.filter(
    (r) =>
      !busca ||
      `${r.area} ${r.indice} ${r.cuando} ${textos[r.clave].dice} ${textos[r.clave].recomienda}`
        .toLowerCase()
        .includes(busca)
  );

  const areas = visibles.reduce<{ area: string; renglones: Renglon[] }[]>((acc, r) => {
    const ultima = acc[acc.length - 1];
    if (ultima && ultima.area === r.area) ultima.renglones.push(r);
    else acc.push({ area: r.area, renglones: [r] });
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
      <section className="os-panel">
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
              lecturas, así que sin esto llegar a la última es bajar a ciegas. */}
          <nav className="os-indice" aria-label="Áreas del diccionario">
            {areas.map((g) => (
              <a key={g.area} className="os-indice-item" href={`#${anclaDe(g.area)}`}>
                {g.area}
                <span className="os-indice-cuenta">{g.renglones.length}</span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div ref={caja}>
        {areas.map((g) => (
          <div key={`${g.area}-${g.renglones[0].clave}`}>
            <h2 className="os-rotulo-seccion os-rotulo-ancla" id={anclaDe(g.area)}>
              {g.area}
              <span className="os-rotulo-cuenta">{g.renglones.length} lecturas</span>
            </h2>

            {g.renglones.map((r) => {
              const propio =
                textos[r.clave].dice !== r.diceFabrica ||
                textos[r.clave].recomienda !== r.recomiendaFabrica;
              const movido = Boolean(r.corte) && numero(r.clave) !== r.corte!.fabrica;
              return (
                <section className="os-panel" key={r.clave}>
                  <div className="os-panel-top">
                    <h3 className="os-lectura-titulo">
                      <span className="os-lectura-indice">{r.indice}</span>
                      {r.corte ? (
                        <span className="os-lectura-corte">
                          <span className="os-tabla-flojo">
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
                            <span className="os-tabla-flojo">, {r.corte.ademas}</span>
                          )}
                        </span>
                      ) : (
                        <span className="os-tabla-flojo">{r.cuando}</span>
                      )}
                    </h3>
                    <span className="os-lectura-marcas">
                      {movido && (
                        <span className="os-dato-falta" title={`De fábrica: ${escribir(r.corte!, r.corte!.fabrica)}`}>
                          corte movido
                        </span>
                      )}
                      {propio && <span className="os-dato-falta">reescrita</span>}
                    </span>
                  </div>

                  <div className="os-panel-cuerpo os-redaccion">
                    <label className="os-etiqueta-campo" htmlFor={`dice-${r.clave}`}>
                      Qué dice
                    </label>
                    <textarea
                      id={`dice-${r.clave}`}
                      className="os-campo"
                      rows={1}
                      value={textos[r.clave].dice}
                      ref={estirar}
                      onChange={(e) => {
                        estirar(e.target);
                        escribirTexto(r.clave, 'dice', e.target.value);
                      }}
                    />

                    <label className="os-etiqueta-campo" htmlFor={`rec-${r.clave}`}>
                      Qué se recomienda
                    </label>
                    <textarea
                      id={`rec-${r.clave}`}
                      className="os-campo"
                      rows={1}
                      value={textos[r.clave].recomienda}
                      placeholder="El diccionario no fija recomendación para esta lectura"
                      ref={estirar}
                      onChange={(e) => {
                        estirar(e.target);
                        escribirTexto(r.clave, 'recomienda', e.target.value);
                      }}
                    />
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
