'use client';

/**
 * Mira si el candidato abrió o terminó el Raven, sin que haya que recargar.
 *
 * El reloj corre solo una vez que la pantalla sabe que arrancó, pero enterarse
 * de que arrancó era recargar a mano. Y es justo el momento en que la
 * evaluadora está haciendo otra cosa: le manda el enlace y se pone a escribir
 * la entrevista mientras la persona responde.
 *
 * Pregunta el estado, que es un dato de dos campos, y solo cuando cambia pide
 * la pantalla de nuevo. Así el sondeo es barato y el redibujo, que trae la
 * evaluación entera, pasa una vez.
 *
 * Deja de preguntar cuando ya no hay nada que esperar: terminado es el final, y
 * sin enlace quiere decir que todavía no se le mandó, cosa que pasa desde esta
 * misma pantalla y ya redibuja sola.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { EstadoRaven } from '@/lib/entrevista';

/** Cada cuánto se pregunta. El test dura tres cuartos de hora. */
const CADA = 15_000;

export default function SondeoRaven({
  id,
  estado,
}: {
  id: string;
  /** El que la pantalla está mostrando. Cuando el servidor diga otro, se redibuja. */
  estado: EstadoRaven;
}) {
  const router = useRouter();
  // En una referencia y no en el efecto: así el temporizador no se rearma en
  // cada dibujo, que es lo que haría que la cuenta empiece de nuevo.
  const mostrando = useRef(estado);
  mostrando.current = estado;

  useEffect(() => {
    if (estado !== 'sin abrir' && estado !== 'empezado') return;

    let vivo = true;
    const mirar = async () => {
      try {
        const res = await fetch(`/api/os/raven-estado?evaluacion=${id}`, { cache: 'no-store' });
        const r = await res.json();
        if (vivo && r.ok && r.estado !== mostrando.current) router.refresh();
      } catch {
        // Sin conexión no se hace nada: en la vuelta siguiente se vuelve a
        // preguntar, y mientras tanto queda lo que ya se estaba mostrando.
      }
    };

    const t = setInterval(mirar, CADA);
    // Al volver a la pestaña se pregunta de una: el navegador frena los
    // temporizadores en segundo plano, así que puede haber pasado media hora
    // desde la última vuelta.
    const alVolver = () => document.visibilityState === 'visible' && mirar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [id, estado, router]);

  return null;
}
