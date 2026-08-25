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
 */

import { NIVELES, type NivelDiscursivo } from '@/lib/discursivo';

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
    <ol className="inf-piramide">
      {NIVELES.map((n, i) => {
        const suyo = n.nombre === nivel;
        // Los cuatro trapecios apilados arman la pirámide: cada uno arranca
        // donde termina el de arriba, así los lados quedan en una sola recta.
        const forma = {
          clipPath: `polygon(${34 - i * 8}% 0, ${66 + i * 8}% 0, ${74 + i * 8}% 100%, ${26 - i * 8}% 100%)`,
        };
        const dentro = (
          <>
            <span className="inf-piramide-forma" style={forma}>
              {n.nombre}
            </span>
            <span className="inf-piramide-que">{n.que}</span>
            {suyo && (
              <span className="inf-piramide-tilde" aria-hidden="true">
                ✓
              </span>
            )}
          </>
        );

        return (
          <li key={n.nombre} className={suyo ? 'inf-escalon suyo' : 'inf-escalon'}>
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
  );
}
