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

// Lienzo 16:9: la matriz se proyecta en pantalla durante el encuentro.
const ANCHO = 160;
const ALTO = 90;
// Aire para que ningún círculo se corte contra el borde. Distinto por eje,
// porque el lienzo ya no es cuadrado.
const MARGEN_X = 14;
const MARGEN_Y = 9;
const RADIO = 3.6;

/** Pasa las coordenadas -1..1 al sistema del SVG. */
function aSvg(x: number, y: number) {
  const utilX = ANCHO / 2 - MARGEN_X;
  const utilY = ALTO / 2 - MARGEN_Y;
  return {
    cx: ANCHO / 2 + x * utilX,
    cy: ALTO / 2 - y * utilY, // el eje Y del SVG crece hacia abajo
  };
}

/**
 * Separa los puntos que se pisan, empujándolos apenas.
 * Determinista: mismo orden de entrada, mismo resultado.
 */
function separar(puntos: Punto[]) {
  const pos = puntos.map((p) => aSvg(p.x, p.y));

  // Zona reservada por persona: más alta que ancha, porque debajo de cada
  // círculo va el nombre. Sin esto las etiquetas se pisan con los vecinos.
  const SEP_X = RADIO * 2.9;
  const SEP_Y = RADIO * 3.5;

  for (let paso = 0; paso < 120; paso++) {
    let movio = false;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].cx - pos[i].cx;
        const dy = pos[j].cy - pos[i].cy;
        // Distancia en el espacio deformado por la zona reservada: si da
        // menos de 1, las zonas se superponen.
        const d = Math.hypot(dx / SEP_X, dy / SEP_Y);
        if (d >= 1) continue;

        // Si coinciden exactamente, se los separa en direcciones fijas.
        const ux = d === 0 ? Math.cos(i * 2.4) : dx / d / SEP_X;
        const uy = d === 0 ? Math.sin(i * 2.4) : dy / d / SEP_Y;
        const empuje = (1 - d) / 2;
        pos[i].cx -= ux * SEP_X * empuje;
        pos[i].cy -= uy * SEP_Y * empuje;
        pos[j].cx += ux * SEP_X * empuje;
        pos[j].cy += uy * SEP_Y * empuje;
        movio = true;
      }
    }
    if (!movio) break;
  }

  return pos.map((p) => ({
    cx: Math.min(Math.max(p.cx, RADIO + 1), ANCHO - RADIO - 1),
    cy: Math.min(Math.max(p.cy, RADIO + 1), ALTO - RADIO - 2.5),
  }));
}

// Los rótulos van hacia las esquinas, lejos de la zona donde caen las personas.
const CUADRANTES: { perfil: Perfil; x: number; y: number }[] = [
  { perfil: 'FI', x: 26, y: 15 },
  { perfil: 'FD', x: 134, y: 15 },
  { perfil: 'BI', x: 26, y: 74 },
  { perfil: 'BD', x: 134, y: 74 },
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

      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="mx-svg" role="img" aria-label="Matriz de perfiles">
        <defs>
          {puntos.map((p, i) =>
            p.foto ? (
              <clipPath id={`foto-${p.id}`} key={p.id}>
                <circle cx={pos[i].cx} cy={pos[i].cy} r={RADIO} />
              </clipPath>
            ) : null
          )}
        </defs>

        <rect x="0" y="0" width={ANCHO} height={ALTO} rx="2" className="mx-fondo" />

        {/* Ejes */}
        <line x1={ANCHO / 2} y1="2" x2={ANCHO / 2} y2={ALTO - 2} className="mx-linea" />
        <line x1="2" y1={ALTO / 2} x2={ANCHO - 2} y2={ALTO / 2} className="mx-linea" />

        {/* Nombres de cuadrante */}
        {CUADRANTES.map((c) => (
          <text key={c.perfil} x={c.x} y={c.y} className="mx-cuadrante" textAnchor="middle">
            {INFO[c.perfil].nombre.split(' ').map((palabra, i) => (
              <tspan key={i} x={c.x} dy={i === 0 ? 0 : 6.2}>
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
              <text x={pos[i].cx} y={pos[i].cy + 1.05} className="mx-iniciales" textAnchor="middle">
                {iniciales(p.nombre)}
              </text>
            )}
            <circle cx={pos[i].cx} cy={pos[i].cy} r={RADIO} className="mx-aro" />
            {conNombres && (
              <text x={pos[i].cx} y={pos[i].cy + RADIO + 3.4} className="mx-nombre" textAnchor="middle">
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
