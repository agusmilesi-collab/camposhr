'use client';

/**
 * Con quién se está trabajando, en el pie de la barra lateral.
 *
 * Se lee y se escribe en una cookie, así el servidor filtra con el mismo dato
 * sin arrastrarlo por la dirección. El equipo se pide recién al abrir el
 * selector: en la mayoría de las visitas nadie lo toca, y así ninguna pantalla
 * paga esa lectura.
 *
 * El día que haya cuentas, esto muestra quién inició sesión y deja de ser
 * elegible. Ver `lib/identidad.ts`.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

const COOKIE = 'os_equipo';

function leerCookie(): string {
  const par = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`));
  return par ? decodeURIComponent(par.slice(COOKIE.length + 1)) : '';
}

export default function Identidad({ actual }: { actual: string }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [elegido, setElegido] = useState(actual);
  const [lista, setLista] = useState<string[] | null>(null);

  // Lo que llegó del servidor manda al navegar; la cookie solo corrige cuando
  // la pantalla vuelve de la caché del navegador con un valor viejo.
  useEffect(() => {
    setElegido(actual);
  }, [actual]);

  useEffect(() => {
    const c = leerCookie();
    if (c && c !== actual) setElegido(c);
    // Corre una sola vez: después manda el servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function traerLista() {
    if (lista) return;
    try {
      const res = await fetch('/api/os/equipo');
      const datos = await res.json();
      setLista(Array.isArray(datos.equipo) ? datos.equipo : []);
    } catch {
      setLista([]);
    }
  }

  function cambiar(v: string) {
    const anio = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE}=${encodeURIComponent(v)}; path=/; max-age=${anio}; samesite=lax`;
    setElegido(v);
    empezar(() => router.refresh());
  }

  const opciones = lista ?? [elegido];

  return (
    <label className="os-identidad">
      <span className="os-identidad-rotulo">Trabajando como</span>
      <select
        className="os-identidad-selector"
        value={elegido}
        onMouseDown={traerLista}
        onFocus={traerLista}
        onChange={(e) => cambiar(e.target.value)}
      >
        {opciones.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
