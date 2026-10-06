'use client';

/**
 * Los meses anteriores, uno por renglón, con su detalle plegado.
 *
 * El detalle se abre desde la flecha que va delante del mes y aparece debajo
 * del renglón, sin salir de la tabla: quien busca cuántas horas usó en
 * septiembre quiere verlo al lado de octubre, no en otra pantalla de la que
 * después hay que volver.
 */

import { Fragment, useState } from 'react';

export type MesAnterior = {
  mes: string;
  nombre: string;
  horas: number;
  importe: string;
  /** Cómo quedó ese mes: pagado, o cuánto falta. El texto ya viene escrito. */
  estado: { texto: string; debe: boolean };
  facturas: { id: string; numero: string }[];
  /** Cuántos pagos tiene registrados ese mes. El recibo los junta. */
  pagos: number;
  horasDelMes: {
    id: string;
    dia: string;
    sala: string;
    horario: string;
    horas: string;
    importe: string;
  }[];
};

export default function Anteriores({ meses }: { meses: MesAnterior[] }) {
  const [abiertos, setAbiertos] = useState<string[]>([]);
  const alternar = (mes: string) =>
    setAbiertos((xs) => (xs.includes(mes) ? xs.filter((x) => x !== mes) : [...xs, mes]));

  return (
    <table className="centro-resumen centro-anteriores">
      <thead>
        <tr>
          <th>Mes</th>
          <th className="centro-num">Horas</th>
          <th className="centro-num">Importe</th>
          <th>Estado</th>
          <th>Factura</th>
          <th>Recibo</th>
        </tr>
      </thead>
      <tbody>
        {meses.map((a) => {
          const abierto = abiertos.includes(a.mes);
          return (
            <Fragment key={a.mes}>
              <tr>
                <td>
                  <button
                    type="button"
                    className={`centro-desplegar${abierto ? ' abierto' : ''}`}
                    aria-expanded={abierto}
                    onClick={() => alternar(a.mes)}
                  >
                    <span aria-hidden="true">›</span>
                    {a.nombre}
                  </button>
                </td>
                <td className="centro-num">{a.horas} h</td>
                <td className="centro-num">{a.importe}</td>
                <td>
                  <span className={`centro-estado${a.estado.debe ? ' debe' : ''}`}>
                    {a.estado.texto}
                  </span>
                </td>
                <td>
                  {a.facturas.length === 0
                    ? '—'
                    : a.facturas.map((f) => (
                        <a
                          key={f.id}
                          className="centro-bajar centro-abrir"
                          target="_blank"
                          rel="noreferrer"
                          href={`/api/centro/factura-pdf/${f.id}`}
                          title={f.numero}
                        >
                          Abrir
                        </a>
                      ))}
                </td>
                <td>
                  {/* Un solo recibo por mes, que junta todos sus pagos. */}
                  {a.pagos === 0 ? (
                    '—'
                  ) : (
                    <a
                      className="centro-bajar centro-abrir"
                      target="_blank"
                      rel="noreferrer"
                      href={`/api/centro/recibo/${a.mes}`}
                      title={a.pagos === 1 ? 'Un pago' : `${a.pagos} pagos, en un solo recibo`}
                    >
                      Abrir
                    </a>
                  )}
                </td>
              </tr>
              {abierto && (
                <tr className="centro-desplegado">
                  <td colSpan={6}>
                    <table className="centro-resumen">
                      <thead>
                        <tr>
                          <th>Día</th>
                          <th>Consultorio</th>
                          <th>Horario</th>
                          <th className="centro-num">Horas</th>
                          <th className="centro-num">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.horasDelMes.map((h) => (
                          <tr key={h.id}>
                            <td>{h.dia}</td>
                            <td>{h.sala}</td>
                            <td>{h.horario}</td>
                            <td className="centro-num">{h.horas}</td>
                            <td className="centro-num">{h.importe}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
