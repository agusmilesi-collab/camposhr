'use client';

/**
 * El desplegable del OS: uno solo, para todas las pantallas.
 *
 * El del navegador no deja pintar sus opciones, y en este sistema media docena
 * de cosas se reconocen por su punto de color: la etapa de una evaluación, el
 * estado de una cotización, la conclusión de un informe. Con un `select` había
 * que elegir entre el color y poder cambiarlo.
 *
 * Se cierra al tocar afuera, con Escape, y al elegir. Mientras guarda queda
 * apagado, así dos toques seguidos no mandan dos cambios.
 *
 * Para un dato sin color (una modalidad, una batería) sirve igual: la opción
 * sin `color` sale sin punto.
 */

import { useEffect, useRef, useState } from 'react';

export type OpcionDesplegable = {
  valor: string;
  texto: string;
  /** La clase del punto: `os-verde`, `os-ambar`, `os-azul`… */
  color?: string;
};

export default function Desplegable({
  valor,
  opciones,
  alElegir,
  deshabilitado = false,
  etiqueta,
  vacio = 'Sin definir',
  ancho,
}: {
  valor: string;
  opciones: OpcionDesplegable[];
  alElegir: (valor: string) => void;
  deshabilitado?: boolean;
  /** Qué dice el lector de pantalla, y el título al pasar por encima. */
  etiqueta: string;
  /** Qué se muestra cuando no hay nada elegido. */
  vacio?: string;
  /** Cuánto mide, si tiene que entrar en una columna de ancho fijo. */
  ancho?: number;
}) {
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!abierta) return;
    const afuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierta(false);
    };
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(false);
    };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', teclado);
    };
  }, [abierta]);

  const elegida = opciones.find((o) => o.valor === valor);

  return (
    <span
      className="os-desplegable"
      ref={caja}
      style={ancho ? ({ '--os-desplegable-ancho': `${ancho}px` } as React.CSSProperties) : undefined}
    >
      <button
        type="button"
        className={`os-desplegable-boton os-sello-estado ${elegida?.color ?? 'os-sin-punto'}`}
        disabled={deshabilitado}
        aria-haspopup="listbox"
        aria-expanded={abierta}
        onClick={() => setAbierta((x) => !x)}
        title={etiqueta}
        aria-label={etiqueta}
      >
        <span className="os-desplegable-texto">{elegida?.texto ?? vacio}</span>
        <svg
          className={`os-desplegable-flecha${abierta ? ' abierta' : ''}`}
          viewBox="0 0 10 6"
          aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {abierta && (
        <span className="os-desplegable-lista" role="listbox">
          {opciones.map((o) => (
            <button
              key={o.valor}
              type="button"
              role="option"
              aria-selected={o.valor === valor}
              className={`os-desplegable-opcion os-sello-estado ${o.color ?? 'os-sin-punto'}${
                o.valor === valor ? ' elegida' : ''
              }`}
              onClick={() => {
                setAbierta(false);
                if (o.valor !== valor) alElegir(o.valor);
              }}
            >
              {o.texto}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
