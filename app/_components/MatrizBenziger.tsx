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

/**
 * Los cuatro extremos de la matriz. El vertical separa el mundo de las ideas
 * del mundo del detalle; el horizontal, lo que se decide con datos de lo que
 * se decide con percepción y vínculo.
 */
export const EJES = {
  arriba: { titulo: 'Macro', bajada: 'Mundo de las ideas' },
  abajo: { titulo: 'Micro', bajada: 'Mundo del detalle' },
  izquierda: { titulo: 'Razón', bajada: 'Mundo de los datos' },
  derecha: { titulo: 'Emoción', bajada: 'Mundo de las personas' },
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

// Los textos van pegados a la esquina exterior de su cuadrante: la gente se
// concentra en el centro, así que los bordes quedan libres.
const MARGEN_TEXTO = 5; // separación al borde del lienzo
const ANCHO_TEXTO = 45;
const CHARS_POR_LINEA = 33;
const ALTO_LINEA = 2.5;
const ALTO_TITULO = 6.2; // separación entre las dos palabras del título

/**
 * Dónde se escriben las descripciones de los cuadrantes.
 *
 * `html` las pone por encima del lienzo, en texto normal, y es lo que se usa
 * casi siempre: el texto dibujado dentro de un SVG escala con el ancho del
 * gráfico, y en un celular termina en tres o cuatro píxeles.
 *
 * `svg` es la excepción de la matriz de toda la empresa. Ahí el texto en HTML
 * necesita tanto espacio que la gente no entra, y esa pantalla se proyecta:
 * el gráfico es grande y el texto dibujado se lee.
 */
type ModoTexto = 'no' | 'html-amplio' | 'html' | 'svg';

function modoTexto(conDescripciones: boolean, cuantos: number): ModoTexto {
  if (!conDescripciones) return 'no';
  if (cuantos <= 3) return 'html-amplio'; // la placa de resultado
  if (cuantos <= 20) return 'html'; // el equipo de un líder
  return 'svg'; // la empresa entera, proyectada
}

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
  x: number;
  anclaje: 'start' | 'end';
  yTitulo: number;
  yDesc: number;
  lineas: string[];
  caja: Caja;
};

/**
 * Ubica el título de cada cuadrante y, en el modo `svg`, su descripción.
 * Devuelve además la caja que ocupan, para que ninguna persona quede dibujada
 * encima.
 */
function bloques(modo: ModoTexto): Bloque[] {
  return PERFILES.map((perfil) => {
    const arriba = perfil === 'FI' || perfil === 'FD';
    const izquierda = perfil === 'FI' || perfil === 'BI';

    // Alineado contra el borde exterior de su cuadrante.
    const x = izquierda ? MARGEN_TEXTO : ANCHO - MARGEN_TEXTO;
    const anclaje: 'start' | 'end' = izquierda ? 'start' : 'end';

    const lineas =
      modo === 'svg' ? envolver(INFO[perfil].descripcion, CHARS_POR_LINEA) : [];
    // Alto que ocupa la descripción desde su primera línea base.
    const caida = Math.max(0, lineas.length - 1) * ALTO_LINEA;

    let yTitulo: number;
    let yDesc: number;
    if (arriba) {
      yTitulo = 10; // pegado al borde superior
      yDesc = yTitulo + ALTO_TITULO + 6.5;
    } else {
      yDesc = ALTO - 4 - caida; // la última línea queda contra el borde inferior
      yTitulo = yDesc - 6.5 - ALTO_TITULO;
    }

    const y0 = yTitulo - 5;
    const y1 = (lineas.length ? yDesc + caida : yTitulo + ALTO_TITULO) + 1.5;
    const x0 = izquierda ? x - 1 : x - ANCHO_TEXTO;
    const x1 = izquierda ? x + ANCHO_TEXTO : x + 1;

    return { perfil, x, anclaje, yTitulo, yDesc, lineas, caja: { x0, y0, x1, y1 } };
  });
}

/**
 * Espacio que se reserva para las descripciones en HTML, en unidades del
 * lienzo. Es lo único que el SVG necesita saber de ellas. Va algo más grande
 * que el bloque de texto: el CSS lo separa del borde y el punto se mide desde
 * su centro, así que sin ese aire un círculo apoyado justo afuera igual pisa
 * la última palabra.
 */
function cajasDescripcion(amplio: boolean): Caja[] {
  const anchoCaja = amplio ? ANCHO * 0.5 : ANCHO * 0.38;
  const altoCaja = amplio ? ALTO * 0.47 : ALTO * 0.46;

  return PERFILES.map((perfil) => {
    const arriba = perfil === 'FI' || perfil === 'FD';
    const izquierda = perfil === 'FI' || perfil === 'BI';
    return {
      x0: izquierda ? 0 : ANCHO - anchoCaja,
      x1: izquierda ? anchoCaja : ANCHO,
      y0: arriba ? 0 : ALTO - altoCaja,
      y1: arriba ? altoCaja : ALTO,
    };
  });
}

// ------------------------------------------------------------- distribución

type Caja = { x0: number; y0: number; x1: number; y1: number };

const seSolapan = (a: Caja, b: Caja) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Ubica a cada persona lo más cerca posible de su lugar real, pero sin pisar
 * a nadie ni a los textos de los cuadrantes.
 *
 * Empujar a los que se tocan no alcanza cuando el grupo se concentra: los
 * choques se propagan y el resultado nunca termina de acomodarse. Acá cada
 * persona busca, en espiral desde su posición ideal, el primer lugar libre.
 * Van primero las más extremas, que son las que aportan la lectura.
 * Determinista: mismo orden de entrada, mismo resultado.
 */
function distribuir(
  puntos: Punto[],
  radio: number,
  conNombres: boolean,
  cajasTexto: Caja[]
) {
  const ideales = puntos.map((p) => aSvg(p.x, p.y));

  // Espacio que ocupa cada persona en pantalla: el círculo y, debajo, su
  // nombre. Un nombre largo es más ancho que el círculo.
  const ALTO_NOMBRE = 3.9;
  const anchos = puntos.map((p) =>
    conNombres
      ? Math.max(radio, (anchoTexto(primerNombre(p.nombre)) + 1.2) / 2)
      : radio
  );
  const arriba = radio + 0.3;
  const abajo = conNombres ? radio + ALTO_NOMBRE : radio + 0.3;

  const caja = (cx: number, cy: number, w: number): Caja => ({
    x0: cx - w,
    y0: cy - arriba,
    x1: cx + w,
    y1: cy + abajo,
  });

  // No alcanza con que no se toquen: sin un aire mínimo, dos etiquetas
  // pegadas se leen como una sola.
  const AIRE = 1.2;
  const inflar = (c: Caja): Caja => ({
    x0: c.x0 - AIRE,
    y0: c.y0 - AIRE,
    x1: c.x1 + AIRE,
    y1: c.y1 + AIRE,
  });

  const puestas: Caja[] = [];
  const libre = (c: Caja) =>
    c.x0 >= 0.5 &&
    c.x1 <= ANCHO - 0.5 &&
    c.y0 >= 0.5 &&
    c.y1 <= ALTO - 0.5 &&
    !cajasTexto.some((t) => seSolapan(c, t)) &&
    !puestas.some((q) => seSolapan(inflar(c), q));

  // Las más alejadas del centro se ubican primero: son las que definen la
  // lectura del gráfico y las que menos margen tienen para moverse.
  const orden = puntos
    .map((p, i) => i)
    .sort((a, b) => Math.hypot(puntos[b].x, puntos[b].y) - Math.hypot(puntos[a].x, puntos[a].y));

  const salida: { cx: number; cy: number }[] = new Array(puntos.length);

  for (const i of orden) {
    const { cx, cy } = ideales[i];
    const w = anchos[i];
    let elegida = caja(cx, cy, w);
    let encontrada = false;

    // Espiral: primero el lugar exacto, después anillos cada vez más lejos.
    for (let paso = 0; paso <= 40 && !encontrada; paso++) {
      const r = paso * 1.6;
      const vueltas = paso === 0 ? 1 : Math.min(48, 8 + paso * 4);
      for (let k = 0; k < vueltas; k++) {
        const ang = (k / vueltas) * Math.PI * 2;
        const c = caja(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.75, w);
        if (libre(c)) {
          elegida = c;
          encontrada = true;
          break;
        }
      }
    }

    // Si la espiral no dio con un hueco (pasa cuando el grupo se amontona),
    // se barre el lienzo entero y se toma el lugar libre más cercano.
    if (!encontrada) {
      let mejor = Infinity;
      for (let x = w + 0.5; x <= ANCHO - w - 0.5; x += 1.5) {
        for (let y = arriba + 0.5; y <= ALTO - abajo - 0.5; y += 1.5) {
          const dist = Math.hypot(x - cx, y - cy);
          if (dist >= mejor) continue;
          const c = caja(x, y, w);
          if (libre(c)) {
            mejor = dist;
            elegida = c;
            encontrada = true;
          }
        }
      }
    }

    puestas.push(elegida);
    salida[i] = { cx: (elegida.x0 + elegida.x1) / 2, cy: elegida.y0 + arriba };
  }

  return salida;
}

/**
 * Ancho aproximado de un texto en el lienzo (Inter a 2.7px). Se estima por
 * lo alto: es preferible reservar de más que terminar con nombres pisados.
 */
function anchoTexto(texto: string): number {
  return texto.length * 1.55;
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
  const modo = modoTexto(conDescripciones, puntos.length);
  const enHtml = modo === 'html' || modo === 'html-amplio';
  const amplio = modo === 'html-amplio';
  const cuadrantes = bloques(modo);
  const pos = distribuir(
    puntos,
    radio,
    nombres,
    enHtml ? cajasDescripcion(amplio) : modo === 'svg' ? cuadrantes.map((c) => c.caja) : []
  );

  /**
   * Las descripciones se arman una vez y se usan en dos lugares: flotando
   * sobre el gráfico en pantalla ancha, y debajo de él en el celular, donde
   * adentro del lienzo no entraría texto legible. El CSS muestra una y esconde
   * la otra.
   */
  const textos = (donde: 'flotante' | 'abajo') => (
    <div
      className={[
        'mx-textos',
        `mx-textos-${donde}`,
        amplio ? 'mx-textos-amplio' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {PERFILES.map((p) => (
        <div className={`mx-texto mx-texto-${p}`} key={p}>
          <h3>{INFO[p].nombre}</h3>
          <p>{INFO[p].descripcion}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className={enHtml ? 'mx mx-con-desc' : 'mx'}>
      <div className="mx-eje mx-eje-top">
        <strong>{EJES.arriba.titulo}</strong>
        <span>{EJES.arriba.bajada}</span>
      </div>

      {/* El horizontal va a los costados, girado, para no robarle ancho a la
          matriz ni pisarse con las descripciones de los cuadrantes. */}
      <div className="mx-cuerpo">
        <div className="mx-eje mx-eje-izq">
          <strong>{EJES.izquierda.titulo}</strong>
          <span>{EJES.izquierda.bajada}</span>
        </div>

        <div className="mx-lienzo">
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

        {/* Nombre de cada cuadrante y, en el modo svg, su descripción */}
        {cuadrantes.map((c) => (
          <g key={c.perfil}>
            <text x={c.x} y={c.yTitulo} className="mx-cuadrante" textAnchor={c.anclaje}>
              {INFO[c.perfil].nombre.split(' ').map((palabra, i) => (
                <tspan key={i} x={c.x} dy={i === 0 ? 0 : ALTO_TITULO}>
                  {palabra}
                </tspan>
              ))}
            </text>
            {c.lineas.length > 0 && (
              <text x={c.x} y={c.yDesc} className="mx-cuadrante-desc" textAnchor={c.anclaje}>
                {c.lineas.map((linea, i) => (
                  <tspan key={i} x={c.x} dy={i === 0 ? 0 : ALTO_LINEA}>
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

          {enHtml && textos('flotante')}
        </div>

        <div className="mx-eje mx-eje-der">
          <strong>{EJES.derecha.titulo}</strong>
          <span>{EJES.derecha.bajada}</span>
        </div>
      </div>

      {/* Fuera del cuerpo, para que los ejes laterales sigan alineados con el
          gráfico cuando los textos pasan abajo. */}
      {enHtml && textos('abajo')}

      <div className="mx-eje mx-eje-bottom">
        <strong>{EJES.abajo.titulo}</strong>
        <span>{EJES.abajo.bajada}</span>
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
  // Se acorta: un nombre largo reserva mucho ancho y empuja a los vecinos.
  return corto.length > 9 ? `${corto.slice(0, 8)}…` : corto;
}
