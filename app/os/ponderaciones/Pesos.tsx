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

const COLUMNAS = ['Indicador', 'Qué mide', 'Dónde corta', 'Peso', 'Aporte'];

/* Medidos en pantalla contra el contenido más largo de cada columna, más los 28
   px de padding de la celda. Sin anchos declarados, cada competencia repartía
   los suyos según lo que le tocó y la misma columna caía en otro lugar en cada
   panel: nueve tablas de lo mismo y ninguna alineada con la anterior.

   Las dos últimas las manda el rótulo y no el contenido: "Aporte" con 72 px
   salía cortado en "APO…" arriba de un número de cuatro caracteres. Lo que se
   recorta es "Qué mide", que repite lo que el nombre del indicador ya dice. */
const MEDIDAS = columnas(COLUMNAS, {
  Indicador: 190,
  'Qué mide': 340,
  'Dónde corta': 555,
  Peso: 78,
  Aporte: 86,
});

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

  const cambiado = Object.keys(puestos).some((k) => pesos[k] !== puestos[k]);

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
      {hojas.map((h) => (
        <div key={h.test}>
          <p className="os-rotulo-seccion">{h.test}</p>

          {h.competencias.map((c) => {
            const total = c.indicadores.reduce((n, i) => n + (pesos[i.clave] ?? 0), 0);
            return (
              <section className="os-panel" key={`${h.test}-${c.nombre}`}>
                <div className="os-panel-top">
                  <h2>{c.nombre}</h2>
                  <span className="os-columna-monto">{c.mide}</span>
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
                      {c.indicadores.map((i) => {
                        const peso = pesos[i.clave] ?? 0;
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
                              <input
                                className="os-campo os-campo-corte"
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
                                <span className="os-dato-falta"> de {i.fabrica}</span>
                              )}
                            </td>
                            <td className="os-tabla-num os-tabla-flojo" data-campo="Aporte">
                              {total === 0 ? '—' : `${Math.round((peso / total) * 100)} %`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      ))}

      <section className="os-panel">
        <div className="os-panel-cuerpo">
          <p className="os-form-nota">
            El aporte es la parte del puntaje de la competencia que se lleva cada indicador. Un
            indicador en cero sigue apareciendo en el detalle del informe y no entra al
            promedio; una competencia entera en cero se rechaza, porque saldría sin puntaje en
            todos los informes.
          </p>

          <div className="os-barra-acciones">
            <button
              className="os-boton os-boton-firme"
              disabled={!cambiado || guardando}
              onClick={() => mandar(diferencias())}
            >
              {guardando ? 'Guardando…' : 'Guardar los pesos'}
            </button>
            {cambiado && (
              <button className="os-boton" disabled={guardando} onClick={() => setPesos(puestos)}>
                Deshacer
              </button>
            )}
            {tocado && !cambiado && (
              <button
                className="os-boton"
                disabled={guardando}
                onClick={() => mandar(null)}
                title="Borra lo guardado y vuelve a los pesos del código"
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
