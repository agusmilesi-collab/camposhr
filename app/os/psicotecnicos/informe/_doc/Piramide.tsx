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
 * **Es una pirámide truncada, sin la punta de fondo.** El informe que se entrega
 * hoy la dibuja con dos figuras de pendientes distintas, una punta empinada
 * detrás de los escalones, y se probó de las dos maneras: con la misma silueta
 * para todo, el escalón más alto mide treinta y siete píxeles y "Liderazgo 2"
 * sale cortado; con la punta detrás, aun coincidiendo las dos bases, se ven dos
 * dibujos superpuestos y no uno.
 *
 * Así que la figura es una sola y sus cuatro lados caen sobre una recta.
 * Truncada se lee igual: lo que el dibujo dice es que arriba hay menos lugar
 * que abajo, y eso lo dicen los anchos.
 */

import { NIVELES, type NivelDiscursivo } from '@/lib/discursivo';

/** Alto de cada escalón. Entran dos renglones de descripción. */
const ALTO = 56;
/** Cuánto se separan dos escalones. Marca el escalón sin partir la figura. */
const SEPARACION = 5;
/** Ancho de la base de los escalones. */
const ANCHO = 300;
/**
 * Ancho del borde de arriba del primer escalón.
 *
 * Es lo que define cuánto se abre la figura: cuanto más chico, más puntuda. El
 * piso lo pone el nombre más largo del escalón más alto, que tiene que entrar
 * en el ancho que el trapecio tiene a media altura, no en el de arriba.
 */
const CORONA = 84;

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
  // Con uno ubicado, los otros tres se atenúan: el que importa es a dónde puede
  // llegar, y los demás quedan como referencia de dónde cae eso. Sin ninguno
  // ubicado los cuatro pesan igual, que es lo que hay que ver para elegir.
  return (
    <div className={nivel ? 'inf-piramide con-elegido' : 'inf-piramide'}>
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
              {/* El tilde va adentro del recuadro y no en una columna aparte:
                  suelto al costado quedaba flotando fuera de la figura. */}
              <span className="inf-piramide-que">
                {n.que}
                {suyo && (
                  <span className="inf-piramide-tilde" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
            </>
          );

          return (
            <li
              key={n.nombre}
              className={suyo ? 'inf-escalon suyo' : 'inf-escalon'}
              style={{ gridTemplateColumns: `${ANCHO}px minmax(0, 1fr)` }}
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
