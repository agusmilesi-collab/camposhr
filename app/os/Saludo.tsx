'use client';

/**
 * El saludo de la home, con el nombre de quien mira y la franja del día.
 *
 * Se arma en el navegador y no en el servidor porque el servidor corre en otro
 * huso: calculado allá, a las nueve de la mañana en Córdoba podría saludar con
 * "buenas noches". Por eso arranca sin franja y la completa al montar, que
 * además evita que el texto del servidor y el del navegador no coincidan.
 *
 * Del nombre completo se usa solo el primero: es un saludo, no una ficha.
 */

import { useEffect, useState } from 'react';

function franja(hora: number): string {
  if (hora < 12) return 'Buen día';
  if (hora < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function Saludo({ nombre }: { nombre: string }) {
  const [saludo, setSaludo] = useState<string | null>(null);

  useEffect(() => {
    const poner = () => setSaludo(franja(new Date().getHours()));
    poner();
    // Por si la pantalla queda abierta cruzando el mediodía o la noche.
    const t = setInterval(poner, 60_000);
    return () => clearInterval(t);
  }, []);

  const primero = nombre.trim().split(/\s+/)[0];

  return <h1>{saludo ? `${saludo}, ${primero}` : primero}</h1>;
}
