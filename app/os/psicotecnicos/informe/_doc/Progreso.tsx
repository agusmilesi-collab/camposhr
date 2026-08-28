/**
 * El diagrama de progreso potencial, con el punto de la persona.
 *
 * Es la lámina de Elliot Jaques tal como está publicada, con todo lo que trae:
 * la edad arriba y abajo, el horizonte temporal a la izquierda con sus
 * veintidós franjas (ID, IC, IB, IA, IIC…) y el nombre del grupo al costado, y
 * a la derecha en qué termina cada banda de maduración a los sesenta y cinco.
 * Lo único que se agrega es el punto de la persona y la banda por la que viene
 * subiendo.
 *
 * **Es un dibujo, no una imagen.** El informe se imprime y se lee en pantalla:
 * un PNG queda pixelado al ampliarlo y sus rótulos no se pueden buscar ni leer
 * en voz alta. Todo lo que se ve acá son líneas y texto de verdad.
 *
 * Sin `use client`: son etiquetas y números, sin nada que tocar, así que sirve
 * igual en el informe (que se arma en el servidor) y en la ficha.
 */

import {
  ALTO,
  diasDeEscalon,
  enPalabras,
  EDAD_MAX,
  EDAD_MIN,
  ESCALERA,
  ESTRATOS,
  PISO,
  bandaDe,
  escalonDe,
  estratoDeEscalon,
  horizonteEn,
  limiteDeBanda,
  CUANTAS_BANDAS,
} from '@/lib/potencial';

/** El cuadro, en unidades del dibujo. */
const ANCHO = 980;
const ALTURA = 700;

/** Las columnas de la izquierda, de afuera hacia adentro. */
const TITULO = 16;
const HORAS = 128;
const GRUPO_X = 136;
const GRUPO_ANCHO = 24;
const CELDA_ANCHO = 46;

const X0 = GRUPO_X + GRUPO_ANCHO + CELDA_ANCHO;
const X1 = ANCHO - 60;
const Y1 = 44;
const Y0 = ALTURA - 62;

/** Alto de cada franja: veintidós, todas iguales. */
const FRANJAS = ESCALERA.length;

const TINTA = '#16202b';
const SUAVE = '#8a857c';
const LINEA = '#ded9d1';
const FINA = '#efece6';
const AZUL = '#2b4468';
const PINTADA = '#e7eef6';

function x(edad: number): number {
  return X0 + ((edad - EDAD_MIN) / (EDAD_MAX - EDAD_MIN)) * (X1 - X0);
}

/** El escalón `u` en coordenadas del dibujo. `PISO` es el borde de abajo. */
function y(u: number): number {
  return Y0 - ((u - PISO) / (ALTO - PISO)) * (Y0 - Y1);
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
    const abajo = n > 1 ? limiteDeBanda(n - 1, edad) : PISO;
    vuelta.unshift(`${x(edad).toFixed(1)},${y(abajo).toFixed(1)}`);
  }
  return `M ${ida.join(' L ')} L ${vuelta.join(' L ')} Z`;
}

/**
 * Texto de costado, como los rótulos de grupo de la lámina.
 *
 * Los nombres largos van en dos renglones: "Estratégico corporativo" de un tirón
 * mide más que el alto de su estrato y se montaba sobre el de al lado, que es
 * también como lo resuelve la lámina.
 */
function Vertical({
  cx,
  cy,
  children,
  size = 8,
  peso = 400,
  color = TINTA,
}: {
  cx: number;
  cy: number;
  children: string;
  size?: number;
  peso?: number;
  color?: string;
}) {
  const corte = children.indexOf(' ');
  const lineas = children.length > 12 && corte > 0
    ? [children.slice(0, corte), children.slice(corte + 1)]
    : [children];
  return (
    <>
      {lineas.map((linea, i) => {
        // Girado noventa grados, correr la `y` es lo que separa un renglón del
        // siguiente en la pantalla: la `x` los corre a lo largo del texto.
        const off = (i - (lineas.length - 1) / 2) * (size + 1.5);
        return (
          <text
            key={linea}
            x={cx}
            y={cy + off}
            transform={`rotate(-90 ${cx} ${cy})`}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={size}
            fontWeight={peso}
            fill={color}
          >
            {linea}
          </text>
        );
      })}
    </>
  );
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
  const edades = Array.from({ length: (EDAD_MAX - EDAD_MIN) / 5 + 1 }, (_, i) => EDAD_MIN + i * 5);

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
      {/* ── Columna de la izquierda ─────────────────────────────────────── */}
      <Vertical cx={TITULO} cy={(Y0 + Y1) / 2} size={9.5} peso={600} color={SUAVE}>
        HORIZONTE TEMPORAL
      </Vertical>

      {/* Cada marca de la escalera es el techo de su franja, así que el rótulo
          va sobre la raya y no en el medio: es como se lee en la lámina. */}
      {ESCALERA.map((m, i) => (
        <text key={m.celda} x={HORAS} y={y(i) + 3} textAnchor="end" fontSize={8.5} fill={TINTA}>
          {m.texto}
        </text>
      ))}

      {/* Los grupos, de costado, y las franjas con su nombre. */}
      {ESTRATOS.map((e) => (
        <g key={`grupo-${e.romano}`}>
          <rect
            x={GRUPO_X}
            y={y(e.hasta)}
            width={GRUPO_ANCHO}
            height={y(e.desde) - y(e.hasta)}
            fill="none"
            stroke={TINTA}
            strokeWidth={0.7}
          />
          <Vertical cx={GRUPO_X + GRUPO_ANCHO / 2} cy={(y(e.desde) + y(e.hasta)) / 2}>
            {e.grupo}
          </Vertical>
        </g>
      ))}

      {ESCALERA.map((m, i) => (
        <g key={`celda-${m.celda}`}>
          <rect
            x={GRUPO_X + GRUPO_ANCHO}
            y={y(i)}
            width={CELDA_ANCHO}
            height={(Y0 - Y1) / FRANJAS}
            fill="none"
            stroke={LINEA}
            strokeWidth={0.6}
          />
          <text
            x={GRUPO_X + GRUPO_ANCHO + CELDA_ANCHO / 2}
            y={y(i) + (Y0 - Y1) / FRANJAS / 2 + 3}
            textAnchor="middle"
            fontSize={8.5}
            fontWeight={600}
            fill={TINTA}
          >
            {m.celda}
          </text>
        </g>
      ))}

      {/* ── El cuadro ───────────────────────────────────────────────────── */}
      {/* La banda de la persona va debajo de la cuadrícula: pintada encima,
          tapaba las líneas de la escalera justo donde hay que leer el punto. */}
      <path d={franja(banda)} fill={PINTADA} />

      {/* Una vertical por año, como la lámina: son las que dejan seguir una
          curva sin regla. Las de los cinco en cinco, más marcadas. */}
      {Array.from({ length: EDAD_MAX - EDAD_MIN + 1 }, (_, i) => EDAD_MIN + i).map((e) => (
        <line
          key={`v-${e}`}
          x1={x(e)}
          y1={Y1}
          x2={x(e)}
          y2={Y0}
          stroke={e % 5 === 0 ? LINEA : FINA}
          strokeWidth={e % 5 === 0 ? 0.7 : 0.4}
        />
      ))}

      {/* Una horizontal por franja; la del techo de cada estrato, más marcada. */}
      {ESCALERA.map((m, i) => (
        <line
          key={`h-${m.celda}`}
          x1={X0}
          y1={y(i)}
          x2={X1}
          y2={y(i)}
          stroke={ESTRATOS.some((e) => e.hasta === i) ? LINEA : FINA}
          strokeWidth={ESTRATOS.some((e) => e.hasta === i) ? 0.8 : 0.4}
        />
      ))}

      {Array.from({ length: CUANTAS_BANDAS }, (_, i) => i + 1).map((n) => (
        <path
          key={n}
          d={curva(n)}
          fill="none"
          stroke={n === banda || n === banda - 1 ? AZUL : TINTA}
          strokeWidth={n === banda || n === banda - 1 ? 1.7 : 1}
          strokeOpacity={n === banda || n === banda - 1 ? 0.95 : 0.55}
        />
      ))}

      <rect
        x={X0}
        y={Y1}
        width={X1 - X0}
        height={Y0 - Y1}
        fill="none"
        stroke={TINTA}
        strokeWidth={0.9}
      />

      {/* ── Columna de la derecha ───────────────────────────────────────── */}
      {/* En qué termina cada banda a los sesenta y cinco: es lo que la lámina
          rotula del lado derecho, y lo que dice hasta dónde llega cada camino. */}
      {Array.from({ length: CUANTAS_BANDAS }, (_, i) => i + 1).map((n) => {
        const arriba = Math.min(ALTO, limiteDeBanda(n, EDAD_MAX));
        const abajo = n > 1 ? limiteDeBanda(n - 1, EDAD_MAX) : PISO;
        if (arriba - abajo < 1.2) return null;
        const e = estratoDeEscalon((arriba + abajo) / 2);
        return (
          <g key={`der-${n}`}>
            <rect
              x={X1}
              y={y(arriba)}
              width={24}
              height={y(abajo) - y(arriba)}
              fill="none"
              stroke={LINEA}
              strokeWidth={0.6}
            />
            <Vertical
              cx={X1 + 12}
              cy={(y(arriba) + y(abajo)) / 2}
              color={n === banda ? AZUL : TINTA}
              peso={n === banda ? 700 : 400}
            >
              {e.grupo}
            </Vertical>
          </g>
        );
      })}

      {/* ── Edad, arriba y abajo ────────────────────────────────────────── */}
      {edades.map((e) => (
        <g key={`edad-${e}`}>
          <text x={x(e)} y={Y1 - 8} textAnchor="middle" fontSize={9.5} fill={TINTA}>
            {e}
          </text>
          <text x={x(e)} y={Y0 + 16} textAnchor="middle" fontSize={9.5} fill={TINTA}>
            {e}
          </text>
        </g>
      ))}
      <text
        x={(X0 + X1) / 2}
        y={ALTURA - 22}
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={600}
        fill={SUAVE}
      >
        EDAD
      </text>

      {/* ── La persona ──────────────────────────────────────────────────── */}
      {adelante.map((e) => {
        const h = horizonteEn(banda, e);
        return (
          <g key={`ade-${e}`}>
            {/* Al pasar por encima, qué es ese punto: el navegador lo muestra
                solo y no ocupa lugar en el dibujo, que es lo que hace falta en
                una lámina con nueve curvas. */}
            <title>
              {`A los ${e} años, por su banda de maduración: horizonte de ` +
                `${enPalabras(diasDeEscalon(h))}, estrato ${estratoDeEscalon(h).romano}`}
            </title>
            {/* Una zona de contacto invisible alrededor del punto: apuntarle a
                un círculo de tres píxeles para leer su explicación es imposible
                con el mouse. `transparent` sí recibe el puntero; `none` no. */}
            <circle cx={x(e)} cy={y(h)} r={16} fill="transparent" />
            <circle cx={x(e)} cy={y(h)} r={3.2} fill="#ffffff" stroke={AZUL} strokeWidth={1.3} />
            <text
              x={x(e)}
              y={y(h) - 8}
              textAnchor="middle"
              fontSize={9.5}
              fill={AZUL}
              fontWeight={700}
            >
              {estratoDeEscalon(h).romano}
            </text>
          </g>
        );
      })}

      <line
        x1={x(enCuadro)}
        y1={Y0}
        x2={x(enCuadro)}
        y2={y(escalon)}
        stroke={AZUL}
        strokeWidth={0.9}
        strokeDasharray="2 3"
      />
      <g>
        <title>
          {`Hoy: ${edad} años y un horizonte de ${enPalabras(dias)}, ` +
            `que cae en el estrato ${estratoDeEscalon(escalon).romano}`}
        </title>
        <circle cx={x(enCuadro)} cy={y(escalon)} r={16} fill="transparent" />
        <circle cx={x(enCuadro)} cy={y(escalon)} r={5} fill={AZUL} />
        <text
          x={x(enCuadro) + (enCuadro > EDAD_MAX - 10 ? -10 : 10)}
          y={y(escalon) - 9}
          textAnchor={enCuadro > EDAD_MAX - 10 ? 'end' : 'start'}
          fontSize={11}
          fontWeight={700}
          fill={AZUL}
        >
          Hoy
        </text>
      </g>
    </svg>
  );
}
