import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';

/**
 * Matriz 2x2 de perfiles, en SVG. Se usa para la placa de resultado (una sola
 * persona) y para la matriz interna del equipo (todas).
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

/**
 * El tamaño del punto depende de cuánta gente hay: con un taller de 30 se
 * lee cada cara y cada nombre; con la empresa entera lo que importa es la
 * nube, así que los puntos se achican y las etiquetas desaparecen.
 */
function metricas(cantidad: number) {
  const t = Math.min(1, Math.max(0, (cantidad - 15) / (140 - 15)));
  const radio = 3.6 - t * 2.3; // de 3.6 (pocos) a 1.3 (muchos)
  return {
    radio,
    conNombres: cantidad <= 45,
    conIniciales: radio >= 2.4,
  };
}

/** Pasa las coordenadas -1..1 al sistema del SVG. */
function aSvg(x: number, y: number) {
  const utilX = ANCHO / 2 - MARGEN_X;
  const utilY = ALTO / 2 - MARGEN_Y;
  return {
    cx: ANCHO / 2 + x * utilX,
    cy: ALTO / 2 - y * utilY, // el eje Y del SVG crece hacia abajo
  };
}

// ------------------------------------------------------- textos de cuadrante

// Los textos van pegados a los laterales: la gente se concentra en el centro
// de la matriz, así que las columnas de los costados quedan libres.
const CENTRO_TEXTO = 27; // distancia del borde al centro del bloque
const ANCHO_TEXTO = 48;
const CHARS_POR_LINEA = 30;
const ALTO_LINEA = 2.8;
const ALTO_TITULO = 6.2; // separación entre las dos palabras del título

/** Corta un texto en líneas, sin partir palabras. */
function envolver(texto: string, maximo: number): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    if (actual && (actual + ' ' + palabra).length > maximo) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = actual ? `${actual} ${palabra}` : palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

type Bloque = {
  perfil: Perfil;
  cx: number;
  yTitulo: number;
  yDesc: number;
  lineas: string[];
  caja: { x0: number; y0: number; x1: number; y1: number };
};

/**
 * Ubica el título y la descripción de cada cuadrante, y devuelve la caja que
 * ocupan para que ninguna persona quede dibujada encima.
 */
function bloques(conDescripciones: boolean): Bloque[] {
  return PERFILES.map((perfil) => {
    const arriba = perfil === 'FI' || perfil === 'FD';
    const izquierda = perfil === 'FI' || perfil === 'BI';
    const cx = izquierda ? CENTRO_TEXTO : ANCHO - CENTRO_TEXTO;

    const lineas = conDescripciones
      ? envolver(INFO[perfil].descripcion, CHARS_POR_LINEA)
      : [];
    // Alto que ocupa la descripción desde su primera línea base.
    const caida = Math.max(0, lineas.length - 1) * ALTO_LINEA;

    let yTitulo: number;
    let yDesc: number;
    if (arriba) {
      yTitulo = 14;
      yDesc = yTitulo + ALTO_TITULO + 6.5;
    } else {
      yDesc = ALTO - 5 - caida; // la última línea queda cerca del borde
      yTitulo = yDesc - 6.5 - ALTO_TITULO;
    }

    // La caja arranca sobre la primera palabra del título (su altura de letra)
    // y termina bajo la última línea de la descripción.
    const y0 = yTitulo - 5;
    const y1 = (lineas.length ? yDesc + caida : yTitulo + ALTO_TITULO) + 1.5;

    return {
      perfil,
      cx,
      yTitulo,
      yDesc,
      lineas,
      caja: { x0: cx - ANCHO_TEXTO / 2, y0, x1: cx + ANCHO_TEXTO / 2, y1 },
    };
  });
}

// ------------------------------------------------------------- distribución

/**
 * Separa los puntos que se pisan y los mantiene fuera de los bloques de texto.
 * Determinista: mismo orden de entrada, mismo resultado.
 */
function distribuir(
  puntos: Punto[],
  radio: number,
  conNombres: boolean,
  cajas: Bloque['caja'][]
) {
  const pos = puntos.map((p) => aSvg(p.x, p.y));

  // Zona reservada por persona. Con nombres es más alta que ancha, para que
  // la etiqueta no se pise con el círculo de abajo; sin nombres alcanza con
  // que los puntos no se tapen entre sí.
  const SEP_X = radio * (conNombres ? 2.9 : 2.15);
  const SEP_Y = radio * (conNombres ? 3.5 : 2.15);
  const altoEtiqueta = conNombres ? radio + 3.9 : radio;

  /** Empuja el punto fuera de un bloque de texto, por el lado más cercano. */
  function esquivarTextos(p: { cx: number; cy: number }) {
    for (const c of cajas) {
      const dentro =
        p.cx + radio > c.x0 &&
        p.cx - radio < c.x1 &&
        p.cy + altoEtiqueta > c.y0 &&
        p.cy - radio < c.y1;
      if (!dentro) continue;

      const salidas = [
        { d: p.cx + radio - c.x0, mover: () => (p.cx = c.x0 - radio) },
        { d: c.x1 - (p.cx - radio), mover: () => (p.cx = c.x1 + radio) },
        { d: p.cy + altoEtiqueta - c.y0, mover: () => (p.cy = c.y0 - altoEtiqueta) },
        { d: c.y1 - (p.cy - radio), mover: () => (p.cy = c.y1 + radio) },
      ];
      salidas.sort((a, b) => a.d - b.d)[0].mover();
    }
  }

  for (let paso = 0; paso < 140; paso++) {
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
    for (const p of pos) esquivarTextos(p);
    if (!movio) break;
  }

  const aire = conNombres ? 2.5 : 1;
  return pos.map((p) => ({
    cx: Math.min(Math.max(p.cx, radio + 1), ANCHO - radio - 1),
    cy: Math.min(Math.max(p.cy, radio + 1), ALTO - radio - aire),
  }));
}

// ------------------------------------------------------------------ vista

export default function MatrizBenziger({
  puntos = [],
  conNombres = true,
  conDescripciones = false,
}: {
  puntos?: Punto[];
  conNombres?: boolean;
  /** Muestra la descripción de cada cuadrante dentro de la matriz. */
  conDescripciones?: boolean;
}) {
  const m = metricas(puntos.length);
  const radio = m.radio;
  const nombres = conNombres && m.conNombres;
  const cuadrantes = bloques(conDescripciones);
  const pos = distribuir(
    puntos,
    radio,
    nombres,
    conDescripciones ? cuadrantes.map((c) => c.caja) : []
  );

  return (
    <div className="mx">
      <div className="mx-eje mx-eje-top">
        <strong>Macro</strong>
        <span>Mundo de las ideas</span>
      </div>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className={m.conIniciales ? 'mx-svg' : 'mx-svg mx-denso'}
        role="img"
        aria-label="Matriz de perfiles"
      >
        <defs>
          {puntos.map((p, i) =>
            p.foto ? (
              <clipPath id={`foto-${p.id}`} key={p.id}>
                <circle cx={pos[i].cx} cy={pos[i].cy} r={radio} />
              </clipPath>
            ) : null
          )}
        </defs>

        <rect x="0" y="0" width={ANCHO} height={ALTO} rx="2" className="mx-fondo" />

        {/* Ejes */}
        <line x1={ANCHO / 2} y1="2" x2={ANCHO / 2} y2={ALTO - 2} className="mx-linea" />
        <line x1="2" y1={ALTO / 2} x2={ANCHO - 2} y2={ALTO / 2} className="mx-linea" />

        {/* Cuadrantes: nombre y, si se pide, su descripción */}
        {cuadrantes.map((c) => (
          <g key={c.perfil}>
            <text x={c.cx} y={c.yTitulo} className="mx-cuadrante" textAnchor="middle">
              {INFO[c.perfil].nombre.split(' ').map((palabra, i) => (
                <tspan key={i} x={c.cx} dy={i === 0 ? 0 : ALTO_TITULO}>
                  {palabra}
                </tspan>
              ))}
            </text>
            {c.lineas.length > 0 && (
              <text
                x={c.cx}
                y={c.yDesc}
                className="mx-cuadrante-desc"
                textAnchor="middle"
              >
                {c.lineas.map((linea, i) => (
                  <tspan key={i} x={c.cx} dy={i === 0 ? 0 : ALTO_LINEA}>
                    {linea}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        ))}

        {/* Personas */}
        {puntos.map((p, i) => (
          <g key={p.id} className={p.destacado ? 'mx-punto mx-punto-yo' : 'mx-punto'}>
            {p.foto ? (
              <image
                href={p.foto}
                x={pos[i].cx - radio}
                y={pos[i].cy - radio}
                width={radio * 2}
                height={radio * 2}
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#foto-${p.id})`}
              />
            ) : (
              <circle cx={pos[i].cx} cy={pos[i].cy} r={radio} className="mx-sinfoto" />
            )}
            {!p.foto && m.conIniciales && (
              <text x={pos[i].cx} y={pos[i].cy + 1.05} className="mx-iniciales" textAnchor="middle">
                {iniciales(p.nombre)}
              </text>
            )}
            <circle cx={pos[i].cx} cy={pos[i].cy} r={radio} className="mx-aro" />
            {nombres && (
              <text x={pos[i].cx} y={pos[i].cy + radio + 3.4} className="mx-nombre" textAnchor="middle">
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
