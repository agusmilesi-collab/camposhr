'use client';

import { useEffect, useRef } from 'react';

/**
 * Iguala el alto de las tarjetas plegadas de una lista.
 *
 * Cerradas muestran el código, el precio, el título y la bajada, y cada una
 * mide según lo que ocupen su título y su bajada. Con CSS solo no hay forma de
 * igualar tarjetas apiladas sin que la abierta estire a las demás, así que se
 * mide la cabeza de cada una (`.precios-plegada`) y todas toman el alto de la
 * más alta. Se vuelve a medir cuando cambia el ancho de la lista, porque en el
 * teléfono los títulos ocupan más renglones.
 */
export function IgualarTarjetas() {
  const marca = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const lista = marca.current?.parentElement;
    if (!lista) return;

    const igualar = () => {
      const cabezas = Array.from(lista.querySelectorAll<HTMLElement>('.precios-plegada'));
      cabezas.forEach((c) => (c.style.minHeight = ''));
      const alto = Math.max(...cabezas.map((c) => c.offsetHeight));
      cabezas.forEach((c) => (c.style.minHeight = `${alto}px`));
    };

    igualar();
    // La serif del título llega después del primer dibujo y cambia los cortes.
    document.fonts?.ready.then(igualar);
    let ancho = lista.clientWidth;
    const observador = new ResizeObserver(() => {
      if (lista.clientWidth === ancho) return;
      ancho = lista.clientWidth;
      igualar();
    });
    observador.observe(lista);
    return () => observador.disconnect();
  }, []);

  return <span ref={marca} hidden />;
}
