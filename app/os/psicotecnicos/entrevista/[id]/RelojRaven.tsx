'use client';

/**
 * Cuánto le queda al candidato en el Raven.
 *
 * La evaluadora lo necesita para saber si esperar o seguir con otra cosa: el
 * test dura tres cuartos de hora y quien lo administra no está mirando la
 * pantalla del otro.
 *
 * Se cuenta contra el momento en que abrió la primera lámina, que lo fijó el
 * servidor, y no descontando un segundo por vuelta: si esta pestaña queda en
 * segundo plano, el navegador frena el temporizador y la cuenta se atrasa.
 */

import { useEffect, useState } from 'react';
import { MINUTOS } from '@/lib/raven';

export default function RelojRaven({ iniciado }: { iniciado: string | null }) {
  // Sin abrir todavía: el tiempo está entero y quieto. Se muestra igual, para
  // saber de cuánto dispone cuando empiece.
  const completo = `${MINUTOS}:00`;
  // Null hasta que corre en el navegador: el servidor y el cliente dibujan en
  // instantes distintos y el número no puede coincidir entre los dos.
  const [restan, setRestan] = useState<number | null>(null);

  useEffect(() => {
    if (!iniciado) return;
    const fin = new Date(iniciado).getTime() + MINUTOS * 60 * 1000;
    const leer = () => setRestan(Math.max(0, Math.round((fin - Date.now()) / 1000)));
    leer();
    const t = setInterval(leer, 1000);
    return () => clearInterval(t);
  }, [iniciado]);

  if (!iniciado) {
    return (
      <span className="os-raven-reloj" title="Todavía no lo abrió">
        {completo}
      </span>
    );
  }
  if (restan === null) return <span className="os-raven-reloj" />;
  if (restan === 0) return <span className="os-raven-reloj urge">Se acabó</span>;

  const m = Math.floor(restan / 60);
  const s = restan % 60;
  return (
    <span className={`os-raven-reloj${restan <= 5 * 60 ? ' urge' : ''}`} title="Tiempo que le queda">
      Quedan {m}:{String(s).padStart(2, '0')}
    </span>
  );
}
