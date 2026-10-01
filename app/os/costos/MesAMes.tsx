/**
 * Lo que se aprobó y lo que costó, mes a mes.
 *
 * Los cuatro números de arriba dicen cuánto va el año; esto dice cuándo. La
 * barra del mes es lo aprobado, partida en dos: abajo lo que se fue en gastos y
 * arriba el resultado. Así el alto entero es lo que entró y el tramo de abajo
 * se lee como parte de eso, que es lo que es.
 *
 * El trabajo entero cae en el mes en que el cliente lo aprobó, con todos sus
 * gastos: un ciclo aprobado en julio se sigue gastando en agosto, y esos gastos
 * son de julio porque son de ese trabajo. Un mes en el que se gastó más de lo
 * que se aprobó dibuja la barra entera en el color del gasto.
 *
 * Los meses que todavía no llegaron van apagados, para no leerlos como meses
 * sin trabajo.
 */

import { formatoImporte } from '@/lib/comercial-tipos';

export type MesDeServicios = {
  clave: string;
  etiqueta: string;
  futuro: boolean;
  aprobado: number;
  costo: number;
};

/** El monto arriba de la barra: en miles o en millones, que es como se habla. */
function corto(n: number): string {
  if (n === 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  return `${Math.round(n / 1000)} k`;
}

export default function MesAMes({ meses }: { meses: MesDeServicios[] }) {
  /* La barra más alta del año manda la escala: es lo aprobado del mes, salvo
     que ese mes haya gastado más de lo que aprobó. */
  const techo = Math.max(...meses.map((m) => Math.max(m.aprobado, m.costo)), 0);

  if (techo === 0) {
    return (
      <div className="os-panel">
        <div className="os-panel-cuerpo">
          <p className="os-vacio">Todavía no hay trabajos aprobados ni gastos este año.</p>
        </div>
      </div>
    );
  }

  /** Un tramo de la barra: lo mínimo que se ve es dos píxeles. */
  const alto = (n: number) => (n === 0 ? '0' : `${Math.max((n / techo) * 100, 2)}%`);

  return (
    <div className="os-panel">
      <div className="os-panel-top">
        <h2>Mes a mes</h2>
      </div>
      <div className="os-panel-cuerpo">
        <div className="os-meses" role="img" aria-label="Aprobado y costos por mes, de enero a diciembre">
          {meses.map((m) => (
            <div
              className={`os-mes${m.futuro ? ' futuro' : ''}`}
              key={m.clave}
              aria-label={
                m.futuro
                  ? undefined
                  : `${m.etiqueta}: aprobado ${formatoImporte(m.aprobado)}, costos ${formatoImporte(
                      m.costo
                    )}`
              }
            >
              <span className="os-mes-monto">{corto(Math.max(m.aprobado, m.costo))}</span>
              <div className="os-mes-caja">
                {/* El tramo que vale cero no se dibuja: con el mínimo de dos
                    píxeles, un mes sin gastos mostraba una rayita que se leía
                    como un gasto chico. */}
                {(m.aprobado > 0 || m.costo > 0) && (
                  <div className="os-mes-pila">
                    {m.aprobado - m.costo > 0 && (
                      <div
                        className="os-mes-lleno resultado"
                        style={{ height: alto(m.aprobado - m.costo) }}
                        data-detalle={`Resultado · ${formatoImporte(m.aprobado - m.costo)}`}
                      />
                    )}
                    {m.costo > 0 && (
                      <div
                        className="os-mes-lleno gasto"
                        style={{ height: alto(m.costo) }}
                        data-detalle={`Costos · ${formatoImporte(m.costo)}`}
                      />
                    )}
                  </div>
                )}
              </div>
              <span className="os-mes-rotulo">{m.etiqueta}</span>
            </div>
          ))}
        </div>

        <p className="os-referencias">
          <span className="os-referencia">
            <i className="os-referencia-color resultado" /> Resultado
          </span>
          <span className="os-referencia">
            <i className="os-referencia-color gasto" /> Costos
          </span>
        </p>
      </div>
    </div>
  );
}
