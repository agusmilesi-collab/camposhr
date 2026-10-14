'use client';

/**
 * Los precios acordados con este cliente.
 *
 * Existen por las licitaciones: Lorena presentó precios en Cofco y se
 * respetan el plazo que fija la licitación, aunque la lista general suba en
 * el medio. Mientras rige un acuerdo, la orden de compra, la cola de
 * facturación, la factura y el portal del cliente usan ese precio; vencido,
 * el cliente vuelve solo a la lista general.
 *
 * Cada concepto (las baterías y el adicional Benziger) muestra qué paga hoy
 * este cliente y de dónde sale. El Benziger de la lista va en dólares al
 * dólar tarjeta; acordado, va en pesos y deja de depender del dólar.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Acuerdo } from '@/lib/baterias-precios';

export type ConceptoDePrecio = {
  /** Null para el adicional Benziger. */
  bateriaId: string | null;
  nombre: string;
  /** Lo que paga hoy quien no tiene acuerdo. Para el Benziger, en dólares. */
  lista: number | null;
  listaEnDolares: boolean;
};

function pesos(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

function dia(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${fecha}T12:00:00`)
  );
}

function vigencia(a: Acuerdo): string {
  return a.hasta ? `${dia(a.desde)} al ${dia(a.hasta)}` : `desde el ${dia(a.desde)}, sin fin`;
}

function estadoDe(a: Acuerdo, hoy: string): 'rige' | 'vencido' | 'futuro' {
  if (a.desde > hoy) return 'futuro';
  if (a.hasta !== null && a.hasta < hoy) return 'vencido';
  return 'rige';
}

export default function PreciosAcordados({
  empresaId,
  conceptos,
  acuerdos,
  hoy,
}: {
  empresaId: string;
  conceptos: ConceptoDePrecio[];
  acuerdos: Acuerdo[];
  /** El día de hoy en Argentina, calculado en el servidor. */
  hoy: string;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vigentes = conceptos.map((c) => ({
    concepto: c,
    acuerdo:
      acuerdos
        .filter((a) => (a.bateria_id ?? null) === c.bateriaId && estadoDe(a, hoy) === 'rige')
        .sort((a, b) => b.desde.localeCompare(a.desde))[0] ?? null,
  }));
  const hayAcuerdo = vigentes.some((v) => v.acuerdo);
  const nombreDe = (bateriaId: string | null) =>
    conceptos.find((c) => c.bateriaId === bateriaId)?.nombre ?? 'Batería';

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const concepto = String(datos.get('concepto') ?? '');
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/os/precios-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresaId,
          bateriaId: concepto === 'benziger' ? null : concepto,
          precio: Number(datos.get('precio')),
          desde: String(datos.get('desde') ?? ''),
          hasta: String(datos.get('hasta') ?? '') || null,
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

  async function quitar(a: Acuerdo) {
    if (!window.confirm(`¿Sacar el precio acordado de ${nombreDe(a.bateria_id)} (${vigencia(a)})?`)) {
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/os/precios-cliente', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo sacar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo sacar.');
    }
  }

  return (
    <section className="os-panel">
      <div className="os-panel-top os-cliente-subtitulo os-empresa-top">
        <h2>Precios acordados</h2>
        <button className="os-boton" type="button" onClick={() => setAbierto((v) => !v)}>
          {abierto ? 'Cancelar' : 'Acordar precio'}
        </button>
      </div>

      <div className="os-panel-cuerpo">
        <p className="os-acuerdos-nota">
          {hayAcuerdo
            ? 'Mientras rige un acuerdo, la orden de compra, la factura y el portal usan ese precio. Vencido, el cliente vuelve solo a la lista general.'
            : 'Este cliente paga la lista general. Un precio acordado (una licitación) la pisa mientras rige, y al vencer vuelve solo a la lista.'}
        </p>

        <table className="os-tabla os-acuerdos">
          <thead>
            <tr>
              <th>Concepto</th>
              <th className="os-tabla-num">Lista general</th>
              <th className="os-tabla-num">Este cliente</th>
              <th>Vigencia</th>
            </tr>
          </thead>
          <tbody>
            {vigentes.map(({ concepto, acuerdo }) => (
              <tr key={concepto.bateriaId ?? 'benziger'}>
                <td>{concepto.nombre}</td>
                <td className="os-tabla-num os-acuerdos-lista">
                  {concepto.lista === null
                    ? 'sin precio'
                    : concepto.listaEnDolares
                      ? `USD ${concepto.lista}`
                      : pesos(concepto.lista)}
                </td>
                <td className="os-tabla-num">
                  {acuerdo ? (
                    <strong>{pesos(Number(acuerdo.precio))}</strong>
                  ) : (
                    <span className="os-dato-falta">lista general</span>
                  )}
                </td>
                <td>
                  {acuerdo ? (
                    <span className="os-acuerdos-vigencia">
                      {vigencia(acuerdo)}
                      {acuerdo.quien ? ` · ${acuerdo.quien}` : ''}
                    </span>
                  ) : (
                    <span className="os-dato-falta">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {abierto && (
          <form className="os-acuerdos-form" onSubmit={guardar}>
            <label className="os-campo-bloque">
              <span className="os-etiqueta-campo">Concepto</span>
              <select className="os-campo" name="concepto" required defaultValue={conceptos[0]?.bateriaId ?? 'benziger'}>
                {conceptos.map((c) => (
                  <option key={c.bateriaId ?? 'benziger'} value={c.bateriaId ?? 'benziger'}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="os-campo-bloque">
              <span className="os-etiqueta-campo">Precio en pesos</span>
              <input className="os-campo" name="precio" type="number" min="0" step="10" required />
            </label>
            <label className="os-campo-bloque">
              <span className="os-etiqueta-campo">Rige desde</span>
              <input className="os-campo" name="desde" type="date" required defaultValue={hoy} />
            </label>
            <label className="os-campo-bloque">
              <span className="os-etiqueta-campo">Hasta (incluido)</span>
              <input className="os-campo" name="hasta" type="date" />
            </label>
            <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar'}
            </button>
            <p className="os-precio-nota">
              Sin fecha de fin, rige hasta que se cargue otro o se saque. Los candidatos ya
              cargados antes del inicio conservan el precio que tenían.
            </p>
          </form>
        )}

        {error && <p className="os-form-error">{error}</p>}

        {acuerdos.length > 0 && (
          <details className="os-precio-historia">
            <summary>Todos los acuerdos ({acuerdos.length})</summary>
            {acuerdos.map((a) => {
              const estado = estadoDe(a, hoy);
              return (
                <div className="os-precio-fila" key={a.id}>
                  <span>
                    {nombreDe(a.bateria_id)} · {pesos(Number(a.precio))}
                  </span>
                  <span className="os-dato-falta">
                    {vigencia(a)}
                    {estado === 'vencido' ? ' · vencido' : estado === 'futuro' ? ' · todavía no rige' : ''}
                    {a.quien ? ` · ${a.quien}` : ''}
                  </span>
                  <button type="button" className="os-enlace-boton" onClick={() => quitar(a)}>
                    Sacar
                  </button>
                </div>
              );
            })}
          </details>
        )}
      </div>
    </section>
  );
}
