'use client';

/**
 * Los clientes, en fichas.
 *
 * Antes era una tabla de datos de facturación: razón social, CUIT, IVA. Eso es
 * lo que se necesita el día que se factura, y no lo que se busca al entrar, que
 * es el cliente: cuántas búsquedas tiene abiertas y cómo vienen. La ficha
 * muestra eso y el resto está adentro.
 *
 * **Entrar a un cliente es entrar a sus pedidos.** Los pedidos dejaron de ser
 * una sección aparte el 25/8/2026: una búsqueda no existe sin el cliente que la
 * pidió, y tenerlas en dos pantallas obligaba a cruzar de memoria qué pedido era
 * de quién.
 */

import Link from 'next/link';
import { useState } from 'react';
import Cajon from './Cajon';
import type { Cliente } from '@/lib/clientes';

/** Cuántas búsquedas tiene abiertas y cuánta gente hay adentro. */
function enCurso(c: Cliente) {
  const abiertos = c.susPedidos.filter((p) => p.estado === 'En curso');
  return {
    abiertos: abiertos.length,
    gente: abiertos.reduce((n, p) => n + p.evaluaciones, 0),
  };
}

export default function Cards({ clientes }: { clientes: Cliente[] }) {
  /** null = cerrado; el objeto = editando ese; 'nuevo' = dando de alta. */
  const [abierto, setAbierto] = useState<Cliente | 'nuevo' | null>(null);
  const sinDatos = clientes.filter((c) => !c.cuit).length;

  // Primero los que tienen trabajo abierto, y de esos el que más tiene: es por
  // donde se entra cuando se entra a mirar cómo viene todo.
  const ordenados = [...clientes].sort((a, b) => {
    const x = enCurso(a);
    const y = enCurso(b);
    return y.abiertos - x.abiertos || y.gente - x.gente || a.nombre.localeCompare(b.nombre, 'es');
  });

  return (
    <>
      <div className="os-barra-acciones">
        <button className="os-boton os-boton-firme" onClick={() => setAbierto('nuevo')}>
          Nuevo cliente
        </button>
        {sinDatos > 0 && (
          <span className="os-columna-nota">{sinDatos} sin CUIT cargado.</span>
        )}
      </div>

      <div className="os-clientes">
        {ordenados.map((c) => {
          const { abiertos, gente } = enCurso(c);
          const cuerpo = (
            <>
              <div className="os-cliente-top">
                <h2>{c.nombre}</h2>
                {abiertos > 0 && (
                  <span className="os-sello-estado os-azul">
                    {abiertos === 1 ? '1 búsqueda' : `${abiertos} búsquedas`}
                  </span>
                )}
              </div>
              <p className="os-cliente-linea">
                {abiertos === 0 ? (
                  <span className="os-tabla-flojo">Sin búsquedas abiertas</span>
                ) : (
                  <>
                    {gente === 0
                      ? 'todavía sin candidatos'
                      : gente === 1
                        ? '1 candidato en curso'
                        : `${gente} candidatos en curso`}
                  </>
                )}
              </p>
              <p className="os-cliente-pie">
                {c.susPedidos.length === 1
                  ? '1 pedido en total'
                  : `${c.susPedidos.length} pedidos en total`}
                {!c.cuit && <span className="os-dato-falta"> · falta el CUIT</span>}
                {c.origen === 'airtable' && (
                  <span className="os-dato-falta"> · sin migrar</span>
                )}
              </p>
            </>
          );

          // Los de Airtable no abren ficha: no se editan desde acá hasta que se
          // migren, y una ficha que no deja hacer nada es una puerta a un
          // cuarto vacío.
          return c.id ? (
            <Link className="os-cliente" key={c.id} href={`/os/clientes/${c.id}`}>
              {cuerpo}
            </Link>
          ) : (
            <div className="os-cliente apagada" key={c.nombre}>
              {cuerpo}
            </div>
          );
        })}
      </div>

      {abierto && (
        <Cajon
          cliente={abierto === 'nuevo' ? null : abierto}
          alCerrar={() => setAbierto(null)}
        />
      )}
    </>
  );
}
