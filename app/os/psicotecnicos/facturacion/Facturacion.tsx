'use client';

/**
 * La cola de facturación y lo ya emitido.
 *
 * Arriba se tilda qué entra en la factura. La agrupación la decide la
 * evaluadora caso por caso, porque hay clientes a los que les sirve una factura
 * con tres candidatos y otros que las quieren separadas; lo único que el
 * sistema impone es lo que el comprobante no puede mezclar: un solo cliente y
 * una sola orden de compra.
 *
 * Abajo están las emitidas, que ven las dos. Cada una abre su comprobante.
 */

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Bateria from '../Bateria';
import { columnas } from '../piezas';
import { COLOR_ETAPA } from '@/lib/psicotecnicos-tipos';
import { fechaCorta } from '@/lib/hora';
import {
  formatoFecha,
  formatoImporte,
  numeroDe,
  totalDe,
  type Emisora,
  type Facturable,
  type Factura,
} from '@/lib/facturas-tipos';

/**
 * Las columnas, con los anchos que declara `piezas.tsx`.
 *
 * Salen de ahí y no de acá porque es la regla del repositorio: un campo mide lo
 * mismo en todas las tablas del pipeline, así pasar de una sección a otra no
 * mueve nada de lugar. La tilde no tiene columna propia: va con el nombre, que
 * además es lo que se está tildando.
 */
const COLUMNAS = ['Candidato', 'Puesto', 'Batería', 'Entrevista', 'Etapa', 'Importe'];

/**
 * Lo que pide cada columna acá, medido en pantalla sobre el contenido y el
 * rótulo, con unos píxeles de margen para el nombre que sea más largo.
 *
 * Ninguna coincide con su ancho de referencia. El candidato lleva la tilde
 * adelante, que se come el nombre. El puesto va solo, sin la empresa arriba,
 * así que entra entero. La batería lleva el adicional al lado, "B1 + bzg". Y la
 * entrevista es solo la fecha, sin la hora que llevaba en el pipeline.
 */
const PROPIOS = {
  Candidato: 176,
  Puesto: 156,
  'Batería': 96,
  Entrevista: 108,
  Etapa: 112,
  Importe: 130,
};
const MEDIDAS = columnas(COLUMNAS, PROPIOS);

/** Las de lo ya facturado, que miden lo mismo: las dos tablas se apilan. */
const COLUMNAS_EMITIDAS = [
  'Fecha',
  'Número',
  'Emisora',
  'Cliente',
  'Cubre',
  'Importe',
  'Cobro',
  '',
];
/**
 * Lo mismo para la tabla de lo facturado.
 *
 * La fecha va larga, "25/08/2026", y no corta como en Entregados. El cobro no
 * es un sello de dos letras sino el botón que lo marca, con "Cobrada el
 * 24/8/26" adentro. Y el cliente entra entero, que acá es el dato por el que se
 * busca la fila.
 */
const PROPIOS_EMITIDAS = {
  Fecha: 116,
  'Número': 120,
  Emisora: 136,
  Cliente: 160,
  Cubre: 112,
  Cobro: 136,
  /* La columna de la acción mide lo que mide "Quitar", y no los 166 de las
     tablas del pipeline, que llevaban botones de dos palabras. */
  '': 96,
};
const MEDIDAS_EMITIDAS = columnas(COLUMNAS_EMITIDAS, PROPIOS_EMITIDAS);

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

const hoy = () => new Date().toISOString().slice(0, 10);

/** A cuántas personas cubre una factura, sin contar los adicionales. */
const cubre = (f: Factura) => f.renglones.filter((r) => r.evaluacionId !== null).length;

/** Las que están para facturar, agrupadas por cliente. */
export function AFacturar({
  pendientes,
  emisoras,
  quien,
}: {
  pendientes: Facturable[];
  emisoras: Emisora[];
  quien: string;
}) {
  const grupos = useMemo(() => {
    const m = new Map<string, Facturable[]>();
    for (const p of pendientes) {
      const suyas = m.get(p.empresaId);
      if (suyas) suyas.push(p);
      else m.set(p.empresaId, [p]);
    }
    return [...m.entries()].sort((a, b) => a[1][0].cliente.localeCompare(b[1][0].cliente, 'es'));
  }, [pendientes]);

  if (pendientes.length === 0) {
    return (
      <div className="os-panel">
        <p className="os-vacio">
          No hay nada para facturar. Cada evaluación aparece acá en cuanto se toma la entrevista.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="os-rotulo-bloque">Para facturar</div>
      {grupos.map(([empresaId, suyas]) => (
        <GrupoCliente
          key={empresaId}
          empresaId={empresaId}
          pendientes={suyas}
          emisoras={emisoras}
          quien={quien}
        />
      ))}
    </>
  );
}

function GrupoCliente({
  empresaId,
  pendientes,
  emisoras,
  quien,
}: {
  empresaId: string;
  pendientes: Facturable[];
  emisoras: Emisora[];
  quien: string;
}) {
  const router = useRouter();
  const [elegidas, setElegidas] = useState<string[]>(pendientes.map((p) => p.evaluacionId));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  // Quién factura: si quien mira es una de ellas, la suya viene puesta.
  const propia = emisoras.find((e) => e.nombre.includes(quien) || quien.includes(e.nombre));
  const seleccion = pendientes.filter((p) => elegidas.includes(p.evaluacionId));
  const total = seleccion.reduce((n, p) => n + totalDe(p), 0);

  async function emitir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form).entries());
    setEnviando(true);
    setError(null);
    try {
      const r = await mandar({
        accion: 'nueva',
        ...datos,
        empresaId,
        evaluaciones: elegidas,
      });
      setAbierto(false);
      router.refresh();
      if (r?.id) window.open(`/os/psicotecnicos/facturacion/comprobante/${r.id}`, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="os-panel">
      <div className="os-panel-top">
        <h2>{pendientes[0].cliente}</h2>
        <span className="os-enlace">
          {pendientes.length} {pendientes.length === 1 ? 'evaluación' : 'evaluaciones'}
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
              {/* El rótulo de una columna de números va del mismo lado que
                  los números. A la izquierda, el rótulo y su columna quedaban
                  en puntas opuestas y no se leía cuál encabezaba cuál. */}
              {COLUMNAS.map((c) => (
                <th key={c} className={c === 'Importe' ? 'os-tabla-num' : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendientes.map((p) => (
              <tr key={p.evaluacionId}>
                <td data-campo="Candidato">
                  {/* La tilde va con el nombre: es a esa persona a la que se le
                      factura, y una columna aparte para un cuadradito le comía
                      el ancho al puesto. */}
                  <label className="os-tilde-fila">
                    <input
                      type="checkbox"
                      aria-label={`Facturar a ${p.candidato}`}
                      checked={elegidas.includes(p.evaluacionId)}
                      onChange={(ev) =>
                        setElegidas((xs) =>
                          ev.target.checked
                            ? [...xs, p.evaluacionId]
                            : xs.filter((x) => x !== p.evaluacionId)
                        )
                      }
                    />
                    <span className="os-tabla-nombre">{p.candidato}</span>
                  </label>
                </td>
                <td data-campo="Puesto">{p.puesto}</td>
                <td data-campo="Batería">
                  <Bateria codigo={p.bateria} conBenziger={p.conBenziger} />
                </td>
                <td className="os-tabla-flojo" data-campo="Entrevista">
                  {fechaCorta(p.fechaEntrevista) ?? '—'}
                </td>
                <td data-campo="Etapa">
                  <span className={`os-sello-estado ${COLOR_ETAPA[p.etapa] ?? 'os-gris'}`}>
                    {p.etapa}
                  </span>
                </td>
                <td className="os-tabla-num" data-campo="Importe">
                  {p.precio === null ? (
                    <span className="os-dato-falta">sin precio</span>
                  ) : (
                    formatoImporte(totalDe(p))
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="os-resumen-linea">
        <span>
          <span className="os-dato-rotulo">Tildadas</span>
          {seleccion.length} de {pendientes.length}
        </span>
        <span>
          <span className="os-dato-rotulo">Suma</span>
          {formatoImporte(total)}
        </span>
        {seleccion.some((p) => p.benziger !== null) && (
          <span>
            <span className="os-dato-rotulo">Dólar tarjeta</span>${' '}
            {(pendientes.find((p) => p.dolar)?.dolar ?? 0).toLocaleString('es-AR')}
          </span>
        )}
      </div>

      {!abierto ? (
        <div className="os-panel-cuerpo">
          <button
            className="os-boton os-boton-firme"
            disabled={seleccion.length === 0}
            onClick={() => setAbierto(true)}
          >
            {seleccion.length === 0 ? 'Facturar' : `Facturar ${seleccion.length}`}
          </button>
          {seleccion.length === 0 && (
            <p className="os-form-nota">Tildá al menos una evaluación.</p>
          )}
        </div>
      ) : (
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
              <input className="os-campo" name="numero" type="number" min="1" placeholder="589" />
            </div>
            <div className="os-campo-bloque os-tramo-2">
              <label className="os-etiqueta-campo">Fecha</label>
              <input className="os-campo" name="fecha" type="date" required defaultValue={hoy()} />
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
            <div className="os-campo-bloque os-tramo-4">
              <label className="os-etiqueta-campo">Concepto</label>
              <input
                className="os-campo"
                name="concepto"
                maxLength={200}
                placeholder="Evaluaciones psicotécnicas"
              />
            </div>
          </div>

          <p className="os-form-nota">
            El importe sale de las evaluaciones tildadas: {formatoImporte(total)}. Todavía no se
            pide el CAE a ARCA, así que el comprobante sale con la marca de muestra.
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
      )}
    </section>
  );
}

/**
 * Lo ya facturado, que ven las dos, partido por si entró la plata.
 *
 * En una sola lista, lo que falta cobrar quedaba mezclado entre comprobantes
 * viejos ya cobrados y había que recorrer la columna del cobro fila por fila
 * para saber qué reclamar. Arriba lo que está sin cobrar, con su total, que es
 * lo único que pide una acción; abajo lo cobrado, que se consulta.
 */
export function Emitidas({ facturas }: { facturas: Factura[] }) {
  const sinCobrar = facturas.filter((f) => !f.cobradaAt);
  const cobradas = facturas.filter((f) => f.cobradaAt);
  const pendiente = sinCobrar.reduce((n, f) => n + (f.importe ?? 0), 0);

  if (facturas.length === 0) {
    return (
      <>
        <div className="os-rotulo-bloque">Facturado</div>
        <div className="os-panel">
          <p className="os-vacio">
            Todavía no hay ninguna factura. Las 24 de Airtable entran con la migración.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {sinCobrar.length > 0 && (
        <>
          <div className="os-rotulo-bloque">Facturado y sin cobrar</div>
          <div className="os-panel">
            <TablaEmitidas facturas={sinCobrar} />
            <div className="os-resumen-linea">
              <span>
                <span className="os-dato-rotulo">Sin cobrar</span>
                {sinCobrar.length === 1 ? '1 factura' : `${sinCobrar.length} facturas`}
              </span>
              <span>
                <span className="os-dato-rotulo">Suma</span>
                {formatoImporte(pendiente)}
              </span>
            </div>
          </div>
        </>
      )}

      {cobradas.length > 0 && (
        <>
          <div className="os-rotulo-bloque">Cobrado</div>
          <div className="os-panel">
            <TablaEmitidas facturas={cobradas} />
          </div>
        </>
      )}
    </>
  );
}

/** La tabla de comprobantes, que es la misma para los dos bloques. */
function TablaEmitidas({ facturas }: { facturas: Factura[] }) {
  return (
    <div className="os-tabla-marco">
      <table className="os-tabla os-tabla-trabajo os-tabla-fija">
        <colgroup>
          {COLUMNAS_EMITIDAS.map((c, i) => (
            <col key={c} style={{ width: MEDIDAS_EMITIDAS[i] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNAS_EMITIDAS.map((c) => (
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
              <td className="os-tabla-recorta" data-campo="Cubre">
                {/* Se cuentan personas y no renglones: el adicional Benziger es
                    un renglón más de alguien que ya está. */}
                {cubre(f) === 0
                  ? f.concepto ?? 'sin detalle'
                  : `${cubre(f)} ${cubre(f) === 1 ? 'evaluación' : 'evaluaciones'}`}
              </td>
              <td className="os-tabla-num" data-campo="Importe">
                {f.importe === null ? (
                  <span className="os-dato-falta">falta</span>
                ) : (
                  formatoImporte(f.importe, f.moneda === 'DOL' ? 'USD' : 'ARS')
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
  );
}

/** Marcar el cobro, o deshacerlo si se marcó de más. */
function Cobro({ id, cobradaAt }: { id: string; cobradaAt: string | null }) {
  const router = useRouter();
  const [tocando, setTocando] = useState(false);

  async function cambiar(valor: string | null) {
    setTocando(true);
    try {
      await mandar({ accion: 'cobro', id, cobradaAt: valor });
      router.refresh();
    } finally {
      setTocando(false);
    }
  }

  // Los dos estados son el mismo botón, que alterna: cobrada muestra la fecha
  // con su punto verde, sin cobrar invita a marcarla. Un enlace subrayado al
  // lado de un botón se lee como otra cosa y no queda a la misma altura.
  if (cobradaAt) {
    return (
      <button
        className="os-boton os-boton-marcado os-sello-estado os-verde"
        disabled={tocando}
        title="Cobrada. Tocar para volver a dejarla sin cobrar."
        onClick={() => cambiar(null)}
      >
        {formatoFecha(cobradaAt)}
      </button>
    );
  }

  return (
    <button
      className="os-boton os-boton-marcado os-sello-estado os-gris"
      disabled={tocando}
      title="Todavía sin cobrar. Tocar para marcar que entró la plata."
      onClick={() => cambiar(hoy())}
    >
      {tocando ? '…' : 'Sin cobrar'}
    </button>
  );
}

function BorrarFactura({ id, numero }: { id: string; numero: string }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);
  const [seguro, setSeguro] = useState(false);

  if (!seguro) {
    return (
      <button className="os-boton" onClick={() => setSeguro(true)} title={`Quitar la factura ${numero}`}>
        Quitar
      </button>
    );
  }

  return (
    <button
      className="os-boton os-boton-peligro"
      disabled={borrando}
      onClick={async () => {
        setBorrando(true);
        try {
          await mandar({ accion: 'borrar', id });
          router.refresh();
        } finally {
          setBorrando(false);
        }
      }}
    >
      {borrando ? 'Quitando…' : 'Confirmar'}
    </button>
  );
}

