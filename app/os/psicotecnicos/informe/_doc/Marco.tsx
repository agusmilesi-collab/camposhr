import type { Informe } from '@/lib/informe';

/**
 * Lo que envuelve al informe: la marca arriba y el pie abajo.
 *
 * Vive aparte de `Documento` porque en el portal se dibuja una sola vez para
 * las tres partes. Ahí el informe se lee como una página con pestañas: quién es
 * la persona y para qué puesto se la evaluó no cambia al pasar de la
 * recomendación a los indicadores, y repetirlo en cada pestaña es la forma de
 * un PDF, no la de una página.
 *
 * En la ficha y en la vista para imprimir lo sigue dibujando `Documento`, que
 * ahí el documento es uno solo de arriba abajo.
 */

/** El logotipo tipográfico, el mismo del sitio y de la página de precios. */
export function Marca() {
  return (
    <header className="inf-marca">
      <div>
        <span className="inf-marca-nombre">Campos HR</span>
        <span>Evaluaciones psicotécnicas</span>
      </div>
      <span className="inf-sitio">www.camposhr.com</span>
    </header>
  );
}

/** Quién es y para qué puesto, una sola vez y antes de todo. */
export function Encabezado({ inf }: { inf: Informe }) {
  return (
    <header className="inf-encabezado">
      <h1>{inf.nombre}</h1>
      <div className="inf-datos">
        {inf.puesto && (
          <p>
            <span>Rol aspirado:</span> {inf.puesto}
          </p>
        )}
        {inf.empresa && (
          <p>
            <span>Empresa:</span> {inf.empresa}
          </p>
        )}
        {inf.edad !== null && (
          <p>
            <span>Edad:</span> {inf.edad} {inf.edad === 1 ? 'año' : 'años'}
          </p>
        )}
        <p>
          <span>Evaluación:</span> {inf.cuando}
        </p>
      </div>
    </header>
  );
}

/**
 * El pie, con los mismos datos que cierran la página de precios.
 *
 * Se imprime en la última hoja y no en todas: en cada página sería un renglón
 * repetido siete veces, y lo que hace falta es que el informe impreso, si se
 * separa de su mail, siga diciendo de quién es.
 */
export function Pie() {
  return (
    <footer className="inf-pie">
      <span className="inf-pie-marca">Campos HR</span>
      <span className="inf-pie-lema">
        Estructura inteligente. Potencial humano. Impacto medible.
      </span>
      <span className="inf-pie-datos">Rosario, Argentina · www.camposhr.com</span>
    </footer>
  );
}
