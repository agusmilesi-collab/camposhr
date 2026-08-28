'use client';

/**
 * El informe del cliente, como página.
 *
 * Se leía como un PDF puesto en pantalla: un documento largo que se recorre de
 * arriba abajo. Quien lo abre está decidiendo una contratación y llega con una
 * pregunta: si esta persona va para el puesto. Después, según quién sea, quiere
 * ver una cosa distinta (el líder quiere saber cómo trabajarla, la gerencia
 * quiere el número, la psicóloga del cliente quiere el protocolo).
 *
 * Por eso es un índice fijo a la izquierda y las secciones a la derecha: se
 * entra por la recomendación y desde ahí se va a lo que cada uno necesita. El
 * índice marca dónde está parado el lector mientras se desplaza.
 *
 * **El PDF sigue siendo el PDF.** Lo que se descarga es el documento de
 * siempre, que está dibujado en esta misma página y escondido hasta que alguien
 * imprime: la lectura en pantalla y el papel son dos cosas distintas y cada una
 * está resuelta por separado.
 */

import { useEffect, useRef, useState } from 'react';

/** Lo que se puede bajar, y qué parte del documento imprime cada una. */
const BAJADAS = [
  {
    clave: 'recomendacion',
    titulo: 'Recomendación firmada',
    bajada: 'El semáforo, la fundamentación y la firma. Una hoja.',
  },
  {
    clave: 'fundamentos',
    titulo: 'Fundamentos',
    bajada: 'Competencias, análisis, estilos de pensamiento y potencial.',
  },
  {
    clave: 'indicadores',
    titulo: 'Indicadores',
    bajada: 'Los valores medidos, sin interpretar y sin colores.',
  },
] as const;

type Bajada = (typeof BAJADAS)[number]['clave'];

export default function Sitio({
  volver,
  cabecera,
  indice,
  cuerpo,
  documento,
  muestra = false,
}: {
  volver: string;
  /** Quién es, para qué puesto y quién lo pidió. */
  cabecera: React.ReactNode;
  /** El índice, ya armado: {id, numero, titulo}. */
  indice: { id: string; numero: string; titulo: string }[];
  /** Las secciones dibujadas, en orden. */
  cuerpo: React.ReactNode;
  /** El documento imprimible, escondido en pantalla. */
  documento: React.ReactNode;
  muestra?: boolean;
}) {
  const [aqui, setAqui] = useState(indice[0]?.id ?? '');
  const [abierto, setAbierto] = useState(false);
  const [elegidas, setElegidas] = useState<Bajada[]>(['recomendacion']);
  const [aviso, setAviso] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  /*
   * En qué sección está parado el lector.
   *
   * Con un observador y no midiendo posiciones en cada desplazamiento: el
   * navegador avisa cuando una sección entra o sale, y la cuenta la hace él.
   * El margen de arriba descuenta la barra, que si no la sección que está
   * debajo de la barra cuenta como visible.
   */
  useEffect(() => {
    const vistas = new Set<string>();
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) vistas.add(e.target.id);
          else vistas.delete(e.target.id);
        }
        // La primera de las visibles en el orden del índice: si hay dos a la
        // vez, la de arriba es donde está leyendo.
        const primera = indice.find((s) => vistas.has(s.id));
        if (primera) setAqui(primera.id);
      },
      { rootMargin: '-96px 0px -60% 0px' }
    );
    for (const s of indice) {
      const nodo = document.getElementById(s.id);
      if (nodo) obs.observe(nodo);
    }
    return () => obs.disconnect();
  }, [indice]);

  /* El panel de descarga se cierra al tocar fuera o con Escape. */
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  function ir(id: string) {
    const nodo = document.getElementById(id);
    if (!nodo) return;
    nodo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAqui(id);
    history.replaceState(null, '', `#${id}`);
  }

  function alternar(c: Bajada) {
    setElegidas((antes) =>
      antes.includes(c) ? antes.filter((x) => x !== c) : [...antes, c]
    );
  }

  function descargar() {
    if (elegidas.length === 0) return;
    setAbierto(false);
    if (muestra) {
      setAviso(true);
      return;
    }
    /* El navegador imprime lo que ve, y la pintura del cambio de clases no
       terminó cuando se llama a `print` en el mismo paso. */
    requestAnimationFrame(() => window.print());
  }

  /** La primera de las elegidas no lleva salto de página adelante. */
  const primera = BAJADAS.map((b) => b.clave).find((c) => elegidas.includes(c));

  return (
    <div className="sitio" data-imprimir={elegidas.join(' ')} data-primera={primera ?? ''}>
      <header className="sitio-barra">
        <a className="sitio-volver" href={volver}>
          ← Volver
        </a>
        <div className="sitio-bajar" ref={caja}>
          <button
            type="button"
            className="sitio-boton"
            aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
          >
            Descargar en PDF
          </button>
          {abierto && (
            <div className="sitio-bajar-panel" role="dialog" aria-label="Qué descargar">
              <p className="sitio-bajar-titulo">Qué querés descargar</p>
              {BAJADAS.map((b) => (
                <label key={b.clave} className="sitio-bajar-opcion">
                  <input
                    type="checkbox"
                    checked={elegidas.includes(b.clave)}
                    onChange={() => alternar(b.clave)}
                  />
                  <span>
                    <strong>{b.titulo}</strong>
                    <em>{b.bajada}</em>
                  </span>
                </label>
              ))}
              <div className="sitio-bajar-pie">
                <button
                  type="button"
                  className="sitio-enlace"
                  onClick={() => setElegidas(BAJADAS.map((b) => b.clave))}
                >
                  Todo junto
                </button>
                <button
                  type="button"
                  className="sitio-boton"
                  disabled={elegidas.length === 0}
                  onClick={descargar}
                >
                  Descargar
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {aviso && (
        <p className="sitio-aviso-descarga" role="status">
          En el informe de muestra la descarga está desactivada. En el tuyo el botón
          guarda el PDF de lo que hayas elegido.
        </p>
      )}

      <div className="sitio-hoja">
        {cabecera}

        <div className="sitio-cuerpo">
          {/* El índice se queda a la vista mientras se lee: es desde donde se
              salta a lo que cada lector necesita. */}
          <nav className="sitio-indice" aria-label="Secciones del informe">
            <p className="sitio-indice-titulo">El informe</p>
            <ul>
              {indice.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`sitio-indice-item${aqui === s.id ? ' aqui' : ''}`}
                    aria-current={aqui === s.id ? 'true' : undefined}
                    onClick={() => ir(s.id)}
                  >
                    <span className="sitio-indice-n">{s.numero}</span>
                    {s.titulo}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <main className="sitio-secciones">{cuerpo}</main>
        </div>
      </div>

      {/* El documento que se imprime. En pantalla no está; al imprimir sale
          solo lo que se eligió, y el sitio no. */}
      <div className="sitio-imprimible" aria-hidden="true">
        {documento}
      </div>
    </div>
  );
}
