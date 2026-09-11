'use client';

/**
 * La codificación del Rorschach mientras se toma, con la lámina a la vista.
 *
 * Se abre en la encuesta, no en la asociación libre: dónde vio la persona lo
 * que vio se establece recién ahí. Primero se escribe lo que dijo, después se
 * marca dónde, y con esas dos cosas la Tabla A dice la calidad formal.
 *
 * Se llega al área por dos caminos, porque la mitad de las veces la persona
 * describe con palabras en vez de señalar:
 *
 *   · Apretando el área en la lámina, que deja la lista de esa área a la vista.
 *   · Buscando la palabra en toda la lámina, que devuelve en qué áreas existe
 *     esa respuesta y con qué calidad en cada una. "Cara humana" está en cuatro
 *     áreas de la lámina I y no vale lo mismo en ninguna: esa es la decisión
 *     que hoy se toma hojeando el librito.
 *
 * Se pueden marcar varias áreas para una misma respuesta, que es lo que hace
 * falta para el puntaje Z: integrar dos áreas adyacentes puntúa distinto que
 * integrar dos distantes, y el blanco integrado con la tinta distinto de las
 * dos. La regla vive en `lib/rorschach-z.ts`; acá se muestra qué salió y qué
 * queda por confirmar.
 *
 * Lo que se captura llega a la ficha como borrador, con los campos que el
 * sistema no puede saber marcados como pendientes. Si no se usa esta pantalla,
 * la ficha queda vacía y se carga a mano, como siempre.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AREAS, type Parte } from '@/lib/rorschach-areas';
import {
  buscar,
  empiezaAlgunaPalabra,
  entradasDe,
  esPopular,
  familiaDe,
  plano,
  type Hallazgo,
} from '@/lib/rorschach-tabla-a';
import { contenidoSugerido, fqDeLaFicha, localizacionesDe } from '@/lib/rorschach-sugerencias';
import { Multiple, Simple } from '@/app/os/psicotecnicos/ficha/[id]/Celdas';
import { CONTENIDOS, FQ, GIRO, LOCALIZACION, POSICION, tonoDe } from '@/lib/rorschach';
import Codigo from '@/app/os/psicotecnicos/ficha/[id]/Codigo';
import { esEspacio, puntajeZ } from '@/lib/rorschach-z';
import { CARGADAS, ORDEN, siguienteDe } from '@/lib/rorschach-laminas';
import {
  abrirCanal,
  DESFASE_MS,
  esParaMi,
  PULSO_MS,
  SIN_RESPUESTA_MS,
  type Aviso,
} from '@/lib/laminas-sincro';
import Toma, { NOMBRE_POSICION, siguienteGiro } from './Toma';
import LinkLaminas from '@/app/os/psicotecnicos/entrevista/[id]/LinkLaminas';

/**
 * Qué distingue a cada calidad evolutiva, en una línea.
 *
 * Es la Tabla 4 del manual (símbolos y criterios de la calidad evolutiva)
 * resumida: la localización sale del área marcada, pero cuál de las cuatro es
 * no se puede deducir de ahí, sale de cómo la persona describió lo que vio. Va
 * a la vista mientras se elige, que es cuando hace falta: el criterio de "+" y
 * el de "v/+" se separan por una sola cosa, si alguno de los objetos exige una
 * forma determinada.
 */
const CRITERIO_DQ: [string, string][] = [
  ['+', 'dos o más objetos en relación, y al menos uno exige una forma determinada'],
  ['o', 'un solo objeto, con rasgos que exigen una forma determinada'],
  ['v/+', 'dos o más objetos en relación, ninguno exige una forma determinada'],
  ['v', 'un objeto sin forma definida, y así lo describe'],
];

/**
 * Los siete mapas de la lámina, todos a la vista.
 *
 * Es el reparto del cuadernillo, que dibuja la mancha seis veces y en cada una
 * señala las áreas que no se pisan entre ellas. Antes había un solo mapa con un
 * selector de capa arriba (D, Dd, Espacios), y marcar un área costaba dos
 * gestos: elegir la capa donde vive y recién ahí apretarla. Quien codifica no
 * sabe de antemano en qué capa cae Dd34, y en la entrevista eso es hojear.
 *
 * El séptimo es W, que en el papel no está dibujada porque es la mancha entera.
 * Acá tiene su recuadro para que marcarla sea el mismo gesto que el resto, y va
 * primero: es donde cae la respuesta popular de esta lámina.
 *
 * Cada área lleva su nombre encima, como en el cuadernillo. Sin eso hay que
 * pasar el puntero por el dibujo para saber cuál es cuál, que es el mismo
 * hojeo con otra forma.
 */
/**
 * El recorte que no figura en la tabla.
 *
 * Cuando la persona señala una zona que no es ninguna de las veinte áreas del
 * libro, la localización es Dd y el número 99. No se dibuja en el mapa porque no
 * tiene un lugar fijo: es cualquier recorte que no esté listado. La Tabla A no
 * le ofrece respuestas, así que lo que se cargue ahí entra con la calidad formal
 * a mano.
 */
const FUERA_DE_TABLA = 'Dd99';

/**
 * La calidad formal que puede tener una respuesta fuera de tabla.
 *
 * Dd99 es el área que la Tabla A no lista, así que no hay contra qué comparar
 * la forma: la evaluadora decide si se parece a lo que ahí ve mucha gente (U) o
 * si no se parece (-). Ordinaria y superior salen de estar en la tabla, y una
 * respuesta que no está no las puede tener.
 */
const FQ_FUERA_DE_TABLA = FQ.filter((o) => o.v === 'U' || o.v === '-');

/**
 * Cuántas respuestas se toman por lámina.
 *
 * Lo puso Agustín el 10/9/2026. Es una pared: la quinta no se escribe. Si
 * alguna vez entra un protocolo de papel que tenga más, se levanta cambiando
 * este número y nada más.
 */
const TOPE_POR_LAMINA = 4;


/**
 * La calidad evolutiva sola, sin la familia que la acompaña.
 *
 * El código guardado es "Ddv/+", pero en el paso de elegirla la localización ya
 * está dicha arriba, en la respuesta: repetirla en cada botón obliga a leer
 * cuatro veces lo mismo para encontrar la letra que cambia.
 *
 * Devuelve vacío para un código sin calidad evolutiva, que en la Tabla 4 no
 * existe: así "Dd" a secas, que viene del vocabulario de Airtable, no se ofrece
 * como si fuera una opción.
 */
function soloDq(localizacion: string): string {
  return localizacion.replace(/^(W|Dd|D)S?/, '');
}

const MAPAS: Record<string, string[][]> = {
  // Dd99 va en el mapa de W, en una esquina libre de tinta: no es un área de la
  // lámina, es el recorte que no figura en el libro, así que no tiene contorno
  // que dibujar ni línea que lo una a nada.
  I: [
    ['W', FUERA_DE_TABLA],
    ['D1', 'Dd24'],
    ['D2', 'D3', 'Dd22', 'Dd28'],
    ['D4', 'Dd23', 'Dd25'],
    ['D7', 'Dd21', 'Dd33', 'Dd34', 'Dd35'],
    ['Dd27', 'DdS29', 'DdS30'],
    ['Dd31', 'DdS26', 'DdS32'],
  ],
  // El reparto del cuadernillo para la II, que agrupa distinto: son seis
  // recuadros y no cinco, y las áreas no son las mismas que las de la I.
  II: [
    ['W', FUERA_DE_TABLA],
    ['D1', 'D2'],
    ['D3', 'D4', 'Dd21'],
    ['D6'],
    ['DS5', 'Dd22', 'Dd31'],
    ['Dd23', 'Dd24', 'Dd26', 'Dd27'],
    ['Dd25', 'Dd28', 'DdS29', 'DdS30'],
  ],
  // El reparto del cuadernillo para la III, recuadro por recuadro: cada
  // locación va en el mismo mapa en el que la agrupa el libro. Ese reparto no
  // es decorativo, agrupa lo que no se pisa entre sí.
  III: [
    ['W', FUERA_DE_TABLA],
    ['D1'],
    ['D9', 'Dd27', 'Dd28', 'Dd21', 'D8', 'Dd33'],
    ['Dd35', 'Dd25', 'Dd29', 'Dd26'],
    ['D2', 'Dd34', 'Dd32', 'D3', 'Dd31', 'D5'],
    ['Dd22', 'Dd30', 'D7'],
    ['DdS24', 'DdS23'],
  ],
};

/**
 * Dónde va el nombre de cada área, marcado sobre la lámina.
 *
 * Son puntos que dibujó Agustín el 9/9/2026 en `~/Desktop/tags-rorschach.png` y
 * que midió `scripts/leer-tags-rorschach.py`, en fracción de la imagen. Están
 * escritos y no calculados porque dónde entra el nombre sin tapar lo que hay que
 * mirar no sale de ninguna regla: depende de la forma de la mancha alrededor, y
 * la heurística acertaba en la mayoría y fallaba en las que importan.
 *
 * Para corregir uno se vuelve a generar la hoja, se marca el punto nuevo y se
 * mide; a mano se pierde media hora en acertar un decimal.
 */
const TAGS: Record<string, Record<string, [number, number]>> = {
  I: {
  W: [0.492, 0.453],
  D1: [0.502, 0.177],
  D2: [0.853, 0.175],
  D3: [0.62, 0.88],
  D4: [0.497, 0.185],
  D7: [0.123, 0.2],
  Dd21: [0.497, 0.2],
  Dd22: [0.5, 0.21],
  Dd23: [0.697, 0.865],
  Dd24: [0.63, 0.875],
  Dd25: [0.877, 0.2],
  DdS26: [0.34, 0.87],
  Dd27: [0.497, 0.165],
  Dd28: [0.153, 0.155],
  DdS29: [0.287, 0.87],
  DdS30: [0.74, 0.87],
  Dd31: [0.63, 0.87],
  DdS32: [0.5, 0.2],
  Dd33: [0.713, 0.838],
  Dd34: [0.847, 0.2],
  Dd35: [0.123, 0.545],
  Dd99: [0.865, 0.813],
  },
  // Marcados por Agustín el 9/9/2026 sobre la hoja de control de la II.
  II: {
    W: [0.496, 0.121],
    D1: [0.739, 0.184],
    D2: [0.253, 0.184],
    D3: [0.327, 0.879],
    D4: [0.496, 0.121],
    DS5: [0.496, 0.13],
    D6: [0.496, 0.121],
    Dd21: [0.723, 0.184],
    Dd22: [0.116, 0.82],
    Dd23: [0.792, 0.845],
    Dd24: [0.348, 0.82],
    Dd25: [0.316, 0.845],
    Dd26: [0.765, 0.18],
    Dd27: [0.248, 0.222],
    Dd28: [0.707, 0.879],
    DdS29: [0.749, 0.206],
    DdS30: [0.227, 0.206],
    Dd31: [0.823, 0.307],
    Dd99: [0.865, 0.9],
  },
  // Marcados por Agustín el 10/9/2026 sobre la hoja de control de la III.
  III: {
    W: [0.5, 0.09],
    D1: [0.65, 0.112],
    D2: [0.369, 0.112],
    D3: [0.504, 0.211],
    D5: [0.779, 0.782],
    D7: [0.498, 0.867],
    D8: [0.44, 0.867],
    D9: [0.471, 0.145],
    Dd21: [0.808, 0.381],
    Dd22: [0.4, 0.189],
    DdS23: [0.796, 0.708],
    DdS24: [0.492, 0.09],
    Dd25: [0.591, 0.108],
    Dd26: [0.776, 0.712],
    Dd27: [0.6, 0.189],
    Dd28: [0.44, 0.223],
    Dd29: [0.56, 0.223],
    Dd30: [0.66, 0.223],
    Dd31: [0.6, 0.863],
    Dd32: [0.638, 0.101],
    Dd33: [0.87, 0.763],
    Dd34: [0.36, 0.112],
    Dd35: [0.26, 0.112],
    Dd99: [0.88, 0.93],
  },
};

/** La lámina es más ancha que alta, y las distancias hay que medirlas parejas. */
const ASPECTO = 1.5;

type Puesto = { x: number; y: number; ax: number; ay: number };

/** Si el punto cae adentro del área: ahí el nombre no necesita línea. */
function adentro(x: number, y: number, partes: Parte[]): boolean {
  let cruces = 0;
  for (const parte of partes) {
    for (let i = 0, j = parte.length - 1; i < parte.length; j = i++) {
      const [xi, yi] = parte[i];
      const [xj, yj] = parte[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) cruces++;
    }
  }
  return cruces % 2 === 1;
}

/**
 * El nombre de un área y el punto del que sale su línea.
 *
 * La línea va al punto del contorno más cercano al nombre, así apunta al borde
 * que tiene enfrente y no al centro. Un área sin punto marcado (Dd99, o una
 * lámina nueva) cae en el medio de su pedazo más grande, que alcanza para no
 * dejarla sin nombre.
 */
function puesto(lamina: string, nombre: string, partes: Parte[]): Puesto {
  const marcado = TAGS[lamina]?.[nombre];
  const x = marcado ? marcado[0] : promedio(partes, 0);
  const y = marcado ? marcado[1] : promedio(partes, 1);
  if (adentro(x, y, partes)) return { x, y, ax: x, ay: y };

  let ax = x;
  let ay = y;
  let cerca = Infinity;
  for (const parte of partes) {
    for (const [px, py] of parte) {
      const d = ((px - x) * ASPECTO) ** 2 + (py - y) ** 2;
      if (d < cerca) {
        cerca = d;
        ax = px;
        ay = py;
      }
    }
  }
  return { x, y, ax, ay };
}

/** El promedio de una coordenada sobre todos los puntos del área. */
function promedio(partes: Parte[], eje: 0 | 1): number {
  const puntos = partes.flat();
  return puntos.length ? puntos.reduce((t, q) => t + q[eje], 0) / puntos.length : 0.5;
}

/**
 * Una respuesta que ya está en la ficha.
 *
 * Se muestran arriba de las que se están capturando, apagadas: la evaluadora
 * tiene que ver qué hay de esta lámina sin abrir la ficha en otra pestaña, y
 * el número correlativo solo se entiende viendo lo anterior. No se editan acá:
 * ya son de la ficha, que es donde se corrigen.
 */
export type YaEnLaFicha = {
  id: string;
  n_respuesta: number | null;
  lamina: string | null;
  localizacion: string | null;
  n_localizacion: string | null;
  fq: string | null;
  contenidos: string[] | null;
  popular: boolean | null;
  z: number | null;
  /** La nota de la evaluadora sobre esta respuesta. */
  observacion: string | null;
  /** Lo que dijo el candidato, si esta respuesta se tomó en la primera vuelta. */
  verbalizacion: string | null;
  /** Cómo sostuvo la lámina al darla. */
  posicion: string | null;
};

/** Un objeto de la respuesta: qué es, dónde cae y qué calidad tiene ahí. */
type Trozo = {
  texto: string;
  areas: string[];
  fq: string | null;
  contenidos: string[];
  popular: boolean;
};

/**
 * De peor a mejor. El FQ de una respuesta partida es el de su peor palabra.
 *
 * Definido por las psicólogas el 10/9/2026: si una parte cae en una locación
 * donde lo que dijo no se parece a nada, la respuesta entera arrastra eso.
 */
const RANGO_FQ = ['-', 'U', 'O', '+'];

function peorFq(fqs: (string | null)[]): string | null {
  const puestos = fqs.filter((f): f is string => Boolean(f));
  if (puestos.length === 0) return null;
  return puestos.reduce((peor, f) =>
    RANGO_FQ.indexOf(f) < RANGO_FQ.indexOf(peor) ? f : peor
  );
}

type Respuesta = {
  n: number;
  /**
   * La fila que esta respuesta actualiza, si venía tomada de la primera
   * instancia. Sin esto se guardaría una fila nueva y la tomada quedaría
   * duplicada y sin locación.
   */
  id?: string;
  dijo: string;
  areas: string[];
  /** Sin entrada en la tabla: la calidad la pone la evaluadora. */
  extrapolada: boolean;
  fq: string | null;
  localizacion: string | null;
  contenidos: string[];
  popular: boolean;
  /** Lo confirma ella: las áreas están integradas con relación significativa. */
  integradas: boolean;
  /** Lo confirma ella: el blanco entra junto con la tinta. */
  blancoIntegrado: boolean;
  /** Nota libre de la evaluadora sobre esta respuesta. */
  observacion: string;
  /** Lo que dijo el candidato, textual, si venía tomado. */
  verbalizacion: string | null;
  /** Cómo sostuvo la lámina al darla. */
  posicion: string | null;
};

/** '4' para D4, '26' para DdS26, '4+7' cuando integra dos. W va sin número. */
/**
 * Las áreas de una respuesta que ya está guardada.
 *
 * La ficha guarda el número del área y la letra aparte ("33+29" con "Ddv/+"),
 * así que para volver a dibujarla y para recalcular su Z hay que rearmar los
 * nombres. El número es único dentro de la lámina, así que alcanza con buscarlo
 * entre las áreas de esa lámina; si no aparece, se arma con la familia que dice
 * la localización.
 */
function areasDeLaFicha(r: YaEnLaFicha): string[] {
  const familia = (r.localizacion ?? '').replace(/(v\/\+|o|v|\+)$/, '') || 'Dd';
  const numeros = (r.n_localizacion ?? '')
    .split('+')
    .map((n) => n.trim())
    .filter((n) => /^\d+$/.test(n));
  if (numeros.length === 0) return familia === 'W' || familia === 'WS' ? [familia] : [];
  const dela = AREAS[r.lamina ?? ''] ?? {};
  const nombres = Object.keys(dela);
  return numeros.map(
    (n) => nombres.find((a) => a.replace(/^D?d?S?/, '') === n) ?? `${familia}${n}`
  );
}

function numeroDe(areas: string[]): string | null {
  const ns = areas.map((a) => a.replace(/^D?d?S?/, '')).filter(Boolean);
  return ns.length ? ns.join('+') : null;
}

/**
 * Cómo se muestra la lámina cuando el candidato la giró.
 *
 * Se gira el lienzo entero, con los contornos y los rótulos adentro: es lo que
 * ella ve si da vuelta la hoja, y así la locación que marca es la que él vio.
 * Girada un cuarto, la lámina apaisada queda parada y no entra a lo ancho del
 * recuadro, así que se achica en la misma proporción que tienen sus lados.
 */
function estiloDelGiro(posicion: string | null): React.CSSProperties | undefined {
  const grados = GIRO[posicion ?? '^'] ?? 0;
  if (!grados) return undefined;
  const cuarto = grados === 90 || grados === 270;
  return { transform: `rotate(${grados}deg)${cuarto ? ' scale(0.667)' : ''}` };
}

function camino(parte: Parte): string {
  return parte.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 100).toFixed(2)} ${(y * 100).toFixed(2)}`).join(' ') + 'Z';
}

export default function Capturador({
  evaluacionId,
  nombre,
  lamina: primera,
  desde,
  yaEstan,
}: {
  evaluacionId: string;
  nombre: string;
  /** Con cuál abre: después la pantalla la lleva por su cuenta. */
  lamina: string;
  /** Desde qué número seguir: el protocolo se numera corrido, no por lámina. */
  desde: number;
  /** Lo que ya está en la ficha, de todas las láminas. */
  yaEstan: YaEnLaFicha[];
}) {
  const [puestas, setPuestas] = useState<string[]>([]);
  const [encima, setEncima] = useState<string | null>(null);
  const [dijo, setDijo] = useState('');
  /**
   * La respuesta que ya se eligió y espera su calidad evolutiva.
   *
   * El DQ se elige acá, sobre la marcha, y no después en la tabla: es lo único
   * de la codificación que sale de cómo la persona describió lo que vio, y eso
   * se tiene fresco recién dicha la respuesta. `null` adentro es la respuesta
   * que no figura en la tabla, que también lleva DQ.
   */
  const [pendiente, setPendiente] = useState<{
    h: Hallazgo | null;
    partida?: boolean;
    /** Lo confirma ella antes de cerrar: las áreas van con relación entre sí. */
    integradas?: boolean;
    /** Lo confirma ella antes de cerrar: el blanco entra junto con la tinta. */
    blancoIntegrado?: boolean;
  } | null>(null);
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  /**
   * Qué fila está pidiendo confirmación para borrarse.
   *
   * La × está al lado de campos que se tocan todo el tiempo y borrar no se
   * puede deshacer: lo capturado de esa respuesta se pierde y hay que volver a
   * marcar el área y buscar la respuesta. Es el mismo paso que pide el resto
   * del OS antes de un borrado.
   */
  const [aBorrar, setABorrar] = useState<number | null>(null);
  /**
   * Qué filas tienen abierto lo de abajo.
   *
   * Los tildes del puntaje y el porqué de la Z se deciden al cerrar la
   * respuesta; en la tabla son para corregir, y puestos siempre hacían de cada
   * fila tres renglones. Se abren desde su botón.
   */
  const [abiertas, setAbiertas] = useState<number[]>([]);
  /**
   * Los dos tildes de Z de las respuestas que ya están en la ficha.
   *
   * La ficha guarda el puntaje pero no de dónde salió, así que corrigiendo una
   * respuesta guardada hay que volver a preguntarlos. Arrancan sin tildar, que
   * es como se guardó el puntaje la primera vez.
   */
  const [marcas, setMarcas] = useState<
    Record<string, { integradas: boolean; blancoIntegrado: boolean }>
  >({});
  /** Para no mandar un guardado por cada tecla de la nota. */
  const enEspera = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /**
   * La lámina la lleva la pantalla, no el servidor.
   *
   * Todo lo que cambia al pasar de una a otra (los mapas, las áreas, la Tabla
   * A) es del cliente: volver al servidor por cada cambio costaba medio segundo
   * de esperar una página que ya se tenía. La dirección se acomoda igual, sin
   * navegar, para que recargar mantenga la lámina.
   */
  const [lamina, setLamina] = useState(primera);
  /**
   * En cuál de las dos instancias está la pantalla.
   *
   * La entrevista y la encuesta son dos momentos de la administración, y a veces con
   * días de por medio: primero la evaluadora le muestra las láminas y anota lo
   * que el candidato dice, y después vuelve sobre lo anotado a preguntarle
   * dónde vio cada cosa. Los dos botones dicen en cuál está y cuántas quedan
   * por ubicar en esta lámina, con los nombres que ellas usan.
   */
  /* Abre en la entrevista: es el primer momento de la administración y el que
     se hace con la persona delante. La encuesta se elige después, cuando ella ya
     dijo todo y se vuelve sobre lo anotado. */
  const [fase, setFase] = useState<'entrevista' | 'encuesta'>('entrevista');
  /**
   * Qué está viendo la persona, según su propia pantalla.
   *
   * Es lo que ella contesta sola cada dos segundos. Sin esto, desde acá no había
   * forma de saber si esa pantalla seguía abierta: se pasaba de lámina, no
   * pasaba nada del otro lado y recién se descubría preguntándole a la persona
   * qué estaba viendo.
   */
  const [ve, setVe] = useState<{ lamina: number; cuando: number } | null>(null);
  /** Se recalcula solo, para que "no está abierta" aparezca sin tocar nada. */
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const preguntar = () => {
      setAhora(Date.now());
      canal.current?.postMessage({
        lamina: 0,
        de: 'codificacion',
        evaluacion: evaluacionId,
        pulso: 'donde',
      } satisfies Aviso);
    };
    const reloj = window.setInterval(preguntar, PULSO_MS);
    preguntar();
    return () => window.clearInterval(reloj);
  }, [evaluacionId]);
  const laPantallaEsta = ve !== null && ahora - ve.cuando < SIN_RESPUESTA_MS;

  /** Lo que dijo el candidato, mientras se lo escribe en la entrevista. */
  const [tomando, setTomando] = useState('');
  /** Cómo sostuvo la lámina en la respuesta que se está anotando. */
  const [posicion, setPosicion] = useState('^');
  /** Cuál de las tomadas se está ubicando. */
  const [ubicando, setUbicando] = useState<string | null>(null);
  /**
   * En qué objetos se separó la respuesta que se está codificando.
   *
   * "Un mono tomando birra en la copa de un árbol" no está en la Tabla A, y sus
   * objetos sí: mono, birra, árbol. Cada uno se busca por separado, cae en su
   * propia locación y tiene su propia calidad formal. La respuesta se cierra
   * con las áreas de todas y con la peor de sus calidades, que es la regla que
   * dieron las psicólogas el 10/9/2026: el FQ es el de menor rango entre las
   * palabras (−, u, o, +).
   */
  const [trozos, setTrozos] = useState<Trozo[]>([]);
  /** Si la respuesta en curso se está codificando por partes. */
  const [partiendo, setPartiendo] = useState(false);
  /** Lo que hay en la ficha, más lo que se va pasando sin recargar. */
  const [enLaFicha, setEnLaFicha] = useState(yaEstan);
  /** Desde qué número numerar, contando lo que se pasó sin recargar. */
  const [proximo, setProximo] = useState(desde);

  // El archivo de la lámina va por número y la codificación por su romano.
  const numeroDeLamina = ORDEN.indexOf(lamina) + 1;
  const anterior = numeroDeLamina > 1 ? ORDEN[numeroDeLamina - 2] : null;
  /* Desde cuándo están en láminas distintas. El desfase se avisa recién cuando
     dura: en cada cambio hay un momento en que una ya cambió y la otra está
     bajando la imagen nueva, y un aviso que salta en cada cambio enseña a
     ignorarlo. */
  const coinciden = laPantallaEsta && ve?.lamina === numeroDeLamina;
  const desdeCuandoDistintas = useRef(0);
  if (coinciden || !laPantallaEsta) desdeCuandoDistintas.current = 0;
  else if (!desdeCuandoDistintas.current) desdeCuandoDistintas.current = Date.now();
  const veLaMisma =
    coinciden ||
    (laPantallaEsta && ahora - desdeCuandoDistintas.current < DESFASE_MS);
  const suyas = enLaFicha.filter((r) => r.lamina === lamina);
  const archivoDe = (n: string) => `/api/os/lamina/rorschach/${ORDEN.indexOf(n) + 1}`;

  /**
   * Las que se tomaron y todavía no se ubicaron en la mancha.
   *
   * Son las de la primera instancia: la evaluadora escuchó al candidato y
   * escribió lo que dijo, sin preguntarle dónde lo vio. Se reconocen porque
   * tienen su verbalización y ninguna locación.
   */
  /* Las que se acaban de codificar y todavía no se pasaron a la ficha ya no
     están sin ubicar: sin esto, terminar de codificar una la dejaba en la lista
     y la pantalla volvía a pedir la misma respuesta. */
  const yaCodificadas = new Set(respuestas.map((r) => r.id).filter(Boolean));
  const sinUbicar = suyas.filter(
    (r) => r.verbalizacion && !r.localizacion && !r.n_localizacion && !yaCodificadas.has(r.id)
  );

  /**
   * Lo que la persona ya dijo en esta lámina, en orden.
   *
   * Junta lo que está en la ficha con lo que se acaba de capturar sin pasar:
   * las dos cosas son respuestas que ella dio en esta lámina, y de eso se trata
   * la lista que la evaluadora mira mientras escucha la que sigue.
   */
  const dichasDeLaLamina = [
    ...suyas
      .filter((r) => r.verbalizacion)
      .map((r) => ({
        id: r.id,
        n: r.n_respuesta ?? 0,
        texto: r.verbalizacion ?? '',
        posicion: r.posicion,
      })),
    ...respuestas
      .filter((r) => !r.id && r.verbalizacion)
      .map((r) => ({
        id: undefined as string | undefined,
        n: r.n,
        texto: r.verbalizacion ?? '',
        posicion: r.posicion,
      })),
  ]
    .sort((a, b) => a.n - b.n)
    // El número que se ve es el de esta lámina; el del protocolo va en la ficha.
    .map((r, i) => ({ ...r, n: i + 1, nProtocolo: r.n }));

  /**
   * Cuál se está codificando: la elegida, o la primera que falte ubicar.
   *
   * Se codifica de a una. Mostrar las tres pendientes obligaba a elegir en cada
   * paso cuál seguía, y el orden ya está dado: es el que la persona las dijo.
   */
  const enCurso = sinUbicar.find((v) => v.id === ubicando) ?? sinUbicar[0] ?? null;
  /* Y el buscador arranca cargado con lo que dijo, sin que haya que elegir la
     respuesta primero: entrando a la encuesta ya está la primera lista para
     ubicar. */
  useEffect(() => {
    if (fase !== 'encuesta' || !enCurso) return;
    if (ubicando === enCurso.id) return;
    setUbicando(enCurso.id);
    // Separando objetos el campo es el del objeto, y arranca vacío: lo que dijo
    // la persona está arriba a la vista y se escribe una palabra por vez.
    setDijo(partiendo ? '' : enCurso.verbalizacion ?? '');
    setPuestas([]);
  }, [fase, enCurso, ubicando, partiendo]);

  /**
   * Lo que ya está en la ficha de esta lámina, con la forma de una respuesta.
   *
   * Se corrige acá mismo y no solo en la ficha: la evaluadora está mirando la
   * mancha, y mandarla a otra pantalla para cambiar un contenido le hace perder
   * dónde estaba.
   */
  /**
   * Con qué tildes se guardó el puntaje Z de una respuesta que ya está.
   *
   * La ficha guarda el número y no de dónde salió. Se prueban las cuatro
   * combinaciones y se queda con la que da ese número: así una respuesta
   * guardada muestra el Z que tiene, y no uno nuevo calculado sin sus tildes.
   */
  function marcasDe(r: YaEnLaFicha): { integradas: boolean; blancoIntegrado: boolean } {
    const puestas = marcas[r.id];
    if (puestas) return puestas;
    const apagadas = { integradas: false, blancoIntegrado: false };
    if (r.z == null) return apagadas;
    const areas = areasDeLaFicha(r);
    for (const integradas of [false, true]) {
      for (const blancoIntegrado of [false, true]) {
        const v = puntajeZ(lamina, {
          areas,
          localizacion: r.localizacion,
          integradas,
          blancoIntegrado,
        });
        if ((v.z?.valor ?? null) === r.z) return { integradas, blancoIntegrado };
      }
    }
    return apagadas;
  }

  /* Sin locación no hay fila que corregir: esa respuesta se tomó en la
     entrevista y todavía se está codificando arriba. Va como renglón simple,
     con su número y lo que dijo, y sin los selectores, que necesitan un área
     para saber qué localizaciones ofrecer. */
  const enLaFichaSinCodificar = suyas.filter(
    (r) => !yaCodificadas.has(r.id) && areasDeLaFicha(r).length === 0
  );

  const deLaFicha: Respuesta[] = suyas
    .filter((r) => !yaCodificadas.has(r.id) && areasDeLaFicha(r).length > 0)
    .map((r) => ({
      n: r.n_respuesta ?? 0,
      id: r.id,
      dijo: r.verbalizacion ?? '',
      areas: areasDeLaFicha(r),
      extrapolada: false,
      fq: r.fq,
      localizacion: r.localizacion,
      contenidos: r.contenidos ?? [],
      popular: r.popular ?? false,
      integradas: marcasDe(r).integradas,
      blancoIntegrado: marcasDe(r).blancoIntegrado,
      observacion: r.observacion ?? '',
      verbalizacion: r.verbalizacion,
      posicion: r.posicion,
    }));

  /**
   * Corregir una respuesta que ya está guardada.
   *
   * Va derecho a la ficha, sin esperar a que se pase de lámina: la fila ya
   * existe allá, y lo que se toca acá es esa misma fila. El puntaje Z se
   * recalcula, porque cambiar la locación o los tildes lo cambia.
   */
  async function cambiarEnLaFicha(id: string, campos: Partial<Respuesta>) {
    const fila = deLaFicha.find((r) => r.id === id);
    if (!fila) return;
    const nueva = { ...fila, ...campos };
    if ('integradas' in campos || 'blancoIntegrado' in campos) {
      setMarcas((m) => ({
        ...m,
        [id]: { integradas: nueva.integradas, blancoIntegrado: nueva.blancoIntegrado },
      }));
    }
    const z = zDe(nueva).z?.valor ?? null;
    setEnLaFicha((f) =>
      f.map((r) =>
        r.id === id
          ? {
              ...r,
              localizacion: nueva.localizacion,
              fq: nueva.fq,
              contenidos: nueva.contenidos,
              popular: nueva.popular,
              observacion: nueva.observacion || null,
              z,
            }
          : r
      )
    );
    const guardar = async () => {
      const bien = await guardarCelda(id, {
        localizacion: nueva.localizacion,
        fq: nueva.fq,
        contenidos: nueva.contenidos,
        popular: nueva.popular,
        observacion: nueva.observacion || null,
        z,
      });
      if (!bien) setAviso('No se pudo guardar esa corrección. Probá de nuevo.');
    };
    // La nota se escribe letra por letra: se espera a que pare de escribir.
    clearTimeout(enEspera.current[id]);
    if ('observacion' in campos) {
      enEspera.current[id] = setTimeout(guardar, 600);
      return;
    }
    await guardar();
  }

  /** Dónde cae la respuesta que está esperando su calidad evolutiva. */
  const areasPendientes = !pendiente
    ? []
    : pendiente.partida
      ? [...new Set(trozos.flatMap((t) => t.areas))]
      : puestas.length > 0
        ? puestas
        : pendiente.h
          ? [pendiente.h.area]
          : [];

  /** La posición de la respuesta que se está ubicando, para girar los mapas. */
  const posicionDeLaQueUbico = ubicando
    ? suyas.find((v) => v.id === ubicando)?.posicion ?? '^'
    : '^';

  /** Cuántas respuestas tiene ya esta lámina, tomadas y capturadas. */
  const cuantasEnLaLamina = suyas.length + respuestas.filter((r) => !r.id).length;
  const laminaLlena = cuantasEnLaLamina >= TOPE_POR_LAMINA;
  /**
   * Qué número le toca a la respuesta que se está por escribir.
   *
   * Es el del protocolo entero, contando las de las láminas anteriores: el
   * botón decía "Guardar respuesta 1" en la VII porque contaba solo las de esa
   * lámina, y después guardaba con el número que de verdad le tocaba. Es el
   * mismo cálculo que hace `anotar` al guardar, así que lo que se lee es lo que
   * queda escrito.
   */
  const proximoNumero =
    enLaFicha.filter((r) => ORDEN.indexOf(r.lamina ?? '') <= numeroDeLamina - 1).length + 1;
  /**
   * Y el que se muestra mientras se entrevista, que es la cuenta de esta
   * lámina.
   *
   * Son dos números distintos a propósito. La ficha guarda el del protocolo,
   * que es lo que cuenta el sumario y sigue de corrido de una lámina a la otra.
   * Pero administrando, lo que se lleva en la cabeza es cuántas van en la
   * lámina que se tiene delante: con cuatro cargadas en la I, la primera de la
   * II decía "respuesta 5" y se leía como un error.
   */
  const numeroEnLaLamina = cuantasEnLaLamina + 1;

  /**
   * Las láminas vecinas se bajan mientras se codifica esta.
   *
   * Los contornos son un dibujo y aparecen al instante; la lámina es una
   * imagen de dos megas que sale del bucket, así que al cambiar se veían un
   * segundo las áreas nuevas sobre la mancha anterior. Bajarla antes hace que
   * el cambio sea inmediato, y cuesta nada: se hace mientras la evaluadora
   * escribe.
   */
  /**
   * La pantalla que ve el candidato sigue a esta.
   *
   * En la toma la evaluadora comparte por videollamada la pestaña de las
   * láminas y trabaja en esta: pasa de lámina acá, mientras escribe, y allá
   * cambia sola. Comparte la pestaña y no la pantalla justamente para eso, así
   * él ve la mancha y no lo que ella está anotando.
   */
  const canal = useRef<BroadcastChannel | null>(null);
  /* El canal se abre una sola vez, así que su escucha se quedaría con el
     `guardar` del primer dibujo y con las respuestas que había entonces. Esta
     referencia apunta siempre al último. */
  const irA = useRef<((n: string) => void) | null>(null);
  useEffect(() => {
    const c = abrirCanal();
    canal.current = c;
    if (!c) return;
    c.onmessage = (e: MessageEvent<Aviso>) => {
      /* Si ella pasa de lámina en la pantalla compartida, esta la sigue, y por
         el mismo camino que los botones de acá: cambiar sin pasar lo capturado
         a la ficha lo perdería, y desde allá ni se vería que se perdió. */
      if (e.data?.de !== 'laminas' || !esParaMi(e.data, evaluacionId)) return;
      /* La respuesta dice dónde está esa pantalla; no pide cambiar de lámina.
         Se cuenta solo la de la pantalla abierta para esta evaluación: una
         abierta suelta, sin candidato, le contesta a cualquiera, y si quedó en
         otra lámina haría decir que la persona ve algo que no ve. */
      if (e.data.pulso) {
        if (e.data.pulso === 'aca' && e.data.evaluacion === evaluacionId) {
          setVe({ lamina: e.data.lamina, cuando: Date.now() });
        }
        return;
      }
      const romano = ORDEN[e.data.lamina - 1];
      if (romano) irA.current?.(romano);
    };
    return () => {
      canal.current = null;
      c.close();
    };
  }, []);

  // La lámina que se está codificando es la que el candidato tiene que ver.
  useEffect(() => {
    canal.current?.postMessage({
      lamina: ORDEN.indexOf(lamina) + 1,
      de: 'codificacion',
      evaluacion: evaluacionId,
    } satisfies Aviso);
  }, [lamina]);

  useEffect(() => {
    for (const n of [siguienteDe(lamina), anterior]) {
      if (n && CARGADAS.includes(n)) new window.Image().src = archivoDe(n);
    }
  }, [lamina, anterior]);
  const [guardando, setGuardando] = useState(false);
  /** Mientras se guarda una respuesta de la entrevista. */
  const [anotando, setAnotando] = useState(false);
  /** Cuál respuesta tomada está esperando que confirmen su borrado. */
  const [borrando, setBorrando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /**
   * Las respuestas que ofrece la lista, a partir de lo que se escribió.
   *
   * Es un solo campo y no dos: se escribe lo que la persona dijo y eso mismo
   * busca en la tabla. Con dos campos había que decidir en cuál escribir antes
   * de saber si la respuesta figuraba, y el mismo texto terminaba tipeado dos
   * veces.
   *
   * Con áreas marcadas la lista es la de esas áreas y lo escrito filtra
   * adentro: la persona ya dijo dónde lo vio, así que ofrecerle lo que existe
   * en otra parte de la lámina es ofrecerle codificar mal. Sin área marcada se
   * busca en toda la lámina, que es el camino de llegar por la palabra cuando
   * describe en vez de señalar.
   *
   * Una respuesta puede usar dos detalles usuales a la vez, y entonces la lista
   * junta los de las dos, ordenados por respuesta: "cara humana" en D1 y en D2
   * queda en renglones seguidos y se comparan las dos calidades, que es la
   * decisión que hay que tomar. El área va al costado de cada renglón.
   */
  const opciones: Hallazgo[] = useMemo(() => {
    const q = plano(dijo.trim());
    if (puestas.length === 0) return q ? buscar(lamina, dijo).slice(0, 40) : [];
    const suyas = puestas
      .flatMap((a) => entradasDe(lamina, a))
      .sort((x, y) => x.respuesta.localeCompare(y.respuesta, 'es') || x.area.localeCompare(y.area));
    if (!q) return suyas;
    // Primero lo que empieza con lo escrito y después lo que lo tiene al
    // principio de alguna de sus palabras, como en el buscador de toda la
    // lámina. Con una sola letra, solo lo que empieza.
    const empieza = suyas.filter((e) => plano(e.respuesta).startsWith(q));
    if (q.length === 1) return empieza;
    const enOtraPalabra = suyas.filter(
      (e) => !plano(e.respuesta).startsWith(q) && empiezaAlgunaPalabra(plano(e.respuesta), q)
    );
    return [...empieza, ...enOtraPalabra];
  }, [dijo, puestas]);

  function alternar(a: string) {
    setPuestas((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
    // Cambiar de área es empezar otra respuesta: la que esperaba su calidad ya
    // no va en el área que quedó marcada.
    setPendiente(null);
  }

  /**
   * Suma un trozo a la respuesta que se está codificando.
   *
   * Se usa cuando la respuesta se rompe en palabras: cada una cae en su
   * locación y trae su calidad de la Tabla A. La respuesta se cierra después,
   * con todas juntas.
   */
  function sumarTrozo(h: Hallazgo | null) {
    const areas = puestas.length > 0 ? puestas : h ? [h.area] : [];
    if (areas.length === 0) return;
    const texto = h?.respuesta ?? dijo.trim();
    if (!texto) return;
    const entrada =
      h && areas.includes(h.area)
        ? h
        : areas
            .flatMap((a) => entradasDe(lamina, a))
            .find((e) => e.respuesta === texto) ?? null;
    setTrozos((t) => [
      ...t,
      {
        texto,
        areas,
        fq: entrada ? fqDeLaFicha(entrada.calidad) : null,
        contenidos: contenidoSugerido(texto),
        popular: esPopular(lamina, areas[0], texto),
      },
    ]);
    setDijo('');
    setPuestas([]);
    setPendiente(null);
  }

  /**
   * Cierra la respuesta partida: junta las áreas y se queda con el peor FQ.
   *
   * Las áreas van todas, sin repetir, y en el orden en que se marcaron. Los
   * contenidos se suman: cada palabra aporta el suyo, que es de lo que se
   * trataba partir la respuesta.
   */
  function cerrarPartida(dq: string | null) {
    if (trozos.length === 0) return;
    const tomada = ubicando ? suyas.find((v) => v.id === ubicando) ?? null : null;
    const areas = [...new Set(trozos.flatMap((t) => t.areas))];
    const contenidos = [...new Set(trozos.flatMap((t) => t.contenidos))];
    const locs = localizacionesDe(areas[0]);
    setRespuestas((rs) => [
      ...rs,
      {
        n: tomada?.n_respuesta ?? proximo + rs.length,
        dijo: tomada?.verbalizacion ?? trozos.map((t) => t.texto).join(' · '),
        areas,
        extrapolada: trozos.some((t) => !t.fq),
        fq: peorFq(trozos.map((t) => t.fq)),
        localizacion: dq ?? (locs.length === 1 ? locs[0] : null),
        contenidos,
        popular: trozos.some((t) => t.popular),
        integradas: pendiente?.integradas ?? false,
        blancoIntegrado: pendiente?.blancoIntegrado ?? false,
        observacion: '',
        id: tomada?.id,
        verbalizacion: tomada?.verbalizacion ?? null,
        posicion: tomada?.posicion ?? null,
      },
    ]);
    setTrozos([]);
    setDijo('');
    setPuestas([]);
    setPendiente(null);
    setUbicando(null);
  }

  function tomar(h: Hallazgo | null, dq: string | null) {
    /**
     * El área la marca ella en el mapa, y el renglón elegido no la cambia.
     *
     * El buscador mira toda la lámina, así que un renglón puede venir de un
     * área que no está marcada: eligiendo "escarabajo · D2" con W marcada, la
     * respuesta quedaba en W + D2 y aparecía el aviso de integración de dos
     * áreas que nadie marcó. Solo cuando no hay nada marcado el renglón dice
     * dónde va, que es el camino de llegar por la palabra.
     */
    const areas = puestas.length > 0 ? puestas : h ? [h.area] : [];
    if (areas.length === 0) return;
    const tomada = ubicando ? suyas.find((v) => v.id === ubicando) ?? null : null;
    const respuesta = h?.respuesta ?? dijo.trim();
    // La calidad formal es la que esa respuesta tiene en el área elegida, no la
    // del renglón que se apretó: la misma respuesta no vale lo mismo en dos
    // áreas, y esa es justamente la decisión que la Tabla A resuelve.
    const entrada =
      h && areas.includes(h.area)
        ? h
        : areas
            .flatMap((a) => entradasDe(lamina, a))
            .find((e) => e.respuesta === respuesta) ?? null;
    const locs = localizacionesDe(areas[0]);
    setRespuestas((rs) => [
      ...rs,
      {
        /* La tomada conserva su número: se lo dio la primera instancia y el
           orden de las respuestas es el orden en que el candidato las dijo. */
        n: tomada?.n_respuesta ?? proximo + rs.length,
        // Elegido un renglón, la respuesta es la de la tabla y no lo que quedó
        // escrito: con un solo campo, lo escrito es lo que se tipeó para
        // encontrarla, y apretar "escarabajo" después de escribir "esca"
        // guardaba "esca". Sin renglón, lo escrito es la respuesta.
        dijo: h ? h.respuesta : dijo.trim(),
        areas,
        extrapolada: !entrada,
        fq: entrada ? fqDeLaFicha(entrada.calidad) : null,
        // La que se eligió al cargar; si no se tocó y el área admite una sola,
        // esa. Con varias y sin elegir queda pendiente para la fila.
        localizacion: dq ?? (locs.length === 1 ? locs[0] : null),
        contenidos: contenidoSugerido(respuesta),
        popular: esPopular(lamina, areas[0], respuesta),
        integradas: pendiente?.integradas ?? false,
        blancoIntegrado: pendiente?.blancoIntegrado ?? false,
        observacion: '',
        /* Ubicando una respuesta de la primera instancia, la fila ya existe y
           lleva lo que dijo el candidato: se completa esa. Capturando de una
           sola pasada, la fila nace acá y lo escrito es la verbalización. */
        id: tomada?.id,
        verbalizacion: tomada?.verbalizacion ?? (h ? null : dijo.trim() || null),
        posicion: tomada?.posicion ?? null,
      },
    ]);
    setDijo('');
    setPuestas([]);
    setPendiente(null);
    setUbicando(null);
  }

  /**
   * Guarda lo que dijo el candidato, sin codificar nada.
   *
   * Va derecho a la ficha en vez de esperar el cambio de lámina, que es lo que
   * hace la captura: en la toma la evaluadora está escuchando y escribiendo, y
   * lo anotado tiene que estar guardado antes de que ella pase a la siguiente
   * sin pensarlo. La fila nace con su lámina, su número y su verbalización, y
   * la locación se le completa en la encuesta.
   */
  async function anotar() {
    const texto = tomando.trim();
    if (!texto || laminaLlena) return;
    setAnotando(true);
    /* El número sale del orden del protocolo y no del final de la lista: las
       respuestas van en el orden de las láminas, así que una que se agrega a la
       I cuando ya hay cargadas de la III se numera antes que ellas y las corre.
       Administrando en orden esto no cambia nada; volviendo atrás a sumar una
       respuesta es lo que evita que los números queden entremezclados. */
    const lugar = (l: string | null) => ORDEN.indexOf(l ?? '');
    const n = proximoNumero;
    const corridas = enLaFicha.filter((r) => lugar(r.lamina) > lugar(lamina));
    const res = await fetch('/api/os/manchas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evaluacionId,
        campos: {
          lamina,
          n_respuesta: n,
          verbalizacion: texto,
          posicion,
          origen: 'captura',
          determinantes: [],
          contenidos: [],
          cc_ee: [],
          par: false,
          agc: false,
          sl: false,
          popular: false,
        },
      }),
    });
    const cuerpo = await res.json().catch(() => null);
    if (!res.ok || !cuerpo?.fila?.id) {
      setAnotando(false);
      setAviso('No se pudo guardar esa respuesta. Probá de nuevo antes de seguir.');
      return;
    }
    // Las de las láminas que siguen corren un lugar.
    for (const r of corridas) {
      await guardarCelda(r.id, { n_respuesta: (r.n_respuesta ?? 0) + 1 });
    }
    setAnotando(false);
    setEnLaFicha((f) => [
      ...f.map((r) =>
        lugar(r.lamina) > lugar(lamina)
          ? { ...r, n_respuesta: (r.n_respuesta ?? 0) + 1 }
          : r
      ),
      {
        id: cuerpo.fila.id,
        n_respuesta: n,
        lamina,
        localizacion: null,
        n_localizacion: null,
        fq: null,
        contenidos: [],
        popular: false,
        z: null,
        observacion: null,
        verbalizacion: texto,
        posicion,
      },
    ]);
    setProximo(n + 1);
    setTomando('');
    setPosicion('^');
    setAviso(null);
  }

  irA.current = (n: string) => {
    void guardar(n);
  };

  /** Guarda una celda de una respuesta que ya está en la ficha. */
  async function guardarCelda(id: string, campos: Record<string, unknown>) {
    const res = await fetch('/api/os/manchas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, campos }),
    });
    return res.ok;
  }

  /** Corregir lo que se escribió: se toma al vuelo y una palabra sale mal. */
  async function corregir(id: string, texto: string) {
    setEnLaFicha((f) => f.map((r) => (r.id === id ? { ...r, verbalizacion: texto } : r)));
    if (!(await guardarCelda(id, { verbalizacion: texto }))) {
      setAviso('No se pudo guardar esa corrección. Probá de nuevo.');
    }
  }

  /**
   * Saca una respuesta y renumera lo que sigue.
   *
   * El número de respuesta es correlativo de todo el protocolo y es lo que
   * cuenta el sumario: dejando el hueco, el protocolo pasa a decir que hubo una
   * respuesta que nadie dio. Se corrigen todas las posteriores, que son las
   * únicas que se corren.
   */
  async function borrarTomada(id: string, n: number) {
    setBorrando(null);
    const posteriores = enLaFicha.filter((r) => (r.n_respuesta ?? 0) > n);
    const res = await fetch(`/api/os/manchas?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setAviso('No se pudo borrar esa respuesta. Probá de nuevo.');
      return;
    }
    for (const r of posteriores) {
      await guardarCelda(r.id, { n_respuesta: (r.n_respuesta ?? 0) - 1 });
    }
    setEnLaFicha((f) =>
      f
        .filter((r) => r.id !== id)
        .map((r) =>
          (r.n_respuesta ?? 0) > n ? { ...r, n_respuesta: (r.n_respuesta ?? 0) - 1 } : r
        )
    );
    setProximo((p) => Math.max(1, p - 1));
    setAviso(null);
  }

  function cambiar(n: number, campos: Partial<Respuesta>) {
    setRespuestas((rs) => rs.map((r) => (r.n === n ? { ...r, ...campos } : r)));
  }

  /**
   * Sacar una respuesta de lo capturado, y renumerar lo que queda.
   *
   * Se toma al vuelo mientras la persona habla, así que una fila puede salir
   * mal: el área equivocada, o una respuesta que después ella misma retira. Sin
   * renumerar quedaría un hueco (24, 26, 27) y el número tiene que ser
   * correlativo de todo el protocolo, que es lo que cuenta el sumario. Estas
   * respuestas todavía no están en la ficha, así que corregirlas acá no toca
   * nada de lo guardado.
   */
  function borrar(n: number) {
    setRespuestas((rs) =>
      rs.filter((r) => r.n !== n).map((r, i) => ({ ...r, n: proximo + i }))
    );
  }

  function zDe(r: Respuesta) {
    return puntajeZ(lamina, {
      areas: r.areas,
      localizacion: r.localizacion,
      integradas: r.integradas,
      blancoIntegrado: r.blancoIntegrado,
    });
  }

  /**
   * Pasa lo capturado a la ficha y abre la lámina que se pida.
   *
   * Todos los caminos para cambiar de lámina pasan por acá, también los
   * números del pie: irse sin guardar perdería lo capturado de esta lámina, y
   * nadie espera que apretar "IV" tire lo que acaba de anotar.
   */
  async function guardar(destino: string | null = siguienteDe(lamina)) {
    setGuardando(true);
    setAviso(null);
    let mal = 0;
    for (const r of respuestas) {
      /* La que venía tomada de la primera instancia ya tiene su fila, con lo
         que dijo el candidato adentro: se le completa la codificación. Guardar
         una nueva dejaría dos, la tomada sin locación y la codificada sin
         verbalización, y el número de respuesta repetido. */
      const res = await fetch('/api/os/manchas', {
        method: r.id ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(r.id ? { id: r.id } : { evaluacionId }),
          campos: {
            lamina: lamina,
            n_respuesta: r.n,
            // La ficha guarda el número del área y la letra va en la
            // localización: D1 es localizacion 'Do' con n_localizacion '1'. W
            // no tiene número.
            n_localizacion: numeroDe(r.areas),
            localizacion: r.localizacion,
            fq: r.fq,
            contenidos: r.contenidos,
            popular: r.popular,
            z: zDe(r).z?.valor ?? null,
            // Lo que dijo va como observación y no como verbalización guardada:
            // el protocolo escrito sigue siendo la fuente, y esto es lo que le
            // permite completar en la ficha los cinco campos que faltan.
            observacion: [r.dijo, r.observacion].filter(Boolean).join(' · ') || null,
            origen: 'captura',
            determinantes: [],
            cc_ee: [],
            par: false,
            agc: false,
            sl: false,
          },
        }),
      });
      if (!res.ok) mal++;
    }
    setGuardando(false);
    if (mal > 0) {
      setAviso(`Quedaron ${mal} respuestas sin pasar. Miralo antes de seguir.`);
      return;
    }
    // Lo que se acaba de pasar se suma a lo que ya estaba, sin volver a
    // preguntarle al servidor: pasa a verse en la lista de arriba y la
    // numeración sigue de ahí.
    const cuantas = respuestas.length;
    const actualizadas = new Set(respuestas.map((r) => r.id).filter(Boolean));
    setEnLaFicha((f) => [
      ...f.filter((v) => !actualizadas.has(v.id)),
      ...respuestas.map((r) => ({
        id: r.id ?? `nueva-${r.n}`,
        n_respuesta: r.n,
        lamina,
        localizacion: r.localizacion,
        n_localizacion: numeroDe(r.areas),
        fq: r.fq,
        contenidos: r.contenidos,
        popular: r.popular,
        z: zDe(r).z?.valor ?? null,
        observacion: r.observacion || null,
        verbalizacion: r.verbalizacion,
        posicion: r.posicion,
      })),
    ]);
    setProximo((n) => n + cuantas);
    setRespuestas([]);

    const sigue = destino;
    if (sigue && (fase === 'entrevista' || CARGADAS.includes(sigue))) {
      // Esperar a que la imagen esté: si ya se bajó, esto no demora nada, y si
      // no, es preferible medio segundo en el botón que la lámina anterior con
      // los contornos de la nueva encima.
      await new Promise<void>((listo) => {
        const img = new window.Image();
        img.onload = () => listo();
        img.onerror = () => listo();
        img.src = archivoDe(sigue);
      });
      setLamina(sigue);
      setAviso(null);
      // La dirección se acomoda sin navegar: recargar tiene que abrir la
      // lámina en la que se estaba, y volver a pedirle la página al servidor
      // costaba medio segundo por cada cambio.
      window.history.replaceState(null, '', `?lamina=${sigue}`);
      window.scrollTo({ top: 0 });
      return;
    }
    setAviso(
      `Se pasaron ${cuantas} respuestas a la ficha de ${nombre}.` +
        (sigue
          ? ` La lámina ${sigue} todavía no está cargada en el sistema: se sigue codificando en la ficha.`
          : '')
    );
  }

  /**
   * Las diez láminas y los dos pasos, en una sola barra.
   *
   * Se dibuja en dos lugares según la instancia: entrevistando va adentro de la
   * tarjeta, debajo del campo y del mismo ancho, porque ahí es lo único que se
   * hace además de escribir; encuestando va al pie, que es donde estuvo siempre
   * y donde no le saca lugar a la tabla de codificación.
   */
  const barraDeLaminas = (
        <div className="os-ror-pie">
      <button
        type="button"
        className="os-boton os-boton-firme"
        disabled={guardando || !anterior}
        onClick={() => guardar(anterior)}
      >
        ← Lámina anterior
      </button>

      <div className="os-ror-laminas">
        {ORDEN.map((n) => (
          <button
            key={n}
            type="button"
            className={`os-boton os-boton-fila${n === lamina ? ' os-boton-firme' : ''}`}
            /* Tomando se llega a las diez: lo que le falta a la IV en
               adelante es su Tabla A y sus áreas, y para anotar lo que el
               candidato dice no hace falta ninguna de las dos. Recién
               ubicando importa, que es cuando se codifica. */
            disabled={guardando || (fase === 'encuesta' && !CARGADAS.includes(n))}
            onClick={() => guardar(n)}
            title={
              fase === 'entrevista' || CARGADAS.includes(n)
                ? `Lámina ${n}`
                : `La lámina ${n} todavía no está cargada`
            }
          >
            {n}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="os-boton os-boton-firme"
        disabled={guardando}
        onClick={() => guardar()}
      >
        {guardando ? 'Pasando…' : 'Próxima lámina →'}
      </button>
    </div>
  );

  /**
   * Una fila de la tabla de codificación.
   *
   * La misma para lo que se acaba de codificar y para lo que ya está en la
   * ficha: los dos son respuestas de esta lámina y se corrigen igual. Lo único
   * que cambia es a dónde va el cambio, que es lo que entra por `onCambio`.
   */
  function filaDeCodificacion(
    r: Respuesta,
    {
      onCambio,
      onBorrar,
    }: { onCambio: (campos: Partial<Respuesta>) => void; onBorrar: () => void }
  ) {
          const v = zDe(r);
          const tieneEspacio = r.areas.some(esEspacio);
          const tieneTinta = r.areas.some((a) => !esEspacio(a));
          return (
            <article
              key={`${r.id ?? 'nueva'}-${r.n}`}
              className={`os-ror-fila${r.extrapolada ? ' os-ror-extrapolada' : ''}`}
              style={{ order: r.n }}
            >
              <div className="os-ror-fila-datos">
                <span className="os-ror-n">{r.n}</span>
                <span className="os-ror-dijo">{r.dijo}</span>
                {/* Cada área con el color de su familia, como el resto de los
                    códigos de la tabla: el mismo dato en dos columnas no puede
                    ser una etiqueta de color en una y texto pelado en la otra. */}
                <span
                  className={`os-ror-areas${
                    r.areas.length >= 4
                      ? ' os-ror-areas-mini'
                      : r.areas.length === 3
                        ? ' os-ror-areas-chicas'
                        : ''
                  }`}
                >
                  {r.areas.map((a) => (
                    <span
                      key={a}
                      className="os-ror-etiqueta"
                      style={{ background: tonoDe(LOCALIZACION, `${familiaDe(a)}o`) }}
                    >
                      {a}
                    </span>
                  ))}
                </span>
                {/* El mismo selector que la tabla de codificación de la ficha,
                    con sus mismos colores: los códigos se reconocen por su
                    color y no puede ser uno acá y otro allá. Ofrece las
                    localizaciones compatibles con el área, y "Mostrar todas"
                    para el caso raro. */}
                <Codigo
                  valor={r.localizacion}
                  opciones={LOCALIZACION.filter((o) => localizacionesDe(r.areas[0]).includes(o.v))}
                  todas={LOCALIZACION}
                  onElegir={(v) => onCambio({ localizacion: v })}
                  etiqueta="Localización y DQ"
                  buscable={false}
                  // Sin elegir muestra la familia que ya sale del área ("D…"),
                  // no un guion: lo que falta es la calidad evolutiva, y un
                  // hueco vacío se lee como si faltara también la localización.
                  vacio={`${familiaDe(r.areas[0])}…`}
                />
                {/* La Tabla A propone la calidad formal, y se puede cambiar:
                    la misma respuesta dicha de dos maneras no siempre vale
                    igual, y esa lectura es de la evaluadora. Fuera de tabla la
                    tabla no propone nada y las opciones son las dos que puede
                    tener un área que no está en ella. */}
                <span className="os-ror-dato">
                  <Simple
                    valor={r.fq}
                    opciones={r.areas.includes(FUERA_DE_TABLA) ? FQ_FUERA_DE_TABLA : FQ}
                    onCambio={(v) => onCambio({ fq: v })}
                    etiqueta="Calidad formal"
                    buscable={false}
                  />
                </span>
                {/* Lo que propone el diccionario de palabras entra acá y
                    se corrige: una palabra suelta no dice el contenido, que
                    depende de a qué pertenece lo que la persona vio. */}
                <span className="os-ror-dato os-ror-contenidos">
                  <Multiple
                    valores={r.contenidos}
                    opciones={CONTENIDOS}
                    onCambio={(v) => onCambio({ contenidos: v })}
                    etiqueta="Contenidos"
                  />
                </span>
                <span className="os-ror-dato">{r.popular ? 'P' : ''}</span>
                <span className="os-ror-dato os-ror-z">
                  {v.z ? `${v.z.tipo} ${v.z.valor}` : '—'}
                </span>
                {/* Los dos botones de la fila, en una columna sola: abrir el
                    detalle y borrar. El borrado se confirma como en el resto
                    del OS, partiéndose en "Sí, borrar" y "No", porque no se
                    puede deshacer y esta columna está al lado de campos que se
                    tocan todo el tiempo. */}
                <span className="os-ror-acciones">
                  {/* Confirmando el borrado, los otros dos botones no van: la
                      pregunta necesita el ancho de la columna entera, y además
                      lo único que hay que contestar ahí es sí o no. */}
                  {aBorrar !== r.n && (
                    <>
                  {/* Un solo botón abre lo de abajo: los tildes del puntaje y la
                      observación se escriben ahí. */}
                  <button
                    type="button"
                    className={`os-ror-abrir${abiertas.includes(r.n) ? ' puesta' : ''}`}
                    onClick={() =>
                      setAbiertas((ns) =>
                        ns.includes(r.n) ? ns.filter((n) => n !== r.n) : [...ns, r.n]
                      )
                    }
                    title={
                      abiertas.includes(r.n)
                        ? 'Cerrar el detalle'
                        : v.aConfirmar.length > 0
                          ? 'Hay algo que confirmar del puntaje'
                          : r.observacion || 'Puntaje y observación'
                    }
                    aria-expanded={abiertas.includes(r.n)}
                    aria-label={`Detalle de la respuesta ${r.n}`}
                  >
                    ✎
                  </button>
                    </>
                  )}
                  {aBorrar === r.n ? (
                    <>
                      <button
                        type="button"
                        className="os-boton os-boton-fila os-boton-peligro"
                        onClick={() => {
                          setABorrar(null);
                          onBorrar();
                        }}
                      >
                        Sí, borrar
                      </button>
                      <button
                        type="button"
                        className="os-boton os-boton-fila"
                        onClick={() => setABorrar(null)}
                      >
                        No
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="os-ror-borrar"
                      onClick={() => setABorrar(r.n)}
                      title={`Borrar la respuesta ${r.n}`}
                      aria-label={`Borrar la respuesta ${r.n}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              </div>

              {/* El detalle, en dos columnas parejas: a la izquierda de dónde
                  sale el puntaje Z, a la derecha lo que quiera anotar quien
                  codifica. Antes era una sola fila que envolvía, y el campo de
                  la nota partía los tildes al medio. */}
              <div className="os-ror-detalle" hidden={!abiertas.includes(r.n)}>
                <div className="os-ror-detalle-lado">
                  <span className="os-dato-rotulo">Puntaje Z</span>
                  <label
                    className={`os-ror-tilde${r.areas.length < 2 ? ' apagado' : ''}`}
                    title={
                      r.areas.length < 2
                        ? 'La respuesta está en una sola locación: no hay áreas que integrar'
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={r.integradas}
                      disabled={r.areas.length < 2}
                      onChange={(e) => onCambio({ integradas: e.target.checked })}
                    />
                    Integra las áreas con una relación significativa
                  </label>
                  <label
                    className={`os-ror-tilde${
                      !tieneEspacio && !(r.localizacion?.includes('S') ?? false) ? ' apagado' : ''
                    }`}
                    title={
                      !tieneEspacio && !(r.localizacion?.includes('S') ?? false)
                        ? 'La respuesta no cae en ningún blanco'
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={r.blancoIntegrado}
                      disabled={
                        (!tieneEspacio && !(r.localizacion?.includes('S') ?? false)) ||
                        (!tieneTinta && !r.localizacion?.match(/^(W|D)S/))
                      }
                      onChange={(e) => onCambio({ blancoIntegrado: e.target.checked })}
                    />
                    El blanco se integra con la mancha
                  </label>
                  {/* Los tres renglones del porqué van siempre, aunque estén
                      vacíos: cada cosa del detalle tiene que caer en el mismo
                      lugar en todas las respuestas, o abrir dos filas seguidas
                      se lee como dos pantallas distintas. */}
                  <span className="os-ror-porque">
                    {v.z ? `${v.z.tipo}: ${v.z.porque}` : 'Sin puntaje Z'}
                  </span>
                  <span className="os-ror-porque os-ror-descartado">
                    {v.otros
                      .map((o) => `${o.tipo} ${o.valor} también daba, gana el más alto`)
                      .join(' · ')}
                  </span>
                </div>
                {/* Los avisos van del lado derecho, a la altura de los tildes
                    que preguntan: lo que hay que confirmar está al lado de
                    dónde se confirma. */}
                <div className="os-ror-detalle-lado">
                  <span className="os-dato-rotulo">
                    {v.aConfirmar.length > 0 ? 'A confirmar' : ''}
                  </span>
                  <div className="os-ror-dudas">
                    {v.aConfirmar.map((a, i) => (
                      <span key={i} className="os-ror-duda">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
                {/* La observación cruza las dos columnas: a lo ancho entra en
                    dos renglones lo que en media fila pedía cinco. */}
                <div className="os-ror-detalle-nota">
                  <span className="os-dato-rotulo">Observación</span>
                  <textarea
                    className="os-campo os-ror-observacion"
                    value={r.observacion}
                    onChange={(e) => onCambio({ observacion: e.target.value })}
                    placeholder="Lo que convenga dejar anotado de esta respuesta"
                    rows={2}
                  />
                </div>
              </div>
            </article>
          );
  }

  return (
    <div className="os-ror">
      <div className="os-encabezado">
        <h1>Rorschach · Lámina {lamina}</h1>
      </div>


      {/* ------------------------------------------------------------ el mapa */}
      <section className="os-panel os-ror-mapa">
        <div className="os-ror-capas">
          <span className="os-ror-puestas">
            {puestas.length > 0 ? `Marcadas: ${puestas.join(' + ')}` : ''}
          </span>
        </div>

        {/* El interruptor de instancia manda sobre todo lo que hay debajo, así
            que va arriba de todo y no adentro de la tarjeta de una de las dos.
            En la fila de la miniatura, que es lo primero que se mira. */}
        <div className="os-ror-cabecera" hidden={Boolean(pendiente)}>
          {/* La dirección de las láminas, para pasársela al candidato: en la
              encuesta él señala dónde lo vio, y para señalar necesita la lámina
              en su propia pantalla, con su cursor. Entrevistando no va: ahí
              alcanza con que la vea por la pantalla compartida. */}
          {fase === 'encuesta' && (
            <LinkLaminas
              href={`/os/laminas/rorschach?de=${evaluacionId}`}
              clase="os-boton os-boton-fila"
            />
          )}
          {/* Entrevistando, la lámina va en miniatura y no grande. Quien la
              mira es la persona, en su pantalla; de este lado alcanza con
              corroborar que está viendo la que corresponde, y grande le sacaba
              el lugar a lo que la evaluadora sí necesita a la vista: lo que ya
              dijo y el campo donde escribir. Al lado dice si esa pantalla
              contesta, que hasta ahora no se sabía desde acá. */}
          {fase === 'entrevista' && (
            <div className="os-ror-espejo">
              <div className="os-ror-miniatura">
                <img
                  src={archivoDe(lamina)}
                  alt={`Lámina ${lamina}`}
                  style={estiloDelGiro(posicion)}
                />
              </div>
              <div className="os-ror-espejo-datos">
              <span className="os-ror-espejo-botones">
              {fase === 'entrevista' && (
                <button
                  type="button"
                  className="os-boton os-boton-fila"
                  onClick={() =>
                    window.open(
                      `/os/laminas/rorschach?de=${evaluacionId}`,
                      `laminas-${evaluacionId}`
                    )
                  }
                  title="Compartí esa pestaña en la videollamada, no la pantalla entera"
                >
                  Abrir las láminas
                </button>
              )}
                {/* Cómo sostuvo la lámina, en un botón que la va girando un
                    cuarto por vez. Debajo de la pantalla del candidato porque
                    es lo que gira: la miniatura de al lado gira con él, así que
                    qué quedó puesto se ve sin leer ningún signo. Va por
                    respuesta y no por lámina: puede darla derecha y girarla
                    para la que sigue. */}
                <button
                  type="button"
                  className={`os-ror-girar${posicion !== '^' ? ' puesta' : ''}`}
                  onClick={() => setPosicion((p) => siguienteGiro(p))}
                  title={NOMBRE_POSICION[posicion]}
                  aria-label={`Cómo sostiene la lámina: ${NOMBRE_POSICION[posicion]}`}
                >
                  {/* Un arco de tres cuartos y una punta maciza apoyada en su
                      extremo. La anterior eran dos trazos abiertos que a este
                      tamaño no cerraban en una flecha. */}
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M12 6 A6 6 0 1 1 6.9 8.9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                    />
                    <path d="M12 2.4 L12 9.6 L7.8 6 Z" fill="currentColor" />
                  </svg>
                  Rotar lámina
                  {posicion !== '^' && <span className="os-ror-girar-signo">{posicion}</span>}
                </button>
              </span>
              <p
                className={`os-ror-espejo-estado${
                  laPantallaEsta ? (veLaMisma ? ' bien' : ' distinta') : ' sin'
                }`}
              >
                {!laPantallaEsta && 'La pantalla del candidato no está abierta'}
                {laPantallaEsta && veLaMisma && `El candidato está viendo la lámina ${lamina}`}
                {laPantallaEsta &&
                  !veLaMisma &&
                  `El candidato está viendo la lámina ${ORDEN[(ve?.lamina ?? 1) - 1]}`}
              </p>
              {/* La pantalla que ve la persona, en una pestaña aparte. Se abre
                  desde acá porque lo que hay que compartir en la videollamada es
                  esa pestaña y no la pantalla: así ella ve la mancha y no lo que
                  se escribe, y las dos pasan de lámina juntas. */}
              </div>
            </div>
          )}
              <div className="os-ror-instancia">
                {/* Las dos instancias como pestañas: son dos momentos de la
                    misma pantalla, y la que está puesta se marca con la línea
                    debajo del nombre, como cualquier pestaña. */}
                <span className="os-dato-rotulo os-ror-tabs-rotulo">Instancia</span>
                <div className="os-ror-tabs" role="tablist" aria-label="Instancia">
                  <button
                    type="button"
                    role="tab"
                    className={`os-ror-tab${fase === 'entrevista' ? ' puesta' : ''}`}
                    aria-selected={fase === 'entrevista'}
                    onClick={() => {
                      setFase('entrevista');
                      setUbicando(null);
                      setPuestas([]);
                      setDijo('');
                    }}
                  >
                    <span className="os-ror-tab-paso">1</span>
                    Entrevista
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`os-ror-tab${fase === 'encuesta' ? ' puesta' : ''}`}
                    aria-selected={fase === 'encuesta'}
                    onClick={() => {
                      setFase('encuesta');
                      setTomando('');
                    }}
                  >
                    <span className="os-ror-tab-paso">2</span>
                    Encuesta
                  </button>
                </div>
              </div>
              {/* La pantalla del candidato, en una pestaña aparte. Se abre desde
                  acá y no se busca a mano porque lo que hay que compartir en la
                  videollamada es esa pestaña y no la pantalla: así él ve la
                  mancha y no lo que ella escribe, y las dos pasan de lámina
                  juntas. */}
        </div>

        <div className={`os-ror-mapas${fase === 'entrevista' ? ' os-ror-mapas-tomando' : ''}`}>
          {fase === 'encuesta' &&
            (MAPAS[lamina] ?? []).map((grupo, g) => (
            // La clave lleva la lámina: sin eso React reusa el mismo <img> y
            // solo le cambia la dirección, y el navegador sigue pintando la
            // mancha anterior hasta que termina de bajar la nueva. Los
            // contornos, que son SVG, cambian en el acto. Se veía la mancha de
            // una lámina con las áreas de otra, y quedaba así para siempre si
            // la imagen no llegaba a bajar. Con la clave el recuadro se monta
            // de nuevo y en el peor caso queda vacío, que es lo que
            // corresponde: una mancha con las áreas de otra lámina se codifica
            // mal sin que nadie lo note.
            <div
              key={`${lamina}-${g}`}
              className="os-ror-lienzo"
              style={estiloDelGiro(posicionDeLaQueUbico)}
            >
              <img src={archivoDe(lamina)} alt={`Lámina ${lamina}`} />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                {grupo.map((a) =>
                  (AREAS[lamina]?.[a] ?? []).map((parte, i) => (
                    <path
                      key={`${a}-${i}`}
                      d={camino(parte)}
                      className={
                        'os-ror-area' +
                        (puestas.includes(a) ? ' os-ror-area-puesta' : '') +
                        (encima === a ? ' os-ror-area-encima' : '')
                      }
                      onMouseEnter={() => setEncima(a)}
                      onMouseLeave={() => setEncima(null)}
                      onClick={() => alternar(a)}
                    />
                  ))
                )}
                {/* La línea que va del área hasta su nombre, como en el
                    cuadernillo: dice cuál nombra a cuál cuando dos quedan
                    cerca. */}
                {grupo.map((a) => {
                  const c = puesto(lamina, a, AREAS[lamina]?.[a] ?? []);
                  // Sin distancia entre el borde y el nombre no hay línea que
                  // dibujar: el nombre está adentro del área.
                  if (Math.abs(c.y - c.ay) + Math.abs(c.x - c.ax) < 0.01) return null;
                  return (
                    <line
                      key={`guia-${a}`}
                      className={`os-ror-guia${encima === a ? ' os-ror-guia-encima' : ''}`}
                      x1={c.ax * 100}
                      y1={c.ay * 100}
                      x2={c.x * 100}
                      y2={c.y * 100}
                    />
                  );
                })}
              </svg>
              {grupo.map((a) => {
                const c = puesto(lamina, a, AREAS[lamina]?.[a] ?? []);
                return (
                  <button
                    key={a}
                    type="button"
                    className={
                      'os-ror-rotulo' +
                      (a === FUERA_DE_TABLA ? ' os-ror-rotulo-fuera' : '') +
                      (puestas.includes(a) ? ' os-ror-rotulo-puesto' : '') +
                      (encima === a ? ' os-ror-rotulo-encima' : '')
                    }
                    title={
                      a === FUERA_DE_TABLA
                        ? 'El recorte que señaló no es ninguna de las locaciones del libro'
                        : undefined
                    }
                    style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                    onMouseEnter={() => setEncima(a)}
                    onMouseLeave={() => setEncima(null)}
                    onClick={() => alternar(a)}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          ))}

          {/* La respuesta de la persona va en el hueco que dejan los siete mapas,
              no en un panel de abajo: se escribe mientras ella habla y señala,
              con la lámina delante. Nueve celdas en tres filas, siete de mapa y
              esta de dos. */}
          <div
            /* Mientras no haya nada que elegir, la celda mide lo que un mapa y la
               fila termina en la línea de la última lámina. Con la lista de la
               Tabla A abierta crece: con el alto de un mapa a la lista le
               quedaban 26px y no se podía buscar en ella. */
            className={`os-ror-campos${
              fase === 'encuesta' && !partiendo && !pendiente && opciones.length === 0
                ? ' os-ror-campos-justo'
                : ''
            }`}
          >
            {fase === 'entrevista' && !pendiente && (
              <Toma
                lamina={lamina}
                numero={numeroEnLaLamina}
                texto={tomando}
                onTexto={setTomando}
                onGuardar={anotar}
                guardando={anotando}
                llena={laminaLlena}
                tomadas={dichasDeLaLamina}
                onCorregir={corregir}
                onBorrar={borrarTomada}
                borrando={borrando}
                onBorrando={setBorrando}
              />
            )}

            {/* Entrevistando, la barra de láminas va acá: pasar de lámina es lo
                único que se hace además de escribir, y al pie de la pantalla
                quedaba lejos del campo y de otro ancho que la tarjeta. */}
            {/* Entrevistando, las diez con las dos flechas a los costados: la
                barra de abajo lleva los dos botones anchos ("← Lámina anterior",
                "Próxima lámina →") y adentro de la tarjeta no entraba, se salía
                por los dos lados. Acá alcanza con las flechas. */}
            {fase === 'entrevista' && (
              <div className="os-ror-pasador">
                {/* Las dos flechas juntas y después los números: pasar a la que
                    sigue y volver a la anterior son lo que se hace en cada
                    lámina, y el número suelto es para volver a una lejana. Con
                    una flecha en cada punta había que cruzar los diez números
                    para corregir un paso de más. */}
                <button
                  type="button"
                  className="os-boton os-boton-fila os-ror-paso"
                  disabled={guardando || !anterior}
                  onClick={() => guardar(anterior)}
                  aria-label="Lámina anterior"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="os-boton os-boton-fila os-ror-paso"
                  disabled={guardando || numeroDeLamina >= ORDEN.length}
                  onClick={() => guardar()}
                  aria-label="Lámina siguiente"
                >
                  →
                </button>
                {ORDEN.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`os-boton os-boton-fila os-ror-romano${
                      n === lamina ? ' os-boton-firme' : ''
                    }`}
                    disabled={guardando}
                    onClick={() => guardar(n)}
                    title={`Lámina ${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            {fase === 'entrevista' && aviso && <p className="os-form-ok">{aviso}</p>}

            {/* Una sola respuesta a la vez, la que se está codificando. Las
                demás distraen: se codifica de a una y hasta terminar esta no se
                pasa a la que sigue. Cuántas faltan se dice al costado. */}
            {fase === 'encuesta' && sinUbicar.length > 0 && !pendiente && (
              <div className="os-ror-tomadas">
                {/* En qué lámina y cuál de sus respuestas: el número es el de
                    la lámina, como en la entrevista, y el total dice cuántas
                    dio ahí. La cuenta del protocolo va en la ficha. */}
                <div className="os-ror-tomadas-alto">
                  <span className="os-ror-tomadas-cual">
                    <span className="os-dato-rotulo">Lámina {lamina} · Respuesta</span>
                    {/* Las respuestas de la lámina, en pestañas como las de
                        instancia: se codifica la que está puesta y se puede
                        volver a una que quedó esperando, que hasta acá no tenía
                        cómo. Las ya codificadas quedan apagadas: esas se
                        corrigen en la tabla de abajo. */}
                    <span className="os-ror-tabs os-ror-tabs-chicas" role="tablist" aria-label="Respuesta de la lámina">
                      {dichasDeLaLamina.map((d) => {
                        const pendiente = sinUbicar.some((r) => r.id === d.id);
                        return (
                          <button
                            key={`${d.id ?? 'nueva'}-${d.n}`}
                            type="button"
                            role="tab"
                            className={`os-ror-tab${d.id === enCurso?.id ? ' puesta' : ''}`}
                            aria-selected={d.id === enCurso?.id}
                            disabled={!pendiente || partiendo}
                            title={
                              pendiente
                                ? `Codificar «${d.texto}»`
                                : `«${d.texto}» ya está codificada`
                            }
                            onClick={() => {
                              const suya = sinUbicar.find((r) => r.id === d.id);
                              if (!suya) return;
                              setUbicando(suya.id);
                              setDijo(suya.verbalizacion ?? '');
                              setPuestas([]);
                            }}
                          >
                            {d.n}
                          </button>
                        );
                      })}
                    </span>
                  </span>
                  {/* Separar va en el renglón de arriba y a la derecha: es lo
                      que se decide antes de empezar a marcar, y abajo de la
                      frase cortaba la lectura entre lo que dijo y dónde lo vio.
                      Deshacerlo va en el mismo lugar: es el mismo interruptor,
                      y al pie quedaba lejos de donde se apretó. */}
                  {/* Con objetos ya cargados el botón también tiene que estar:
                      sin eso, volver atrás desde la confirmación dejaba los
                      objetos guardados y sin forma de seguir cargándolos. */}
                  {enCurso && !partiendo && (
                    <button
                      type="button"
                      className="os-boton os-boton-fila os-ror-partir"
                      onClick={() => {
                        setPartiendo(true);
                        setDijo('');
                        setPuestas([]);
                      }}
                    >
                      Separar los objetos
                    </button>
                  )}
                  {enCurso && partiendo && (
                    <button
                      type="button"
                      className="os-boton os-boton-fila os-ror-partir"
                      onClick={() => {
                        setPartiendo(false);
                        setTrozos([]);
                        setDijo(enCurso?.verbalizacion ?? '');
                        setPuestas([]);
                      }}
                    >
                      Volver sin separar
                    </button>
                  )}
                </div>
                {/* Lo que dijo, sin recuadro: es el texto que hay que leer para
                    codificar, no un elemento más de la lista. */}
                {enCurso && (
                  <p className="os-ror-dijo-grande">
                    {enCurso.verbalizacion}
                    {enCurso.posicion && enCurso.posicion !== '^' && (
                      <span
                        className="os-ror-tomada-giro"
                        title={NOMBRE_POSICION[enCurso.posicion]}
                      >
                        {enCurso.posicion}
                      </span>
                    )}
                  </p>
                )}

                {/* Una respuesta larga no está en la Tabla A, y sus palabras sí:
                    "un mono tomando birra en la copa de un árbol" se parte en
                    mono, birra y árbol, cada una en su locación y con su
                    calidad. La respuesta se cierra con las áreas de todas y con
                    la peor de las calidades. */}

                {partiendo && (
                  <div className="os-ror-trozos">
                    {trozos.map((t, i) => (
                      <div key={`${t.texto}-${i}`} className="os-ror-trozo">
                        <span className="os-ror-trozo-n">Objeto {i + 1}</span>
                        <span className="os-ror-trozo-texto">{t.texto}</span>
                        <span className="os-ror-trozo-area">{t.areas.join(' + ')}</span>
                        <span
                          className="os-ror-fq"
                          style={{ background: t.fq ? tonoDe(FQ, t.fq) : undefined }}
                        >
                          {t.fq ?? '—'}
                        </span>
                        <button
                          type="button"
                          className="os-ror-dichas-x"
                          onClick={() => setTrozos((v) => v.filter((_, j) => j !== i))}
                          aria-label={`Sacar ${t.texto}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {/* El que se está cargando, con su número y en qué paso va:
                        una instrucción escrita no dice cuántos van ni cuál
                        falta. */}
                    {/* El renglón del objeto en curso es el campo donde se
                        escribe: con el texto de ayuda adentro parecía un campo
                        y no lo era, y el de verdad estaba más abajo. */}
                    <div className="os-ror-trozo os-ror-trozo-enCurso">
                      <span className="os-ror-trozo-n">Objeto {trozos.length + 1}</span>
                      <input
                        className="os-campo os-ror-trozo-campo"
                        value={dijo}
                        onChange={(e) => setDijo(e.target.value)}
                        placeholder={
                          puestas.length === 0
                            ? 'Marcá en la mancha dónde lo vio, o escribí qué es'
                            : 'Qué vio en esa parte'
                        }
                        aria-label={`Objeto ${trozos.length + 1}`}
                      />
                      <span className="os-ror-trozo-area">
                        {puestas.length > 0 ? puestas.join(' + ') : '—'}
                      </span>
                    </div>
                    {trozos.length > 0 && (
                      <p className="os-ror-vacio">
                        La respuesta va a quedar en{' '}
                        {[...new Set(trozos.flatMap((t) => t.areas))].join(' + ')}, con la calidad{' '}
                        {peorFq(trozos.map((t) => t.fq)) ?? 'a mano'}.
                      </p>
                    )}
                    <div className="os-ror-trozos-pie">
                      {/* Cargar el objeto fuera de tabla va acá y no al pie de
                          la pantalla: es lo que se hace con el objeto que se
                          está cargando, antes de decidir sobre la respuesta
                          entera. */}
                      {/* Un objeto necesita su locación: sin área marcada el
                          botón no hacía nada y no decía qué faltaba. */}
                      {(puestas.length > 0 || dijo.trim()) && (
                        <button
                          type="button"
                          className="os-boton os-boton-fila os-ror-trozos-fuera"
                          disabled={puestas.length === 0}
                          title={
                            puestas.length === 0
                              ? 'Marcá primero en la mancha dónde vio este objeto'
                              : undefined
                          }
                          onClick={() => sumarTrozo(null)}
                        >
                          {puestas.length === 0
                            ? 'Marcá dónde lo vio para cargarlo'
                            : `No está en la tabla: cargarlo igual en ${puestas.join(' + ')}`}
                        </button>
                      )}
                      <button
                        type="button"
                        className="os-boton os-boton-firme"
                        disabled={trozos.length === 0}
                        onClick={() => {
                          setPartiendo(false);
                          setPendiente({ h: null, partida: true });
                        }}
                      >
                        Terminar la respuesta {enCurso?.n_respuesta}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Separando objetos este bloque sobra: el renglón del objeto de
                arriba ya tiene su rótulo y su campo, y acá quedaban repetidos y
                vacíos. */}
            <div
              className="os-ror-campo"
              hidden={Boolean(pendiente) || fase === 'entrevista' || partiendo}
            >
              <div className="os-ror-campo-alto">
                <span className="os-dato-rotulo">
                  {partiendo
                    ? `Objeto ${trozos.length + 1}${
                        puestas.length > 0 ? ` · se busca en ${puestas.join(' + ')}` : ''
                      }`
                    : `${ubicando ? 'Dónde lo vio' : 'Respuesta'}${
                        puestas.length > 0 ? ` · se busca en ${puestas.join(' + ')}` : ''
                      }`}
                </span>
                {/* Soltar el área va acá, al lado de lo que dice cuál está
                    marcada, y no arriba de los mapas: es lo que se corrige
                    cuando el rótulo dice un área que no era. */}
                {puestas.length > 0 && (
                  <button
                    type="button"
                    className="os-boton os-boton-fila"
                    onClick={() => setPuestas([])}
                  >
                    Liberar locación
                  </button>
                )}
              </div>
              {/* Separando objetos, lo que se escribe va en el renglón del
                  objeto y este campo sobra: son el mismo texto en dos lugares. */}
              {!partiendo && (
                <input
                  className="os-campo"
                  value={dijo}
                  onChange={(e) => setDijo(e.target.value)}
                  placeholder="Sus palabras, textuales"
                  aria-label="Respuesta"
                />
              )}
            </div>

            {pendiente && (
              <div className="os-ror-dq">
                <p className="os-ror-dq-que">
                  {pendiente.partida
                    ? trozos.map((t) => t.texto).join(' · ')
                    : pendiente.h?.respuesta ?? dijo.trim()}
                  <span className="os-ror-dq-area">{areasPendientes.join(' + ')}</span>
                </p>
                {/* Los dos tildes del puntaje Z van antes de cerrar y no en la
                    fila de la tabla: son de esta respuesta y los sabe quien la
                    acaba de escuchar. Están siempre, para que el paso tenga la
                    misma forma en todas las respuestas, y el que no puede
                    cambiar nada queda apagado diciendo por qué. Se pueden dejar
                    sin tocar; lo que cierra la respuesta es la calidad
                    evolutiva de abajo. */}
                <div className="os-ror-dq-medio">
                <div className="os-ror-dq-tildes">
                  <label
                    className={`os-ror-tilde${areasPendientes.length < 2 ? ' apagado' : ''}`}
                    title={
                      areasPendientes.length < 2
                        ? 'La respuesta está en una sola locación: no hay áreas que integrar'
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={pendiente.integradas ?? false}
                      disabled={areasPendientes.length < 2}
                      onChange={(e) =>
                        setPendiente((p) => (p ? { ...p, integradas: e.target.checked } : p))
                      }
                    />
                    Integra las áreas con una relación significativa
                  </label>
                  <label
                    className={`os-ror-tilde${
                      !areasPendientes.some(esEspacio) ||
                      !areasPendientes.some((a) => !esEspacio(a))
                        ? ' apagado'
                        : ''
                    }`}
                    title={
                      !areasPendientes.some(esEspacio)
                        ? 'La respuesta no cae en ningún blanco'
                        : !areasPendientes.some((a) => !esEspacio(a))
                          ? 'La respuesta está solo en el blanco: no hay tinta con la que integrarlo'
                          : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      checked={pendiente.blancoIntegrado ?? false}
                      disabled={
                        !areasPendientes.some(esEspacio) ||
                        !areasPendientes.some((a) => !esEspacio(a))
                      }
                      onChange={(e) =>
                        setPendiente((p) => (p ? { ...p, blancoIntegrado: e.target.checked } : p))
                      }
                    />
                    El blanco se integra con la mancha
                  </label>
                </div>
                </div>
                {/* Las calidades y las dos salidas, abajo de la tarjeta: lo que
                    hay arriba es lo que se lee para decidir, y esto es la
                    decisión. Las dos salidas van una sobre otra a la derecha,
                    para que no se lean como una quinta calidad. */}
                <div className="os-ror-dq-cierre">
                <div className="os-ror-dq-fila">
                  {localizacionesDe(
                    (pendiente.partida ? trozos[0]?.areas[0] : undefined) ??
                      puestas[0] ??
                      pendiente.h?.area ??
                      'W'
                  )
                    .filter((l) => soloDq(l))
                    .map((l) => (
                      <button
                        key={l}
                        type="button"
                        className="os-ror-dq-opcion"
                        style={{ background: tonoDe(LOCALIZACION, l) }}
                        onClick={() =>
                          pendiente.partida ? cerrarPartida(l) : tomar(pendiente.h, l)
                        }
                        title={l}
                      >
                        {soloDq(l)}
                      </button>
                    ))}
                </div>
                {/* Las dos salidas, una sobre otra: no son una quinta calidad,
                    así que van aparte de las cuatro. */}
                <div className="os-ror-dq-pie">
                  <button
                    type="button"
                    className="os-boton os-boton-fila"
                    onClick={() => (pendiente.partida ? cerrarPartida(null) : tomar(pendiente.h, null))}
                  >
                    No decidir calidad
                  </button>
                  <button
                    type="button"
                    className="os-boton os-boton-fila"
                    onClick={() => {
                      if (pendiente.partida) setPartiendo(true);
                      setPendiente(null);
                    }}
                  >
                    {pendiente.partida ? 'Volver a objetos' : 'Volver'}
                  </button>
                </div>
                </div>
              </div>
            )}

            {/* La lista de la Tabla A va abajo del campo y no en un panel
                aparte: se escribe y se elige sin mover la vista, con los siete
                mapas al lado. Con una respuesta esperando su calidad no se
                muestra: la palabra ya está elegida y lo único que queda es el
                DQ. */}
            <div
              className={`os-ror-opciones${
                opciones.length === 0 ? ' os-ror-opciones-sola' : ''
              }`}
              /* Separando, sin nada que elegir esta caja queda vacía y sigue
                 ocupando su aire entre los renglones de la card. */
              hidden={
                Boolean(pendiente) || fase === 'entrevista' || (partiendo && opciones.length === 0)
              }
            >
              {/* El aviso va fuera de las columnas: adentro se parte en dos
                  renglones al ancho de una columna. */}
              {/* La lámina sin sus áreas trazadas no tiene dónde marcar, y el
                  renglón de abajo pedía apretar una locación que no existe: se
                  leía como que la pantalla falla. */}
              {!CARGADAS.includes(lamina) && (
                <p className="os-ror-vacio">
                  La lámina {lamina} todavía no tiene sus áreas cargadas en el sistema, así que acá
                  no hay dónde marcar. Lo que se tomó en la entrevista está guardado, y la
                  locación de estas respuestas se completa a mano en la ficha.
                </p>
              )}
              {/* Separando, el renglón del objeto ya dice qué hacer con su
                  texto de ayuda adentro: acá abajo era el mismo aviso repetido. */}
              {CARGADAS.includes(lamina) && opciones.length === 0 && !partiendo && (
                <p className="os-ror-vacio">
                  {puestas.length === 0
                    ? 'Apretá la locación donde lo vio, o escribí lo que dijo. Podés marcar más de una cuando la respuesta las integre.'
                    : dijo.trim()
                      ? `«${dijo.trim()}» no figura en ${puestas.join(' + ')}: se carga igual, con la calidad a mano.`
                      : 'Esas locaciones no tienen entradas para la lámina derecha.'}
                </p>
              )}
              <div className="os-ror-opciones-columnas">
              {opciones.map((h, i) => (
                <button
                  key={`${h.area}-${h.respuesta}-${i}`}
                  type="button"
                  className="os-ror-opcion"
                  onClick={() => (partiendo ? sumarTrozo(h) : setPendiente({ h }))}
                >
                  <span
                    className="os-ror-fq"
                    style={{ background: tonoDe(FQ, fqDeLaFicha(h.calidad)) }}
                  >
                    {h.calidad}
                  </span>
                  <span className="os-ror-opcion-texto">{h.respuesta}</span>
                  <span className="os-ror-opcion-area">{h.area}</span>
                </button>
              ))}
              </div>
            </div>

            {/* Lo mismo para la respuesta entera: sin locación no hay dónde
                cargarla, y el botón se quedaba quieto sin decir por qué. */}
            {!pendiente && fase === 'encuesta' && !partiendo && (puestas.length > 0 || dijo.trim()) && (
              <button
                type="button"
                className="os-boton"
                disabled={puestas.length === 0}
                title={
                  puestas.length === 0
                    ? 'Marcá primero en la mancha dónde lo vio'
                    : undefined
                }
                onClick={() => setPendiente({ h: null })}
              >
                {puestas.length === 0
                  ? 'Marcá dónde lo vio para cargarla'
                  : `No está en la tabla: cargar igual en ${puestas.join(' + ')}`}
              </button>
            )}
          </div>
        </div>

      </section>

      {/* -------------------------------------------------------- lo capturado */}
      {/* Entrevistando no hay nada que mostrar acá: la codificación está toda
          vacía y la barra de láminas se dibuja arriba, adentro de la tarjeta. */}
      <section className="os-panel os-ror-capturadas" hidden={fase === 'entrevista'}>
        {/* El protocolo se toma en orden, y aun así hay que poder volver: una
            respuesta que la persona agrega al final es de la lámina que ya
            pasó. Por eso las diez están en el pie, con la actual marcada, y no
            solo el botón de seguir. Las que todavía no tienen su mapa quedan
            apagadas. Se puede pasar sin haber capturado nada: no todas las
            láminas dan respuestas. */}
        {fase === 'encuesta' && barraDeLaminas}
        {fase === 'encuesta' && aviso && <p className="os-form-ok">{aviso}</p>}

        {/* Los rótulos son los de la tabla de codificación de la ficha, con su
            mismo nombre: el área marcada en el mapa es el número de localización
            de allá, y llamarla "áreas" acá obligaba a traducir al pasar de una
            pantalla a la otra. */}
        {fase === 'encuesta' && (respuestas.length > 0 || suyas.length > 0) && (
          <div className="os-ror-fila-datos os-ror-titulos">
            <span>N° rta</span>
            <span>Respuesta</span>
            <span>N° loc.</span>
            <span>Loc. + DQ</span>
            <span>FQ</span>
            <span>Contenidos</span>
            <span>P</span>
            <span>Pje Z</span>
            {/* La última columna lleva los tres botones de la fila: abrir lo
                de abajo, la nota y el borrado. */}
            <span>Acciones</span>
          </div>
        )}

        {/* Las que ya están en la ficha van con los mismos controles que las
            recién codificadas: se corrigen acá, sin ir a la otra pantalla. La
            que se acaba de codificar no entra en esta lista, que si no aparecía
            dos veces. */}
        {fase === 'encuesta' &&
          enLaFichaSinCodificar.map((r) => (
            <article
              key={`tomada-${r.id}`}
              className="os-ror-fila os-ror-fila-tomada"
              style={{ order: r.n_respuesta ?? 0 }}
            >
              <div className="os-ror-fila-datos">
                <span className="os-ror-n">{r.n_respuesta ?? '—'}</span>
                <span className="os-ror-dijo">{r.verbalizacion ?? 'En la ficha'}</span>
                <span>—</span>
                <span>—</span>
                <span>—</span>
                <span>—</span>
                <span />
                <span>—</span>
                <span />
              </div>
            </article>
          ))}

        {fase === 'encuesta' &&
          deLaFicha.map((r) =>
            filaDeCodificacion(r, {
              onCambio: (campos) => cambiarEnLaFicha(r.id ?? '', campos),
              onBorrar: () => borrarTomada(r.id ?? '', r.n),
            })
          )}

        {fase === 'encuesta' &&
          respuestas.map((r) =>
            filaDeCodificacion(r, {
              onCambio: (campos) => cambiar(r.n, campos),
              onBorrar: () => borrar(r.n),
            })
          )}

        {fase === 'encuesta' && respuestas.some((r) => !r.localizacion) && (
          <ul className="os-ror-criterios">
            {CRITERIO_DQ.map(([simbolo, criterio]) => (
              <li key={simbolo}>
                <span className="os-ror-simbolo">{simbolo}</span> {criterio}
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
