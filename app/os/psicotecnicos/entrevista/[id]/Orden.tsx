'use client';

/**
 * Los tests de la entrevista, en el orden que elige quien la toma.
 *
 * La batería dice qué se le toma, no en qué orden: si la persona llega tensa
 * conviene empezar por el gráfico, y si hay poco tiempo se manda el Raven
 * primero para que corra mientras se hace otra cosa. Hasta ahora salían siempre
 * en el orden en que están declarados en la batería, que es el mismo para
 * todos.
 *
 * **Se guarda al soltar y por evaluación**, porque la decisión es sobre esta
 * entrevista y no una preferencia general.
 *
 * **El marco de la tarjeta lo dibuja este componente y no el servidor.** El
 * número es la posición, así que moviendo tarjetas ya numeradas el 01 viajaba
 * con su test y la lista quedaba 02, 01, 03.
 *
 * El arrastre es el mismo de las listas del informe (`_doc/Listas.tsx`): se
 * toma del agarre, el lugar se cede al pasar la mitad del vecino, y el
 * reacomodo se anima midiendo antes y después.
 *
 * **Cada test se pliega.** Con los siete abiertos, la hoja son cuatro pantallas
 * y para llegar al que se está tomando hay que bajar pasando por todos. Plegado
 * se ve lo único que hace falta para elegir: el número de orden, el nombre y si
 * ya se administró. Arrancan todos plegados y se abre el que toca.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Cuánto dura el reacomodo. */
const ANIMACION = 190;

export default function Orden({
  id,
  tests,
  nombres,
  estados,
  tarjetas,
}: {
  id: string;
  /** Los nombres, en el orden que rige. Son la clave: el orden se guarda así. */
  tests: string[];
  /** Cómo se lo llama en pantalla, si no es como se llama en la batería. */
  nombres?: string[];
  /** En qué anda cada uno: va en el renglón del título, no en la tarjeta. */
  estados: React.ReactNode[];
  /** El contenido de cada uno, en el mismo orden que `tests`. */
  tarjetas: React.ReactNode[];
}) {
  const router = useRouter();
  const [orden, setOrden] = useState(() => tests.map((_, i) => i));
  /** Cuáles están abiertos, por nombre de test: el índice cambia al reordenar. */
  const [abiertos, setAbiertos] = useState<string[]>([]);
  const todas = abiertos.length === tests.length;

  const plegar = (test: string) =>
    setAbiertos((a) => (a.includes(test) ? a.filter((x) => x !== test) : [...a, test]));
  const [movido, setMovido] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const antes = useRef(new Map<string, number>());
  const tomado = useRef<number | null>(null);
  const desdeAgarre = useRef(false);

  // Lo que manda el servidor vuelve a mandar: guardar redibuja, y el estado de
  // un componente de cliente no se reinicia solo.
  const firma = tests.join('|');
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setOrden(tests.map((_, i) => i));
  }

  function medir() {
    const filas = caja.current?.children;
    if (!filas) return;
    antes.current.clear();
    for (const fila of Array.from(filas) as HTMLElement[]) {
      antes.current.set(fila.dataset.test ?? '', fila.getBoundingClientRect().top);
    }
  }

  useLayoutEffect(() => {
    const marco = caja.current;
    if (!marco) return;
    const filas = Array.from(marco.children) as HTMLElement[];
    filas.forEach((f) => f.getAnimations().forEach((a) => a.cancel()));

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    filas.forEach((f) => {
      if (quieto) return;
      const desde = antes.current.get(f.dataset.test ?? '');
      if (desde === undefined) return;
      const hasta = f.getBoundingClientRect().top;
      if (Math.abs(desde - hasta) < 0.5) return;
      f.animate(
        [{ transform: `translateY(${desde - hasta}px)` }, { transform: 'translateY(0)' }],
        { duration: ANIMACION, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
      );
    });
    antes.current.clear();
  }, [orden]);

  function reordenar(desde: number, hasta: number) {
    if (desde === hasta) return;
    medir();
    setOrden((o) => {
      const copia = [...o];
      const [fuera] = copia.splice(desde, 1);
      copia.splice(hasta, 0, fuera);
      return copia;
    });
    tomado.current = hasta;
    setMovido(hasta);
  }

  async function guardar(o: number[]) {
    setError(null);
    try {
      const res = await fetch('/api/os/entrevista-orden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, orden: o.map((i) => tests[i]) }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar el orden.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el orden.');
    }
  }

  return (
    <>
      {/* El título de la lista, con el botón que la abre o la cierra entera:
          repasar los siete tests uno por uno es tocar siete veces. */}
      <div className="os-tests-cabeza">
        <h2 className="os-subtitulo">Entrevista</h2>
        {tests.length > 0 && (
          <button
            type="button"
            className="os-boton"
            onClick={() => setAbiertos(todas ? [] : [...tests])}
          >
            {todas ? 'Plegar todas' : 'Desplegar todas'}
          </button>
        )}
      </div>
      <div ref={caja}>
        {orden.map((indice, i) => (
          <section
            key={tests[indice]}
            data-test={tests[indice]}
            className={`os-panel os-herramienta${movido === i ? ' movido' : ''}`}
            draggable
            onPointerDown={(ev) => {
              desdeAgarre.current = Boolean(
                (ev.target as HTMLElement).closest('.os-herramienta-agarre')
              );
            }}
            onDragStart={(ev) => {
              if (!desdeAgarre.current) {
                ev.preventDefault();
                return;
              }
              tomado.current = i;
              setMovido(i);
              ev.dataTransfer.effectAllowed = 'move';
              ev.dataTransfer.setData('text/plain', String(i));
            }}
            onDragOver={(ev) => {
              ev.preventDefault();
              const desde = tomado.current;
              if (desde === null || desde === i) return;
              const r = ev.currentTarget.getBoundingClientRect();
              const mitad = r.top + r.height / 2;
              if (desde > i ? ev.clientY > mitad : ev.clientY < mitad) return;
              reordenar(desde, i);
            }}
            onDrop={(ev) => ev.preventDefault()}
            onDragEnd={() => {
              desdeAgarre.current = false;
              tomado.current = null;
              setMovido(null);
              guardar(orden);
            }}
          >
            <div className="os-herramienta-cabeza">
              {/* El agarre queda afuera del botón: adentro, tomarlo para
                  arrastrar abría y cerraba la tarjeta. */}
              <span
                className="os-herramienta-agarre"
                title="Arrastrar para cambiar el orden"
                aria-hidden="true"
              >
                ⠿
              </span>
              <button
                type="button"
                className="os-herramienta-abrir"
                aria-expanded={abiertos.includes(tests[indice])}
                onClick={() => plegar(tests[indice])}
              >
                <span className="os-herramienta-numero" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="os-herramienta-texto">
                  {nombres?.[indice] ?? tests[indice]}
                </h3>
              </button>

              {/* El estado va afuera del botón que pliega: el de los tests de
                  papel es a su vez un botón, y un botón adentro de otro no es
                  HTML válido (React lo rechaza al hidratar). */}
              <span className="os-herramienta-estado">{estados[indice]}</span>

              <button
                type="button"
                className="os-herramienta-flecha-boton"
                aria-label={abiertos.includes(tests[indice]) ? 'Plegar' : 'Desplegar'}
                onClick={() => plegar(tests[indice])}
              >
                <svg
                  className={`os-herramienta-flecha${
                    abiertos.includes(tests[indice]) ? ' abierta' : ''
                  }`}
                  viewBox="0 0 10 6"
                  aria-hidden="true"
                >
                  <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>
            {/* Desplegado, una línea separa el título de lo que cuelga: sin
                ella la tarjeta abierta se lee como un bloque continuo y no se
                ve dónde termina el encabezado. */}
            {abiertos.includes(tests[indice]) && (
              <div className="os-herramienta-cuerpo">{tarjetas[indice]}</div>
            )}
          </section>
        ))}
      </div>
      {error && <p className="os-form-error">{error}</p>}
    </>
  );
}
