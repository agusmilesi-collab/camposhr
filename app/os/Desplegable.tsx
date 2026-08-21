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
 * lo sigue mientras está abierta. Si abajo no hay lugar, sale hacia arriba.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type OpcionDesplegable = {
  valor: string;
  texto: string;
  /** La clase del punto: `os-verde`, `os-ambar`, `os-azul`… */
  color?: string;
};

/** Cuánto puede medir la lista antes de tener que desplazarse por dentro. */
const ALTO_MAXIMO = 320;
const AIRE = 4;

/**
 * De quién cuelga la lista: del contenedor del OS, que trae sus colores y no
 * recorta. El body queda de reserva por si algún día esto se usa afuera.
 */
function anfitrion(): Element | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.os') ?? document.body;
}

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
  const [sitio, setSitio] = useState<{ top: number; left: number; ancho: number } | null>(null);
  const caja = useRef<HTMLSpanElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLSpanElement>(null);

  /**
   * Dónde cae la lista: debajo del botón, o encima si abajo no hay lugar.
   *
   * Colgada del `body` no se mueve con lo que hay debajo, así que hay que
   * seguir al botón por dos caminos a la vez. Los eventos de `scroll` (en fase
   * de captura, que es la única forma de enterarse cuando lo que se desplaza es
   * un contenedor de adentro y no la ventana) y un bucle por cuadro, que agarra
   * lo que no avisa: una fila que crece, un panel que se pliega, la barra
   * lateral que se abre. El bucle se detiene solo con la pestaña en segundo
   * plano, que es justo cuando no hay nada que corregir.
   *
   * Si el botón se fue de la pantalla, la lista se cierra: quedarse abierta
   * apuntando a una fila que ya no está a la vista es un menú fantasma.
   */
  useLayoutEffect(() => {
    if (!abierta) return;
    let vivo = true;
    let ultimo = '';
    const ubicar = () => {
      const b = boton.current?.getBoundingClientRect();
      if (!b) return;
      if (b.bottom < 0 || b.top > window.innerHeight) {
        setAbierta(false);
        return;
      }
      const alto = Math.min(lista.current?.scrollHeight || ALTO_MAXIMO, ALTO_MAXIMO);
      const abajo = window.innerHeight - b.bottom - AIRE;
      const haciaArriba = abajo < alto && b.top - AIRE > abajo;
      const sitio = {
        top: haciaArriba ? Math.max(AIRE, b.top - alto - AIRE) : b.bottom + AIRE,
        left: b.left,
        ancho: b.width,
      };
      // Solo se avisa cuando algo cambió: si no, es un render por cuadro.
      const firma = `${Math.round(sitio.top)}|${Math.round(sitio.left)}|${Math.round(sitio.ancho)}`;
      if (firma === ultimo) return;
      ultimo = firma;
      setSitio(sitio);
    };
    const porCuadro = () => {
      if (!vivo) return;
      ubicar();
      requestAnimationFrame(porCuadro);
    };
    porCuadro();
    window.addEventListener('scroll', ubicar, true);
    window.addEventListener('resize', ubicar);
    return () => {
      vivo = false;
      window.removeEventListener('scroll', ubicar, true);
      window.removeEventListener('resize', ubicar);
    };
  }, [abierta]);

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
