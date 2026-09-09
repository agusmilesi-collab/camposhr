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

import { useMemo, useState } from 'react';
import { AREAS, type Parte } from '@/lib/rorschach-areas';
import { buscar, entradasDe, esPopular, familiaDe, plano, type Hallazgo } from '@/lib/rorschach-tabla-a';
import { contenidoSugerido, fqDeLaFicha, localizacionesDe } from '@/lib/rorschach-sugerencias';
import { CONTENIDOS, FQ, LOCALIZACION, tonoDe } from '@/lib/rorschach';
import Codigo from '@/app/os/psicotecnicos/ficha/[id]/Codigo';
import { esEspacio, puntajeZ } from '@/lib/rorschach-z';

const LAMINA = 'I';

/**
 * Cuál sigue, y hasta dónde llega el sistema.
 *
 * El protocolo se toma en orden y no se vuelve, así que el botón del pie hace
 * las dos cosas de una: pasa lo capturado a la ficha y abre la lámina que
 * sigue. Hoy solo está cargada la I (su Tabla A transcripta y sus áreas
 * dibujadas), así que la II todavía no tiene a dónde llevar: lo capturado se
 * pasa igual y el aviso dice por qué la pantalla se queda donde está.
 */
const ORDEN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const CARGADAS = ['I'];

function siguienteDe(lamina: string): string | null {
  const i = ORDEN.indexOf(lamina);
  return i >= 0 && i + 1 < ORDEN.length ? ORDEN[i + 1] : null;
}

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

const MAPAS: string[][] = [
  // Dd99 va en el mapa de W, en una esquina libre de tinta: no es un área de la
  // lámina, es el recorte que no figura en el libro, así que no tiene contorno
  // que dibujar ni línea que lo una a nada.
  ['W', FUERA_DE_TABLA],
  ['D1', 'Dd24'],
  ['D2', 'D3', 'Dd22', 'Dd28'],
  ['D4', 'Dd23', 'Dd25'],
  ['D7', 'Dd21', 'Dd33', 'Dd34', 'Dd35'],
  ['Dd27', 'DdS29', 'DdS30'],
  ['Dd31', 'DdS26', 'DdS32'],
];

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
const TAGS: Record<string, [number, number]> = {
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
function puesto(nombre: string, partes: Parte[]): Puesto {
  const marcado = TAGS[nombre];
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

type Respuesta = {
  n: number;
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
};

/** '4' para D4, '26' para DdS26, '4+7' cuando integra dos. W va sin número. */
function numeroDe(areas: string[]): string | null {
  const ns = areas.map((a) => a.replace(/^D?d?S?/, '')).filter(Boolean);
  return ns.length ? ns.join('+') : null;
}

function camino(parte: Parte): string {
  return parte.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 100).toFixed(2)} ${(y * 100).toFixed(2)}`).join(' ') + 'Z';
}

export default function Capturador({
  evaluacionId,
  nombre,
  desde,
  repetidas,
}: {
  evaluacionId: string;
  nombre: string;
  /** Desde qué número seguir: el protocolo se numera corrido, no por lámina. */
  desde: number;
  /** Cuántas respuestas de la lámina I ya están cargadas en la ficha. */
  repetidas: number;
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
  const [pendiente, setPendiente] = useState<{ h: Hallazgo | null } | null>(null);
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  /**
   * Qué filas tienen la nota abierta.
   *
   * La observación es la excepción y no la regla: se anota en una de cada
   * tantas respuestas, y con el campo siempre puesto había un renglón vacío
   * debajo de cada fila. Se abre desde su botón, y una fila que ya tiene algo
   * escrito lo muestra sin que haya que abrirla.
   */
  const [conNota, setConNota] = useState<number[]>([]);
  /**
   * Qué fila está pidiendo confirmación para borrarse.
   *
   * La × está al lado de campos que se tocan todo el tiempo y borrar no se
   * puede deshacer: lo capturado de esa respuesta se pierde y hay que volver a
   * marcar el área y buscar la respuesta. Es el mismo paso que pide el resto
   * del OS antes de un borrado.
   */
  const [aBorrar, setABorrar] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
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
    if (puestas.length === 0) return q.length >= 2 ? buscar(LAMINA, dijo).slice(0, 40) : [];
    const suyas = puestas
      .flatMap((a) => entradasDe(LAMINA, a))
      .sort((x, y) => x.respuesta.localeCompare(y.respuesta, 'es') || x.area.localeCompare(y.area));
    return q.length < 2 ? suyas : suyas.filter((e) => plano(e.respuesta).includes(q));
  }, [dijo, puestas]);

  function alternar(a: string) {
    setPuestas((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
    // Cambiar de área es empezar otra respuesta: la que esperaba su calidad ya
    // no va en el área que quedó marcada.
    setPendiente(null);
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
    const respuesta = h?.respuesta ?? dijo.trim();
    // La calidad formal es la que esa respuesta tiene en el área elegida, no la
    // del renglón que se apretó: la misma respuesta no vale lo mismo en dos
    // áreas, y esa es justamente la decisión que la Tabla A resuelve.
    const entrada =
      h && areas.includes(h.area)
        ? h
        : areas
            .flatMap((a) => entradasDe(LAMINA, a))
            .find((e) => e.respuesta === respuesta) ?? null;
    const locs = localizacionesDe(areas[0]);
    setRespuestas((rs) => [
      ...rs,
      {
        n: desde + rs.length,
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
        popular: esPopular(LAMINA, areas[0], respuesta),
        integradas: false,
        blancoIntegrado: false,
        observacion: '',
      },
    ]);
    setDijo('');
    setPuestas([]);
    setPendiente(null);
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
      rs.filter((r) => r.n !== n).map((r, i) => ({ ...r, n: desde + i }))
    );
  }

  function zDe(r: Respuesta) {
    return puntajeZ(LAMINA, {
      areas: r.areas,
      localizacion: r.localizacion,
      integradas: r.integradas,
      blancoIntegrado: r.blancoIntegrado,
    });
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    let mal = 0;
    for (const r of respuestas) {
      const res = await fetch('/api/os/manchas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacionId,
          campos: {
            lamina: LAMINA,
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
    const sigue = siguienteDe(LAMINA);
    if (sigue && CARGADAS.includes(sigue)) {
      // Acá va la lámina siguiente cuando esté cargada. Lo capturado ya está en
      // la ficha, así que la pantalla puede empezar de cero.
      setRespuestas([]);
      setAviso(null);
      return;
    }
    setAviso(
      `Se pasaron ${respuestas.length} respuestas a la ficha de ${nombre}.` +
        (sigue
          ? ` La lámina ${sigue} todavía no está cargada en el sistema: se sigue codificando en la ficha.`
          : '')
    );
  }

  return (
    <div className="os-ror">
      {repetidas > 0 && (
        <p className="os-ror-duda">
          Esta evaluación ya tiene {repetidas} respuesta{repetidas === 1 ? '' : 's'} de la
          lámina I cargada{repetidas === 1 ? '' : 's'}. Lo que captures acá se suma, no las
          reemplaza: mirá la ficha antes de pasarlas.
        </p>
      )}

      {/* ------------------------------------------------------------ el mapa */}
      <section className="os-panel os-ror-mapa">
        <div className="os-ror-capas">
          <span className="os-ror-puestas">
            {puestas.length > 0
              ? `Marcadas: ${puestas.join(' + ')}`
              : 'Apretá el área donde lo vio'}
          </span>
        </div>

        <div className="os-ror-mapas">
          {MAPAS.map((grupo, g) => (
            <div key={g} className="os-ror-lienzo">
              <img src="/api/os/lamina/rorschach/1" alt="Lámina I" />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                {grupo.map((a) =>
                  (AREAS[a] ?? []).map((parte, i) => (
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
                  const c = puesto(a, AREAS[a] ?? []);
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
                const c = puesto(a, AREAS[a] ?? []);
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
                        ? 'El recorte que señaló no es ninguna de las áreas del libro'
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
          <div className="os-ror-campos">
            <div className="os-ror-campo" hidden={Boolean(pendiente)}>
              <div className="os-ror-campo-alto">
                <span className="os-dato-rotulo">
                  Respuesta
                  {puestas.length > 0
                    ? ` · se busca en ${puestas.join(' + ')}`
                    : ' · se busca en toda la lámina'}
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
              <input
                className="os-campo"
                value={dijo}
                onChange={(e) => setDijo(e.target.value)}
                placeholder="Sus palabras, textuales"
                aria-label="Respuesta"
              />
            </div>

            {pendiente && (
              <div className="os-ror-dq">
                <p className="os-ror-dq-que">
                  {pendiente.h?.respuesta ?? dijo.trim()}
                  <span className="os-ror-dq-area">
                    {(puestas.length > 0 ? puestas : pendiente.h ? [pendiente.h.area] : []).join(
                      ' + '
                    )}
                  </span>
                </p>
                <div className="os-ror-dq-fila">
                  {localizacionesDe(puestas[0] ?? pendiente.h?.area ?? 'W')
                    .filter((l) => soloDq(l))
                    .map((l) => (
                      <button
                        key={l}
                        type="button"
                        className="os-ror-dq-opcion"
                        style={{ background: tonoDe(LOCALIZACION, l) }}
                        onClick={() => tomar(pendiente.h, l)}
                        title={l}
                      >
                        {soloDq(l)}
                      </button>
                    ))}
                  <button
                    type="button"
                    className="os-boton os-boton-fila os-boton-derecha"
                    onClick={() => tomar(pendiente.h, null)}
                  >
                    Sin decidir
                  </button>
                  <button
                    type="button"
                    className="os-boton os-boton-fila"
                    onClick={() => setPendiente(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* La lista de la Tabla A va abajo del campo y no en un panel
                aparte: se escribe y se elige sin mover la vista, con los siete
                mapas al lado. Con una respuesta esperando su calidad no se
                muestra: la palabra ya está elegida y lo único que queda es el
                DQ. */}
            <div className="os-ror-opciones" hidden={Boolean(pendiente)}>
              <div className="os-ror-opciones-columnas">
              {opciones.length === 0 && (
                <p className="os-ror-vacio">
                  {puestas.length === 0
                    ? 'Apretá el área donde lo vio, o escribí lo que dijo.'
                    : dijo.trim().length >= 2
                      ? `«${dijo.trim()}» no figura en ${puestas.join(' + ')}: se carga igual, con la calidad a mano.`
                      : 'Esas áreas no tienen entradas para la lámina derecha.'}
                </p>
              )}
              {opciones.map((h, i) => (
                <button
                  key={`${h.area}-${h.respuesta}-${i}`}
                  type="button"
                  className="os-ror-opcion"
                  onClick={() => setPendiente({ h })}
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

            {!pendiente && (puestas.length > 0 || dijo.trim()) && (
              <button type="button" className="os-boton" onClick={() => setPendiente({ h: null })}>
                No está en la tabla: cargar igual
                {puestas.length > 0 ? ` en ${puestas.join(' + ')}` : ''}
              </button>
            )}
          </div>
        </div>

        <p className="os-ror-aclaracion">
          Marcá más de un área cuando la respuesta las integre: de ahí sale si el
          puntaje Z es ZA, ZD o ZS.
        </p>
      </section>

      {/* -------------------------------------------------------- lo capturado */}
      <section className="os-panel os-ror-capturadas">
        {/* Los rótulos son los de la tabla de codificación de la ficha, con su
            mismo nombre: el área marcada en el mapa es el número de localización
            de allá, y llamarla "áreas" acá obligaba a traducir al pasar de una
            pantalla a la otra. */}
        {respuestas.length > 0 && (
          <div className="os-ror-fila-datos os-ror-titulos">
            <span>N° rta</span>
            <span>Respuesta</span>
            <span>N° loc.</span>
            <span>Loc. + DQ</span>
            <span>FQ</span>
            <span>Contenidos</span>
            <span>P</span>
            <span>Pje Z</span>
            {/* La última columna lleva el lápiz de la nota y la cruz que borra.
                El rótulo nombra al primero, que es el que deja algo escrito. */}
            <span>Nota</span>
          </div>
        )}

        {respuestas.map((r) => {
          const v = zDe(r);
          const tieneEspacio = r.areas.some(esEspacio);
          const tieneTinta = r.areas.some((a) => !esEspacio(a));
          return (
            <article key={r.n} className={`os-ror-fila${r.extrapolada ? ' os-ror-extrapolada' : ''}`}>
              <div className="os-ror-fila-datos">
                <span className="os-ror-n">{r.n}</span>
                <span className="os-ror-dijo">{r.dijo}</span>
                <span className="os-ror-areas">{r.areas.join(' + ')}</span>
                {/* El mismo selector que la tabla de codificación de la ficha,
                    con sus mismos colores: los códigos se reconocen por su
                    color y no puede ser uno acá y otro allá. Ofrece las
                    localizaciones compatibles con el área, y "Mostrar todas"
                    para el caso raro. */}
                <Codigo
                  valor={r.localizacion}
                  opciones={LOCALIZACION.filter((o) => localizacionesDe(r.areas[0]).includes(o.v))}
                  todas={LOCALIZACION}
                  onElegir={(v) => cambiar(r.n, { localizacion: v })}
                  etiqueta="Localización y DQ"
                  buscable={false}
                  // Sin elegir muestra la familia que ya sale del área ("D…"),
                  // no un guion: lo que falta es la calidad evolutiva, y un
                  // hueco vacío se lee como si faltara también la localización.
                  vacio={`${familiaDe(r.areas[0])}…`}
                />
                <span className="os-ror-dato">
                  {r.fq ? (
                    <span className="os-ror-fq" style={{ background: tonoDe(FQ, r.fq) }}>
                      {r.fq}
                    </span>
                  ) : (
                    '—'
                  )}
                </span>
                <span className="os-ror-dato os-ror-contenidos">
                  {r.contenidos.length === 0
                    ? '—'
                    : r.contenidos.map((c) => (
                        <span
                          key={c}
                          className="os-ror-etiqueta"
                          style={{ background: tonoDe(CONTENIDOS, c) }}
                        >
                          {c}
                        </span>
                      ))}
                </span>
                <span className="os-ror-dato">{r.popular ? 'P' : ''}</span>
                <span className="os-ror-dato os-ror-z">
                  {v.z ? `${v.z.tipo} ${v.z.valor}` : '—'}
                </span>
                {/* El lápiz y la cruz van en la misma celda: son los dos botones
                    de la fila y ocupan una columna sola. El borrado se confirma
                    como en el resto del OS, partiéndose en "Sí, borrar" y "No",
                    porque no se puede deshacer y esta columna está al lado de
                    campos que se tocan todo el tiempo. */}
                <span className="os-ror-acciones">
                  <button
                    type="button"
                    className={`os-ror-nota${r.observacion ? ' os-ror-nota-puesta' : ''}`}
                    onClick={() =>
                      setConNota((ns) =>
                        ns.includes(r.n) ? ns.filter((n) => n !== r.n) : [...ns, r.n]
                      )
                    }
                    title={r.observacion || 'Dejar una observación'}
                    aria-label={`Observación de la respuesta ${r.n}`}
                  >
                    ✎
                  </button>
                  {aBorrar === r.n ? (
                    <>
                      <button
                        type="button"
                        className="os-boton os-boton-fila os-boton-peligro"
                        onClick={() => {
                          setABorrar(null);
                          borrar(r.n);
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

              <div className="os-ror-fila-z">
                {r.areas.length >= 2 && (
                  <label className="os-ror-tilde">
                    <input
                      type="checkbox"
                      checked={r.integradas}
                      onChange={(e) => cambiar(r.n, { integradas: e.target.checked })}
                    />
                    Integra las áreas con una relación significativa
                  </label>
                )}
                {(tieneEspacio || (r.localizacion?.includes('S') ?? false)) && (
                  <label className="os-ror-tilde">
                    <input
                      type="checkbox"
                      checked={r.blancoIntegrado}
                      onChange={(e) => cambiar(r.n, { blancoIntegrado: e.target.checked })}
                      disabled={!tieneTinta && !r.localizacion?.match(/^(W|D)S/)}
                    />
                    El blanco se integra con la mancha
                  </label>
                )}
                {v.z && <span className="os-ror-porque">{v.z.tipo}: {v.z.porque}</span>}
                {v.otros.map((o) => (
                  <span key={o.tipo} className="os-ror-porque os-ror-descartado">
                    {o.tipo} {o.valor} también daba, gana el más alto
                  </span>
                ))}
                {v.aConfirmar.map((a, i) => (
                  <span key={i} className="os-ror-duda">
                    {a}
                  </span>
                ))}
                {(conNota.includes(r.n) || r.observacion) && (
                  <input
                    className="os-campo os-ror-observacion"
                    value={r.observacion}
                    onChange={(e) => cambiar(r.n, { observacion: e.target.value })}
                    placeholder="Observación"
                    autoFocus
                  />
                )}
              </div>
            </article>
          );
        })}

        {respuestas.some((r) => !r.localizacion) && (
          <ul className="os-ror-criterios">
            {CRITERIO_DQ.map(([simbolo, criterio]) => (
              <li key={simbolo}>
                <span className="os-ror-simbolo">{simbolo}</span> {criterio}
              </li>
            ))}
          </ul>
        )}

        <div className="os-ror-pie">
          <button
            type="button"
            className="os-boton os-boton-firme"
            disabled={respuestas.length === 0 || guardando}
            onClick={guardar}
          >
            {guardando ? 'Pasando…' : 'Próxima lámina'}
          </button>
        </div>
        {aviso && <p className="os-form-ok">{aviso}</p>}
      </section>
    </div>
  );
}
