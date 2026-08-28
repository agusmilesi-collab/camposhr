'use client';

/**
 * Un ejemplo resuelto, antes de empezar.
 *
 * La consigna dice "falta una pieza y hay que elegir cuál la completa", y eso
 * escrito no se entiende del todo hasta que se lo ve. Acá está la misma
 * mecánica en chico: una grilla con un lugar vacío y opciones abajo, para
 * tocar. Al tocar la que va, se pinta de verde y aparece la regla que la
 * explica.
 *
 * **No es una lámina del test.** Las 36 del Raven se puntúan, así que usar la
 * primera como ejemplo sería regalar una respuesta y dejar de medir esa lámina.
 * Esta es un dibujo propio y bien simple: la fila dice la forma y la columna
 * dice si está pintada.
 */

import { useState } from 'react';

/** El tamaño de una celda del dibujo, y de cada opción. */
const LADO = 46;

type Figura = 'circulo' | 'cuadrado' | 'triangulo';

function Dibujo({ figura, lleno }: { figura: Figura; lleno: boolean }) {
  const trazo = {
    fill: lleno ? 'currentColor' : 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
  };
  return (
    <svg viewBox="0 0 46 46" width={LADO} height={LADO} aria-hidden="true">
      {figura === 'circulo' && <circle cx="23" cy="23" r="13" {...trazo} />}
      {figura === 'cuadrado' && <rect x="10" y="10" width="26" height="26" {...trazo} />}
      {figura === 'triangulo' && <polygon points="23,9 37,36 9,36" {...trazo} />}
    </svg>
  );
}

/** Las cuatro opciones. La tercera es la que completa la grilla. */
const OPCIONES: { figura: Figura; lleno: boolean }[] = [
  { figura: 'circulo', lleno: true },
  { figura: 'cuadrado', lleno: false },
  { figura: 'cuadrado', lleno: true },
  { figura: 'triangulo', lleno: true },
];

const CORRECTA = 2;

export default function Ejemplo() {
  const [elegida, setElegida] = useState<number | null>(null);
  const acerto = elegida === CORRECTA;

  return (
    <section className="rv-ejemplo" aria-label="Ejemplo">
      <p className="rv-ejemplo-rotulo">Así funciona</p>

      <div className="rv-ejemplo-grilla">
        <span>
          <Dibujo figura="circulo" lleno={false} />
        </span>
        <span>
          <Dibujo figura="circulo" lleno />
        </span>
        <span>
          <Dibujo figura="cuadrado" lleno={false} />
        </span>
        {/* El lugar vacío, con el mismo borde punteado que tiene la lámina. */}
        <span className={`rv-ejemplo-falta${acerto ? ' resuelta' : ''}`}>
          {acerto ? <Dibujo figura="cuadrado" lleno /> : '?'}
        </span>
      </div>

      <div className="rv-ejemplo-opciones">
        {OPCIONES.map((o, i) => {
          const puesta = elegida === i;
          return (
            <button
              key={i}
              type="button"
              className={`rv-ejemplo-opcion${puesta ? (i === CORRECTA ? ' bien' : ' mal') : ''}`}
              aria-pressed={puesta}
              onClick={() => setElegida(i)}
            >
              <Dibujo figura={o.figura} lleno={o.lleno} />
            </button>
          );
        })}
      </div>

      <p className="rv-ejemplo-pie">
        {acerto
          ? 'Esa es: la fila dice la forma y la columna dice si está pintada.'
          : elegida === null
            ? 'Tocá la opción que completa la grilla.'
            : 'Esa no. Mirá qué cambia de una fila a la otra y de una columna a la otra.'}
      </p>
    </section>
  );
}
