'use client';

/**
 * Un ejemplo resuelto, antes de empezar.
 *
 * La consigna dice "falta una pieza y hay que elegir cuál la completa", y eso
 * escrito no se entiende del todo hasta que se lo ve. Acá está la misma
 * mecánica, y con la misma forma que las láminas de verdad: una matriz de tres
 * por tres con el último lugar vacío y ocho opciones abajo. Al tocar la que va,
 * se pinta de verde y aparece la regla que la explica.
 *
 * **La regla se tiene que ver de un vistazo y sin pensarla**: la fila dice la
 * forma y la columna dice cuántas. Contar uno, dos, tres es más inmediato que
 * comparar tamaños o rellenos, y acá no se está midiendo nada: se está
 * explicando qué hay que hacer. Las figuras van pintadas por lo mismo.
 *
 * **No es una lámina del test.** Las 36 del Raven se puntúan, así que usar la
 * primera como ejemplo sería regalar una respuesta y dejar de medir esa lámina.
 *
 * Las ocho opciones son las que hacen falta para que el ejemplo enseñe algo:
 * con dos o tres, la respuesta sale por descarte y no por la regla. Todas son
 * la forma correcta con otra cantidad, o la cantidad correcta con otra forma,
 * que es como están armadas las del test.
 */

import { useState } from 'react';

type Figura = 'circulo' | 'cuadrado' | 'triangulo';
type Celda = { figura: Figura; cuantas: number };

function Dibujo({ figura, cuantas }: Celda) {
  const relleno = { fill: 'currentColor' };
  return (
    <span className="rv-ejemplo-figuras">
      {Array.from({ length: cuantas }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="rv-ejemplo-figura" aria-hidden="true">
          {figura === 'circulo' && <circle cx="12" cy="12" r="10" {...relleno} />}
          {figura === 'cuadrado' && <rect x="2" y="2" width="20" height="20" {...relleno} />}
          {figura === 'triangulo' && <polygon points="12,1 23,22 1,22" {...relleno} />}
        </svg>
      ))}
    </span>
  );
}

/** Las ocho celdas dibujadas: la forma manda en la fila y la cantidad en la columna. */
const MATRIZ: Celda[] = [
  { figura: 'circulo', cuantas: 1 },
  { figura: 'circulo', cuantas: 2 },
  { figura: 'circulo', cuantas: 3 },
  { figura: 'cuadrado', cuantas: 1 },
  { figura: 'cuadrado', cuantas: 2 },
  { figura: 'cuadrado', cuantas: 3 },
  { figura: 'triangulo', cuantas: 1 },
  { figura: 'triangulo', cuantas: 2 },
];

/** Lo que falta: tres triángulos. */
const FALTA: Celda = { figura: 'triangulo', cuantas: 3 };

/** Las ocho opciones. La que va no está ni primera ni última. */
const OPCIONES_EJ: Celda[] = [
  { figura: 'triangulo', cuantas: 2 },
  { figura: 'circulo', cuantas: 3 },
  { figura: 'triangulo', cuantas: 1 },
  { figura: 'cuadrado', cuantas: 3 },
  { figura: 'triangulo', cuantas: 3 },
  { figura: 'cuadrado', cuantas: 2 },
  { figura: 'circulo', cuantas: 1 },
  { figura: 'circulo', cuantas: 2 },
];

const CORRECTA = 4;

export default function Ejemplo() {
  const [elegida, setElegida] = useState<number | null>(null);
  const acerto = elegida === CORRECTA;

  return (
    <section className="rv-ejemplo" aria-label="Ejemplo">
      <p className="rv-ejemplo-rotulo">Así funciona</p>

      <div className="rv-ejemplo-grilla">
        {MATRIZ.map((c, i) => (
          <span key={i}>
            <Dibujo {...c} />
          </span>
        ))}
        {/* El lugar vacío, apagado como el hueco de una lámina. */}
        <span className={`rv-ejemplo-falta${acerto ? ' resuelta' : ''}`}>
          {acerto ? <Dibujo {...FALTA} /> : '?'}
        </span>
      </div>

      <div className="rv-ejemplo-opciones">
        {OPCIONES_EJ.map((o, i) => {
          const puesta = elegida === i;
          return (
            <button
              key={i}
              type="button"
              className={`rv-ejemplo-opcion${puesta ? (i === CORRECTA ? ' bien' : ' mal') : ''}`}
              aria-pressed={puesta}
              aria-label={`Opción ${i + 1}`}
              onClick={() => setElegida(i)}
            >
              <Dibujo {...o} />
            </button>
          );
        })}
      </div>

      <p className="rv-ejemplo-pie">
        {acerto
          ? 'Esa es: cada fila tiene su forma y cada columna suma una figura.'
          : elegida === null
            ? 'Tocá la opción que completa la matriz.'
            : 'Esa no. Mirá qué cambia de una fila a la otra y de una columna a la otra.'}
      </p>
    </section>
  );
}
