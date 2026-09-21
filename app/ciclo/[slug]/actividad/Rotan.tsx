'use client';

import { useEffect, useState } from 'react';

/**
 * Las respuestas pasando de a una.
 *
 * Una sola a la vez y grande: se proyecta mientras la sala está mirando su
 * teléfono para repartir monedas, así que lo que aparece tiene que poder
 * leerse de un vistazo al levantar la cabeza. Una lista de setenta entradas a
 * cuerpo chico no la lee nadie.
 *
 * Sin nombres. Lo escribieron los que llevan años liderando y se lee como lo
 * que es: lo que la sala sabe y no está escrito en ningún lado.
 */
export default function Rotan({ textos }: { textos: string[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (textos.length <= 1) return;
    const t = setInterval(() => setI((n) => (n + 1) % textos.length), 6000);
    return () => clearInterval(t);
  }, [textos.length]);

  if (textos.length === 0) {
    return <p className="cp-vacio">Se arma sola a medida que escriben.</p>;
  }

  const actual = textos[i % textos.length];

  return (
    <div className="cp-rotan">
      {/* La clave fuerza el remonte: sin eso React reusa el nodo y el texto
          cambia sin que se note que pasó a otro. */}
      <blockquote key={i} className="cp-rotan-texto">
        {actual}
      </blockquote>
      <p className="cp-rotan-pie">
        {textos.length === 1
          ? 'Una respuesta de los que llevan años'
          : `${i + 1} de ${textos.length}`}
      </p>
    </div>
  );
}
