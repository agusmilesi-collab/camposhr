/**
 * El gráfico del Benziger: los cuatro cuadrantes sobre el cerebro.
 *
 * El cerebro de fondo, una escala de círculos cada veinte puntos, cuatro ejes
 * que salen del centro en diagonal hacia la parte del cerebro que nombra cada
 * cuadrante, y los dos perfiles: el adulto lleno y traslúcido, con su valor
 * escrito al lado de cada vértice, y el joven punteado y sin relleno.
 *
 * El perfil joven se dibuja multiplicado por cuatro, que es lo que hace la
 * plataforma de Benziger con el mismo dato. Se dedujo midiendo los vértices de
 * veinte gráficos suyos contra los valores del PDF: el cociente entre la escala
 * del joven y la del adulto dio 4,000 en todos, con error menor al 0,1 %.
 * Sin ese factor las dos figuras no son comparables, porque el cuestionario
 * joven se responde sobre menos ítems y su polígono queda hundido contra el
 * centro.
 *
 * La escala es de círculos y no de rombos: acompañan la forma del cerebro, que
 * con los rombos quedaba metido en un cuadrado. Sus números van sobre la guía
 * vertical, hacia arriba, que es por donde no pasa ningún eje ni cae ningún
 * vértice.
 *
 * Se probó pintar un sector circular por cuadrante y se descartó: lo pintado
 * quedaba redondo y no se leía como un perfil. Los valores se unen con rectas.
 *
 * Va en SVG y no como imagen porque los valores cambian en cada persona, y
 * porque así se imprime nítido en cualquier tamaño.
 */

import type { Cuatro } from '@/lib/benziger-perfil';

const MAXIMO = 120;
const ANILLOS = [20, 40, 60, 80, 100, 120];

/** Lo que la plataforma de Benziger le hace al perfil joven antes de dibujarlo. */
const ESCALA_JOVEN = 4;

/**
 * Hasta dónde se dibuja un valor que se pasa de la escala.
 *
 * La plataforma no recorta: con 126 en el adulto el vértice queda más afuera de
 * la punta del eje. Acá se corta recién en el borde del lienzo, porque recortar
 * en 120 aplastaría contra el círculo exterior a todo joven de 30 para arriba,
 * que es corriente, y dos personas distintas dibujarían la misma figura.
 */
const TOPE = 145;
/** El radio del círculo de 120, con el centro en (0,0). */
const R = 190;

/** Hacia dónde apunta el eje de cada cuadrante, en grados del lienzo. */
const ANGULO: Record<keyof Cuatro, number> = { FD: -45, BD: 45, BI: 135, FI: -135 };
const ORDEN: (keyof Cuatro)[] = ['FI', 'FD', 'BD', 'BI'];

const radio = (valor: number) => (Math.min(valor, TOPE) / MAXIMO) * R;

/** Dónde cae un valor sobre el eje de su cuadrante. */
function punto(clave: keyof Cuatro, valor: number): [number, number] {
  const a = (ANGULO[clave] * Math.PI) / 180;
  return [radio(valor) * Math.cos(a), radio(valor) * Math.sin(a)];
}

export default function Cerebro({
  adulto,
  joven,
  fondo = true,
  valores = true,
  preferentes = [],
}: {
  adulto: Cuatro | null;
  joven: Cuatro | null;
  /**
   * El dibujo del cerebro detrás del perfil.
   *
   * En el informe ubica cada cuadrante sobre la parte del cerebro que nombra.
   * En la ficha el gráfico mide doscientos píxeles y ahí el dibujo es una
   * mancha gris debajo de las líneas, así que va sin él.
   */
  fondo?: boolean;
  /**
   * El valor del adulto escrito al lado de cada vértice.
   *
   * En el informe evita estimar el número contra los círculos. En la ficha no
   * va: el gráfico es chico y los valores están en la tabla de al lado.
   */
  valores?: boolean;
  /** Los cuadrantes que predominan: su vértice va más grande. */
  preferentes?: (keyof Cuatro)[];
}) {
  const numero = (v: Cuatro | null, k: keyof Cuatro) =>
    v && typeof v[k] === 'number' ? (v[k] as number) : null;

  const trazo = (v: Cuatro | null, factor: number) =>
    v && ORDEN.every((k) => numero(v, k) !== null)
      ? ORDEN.map((k) =>
          punto(k, numero(v, k)! * factor)
            .map((n) => n.toFixed(1))
            .join(',')
        ).join(' ')
      : null;
  const trazoAdulto = trazo(adulto, 1);
  const trazoJoven = trazo(joven, ESCALA_JOVEN);

  return (
    <svg className="inf-cerebro" viewBox="-230 -230 460 460" role="img" aria-label="Perfil Benziger">
      {fondo && (
        <image
          href="/informe/cerebro.png"
          x="-215"
          y="-215"
          width="430"
          height="430"
          className="inf-cerebro-fondo"
          preserveAspectRatio="xMidYMid meet"
        />
      )}

      {ANILLOS.map((v) => (
        <circle key={v} cx="0" cy="0" r={radio(v)} className="inf-anillo" />
      ))}

      {/* La guía vertical, que separa izquierdo de derecho. La horizontal la
          dibuja el contenedor: cruza el capítulo entero, de margen a margen. */}
      <line x1="0" y1="-215" x2="0" y2="215" className="inf-eje-guia" />

      {/* Los cuatro ejes, del centro al borde del círculo. */}
      {ORDEN.map((k) => {
        const [x, y] = punto(k, MAXIMO);
        return <line key={k} x1="0" y1="0" x2={x} y2={y} className="inf-eje" />;
      })}

      {trazoJoven && <polygon points={trazoJoven} className="inf-perfil-joven" />}
      {trazoAdulto && <polygon points={trazoAdulto} className="inf-perfil-adulto" />}

      {trazoJoven &&
        ORDEN.map((k) => {
          const [x, y] = punto(k, numero(joven, k)! * ESCALA_JOVEN);
          return <circle key={k} cx={x} cy={y} r="3.5" className="inf-vertice inf-vertice-joven" />;
        })}
      {trazoAdulto &&
        ORDEN.map((k) => {
          const [x, y] = punto(k, numero(adulto, k)!);
          return (
            <circle
              key={k}
              cx={x}
              cy={y}
              r={preferentes.includes(k) ? 6.5 : 5}
              className="inf-vertice"
            />
          );
        })}

      {/* La escala, sobre la guía vertical y hacia arriba, con un halo del
          color de la hoja por si la línea de un perfil le pasa por debajo. */}
      {ANILLOS.map((v) => (
        <text key={v} x="0" y={-radio(v) + 4} textAnchor="middle" className="inf-escala">
          {v}
        </text>
      ))}

      {valores &&
        trazoAdulto &&
        ORDEN.map((k) => {
          const v = numero(adulto, k)!;
          const a = (ANGULO[k] * Math.PI) / 180;
          const r = Math.min(radio(v) + 20, 212);
          return (
            <text
              key={k}
              x={r * Math.cos(a)}
              y={r * Math.sin(a) + 5}
              textAnchor="middle"
              className="inf-valor"
            >
              {v}
            </text>
          );
        })}
    </svg>
  );
}
