/**
 * Dónde se dibuja una burbuja colgada al lado de lo que se tocó.
 *
 * La usan las dos zonas: el calendario del OS y el del inquilino. El mecanismo
 * es el mismo (seguir al ancla mientras está abierta, cerrarse al tocar afuera)
 * y el marcado no, porque cada zona tiene su hoja de estilo y su contenedor.
 * Así que acá vive lo que se repetiría y afuera queda lo que de verdad cambia.
 *
 * **El anclaje sigue al ancla por dos caminos a la vez**, como
 * `app/os/anclar.ts`: los eventos de `scroll` en fase de captura, que es lo
 * único que se entera cuando lo que se desplaza es un contenedor de adentro, y
 * un bucle por cuadro para lo que no avisa (una fila que crece, un panel que se
 * pliega). La selección crece mientras se arrastra, así que la posición del
 * ancla se vuelve a preguntar en cada vuelta.
 */

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

const AIRE = 10;

export type Sitio = { top: number; left: number; lado: 'derecha' | 'izquierda'; punta: number };

export function useBurbuja(
  ancla: () => DOMRect | null,
  cerrar: () => void
): { caja: RefObject<HTMLDivElement>; sitio: Sitio | null } {
  const caja = useRef<HTMLDivElement>(null);
  const [sitio, setSitio] = useState<Sitio | null>(null);

  useLayoutEffect(() => {
    let vivo = true;
    let ultimo = '';
    const ubicar = () => {
      const a = ancla();
      const c = caja.current;
      if (!a || !c) return;
      // Fuera de la vista se cierra: una burbuja apuntando a una fila que ya no
      // está a la vista queda flotando sin decir a qué.
      if (a.bottom < 0 || a.top > window.innerHeight) {
        cerrar();
        return;
      }
      const ancho = c.offsetWidth;
      const alto = c.offsetHeight;
      // A la derecha del ancla; si no entra, a la izquierda.
      const entraDerecha = a.right + AIRE + ancho < window.innerWidth;
      const lado: Sitio['lado'] = entraDerecha ? 'derecha' : 'izquierda';
      const left = entraDerecha ? a.right + AIRE : Math.max(AIRE, a.left - AIRE - ancho);
      const centro = a.top + a.height / 2;
      const top = Math.max(AIRE, Math.min(centro - alto / 2, window.innerHeight - alto - AIRE));
      // La punta apunta al centro del ancla y no al de la burbuja: con la
      // burbuja corrida para que entre en la ventana, las dos cosas dejan de
      // coincidir y la punta es la que dice a qué hora corresponde.
      const punta = Math.min(Math.max(centro - top, 18), alto - 18);
      const firma = `${Math.round(top)}|${Math.round(left)}|${lado}|${Math.round(punta)}`;
      if (firma === ultimo) return;
      ultimo = firma;
      setSitio({ top, left, lado, punta });
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
    // `cerrar` y `ancla` se rehacen en cada dibujo del padre y no son lo que
    // dispara esto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Se cierra al tocar afuera y con Escape, como cualquier menú.
   *
   * **El primer toque de afuera solo cierra.** Va en fase de captura y se come
   * el evento: sin eso, tocar otra hora cerraba esta burbuja y abría la
   * siguiente en el mismo gesto, así que para volver a la grilla había que
   * apuntarle a la ×.
   *
   * Frenar el `pointerdown` no alcanza, porque el `click` sale igual: hay que
   * comerse también ese, una sola vez.
   */
  useEffect(() => {
    const afuera = (e: Event) => {
      if (caja.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      const unaVez = (c: Event) => {
        c.preventDefault();
        c.stopPropagation();
      };
      document.addEventListener('click', unaVez, { capture: true, once: true });
      // Un gesto que no termina en clic (arrastrar hacia otra ventana) dejaría
      // ese oyente esperando para siempre.
      setTimeout(() => document.removeEventListener('click', unaVez, true), 400);
      cerrar();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    // Con un cuadro de espera: el mismo gesto que la abre llegaría al documento
    // y la cerraría en el acto.
    const id = setTimeout(() => document.addEventListener('pointerdown', afuera, true), 0);
    document.addEventListener('keydown', escape);
    return () => {
      clearTimeout(id);
      document.removeEventListener('pointerdown', afuera, true);
      document.removeEventListener('keydown', escape);
    };
  }, [cerrar]);

  return { caja, sitio };
}
