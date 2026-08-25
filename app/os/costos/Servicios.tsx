'use client';

/**
 * Las facturas de los servicios de Campos HR.
 *
 * Viven en Costos y no en Facturación porque son otro trabajo: Facturación es
 * la cola de los psicotécnicos, que sale sola del pipeline y se factura de a
 * varios candidatos por cliente. Un ciclo de encuentros o un trabajo de
 * estructura se factura una vez, con lo que se acordó, y el ingreso es del
 * estudio aunque el comprobante lo emita una de las dos con su CUIT.
 *
 * **Ese ingreso va contra el monotributo de quien la emite**, igual que un
 * psicotécnico: sin poder cargarlas, la cuenta del tope mentía por abajo, que
 * es la forma peligrosa de mentir.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  formatoFecha,
  formatoImporte,
  numeroDe,
  type Emisora,
  type Factura,
} from '@/lib/facturas-tipos';
import { Cobro, BorrarFactura } from '@/app/os/psicotecnicos/facturacion/Facturacion';
import { columnas } from '@/app/os/psicotecnicos/piezas';

/** Las mismas columnas que en Facturación, con el concepto en vez de a quién cubre. */
const COLUMNAS = ['Fecha', 'Número', 'Emisora', 'Cliente', 'Concepto', 'Importe', 'Cobro', ''];
const MEDIDAS = columnas(COLUMNAS, {
  Fecha: 116,
  'Número': 120,
  Emisora: 136,
  Cliente: 150,
  Concepto: 260,
  Cobro: 136,
  '': 96,
});

const hoy = () => new Date().toISOString().slice(0, 10);

async function mandar(cuerpo: unknown) {
  const res = await fetch('/api/os/facturas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({ error: 'Sin respuesta.' }));
  if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar.');
  return datos;
}

/**
 * Lo facturado por servicios, con su cobro.
 *
 * La misma tabla que en Facturación pero sin la columna de a cuántos cubre: un
 * servicio no cubre candidatos, y el concepto es lo que dice qué se facturó.
 */
export function Facturado({ facturas }: { facturas: Factura[] }) {
  if (facturas.length === 0) return null;
  const pendiente = facturas
    .filter((f) => !f.cobradaAt)
    .reduce((n, f) => n + (f.importe ?? 0), 0);

  return (
    <section className="os-panel">
      <div className="os-panel-top">
        <h2>Facturado</h2>
        <span className="os-enlace">
          {pendiente > 0 ? `${formatoImporte(pendiente)} sin cobrar` : 'Todo cobrado'}
        </span>
      </div>
      <div className="os-tabla-marco">
        <table className="os-tabla os-tabla-trabajo os-tabla-fija">
          <colgroup>
            {COLUMNAS.map((c, i) => (
              <col key={c} style={{ width: MEDIDAS[i] }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNAS.map((c) => (
                <th
                  key={c}
                  className={
                    c === '' ? 'os-tabla-accion' : c === 'Importe' ? 'os-tabla-num' : undefined
                  }
                >
                  {c || ' '}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {facturas.map((f) => (
              <tr key={f.id}>
                <td data-campo="Fecha">{formatoFecha(f.fecha)}</td>
                <td className="os-tabla-nombre" data-campo="Número">
                  <a
                    className="os-tabla-enlace"
                    href={`/os/psicotecnicos/facturacion/comprobante/${f.id}`}
                    target="_blank"
                  >
                    {numeroDe(f)}
                  </a>
                </td>
                <td className="os-tabla-recorta" data-campo="Emisora">
                  {f.emisora}
                </td>
                <td className="os-tabla-recorta" data-campo="Cliente">
                  {f.cliente}
                </td>
                <td className="os-tabla-recorta" data-campo="Concepto">
                  {f.concepto ?? 'sin detalle'}
                </td>
                <td className="os-tabla-num" data-campo="Importe">
                  {f.importe === null ? (
                    <span className="os-dato-falta">falta</span>
                  ) : (
                    formatoImporte(f.importe)
                  )}
                </td>
                <td data-campo="Cobro">
                  <Cobro id={f.id} cobradaAt={f.cobradaAt} />
                </td>
                <td className="os-tabla-accion" data-campo=" ">
                  <BorrarFactura id={f.id} numero={numeroDe(f)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function OtraFactura({
  emisoras,
  empresas,
  quien,
}: {
  emisoras: Emisora[];
  empresas: { id: string; nombre: string }[];
  quien: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const propia = emisoras.find((e) => e.nombre.includes(quien) || quien.includes(e.nombre));

  async function emitir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form).entries());
    setEnviando(true);
    setError(null);
    try {
      const r = await mandar({ accion: 'suelta', ...datos });
      setAbierto(false);
      router.refresh();
      if (r?.id) window.open(`/os/psicotecnicos/facturacion/comprobante/${r.id}`, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <div className="os-barra-acciones">
        <button className="os-boton" onClick={() => setAbierto(true)}>
          Cargar otra factura
        </button>
        <span className="os-form-nota">
          Lo que no son psicotécnicos: un ciclo, un trabajo de estructura. Suma al monotributo
          de quien la emite.
        </span>
      </div>
    );
  }

  return (
    <section className="os-panel">
      <div className="os-panel-top">
        <h2>Otra factura</h2>
      </div>
      <form className="os-form os-form-factura os-panel-cuerpo" onSubmit={emitir}>
        <div className="os-form-campos">
          <div className="os-campo-bloque os-tramo-2">
            <label className="os-etiqueta-campo">Quién factura</label>
            <select className="os-campo" name="emisorId" required defaultValue={propia?.id ?? ''}>
              <option value="" disabled>
                Elegir
              </option>
              {emisoras.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="os-campo-bloque os-tramo-2">
            <label className="os-etiqueta-campo">Cliente</label>
            <select className="os-campo" name="empresaId" required defaultValue="">
              <option value="" disabled>
                Elegir
              </option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="os-campo-bloque os-tramo-1">
            <label className="os-etiqueta-campo">Punto de venta</label>
            <input
              className="os-campo"
              name="puntoVenta"
              type="number"
              min="1"
              defaultValue={propia?.puntoVenta ?? ''}
              placeholder="—"
            />
          </div>
          <div className="os-campo-bloque os-tramo-1">
            <label className="os-etiqueta-campo">Número</label>
            <input className="os-campo" name="numero" type="number" min="1" placeholder="590" />
          </div>
          <div className="os-campo-bloque os-tramo-2">
            <label className="os-etiqueta-campo">Fecha</label>
            <input className="os-campo" name="fecha" type="date" required defaultValue={hoy()} />
          </div>
          <div className="os-campo-bloque os-tramo-2">
            <label className="os-etiqueta-campo">Importe</label>
            <input
              className="os-campo"
              name="importe"
              type="number"
              min="1"
              step="0.01"
              required
              placeholder="875000"
            />
          </div>
          <div className="os-campo-bloque os-tramo-4">
            <label className="os-etiqueta-campo">Concepto</label>
            <input
              className="os-campo"
              name="concepto"
              required
              maxLength={200}
              placeholder="Liderazgos Humanos · ciclo de cinco encuentros"
            />
          </div>
          <div className="os-campo-bloque os-tramo-2">
            <label className="os-etiqueta-campo">Orden de compra</label>
            <input
              className="os-campo"
              name="ordenCompra"
              maxLength={60}
              placeholder="Si el cliente la exige"
            />
          </div>
        </div>

        <p className="os-form-nota">
          Todavía no se pide el CAE a ARCA, así que el comprobante sale con la marca de
          muestra.
        </p>

        <div className="os-form-pie">
          <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Generar la factura'}
          </button>
          <button className="os-boton" type="button" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
          {error && <p className="os-form-error">{error}</p>}
        </div>
      </form>
    </section>
  );
}
