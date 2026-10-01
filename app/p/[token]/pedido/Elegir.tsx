'use client';

/**
 * El desplegable del portal: un botón con lo elegido y, al tocarlo, la lista
 * con nuestro estilo debajo.
 *
 * El `select` del navegador abre una lista que dibuja el sistema operativo, y
 * no se le puede dar forma: al lado de las tarjetas del formulario se veía de
 * otra aplicación. Es la misma idea que el desplegable del OS (`Desplegable`),
 * escrita para el portal, que no carga los estilos ni el contenedor del OS.
 *
 * Se cierra tocando afuera o con Escape, y se maneja con el teclado: flechas
 * para moverse y Enter para elegir.
 */

import { useEffect, useRef, useState } from 'react';

export type OpcionElegir = { valor: string; texto: string; detalle?: string };

export default function Elegir({
  valor,
  opciones,
  alElegir,
  vacio,
  etiqueta,
  deshabilitado = false,
}: {
  valor: string;
  opciones: OpcionElegir[];
  alElegir: (valor: string) => void;
  /** Lo que dice mientras no hay nada elegido. */
  vacio: string;
  /** Qué se elige, para el lector de pantalla. */
  etiqueta: string;
  deshabilitado?: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const [foco, setFoco] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const elegida = opciones.find((o) => o.valor === valor) ?? null;

  useEffect(() => {
    if (!abierta) return;
    const afuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener('mousedown', afuera);
    return () => document.removeEventListener('mousedown', afuera);
  }, [abierta]);

  function abrir() {
    if (deshabilitado || opciones.length === 0) return;
    setFoco(
      Math.max(
        0,
        opciones.findIndex((o) => o.valor === valor),
      ),
    );
    setAbierta(true);
  }

  function elegir(v: string) {
    alElegir(v);
    setAbierta(false);
  }

  return (
    <div
      className={`pedir-elegir${abierta ? ' abierta' : ''}`}
      ref={caja}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setAbierta(false);
        if (!abierta && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          abrir();
          return;
        }
        if (!abierta) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFoco((f) => Math.min(opciones.length - 1, f + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFoco((f) => Math.max(0, f - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (opciones[foco]) elegir(opciones[foco].valor);
        }
      }}
    >
      <button
        type="button"
        className={`pedir-elegir-boton${elegida ? '' : ' vacio'}`}
        aria-haspopup="listbox"
        aria-expanded={abierta}
        aria-label={etiqueta}
        disabled={deshabilitado || opciones.length === 0}
        onClick={() => (abierta ? setAbierta(false) : abrir())}
      >
        <span className="pedir-elegir-texto">{elegida?.texto ?? vacio}</span>
        <span className="pedir-elegir-flecha" aria-hidden="true" />
      </button>

      {abierta && (
        <ul className="pedir-elegir-lista" role="listbox" aria-label={etiqueta}>
          {opciones.map((o, i) => (
            <li
              key={o.valor}
              role="option"
              aria-selected={o.valor === valor}
              className={`pedir-elegir-opcion${o.valor === valor ? ' elegida' : ''}${
                i === foco ? ' foco' : ''
              }`}
              onMouseEnter={() => setFoco(i)}
              onMouseDown={(e) => {
                // Antes de que el botón pierda el foco y la lista se cierre.
                e.preventDefault();
                elegir(o.valor);
              }}
            >
              <span>{o.texto}</span>
              {o.detalle && <small>{o.detalle}</small>}
              {o.valor === valor && (
                <span className="pedir-elegir-tilde" aria-hidden="true">
                  ✓
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
