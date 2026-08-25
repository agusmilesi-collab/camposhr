'use client';

/**
 * El baremo del Raven, editable.
 *
 * Los cinco rangos y desde cuántos aciertos empieza cada uno. Mover un corte
 * hacia arriba vuelve el sistema más exigente para ese rango, y hacia abajo más
 * permisivo: es la misma persona con el mismo puntaje cayendo en otro lugar.
 *
 * **Toca dos cosas a la vez y conviene saberlo**: el rango que se nombra en la
 * ficha y en el informe, y el puntaje de habilidad cognitiva, que sale de en qué
 * parte de su rango cayó el puntaje.
 *
 * **Volver a lo de fábrica borra lo guardado**, no copia los valores de hoy: si
 * mañana cambian en el código, quien no tocó nada los recibe.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RAVEN_MAXIMO, type Rango } from '@/lib/raven';

export default function Baremo({
  rangos,
  fabrica,
  tocado,
}: {
  /** Los que rigen ahora. */
  rangos: Rango[];
  /** Los del código, para poder comparar y volver. */
  fabrica: Rango[];
  /** Si alguien los movió: con eso se ofrece volver. */
  tocado: boolean;
}) {
  const router = useRouter();
  const [cortes, setCortes] = useState<Record<string, number>>(
    Object.fromEntries(rangos.map((r) => [r.numeral, r.desde]))
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guardar vuelve a dibujar del servidor, pero eso no reinicia el estado de un
  // componente de cliente: sin esto, volver a los de fábrica dejaba la tabla
  // mostrando los cortes que se acababan de borrar. Se compara por valor y no
  // por identidad porque cada dibujo del servidor manda un arreglo nuevo, y
  // compararlo por identidad borraría lo que se está escribiendo.
  const firma = rangos.map((r) => `${r.numeral}:${r.desde}`).join(' ');
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setCortes(Object.fromEntries(rangos.map((r) => [r.numeral, r.desde])));
  }

  const orden = [...rangos].sort((a, b) => b.desde - a.desde);
  const cambiado = orden.some((r) => cortes[r.numeral] !== r.desde);

  /** Hasta dónde llega cada rango: hasta el que empieza el de arriba, menos uno. */
  function hasta(numeral: string): number {
    const ordenados = [...orden].sort((a, b) => cortes[b.numeral] - cortes[a.numeral]);
    const i = ordenados.findIndex((r) => r.numeral === numeral);
    return i === 0 ? RAVEN_MAXIMO : cortes[ordenados[i - 1].numeral] - 1;
  }

  async function mandar(valor: unknown) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: 'raven_rangos', valor }),
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

  return (
    <section className="os-panel">
      <div className="os-panel-top">
        <h2>Baremo del Raven</h2>
        <span className="os-columna-monto">
          {tocado ? 'Modificado' : 'Los valores de fábrica'}
        </span>
      </div>

      <div className="os-tabla-marco">
        <table className="os-tabla os-tabla-trabajo">
          <thead>
            <tr>
              <th>Rango</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>De fábrica</th>
              <th>Qué tan raro es</th>
            </tr>
          </thead>
          <tbody>
            {orden.map((r) => {
              const suyo = fabrica.find((x) => x.numeral === r.numeral);
              return (
                <tr key={r.numeral}>
                  <td className="os-tabla-nombre">
                    {r.numeral} · {r.nombre}
                  </td>
                  <td>
                    <input
                      className="os-campo os-campo-corte"
                      type="number"
                      min={0}
                      max={RAVEN_MAXIMO}
                      value={cortes[r.numeral]}
                      aria-label={`Desde cuántos aciertos empieza el rango ${r.numeral}`}
                      onChange={(e) =>
                        setCortes((c) => ({ ...c, [r.numeral]: Number(e.target.value) }))
                      }
                    />
                  </td>
                  <td className="os-tabla-flojo">{hasta(r.numeral)}</td>
                  <td className="os-tabla-flojo">
                    {suyo?.desde}
                    {suyo && suyo.desde !== cortes[r.numeral] && (
                      <span className="os-dato-falta"> · movido</span>
                    )}
                  </td>
                  <td className="os-tabla-flojo">{r.frecuencia}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="os-panel-cuerpo">
        <p className="os-form-nota">
          Los aciertos son sobre {RAVEN_MAXIMO} láminas. Subir un corte vuelve ese rango más
          exigente. Cambia el rango que se nombra en el informe y el puntaje de habilidad
          cognitiva, que sale de en qué parte de su rango cayó cada persona.
        </p>

        <div className="os-barra-acciones">
          <button
            className="os-boton os-boton-firme"
            disabled={!cambiado || guardando}
            onClick={() => mandar(orden.map((r) => ({ ...r, desde: cortes[r.numeral] })))}
          >
            {guardando ? 'Guardando…' : 'Guardar los cortes'}
          </button>
          {cambiado && (
            <button
              className="os-boton"
              disabled={guardando}
              onClick={() =>
                setCortes(Object.fromEntries(rangos.map((r) => [r.numeral, r.desde])))
              }
            >
              Deshacer
            </button>
          )}
          {tocado && !cambiado && (
            <button
              className="os-boton"
              disabled={guardando}
              onClick={() => mandar(null)}
              title="Borra lo guardado y vuelve a los valores del código"
            >
              Volver a los de fábrica
            </button>
          )}
        </div>
        {error && <p className="os-form-error">{error}</p>}
      </div>
    </section>
  );
}
