'use client';

/**
 * Los clientes, en una tabla.
 *
 * Antes era una tabla de datos de facturación: razón social, CUIT, IVA. Eso es
 * lo que se necesita el día que se factura, y no lo que se busca al entrar, que
 * es el cliente: cuánta gente tiene en curso y cómo viene. La ficha
 * muestra eso y el resto está adentro.
 *
 * **Entrar a un cliente es entrar a sus pedidos.** Los pedidos dejaron de ser
 * una sección aparte el 25/8/2026: un pedido no existe sin el cliente que lo
 * pidió, y tenerlos en dos pantallas obligaba a cruzar de memoria qué pedido
 * era de quién.
 */

import Link from 'next/link';
import { useState } from 'react';
import Cajon from './Cajon';
import { diasDesde, fechaCorta, haceCuanto } from '@/lib/hora';
import type { Cliente } from '@/lib/clientes';

/**
 * La contribución de un cliente: su parte de todas las evaluaciones, en
 * porcentaje.
 * Por debajo del uno se dice así, porque "0 %" parece que no tiene ninguna.
 */
function peso(suyas: number, total: number): string {
  if (!total || !suyas) return '0 %';
  const p = (suyas / total) * 100;
  return p < 1 ? '<1 %' : `${Math.round(p)} %`;
}

/**
 * Cuánta gente tiene en proceso: candidatos sin informe entregado y sin baja.
 * Los ya entregados de un pedido que sigue abierto no cuentan, porque para
 * ellos el trabajo terminó.
 */
function enCurso(c: Cliente) {
  return { gente: c.susPedidos.reduce((n, p) => n + p.enProceso, 0) };
}

export default function Cards({ clientes }: { clientes: Cliente[] }) {
  /** null = cerrado; el objeto = editando ese; 'nuevo' = dando de alta. */
  const [abierto, setAbierto] = useState<Cliente | 'nuevo' | null>(null);

  // Por nombre. Ordenados por cuánto trabajo tienen abierto, la tarjeta de un
  // cliente cambiaba de lugar cada semana y había que recorrer la grilla entera
  // para encontrarlo; el bloque de Activos ya dice quiénes tienen trabajo.
  const ordenar = (xs: Cliente[]) => [...xs].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  // Una sola tabla: el punto de color ya dice quién está activo. Los activos
  // van primero, que son los de todos los días, y cada grupo por nombre.
  const todos = [
    ...ordenar(clientes.filter((c) => c.activa)),
    ...ordenar(clientes.filter((c) => !c.activa)),
  ];

  return (
    <>
      {/* Nuevo cliente a la derecha, apenas arriba de la tabla. */}
      <div className="os-barra-acciones os-barra-derecha os-barra-pegada">
        <button className="os-boton os-boton-firme" onClick={() => setAbierto('nuevo')}>
          Nuevo cliente
        </button>
      </div>

      <Grilla clientes={todos} vacio="Todavía no hay clientes." />

      {abierto && (
        <Cajon cliente={abierto === 'nuevo' ? null : abierto} alCerrar={() => setAbierto(null)} />
      )}
    </>
  );
}

/**
 * La tabla de clientes, activos e inactivos juntos.
 *
 * En tabla y no en fichas: con treinta clientes la grilla ocupaba tres
 * pantallas, y en filas se recorren de un vistazo y se comparan por columna.
 */
function Grilla({ clientes, vacio }: { clientes: Cliente[]; vacio: string }) {
  if (clientes.length === 0) {
    return vacio ? <p className="os-vacio">{vacio}</p> : null;
  }

  const total = clientes.reduce((n, c) => n + c.evaluaciones, 0);

  return (
    <section className="os-panel os-panel-separado">
      <div className="os-tabla-marco">
        <table className="os-tabla os-tabla-clientes">
          <colgroup>
            {[46, 24, 14, 16].map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Último pedido</th>
              <th className="os-tabla-num">En curso</th>
              <th className="os-tabla-num">Contribución</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => {
              const { gente } = enCurso(c);
              return (
                <tr key={c.id ?? c.nombre} className={c.activa ? '' : 'os-fila-apagada'}>
                  <td data-campo="Cliente">
                    {/* Verde el que está activo, gris el que no: el estado se
                        reconoce sin leerlo, como en el resto del sistema. */}
                    <i className={`os-punto-etapa ${c.activa ? 'os-verde' : 'os-gris'}`} />
                    {/* Los de Airtable no abren ficha: no se editan desde acá
                        hasta que se migren. */}
                    {c.id ? (
                      <Link
                        className="os-tabla-nombre os-tabla-ficha"
                        href={`/os/clientes/${c.id}`}
                      >
                        {c.nombre}
                      </Link>
                    ) : (
                      <span className="os-tabla-nombre">{c.nombre}</span>
                    )}
                  </td>
                  {/* Hace cuánto que no pide: los pedidos vienen ordenados del
                      más nuevo al más viejo, así que el primero es el último. */}
                  <td data-campo="Último pedido">
                    {c.susPedidos[0]?.fecha ? (
                      <>
                        {fechaCorta(c.susPedidos[0].fecha)}
                        <span className="os-tabla-flojo">
                          {' · '}
                          {haceCuanto(diasDesde(c.susPedidos[0].fecha))}
                        </span>
                      </>
                    ) : (
                      <span className="os-tabla-flojo">—</span>
                    )}
                  </td>
                  <td data-campo="En curso" className="os-tabla-num">
                    <strong className={gente === 0 ? 'os-tabla-flojo' : ''}>{gente}</strong>
                  </td>
                  {/* Qué parte de todas las evaluaciones hechas son de este
                      cliente: cuánto pesa en el trabajo. El número de
                      evaluaciones queda al pasar el mouse. */}
                  <td
                    data-campo="Contribución"
                    className="os-tabla-num"
                    title={`${c.evaluaciones} de ${total} evaluaciones`}
                  >
                    <strong className={c.evaluaciones === 0 ? 'os-tabla-flojo' : ''}>
                      {peso(c.evaluaciones, total)}
                    </strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
