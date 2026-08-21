'use client';

/**
 * La tabla de clientes, con su cajón.
 *
 * Es cliente y no servidor porque cada fila abre la ficha del cliente sin
 * cambiar de pantalla: se corrige un CUIT y se vuelve a la lista donde estaba,
 * que es como se trabaja cuando hay que completar datos de varios seguidos.
 */

import { useState } from 'react';
import CopyLink from '@/app/informes/CopyLink';
import Cajon from './Cajon';
import type { Cliente } from '@/lib/clientes';

const PORTAL = 'https://clientes.camposhr.com';

/** Un valor que falta se ve como que falta, no como una celda vacía. */
function Dato({ valor }: { valor: string | number | null }) {
  if (valor === null || valor === '') return <span className="os-tabla-flojo">—</span>;
  return <>{valor}</>;
}

export default function Lista({ clientes }: { clientes: Cliente[] }) {
  /** null = cerrado; el objeto = editando ese; 'nuevo' = dando de alta. */
  const [abierto, setAbierto] = useState<Cliente | 'nuevo' | null>(null);
  const sinDatos = clientes.filter((c) => !c.cuit).length;

  return (
    <>
      <div className="os-barra-acciones">
        <button className="os-boton os-boton-firme" onClick={() => setAbierto('nuevo')}>
          Nuevo cliente
        </button>
        {sinDatos > 0 && (
          <span className="os-columna-nota" style={{ alignSelf: 'center' }}>
            {sinDatos} sin CUIT cargado.
          </span>
        )}
      </div>

      <section className="os-panel">
        <div className="os-tabla-marco">
          <table className="os-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Razón social</th>
                <th>CUIT</th>
                <th>IVA</th>
                <th>Contacto</th>
                <th>Portal</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id ?? c.nombre}>
                  <td>
                    {/* Los de Airtable no abren ficha: no se editan desde acá
                        hasta que se migren, así que su nombre no es un botón. */}
                    {c.id ? (
                      <button className="os-tabla-enlace" type="button" onClick={() => setAbierto(c)}>
                        {c.nombre}
                      </button>
                    ) : (
                      <div className="os-tabla-nombre">{c.nombre}</div>
                    )}
                  </td>
                  <td>
                    <Dato valor={c.razonSocial} />
                  </td>
                  <td>
                    <Dato valor={c.cuit} />
                  </td>
                  <td>
                    <Dato valor={c.condicionIva} />
                  </td>
                  <td>
                    <Dato valor={c.contacto ?? c.emailFacturacion} />
                  </td>
                  {/* El enlace del portal vive acá y no en una pantalla aparte,
                      que era la misma lista de clientes con una sola columna. */}
                  <td>
                    {c.token ? (
                      <span className="os-portal-acciones">
                        <a
                          className="os-boton"
                          href={`${PORTAL}/${c.token}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir
                        </a>
                        <CopyLink url={`${PORTAL}/${c.token}`} texto="Copiar" />
                      </span>
                    ) : (
                      <span className="os-tabla-flojo">sin portal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clientes.length === 0 && <p className="os-vacio">Todavía no hay clientes cargados.</p>}
      </section>

      {abierto && (
        <Cajon
          cliente={abierto === 'nuevo' ? null : abierto}
          alCerrar={() => setAbierto(null)}
        />
      )}
    </>
  );
}
