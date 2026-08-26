'use client';

/**
 * Lo que la evaluadora escribe de la entrevista por competencias.
 *
 * Es el único test de la batería que no deja más rastro que su redacción, y se
 * escribe en la sala: por eso el campo está acá, entre los demás tests de la
 * hoja, y no en la ficha, que se lee después para codificar. Hasta ahora esa
 * redacción vivía en un Google Docs por candidato, fuera del sistema, y para
 * escribir el informe había que ir a buscarla.
 *
 * **Se guarda al soltar el campo**, como las observaciones del papel: un texto
 * largo que se escribe de a ratos con un botón al pie se pierde el día que
 * alguien cierra la pestaña sin apretarlo. El botón está igual, porque acá se
 * escribe mientras se habla y ver "Guardado" sin haber salido del campo es lo
 * que da tranquilidad para seguir.
 *
 * El campo arranca con la altura de una página corta y crece con lo que se
 * escribe: la entrevista entera se lee sin desplazar una caja de cuatro
 * renglones.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { estirar } from '../../piezas';

export default function Competencias({
  id,
  texto,
}: {
  id: string;
  texto: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [puesto, setPuesto] = useState(texto ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lo que manda el servidor vuelve a mandar: guardar redibuja, y el estado de
  // un componente de cliente no se reinicia solo.
  const [ultimo, setUltimo] = useState(texto ?? '');
  if ((texto ?? '') !== ultimo) {
    setUltimo(texto ?? '');
    setPuesto(texto ?? '');
  }

  /** Lo escrito difiere de lo guardado, así que hay algo para cargar. */
  const pendiente = puesto.trim() !== (texto ?? '');

  async function guardar() {
    if (!pendiente) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/entrevista-competencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, texto: puesto }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      empezar(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="os-herramienta-accion">
        {/* El estado sale de si hay algo escrito: no hay marca de administrado
            que poner aparte, porque el test es lo escrito. */}
        <span className={`os-sello-estado ${texto ? 'os-verde' : 'os-gris'}`}>
          {texto ? 'Escrita' : 'Sin escribir'}
        </span>
        <span />
        <span />
      </div>

      <div className="os-papel-notas os-competencias">
        <textarea
          className="os-campo os-campo-largo"
          rows={6}
          ref={estirar}
          value={puesto}
          placeholder="Competencia por competencia: qué se preguntó, qué contestó y con qué situación lo respaldó."
          aria-label="Lo que se trabajó en la entrevista por competencias"
          onChange={(e) => {
            estirar(e.target);
            setPuesto(e.target.value);
          }}
          onBlur={() => guardar()}
        />
        <button
          className="os-boton"
          type="button"
          disabled={guardando || !pendiente}
          onClick={() => guardar()}
        >
          {guardando ? 'Cargando…' : 'Cargar lo escrito'}
        </button>
        {error && <span className="os-form-error">{error}</span>}
      </div>
    </>
  );
}
