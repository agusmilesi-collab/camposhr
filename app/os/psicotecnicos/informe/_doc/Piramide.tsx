/**
 * La pirámide del análisis discursivo, con el escalón que le corresponde.
 *
 * Cuatro niveles de rol del modelo de Elliot Jaques, del más alto al más bajo,
 * y el que la evaluadora ubicó marcado con su recuadro. Es el mismo dibujo en
 * el informe y en la ficha: en la ficha cada escalón es un botón, y en el
 * informe se lee.
 *
 * **Los escalones son trapecios recortados y no una imagen.** El informe se
 * imprime a PDF y se lee en pantalla, y una imagen quedaba pixelada al
 * ampliarla y sin texto que se pueda buscar ni leer en voz alta.
 *
 * **El ancho de cada trapecio sale de su altura y no de su número de orden.**
 * Calculado por orden, el escalón que necesitaba dos renglones de texto crecía
 * y sus lados se salían de la recta. Por eso los escalones miden todos lo mismo
 * y esa medida está acá: si el texto de un nivel dejara de entrar en dos
 * renglones, hay que subir {@link ALTO} y no dejar que la fila crezca sola.
 *
 * **Los escalones son una pirámide truncada y el fondo una entera.** Siguiendo
 * los dos la misma silueta, el escalón de arriba quedaba de treinta y siete
 * píxeles y su nombre salía cortado. Son las dos figuras del informe que se
 * entrega hoy: la punta asoma por encima del primer escalón y la base por
 * debajo del último.
 */

import { NIVELES, type NivelDiscursivo } from '@/lib/discursivo';

/** Alto de cada escalón. Entran dos renglones de descripción. */
const ALTO = 58;
/** Lo que se ve de la pirámide entre un escalón y el siguiente. */
const SEPARACION = 6;
/** Lo que la punta asoma por encima del primer escalón. */
const PUNTA = 38;
/** Lo que la base asoma por debajo del último. */
const PIE = 30;
/** Ancho de la base de los escalones, que es la columna del dibujo. */
const ANCHO = 280;
/** Ancho del borde de arriba del primer escalón: lo que pide su nombre. */
const CORONA = 120;
/** Cuánto sobresale la base de la pirámide de fondo, de cada lado. */
const VUELO = 22;

/** Alto del bloque de escalones. */
const ESCALONES = NIVELES.length * ALTO + (NIVELES.length - 1) * SEPARACION;

/**
 * Qué tan ancho es el escalón a una altura dada, en porcentaje de la columna.
 *
 * Es media base: el trapecio se dibuja de `50 − s` a `50 + s`. La cuenta es
 * lineal entre la corona y la base, así los cuatro lados caen sobre una recta.
 */
function semiancho(y: number): number {
  return (50 * (CORONA + ((ANCHO - CORONA) * y) / ESCALONES)) / ANCHO;
}

export default function Piramide({
  nivel,
  elegir,
}: {
  /** El que ubicó la evaluadora. Null mientras no se eligió. */
  nivel: string | null;
  /** Si viene, cada escalón es un botón. En el informe no viene. */
  elegir?: (n: NivelDiscursivo) => void;
}) {
  const alturaFondo = PUNTA + ESCALONES + PIE;
  const baseFondo = ANCHO + 2 * VUELO;

  return (
    <div className="inf-piramide" style={{ paddingTop: PUNTA, paddingBottom: PIE }}>
      <span
        className="inf-piramide-fondo"
        aria-hidden="true"
        style={{ width: baseFondo, height: alturaFondo, marginLeft: (ANCHO - baseFondo) / 2 }}
      />

      <ol style={{ gap: `${SEPARACION}px 14px`, gridAutoRows: `${ALTO}px` }}>
        {NIVELES.map((n, i) => {
          const suyo = n.nombre === nivel;
          const arriba = i * (ALTO + SEPARACION);
          const abajo = arriba + ALTO;
          const forma = {
            clipPath:
              `polygon(${50 - semiancho(arriba)}% 0, ${50 + semiancho(arriba)}% 0, ` +
              `${50 + semiancho(abajo)}% 100%, ${50 - semiancho(abajo)}% 100%)`,
          };
          const dentro = (
            <>
              <span className="inf-piramide-forma" style={forma}>
                {n.nombre}
              </span>
              <span className="inf-piramide-que">{n.que}</span>
              <span className="inf-piramide-tilde" aria-hidden="true">
                {suyo ? '✓' : ''}
              </span>
            </>
          );

          return (
            <li
              key={n.nombre}
              className={suyo ? 'inf-escalon suyo' : 'inf-escalon'}
              style={{ gridTemplateColumns: `${ANCHO}px minmax(0, 1fr) 24px` }}
            >
              {elegir ? (
                <button
                  type="button"
                  className="inf-escalon-boton"
                  aria-pressed={suyo}
                  aria-label={`Ubicarlo en ${n.nombre}: ${n.que}`}
                  onClick={() => elegir(n.nombre)}
                >
                  {dentro}
                </button>
              ) : (
                dentro
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
