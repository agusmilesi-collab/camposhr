'use client';

/**
 * El informe del cliente, en tres profundidades.
 *
 * El mismo informe contesta tres preguntas distintas según quién lo abra, y
 * quien decide una contratación no necesita leer las tres:
 *
 * 1. **Recomendación**: qué se recomienda y por qué, escrito y firmado por la
 *    evaluadora. Entra en una hoja y es lo que se lee antes de decidir.
 * 2. **Fundamentos**: en qué se apoya. Competencias, análisis, lo que le
 *    conviene a su líder, estilos de pensamiento y potencial.
 * 3. **Indicadores**: los valores medidos, sin interpretar y sin colores.
 *
 * Las tres están dibujadas desde el primer momento y se muestra una: son el
 * mismo documento partido, y armarlas al entrar a cada una obligaría a volver
 * al servidor para leer algo que ya está.
 *
 * **De descargar se elige qué.** El cliente que va a archivar el legajo baja
 * las tres; el que la manda al líder de la búsqueda baja la recomendación
 * sola. La impresión sale del navegador, así que lo que se elige es qué partes
 * quedan visibles mientras imprime: `data-imprimir` las nombra y la hoja de
 * estilos esconde el resto.
 */

import { useEffect, useRef, useState } from 'react';

const PARTES = [
  {
    clave: 'recomendacion',
    titulo: 'Recomendación',
    bajada: 'Qué se recomienda y por qué, firmado.',
  },
  {
    clave: 'fundamentos',
    titulo: 'Fundamentos',
    bajada: 'Competencias, análisis, estilos de pensamiento y potencial.',
  },
  {
    clave: 'indicadores',
    titulo: 'Indicadores',
    bajada: 'Los valores medidos, sin interpretar.',
  },
] as const;

type Clave = (typeof PARTES)[number]['clave'];

export default function Partes({
  volver,
  cabecera,
  pie,
  recomendacion,
  fundamentos,
  indicadores,
  muestra = false,
}: {
  /** A dónde vuelve el cliente: su portal. */
  volver: string;
  /**
   * La marca y quién es, arriba de las tres pestañas.
   *
   * Va una vez y no en cada parte: el nombre, el puesto y la fecha no cambian
   * al pasar de la recomendación a los indicadores, y repetirlos en cada
   * pestaña es la forma de un PDF y no la de una página.
   */
  cabecera: React.ReactNode;
  /** El pie del estudio, también una vez y al final de todo. */
  pie: React.ReactNode;
  recomendacion: React.ReactNode;
  fundamentos: React.ReactNode;
  indicadores: React.ReactNode;
  /** En la muestra el botón está a la vista y no baja nada. */
  muestra?: boolean;
}) {
  const [viendo, setViendo] = useState<Clave>('recomendacion');

  /*
   * La pestaña también vive en la dirección.
   *
   * Es una página y no un PDF: el enlace que alguien copie tiene que abrir la
   * parte que estaba mirando, y el botón de atrás del navegador tiene que
   * volver a la anterior. Se lee al montarse y no en el servidor, porque la
   * página se dibuja igual para las tres.
   */
  useEffect(() => {
    const dela = () => {
      const q = new URLSearchParams(window.location.search).get('ver');
      return PARTES.some((p) => p.clave === q) ? (q as Clave) : 'recomendacion';
    };
    setViendo(dela());
    const atras = () => setViendo(dela());
    window.addEventListener('popstate', atras);
    return () => window.removeEventListener('popstate', atras);
  }, []);

  function mirar(c: Clave) {
    setViendo(c);
    setAbierto(false);
    const url = new URL(window.location.href);
    url.searchParams.set('ver', c);
    window.history.pushState(null, '', url);
    // Cambiar de parte empieza de arriba: si no, se cae en la mitad de la
    // parte nueva, a la altura a la que se había llegado en la anterior.
    window.scrollTo({ top: 0 });
  }
  const [abierto, setAbierto] = useState(false);
  const [elegidas, setElegidas] = useState<Clave[]>(['recomendacion']);
  const [aviso, setAviso] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  /* El panel se cierra solo al tocar fuera o con Escape: tapa el informe, y sin
     esto había que volver al botón para sacarlo de encima. */
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

  const cuerpos: Record<Clave, React.ReactNode> = {
    recomendacion,
    fundamentos,
    indicadores,
  };

  /* Al abrir el panel se propone lo que se está mirando: el pedido más común es
     bajar la parte que uno tiene delante, y tenerla ya tildada evita el paso de
     buscarla en una lista de tres. */
  function abrir() {
    setElegidas([viendo]);
    setAviso(false);
    setAbierto(true);
  }

  function alternar(c: Clave) {
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
       terminó todavía cuando se llama a `print` en el mismo paso. */
    requestAnimationFrame(() => window.print());
  }

  /** La primera de las elegidas no lleva salto de página adelante. */
  const primera = PARTES.map((p) => p.clave).find((c) => elegidas.includes(c));

  return (
    <div className="pinf-partes" data-imprimir={elegidas.join(' ')}>
      <div className="pinf-barra">
        <a className="pinf-volver" href={volver}>
          ← Volver
        </a>
        <nav className="pinf-tabs" aria-label="Profundidad del informe">
          {PARTES.map((p) => (
            <button
              key={p.clave}
              type="button"
              className={`pinf-tab${viendo === p.clave ? ' viva' : ''}`}
              aria-current={viendo === p.clave ? 'page' : undefined}
              onClick={() => mirar(p.clave)}
            >
              {p.titulo}
            </button>
          ))}
        </nav>

        <div className="pinf-bajar" ref={caja}>
          <button
            type="button"
            className="pinf-descargar"
            aria-expanded={abierto}
            onClick={() => (abierto ? setAbierto(false) : abrir())}
          >
            Descargar en PDF
          </button>
          {abierto && (
            <div className="pinf-bajar-panel" role="dialog" aria-label="Qué descargar">
              <p className="pinf-bajar-titulo">Qué querés descargar</p>
              {PARTES.map((p) => (
                <label key={p.clave} className="pinf-bajar-opcion">
                  <input
                    type="checkbox"
                    checked={elegidas.includes(p.clave)}
                    onChange={() => alternar(p.clave)}
                  />
                  <span>
                    <strong>{p.titulo}</strong>
                    <em>{p.bajada}</em>
                  </span>
                </label>
              ))}
              <div className="pinf-bajar-pie">
                <button
                  type="button"
                  className="pinf-bajar-todas"
                  onClick={() => setElegidas(PARTES.map((p) => p.clave))}
                >
                  Las tres
                </button>
                <button
                  type="button"
                  className="pinf-descargar"
                  disabled={elegidas.length === 0}
                  onClick={descargar}
                >
                  Descargar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {aviso && (
        <p className="pinf-aviso-descarga" role="status">
          En el informe de muestra la descarga está desactivada. En el tuyo el botón
          guarda el PDF de lo que hayas elegido.
        </p>
      )}

      {/* Una sola hoja para las tres pestañas, con la marca y el encabezado
          arriba y el pie abajo: lo que cambia al tocar una pestaña es el
          contenido, como en cualquier página. */}
      <article className="inf pinf-hoja">
        {cabecera}
        {PARTES.map((p) => (
          <section
            key={p.clave}
            className={`pinf-parte${viendo === p.clave ? ' viva' : ''}${
              primera === p.clave ? ' primera' : ''
            }`}
            data-parte={p.clave}
          >
            {cuerpos[p.clave]}
          </section>
        ))}
        {pie}
      </article>
    </div>
  );
}
