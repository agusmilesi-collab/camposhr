'use client';

import { useEffect, useRef, useState } from 'react';

type Lamina = { lamina: string; areas: string[] };

/**
 * El índice: las diez láminas y, debajo, las áreas de la que está elegida.
 *
 * Tocar una lámina deja en pantalla solo esa lámina, y tocar un área deja solo
 * las respuestas de esa área. "Todas" (o tocar de nuevo lo elegido) vuelve a
 * mostrar todo. Sin nada elegido, la lámina activa es la que está en pantalla
 * al bajar, así las áreas de abajo son siempre las de lo que se está leyendo.
 */
export default function Indice({ laminas }: { laminas: Lamina[] }) {
  const [activa, setActiva] = useState(laminas[0]?.lamina ?? '');
  /** Si se eligió una lámina: entonces es la única que se ve. */
  const [elegida, setElegida] = useState(false);
  /** El área que se dejó sola, como "IV-8" (lámina y orden del bloque). */
  const [sola, setSola] = useState<string | null>(null);
  const elegidaAhora = useRef(elegida);
  elegidaAhora.current = elegida;

  // Lo elegido se ve desde el principio de la página, con el título y el
  // buscador: bajar hasta la tabla los dejaba fuera de la pantalla.
  const arriba = () => window.scrollTo({ top: 0 });

  function elegirLamina(l: string) {
    const quitar = elegida && activa === l && !sola;
    setActiva(l);
    setElegida(!quitar);
    setSola(null);
    arriba();
  }

  function verTodas() {
    setElegida(false);
    setSola(null);
    arriba();
  }

  function elegirArea(id: string) {
    setSola((s) => (s === id ? null : id));
    setElegida(true);
    arriba();
  }

  useEffect(() => {
    const secciones = [...document.querySelectorAll<HTMLElement>('[data-cf-lamina]')];
    const visto = new IntersectionObserver(
      (entradas) => {
        if (elegidaAhora.current) return;
        // La más alta de las que cruzan la franja de arriba de la pantalla.
        const primera = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (primera) setActiva((primera.target as HTMLElement).dataset.cfLamina ?? '');
      },
      { rootMargin: '-140px 0px -60% 0px' }
    );
    secciones.forEach((s) => visto.observe(s));
    return () => visto.disconnect();
  }, []);

  const areas = laminas.find((l) => l.lamina === activa)?.areas ?? [];

  return (
    <nav className="os-cf-indice" aria-label="Láminas y áreas">
      <span className="os-cf-indice-rotulo">Lámina</span>
      <div className="os-cf-indice-laminas">
        <button type="button" className="os-cf-todas" aria-pressed={!elegida} onClick={verTodas}>
          Todas
        </button>
        {laminas.map((l) => (
          <button
            key={l.lamina}
            type="button"
            data-cf-indice={l.lamina}
            aria-pressed={elegida && l.lamina === activa}
            aria-current={!elegida && l.lamina === activa ? 'true' : undefined}
            onClick={() => elegirLamina(l.lamina)}
          >
            {l.lamina}
          </button>
        ))}
      </div>
      <span className="os-cf-indice-rotulo">Área</span>
      {/* En dos filas con la misma cantidad, la primera con la mitad
          redondeada para arriba, y del mismo ancho que la fila de láminas. */}
      <div
        className="os-cf-indice-areas"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(areas.length / 2))}, minmax(0, 1fr))` }}
      >
        {areas.map((a, i) => {
          const id = `${activa}-${i}`;
          return (
            <button key={a} type="button" aria-pressed={sola === id} onClick={() => elegirArea(id)}>
              {a}
            </button>
          );
        })}
      </div>
      {/* Lo que no se eligió se esconde con una regla y no con `hidden`, así
          no se pisa con lo que esconde el buscador. */}
      {elegida && (
        <style>{`
          #os-cf-laminas [data-cf-lamina]:not([data-cf-lamina="${activa}"]) { display: none !important; }
          ${
            sola
              ? `#os-cf-laminas [data-cf-area]:not(#area-${sola}) { display: none !important; }
                 #area-${sola} { break-inside: auto; }
                 #area-${sola} h3 { column-span: all; }`
              : ''
          }
        `}</style>
      )}
    </nav>
  );
}
