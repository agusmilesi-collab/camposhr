/**
 * El diagrama de progreso potencial, con el punto de la persona.
 *
 * Edad en el eje de abajo, horizonte temporal en el de la izquierda, y las ocho
 * bandas de maduración del modelo de Jaques cruzando el cuadro. El punto es la
 * persona hoy; la banda pintada es por la que viene subiendo, y hacia la
 * derecha dice hasta dónde llega.
 *
 * **Es un dibujo, no una imagen.** El informe se imprime y se lee en pantalla:
 * un PNG queda pixelado al ampliarlo y sus rótulos no se pueden buscar ni leer
 * en voz alta. Todo lo que se ve acá son líneas y texto de verdad.
 *
 * **La lámina original tiene veintiún rótulos en el eje y este tiene siete.**
 * Los escalones intermedios siguen dibujados, en gris y sin número: son los que
 * le dan la forma a las curvas. Lo que se rotula es el techo de cada estrato,
 * que es lo que hay que leer para saber en cuál cae el punto. La lámina de
 * Jaques es una herramienta de trabajo del consultor; esto va adentro de un
 * informe que lee alguien de Recursos Humanos.
 *
 * Sin `use client`: son etiquetas y números, sin nada que tocar, así que sirve
 * igual en el informe (que se arma en el servidor) y en la ficha.
 */

import {
  ALTO,
  EDAD_MAX,
  EDAD_MIN,
  ESCALERA,
  ESTRATOS,
  bandaDe,
  escalonDe,
  estratoDeEscalon,
  horizonteEn,
  limiteDeBanda,
  CUANTAS_BANDAS,
} from '@/lib/potencial';

/** El cuadro, en unidades del dibujo. */
const ANCHO = 720;
const ALTURA = 470;
const IZQ = 104;
const DER = 16;
const ARRIBA = 14;
const ABAJO = 38;

const X0 = IZQ;
const X1 = ANCHO - DER;
const Y0 = ALTURA - ABAJO;
const Y1 = ARRIBA;

const TINTA = '#16202b';
const SUAVE = '#8a857c';
const LINEA = '#ded9d1';
const AZUL = '#2b4468';
const BANDA = '#e7eef6';

function x(edad: number): number {
  return X0 + ((edad - EDAD_MIN) / (EDAD_MAX - EDAD_MIN)) * (X1 - X0);
}

function y(escalon: number): number {
  return Y0 - (escalon / ALTO) * (Y0 - Y1);
}

/** El límite de una banda, muestreado año a año. */
function curva(n: number): string {
  const puntos: string[] = [];
  for (let edad = EDAD_MIN; edad <= EDAD_MAX; edad++) {
    puntos.push(`${x(edad).toFixed(1)},${y(limiteDeBanda(n, edad)).toFixed(1)}`);
  }
  return `M ${puntos.join(' L ')}`;
}

/** La banda entera, para pintarla: su límite de ida y el de abajo de vuelta. */
function franja(n: number): string {
  const ida: string[] = [];
  const vuelta: string[] = [];
  for (let edad = EDAD_MIN; edad <= EDAD_MAX; edad++) {
    ida.push(`${x(edad).toFixed(1)},${y(limiteDeBanda(n, edad)).toFixed(1)}`);
    const abajo = n > 1 ? limiteDeBanda(n - 1, edad) : 0;
    vuelta.unshift(`${x(edad).toFixed(1)},${y(abajo).toFixed(1)}`);
  }
  return `M ${ida.join(' L ')} L ${vuelta.join(' L ')} Z`;
}

export default function Progreso({
  edad,
  dias,
}: {
  /** La edad del día de la entrevista. */
  edad: number;
  /** El horizonte temporal que le atribuyó la evaluadora, en días. */
  dias: number;
}) {
  const escalon = escalonDe(dias);
  const banda = bandaDe(edad, dias);
  const enCuadro = Math.min(Math.max(edad, EDAD_MIN), EDAD_MAX);

  // Las edades redondas que quedan por delante: es lo que la banda agrega al
  // dato de hoy. Ninguna si la persona ya pasó los sesenta.
  const adelante = [40, 50, 60].filter((e) => e > edad + 2 && e <= EDAD_MAX);

  return (
    <svg
      className="inf-progreso"
      viewBox={`0 0 ${ANCHO} ${ALTURA}`}
      role="img"
      aria-label={`Diagrama de progreso potencial: ${edad} años, horizonte en el estrato ${
        estratoDeEscalon(escalon).romano
      }`}
    >
      {/* Los estratos, en franjas alternadas: es lo que se lee en el eje. */}
      {ESTRATOS.map((e, i) => (
        <rect
          key={e.romano}
          x={X0}
          y={y(e.hasta)}
          width={X1 - X0}
          height={y(e.desde) - y(e.hasta)}
          fill={i % 2 === 0 ? '#faf9f6' : '#ffffff'}
        />
      ))}

      {/* Los escalones intermedios, sin rótulo: le dan la forma a las curvas. */}
      {ESCALERA.map((_, i) =>
        i % 3 === 0 ? null : (
          <line key={i} x1={X0} y1={y(i)} x2={X1} y2={y(i)} stroke={LINEA} strokeWidth={0.5} />
        )
      )}

      {/* La banda de la persona, pintada. */}
      <path d={franja(banda)} fill={BANDA} />

      {/* Las ocho curvas. La de su banda, más marcada. */}
      {Array.from({ length: CUANTAS_BANDAS }, (_, i) => i + 1).map((n) => (
        <path
          key={n}
          d={curva(n)}
          fill="none"
          stroke={n === banda || n === banda - 1 ? AZUL : SUAVE}
          strokeWidth={n === banda || n === banda - 1 ? 1.6 : 0.8}
          strokeOpacity={n === banda || n === banda - 1 ? 0.9 : 0.5}
        />
      ))}

      {/* Los techos de estrato, por encima de las curvas: son la referencia. */}
      {ESTRATOS.map((e) => (
        <line
          key={e.romano}
          x1={X0}
          y1={y(e.hasta)}
          x2={X1}
          y2={y(e.hasta)}
          stroke={TINTA}
          strokeWidth={0.7}
          strokeOpacity={0.35}
        />
      ))}

      {/* Eje de la izquierda: un rótulo por estrato, con su techo en años. */}
      {ESTRATOS.map((e) => {
        const medio = (y(e.desde) + y(e.hasta)) / 2;
        return (
          <g key={`rot-${e.romano}`}>
            <text x={X0 - 10} y={y(e.hasta) + 4} textAnchor="end" fontSize={10} fill={SUAVE}>
              {ESCALERA[e.hasta].texto}
            </text>
            <text
              x={X0 - 10}
              y={medio + 4}
              textAnchor="end"
              fontSize={11}
              fill={TINTA}
              fontWeight={600}
            >
              {e.romano}
              {e.mide ? ` · ${e.nombre}` : ''}
            </text>
          </g>
        );
      })}

      {/* Eje de abajo: la edad, de cinco en cinco. */}
      {Array.from({ length: (EDAD_MAX - EDAD_MIN) / 5 + 1 }, (_, i) => EDAD_MIN + i * 5).map(
        (e) => (
          <g key={`edad-${e}`}>
            <line x1={x(e)} y1={Y0} x2={x(e)} y2={Y1} stroke={LINEA} strokeWidth={0.5} />
            <text x={x(e)} y={Y0 + 16} textAnchor="middle" fontSize={10} fill={SUAVE}>
              {e}
            </text>
          </g>
        )
      )}
      <text x={(X0 + X1) / 2} y={ALTURA - 6} textAnchor="middle" fontSize={10} fill={SUAVE}>
        Edad
      </text>

      {/* El marco. */}
      <rect
        x={X0}
        y={Y1}
        width={X1 - X0}
        height={Y0 - Y1}
        fill="none"
        stroke={TINTA}
        strokeWidth={0.8}
      />

      {/* Hasta dónde llega su banda: una marca en cada edad redonda que sigue. */}
      {adelante.map((e) => {
        const h = horizonteEn(banda, e);
        return (
          <g key={`ade-${e}`}>
            <circle cx={x(e)} cy={y(h)} r={3} fill="#ffffff" stroke={AZUL} strokeWidth={1.2} />
            <text
              x={x(e)}
              y={y(h) - 8}
              textAnchor="middle"
              fontSize={9.5}
              fill={AZUL}
              fontWeight={600}
            >
              {estratoDeEscalon(h).romano}
            </text>
          </g>
        );
      })}

      {/* La persona, hoy. */}
      <line
        x1={x(enCuadro)}
        y1={Y0}
        x2={x(enCuadro)}
        y2={y(escalon)}
        stroke={AZUL}
        strokeWidth={0.8}
        strokeDasharray="2 3"
      />
      <circle cx={x(enCuadro)} cy={y(escalon)} r={5} fill={AZUL} />
      <text
        x={x(enCuadro) + (enCuadro > EDAD_MAX - 10 ? -10 : 10)}
        y={y(escalon) - 9}
        textAnchor={enCuadro > EDAD_MAX - 10 ? 'end' : 'start'}
        fontSize={11}
        fontWeight={600}
        fill={AZUL}
      >
        Hoy
      </text>
    </svg>
  );
}
