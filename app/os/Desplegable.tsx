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
 *
 * **La lista se dibuja fuera de la página, colgada de `.os`.** Adentro la
 * recortaban tres cajas con `overflow: hidden` (la celda, el marco de la tabla
 * y el panel) y en la última fila de una tabla no se veía ninguna opción. De
 * `.os` y no del `body` porque ahí viven los colores del OS: colgada del body
 * salía sin fondo, y en Cotizaciones se leía la tarjeta de atrás a través de
 * las opciones. `.os` es hijo directo del body y no recorta nada, así que sirve
 * igual para escaparse. Ya afuera se ubica a mano, con las medidas del botón, y
 * lo sigue mientras está abierta. Si abajo no hay lugar, sale hacia arriba. Eso
 * lo resuelve `useAnclaje`, en `app/os/anclar.ts`, que es el mismo anclaje que
 * usa el selector de códigos del protocolo.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { anfitrion, useAnclaje } from './anclar';

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
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLSpanElement>(null);

  const sitio = useAnclaje(abierta, boton, lista, () => setAbierta(false));

  useEffect(() => {
    if (!abierta) return;
    const afuera = (e: MouseEvent) => {
      const blanco = e.target as Node;
      if (!caja.current?.contains(blanco) && !lista.current?.contains(blanco)) setAbierta(false);
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

  const desplegada = (
    <span
      className="os-desplegable-lista"
      role="listbox"
      ref={lista}
      style={{
        position: 'fixed',
        top: sitio?.top ?? -9999,
        left: sitio?.left ?? -9999,
        minWidth: Math.max(sitio?.ancho ?? 0, 190),
        visibility: sitio ? 'visible' : 'hidden',
      }}
    >
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
  );

  return (
    <span
      className="os-desplegable"
      ref={caja}
      style={ancho ? ({ '--os-desplegable-ancho': `${ancho}px` } as React.CSSProperties) : undefined}
    >
      <button
        type="button"
        ref={boton}
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

      {abierta && anfitrion() && createPortal(desplegada, anfitrion() as Element)}
    </span>
  );
}
