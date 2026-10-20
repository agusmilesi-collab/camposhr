'use client';

/**
 * Los precios de los servicios que no son baterías, en una tabla editable.
 *
 * Coaching, entrevista de egreso, devolución y referencias: salen en la página
 * de precios y no tienen historia como las baterías, así que se edita el número
 * y nada más. Se guarda todo junto en `ajustes` (`servicios_precios`); lo que
 * queda igual al de fábrica no se guarda, y "Volver a los de fábrica" borra la
 * clave.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Fila = { clave: string; nombre: string; unidad: string; deFabrica: number; rige: number };

function pesos(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ServiciosPrecios({ filas }: { filas: Fila[] }) {
  const router = useRouter();
  const inicial = () => Object.fromEntries(filas.map((f) => [f.clave, String(f.rige)]));
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  // Lo que manda el servidor después de guardar, comparado por valor: si no,
  // volver a los de fábrica dejaba los números recién borrados en pantalla.
  const huella = filas.map((f) => `${f.clave}=${f.rige}`).join('|');
  useEffect(() => {
    setValores(inicial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella]);

  const cambiado = filas.some((f) => valores[f.clave] !== String(f.rige));
  const movido = filas.some((f) => f.rige !== f.deFabrica);

  async function mandar(valor: Record<string, number> | null) {
    setGuardando(true);
    setError(null);
    setListo(false);
    try {
      const res = await fetch('/api/os/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: 'servicios_precios', valor }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      setListo(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  function guardar() {
    const valor: Record<string, number> = {};
    for (const f of filas) {
      const n = Number(valores[f.clave].replace(/\D/g, ''));
      if (!Number.isInteger(n) || n <= 0) {
        setError(`Falta el precio de ${f.nombre}.`);
        return;
      }
      valor[f.clave] = n;
    }
    mandar(valor);
  }

  return (
    <section className="os-panel os-servicios-precios">
      <div className="os-panel-top">
        <h2>Otros servicios</h2>
      </div>
      <div className="os-panel-cuerpo">
        <p className="os-columna-nota">
          Coaching, entrevistas y referencias, como salen en la página de precios. El cambio se ve
          ahí apenas se guarda.
        </p>
        <table className="os-tabla">
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Unidad</th>
              <th className="os-tabla-num">Precio</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave}>
                <td data-campo="Servicio">{f.nombre}</td>
                <td data-campo="Unidad" className="os-tabla-flojo">
                  {f.unidad}
                </td>
                <td data-campo="Precio" className="os-tabla-num">
                  <input
                    className="os-campo os-servicios-precio"
                    inputMode="numeric"
                    value={valores[f.clave]}
                    onChange={(e) => {
                      setListo(false);
                      setValores((v) => ({ ...v, [f.clave]: e.target.value }));
                    }}
                    aria-label={`Precio de ${f.nombre}`}
                    title={f.rige !== f.deFabrica ? `De fábrica: ${pesos(f.deFabrica)}` : undefined}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p className="os-form-error">{error}</p>}
        <div className="os-servicios-precios-pie">
          {listo && !cambiado && <span className="os-columna-nota">Guardado.</span>}
          {movido && (
            <button
              type="button"
              className="os-boton"
              disabled={guardando}
              onClick={() => mandar(null)}
            >
              Volver a los de fábrica
            </button>
          )}
          <button
            type="button"
            className="os-boton os-boton-firme"
            disabled={guardando || !cambiado}
            onClick={guardar}
          >
            {guardando ? 'Guardando…' : 'Guardar precios'}
          </button>
        </div>
      </div>
    </section>
  );
}
