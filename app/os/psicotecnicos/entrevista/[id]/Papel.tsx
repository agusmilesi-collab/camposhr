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
 * La marca también se pone sola al subir lo que la persona dibujó: si están los
 * dibujos, el test se tomó. Se puede corregir a mano igual, que es el caso de
 * haberlo administrado sin llegar a subir las fotos.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Papel({
  id,
  campoMarca,
  campoNotas,
  administrado,
  observaciones,
  children,
}: {
  id: string;
  /** El nombre del campo de administrado, como lo espera la API. */
  campoMarca: string;
  /** Sin esto no se muestra el campo de observaciones. */
  campoNotas?: string;
  administrado: boolean;
  observaciones?: string | null;
  /** Lo que se agrega a la derecha del sí/no, si el test tiene algo más. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [marca, setMarca] = useState(administrado);
  const [notas, setNotas] = useState(observaciones ?? '');
  // Subir lo que la persona dibujó marca el test como administrado del lado del
  // servidor. Sin esto, el botón seguía diciendo "No administrado" hasta
  // recargar la página entera: el estado de acá se quedaba con el valor de
  // cuando se abrió la pantalla.
  const [ultimo, setUltimo] = useState(administrado);
  if (administrado !== ultimo) {
    setUltimo(administrado);
    setMarca(administrado);
  }
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

  async function marcar(valor: boolean) {
    const antes = marca;
    setMarca(valor);
    if (!(await guardar(campoMarca, valor))) setMarca(antes);
  }

  return (
    <>
      <div className="os-herramienta-accion">
        {/* Un botón que alterna, como el de contacto en el pipeline: el estado
            se lee de un vistazo por el color y cambiarlo es un toque. Dos
            botones para un sí o un no ocupaban el doble para decir lo mismo. */}
        <button
          type="button"
          className={`os-boton os-boton-marcado os-sello-estado ${
            marca ? 'os-verde' : 'os-rojo'
          }`}
          aria-pressed={marca}
          disabled={guardando}
          onClick={() => marcar(!marca)}
          title={marca ? 'Tocar para marcar que no se tomó.' : 'Tocar para marcar que se tomó.'}
        >
          {marca ? 'Administrado' : 'No administrado'}
        </button>
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
    </>
  );
}
