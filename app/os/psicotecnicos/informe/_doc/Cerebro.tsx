/**
 * El gráfico del Benziger: los cuatro cuadrantes sobre los ejes diagonales.
 *
 * Copia el que hoy se imprime: el cerebro de fondo, cuatro ejes que salen de su
 * centro hacia las esquinas, con marcas cada veinte hasta ciento veinte, el
 * perfil adulto en línea llena y el joven punteado.
 *
 * Va en SVG y no como imagen porque los valores cambian en cada persona, y
 * porque así se imprime nítido en cualquier tamaño.
 */

import type { Cuatro } from '@/lib/benziger-perfil';

const MAXIMO = 120;
const MARCAS = [20, 40, 60, 80, 100, 120];
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

function poligono(v: Cuatro): string | null {
  if (ORDEN.some((k) => v[k] === null || v[k] === undefined)) return null;
  return ORDEN.map((k) => {
    const p = punto(k, v[k] as number);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
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
        preserveAspectRatio="xMidYMid meet"
      />

      {/* La guía vertical, que separa izquierdo de derecho. La horizontal la
          dibuja el contenedor: cruza el capítulo entero, de margen a margen. */}
      <line x1="0" y1="-215" x2="0" y2="215" className="inf-eje-guia" />

      {ORDEN.map((clave) => {
        const d = DIRECCION[clave];
        return (
          <g key={clave}>
            <line x1="0" y1="0" x2={d.x * R} y2={d.y * R} className="inf-eje" />
            {MARCAS.map((m) => {
              const p = punto(clave, m);
              return (
                <g key={m}>
                  <circle cx={p.x} cy={p.y} r="2.5" className="inf-marca" />
                  <text
                    x={p.x + d.x * 13}
                    y={p.y + d.y * 5}
                    className="inf-marca-texto"
                    textAnchor="middle"
                  >
                    {m}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {trazoJoven && <polygon points={trazoJoven} className="inf-perfil-joven" />}
      {trazoAdulto && <polygon points={trazoAdulto} className="inf-perfil-adulto" />}
    </svg>
  );
}
