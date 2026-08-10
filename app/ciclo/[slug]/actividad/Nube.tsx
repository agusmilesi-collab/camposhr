'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Las palabras del grupo, todas a la vista.
 *
 * El cuerpo se mide y no se estima, igual que el cartel del Match: se dibuja el
 * bloque a un cuerpo conocido, se mide lo que ocupó y se busca el más grande
 * que entre en el marco. Sin eso, treinta y tres palabras distintas piden todas
 * el cuerpo máximo a la vez y el bloque se corta: de la placa 6 de la charla 4
 * se veían ocho de treinta y tres.
 *
 * Las proporciones entre palabras las sigue dando la frecuencia. Lo que cambia
 * es la escala del conjunto, que ahora depende de cuántas son.
 */

export type Palabra = { texto: string; veces: number };

/** El cuerpo con el que se mide antes de escalar. Cualquiera sirve. */
const MEDIDA = 100;

/** Cuánto más chica es la palabra de una sola vez contra la más dicha. */
const PISO = 0.42;

export default function Nube({ palabras }: { palabras: Palabra[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cuerpo, setCuerpo] = useState<number | null>(null);

  const tope = Math.max(1, ...palabras.map((p) => p.veces));

  /*
   * La proyección se refresca sola cada cinco segundos. Sin una firma, el
   * efecto vuelve a medir en cada refresco aunque no haya entrado ninguna
   * palabra nueva: `palabras` es un arreglo distinto cada vez.
   */
  const firma = palabras.map((p) => `${p.texto}:${p.veces}`).join('|');

  /*
   * No de mayor a menor: ordenadas así, el bloque se lee como renglones de
   * texto que van bajando de cuerpo. Se acomodan del centro hacia afuera, así
   * las más dichas quedan en el medio y las de una sola vez arman el borde.
   */
  const desdeElCentro: Palabra[] = [];
  palabras.forEach((p, i) => {
    if (i % 2 === 0) desdeElCentro.push(p);
    else desdeElCentro.unshift(p);
  });

  /*
   * La raíz cuadrada y no la proporción directa: con proporción directa, una
   * palabra repetida cinco veces tapa la pantalla y las demás quedan
   * ilegibles. Y nunca baja del piso, para que la de una sola vez se lea desde
   * el fondo de la sala.
   */
  const peso = (veces: number) =>
    PISO + (1 - PISO) * Math.sqrt(veces / tope);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    /* El último marco contra el que se midió, para no medir dos veces lo
       mismo: `ajustar` cambia el cuerpo de la letra y el observador lo vuelve
       a llamar. */
    let medido = '';

    function ajustar() {
      if (!el) return;
      const caja = el.parentElement;
      if (!caja) return;

      const marco = `${caja.clientWidth}x${caja.clientHeight}`;
      if (marco === medido) return;

      /*
       * Un dos por ciento de aire. La medición es exacta, pero el bloque
       * pegado al borde del marco se lee como cortado desde el fondo de la
       * sala, y el pie con la cantidad de respuestas queda encima.
       */
      const disponible = caja.clientHeight * 0.98;
      // Sin marco todavía no hay contra qué medir, y tampoco queda anotado:
      // así el próximo aviso del observador vuelve a intentarlo.
      if (!disponible) return;
      medido = marco;

      /*
       * Bisección sobre el cuerpo: cuanto más grande, más alto queda el
       * bloque, así que hay un único punto donde deja de entrar. Doce vueltas
       * dejan el error abajo del píxel y corren una sola vez por render.
       */
      const entra = (px: number) => {
        el.style.fontSize = `${px}px`;
        return el.scrollHeight <= disponible && el.scrollWidth <= el.clientWidth + 1;
      };

      let bajo = 8;
      let alto = MEDIDA * 2;
      if (entra(alto)) {
        setCuerpo(alto);
        return;
      }
      for (let i = 0; i < 12; i += 1) {
        const medio = (bajo + alto) / 2;
        if (entra(medio)) bajo = medio;
        else alto = medio;
      }
      setCuerpo(bajo);
    }

    ajustar();

    /*
     * Mirando la caja y no la ventana. El marco del deck carga esta pantalla
     * mientras la placa todavía está oculta, y ahí la caja mide cero: sin
     * volver a medir cuando aparece, el bloque se queda escondido toda la
     * charla. Y de paso cubre entrar a pantalla completa, que es lo que hace
     * quien proyecta apenas empieza.
     */
    const observador = new ResizeObserver(ajustar);
    const caja = el.parentElement;
    if (caja) observador.observe(caja);
    return () => observador.disconnect();
  }, [firma]);

  return (
    <div className="cp-nube-caja">
      <div
        ref={ref}
        className="cp-nube"
        /* Hasta que está medida no se muestra: sin esto se ve el salto desde
           el cuerpo de medición al definitivo. */
        style={{
          fontSize: `${cuerpo ?? MEDIDA}px`,
          visibility: cuerpo ? 'visible' : 'hidden',
        }}
      >
        {desdeElCentro.map((p) => (
          <span
            key={p.texto}
            className="cp-palabra"
            style={{
              fontSize: `${peso(p.veces).toFixed(3)}em`,
              /*
               * Las que se repiten van en tinta plena y las de una sola vez
               * más claras, para leer el bloque de adentro hacia afuera. Si no
               * se repitió ninguna no hay adentro ni afuera, así que van todas
               * en tinta plena: el gris para las treinta y tres deja la placa
               * apagada.
               */
              color:
                tope === 1
                  ? 'var(--ink)'
                  : p.veces === tope
                    ? 'var(--st-amber)'
                    : p.veces > 1
                      ? 'var(--ink)'
                      : 'var(--ink-soft)',
            }}
          >
            {p.texto}
            {p.veces > 1 && <sup className="cp-veces">{p.veces}</sup>}
          </span>
        ))}
      </div>
    </div>
  );
}
