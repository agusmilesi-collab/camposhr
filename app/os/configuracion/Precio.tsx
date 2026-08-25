'use client';

/**
 * El precio de una batería y su actualización.
 *
 * Actualizar no pisa el precio anterior: agrega uno nuevo desde una fecha. Las
 * evaluaciones ya cargadas conservan el que regía cuando entraron, así que un
 * aumento no cambia lo que se cobró en marzo.
 *
 * La fecha arranca en hoy y se puede adelantar: sirve para dejar cargado un
 * aumento que empieza el mes que viene.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { Precio as PrecioFila } from '@/lib/baterias-precios';

function pesos(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

function dia(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${fecha}T12:00:00`));
}

export default function Precio({
  bateriaId,
  vigente,
  proximo,
  historia,
  dolar,
  fechaDolar,
  benzigerUsd,
}: {
  bateriaId: string;
  vigente: number | null;
  proximo: PrecioFila | null;
  historia: PrecioFila[];
  /** Dólar tarjeta, para mostrar el equivalente. Null si la API no contestó. */
  dolar: number | null;
  fechaDolar: string | null;
  /** Lo que suma el Benziger, para mostrar el total con el adicional. */
  benzigerUsd: number;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fecha = useRef<HTMLInputElement>(null);

  // La fecha arranca en hoy, calculada del lado del navegador: el servidor
  // corre en otro huso y a la tarde propondría el día siguiente.
  useEffect(() => {
    if (abierto && fecha.current && !fecha.current.value) {
      const d = new Date();
      const dd = (n: number) => String(n).padStart(2, '0');
      fecha.current.value = `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
    }
  }, [abierto]);

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/os/precios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bateriaId,
          precio: Number(datos.get('precio')),
          desde: String(datos.get('desde') ?? ''),
        }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      setAbierto(false);
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  const anteriores = historia.filter((p) => !proximo || p.id !== proximo.id).slice(0, 4);

  return (
    <div className="os-precio">
      <div className="os-precio-top">
        <span className="os-precio-valor">
          {vigente === null ? 'sin precio' : pesos(vigente)}
          {vigente !== null && dolar && (
            <span className="os-precio-cambio">
              USD {Math.round(vigente / dolar).toLocaleString('es-AR')}
            </span>
          )}
        </span>
        <button
          type="button"
          className="os-boton os-precio-cambiar"
          onClick={() => setAbierto((v) => !v)}
        >
          {abierto ? 'Cancelar' : 'Actualizar'}
        </button>
      </div>

      {vigente !== null && dolar && (
        <p className="os-precio-total">
          <span className="os-dato-rotulo">Con Benziger</span>
          {pesos(vigente + benzigerUsd * dolar)}
          <span className="os-precio-cambio">
            USD {Math.round(vigente / dolar + benzigerUsd).toLocaleString('es-AR')}
          </span>
        </p>
      )}

      {dolar && (
        <p className="os-precio-cotizacion">
          Dólar tarjeta {pesos(dolar)}
          {fechaDolar
            ? ` · ${new Intl.DateTimeFormat('es-AR', {
                day: 'numeric',
                month: 'long',
              }).format(new Date(fechaDolar))}`
            : ''}
        </p>
      )}

      {proximo && (
        <p className="os-precio-proximo">
          Desde el {dia(proximo.desde)}: {pesos(Number(proximo.precio))}
        </p>
      )}

      {abierto && (
        <form className="os-precio-form" onSubmit={guardar}>
          <label className="os-campo-bloque">
            <span className="os-etiqueta-campo">Nuevo precio</span>
            <input
              className="os-campo"
              name="precio"
              type="number"
              min="0"
              step="10"
              required
              defaultValue={vigente ?? ''}
            />
          </label>
          <label className="os-campo-bloque">
            <span className="os-etiqueta-campo">Rige desde</span>
            <input ref={fecha} className="os-campo" name="desde" type="date" required />
          </label>
          <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
          <p className="os-precio-nota">
            Las evaluaciones que ya entraron conservan el precio anterior.
          </p>
        </form>
      )}

      {error && <p className="os-form-error">{error}</p>}

      {anteriores.length > 1 && (
        <details className="os-precio-historia">
          <summary>Historia</summary>
          {anteriores.map((p) => (
            <div className="os-precio-fila" key={p.id}>
              <span>{pesos(Number(p.precio))}</span>
              <span className="os-dato-falta">
                desde {dia(p.desde)}
                {p.quien ? ` · ${p.quien}` : ''}
              </span>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
