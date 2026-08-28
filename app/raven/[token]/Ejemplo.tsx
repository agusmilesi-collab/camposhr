'use client';

/**
 * Un ejemplo resuelto, antes de empezar.
 *
 * La consigna dice "falta una pieza y hay que elegir cuál la completa", y eso
 * escrito no se entiende del todo hasta que se lo ve. Acá está la misma
 * mecánica en chico, y con la misma forma que las láminas de verdad: una
 * matriz de tres por tres con el último lugar vacío y ocho opciones abajo. Al
 * tocar la que va, se pinta de verde y aparece la regla que la explica.
 *
 * **No es una lámina del test.** Las 36 del Raven se puntúan, así que usar la
 * primera como ejemplo sería regalar una respuesta y dejar de medir esa lámina.
 * Esta es un dibujo propio con la regla más simple que se puede escribir: la
 * fila dice la forma y la columna dice el tamaño.
 *
 * Las ocho opciones son las que hacen falta para que el ejemplo enseñe algo:
 * con dos o tres, la respuesta sale por descarte y no por la regla. Siete de
 * ellas son la forma correcta con otro tamaño, o el tamaño correcto con otra
 * forma, que es como están armadas las del test.
 */

import { useState } from 'react';

type Figura = 'circulo' | 'cuadrado' | 'triangulo';
/** Los tres tamaños de la fila, en radio o medio lado. */
const TAMANOS = { chico: 8, medio: 12.5, grande: 17 } as const;
type Tamano = keyof typeof TAMANOS;

function Dibujo({ figura, tamano }: { figura: Figura; tamano: Tamano }) {
  const r = TAMANOS[tamano];
  /* El trazo no se agranda con el dibujo: la matriz y las opciones se dibujan
     a tamaños distintos y las líneas tienen que verse del mismo grosor en las
     dos. */
  const trazo = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinejoin: 'round' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  return (
    <svg viewBox="0 0 46 46" className="rv-ejemplo-figura" aria-hidden="true">
      {figura === 'circulo' && <circle cx="23" cy="23" r={r} {...trazo} />}
      {figura === 'cuadrado' && (
        <rect x={23 - r} y={23 - r} width={r * 2} height={r * 2} {...trazo} />
      )}
      {/* El triángulo ocupa el mismo alto que el círculo y el cuadrado de su
          columna: con la base a media altura del radio se veía un tamaño más
          chico que el que le tocaba, y el tamaño es justamente la regla. */}
      {figura === 'triangulo' && (
        <polygon
          points={`23,${23 - r} ${23 + r * 1.12},${23 + r} ${23 - r * 1.12},${23 + r}`}
          {...trazo}
        />
      )}
    </svg>
  );
}

/** Las ocho filas de la matriz: la forma manda en la fila y el tamaño en la columna. */
const MATRIZ: { figura: Figura; tamano: Tamano }[] = [
  { figura: 'circulo', tamano: 'chico' },
  { figura: 'circulo', tamano: 'medio' },
  { figura: 'circulo', tamano: 'grande' },
  { figura: 'cuadrado', tamano: 'chico' },
  { figura: 'cuadrado', tamano: 'medio' },
  { figura: 'cuadrado', tamano: 'grande' },
  { figura: 'triangulo', tamano: 'chico' },
  { figura: 'triangulo', tamano: 'medio' },
];

/** Lo que falta: el triángulo grande. */
const FALTA: { figura: Figura; tamano: Tamano } = { figura: 'triangulo', tamano: 'grande' };

/**
 * Las ocho opciones, como en el test: ocho, y todas plausibles.
 *
 * La correcta no va primera ni última, que son los dos lugares donde el ojo
 * cae solo.
 */
const OPCIONES_EJ: { figura: Figura; tamano: Tamano }[] = [
  { figura: 'triangulo', tamano: 'chico' },
  { figura: 'circulo', tamano: 'grande' },
  { figura: 'triangulo', tamano: 'medio' },
  { figura: 'cuadrado', tamano: 'grande' },
  { figura: 'triangulo', tamano: 'grande' },
  { figura: 'cuadrado', tamano: 'medio' },
  { figura: 'circulo', tamano: 'medio' },
  { figura: 'cuadrado', tamano: 'chico' },
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
            <Dibujo figura={c.figura} tamano={c.tamano} />
          </span>
        ))}
        {/* El lugar vacío, punteado como el hueco de una lámina. */}
        <span className={`rv-ejemplo-falta${acerto ? ' resuelta' : ''}`}>
          {acerto ? <Dibujo figura={FALTA.figura} tamano={FALTA.tamano} /> : '?'}
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
              <Dibujo figura={o.figura} tamano={o.tamano} />
            </button>
          );
        })}
      </div>

      <p className="rv-ejemplo-pie">
        {acerto
          ? 'Esa es: la fila dice la forma y la columna dice el tamaño.'
          : elegida === null
            ? 'Tocá la opción que completa la matriz.'
            : 'Esa no. Mirá qué cambia de una fila a la otra y de una columna a la otra.'}
      </p>
    </section>
  );
}
