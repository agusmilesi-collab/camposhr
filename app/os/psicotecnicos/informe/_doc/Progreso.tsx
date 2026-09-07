/**
 * El diagrama de progreso potencial, con el punto de la persona.
 *
 * Es la lámina de Elliot Jaques tal como está publicada, con todo lo que trae:
 * la edad arriba y abajo, el horizonte temporal a la izquierda con sus
 * veintidós franjas (ID, IC, IB, IA, IIC…), y a la derecha en qué termina cada
 * banda de maduración a los sesenta y cinco.
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
  alturaDelEscalon,
  diasDeEscalon,
  enPalabras,
  EDAD_MAX,
  EDAD_MIN,
  ESCALERA,
  PISO,
  bandaDe,
  curvaDeLamina,
  edadEnQueLlega,
  escalonDe,
  estratoDeEscalon,
  horizonteEn,
  limiteDeBanda,
  pisoDeBanda,
  tramosDeLamina,
  CUANTAS_BANDAS,
} from '@/lib/potencial';

/**
 * El cuadro, en unidades del dibujo.
 *
 * Más alto que ancho, como la lámina original: son veintidós franjas de
 * horizonte contra cincuenta años de edad, y en un cuadro cuadrado cada franja
 * queda tan baja que las curvas se ven planas y se pegan entre sí. En la lámina
 * cada franja mide más de la mitad de lo que miden cinco años del eje de abajo,
 * y con esa proporción se separan.
 */
const ANCHO = 933;
const ALTURA = 1180;

/** Las columnas de la izquierda, de afuera hacia adentro. */
const TITULO = 16;
const HORAS = 128;
const CELDA_X = 136;
const CELDA_ANCHO = 23;

const X0 = CELDA_X + CELDA_ANCHO;
const X1 = ANCHO - 60;
/**
 * Hasta qué escalón sigue el dibujo por encima de los cien años.
 *
 * Las dos curvas más altas cruzan el techo del cuadro antes de los setenta, así
 * que sus franjas no llegan al borde derecho y no se pueden rotular al costado.
 * La lámina las sigue dibujando dos tercios de franja más arriba, y en esa banda
 * escribe el nombre del modo más alto: el borde de arriba de la banda arranca
 * donde la primera curva lo toca, así que el costado izquierdo de la banda es la
 * curva misma y no una raya vertical.
 */
const CORONA_ESCALONES = 0.68;
const Y1 = 44 + 22;
const Y0 = ALTURA - 62;
/** Ese mismo alto, en píxeles. */
const CORONA = (CORONA_ESCALONES * (Y0 - Y1)) / (ALTO - PISO);
/** El escalón del borde de arriba de la banda. */
const CIMA = ALTO + CORONA_ESCALONES;

/** El alto del cuadro en unidades de celda alta, para normalizar la escala. */
const TOTAL = alturaDelEscalon(ALTO);

const TINTA = '#16202b';
const SUAVE = '#8a857c';
/* La cuadrícula va en tinta transparente y no en un crema opaco: sobre la
   banda pintada, el crema desaparecía y el cuadro se cortaba justo donde hay
   que leer el punto. */
const LINEA = 'rgba(22, 32, 43, 0.16)';
const FINA = 'rgba(22, 32, 43, 0.07)';
const AZUL = '#2b4468';
const PINTADA = '#e7eef6';

/** Los diez modos, como los nombra la lámina. */
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function x(edad: number): number {
  return X0 + ((edad - EDAD_MIN) / (EDAD_MAX - EDAD_MIN)) * (X1 - X0);
}

/**
 * El escalón `u` en coordenadas del dibujo. `PISO` es el borde de abajo.
 *
 * No es proporcional al escalón: las celdas de los estratos I y II son más
 * bajas que las de arriba, como en la lámina (ver `alturaDelEscalon`).
 */
function y(u: number): number {
  return Y0 - (alturaDelEscalon(u) / TOTAL) * (Y0 - Y1);
}

/**
 * Cuánto sigue subiendo la curva `i` en el ancho del margen derecho.
 *
 * Es su pendiente en el borde llevada a los veintiséis píxeles del margen. Sale
 * negativo porque en el dibujo subir es restar.
 */
function inclinacion(i: number): number {
  const pend = (y(curvaDeLamina(i, EDAD_MAX)) - y(curvaDeLamina(i, EDAD_MAX - 1))) /
    (x(EDAD_MAX) - x(EDAD_MAX - 1));
  return Math.max(-26, pend * 26);
}

/**
 * El cuerpo de letra del nombre de una franja, para que entre en su columna.
 *
 * Las romanas van de dos a cinco letras y la columna es angosta, así que las
 * largas se achican lo justo. Se mide letra por letra y no por cantidad: la I es
 * angosta y la M ancha, y "VIIIM" ocupa bastante más que "IIIA" con las mismas
 * cinco letras de ancho nominal.
 */
const ANCHO_DE_LETRA: Record<string, number> = { I: 0.35, V: 0.72, M: 0.89, A: 0.72, B: 0.66 };
function cuerpoDeFranja(celda: string): number {
  const em = [...celda].reduce((suma, letra) => suma + (ANCHO_DE_LETRA[letra] ?? 0.6), 0);
  return em ? Math.min(8.5, (CELDA_ANCHO - 5) / em) : 8.5;
}

/** Un punto de la curva, de edad y altura de papel a coordenadas del dibujo. */
function xy(edad: number, alto: number): string {
  const px = X0 + ((edad - EDAD_MIN) / (EDAD_MAX - EDAD_MIN)) * (X1 - X0);
  const py = Y0 - (alto / TOTAL) * (Y0 - Y1);
  return `${px.toFixed(2)},${py.toFixed(2)}`;
}

/**
 * El límite de una banda, como curva y no como poligonal.
 *
 * Los tramos vienen ya calculados de `tramosDeLamina` y cada uno entra como un
 * comando `C`: seis por curva. Es la curva misma y no una sucesión de rectas
 * que se le parece, así que no hay paso de muestreo que elegir entre un trazo
 * quebrado y un dibujo pesado.
 */
function curva(i: number): string {
  const tramos = tramosDeLamina(i);
  if (tramos.length === 0) return '';
  const partes = tramos.map(
    (t) =>
      `C ${xy(t.tiroEdad1, t.tiroAlto1)} ${xy(t.tiroEdad2, t.tiroAlto2)} ${xy(t.edadFin, t.altoFin)}`,
  );
  return `M ${xy(tramos[0].edad, tramos[0].alto)} ${partes.join(' ')}`;
}

/** La banda entera, para pintarla: su límite de ida y el de abajo de vuelta. */
function franja(n: number): string {
  const arriba = tramosDeLamina(n + 1);
  const abajo = tramosDeLamina(n);
  if (arriba.length === 0 || abajo.length === 0) return '';
  const ida = arriba.map(
    (t) =>
      `C ${xy(t.tiroEdad1, t.tiroAlto1)} ${xy(t.tiroEdad2, t.tiroAlto2)} ${xy(t.edadFin, t.altoFin)}`,
  );
  /* De vuelta se recorre el piso al revés, así que cada tramo va del final al
     principio y sus dos puntos de tiro cambian de orden. */
  const vuelta = abajo
    .slice()
    .reverse()
    .map(
      (t) =>
        `C ${xy(t.tiroEdad2, t.tiroAlto2)} ${xy(t.tiroEdad1, t.tiroAlto1)} ${xy(t.edad, t.alto)}`,
    );
  const ultimo = abajo[abajo.length - 1];
  return (
    `M ${xy(arriba[0].edad, arriba[0].alto)} ${ida.join(' ')} ` +
    `L ${xy(ultimo.edadFin, ultimo.altoFin)} ${vuelta.join(' ')} Z`
  );
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
  diasAplicado = null,
}: {
  /** La edad del día de la entrevista. */
  edad: number;
  /** El horizonte de su capacidad, que es el que ubica la banda. */
  dias: number;
  /**
   * El plazo del trabajo que tiene asignado hoy, si es otro.
   *
   * La banda se dibuja con la capacidad y no con esto: un puesto que no exige
   * lo que la persona puede la pondría en una banda más baja y la proyección
   * saldría corta. Pero el dato importa, así que se marca aparte: la distancia
   * entre los dos puntos es lo que el puesto le está dejando sin usar.
   */
  diasAplicado?: number | null;
}) {
  const escalon = escalonDe(dias);
  const banda = bandaDe(edad, dias);
  const enCuadro = Math.min(Math.max(edad, EDAD_MIN), EDAD_MAX);
  const edades = Array.from({ length: (EDAD_MAX - EDAD_MIN) / 5 + 1 }, (_, i) => EDAD_MIN + i * 5);

  // Las edades redondas que quedan por delante: es lo que la banda agrega al
  // dato de hoy. Ninguna si la persona ya pasó los sesenta.
  const adelante = [40, 50, 60].filter((e) => e > edad + 2 && e <= EDAD_MAX);

  /* El plazo del trabajo asignado, cuando cae en otro escalón que la capacidad:
     dibujarlo encima del otro punto sería una sola marca dicha dos veces. */
  const escalonAplicado =
    diasAplicado !== null && Math.abs(escalonDe(diasAplicado) - escalon) > 0.15
      ? escalonDe(diasAplicado)
      : null;

  return (
    <svg
      className="inf-progreso"
      viewBox={`0 0 ${ANCHO} ${ALTURA}`}
      role="img"
      aria-label={`Diagrama de progreso potencial: ${edad} años, horizonte en el estrato ${
        estratoDeEscalon(escalon).romano
      }`}
    >
      {/* Las curvas se recortan al cuadro: las de los modos altos se van por
          arriba antes de los cuarenta, y sin esto seguían dibujándose sobre los
          rótulos y fuera del marco. */}
      <defs>
        <clipPath id="progreso-cuadro">
          <rect x={X0} y={Y1} width={X1 - X0} height={Y0 - Y1} />
        </clipPath>
        {/* Las curvas siguen dibujándose dentro de la banda de arriba: es donde
            se ve cuál se va primero y dónde arranca el techo de la banda. */}
        <clipPath id="progreso-con-banda">
          <rect x={X0} y={Y1 - CORONA} width={X1 - X0} height={Y0 - Y1 + CORONA} />
        </clipPath>
      </defs>

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

      {/* Cada celda va del escalón anterior al suyo, y su alto es el de esa
          franja: las de abajo miden menos. La primera es la celda sin nombre
          que la lámina dibuja debajo del día. */}
      {ESCALERA.map((m, i) => {
        const arriba = y(i);
        const abajo = y(i - 1);
        return (
          <g key={`celda-${i}`}>
            <rect
              x={CELDA_X}
              y={arriba}
              width={CELDA_ANCHO}
              height={abajo - arriba}
              fill="none"
              stroke={LINEA}
              strokeWidth={0.6}
            />
            <text
              x={CELDA_X + CELDA_ANCHO / 2}
              y={(arriba + abajo) / 2 + 3}
              textAnchor="middle"
              fontSize={cuerpoDeFranja(m.celda)}
              fontWeight={600}
              fill={TINTA}
            >
              {m.celda}
            </text>
          </g>
        );
      })}

      {/* ── El cuadro ───────────────────────────────────────────────────── */}
      {/* La banda de la persona va debajo de la cuadrícula, y la cuadrícula en
          tinta transparente: así se dibuja entera por encima del celeste. */}
      <g clipPath="url(#progreso-cuadro)">
        <path d={franja(banda)} fill={PINTADA} />
      </g>

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

      {/* Una horizontal por franja. Las de los escalones múltiplos de tres van
          más marcadas: son las fronteras de estrato, y el día es una de ellas
          aunque debajo no haya otro estrato. */}
      {ESCALERA.map((m, i) => {
        const frontera = i % 3 === 0;
        return (
          <line
            key={`h-${i}`}
            x1={X0}
            y1={y(i)}
            x2={X1}
            y2={y(i)}
            stroke={frontera ? LINEA : FINA}
            strokeWidth={frontera ? 0.8 : 0.4}
          />
        );
      })}

      <g clipPath="url(#progreso-con-banda)">
        {Array.from({ length: CUANTAS_BANDAS + 1 }, (_, i) => i + 1).map((n) => {
          const suya = n === banda + 1 || n === banda;
          // Las dos más altas van punteadas, como en la lámina: son las que se
          // van del cuadro y quedan por encima de lo que mide el instrumento.
          const puntos = n > CUANTAS_BANDAS - 1;
          return (
            <path
              key={n}
              d={curva(n)}
              fill="none"
              stroke={suya ? AZUL : TINTA}
              strokeWidth={suya ? 1.7 : 1}
              strokeOpacity={suya ? 0.95 : 0.55}
              strokeDasharray={puntos ? '1.5 2.5' : undefined}
              strokeLinecap={puntos ? 'round' : undefined}
            />
          );
        })}
      </g>

      <rect
        x={X0}
        y={Y1}
        width={X1 - X0}
        height={Y0 - Y1}
        fill="none"
        stroke={TINTA}
        strokeWidth={0.9}
      />

      {/* La banda de arriba: su techo arranca donde la curva más alta lo toca,
          así que el costado izquierdo de la banda es esa curva. El nombre del
          modo va entre ella y la siguiente, que son las dos que la cruzan. */}
      {(() => {
        const cima = edadEnQueLlega(CUANTAS_BANDAS + 1, CIMA);
        if (cima === null) return null;
        const segunda = edadEnQueLlega(CUANTAS_BANDAS, ALTO);
        const centro = segunda === null ? (x(cima) + X1) / 2 : (x(cima) + x(segunda)) / 2;
        return (
          <g>
            {/* Del trazo del margen y no del marco: el grueso queda para donde
                termina la cuadrícula. Baja hasta el techo del cuadro al llegar
                al borde de afuera: la banda es un ángulo y ahí es donde cierra
                contra la franja del modo de abajo. */}
            <path
              d={`M ${x(cima)} ${Y1 - CORONA} L ${X1 + 26} ${Y1 - CORONA} L ${X1 + 26} ${Y1}`}
              fill="none"
              stroke={LINEA}
              strokeWidth={0.6}
            />
            <text
              x={centro}
              y={Y1 - CORONA / 2 + 3.2}
              textAnchor="middle"
              fontSize={9}
              fill={CUANTAS_BANDAS === banda ? AZUL : TINTA}
              fontWeight={CUANTAS_BANDAS === banda ? 700 : 400}
            >
              {`Modo ${ROMANOS[CUANTAS_BANDAS - 1]}`}
            </text>
          </g>
        );
      })()}

      {/* ── Columna de la derecha ───────────────────────────────────────── */}
      {/* Los modos, que es lo que la lámina rotula de este lado: cada franja del
          margen es un modo, y su nombre va donde esa franja sale del cuadro. La
          de la persona va marcada. */}
      {Array.from({ length: CUANTAS_BANDAS }, (_, i) => i + 1).map((n) => {
        const arriba = Math.min(ALTO, limiteDeBanda(n, EDAD_MAX));
        // El modo I se lleva todo lo que queda debajo de su curva de abajo: no
        // hay un modo por debajo, así que su franja cierra en el piso del cuadro.
        const abajo = n === 1 ? PISO : Math.min(ALTO, pisoDeBanda(n, EDAD_MAX));
        if (arriba - abajo < 1.2) return null;
        // La raya que separa dos franjas del margen sigue la pendiente con la
        // que su curva llega al borde: en la lámina el margen no es una escalera
        // de rayas horizontales, es la continuación de las curvas.
        const yArriba = y(arriba) + inclinacion(n + 1);
        // Salvo la base del modo I, que no es una curva sino el piso del cuadro:
        // el modo I se lleva todo lo que queda debajo de la primera, así que su
        // franja apoya en el borde de abajo y ahí sigue derecha.
        const yAbajo = n === 1 ? y(abajo) : y(abajo) + inclinacion(n);
        // La franja más alta no lleva techo propio: su curva ya se fue por
        // arriba del cuadro y quien cierra ahí es la banda del modo de encima,
        // que baja por el borde de afuera hasta esta misma altura.
        const techo = arriba < ALTO ? `M ${X1} ${y(arriba)} L ${X1 + 26} ${yArriba} ` : `M ${X1 + 26} ${Y1} `;
        return (
          <g key={`der-${n}`}>
            <path
              d={`${techo}L ${X1 + 26} ${yAbajo} L ${X1} ${y(abajo)}`}
              fill="none"
              stroke={LINEA}
              strokeWidth={0.6}
            />
            <Vertical
              cx={X1 + 13}
              cy={(y(arriba) + y(abajo) + yArriba + yAbajo) / 4}
              color={n === banda ? AZUL : TINTA}
              peso={n === banda ? 700 : 400}
            >
              {`Modo ${ROMANOS[n - 1]}`}
            </Vertical>
          </g>
        );
      })}

      {/* ── Edad, arriba y abajo ────────────────────────────────────────── */}
      {/* Sólo abajo: la lámina no repite la edad arriba, ahí va el título y la
          banda del modo más alto. */}
      {edades.map((e) => (
        <text key={`edad-${e}`} x={x(e)} y={Y0 + 16} textAnchor="middle" fontSize={9.5} fill={TINTA}>
          {e}
        </text>
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
      {/* Lo que el puesto de hoy le pide, cuando es menos que lo que puede. */}
      {escalonAplicado !== null && (
        <g>
          <title>
            {`En el trabajo que tiene asignado responde por tareas de hasta ${enPalabras(
              diasAplicado as number
            )}, que cae en el estrato ${estratoDeEscalon(escalonAplicado).romano}`}
          </title>
          <circle cx={x(enCuadro)} cy={y(escalonAplicado)} r={14} fill="transparent" />
          <rect
            x={x(enCuadro) - 4.5}
            y={y(escalonAplicado) - 4.5}
            width={9}
            height={9}
            fill="#ffffff"
            stroke={SUAVE}
            strokeWidth={1.4}
          />
          <text
            x={x(enCuadro) + (enCuadro > EDAD_MAX - 10 ? -10 : 10)}
            y={y(escalonAplicado) + 12}
            textAnchor={enCuadro > EDAD_MAX - 10 ? 'end' : 'start'}
            fontSize={9.5}
            fill={SUAVE}
          >
            Su puesto de hoy
          </text>
        </g>
      )}

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
