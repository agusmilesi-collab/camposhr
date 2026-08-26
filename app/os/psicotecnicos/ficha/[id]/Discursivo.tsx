'use client';

/**
 * El análisis discursivo, en la ficha.
 *
 * La evaluadora ubica a la persona en uno de los cuatro estratos. El sistema no
 * deduce el nivel: se toma sobre unos cinco minutos de discurso y lo ubica quien
 * lo escuchó.
 *
 * **Va sin la pirámide**: dibujarla acá ocupaba media pantalla para elegir entre
 * cuatro cosas. La pirámide es del informe, que es donde el cliente la lee; acá
 * alcanza con la lista de estratos y su referencia laboral.
 *
 * El capítulo del informe sale del catálogo de estratos, así que elegir el
 * escalón es todo lo que hay que hacer.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { NivelDiscursivo } from '@/lib/discursivo';

export default function Discursivo({
  id,
  nivel,
  niveles,
}: {
  id: string;
  nivel: string | null;
  /** Los cuatro, del más alto al más bajo, con lo que rige. */
  niveles: { nombre: string; romano: string; procesamiento: string; que: string }[];
}) {
  const router = useRouter();
  const [puesto, setPuesto] = useState(nivel);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(elegido: string | null) {
    const antes = puesto;
    setPuesto(elegido);
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/discursivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, nivel: elegido }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      router.refresh();
    } catch (e) {
      setPuesto(antes);
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="os-discursivo">
      <p className="os-form-nota">
        El nivel de complejidad de trabajo que puede abordar hoy. El que quede marcado es el
        que sale en el informe, con la descripción de su estrato y la del nivel siguiente.
      </p>

      <ol className="os-estratos-elegir">
        {niveles.map((n) => {
          const suyo = puesto === n.nombre;
          return (
            <li key={n.nombre}>
              <button
                type="button"
                className={`os-estrato-opcion${suyo ? ' suyo' : ''}`}
                disabled={guardando}
                aria-pressed={suyo}
                // Volver a apretar el que ya estaba lo desmarca: es la forma de
                // corregir sin tener que elegir otro que no corresponde.
                onClick={() => guardar(suyo ? null : (n.nombre as NivelDiscursivo))}
              >
                <span className="os-estrato-numeral">{n.romano}</span>
                <span className="os-estrato-nombre">{n.nombre}</span>
                <span className="os-estrato-que">{n.que}</span>
                <span className="os-estrato-proceso">{n.procesamiento}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
