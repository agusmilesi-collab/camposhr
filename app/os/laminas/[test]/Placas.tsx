'use client';

/**
 * Las láminas, como se le muestran a la persona evaluada.
 *
 * La pantalla se comparte por videollamada o se gira el monitor, así que todo
 * lo que hay es la lámina: fondo oscuro, sin barra del OS, sin nada alrededor
 * que compita con la mancha.
 *
 * El puntero del sistema se reemplaza por una flecha grande y negra con borde
 * blanco. Un cursor de tamaño normal, ya comprimido por el video, no se ve del
 * otro lado, y señalar es la mitad de la administración: la persona dice "acá"
 * y la evaluadora tiene que poder mostrar dónde.
 *
 * El trazo se desvanece solo a los cinco segundos. Es para señalar un contorno
 * mientras se habla de él, y lo que queda dibujado encima de la lámina en la
 * respuesta siguiente ensucia la mancha.
 *
 * Cambiar de lámina borra los trazos: pertenecen a la respuesta que se estaba
 * dando, no a la sesión.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Cuánto tarda cada punto del trazo en desaparecer. */
const VIDA_MS = 5000;
const GROSOR = 6;
const COLOR = '#000000';

type Punto = { x: number; y: number; t: number };
type Trazo = { puntos: Punto[] };

export default function Placas({ test, total }: { test: string; total: number }) {
  const [lamina, setLamina] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const puntero = useRef<SVGSVGElement>(null);
  const trazos = useRef<Trazo[]>([]);
  const actual = useRef<Trazo | null>(null);
  const dibujando = useRef(false);

  const ir = useCallback(
    (n: number) => {
      if (n < 1 || n > total) return;
      setLamina(n);
      trazos.current = [];
      actual.current = null;
      dibujando.current = false;
    },
    [total]
  );

  // Las flechas del teclado mueven la lámina: durante la administración las
  // manos están en otra cosa y buscar un botón chico con el mouse se nota.
  useEffect(() => {
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') ir(lamina - 1);
      if (e.key === 'ArrowRight') ir(lamina + 1);
    };
    window.addEventListener('keydown', teclado);
    return () => window.removeEventListener('keydown', teclado);
  }, [ir, lamina]);

  // Puntero, trazo y dibujado: todo sobre el mismo lienzo a pantalla completa.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;

    const medir = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width = `${window.innerWidth}px`;
      c.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();

    const sobreLaBarra = (t: EventTarget | null) =>
      t instanceof Element && Boolean(t.closest('.pl-barra'));

    const abajo = (e: MouseEvent) => {
      if (e.button !== 0 || sobreLaBarra(e.target)) return;
      dibujando.current = true;
      actual.current = { puntos: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
      trazos.current.push(actual.current);
    };
    const mover = (e: MouseEvent) => {
      if (puntero.current) {
        puntero.current.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 6}px)`;
      }
      if (dibujando.current && actual.current) {
        actual.current.puntos.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      }
    };
    const soltar = () => {
      actual.current = null;
      dibujando.current = false;
    };
    const esconder = () => puntero.current?.style.setProperty('opacity', '0');
    const mostrar = () => puntero.current?.style.setProperty('opacity', '1');

    window.addEventListener('resize', medir);
    document.addEventListener('mousedown', abajo);
    document.addEventListener('mousemove', mover, { passive: true });
    document.addEventListener('mouseup', soltar);
    window.addEventListener('blur', soltar);
    window.addEventListener('mouseleave', esconder);
    window.addEventListener('mouseenter', mostrar);

    let pedido = 0;
    const pintar = () => {
      const ahora = performance.now();
      ctx.clearRect(0, 0, c.width, c.height);
      for (const t of trazos.current) {
        t.puntos = t.puntos.filter((p) => ahora - p.t < VIDA_MS);
      }
      trazos.current = trazos.current.filter((t) => t.puntos.length > 0);

      ctx.lineWidth = GROSOR;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = COLOR;
      for (const t of trazos.current) {
        for (let i = 1; i < t.puntos.length; i++) {
          const a = t.puntos[i - 1];
          const b = t.puntos[i];
          const opacidad = Math.max(
            0,
            (1 - (ahora - a.t) / VIDA_MS + (1 - (ahora - b.t) / VIDA_MS)) / 2
          );
          if (opacidad <= 0) continue;
          ctx.globalAlpha = opacidad;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      pedido = requestAnimationFrame(pintar);
    };
    pedido = requestAnimationFrame(pintar);

    return () => {
      cancelAnimationFrame(pedido);
      window.removeEventListener('resize', medir);
      document.removeEventListener('mousedown', abajo);
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      window.removeEventListener('blur', soltar);
      window.removeEventListener('mouseleave', esconder);
      window.removeEventListener('mouseenter', mostrar);
    };
  }, []);

  return (
    <div className="pl">
      <div className="pl-escena">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-placa" src={`/api/os/lamina/${test}/${lamina}`} alt={`Lámina ${lamina}`} />
      </div>

      {/* La siguiente se pide mientras se habla de la actual: son archivos de
          hasta tres megas y el hueco en blanco al pasar se ve del otro lado. */}
      {lamina < total && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pl-oculta" src={`/api/os/lamina/${test}/${lamina + 1}`} alt="" aria-hidden />
      )}

      <canvas ref={canvas} className="pl-lienzo" />

      <div className="pl-barra">
        <button
          className="pl-paso"
          onClick={() => ir(lamina - 1)}
          disabled={lamina === 1}
          aria-label="Anterior"
        >
          ◀
        </button>
        <span className="pl-cuenta">
          {lamina}
          <span className="pl-total"> / {total}</span>
        </span>
        <button
          className="pl-paso"
          onClick={() => ir(lamina + 1)}
          disabled={lamina === total}
          aria-label="Siguiente"
        >
          ▶
        </button>
      </div>

      <svg ref={puntero} className="pl-puntero" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="plFlecha" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3a3a3a" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>
          <filter id="plSombra" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>
        <g filter="url(#plSombra)">
          <path
            d="M 14 8 Q 10 6 11 12 L 18 72 Q 19 78 24 74 L 36 62 L 46 86 Q 48 91 53 89 L 60 86 Q 65 84 63 79 L 53 56 L 70 54 Q 76 53 72 48 Z"
            fill="url(#plFlecha)"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
