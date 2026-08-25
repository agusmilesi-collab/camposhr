'use client';

/**
 * Lo que la evaluadora escribe de la entrevista por competencias.
 *
 * Es el único test de la batería que no deja más rastro que su redacción: se
 * hace con la persona enfrente y lo que queda es lo que la evaluadora anotó.
 * Hasta ahora eso vivía en un Google Docs por candidato, fuera del sistema, y
 * había que ir a buscarlo para escribir el informe.
 *
 * **Se guarda al soltar el campo**, como el resto de la ficha: no hay botón,
 * porque un texto largo que se escribe de a ratos con un botón al pie termina
 * perdiéndose el día que alguien cierra la pestaña sin apretarlo.
 *
 * El campo crece con lo que se escribe, así que la entrevista entera se lee sin
 * desplazar una caja de cuatro renglones.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { estirar } from '../../piezas';

export default function EntrevistaCompetencias({
  id,
  texto,
}: {
  id: string;
  texto: string | null;
}) {
  const router = useRouter();
  const [puesto, setPuesto] = useState(texto ?? '');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(valor: string) {
    setGuardando(true);
    setGuardado(false);
    setError(null);
    try {
      const res = await fetch('/api/os/entrevista-competencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, texto: valor }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      setGuardado(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="os-redaccion">
      <label className="os-etiqueta-campo" htmlFor={`entrevista-${id}`}>
        Lo que se trabajó en la entrevista
      </label>
      <textarea
        id={`entrevista-${id}`}
        className="os-campo os-campo-largo"
        rows={6}
        ref={estirar}
        value={puesto}
        placeholder="Competencia por competencia: qué se preguntó, qué contestó y con qué situación lo respaldó."
        onChange={(e) => {
          estirar(e.target);
          setPuesto(e.target.value);
        }}
        onBlur={(e) => e.target.value !== (texto ?? '') && guardar(e.target.value)}
      />

      {guardando && <p className="os-form-nota">Guardando…</p>}
      {!guardando && guardado && <p className="os-form-nota">Guardado.</p>}
      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
