'use client';

/**
 * Un test de papel, cargado en la sala: si se tomó y qué se vio.
 *
 * El Bender y el gráfico de dos personas no producen puntaje en el OS. Lo que
 * queda de ellos es la marca de administrado y lo que la evaluadora anotó
 * mientras la persona dibujaba: cómo encaró la hoja, si borró, cuánto tardó,
 * qué dijo. Eso solo existe en el momento, así que se escribe acá y la ficha
 * después lo muestra sin poder cambiarlo.
 *
 * Las observaciones guardan al salir del campo, y el sí/no al elegir, como el
 * resto del pipeline. Vacío significa sin observaciones, que es lo habitual.
 *
 * **Si se tomó o no vive al lado del título** (`Marca.tsx`), que es donde se
 * mira al bajar por la lista; acá quedan las observaciones y los botones del
 * test.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Papel({
  id,
  campoNotas,
  observaciones,
  children,
  debajo,
}: {
  id: string;
  /** Sin esto no se muestra el campo de observaciones. */
  campoNotas?: string;
  observaciones?: string | null;
  /** Lo que se agrega a la derecha del sí/no, si el test tiene algo más. */
  children?: React.ReactNode;
  /** Lo que va en su propio renglón, debajo de las observaciones: lo que la
      persona dejó dibujado, que se mira y se reemplaza aparte de tomarlo. */
  debajo?: React.ReactNode;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [notas, setNotas] = useState(observaciones ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(campo: string, valor: string | boolean | null) {
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo, valor }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return false;
      }
      empezar(() => router.refresh());
      return true;
    } catch {
      setError('No se pudo guardar.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  /** Lo escrito difiere de lo guardado, así que hay algo para cargar. */
  const pendiente = notas.trim() !== (observaciones ?? '');

  async function cargar() {
    if (!pendiente || !campoNotas) return;
    await guardar(campoNotas, notas.trim() || null);
  }

  return (
    <>
      {/* La celda del estado queda vacía: si se tomó o no se dice al lado del
          título (`Marca.tsx`). Se deja igual para que los botones sigan
          cayendo en la misma columna que en el resto de los tests. */}
      <div className="os-herramienta-accion">
        <span />
        {children}
      </div>

      {/* El campo va debajo, a lo ancho: lo que se anota es una frase entera y
          escribirla en un hueco angosto obliga a leerla de a pedazos. */}
      {campoNotas && (
        <div className="os-papel-notas">
          <input
            className="os-campo"
            type="text"
            placeholder="Sin observaciones"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            // También al salir del campo: el botón dice cuándo hay algo sin
            // cargar, y perder lo escrito por no llegar a apretarlo sería peor
            // que tener dos caminos para lo mismo.
            onBlur={() => cargar()}
            aria-label="Observaciones"
          />
          <button
            className="os-boton"
            type="button"
            disabled={guardando || !pendiente}
            onClick={() => cargar()}
          >
            {guardando ? 'Cargando…' : 'Cargar observación'}
          </button>
          {error && <span className="os-form-error">{error}</span>}
        </div>
      )}

      {debajo && <div className="os-papel-dibujos">{debajo}</div>}
    </>
  );
}
