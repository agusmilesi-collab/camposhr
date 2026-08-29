'use client';

/**
 * Dónde cae una lista que cuelga fuera de la página.
 *
 * La usan los dos desplegables del OS: el de siempre y el de los códigos del
 * protocolo. Los dos dibujan su lista colgada de `.os` para escaparse de los
 * `overflow: hidden` de la celda, la tabla y el panel, y los dos tienen que
 * seguir a su botón mientras la lista está abierta.
 *
 * Colgada afuera, la lista no se mueve con lo que hay debajo, así que hay que
 * seguir al botón por dos caminos a la vez: los eventos de `scroll` en fase de
 * captura, que es la única forma de enterarse cuando lo que se desplaza es un
 * contenedor de adentro y no la ventana, y un bucle por cuadro, que agarra lo
 * que no avisa (una fila que crece, un panel que se pliega, la barra lateral
 * que se abre). El bucle se detiene solo con la pestaña en segundo plano, que
 * es justo cuando no hay nada que corregir.
 *
 * Si el botón se fue de la pantalla, la lista se cierra: quedarse abierta
 * apuntando a una fila que ya no está a la vista es un menú fantasma.
 */

import { useLayoutEffect, useState, type RefObject } from 'react';

/** Cuánto puede medir la lista antes de tener que desplazarse por dentro. */
export const ALTO_MAXIMO = 320;
const AIRE = 4;

export type Sitio = { top: number; left: number; ancho: number };

/** De quién cuelga la lista: del contenedor del OS, que trae sus colores y no
 *  recorta. El body queda de reserva por si algún día esto se usa afuera. */
export function anfitrion(): Element | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.os') ?? document.body;
}

export function useAnclaje(
  abierta: boolean,
  boton: RefObject<HTMLElement>,
  lista: RefObject<HTMLElement>,
  cerrar: () => void,
  /** Lo mínimo que mide la lista, para decidir si entra abajo o va arriba. */
  altoMaximo = ALTO_MAXIMO
): Sitio | null {
  const [sitio, setSitio] = useState<Sitio | null>(null);

  useLayoutEffect(() => {
    if (!abierta) {
      setSitio(null);
      return;
    }
    let vivo = true;
    let ultimo = '';
    const ubicar = () => {
      const b = boton.current?.getBoundingClientRect();
      if (!b) return;
      if (b.bottom < 0 || b.top > window.innerHeight) {
        cerrar();
        return;
      }
      const alto = Math.min(lista.current?.scrollHeight || altoMaximo, altoMaximo);
      const abajo = window.innerHeight - b.bottom - AIRE;
      const haciaArriba = abajo < alto && b.top - AIRE > abajo;
      // La lista puede ser más ancha que su botón, y un botón cerca del borde
      // derecho la mandaba a la mitad afuera de la ventana.
      const ancho = Math.max(lista.current?.scrollWidth ?? 0, b.width);
      const nuevo = {
        top: haciaArriba ? Math.max(AIRE, b.top - alto - AIRE) : b.bottom + AIRE,
        left: Math.max(AIRE, Math.min(b.left, window.innerWidth - ancho - AIRE)),
        ancho: b.width,
      };
      // Solo se avisa cuando algo cambió: si no, es un render por cuadro.
      const firma = `${Math.round(nuevo.top)}|${Math.round(nuevo.left)}|${Math.round(nuevo.ancho)}`;
      if (firma === ultimo) return;
      ultimo = firma;
      setSitio(nuevo);
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
    // `cerrar` se rehace en cada dibujo del padre y no es lo que dispara esto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, altoMaximo]);

  return sitio;
}
