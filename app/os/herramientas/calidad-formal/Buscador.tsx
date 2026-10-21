'use client';

import { useEffect, useState } from 'react';
import { plano } from '@/lib/rorschach-tabla-a';

/**
 * Filtra las diez láminas a la vez mientras se escribe.
 *
 * La tabla ya está dibujada por el servidor; esto solo esconde los renglones
 * que no coinciden, y las áreas y láminas que quedan vacías. Busca por
 * principio de palabra, como el capturador: "sal" trae "saliendo" y no
 * "espina dorsal".
 */
export default function Buscador() {
  const [q, setQ] = useState('');
  const [cuantas, setCuantas] = useState<number | null>(null);

  useEffect(() => {
    const raiz = document.getElementById('os-cf-laminas');
    if (!raiz) return;
    const buscado = plano(q.trim());
    let vistas = 0;
    raiz.querySelectorAll<HTMLElement>('[data-cf-lamina]').forEach((lamina) => {
      let enLamina = 0;
      lamina.querySelectorAll<HTMLElement>('[data-cf-area]').forEach((area) => {
        let enArea = 0;
        area.querySelectorAll<HTMLElement>('li[data-cf]').forEach((li) => {
          const ve =
            !buscado ||
            (li.dataset.cf ?? '').split(/[^a-z0-9]+/).some((p) => p.startsWith(buscado)) ||
            (li.dataset.cf ?? '').startsWith(buscado);
          li.hidden = !ve;
          if (ve) enArea++;
        });
        area.hidden = enArea === 0;
        enLamina += enArea;
      });
      lamina.hidden = enLamina === 0;
      const enIndice = document.querySelector<HTMLElement>(`[data-cf-indice="${lamina.dataset.cfLamina}"]`);
      if (enIndice) enIndice.dataset.vacia = enLamina === 0 ? 'si' : 'no';
      vistas += enLamina;
    });
    setCuantas(buscado ? vistas : null);
  }, [q]);

  return (
    <div className="os-cf-buscador">
      <input
        className="os-campo"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar una respuesta en las diez láminas"
        aria-label="Buscar una respuesta"
      />
      {cuantas !== null && (
        <span className="os-cf-resultado">
          {cuantas === 0 ? 'Ninguna' : cuantas === 1 ? '1 respuesta' : `${cuantas.toLocaleString('es-AR')} respuestas`}
        </span>
      )}
      <button type="button" className="os-boton" onClick={() => window.print()}>
        Imprimir
      </button>
    </div>
  );
}
