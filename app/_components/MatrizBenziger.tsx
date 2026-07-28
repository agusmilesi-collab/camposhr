import { INFO, type Perfil } from '@/lib/perfiles';

/**
 * Matriz 2x2 de perfiles, en SVG. Se usa en tres lugares:
 * la portada del cuestionario (sin personas), la placa de resultado
 * (una sola persona) y la matriz interna del equipo (todas).
 *
 * Coordenadas: x de -1 (izquierdo) a 1 (derecho), y de -1 (basal) a 1 (frontal).
 */

export type Punto = {
  id: string;
  nombre: string;
  x: number;
  y: number;
  foto?: string | null;
  destacado?: boolean;
};

const LADO = 100;
const MARGEN = 9; // deja aire para que ningún círculo se corte contra el borde
const RADIO = 3.4;

/** Pasa las coordenadas -1..1 al sistema del SVG. */
function aSvg(x: number, y: number) {
  const util = LADO / 2 - MARGEN;
  return {
    cx: LADO / 2 + x * util,
    cy: LADO / 2 - y * util, // el eje Y del SVG crece hacia abajo
  };
}

/**
 * Separa los puntos que se pisan, empujándolos apenas.
 * Determinista: mismo orden de entrada, mismo resultado.
 */
function separar(puntos: Punto[]) {
  const pos = puntos.map((p) => aSvg(p.x, p.y));
  const minimo = RADIO * 2.15;

  for (let paso = 0; paso < 60; paso++) {
    let movio = false;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].cx - pos[i].cx;
        const dy = pos[j].cy - pos[i].cy;
        const dist = Math.hypot(dx, dy);
        if (dist >= minimo) continue;

        // Si coinciden exactamente, se los separa en direcciones fijas.
        const ux = dist === 0 ? Math.cos(i * 2.4) : dx / dist;
        const uy = dist === 0 ? Math.sin(i * 2.4) : dy / dist;
        const empuje = (minimo - (dist || 0)) / 2;
        pos[i].cx -= ux * empuje;
        pos[i].cy -= uy * empuje;
        pos[j].cx += ux * empuje;
        pos[j].cy += uy * empuje;
        movio = true;
      }
    }
    if (!movio) break;
  }

  const tope = LADO - MARGEN / 2;
  return pos.map((p) => ({
    cx: Math.min(Math.max(p.cx, MARGEN / 2), tope),
    cy: Math.min(Math.max(p.cy, MARGEN / 2), tope),
  }));
}

const CUADRANTES: { perfil: Perfil; x: number; y: number }[] = [
  { perfil: 'FI', x: 25, y: 26 },
  { perfil: 'FD', x: 75, y: 26 },
  { perfil: 'BI', x: 25, y: 76 },
  { perfil: 'BD', x: 75, y: 76 },
];

export default function MatrizBenziger({
  puntos = [],
  conNombres = true,
}: {
  puntos?: Punto[];
  conNombres?: boolean;
}) {
  const pos = separar(puntos);

  return (
    <div className="mx">
      <div className="mx-eje mx-eje-top">
        <strong>Macro</strong>
        <span>Mundo de las ideas</span>
      </div>

      <svg viewBox={`0 0 ${LADO} ${LADO}`} className="mx-svg" role="img" aria-label="Matriz de perfiles">
        <defs>
          {puntos.map((p, i) =>
            p.foto ? (
              <clipPath id={`foto-${p.id}`} key={p.id}>
                <circle cx={pos[i].cx} cy={pos[i].cy} r={RADIO} />
              </clipPath>
            ) : null
          )}
        </defs>

        <rect x="0" y="0" width={LADO} height={LADO} rx="2" className="mx-fondo" />

        {/* Ejes */}
        <line x1={LADO / 2} y1="2" x2={LADO / 2} y2={LADO - 2} className="mx-linea" />
        <line x1="2" y1={LADO / 2} x2={LADO - 2} y2={LADO / 2} className="mx-linea" />

        {/* Nombres de cuadrante */}
        {CUADRANTES.map((c) => (
          <text key={c.perfil} x={c.x} y={c.y} className="mx-cuadrante" textAnchor="middle">
            {INFO[c.perfil].nombre.split(' ').map((palabra, i) => (
              <tspan key={i} x={c.x} dy={i === 0 ? 0 : 5.4}>
                {palabra}
              </tspan>
            ))}
          </text>
        ))}

        {/* Personas */}
        {puntos.map((p, i) => (
          <g key={p.id} className={p.destacado ? 'mx-punto mx-punto-yo' : 'mx-punto'}>
            {p.foto ? (
              <image
                href={p.foto}
                x={pos[i].cx - RADIO}
                y={pos[i].cy - RADIO}
                width={RADIO * 2}
                height={RADIO * 2}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#foto-${p.id})`}
              />
            ) : (
              <circle cx={pos[i].cx} cy={pos[i].cy} r={RADIO} className="mx-sinfoto" />
            )}
            {!p.foto && (
              <text x={pos[i].cx} y={pos[i].cy + 1.1} className="mx-iniciales" textAnchor="middle">
                {iniciales(p.nombre)}
              </text>
            )}
            <circle cx={pos[i].cx} cy={pos[i].cy} r={RADIO} className="mx-aro" />
            {conNombres && (
              <text x={pos[i].cx} y={pos[i].cy + RADIO + 3} className="mx-nombre" textAnchor="middle">
                {primerNombre(p.nombre)}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="mx-eje mx-eje-bottom">
        <strong>Micro</strong>
        <span>Mundo del detalle</span>
      </div>
    </div>
  );
}

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function primerNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const corto = partes[0] ?? '';
  return corto.length > 12 ? `${corto.slice(0, 11)}…` : corto;
}
