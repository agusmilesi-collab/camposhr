'use client';

/**
 * Si el test se tomó o no, al lado de su nombre.
 *
 * Es lo primero que se mira al bajar por la lista mientras se administra, así
 * que va pegado al título y no en la columna de los botones, donde quedaba a
 * media pantalla de distancia del test al que pertenece.
 *
 * **Es un botón, no un cartel**: se lee de un vistazo por el color y se corrige
 * de un toque. Dos botones para un sí o un no ocupaban el doble para decir lo
 * mismo.
 *
 * Salió de `Papel.tsx`, que sigue teniendo las observaciones y los botones de
 * cada test: ese componente vive adentro de la tarjeta y esto va en el
 * encabezado, que es de otro lado del árbol.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Marca({
  id,
  campo,
  administrado,
}: {
  id: string;
  /** El nombre del campo de administrado, como lo espera la API. */
  campo: string;
  administrado: boolean;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [marca, setMarca] = useState(administrado);
  /**
   * Subir lo que la persona dibujó marca el test como administrado del lado del
   * servidor. Sin esto, el botón seguía diciendo "No administrado" hasta
   * recargar la página entera: el estado de acá se quedaba con el valor de
   * cuando se abrió la pantalla.
   */
  const [ultimo, setUltimo] = useState(administrado);
  if (administrado !== ultimo) {
    setUltimo(administrado);
    setMarca(administrado);
  }
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);

  async function marcar(valor: boolean) {
    const antes = marca;
    setMarca(valor);
    setError(false);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo, valor }),
      });
      const r = await res.json().catch(() => ({ ok: false }));
      if (!r.ok) {
        setMarca(antes);
        setError(true);
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setMarca(antes);
      setError(true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <button
      type="button"
      className={`os-boton os-boton-marcado os-sello-estado os-test-estado ${
        marca ? 'os-verde' : 'os-rojo'
      }`}
      aria-pressed={marca}
      disabled={guardando}
      onClick={() => marcar(!marca)}
      title={
        error
          ? 'No se pudo guardar. Tocar para volver a intentar.'
          : marca
            ? 'Tocar para marcar que no se tomó.'
            : 'Tocar para marcar que se tomó.'
      }
    >
      {marca ? 'Administrado' : 'No administrado'}
    </button>
  );
}
