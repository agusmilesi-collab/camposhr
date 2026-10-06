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
import { enumerar, faltaParaEmitir, faltaParaFacturarle, leyendaIva } from '@/lib/clientes-tipos';
import { fechaCorta, hoyIso } from '@/lib/hora';
import {
  formatoFecha,
  formatoImporte,
  conceptoPorDefecto,
  numeroDe,
  totalDe,
  type Emisora,
  type Facturable,
  type Factura,
  type Fiscal,
} from '@/lib/facturas-tipos';

/**
 * Las columnas, con los anchos que declara `piezas.tsx`.
 *
 * Salen de ahí y no de acá porque es la regla del repositorio: un campo mide lo
 * mismo en todas las tablas del pipeline, así pasar de una sección a otra no
 * mueve nada de lugar. La tilde no tiene columna propia: va con el nombre, que
 * además es lo que se está tildando.
 */
const COLUMNAS = ['Candidato', 'Puesto', 'Batería', 'Entrevista', 'Etapa', 'Orden', 'Importe'];

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
  /* El número de la orden de compra, "#0004". */
  Orden: 84,
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
  /* "05/10/26", entera aun con la pantalla angosta. */
  Fecha: 96,
  'Número': 106,
  /* Solo el nombre: son dos, y el apellido es el mismo. */
  Emisora: 90,
  /* El cliente se queda con lo que soltaron la emisora y el hueco que había
     entre "Cubre" y el importe. */
  Cliente: 112,
  /* Entra "6 evaluaciones" con el chevron al lado. */
  Cubre: 150,
  Importe: 132,
  /* Entran "Marcar como cobrado", la fecha con el botón del recibo al lado, o
     "Sí, cobrada" con "No". */
  Cobro: 174,
  /* Entran "Emitir NC" y, al lado, el ícono de quitar. */
  '': 124,
};
const MEDIDAS_EMITIDAS = columnas(COLUMNAS_EMITIDAS, PROPIOS_EMITIDAS);
/* En Cobrado la celda del cobro lleva la fecha y el ícono del recibo, que
   piden menos que "Marcar como cobrado". Lo que sobra va al número, que ahí
   suele ser una orden de compra, y al cliente. */
const MEDIDAS_COBRADAS = columnas(COLUMNAS_EMITIDAS, {
  ...PROPIOS_EMITIDAS,
  'Número': 104,
  Emisora: 88,
  Cliente: 120,
  Cubre: 150,
  Importe: 134,
  Cobro: 168,
});

/** Las de las anuladas: la factura, y la nota de crédito que la anuló. */
const COLUMNAS_ANULADAS = ['Fecha', 'Factura', 'Emisora', 'Cliente', 'Importe', 'Nota de crédito', 'Anulada el'];
const MEDIDAS_ANULADAS = columnas(COLUMNAS_ANULADAS, {
  Fecha: 116,
  Factura: 130,
  Emisora: 140,
  Cliente: 180,
  Importe: 134,
  'Nota de crédito': 150,
  'Anulada el': 120,
});


/**
 * Dónde empieza la columna que se abre.
 *
 * El detalle no cuelga del borde de la tabla sino de "Cubre": las celdas vacías
 * de antes le dan a la fila de abajo el mismo ancho de columna, y el árbol
 * arranca justo debajo del botón que lo abrió.
 */
const ANTES_DE_CUBRE = COLUMNAS_EMITIDAS.indexOf('Cubre');

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

const hoy = hoyIso;

/** "Lorena" de "Lorena Campos". Lo que no es un nombre va como está. */
function nombreDe(emisora: string): string {
  return emisora.startsWith('sin ') ? emisora : emisora.split(' ')[0];
}

/** "05/10/26": la fecha entera en el menor ancho, para las tablas. */
function fechaBreve(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : '—';
}

/** A cuántas personas cubre una factura, sin contar los adicionales. */
const cubre = (f: Factura) => f.renglones.filter((r) => r.evaluacionId !== null).length;

/**
 * Cuánto se cobró por un renglón.
 *
 * Las facturas que emite el OS guardan el importe de cada renglón. Las 24 que
 * vinieron de Airtable traen el total de la factura y nada adentro: cuando ese
 * total cubre un solo renglón, es el importe de ese renglón y se muestra. Con
 * dos o más no hay forma de repartirlo, y ahí el renglón va sin cifra en vez de
 * mostrar una inventada.
 */
function importeDe(f: Factura, r: Factura['renglones'][number]): number | null {
  if (r.importe !== null) return r.importe;
  return f.renglones.length === 1 ? f.importe : null;
}

/** Las que están para facturar, agrupadas por cliente. */
export function AFacturar({
  pendientes,
  emisoras,
  siguientes = {},
  fiscales = {},
  quien,
  conRotulo = true,
}: {
  pendientes: Facturable[];
  emisoras: Emisora[];
  /** El número de factura que le sigue a cada emisora, por su identificador. */
  siguientes?: Record<string, number>;
  /** Los datos fiscales de cada cliente de la cola, por su identificador. */
  fiscales?: Record<string, Fiscal>;
  quien: string;
  /** El rótulo "Para facturar" sobra cuando lo dice la pestaña de arriba. */
  conRotulo?: boolean;
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
      {conRotulo && <div className="os-rotulo-bloque">Para facturar</div>}
      {grupos.map(([empresaId, suyas]) => (
        <GrupoCliente
          key={empresaId}
          empresaId={empresaId}
          pendientes={suyas}
          emisoras={emisoras}
          siguientes={siguientes}
          fiscal={fiscales[empresaId]}
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
  siguientes,
  fiscal,
  quien,
}: {
  empresaId: string;
  pendientes: Facturable[];
  emisoras: Emisora[];
  siguientes: Record<string, number>;
  fiscal?: Fiscal;
  quien: string;
}) {
  const router = useRouter();
  const [elegidas, setElegidas] = useState<string[]>(pendientes.map((p) => p.evaluacionId));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [seguroSinFactura, setSeguroSinFactura] = useState(false);

  // Quién factura: la dueña de la cola. Cada pestaña es de una evaluadora y
  // lo que está ahí lo factura ella, mire quien mire; si la cola no dice de
  // quién es, la de quien está mirando.
  const duenia = pendientes[0]?.evaluadora ?? '';
  const propia =
    emisoras.find((e) => duenia !== '' && duenia.includes(e.nombre)) ??
    emisoras.find((e) => e.nombre.includes(quien) || quien.includes(e.nombre));
  const [emisorId, setEmisorId] = useState(propia?.id ?? '');
  const elegida = emisoras.find((e) => e.id === emisorId);
  // En producción la factura se le pide a ARCA, que pone el número, con el
  // punto de venta de web services. Si no, se está anotando una que salió por
  // Comprobantes en Línea: va su punto de venta de ahí y el número que sigue.
  const porArca = elegida?.ambiente === 'produccion';
  const puntoPropuesto = porArca ? elegida?.puntoVenta : elegida?.puntoVentaManual;
  const numeroPropuesto = porArca || !elegida ? undefined : siguientes[elegida.id];

  // Lo que falta para que la factura salga completa. Con algo faltando no se
  // genera: una factura sin el CUIT o el domicilio del cliente no cumple, y
  // ARCA rechaza la que no trae su condición frente al IVA.
  const faltaCliente = faltaParaFacturarle({
    razonSocial: fiscal?.razonSocial,
    cuit: fiscal?.cuit,
    condicionIva: fiscal?.condicionIva,
    domicilio: fiscal?.domicilio,
  });
  const faltaEmisora = elegida ? faltaParaEmitir(elegida) : [];
  const incompleta = faltaCliente.length > 0 || faltaEmisora.length > 0;
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

  /**
   * Sin factura: un toque. Sale de la cola y queda en Sin cobrar como cualquier
   * otra. No genera ningún papel: el cliente ya tiene la orden de compra, que
   * nació cuando se cargaron los candidatos, y se puede volver a bajar desde la
   * fila.
   *
   * La emisora no se pregunta: es la de quien tomó la evaluación, que es de
   * quien es el cobro.
   */
  async function sinFactura() {
    const duenia = seleccion[0]?.evaluadora ?? '';
    const emisora = emisoras.find((e) => duenia.includes(e.nombre)) ?? propia ?? emisoras[0];
    if (!emisora) return;
    setEnviando(true);
    setError(null);
    try {
      await mandar({
        accion: 'nueva',
        sinComprobante: true,
        emisorId: emisora.id,
        empresaId,
        fecha: hoy(),
        evaluaciones: elegidas,
      });
      router.refresh();
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
                <td data-campo="Orden">
                  {/* La orden de compra en la que entró: el papel que el
                      cliente ya tiene por este trabajo. Se abre aparte, para
                      mirarla sin perder lo tildado. */}
                  {p.orden ? (
                    <a
                      className="os-tabla-enlace"
                      href={`/os/psicotecnicos/facturacion/orden/${p.orden.id}`}
                      target="_blank"
                      title="Abrir la orden de compra"
                    >
                      #{p.orden.numero}
                    </a>
                  ) : (
                    '—'
                  )}
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
          <span className="os-dato-rotulo">Seleccionadas</span>
          {seleccion.length} de {pendientes.length}
        </span>
        <span>
          <span className="os-dato-rotulo">Total</span>
          {formatoImporte(total)}
        </span>
        {seleccion.some((p) => p.benziger !== null) && (
          <span>
            <span className="os-dato-rotulo">Dólar tarjeta</span>${' '}
            {(pendientes.find((p) => p.dolar)?.dolar ?? 0).toLocaleString('es-AR')}
          </span>
        )}
        {/* Los dos botones en el mismo renglón que la suma, a la derecha: lo
            que se va a facturar y el botón que lo factura se leen juntos.
            Con el formulario abierto no van, que ya tiene los suyos. */}
        {!abierto && (
          <span className="os-resumen-acciones">
            {error && <span className="os-form-error">{error}</span>}
            <button
              className="os-boton os-boton-firme"
              disabled={seleccion.length === 0}
              onClick={() => setAbierto(true)}
              title={seleccion.length === 0 ? 'Seleccioná al menos una evaluación.' : undefined}
            >
              {seleccion.length === 0 ? 'Facturar' : `Facturar ${seleccion.length}`}
            </button>
            {/* Sin factura va en dos toques: está al lado de "Facturar" y lo
                que hace saca a esas personas de la cola. */}
            {seguroSinFactura ? (
              <>
                <button
                  className="os-boton os-boton-peligro"
                  autoFocus
                  disabled={enviando}
                  onClick={async () => {
                    await sinFactura();
                    setSeguroSinFactura(false);
                  }}
                >
                  {enviando ? 'Guardando…' : 'Sí, sin factura'}
                </button>
                <button className="os-boton" disabled={enviando} onClick={() => setSeguroSinFactura(false)}>
                  No
                </button>
              </>
            ) : (
              <button
                className="os-boton"
                disabled={seleccion.length === 0 || enviando}
                onClick={() => setSeguroSinFactura(true)}
                title="Sale de la cola y queda en Sin cobrar, sin emitir factura"
              >
                Sin factura
              </button>
            )}
          </span>
        )}
      </div>

      {!abierto ? null : (
        <form className="os-form os-form-factura os-panel-cuerpo" onSubmit={emitir}>
          {/* A quién se le factura, tal como va a salir en el comprobante.
              Lo que falta se dice acá y en ámbar: sin CUIT o sin condición
              frente al IVA, ARCA la rechaza. */}
          <div className="os-fiscal">
            <div className="os-fiscal-top">
              <span className="os-etiqueta-campo">Datos fiscales del cliente</span>
              <a
                className="os-tabla-enlace"
                href={`/os/clientes/${empresaId}`}
                target="_blank"
                title="Abrir la ficha del cliente para corregirlos"
              >
                Editar en su ficha
              </a>
            </div>
            <dl>
              <DatoFiscal rotulo="Razón social" valor={fiscal?.razonSocial} />
              <DatoFiscal rotulo="CUIT" valor={cuitLindo(fiscal?.cuit)} />
              <DatoFiscal rotulo="Condición frente al IVA" valor={leyendaIva(fiscal?.condicionIva)} />
              <DatoFiscal rotulo="Domicilio" valor={fiscal?.domicilio} />
              {/* El correo no frena la factura: es a dónde se manda, no un
                  dato del comprobante. */}
              <div>
                <dt>Correo de facturación</dt>
                <dd>{fiscal?.correo ? fiscal.correo : <span className="os-fiscal-opcional">sin cargar</span>}</dd>
              </div>
              <div>
                <dt>Orden de compra propia</dt>
                <dd>{fiscal?.exigeOrdenCompra ? 'La exige en la factura' : 'No la exige'}</dd>
              </div>
            </dl>
            {faltaCliente.length > 0 && (
              <p className="os-fiscal-falta">
                No se le puede facturar todavía: falta {enumerar(faltaCliente)}. Se carga en su
                ficha.
              </p>
            )}
            {faltaEmisora.length > 0 && (
              <p className="os-fiscal-falta">
                A {elegida?.nombre} le falta {enumerar(faltaEmisora)} para poder emitir.
              </p>
            )}
          </div>

          <div className="os-form-campos">
            <div className="os-campo-bloque os-tramo-2">
              <label className="os-etiqueta-campo">Quién factura</label>
              <select
                className="os-campo"
                name="emisorId"
                required
                value={emisorId}
                onChange={(ev) => setEmisorId(ev.target.value)}
              >
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
              {/* La clave hace que el campo vuelva a su valor propuesto al
                  cambiar de emisora: sin ella quedaba el de la anterior. */}
              <input
                key={`pv-${emisorId}`}
                className="os-campo"
                name="puntoVenta"
                type="number"
                min="1"
                defaultValue={puntoPropuesto ?? ''}
                placeholder="—"
                required
              />
            </div>
            <div className="os-campo-bloque os-tramo-1">
              <label className="os-etiqueta-campo">Número</label>
              <input
                key={`n-${emisorId}`}
                className="os-campo"
                name="numero"
                type="number"
                min="1"
                defaultValue={numeroPropuesto ?? ''}
                placeholder={porArca ? 'lo pone ARCA' : '—'}
                // Anotando una que salió por Comprobantes en Línea, el número
                // es parte de la factura. Por ARCA lo pone ARCA.
                required={!porArca}
              />
            </div>
            <div className="os-campo-bloque os-tramo-2">
              <label className="os-etiqueta-campo">Fecha</label>
              <input className="os-campo" name="fecha" type="date" required defaultValue={hoy()} />
            </div>
            <div className="os-campo-bloque os-tramo-2">
              {/* La del cliente, no la nuestra: la orden de compra de Campos
                  HR ya está, es la de la columna "Orden". Esta es el número
                  que algunos clientes dan y exigen ver en la factura. */}
              <label className="os-etiqueta-campo">Orden de compra del cliente</label>
              <input
                className="os-campo"
                name="ordenCompra"
                maxLength={60}
                // A quien la exige no se le factura sin ella: no paga la
                // factura que no la trae impresa.
                required={Boolean(fiscal?.exigeOrdenCompra)}
                placeholder={
                  fiscal?.exigeOrdenCompra ? 'Este cliente la exige' : 'Si el cliente dio la suya'
                }
              />
            </div>
            <div className="os-campo-bloque os-tramo-4">
              <label className="os-etiqueta-campo">Concepto</label>
              {/* Viene escrito con el puesto y la persona de cada tildada, y
                  se puede cambiar: hay clientes que piden otro texto. */}
              <input
                className="os-campo"
                name="concepto"
                maxLength={400}
                defaultValue={conceptoPorDefecto(seleccion)}
              />
            </div>
          </div>

          <p className="os-form-nota">
            El importe sale de las evaluaciones seleccionadas: {formatoImporte(total)}. Si el cliente
            dio su orden de compra, se agrega al final del concepto.{' '}
            {porArca
              ? 'El número lo pone ARCA: se pide desde la factura, con el botón "Pedir CAE".'
              : 'El número propuesto es el que sigue al último anotado; cambialo si no coincide con el de Comprobantes en Línea.'}
          </p>

          <div className="os-form-pie">
            <button
              className="os-boton os-boton-firme"
              type="submit"
              disabled={enviando || incompleta}
              title={incompleta ? 'Faltan datos fiscales: están marcados arriba' : undefined}
            >
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

const cuitLindo = (c: string | null | undefined) =>
  c && c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c;

/** Un dato fiscal del cliente; el que falta se dice y no se deja en blanco. */
function DatoFiscal({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor ? valor : <span className="os-dato-falta">sin cargar</span>}</dd>
    </div>
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
export function Emitidas({
  facturas,
  ordenes = {},
  solo,
}: {
  facturas: Factura[];
  /** Cómo se nombra cada una de las que van sin factura: "OC #0065". */
  ordenes?: Record<string, string>;
  /** Qué mitad mostrar, cuando cada una vive en su pestaña. */
  solo?: 'sin-cobrar' | 'cobrado';
}) {
  // El buscador, como el de Entregados: con cincuenta cobradas, encontrar la
  // de un candidato era recorrer la lista abriendo "Cubre" fila por fila.
  const [busca, setBusca] = useState('');
  const buscado = llano(busca.trim());
  const todas =
    solo === 'cobrado'
      ? facturas.filter((f) => f.cobradaAt)
      : solo === 'sin-cobrar'
        ? facturas.filter((f) => !f.cobradaAt)
        : facturas;
  const visibles = buscado
    ? todas.filter((f) => llano(`${textoDe(f)} ${ordenes[f.id] ?? ''}`).includes(buscado))
    : todas;
  const sinCobrar = solo === 'cobrado' ? [] : visibles.filter((f) => !f.cobradaAt);
  const cobradas = solo === 'sin-cobrar' ? [] : visibles.filter((f) => f.cobradaAt);
  const pendiente = sinCobrar.reduce((n, f) => n + (f.importe ?? 0), 0);

  if (todas.length === 0) {
    return (
      <>
        {!solo && <div className="os-rotulo-bloque">Facturado</div>}
        <div className="os-panel">
          <p className="os-vacio">
            {solo === 'sin-cobrar'
              ? 'No queda nada por cobrar.'
              : solo === 'cobrado'
                ? 'Todavía no se cobró ninguna.'
                : 'Todavía no hay ninguna factura.'}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="os-barra-acciones os-barra-filtro">
        <input
          className="os-campo os-buscador"
          type="search"
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
          placeholder="Buscar por candidato, cliente, puesto, emisora o número"
          aria-label="Buscar en lo facturado"
        />
        {buscado && (
          <span className="os-columna-monto">
            {visibles.length === 1 ? '1 resultado' : `${visibles.length} resultados`}
          </span>
        )}
      </div>

      {buscado && visibles.length === 0 && (
        <div className="os-panel">
          <p className="os-vacio">Nada coincide con “{busca.trim()}”.</p>
        </div>
      )}

      {sinCobrar.length > 0 && (
        <>
          {!solo && <div className="os-rotulo-bloque">Facturado y sin cobrar</div>}
          <div className="os-panel">
            <TablaEmitidas facturas={sinCobrar} ordenes={ordenes} />
            <div className="os-resumen-linea">
              <span>
                <span className="os-dato-rotulo">Sin cobrar</span>
                {sinCobrar.length === 1 ? '1 factura' : `${sinCobrar.length} facturas`}
              </span>
              <span>
                <span className="os-dato-rotulo">Total</span>
                {formatoImporte(pendiente)}
              </span>
            </div>
          </div>
        </>
      )}

      {cobradas.length > 0 && (
        <>
          {!solo && <div className="os-rotulo-bloque">Cobrado</div>}
          <div className="os-panel">
            <TablaEmitidas facturas={cobradas} ordenes={ordenes} medidas={MEDIDAS_COBRADAS} />
          </div>
        </>
      )}
    </>
  );
}

/**
 * Lo que se escribe en el buscador se compara contra esto: lo que se ve en la
 * fila y también quiénes están adentro, que es por lo que más se busca y en la
 * fila no se ve hasta abrirla.
 */
function textoDe(f: Factura): string {
  return [
    f.cliente,
    f.emisora,
    f.sinComprobante ? 'sin factura' : numeroDe(f),
    f.concepto,
    f.ordenCompra,
    ...f.renglones.flatMap((r) => [r.persona, r.puesto, r.descripcion]),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Saca tildes y pasa a minúsculas, igual que en Entregados: sin esto, un
 * apellido con tilde no aparece si se lo escribe sin ella.
 */
function llano(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

/**
 * La tabla de comprobantes, que es la misma para los dos bloques.
 *
 * **"Cubre" se abre.** En la fila va cuántas evaluaciones entraron, que es lo
 * que se compara de un vistazo; para saber quiénes son había que abrir el
 * comprobante de cada factura en otra pestaña. Ahora la fila se despliega y los
 * nombres quedan debajo, con su puesto y lo que se cobró por cada uno.
 */
function TablaEmitidas({
  facturas,
  ordenes,
  medidas = MEDIDAS_EMITIDAS,
}: {
  facturas: Factura[];
  ordenes: Record<string, string>;
  medidas?: string[];
}) {
  const [abierta, setAbierta] = useState<string | null>(null);

  return (
    <div className="os-tabla-marco">
      <table className="os-tabla os-tabla-trabajo os-tabla-fija">
        <colgroup>
          {COLUMNAS_EMITIDAS.map((c, i) => (
            <col key={c} style={{ width: medidas[i] }} />
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
          {facturas.map((f) => {
            const cuantas = cubre(f);
            const cajon = abierta === f.id;
            return (
            <Fragmento key={f.id}>
            <tr>
              <td className="os-tabla-fecha" data-campo="Fecha">{fechaBreve(f.fecha)}</td>
              <td className="os-tabla-nombre" data-campo="Número">
                <a
                  className="os-tabla-enlace"
                  // La que va sin factura no tiene comprobante que abrir: lo
                  // que hay para mirar o volver a mandar es su orden de compra.
                  href={
                    f.sinComprobante
                      ? `/api/os/recibo/${f.id}`
                      : `/os/psicotecnicos/facturacion/comprobante/${f.id}`
                  }
                  target="_blank"
                >
                  {f.sinComprobante ? ordenes[f.id] ?? 'Sin factura' : numeroDe(f)}
                </a>
              </td>
              <td className="os-tabla-recorta" data-campo="Emisora">
                {nombreDe(f.emisora)}
              </td>
              <td className="os-tabla-recorta" data-campo="Cliente">
                {f.cliente}
              </td>
              <td className="os-tabla-recorta" data-campo="Cubre">
                {/* Se cuentan personas y no renglones: el adicional Benziger es
                    un renglón más de alguien que ya está. */}
                {cuantas === 0 ? (
                  /* Sin renglones no se sabe a quién cubre: son las que llegaron
                     incompletas de Airtable, y el ámbar dice que falta cargarlo. */
                  f.concepto ?? <span className="os-dato-falta">sin detalle</span>
                ) : (
                  <button
                    type="button"
                    className={`os-cubre-abre${cajon ? ' abierto' : ''}`}
                    aria-expanded={cajon}
                    onClick={() => setAbierta(cajon ? null : f.id)}
                    title={cajon ? 'Tocar para cerrar' : 'Tocar para ver a quiénes cubre'}
                  >
                    {cuantas} {cuantas === 1 ? 'evaluación' : 'evaluaciones'}
                    {/* Un chevron dibujado y no el carácter ▸: el glifo cambia
                        de tamaño y de línea de base según la tipografía, y acá
                        tiene que girar sin moverse. */}
                    <svg
                      className="os-cubre-flecha"
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M4 2.5 L8 6 L4 9.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
              </td>
              <td className="os-tabla-num" data-campo="Importe">
                {f.importe === null ? (
                  <span className="os-dato-falta">falta</span>
                ) : (
                  formatoImporte(f.importe, f.moneda === 'DOL' ? 'USD' : 'ARS')
                )}
              </td>
              <td data-campo="Cobro">
                {/* Un borrador todavía no es una factura: primero el CAE. */}
                {f.estado === 'borrador' || f.estado === 'rechazada' ? (
                  <a href={`/os/psicotecnicos/facturacion/comprobante/${f.id}`} target="_blank">
                    Falta el CAE
                  </a>
                ) : (
                  <Cobro id={f.id} cobradaAt={f.cobradaAt} formaPago={f.formaPago} />
                )}
              </td>
              <td className="os-tabla-accion" data-campo=" ">
                {/* La que ARCA autorizó no se quita: existe en ARCA, se borre
                    de acá o no. Se anula con una nota de crédito. */}
                {/* El botón está en todas las filas, para que se sepa dónde
                    vive; solo se puede apretar en las que tienen CAE. */}
                <AnularFactura
                  id={f.id}
                  numero={numeroDe(f)}
                  cobrada={Boolean(f.cobradaAt)}
                  noSePuede={
                    f.cae
                      ? null
                      : f.sinComprobante
                        ? 'Va con orden de compra y sin factura: no hay comprobante que anular.'
                        : f.numero === null
                          ? 'Todavía no tiene CAE: no hace falta nota de crédito, se quita.'
                          : 'Esta factura no se emitió desde el OS. Su nota de crédito se hace en Comprobantes en Línea.'
                  }
                />
                {!f.cae && <BorrarFactura id={f.id} numero={numeroDe(f)} />}
              </td>
            </tr>

            {cajon && (
              <tr className="os-fila-abierta os-fila-cubre">
                <td colSpan={ANTES_DE_CUBRE} />
                <td colSpan={COLUMNAS_EMITIDAS.length - ANTES_DE_CUBRE}>
                  <ul className="os-cubre-lista">
                    {f.renglones.map((r) => (
                      <li key={r.id} className={r.persona ? undefined : 'os-cubre-extra'}>
                        {/* El nombre sale de la evaluación cuando está: las
                            facturas de Airtable dicen "Evaluación psicotécnica"
                            a secas y ahí manda la descripción. El puesto va
                            pegado y no en su propia columna: son la misma cosa,
                            quién es y de qué. */}
                        <span className="os-cubre-quien">
                          {r.persona ?? r.descripcion}
                          {r.puesto && <span className="os-cubre-puesto"> · {r.puesto}</span>}
                        </span>
                        <span className="os-cubre-importe">
                          {importeDe(f, r) === null ? (
                            <span
                              className="os-dato-flojo"
                              title="La factura no reparte su importe entre los renglones."
                            >
                              —
                            </span>
                          ) : (
                            formatoImporte(
                              importeDe(f, r) as number,
                              f.moneda === 'DOL' ? 'USD' : 'ARS'
                            )
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            )}
            </Fragmento>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Marcar el cobro, o deshacerlo si se marcó de más. */
export function Cobro({
  id,
  cobradaAt,
  formaPago = null,
}: {
  id: string;
  cobradaAt: string | null;
  formaPago?: 'transferencia' | 'efectivo' | null;
}) {
  const router = useRouter();
  const [tocando, setTocando] = useState(false);
  /** El primer toque pregunta; el segundo hace. */
  const [seguro, setSeguro] = useState(false);

  async function cambiar(valor: string | null, forma?: 'transferencia' | 'efectivo') {
    setTocando(true);
    try {
      await mandar({ accion: 'cobro', id, cobradaAt: valor, formaPago: forma });
      router.refresh();
      // Al cobrar se baja el recibo de pago, que es lo que se le manda al
      // cliente. La ruta lo entrega como adjunto y la pantalla no se mueve.
      if (valor !== null) window.location.assign(`/api/os/recibo-pago/${id}`);
    } finally {
      setTocando(false);
      setSeguro(false);
    }
  }

  // Se confirma en los dos sentidos. Marcar el cobro genera un recibo con
  // número, y un toque de más en una fila equivocada le daba recibo a quien no
  // pagó; desmarcarlo saca la plata de lo cobrado. Al marcar, la confirmación
  // es elegir cómo entró la plata, que es lo que va a decir el recibo.
  if (seguro) {
    const otra = formaPago === 'efectivo' ? 'transferencia' : 'efectivo';
    return (
      <span className="os-cobro-confirma os-cobro-elige">
        {cobradaAt ? (
          <>
            <button
              className="os-boton os-boton-menudo os-boton-firme"
              disabled={tocando}
              onClick={() => cambiar(null)}
            >
              {tocando ? '…' : 'Quitar cobro'}
            </button>
            {/* La misma fecha, con la otra forma de pago: corrige el recibo
                sin desmarcar y volver a marcar. */}
            <button
              className="os-boton os-boton-menudo"
              disabled={tocando}
              onClick={() => cambiar(cobradaAt, otra)}
            >
              {otra === 'efectivo' ? 'Fue en efectivo' : 'Fue transferencia'}
            </button>
          </>
        ) : (
          <>
            <button
              className="os-boton os-boton-menudo os-boton-firme"
              disabled={tocando}
              onClick={() => cambiar(hoy(), 'transferencia')}
            >
              {tocando ? '…' : 'Transferencia'}
            </button>
            <button
              className="os-boton os-boton-menudo os-boton-firme"
              disabled={tocando}
              onClick={() => cambiar(hoy(), 'efectivo')}
            >
              Efectivo
            </button>
          </>
        )}
        <button className="os-boton os-boton-menudo" disabled={tocando} onClick={() => setSeguro(false)}>
          No
        </button>
      </span>
    );
  }

  // Los dos estados son el mismo botón, que alterna: cobrada muestra la fecha
  // con su punto verde, sin cobrar invita a marcarla. Un enlace subrayado al
  // lado de un botón se lee como otra cosa y no queda a la misma altura.
  if (cobradaAt) {
    return (
      <span className="os-cobro-confirma">
        <button
          className="os-boton os-boton-marcado os-sello-estado os-verde"
          title={`Cobrada, ${formaPago === 'efectivo' ? 'en efectivo' : 'por transferencia'}. Tocar para corregirla o quitar el cobro.`}
          onClick={() => setSeguro(true)}
        >
          {fechaBreve(cobradaAt)}
          {formaPago === 'efectivo' ? ' · efvo.' : ''}
        </button>
        <a
          className="os-boton os-boton-icono"
          href={`/api/os/recibo-pago/${id}`}
          title="Bajar el recibo de pago"
          aria-label="Bajar el recibo de pago"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11" />
            <path d="m7.5 11 4.5 4.5L16.5 11" />
            <path d="M5 19.5h14" />
          </svg>
        </a>
      </span>
    );
  }

  return (
    <button
      className="os-boton os-boton-marcado os-boton-menudo"
      title="Todavía sin cobrar. Tocar para marcar que entró la plata."
      onClick={() => setSeguro(true)}
    >
      Marcar como cobrado
    </button>
  );
}

export function BorrarFactura({ id, numero }: { id: string; numero: string }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);
  const [seguro, setSeguro] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // En reposo es un ícono y no un botón con texto: está en todas las filas y
  // es lo que menos se usa. Recién al tocarlo aparece la palabra.
  if (!seguro) {
    return (
      <button
        className="os-boton os-boton-icono os-quitar"
        onClick={() => {
          setError(null);
          setSeguro(true);
        }}
        title={`Quitar la factura ${numero}`}
        aria-label={`Quitar la factura ${numero}`}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8M6.8 7v3.5M9.2 7v3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  // La confirmación dice qué va a pasar y trae cómo arrepentirse. Si se sale
  // de ahí sin tocar nada, vuelve sola al ícono.
  return (
    <span
      className="os-quitar-seguro"
      onBlur={(e) => {
        if (!borrando && !e.currentTarget.contains(e.relatedTarget)) setSeguro(false);
      }}
    >
      {error && <span className="os-anular-error">{error}</span>}
      <button
        className="os-boton os-boton-menudo os-quitar-no"
        disabled={borrando}
        onClick={() => setSeguro(false)}
      >
        Cancelar
      </button>
      <button
        className="os-boton os-boton-menudo os-boton-peligro"
        autoFocus
        disabled={borrando}
        onClick={async () => {
          setBorrando(true);
          setError(null);
          try {
            await mandar({ accion: 'borrar', id });
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo quitar.');
          } finally {
            setBorrando(false);
          }
        }}
      >
        {borrando ? 'Quitando…' : 'Quitar'}
      </button>
    </span>
  );
}

/**
 * Anula una factura con CAE, emitiendo su nota de crédito.
 *
 * En dos toques, como "Quitar", y con más razón: lo que hace no se deshace.
 * La nota de crédito queda emitida en ARCA y la factura deja de valer. Cuando
 * sale bien se abre la nota, que es lo que hay que mandarle al cliente.
 *
 * Una cobrada no se anula: primero se desmarca el cobro.
 */
function AnularFactura({
  id,
  numero,
  cobrada,
  noSePuede = null,
}: {
  id: string;
  numero: string;
  cobrada: boolean;
  /** Por qué esta fila no admite nota de crédito; null si la admite. */
  noSePuede?: string | null;
}) {
  const router = useRouter();
  const [seguro, setSeguro] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (noSePuede || cobrada) {
    return (
      // El motivo va en un envoltorio: un botón apagado no muestra su leyenda
      // al apuntarlo.
      <span title={noSePuede ?? 'Está cobrada. Para anularla, primero desmarcá el cobro.'}>
        <button className="os-boton os-boton-menudo" disabled>
          Emitir NC
        </button>
      </span>
    );
  }
  if (!seguro) {
    return (
      <>
        <button
          className="os-boton os-boton-menudo"
          onClick={() => {
            setError(null);
            setSeguro(true);
          }}
          title={`Anular la factura ${numero} con una nota de crédito`}
        >
          Emitir NC
        </button>
        {error && <div className="os-anular-error">{error}</div>}
      </>
    );
  }
  return (
    <button
      className="os-boton os-boton-peligro"
      disabled={anulando}
      title="Emite una nota de crédito en ARCA. No se deshace."
      onBlur={() => !anulando && setSeguro(false)}
      onClick={async () => {
        setAnulando(true);
        try {
          const r = await mandar({ accion: 'anular', id });
          router.refresh();
          if (r?.notaId) {
            window.open(`/os/psicotecnicos/facturacion/comprobante/${r.notaId}`, '_blank');
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'No se pudo anular.');
        } finally {
          setAnulando(false);
          setSeguro(false);
        }
      }}
    >
      {anulando ? 'Emitiendo…' : 'Sí, emitir nota'}
    </button>
  );
}

/** Una nota de crédito, con lo que hace falta para nombrarla y abrirla. */
export type NotaDeCredito = { id: string; numero: number | null; puntoVenta: number | null; fecha: string };

/**
 * Las facturas anuladas, cada una con la nota de crédito que la anuló.
 *
 * Están aparte porque ya no son plata por cobrar ni cobrada, pero los dos
 * papeles hay que poder encontrarlos: el cliente puede pedir de nuevo la nota,
 * y el contador las dos.
 */
export function Anuladas({
  facturas,
  notas,
}: {
  facturas: Factura[];
  notas: Record<string, NotaDeCredito>;
}) {
  return (
    <div className="os-panel">
      <div className="os-tabla-marco">
        <table className="os-tabla os-tabla-trabajo os-tabla-fija">
          <colgroup>
            {MEDIDAS_ANULADAS.map((m, i) => (
              <col key={i} style={{ width: m }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNAS_ANULADAS.map((c) => (
                <th key={c} className={c === 'Importe' ? 'os-tabla-num' : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {facturas.map((f) => {
              const nota = notas[f.id];
              return (
                <tr key={f.id}>
                  <td className="os-tabla-fecha" data-campo="Fecha">{fechaBreve(f.fecha)}</td>
                  <td className="os-tabla-nombre" data-campo="Factura">
                    <a
                      className="os-tabla-enlace"
                      href={`/os/psicotecnicos/facturacion/comprobante/${f.id}`}
                      target="_blank"
                    >
                      {numeroDe(f)}
                    </a>
                  </td>
                  <td className="os-tabla-recorta" data-campo="Emisora">
                    {nombreDe(f.emisora)}
                  </td>
                  <td className="os-tabla-recorta" data-campo="Cliente">
                    {f.cliente}
                  </td>
                  <td className="os-tabla-num" data-campo="Importe">
                    {f.importe === null ? '—' : formatoImporte(f.importe)}
                  </td>
                  <td data-campo="Nota de crédito">
                    {nota ? (
                      <a
                        className="os-tabla-enlace"
                        href={`/os/psicotecnicos/facturacion/comprobante/${nota.id}`}
                        target="_blank"
                      >
                        {numeroDe({ numero: nota.numero, puntoVenta: nota.puntoVenta })}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="os-tabla-flojo" data-campo="Anulada el">
                    {nota ? formatoFecha(nota.fecha) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Un fragmento con clave, para que la fila y su detalle sean un solo hijo del
 * cuerpo de la tabla.
 */
function Fragmento({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
