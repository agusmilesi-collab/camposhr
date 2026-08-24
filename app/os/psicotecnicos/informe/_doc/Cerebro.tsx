/**
 * El gráfico del Benziger: los cuatro cuadrantes sobre los ejes diagonales.
 *
 * El cerebro de fondo, cuatro ejes que salen de su centro hacia las esquinas,
 * el perfil adulto en línea llena y el joven punteado.
 *
 * Los cuatro ejes llevan su escala, cada cuarenta puntos, y dos rombos
 * concéntricos marcan los mismos tramos. Cada cuarenta y no cada veinte porque
 * son cuatro ejes: con seis marcas por eje eran veinticuatro números encima del
 * dibujo. Van corridos a un costado, hacia afuera, porque escritos sobre el eje
 * los tapan la línea del perfil y el punto del vértice.
 *
 * Va en SVG y no como imagen porque los valores cambian en cada persona, y
 * porque así se imprime nítido en cualquier tamaño.
 */

import type { Cuatro } from '@/lib/benziger-perfil';

const MAXIMO = 120;
const ANILLOS = [40, 80, 120];
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

      {ANILLOS.filter((v) => v < MAXIMO).map((v) => (
        <polygon key={v} points={trazar(() => v)} className="inf-anillo" />
      ))}

      {ORDEN.map((clave) => {
        const d = DIRECCION[clave];
        return (
          <line key={clave} x1="0" y1="0" x2={d.x * R} y2={d.y * R} className="inf-eje" />
        );
      })}

      {/* La escala de los cuatro ejes. El número se corre a un costado, en la
          perpendicular del eje y siempre girando para el mismo lado, y lleva un
          halo del color de la hoja por si algo lo cruza igual. */}
      {ORDEN.map((clave) => {
        const d = DIRECCION[clave];
        return ANILLOS.map((v) => {
          const p = punto(clave, v);
          return (
            <text
              key={`${clave}-${v}`}
              x={p.x + d.x * 13}
              y={p.y + 4}
              className="inf-escala"
              textAnchor="middle"
            >
              {v}
            </text>
          );
        });
      })}

      {trazoJoven && <polygon points={trazoJoven} className="inf-perfil-joven" />}
      {trazoAdulto && <polygon points={trazoAdulto} className="inf-perfil-adulto" />}

      {/* Los cuatro valores del adulto, marcados con el color de su ficha: es
          donde cae el número que después se lee al costado. */}
      {trazoAdulto &&
        adulto &&
        ORDEN.map((k) => {
          const p = punto(k, adulto[k] as number);
          return <circle key={k} cx={p.x} cy={p.y} r="5.5" className={`inf-vertice v-${k}`} />;
        })}
    </svg>
  );
}
