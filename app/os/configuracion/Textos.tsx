'use client';

/**
 * Los textos del diccionario, editables.
 *
 * **Se guarda la diferencia y no el diccionario entero**, igual que el baremo y
 * los pesos: lo que quedó como estaba no se guarda, así que una corrección que
 * mañana entre en el código le llega a quien no la tocó.
 *
 * **Cada lectura muestra cuándo entra.** El índice y su corte están al lado del
 * texto, porque corregir "más de 4" sin ver que la lectura entra a partir de
 * cinco es escribir algo que no se va a cumplir nunca.
 *
 * Son sesenta y ocho, así que hay un filtro: escribir "Lambda" o "aislamiento"
 * deja a la vista solo esas. El filtro esconde renglones, no los descarta: lo
 * editado en uno que dejó de verse se guarda igual.
 */

import { useRouter } from 'next/navigation';
import { estirar } from '../psicotecnicos/piezas';
import { useMemo, useRef, useState } from 'react';

export type Renglon = {
  clave: string;
  area: string;
  indice: string;
  cuando: string;
  dice: string;
  recomienda: string;
  diceFabrica: string;
  recomiendaFabrica: string;
};

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

  const [textos, setTextos] = useState(puestos);
  const [filtro, setFiltro] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  // Guardar vuelve a dibujar del servidor, pero eso no reinicia el estado de un
  // componente de cliente: sin esto, volver a lo de fábrica dejaba en pantalla
  // los textos que se acababan de borrar.
  const firma = JSON.stringify(puestos);
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setTextos(puestos);
  }

  const cambiado = renglones.some(
    (r) => textos[r.clave].dice !== r.dice || textos[r.clave].recomienda !== r.recomienda
  );

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

  async function mandar(valor: unknown) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: 'redacciones_textos', valor }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
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

  function escribir(clave: string, campo: 'dice' | 'recomienda', valor: string) {
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
        </div>
      </section>

      <div ref={caja}>
        {areas.map((g) => (
          <div key={`${g.area}-${g.renglones[0].clave}`}>
            <p className="os-rotulo-seccion">{g.area}</p>

            {g.renglones.map((r) => {
              const propio =
                textos[r.clave].dice !== r.diceFabrica ||
                textos[r.clave].recomienda !== r.recomiendaFabrica;
              return (
                <section className="os-panel" key={r.clave}>
                  <div className="os-panel-top">
                    <h2>
                      {r.indice} · <span className="os-tabla-flojo">{r.cuando}</span>
                    </h2>
                    {propio && <span className="os-dato-falta">reescrita</span>}
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
                        escribir(r.clave, 'dice', e.target.value);
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
                        escribir(r.clave, 'recomienda', e.target.value);
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

          <div className="os-barra-acciones">
            <button
              className="os-boton os-boton-firme"
              disabled={!cambiado || guardando}
              onClick={() => mandar(diferencias())}
            >
              {guardando ? 'Guardando…' : 'Guardar los textos'}
            </button>
            {cambiado && (
              <button className="os-boton" disabled={guardando} onClick={() => setTextos(puestos)}>
                Deshacer
              </button>
            )}
            {tocado && !cambiado && (
              <button
                className="os-boton"
                disabled={guardando}
                onClick={() => mandar(null)}
                title="Borra lo guardado y vuelve a los textos del código"
              >
                Volver a los de fábrica
              </button>
            )}
          </div>
          {error && <p className="os-form-error">{error}</p>}
        </div>
      </section>
    </>
  );
}
