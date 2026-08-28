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
 *
 * Lo anotado y lo dibujado van uno al lado del otro y del mismo tamaño: son
 * las dos cosas que el test deja, y apiladas la de abajo se leía como un
 * agregado de la de arriba.
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
      {/* Los botones del test, contra el margen izquierdo: es donde arranca
          todo lo demás de la tarjeta, y contra el derecho quedaban lejos del
          nombre al que pertenecen. */}
      <div className="os-herramienta-accion">{children}</div>

      {/* Lo que se anota a la izquierda y lo que la persona dejó dibujado a la
          derecha, del mismo tamaño: son las dos cosas que quedan del test y en
          dos renglones apilados el de abajo se leía como un agregado. */}
      {(campoNotas || debajo) && (
        <div className="os-papel-fila">
          {campoNotas && (
            <div className="os-papel-notas">
              <textarea
                className="os-campo os-papel-campo"
                placeholder="Sin observaciones"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                // También al salir del campo: el botón dice cuándo hay algo sin
                // guardar, y perder lo escrito por no llegar a apretarlo sería
                // peor que tener dos caminos para lo mismo.
                onBlur={() => cargar()}
                aria-label="Observaciones"
              />
              <button
                className="os-boton"
                type="button"
                disabled={guardando || !pendiente}
                onClick={() => cargar()}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              {error && <span className="os-form-error">{error}</span>}
            </div>
          )}

          {debajo && <div className="os-papel-dibujos">{debajo}</div>}
        </div>
      )}
    </>
  );
}
