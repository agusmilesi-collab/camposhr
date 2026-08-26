'use client';

/**
 * Los pesos de los indicadores, editables.
 *
 * **Se guarda la diferencia y no la tabla entera**: lo que quedó en su valor de
 * fábrica no se guarda, así que un peso que mañana cambie en el código le llega
 * a quien no lo tocó.
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

const MAXIMO = 5;

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

const COLUMNAS = ['Indicador', 'Qué mide', 'Dónde corta', 'Peso', 'Aporte'];

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
  Indicador: 190,
  'Qué mide': 300,
  'Dónde corta': 415,
  Peso: 120,
  Aporte: 135,
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

export type Hoja = {
  test: string;
  competencias: {
    nombre: string;
    mide: string;
    indicadores: {
      clave: string;
      nombre: string;
      mide: string;
      corte: string;
      peso: number;
      fabrica: number;
    }[];
  }[];
};

export default function Pesos({ hojas, tocado }: { hojas: Hoja[]; tocado: boolean }) {
  const router = useRouter();

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

  const [pesos, setPesos] = useState<Record<string, number>>(puestos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guardar vuelve a dibujar del servidor, pero eso no reinicia el estado de un
  // componente de cliente: sin esto, volver a los de fábrica dejaba la tabla
  // mostrando los pesos que se acababan de borrar. Se compara por valor y no por
  // identidad porque cada dibujo del servidor manda un objeto nuevo, y compararlo
  // por identidad borraría lo que se está escribiendo.
  const firma = JSON.stringify(puestos);
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setPesos(puestos);
  }

  const sinGuardar = Object.keys(puestos).filter((k) => pesos[k] !== puestos[k]);
  const cambiado = sinGuardar.length > 0;

  async function mandar(valor: unknown) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: 'competencias_pesos', valor }),
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

  /** Solo lo que se movió de su valor de fábrica. */
  function diferencias(): Record<string, number> {
    const d: Record<string, number> = {};
    for (const [k, v] of Object.entries(pesos)) if (v !== fabrica[k]) d[k] = v;
    return d;
  }

  return (
    <>
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
                    <thead>
                      <tr>
                        <th>Indicador</th>
                        <th>Qué mide</th>
                        <th>Dónde corta</th>
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
                            <td className="os-tabla-flojo" data-campo="Dónde corta">
                              {i.corte}
                            </td>
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
                        <td colSpan={3}>Suma de la competencia</td>
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

          {tocado && !cambiado && (
            <div className="os-barra-acciones">
              <button
                className="os-boton"
                disabled={guardando}
                onClick={() => mandar(null)}
                title="Borra lo guardado y vuelve a los pesos del código"
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
          diferencia contra el código y no un peso suelto. */}
      {cambiado && (
        <div className="os-guardar-barra">
          <span className="os-guardar-cuenta">
            {error ? (
              <span className="os-form-error">{error}</span>
            ) : (
              `${sinGuardar.length} ${
                sinGuardar.length === 1 ? 'peso movido' : 'pesos movidos'
              }`
            )}
          </span>
          <button className="os-boton" disabled={guardando} onClick={() => setPesos(puestos)}>
            Deshacer
          </button>
          <button
            className="os-boton os-boton-azul"
            disabled={guardando}
            onClick={() => mandar(diferencias())}
          >
            {guardando ? 'Guardando…' : 'Guardar los pesos'}
          </button>
        </div>
      )}
    </>
  );
}
