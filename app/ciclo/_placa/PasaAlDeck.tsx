'use client';

import { useEffect } from 'react';

/**
 * Para las pantallas que van adentro de una placa del deck.
 *
 * El deck pasa de placa con un click (mitad izquierda atrás, mitad derecha
 * adelante) y con las flechas. Pero la pantalla con datos es otra página metida
 * en un marco, y el click o la tecla que caen ahí los recibe el marco: el deck
 * nunca se entera y la placa no avanza. Esto se los reenvía.
 *
 * Los botones, enlaces y campos se quedan adentro: "Mostrar la 2ª" y
 * "Reclamar pozo" tienen que hacer lo suyo y no pasar de placa.
 */
export default function PasaAlDeck() {
  useEffect(() => {
    if (window.parent === window) return;

    function click(e: MouseEvent) {
      const el = e.target as Element | null;
      if (el?.closest('a, button, input, select, textarea, label')) return;
      window.parent.postMessage({ deck: 'click', x: e.clientX }, '*');
    }
    function tecla(e: KeyboardEvent) {
      const el = e.target as Element | null;
      if (el?.closest('input, textarea, select')) return;
      window.parent.postMessage({ deck: 'tecla', key: e.key }, '*');
      if (['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' '].includes(e.key)) {
        e.preventDefault();
      }
    }
    document.addEventListener('click', click);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('keydown', tecla);
    };
  }, []);

  return null;
}
