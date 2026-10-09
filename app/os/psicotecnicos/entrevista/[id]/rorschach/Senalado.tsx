'use client';

/**
 * Lo que la persona evaluada está señalando en su pantalla, pintado encima de
 * la lámina de la pantalla de codificación.
 *
 * En la encuesta la persona dibuja dónde vio cada cosa con el mouse o el dedo,
 * en su propia máquina. Esto lo trae del servidor y lo dibuja sobre los mapas
 * de la lámina, para verlo sin que tenga que compartir pantalla, que desde un
 * celular casi nunca se puede.
 *
 * **La pregunta al servidor y el dibujo van separados de la pantalla de
 * codificación**, que es muy grande: redibujarla entera siete veces por segundo
 * mientras se borra el trazo trababa el tipeo de lo que la persona contesta.
 * Una sola consulta alimenta a los siete mapas, y cada uno se repinta solo.
 */

import { useEffect, useRef, useState } from 'react';
import { VIDA_SENAL_MS, type Senal } from '@/lib/laminas-trazo';

type Recibida = { datos: Senal; recibida: number } | null;

export type FuenteSenal = {
  ahora: () => Recibida;
  escuchar: (fn: () => void) => () => void;
};

/** Pregunta cada 700 ms qué está señalando la persona, mientras `activo`. */
export function useSenal(activo: boolean, evaluacionId: string): FuenteSenal {
  const ultima = useRef<Recibida>(null);
  const oyentes = useRef(new Set<() => void>());
  const fuente = useRef<FuenteSenal>({
    ahora: () => ultima.current,
    escuchar: (fn) => {
      oyentes.current.add(fn);
      return () => oyentes.current.delete(fn);
    },
  });

  useEffect(() => {
    const avisar = () => oyentes.current.forEach((fn) => fn());
    if (!activo) {
      ultima.current = null;
      avisar();
      return;
    }
    let vivo = true;
    let enViaje = false;
    const preguntar = async () => {
      if (enViaje || document.visibilityState !== 'visible') return;
      enViaje = true;
      try {
        const res = await fetch(`/api/os/laminas-trazo?evaluacion=${evaluacionId}&test=rorschach`, {
          cache: 'no-store',
        });
        const r: { senal?: Senal | null } = await res.json();
        if (!vivo) return;
        ultima.current = r.senal ? { datos: r.senal, recibida: performance.now() } : null;
        avisar();
      } catch {
        // Se corta la red un momento: la vuelta siguiente lo resuelve.
      } finally {
        enViaje = false;
      }
    };
    preguntar();
    const reloj = window.setInterval(preguntar, 700);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
    };
  }, [activo, evaluacionId]);

  return fuente.current;
}

/**
 * Los trazos vivos de una lámina, dentro del SVG del mapa (de 0 a 100 en los
 * dos ejes). Se van borrando al mismo ritmo que en la pantalla de la persona.
 */
export function TrazosSenalados({ fuente, lamina }: { fuente: FuenteSenal; lamina: number }) {
  const [, setLatido] = useState(0);
  useEffect(() => fuente.escuchar(() => setLatido((n) => n + 1)), [fuente]);

  const s = fuente.ahora();
  const pasado = s ? performance.now() - s.recibida : 0;
  const vivos =
    s && s.datos.lamina === lamina
      ? s.datos.trazos
          .map((t) => t.filter((p) => p[2] + pasado < VIDA_SENAL_MS))
          .filter((t) => t.length > 0)
      : [];

  // Mientras queda algo a la vista, se repinta seguido para que se desvanezca.
  const hayAlgo = vivos.length > 0;
  useEffect(() => {
    if (!hayAlgo) return;
    const reloj = window.setInterval(() => setLatido((n) => n + 1), 150);
    return () => window.clearInterval(reloj);
  }, [hayAlgo]);

  return (
    <>
      {vivos.map((t, i) => (
        <polyline
          key={i}
          points={t.map((p) => `${p[0] * 100},${p[1] * 100}`).join(' ')}
          fill="none"
          stroke="#e8590c"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity={Math.max(0, 1 - (t[t.length - 1][2] + pasado) / VIDA_SENAL_MS)}
          pointerEvents="none"
        />
      ))}
    </>
  );
}
