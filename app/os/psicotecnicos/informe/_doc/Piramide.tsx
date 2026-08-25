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
 * **Es una pirámide truncada y una sola figura.** La punta se probó de dos
 * maneras y las dos quedaron mal. Con la misma silueta para todo, el escalón de
 * arriba mide treinta y siete píxeles y su nombre sale cortado. Con una punta de
 * fondo aparte, que es como está dibujado el informe que se entrega hoy, las dos
 * figuras tienen pendientes distintas y se cruzan: arriba los escalones se salen
 * del triángulo y abajo el triángulo se sale de los escalones.
 *
 * Para que entren las dos cosas, un nombre adentro del escalón más alto y una
 * punta con la misma pendiente, la punta tiene que medir ciento cuarenta píxeles
 * sobre doscientos cincuenta de escalones, y ahí la figura es más punta que
 * pirámide. Truncada se lee igual y no tiene bordes que no cierran.
 */

import { NIVELES, type NivelDiscursivo } from '@/lib/discursivo';

/** Alto de cada escalón. Entran dos renglones de descripción. */
const ALTO = 58;
/** Cuánto se separan dos escalones. Marca el escalón sin partir la figura. */
const SEPARACION = 4;
/** Ancho de la base, que es la columna del dibujo. */
const ANCHO = 280;
/**
 * Ancho del borde de arriba.
 *
 * Lo manda el nombre más largo del escalón más alto: con menos, "Liderazgo 2"
 * sale cortado. Es lo que define cuánto se abre la pirámide.
 */
const CORONA = 104;

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
  return (
    <div className="inf-piramide">
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
