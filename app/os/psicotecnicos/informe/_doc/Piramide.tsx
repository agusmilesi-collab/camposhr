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
 * **Son dos figuras y no una, como en el informe que se entrega hoy.** La
 * pirámide de fondo es más empinada que los escalones: los de arriba sobresalen
 * de ella y por eso su nombre entra, y hacia abajo se van metiendo hasta
 * terminar las dos en la misma base. Con una sola silueta el escalón más alto
 * mide treinta y siete píxeles y "Liderazgo 2" sale cortado.
 *
 * **Las dos terminan juntas abajo, y eso es lo que hay que cuidar.** Con la base
 * de los escalones más angosta que la del triángulo, el fondo asoma por los
 * costados del último escalón y las dos figuras se leen como dos dibujos
 * superpuestos en vez de uno. Por eso {@link ANCHO} y la base del fondo se
 * calculan para coincidir ahí.
 */

import { NIVELES, type NivelDiscursivo } from '@/lib/discursivo';

/** Alto de cada escalón. Entran dos renglones de descripción. */
const ALTO = 56;
/** Cuánto se separan dos escalones. Por ahí se ve la pirámide de fondo. */
const SEPARACION = 5;
/** Ancho de la base de los escalones. */
const ANCHO = 300;
/**
 * Ancho del borde de arriba del primer escalón.
 *
 * Lo manda el nombre más largo del escalón más alto: con menos, "Liderazgo 2"
 * sale cortado. Es lo que define cuánto se abren los escalones, y por eso son
 * menos empinados que la pirámide de fondo.
 */
const CORONA = 130;
/** Lo que la punta de la pirámide asoma por encima del primer escalón. */
const PUNTA = 46;
/** Lo que la base asoma por debajo del último. */
const PIE = 22;

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
  // La pirámide de fondo baja desde su punta hasta pasar el último escalón, y
  // su base se calcula para medir lo mismo que la de los escalones justo ahí.
  const altoFondo = PUNTA + ESCALONES + PIE;
  const baseFondo = (ANCHO * altoFondo) / (PUNTA + ESCALONES);

  return (
    <div className="inf-piramide" style={{ paddingTop: PUNTA, paddingBottom: PIE }}>
      <span
        className="inf-piramide-fondo"
        aria-hidden="true"
        style={{ width: baseFondo, height: altoFondo, marginLeft: (ANCHO - baseFondo) / 2 }}
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
