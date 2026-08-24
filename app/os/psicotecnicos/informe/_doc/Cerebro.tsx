/**
 * El gráfico del Benziger: los cuatro cuadrantes sobre los ejes diagonales.
 *
 * El cerebro de fondo, cuatro ejes que salen de su centro hacia las esquinas,
 * el perfil adulto en línea llena y el joven punteado.
 *
 * La escala se numera una sola vez, sobre el eje frontal izquierdo, y la
 * referencia la dan cuatro rombos concéntricos cada treinta puntos. Antes cada
 * eje llevaba escritos sus seis números: veinticuatro en total, encima del
 * dibujo del cerebro y encima de la línea del perfil, que es lo único que hay
 * que leer.
 *
 * Va en SVG y no como imagen porque los valores cambian en cada persona, y
 * porque así se imprime nítido en cualquier tamaño.
 */

import type { Cuatro } from '@/lib/benziger-perfil';

const MAXIMO = 120;
const ANILLOS = [30, 60, 90, 120];
/** Medio lienzo: el centro queda en (0,0) y los ejes salen a las esquinas. */
const R = 190;

/** Hacia dónde apunta cada cuadrante, en unidades del lienzo. */
const DIRECCION: Record<keyof Cuatro, { x: number; y: number }> = {
  FI: { x: -1, y: -1 },
  FD: { x: 1, y: -1 },
  BI: { x: -1, y: 1 },
  BD: { x: 1, y: 1 },
};

const ORDEN: (keyof Cuatro)[] = ['FI', 'FD', 'BD', 'BI'];

function punto(clave: keyof Cuatro, valor: number) {
  const d = DIRECCION[clave];
  const largo = (Math.min(valor, MAXIMO) / MAXIMO) * R;
  return { x: d.x * largo, y: d.y * largo };
}

function trazar(valores: (clave: keyof Cuatro) => number): string {
  return ORDEN.map((k) => {
    const p = punto(k, valores(k));
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

function poligono(v: Cuatro): string | null {
  if (ORDEN.some((k) => v[k] === null || v[k] === undefined)) return null;
  return trazar((k) => v[k] as number);
}

export default function Cerebro({ adulto, joven }: { adulto: Cuatro | null; joven: Cuatro | null }) {
  const trazoAdulto = adulto ? poligono(adulto) : null;
  const trazoJoven = joven ? poligono(joven) : null;

  return (
    <svg className="inf-cerebro" viewBox="-230 -230 460 460" role="img" aria-label="Perfil Benziger">
      {/* El cerebro de fondo, con su centro en el cruce de los ejes: cada
          cuadrante del gráfico cae sobre la parte del cerebro que nombra. */}
      <image
        href="/informe/cerebro.png"
        x="-215"
        y="-215"
        width="430"
        height="430"
        className="inf-cerebro-fondo"
        preserveAspectRatio="xMidYMid meet"
      />

      {/* La guía vertical, que separa izquierdo de derecho. La horizontal la
          dibuja el contenedor: cruza el capítulo entero, de margen a margen. */}
      <line x1="0" y1="-215" x2="0" y2="215" className="inf-eje-guia" />

      {ANILLOS.map((v) => (
        <polygon
          key={v}
          points={trazar(() => v)}
          className={v === MAXIMO ? 'inf-anillo borde' : 'inf-anillo'}
        />
      ))}

      {ORDEN.map((clave) => {
        const d = DIRECCION[clave];
        return (
          <line key={clave} x1="0" y1="0" x2={d.x * R} y2={d.y * R} className="inf-eje" />
        );
      })}

      {/* La escala, sobre un solo eje. Corrida al costado del eje, porque
          encima de él la tapan el vértice y la línea del perfil, y con un halo
          del color de la hoja por si algo la cruza igual. */}
      {ANILLOS.map((v) => {
        const p = punto('FI', v);
        return (
          <text key={v} x={p.x + 12.7} y={p.y - 8.2} className="inf-escala" textAnchor="middle">
            {v}
          </text>
        );
      })}

      {trazoJoven && <polygon points={trazoJoven} className="inf-perfil-joven" />}
      {trazoAdulto && <polygon points={trazoAdulto} className="inf-perfil-adulto" />}

      {/* Los cuatro valores del adulto, marcados: es donde cae el número que
          después se lee al costado. */}
      {trazoAdulto &&
        adulto &&
        ORDEN.map((k) => {
          const p = punto(k, adulto[k] as number);
          return <circle key={k} cx={p.x} cy={p.y} r="5.5" className="inf-vertice" />;
        })}
    </svg>
  );
}
