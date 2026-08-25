'use client';

/**
 * Los trabajos de Campos HR: qué se vendió, qué se facturó y qué quedó.
 *
 * Una fila por oportunidad ganada, que es la unidad de este negocio: un ciclo
 * de encuentros, un trabajo de estructura. En la fila conviven las tres cosas
 * que antes vivían en tres lugares distintos: lo cotizado, lo que se facturó
 * contra eso y lo que costó hacerlo.
 *
 * **El costo se abre, no se muestra entero.** Un trabajo junta media docena de
 * gastos chicos (un peaje, un combustible, las impresiones) y ponerlos todos a
 * la vista hacía que la pantalla fuera una lista de gastos con el resultado
 * escondido en el medio. En la fila va la suma; el detalle y el alta están a un
 * clic.
 *
 * **La fila es el trabajo y no la factura** porque un trabajo se factura en
 * varios comprobantes: el ciclo se reparte entre los tres y cada uno emite el
 * suyo. Con una fila por factura, el costo del trabajo aparecería tres veces y
 * el resultado sería tres veces mentira.
 */

import { useState } from 'react';
import { formatoImporte, type Factura } from '@/lib/facturas-tipos';
import { formatoFecha } from '@/lib/comercial-tipos';
import { columnas } from '@/app/os/psicotecnicos/piezas';
import { Cobro, BorrarFactura } from '@/app/os/psicotecnicos/facturacion/Facturacion';
import { BorrarCosto, NuevoCosto } from './Costos';
import { numeroDe } from '@/lib/facturas-tipos';

/** Lo que la pantalla ya resolvió para cada trabajo. */
export type Trabajo = {
  id: string;
  cliente: string;
  concepto: string;
  fecha: string;
  moneda: string;
  cotizado: number;
  facturado: number;
  cobrado: number;
  costo: number;
  gastos: { id: string; concepto: string; fecha: string; importe: number }[];
  facturas: Factura[];
};

const COLUMNAS = ['Cliente', 'Trabajo', 'Cotizado', 'Facturado', 'Costo', 'Resultado', 'Margen'];
const MEDIDAS = columnas(COLUMNAS, {
  Cliente: 150,
  Trabajo: 280,
  Cotizado: 130,
  Facturado: 130,
  Costo: 130,
  Resultado: 140,
});

export default function Trabajos({ trabajos }: { trabajos: Trabajo[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);

  if (trabajos.length === 0) {
    return (
      <div className="os-panel">
        <p className="os-vacio">
          Todavía no hay ninguna oportunidad aprobada. Se aprueban en Cotizaciones.
        </p>
      </div>
    );
  }

  return (
    <div className="os-panel">
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
                    ['Cotizado', 'Facturado', 'Costo', 'Resultado', 'Margen'].includes(c)
                      ? 'os-tabla-num'
                      : undefined
                  }
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trabajos.map((t) => {
              // El resultado se mide contra lo facturado, que es lo que de
              // verdad entró; mientras no haya factura, contra lo cotizado, que
              // es lo que se espera que entre.
              const ingreso = t.facturado > 0 ? t.facturado : t.cotizado;
              const resultado = ingreso - t.costo;
              const margen = ingreso === 0 ? null : (resultado / ingreso) * 100;
              const cajon = abierto === t.id;

              return (
                <Fragmento key={t.id}>
                  <tr>
                    <td className="os-tabla-nombre" data-campo="Cliente">
                      {t.cliente}
                    </td>
                    <td className="os-tabla-recorta" data-campo="Trabajo" title={t.concepto}>
                      {t.concepto}
                    </td>
                    <td className="os-tabla-num" data-campo="Cotizado">
                      {formatoImporte(t.cotizado, t.moneda)}
                    </td>
                    <td className="os-tabla-num" data-campo="Facturado">
                      {t.facturado === 0 ? (
                        <span className="os-dato-falta">sin facturar</span>
                      ) : (
                        formatoImporte(t.facturado)
                      )}
                    </td>
                    {/* El costo abre su cajón: en la fila va la suma, y el
                        detalle de los gastos está a un clic. */}
                    <td className="os-tabla-num" data-campo="Costo">
                      <button
                        type="button"
                        className={`os-costo-abre${cajon ? ' abierto' : ''}`}
                        onClick={() => setAbierto(cajon ? null : t.id)}
                        title={
                          t.gastos.length === 0
                            ? 'Sin gastos cargados. Tocar para sumar uno.'
                            : `${t.gastos.length} gastos. Tocar para verlos.`
                        }
                      >
                        {formatoImporte(t.costo, t.moneda)}
                        <span aria-hidden="true">{cajon ? '▾' : '▸'}</span>
                      </button>
                    </td>
                    <td
                      className={`os-tabla-num${resultado < 0 ? ' os-resultado-rojo' : ''}`}
                      data-campo="Resultado"
                    >
                      {formatoImporte(resultado, t.moneda)}
                    </td>
                    <td
                      className={`os-tabla-num${
                        margen !== null && margen < 0 ? ' os-resultado-rojo' : ''
                      }`}
                      data-campo="Margen"
                    >
                      {margen === null ? '—' : `${Math.round(margen)}%`}
                    </td>
                  </tr>

                  {cajon && (
                    <tr className="os-fila-abierta">
                      <td colSpan={COLUMNAS.length}>
                        <div className="os-abierta-cuerpo">
                          <div className="os-abierta-mitad">
                            <span className="os-dato-rotulo">Gastos</span>
                            {t.gastos.length === 0 ? (
                              <p className="os-panel-nota">
                                Sin gastos cargados: el resultado es el ingreso entero.
                              </p>
                            ) : (
                              t.gastos.map((g) => (
                                <div className="os-gasto" key={g.id}>
                                  <span className="os-gasto-concepto">{g.concepto}</span>
                                  <span className="os-gasto-fecha">{formatoFecha(g.fecha)}</span>
                                  <span className="os-gasto-importe">
                                    {formatoImporte(g.importe, t.moneda)}
                                  </span>
                                  <span className="os-gasto-baja">
                                    <BorrarCosto id={g.id} />
                                  </span>
                                </div>
                              ))
                            )}
                            <NuevoCosto cotizacionId={t.id} />
                          </div>

                          <div className="os-abierta-mitad">
                            <span className="os-dato-rotulo">Facturas</span>
                            {t.facturas.length === 0 ? (
                              <p className="os-panel-nota">
                                Sin facturar. Se carga abajo, eligiendo este trabajo.
                              </p>
                            ) : (
                              t.facturas.map((f) => (
                                <div className="os-gasto os-gasto-factura" key={f.id}>
                                  <span className="os-gasto-concepto">
                                    <a
                                      className="os-tabla-enlace"
                                      href={`/os/psicotecnicos/facturacion/comprobante/${f.id}`}
                                      target="_blank"
                                    >
                                      {numeroDe(f)}
                                    </a>{' '}
                                    · {f.emisora}
                                  </span>
                                  <span className="os-gasto-fecha">{formatoFecha(f.fecha)}</span>
                                  <span className="os-gasto-importe">
                                    {formatoImporte(f.importe ?? 0)}
                                  </span>
                                  <span className="os-gasto-baja">
                                    <Cobro id={f.id} cobradaAt={f.cobradaAt} />
                                    <BorrarFactura id={f.id} numero={numeroDe(f)} />
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragmento>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Dos filas hermanas necesitan un padre que no dibuje nada. */
function Fragmento({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
