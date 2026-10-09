'use client';

/**
 * Las láminas, como se le muestran a la persona evaluada.
 *
 * La pantalla se comparte por videollamada o se gira el monitor, así que todo
 * lo que hay es la lámina: fondo oscuro, sin barra del OS, sin nada alrededor
 * que compita con la figura.
 *
 * El puntero del sistema se reemplaza por una flecha grande y negra con borde
 * blanco. Un cursor de tamaño normal, ya comprimido por el video, no se ve del
 * otro lado, y señalar es la mitad de la administración: la persona dice "acá"
 * y la evaluadora tiene que poder mostrar dónde.
 *
 * El trazo se desvanece solo a los cinco segundos. Es para señalar un contorno
 * mientras se habla de él, y lo que queda dibujado encima de la lámina en la
 * respuesta siguiente ensucia la figura.
 *
 * Cambiar de lámina borra los trazos: pertenecen a la respuesta que se estaba
 * dando, no a la sesión.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { abrirCanal, esParaMi, type Aviso } from '@/lib/laminas-sincro';
import type { PuntoSenal } from '@/lib/laminas-trazo';

/** Cuánto tarda cada punto del trazo en desaparecer. */
const VIDA_MS = 5000;
const GROSOR = 6;
const COLOR = '#000000';

type Punto = { x: number; y: number; t: number };
type Trazo = { puntos: Punto[] };

export default function Placas({
  test,
  total,
  fuente,
  seguir,
  senalar,
}: {
  test: string;
  total: number;
  /**
   * De dónde salen las imágenes. Por defecto, de la ruta del OS, que pide
   * sesión; la persona evaluada entra con un token y las suyas salen de otra.
   */
  fuente?: string;
  /**
   * A quién preguntarle qué lámina mostrar. Es para la pantalla de la persona
   * evaluada, que está en otra máquina: el canal entre pestañas no le llega,
   * así que consulta al servidor lo que marcó la evaluadora.
   */
  seguir?: string;
  /**
   * Adónde mandar lo que la persona dibuja, para que la evaluadora lo vea en
   * la pantalla de codificación. Solo en la pantalla de la persona evaluada.
   */
  senalar?: string;
}) {
  /** La pantalla de la persona evaluada: sigue a la evaluadora y no se maneja sola. */
  const deCandidato = Boolean(seguir);
  const origen = fuente ?? `/api/os/lamina/${test}`;
  const [lamina, setLamina] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const puntero = useRef<SVGSVGElement>(null);
  const trazos = useRef<Trazo[]>([]);
  const actual = useRef<Trazo | null>(null);
  const dibujando = useRef(false);
  /** Con qué dedo o mouse se está dibujando: un segundo dedo no se mete en el trazo. */
  const quien = useRef<number | null>(null);
  /** Cuántos puntos se dibujaron en total: si no cambió, no hay nada nuevo para mandar. */
  const dibujados = useRef(0);
  const placa = useRef<HTMLImageElement>(null);

  /** El canal que mueve las dos pantallas juntas. */
  const canal = useRef<BroadcastChannel | null>(null);
  /** Cuál se está mostrando, para la escucha, que se arma una sola vez. */
  const laminaAhora = useRef(1);
  laminaAhora.current = lamina;
  /* De qué evaluación es esta pantalla. La pone quien la abre desde la de
     codificación, para que con dos candidatos abiertos cada pantalla siga a la
     suya. Abierta a mano desde la ficha viene vacía y sigue a cualquiera, que
     es lo que hacía antes de que existiera esto. */
  const deQuien = useRef<string | null>(null);
  useEffect(() => {
    deQuien.current = new URLSearchParams(window.location.search).get('de');
  }, []);

  const ir = useCallback(
    (n: number, avisar = true) => {
      if (n < 1 || n > total) return;
      setLamina(n);
      trazos.current = [];
      actual.current = null;
      dibujando.current = false;
      if (avisar) {
        canal.current?.postMessage({
          lamina: n,
          de: 'laminas',
          evaluacion: deQuien.current,
        } satisfies Aviso);
      }
      /* Y dice dónde quedó, sin esperar a que se lo pregunten: así la otra
         pantalla se entera del cambio en cuanto pasa. */
      canal.current?.postMessage({
        lamina: n,
        de: 'laminas',
        evaluacion: deQuien.current,
        pulso: 'aca',
      } satisfies Aviso);
    },
    [total],
  );

  /**
   * La lámina que se muestra la puede cambiar la otra pantalla.
   *
   * La evaluadora comparte esta pestaña con el candidato y trabaja en la de
   * codificación: pasa de lámina allá, con la mano en el teclado donde está
   * escribiendo, y acá cambia sola. Lo que llega de afuera no se vuelve a
   * anunciar, o las dos pantallas se estarían avisando entre ellas para siempre.
   */
  useEffect(() => {
    const c = abrirCanal();
    canal.current = c;
    if (!c) return;
    const contestar = () =>
      c.postMessage({
        lamina: laminaAhora.current,
        de: 'laminas',
        evaluacion: deQuien.current,
        pulso: 'aca',
      } satisfies Aviso);
    c.onmessage = (e: MessageEvent<Aviso>) => {
      // Contestar dónde está: lo pregunta la pantalla de codificación.
      if (e.data?.pulso === 'donde' && esParaMi(e.data, deQuien.current)) {
        contestar();
        return;
      }
      /* La misma lámina no se vuelve a poner: `ir` limpia los trazos, y el
         aviso llega de rebote cada vez que la otra pantalla confirma dónde
         está. Borraría lo que la evaluadora acaba de señalar. */
      if (
        e.data?.de === 'codificacion' &&
        esParaMi(e.data, deQuien.current) &&
        e.data.lamina !== laminaAhora.current
      ) {
        ir(e.data.lamina, false);
      }
    };
    contestar();
    return () => {
      canal.current = null;
      c.close();
    };
  }, [ir]);

  /**
   * Seguir a la evaluadora desde otra máquina.
   *
   * La persona no tiene cómo pasar de lámina: las pasa la evaluadora desde la
   * pantalla de codificación, y esta se mueve cuando lo que dice el servidor
   * cambia.
   */
  useEffect(() => {
    if (!seguir) return;
    let ultima: number | null = null;
    let vivo = true;
    const preguntar = async () => {
      try {
        const res = await fetch(seguir, { cache: 'no-store' });
        if (!res.ok) return;
        const r: { lamina: number | null } = await res.json();
        if (!vivo || r.lamina === null || r.lamina === ultima) return;
        ultima = r.lamina;
        if (r.lamina !== laminaAhora.current) ir(r.lamina, false);
      } catch {
        // Se corta la red un momento: la vuelta siguiente lo resuelve.
      }
    };
    preguntar();
    const reloj = window.setInterval(preguntar, 1500);
    // Al volver a la pestaña no se espera al reloj, que el navegador frena
    // mientras está atrás.
    const alVolver = () => {
      if (document.visibilityState === 'visible') preguntar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [seguir, ir]);

  // Las flechas del teclado mueven la lámina: durante la administración las
  // manos están en otra cosa y buscar un botón chico con el mouse se nota.
  // En la pantalla de la persona evaluada no: la lámina la pasa la evaluadora.
  useEffect(() => {
    if (deCandidato) return;
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') ir(lamina - 1);
      if (e.key === 'ArrowRight') ir(lamina + 1);
    };
    window.addEventListener('keydown', teclado);
    return () => window.removeEventListener('keydown', teclado);
  }, [ir, lamina, deCandidato]);

  /* El celular de la persona evaluada no apaga la pantalla mientras están las
     láminas: habla un rato sin tocar nada y a los treinta segundos el teléfono
     se bloqueaba. El navegador suelta el pedido al pasar a otra aplicación, y
     se vuelve a pedir al volver. Donde no existe, no pasa nada. */
  useEffect(() => {
    if (!deCandidato) return;
    type Bloqueo = { release: () => Promise<void> };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (tipo: 'screen') => Promise<Bloqueo> };
    };
    if (!nav.wakeLock) return;
    let bloqueo: Bloqueo | null = null;
    const pedir = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock
        ?.request('screen')
        .then((b) => (bloqueo = b))
        .catch(() => {});
    };
    pedir();
    document.addEventListener('visibilitychange', pedir);
    return () => {
      document.removeEventListener('visibilitychange', pedir);
      bloqueo?.release().catch(() => {});
    };
  }, [deCandidato]);

  /* Lo dibujado viaja a la pantalla de codificación, en coordenadas de la
     lámina y no de la pantalla: allá la lámina tiene otro tamaño y otro lugar.
     Se manda solo cuando hay puntos nuevos, y una vez vacío cuando el último
     trazo se borró, para que allá también desaparezca. */
  useEffect(() => {
    if (!senalar) return;
    let mandados = -1;
    let habiaAlgo = false;
    let enViaje = false;
    const mandar = () => {
      const img = placa.current;
      if (enViaje || !img) return;
      const r = img.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const ahora = performance.now();
      const trazosVivos: PuntoSenal[][] = [];
      for (const t of trazos.current) {
        const puntos: PuntoSenal[] = [];
        for (const p of t.puntos) {
          const edad = ahora - p.t;
          if (edad >= VIDA_MS) continue;
          const x = (p.x - r.left) / r.width;
          const y = (p.y - r.top) / r.height;
          // Puntos pegados no cambian el dibujo y engordan el envío.
          const prev = puntos[puntos.length - 1];
          if (prev && Math.abs(prev[0] - x) + Math.abs(prev[1] - y) < 0.004) continue;
          puntos.push([+x.toFixed(4), +y.toFixed(4), Math.round(edad)]);
        }
        if (puntos.length > 0) trazosVivos.push(puntos.slice(-600));
      }
      const hayAlgo = trazosVivos.length > 0;
      if (hayAlgo ? dibujados.current === mandados : !habiaAlgo) return;
      mandados = dibujados.current;
      habiaAlgo = hayAlgo;
      enViaje = true;
      fetch(senalar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lamina: laminaAhora.current, trazos: trazosVivos.slice(-30) }),
      })
        .catch(() => {})
        .finally(() => (enViaje = false));
    };
    const reloj = window.setInterval(mandar, 300);
    return () => window.clearInterval(reloj);
  }, [senalar]);

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

    // Eventos de puntero y no de mouse: valen igual para el mouse de una
    // computadora y para el dedo en un celular, donde la persona arrastra el
    // dedo sobre la lámina y el trazo lo sigue.
    const abajo = (e: PointerEvent) => {
      if (e.button !== 0 || sobreLaBarra(e.target)) return;
      if (dibujando.current) return;
      quien.current = e.pointerId;
      mover(e);
      dibujando.current = true;
      actual.current = { puntos: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
      trazos.current.push(actual.current);
    };
    const mover = (e: PointerEvent) => {
      if (dibujando.current && e.pointerId !== quien.current) return;
      if (puntero.current) {
        // Arranca escondida: en el celular no hay puntero hasta el primer toque.
        puntero.current.style.opacity = '1';
        puntero.current.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 6}px)`;
      }
      if (dibujando.current && actual.current) {
        dibujados.current++;
        actual.current.puntos.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      }
    };
    const soltar = (e?: Event) => {
      if (e instanceof PointerEvent && e.pointerId !== quien.current) return;
      quien.current = null;
      actual.current = null;
      dibujando.current = false;
    };
    const esconder = () => puntero.current?.style.setProperty('opacity', '0');
    const mostrar = () => puntero.current?.style.setProperty('opacity', '1');

    window.addEventListener('resize', medir);
    document.addEventListener('pointerdown', abajo);
    document.addEventListener('pointermove', mover, { passive: true });
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
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
            (1 - (ahora - a.t) / VIDA_MS + (1 - (ahora - b.t) / VIDA_MS)) / 2,
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
      document.removeEventListener('pointerdown', abajo);
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
      window.removeEventListener('blur', soltar);
      window.removeEventListener('mouseleave', esconder);
      window.removeEventListener('mouseenter', mostrar);
    };
  }, []);

  return (
    <div className="pl">
      <div className="pl-escena">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={placa}
          className="pl-placa"
          src={`${origen}/${lamina}`}
          alt={`Lámina ${lamina}`}
        />
      </div>

      {/* La siguiente se pide mientras se habla de la actual: son archivos de
          hasta tres megas y el hueco en blanco al pasar se ve del otro lado. */}
      {lamina < total && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pl-oculta" src={`${origen}/${lamina + 1}`} alt="" aria-hidden />
      )}

      <canvas ref={canvas} className="pl-lienzo" />

      {deCandidato && <p className="pl-girar">Girá el teléfono para ver la lámina más grande</p>}

      {!deCandidato && (
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
      )}

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
