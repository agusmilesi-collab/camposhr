'use client';

/**
 * Facturar el alquiler del mes, a uno o a todos.
 *
 * Es el mismo comprobante que el de psicotécnicos y la misma forma de trabajar:
 * arriba se tilda quién entra, al costado se elige quién factura y con qué
 * número, y abajo quedan las emitidas, cada una con su comprobante.
 *
 * **Se puede facturar de a uno o todo junto.** Al cerrar el mes son trece
 * facturas a trece CUIT distintos, y hacerlas una por una es trece veces el
 * mismo formulario. Tildadas todas, la numeración corre sola desde el número
 * que se escribe una vez: pedir trece números a mano es donde aparecen los
 * saltos.
 *
 * **Un cargo se factura una sola vez.** El renglón guarda de qué movimiento
 * salió, así el mes ya facturado no vuelve a aparecer en la cola.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { Emisora } from '@/lib/facturas-tipos';
import { pesos } from './acciones';

export type Facturable = {
  id: string;
  nombre: string;
  cuit: string | null;
  total: number;
  cargos: { id: string; fecha: string; importe: number; detalle: string | null }[];
};

export type FacturaEmitida = {
  id: string;
  numero: number | null;
  puntoVenta: number | null;
  fecha: string;
  periodo: string | null;
  inquilino: string;
  emisor: string;
  importe: number | null;
  estado: string;
};

const dia = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a.slice(2)}`;
};

export default function Facturar({
  cola,
  emisoras,
  facturas,
  periodo,
  hoy,
  soloInquilino,
  cargosElegidos,
}: {
  cola: Facturable[];
  emisoras: Emisora[];
  facturas: FacturaEmitida[];
  periodo: string;
  hoy: string;
  /** En la ficha de una persona: solo la suya, sin la lista de los demás. */
  soloInquilino?: string;
  /**
   * Qué cargos entran, tildados en la tabla del resumen.
   *
   * Solo en la ficha de una persona: ahí los renglones están a la vista y se
   * elige uno por uno. En la cola del mes se factura todo lo del período, que
   * es lo que se hace al cerrar.
   */
  cargosElegidos?: string[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();

  const pendientes = soloInquilino ? cola.filter((c) => c.id === soloInquilino) : cola;

  /**
   * Lucila por defecto, porque el alquiler lo factura ella.
   *
   * Se puede cambiar a Lorena en el mismo renglón: son dos monotributos y a
   * veces conviene repartir, sobre todo cerca del tope de la categoría.
   */
  const porDefecto =
    emisoras.find((e) => e.nombre.toLowerCase().includes('lucila'))?.id ?? emisoras[0]?.id ?? '';

  const [emisor, setEmisor] = useState(porDefecto);
  const [fecha, setFecha] = useState(hoy);
  const [numero, setNumero] = useState('');
  const [elegidos, setElegidos] = useState<string[]>(pendientes.map((p) => p.id));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const emisoraElegida = emisoras.find((e) => e.id === emisor) ?? null;
  const entran = pendientes
    .filter((p) => elegidos.includes(p.id))
    .map((p) =>
      cargosElegidos
        ? { ...p, cargos: p.cargos.filter((c) => cargosElegidos.includes(c.id)) }
        : p
    )
    .map((p) => ({ ...p, total: p.cargos.reduce((n, c) => n + c.importe, 0) }))
    .filter((p) => p.cargos.length > 0);
  const total = entran.reduce((n, p) => n + p.total, 0);
  const cuantosCargos = entran.reduce((n, p) => n + p.cargos.length, 0);

  const tildar = (id: string) =>
    setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function facturar() {
    setError(null);
    setHecho(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/os/centro-facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emisorId: emisor,
          periodo,
          fecha,
          numero: numero.trim() === '' ? null : Number(numero),
          puntoVenta: emisoraElegida?.puntoVenta ?? null,
          inquilinos: elegidos,
          cargos: cargosElegidos ?? null,
        }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo facturar.');
        return;
      }
      setHecho(
        r.facturas.length === 1
          ? `Factura emitida a ${r.facturas[0].inquilino}.`
          : `${r.facturas.length} facturas emitidas.`
      );
      setNumero('');
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo facturar.');
    } finally {
      setEnviando(false);
    }
  }

  const Marco = ({ children }: { children: React.ReactNode }) =>
    soloInquilino ? (
      <div className="os-facturar-pie">{children}</div>
    ) : (
      <section className="os-panel">{children}</section>
    );

  return (
    <>
      <Marco>
        {/* El total contra el margen derecho, como en el resumen del mes: es la
            misma cuenta y se lee en la misma columna. */}
        <div className="os-panel-top os-facturar-top">
          <h2>Facturar el mes</h2>
          {pendientes.length === 0 ? (
            <span className="os-panel-cuenta">sin cargos pendientes</span>
          ) : (
            <>
              <span className="os-panel-cuenta">
                {soloInquilino
                  ? `${cuantosCargos} ${cuantosCargos === 1 ? 'cargo tildado' : 'cargos tildados'}`
                  : `${entran.length} de ${pendientes.length}`}
              </span>
              <span className="os-facturar-total">{pesos(total)}</span>
            </>
          )}
        </div>

        {pendientes.length === 0 ? (
          <p className="os-vacio">
            Todo lo que sumó este mes ya está facturado.
          </p>
        ) : (
          <div className={soloInquilino ? undefined : 'os-panel-cuerpo'}>
            {/* Cada factura sale a un CUIT distinto, así que la lista dice a
                nombre de quién va cada una: sin el CUIT a la vista, el error se
                descubre cuando la factura ya salió. */}
            {/* Con una sola persona la fila sobra: los cargos se tildan arriba,
                en la tabla del resumen. */}
            <div className={soloInquilino ? 'os-oculto' : 'os-facturar-lista'}>
              {pendientes.map((p) => (
                <label className="os-facturar-fila" key={p.id}>
                  <input
                    type="checkbox"
                    checked={elegidos.includes(p.id)}
                    onChange={() => tildar(p.id)}
                  />
                  <span className="os-facturar-quien">
                    <b>{p.nombre}</b>
                    <span className="os-dato-falta">
                      {p.cuit ? `CUIT ${p.cuit}` : 'Sin CUIT cargado'} · {p.cargos.length}{' '}
                      {p.cargos.length === 1 ? 'cargo' : 'cargos'}
                    </span>
                  </span>
                  <span className="os-facturar-monto">{pesos(p.total)}</span>
                </label>
              ))}
            </div>

            <div className="os-facturar-datos">
              <label className="os-campo-bloque">
                <span className="os-etiqueta-campo">Factura</span>
                <select
                  className="os-campo"
                  value={emisor}
                  onChange={(e) => setEmisor(e.target.value)}
                >
                  {emisoras.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="os-campo-bloque">
                <span className="os-etiqueta-campo">Fecha</span>
                <input
                  className="os-campo"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </label>

              <label className="os-campo-bloque">
                <span className="os-etiqueta-campo">
                  Número{entran.length > 1 ? ' de la primera' : ''}
                </span>
                <input
                  className="os-campo"
                  type="number"
                  min="1"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Sin número"
                />
              </label>

              <button
                className="os-boton os-boton-firme"
                type="button"
                onClick={facturar}
                disabled={enviando || entran.length === 0}
              >
                {enviando
                  ? 'Facturando…'
                  : entran.length > 1
                    ? `Facturar a ${entran.length}`
                    : 'Facturar'}
              </button>
            </div>

            {entran.length > 1 && numero.trim() !== '' && (
              <p className="os-form-nota">
                Se numeran correlativas desde la {numero}: la última lleva la{' '}
                {Number(numero) + entran.length - 1}.
              </p>
            )}

            {error && <p className="os-form-error">{error}</p>}
            {hecho && <p className="os-form-ok">{hecho}</p>}
          </div>
        )}
      </Marco>

      <Marco>
        <div className="os-panel-top">
          <h2>Facturas emitidas</h2>
          <span className="os-panel-cuenta">{facturas.length}</span>
        </div>
        {facturas.length === 0 ? (
          <p className="os-vacio">Todavía no se emitió ninguna.</p>
        ) : (
          <div className="os-facturar-lista">
            {facturas.map((f) => (
              <div className="os-facturar-fila os-facturar-emitida" key={f.id}>
                <span className="os-facturar-quien">
                  <b>{f.inquilino}</b>
                  <span className="os-dato-falta">
                    {f.periodo ?? '—'} · {f.emisor} ·{' '}
                    {f.numero === null
                      ? 'sin número'
                      : `${String(f.puntoVenta ?? 0).padStart(5, '0')}-${String(f.numero).padStart(8, '0')}`}{' '}
                    · {dia(f.fecha)}
                  </span>
                </span>
                <span className="os-facturar-monto">{f.importe === null ? '—' : pesos(f.importe)}</span>
                <Link
                  className="os-boton"
                  href={`/os/psicotecnicos/facturacion/comprobante/${f.id}`}
                  target="_blank"
                >
                  Comprobante
                </Link>
              </div>
            ))}
          </div>
        )}
      </Marco>
    </>
  );
}
