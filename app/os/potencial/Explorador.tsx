'use client';

/**
 * El gráfico de progreso del potencial, para moverlo.
 *
 * Los dos datos que se mueven son los mismos dos que se cargan en la ficha: la
 * edad del día de la evaluación y el horizonte temporal que la evaluadora le
 * atribuye después de escucharla. No hay un tercero, y acá no se guarda nada:
 * es la lámina con las manos, para ver a qué banda pertenece un punto y hasta
 * dónde llega esa banda antes de tener a la persona delante.
 *
 * **El horizonte se elige por su plazo y no por un número.** El deslizador
 * corre sobre los veinticinco escalones de la escalera y lo que se lee es el
 * plazo, que es como se pregunta y como se anota: "dos años", "seis meses".
 */

import { useState } from 'react';
import Progreso from '../psicotecnicos/informe/_doc/Progreso';
import {
  ALTO,
  ESCALERA,
  PISO,
  bandaDe,
  diasDeEscalon,
  edadEnQueMadura,
  enPalabras,
  estratoDeEscalon,
  horizonteEn,
  limiteDeBanda,
  modoDe,
} from '@/lib/potencial';

const EDAD_MIN = 20;
const EDAD_MAX = 70;

/** Los diez modos, como los nombra la lámina. */
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** La celda de la escalera en la que cae un escalón: IVB, IVM, IVA. */
function celdaDe(escalon: number): string {
  const i = Math.min(ALTO, Math.max(1, Math.ceil(escalon)));
  return ESCALERA[i].celda;
}

export default function Explorador() {
  const [edad, setEdad] = useState(38);
  const [escalon, setEscalon] = useState(9);

  const dias = diasDeEscalon(escalon);
  const banda = bandaDe(edad, dias);
  const modo = modoDe(edad, escalon);
  const estrato = estratoDeEscalon(escalon);
  const techo = limiteDeBanda(banda, EDAD_MAX);
  const madura = edadEnQueMadura(banda);

  /* Las edades redondas que le quedan por delante. Ninguna si ya las pasó: una
     proyección hacia atrás no es una proyección. */
  const adelante = [40, 50, 60, 65].filter((e) => e > edad + 2);

  return (
    <div className="os-potencial-explorador">
      <div className="os-potencial-mandos">
        <div className="os-potencial-mando">
          <label htmlFor="pot-edad">
            Edad <b>{edad} años</b>
          </label>
          <input
            id="pot-edad"
            type="range"
            min={EDAD_MIN}
            max={EDAD_MAX}
            step={1}
            value={edad}
            onChange={(e) => setEdad(Number(e.target.value))}
          />
        </div>

        <div className="os-potencial-mando">
          <label htmlFor="pot-horizonte">
            Horizonte temporal{' '}
            <b>
              {enPalabras(dias)} · {celdaDe(escalon)}
            </b>
          </label>
          <input
            id="pot-horizonte"
            type="range"
            min={PISO}
            max={ALTO}
            step={0.25}
            value={escalon}
            onChange={(e) => setEscalon(Number(e.target.value))}
          />
        </div>

        <dl className="os-potencial-lectura">
          {/* El romano es la banda que el dibujo pinta y el informe nombra; el
              decimal dice qué tan adentro de ella cae el punto, que es lo que
              avisa cuando está a un pelo del borde. */}
          <div className="os-potencial-lectura-fuerte">
            <dt>Banda de maduración</dt>
            <dd>
              Modo {ROMANOS[banda - 1]}
              {modo >= 0.06 && ` · ${modo.toFixed(1).replace('.', ',')}`}
            </dd>
          </div>
          <div>
            <dt>Estrato hoy</dt>
            <dd>
              {estrato.romano} · {estrato.mide ? estrato.nombre : 'fuera del alcance del test'}
            </dd>
          </div>
          {adelante.map((e) => {
            const h = horizonteEn(banda, e);
            return (
              <div key={e}>
                <dt>A los {e}</dt>
                <dd>
                  {enPalabras(diasDeEscalon(h))} · estrato {estratoDeEscalon(h).romano}
                </dd>
              </div>
            );
          })}
          <div>
            <dt>Hasta dónde llega</dt>
            <dd>
              {enPalabras(diasDeEscalon(Math.min(ALTO, techo)))} · estrato{' '}
              {estratoDeEscalon(Math.min(ALTO, techo)).romano}
            </dd>
          </div>
          <div>
            <dt>Termina de crecer</dt>
            <dd>{madura > EDAD_MAX ? `pasados los ${EDAD_MAX}` : `${madura.toFixed(0)} años`}</dd>
          </div>
        </dl>
      </div>

      <div className="os-potencial-lamina">
        <Progreso edad={edad} dias={dias} />
      </div>
    </div>
  );
}
