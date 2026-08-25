'use client';

/**
 * La etapa de la evaluación, editable desde su ficha.
 *
 * El pipeline avanza solo por sus botones, que es lo normal, pero hace falta
 * poder corregirla a mano: una evaluación que avanzó de más queda fuera de la
 * lista donde se la estaba trabajando y sin ningún botón que la traiga de
 * vuelta, porque los botones viven en la pantalla de la que ya salió. Pasó con
 * el paso automático a Por analizar.
 *
 * Cambiarla acá no toca ninguna otra cosa: las fechas y las marcas se quedan
 * como están, porque mover la etapa es corregir dónde está, no deshacer lo que
 * se hizo.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import Desplegable from '@/app/os/Desplegable';
import { COLOR_ETAPA, ETAPAS } from '@/lib/psicotecnicos-tipos';

export default function Etapa({ id, etapa }: { id: string; etapa: string }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [valor, setValor] = useState(etapa);

  // La etapa también cambia sola: marcar que la persona entró a trabajar mueve
  // la evaluación a Seguimiento. Sin esto, el desplegable seguía mostrando la
  // anterior hasta recargar la página, porque el estado del componente no se
  // reinicia cuando el servidor vuelve a dibujar la ficha.
  useEffect(() => setValor(etapa), [etapa]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(nueva: string) {
    const antes = valor;
    setValor(nueva);
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo: 'etapa', valor: nueva }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setValor(antes);
        setError(r.motivo ?? 'No se pudo cambiar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setValor(antes);
      setError('No se pudo cambiar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Desplegable
        valor={valor}
        opciones={ETAPAS.map((e) => ({ valor: e, texto: e, color: COLOR_ETAPA[e] ?? 'os-gris' }))}
        alElegir={cambiar}
        deshabilitado={guardando}
        etiqueta="Mover la evaluación a otra etapa"
      />
      {error && <span className="os-form-error">{error}</span>}
    </>
  );
}
