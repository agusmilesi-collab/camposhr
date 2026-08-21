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
 *
 * La lista es propia y no un `select` del navegador porque cada etapa se
 * reconoce por su punto de color, y un desplegable nativo no deja pintarlo.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { COLOR_ETAPA, ETAPAS } from '@/lib/psicotecnicos-tipos';

export default function Etapa({ id, etapa }: { id: string; etapa: string }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [valor, setValor] = useState(etapa);
  const [abierta, setAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLSpanElement>(null);

  // Se cierra al tocar afuera o con Escape, como cualquier desplegable.
  useEffect(() => {
    if (!abierta) return;
    const afuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierta(false);
    };
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(false);
    };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', teclado);
    };
  }, [abierta]);

  async function cambiar(nueva: string) {
    setAbierta(false);
    if (nueva === valor) return;
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
    <span className="os-etapa-editable" ref={caja}>
      <button
        type="button"
        className={`os-boton os-boton-marcado os-sello-estado ${COLOR_ETAPA[valor] ?? 'os-gris'}`}
        disabled={guardando}
        aria-haspopup="listbox"
        aria-expanded={abierta}
        onClick={() => setAbierta((x) => !x)}
        title="Mover la evaluación a otra etapa"
      >
        {valor}
        {/* La flecha es lo que dice que se abre: sin ella el sello se lee como
            un estado y nadie prueba tocarlo. */}
        <svg
          className={`os-etapa-flecha${abierta ? ' abierta' : ''}`}
          viewBox="0 0 10 6"
          aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {abierta && (
        <span className="os-etapa-lista" role="listbox">
          {ETAPAS.map((e) => (
            <button
              key={e}
              type="button"
              role="option"
              aria-selected={e === valor}
              className={`os-etapa-opcion os-sello-estado ${COLOR_ETAPA[e] ?? 'os-gris'}${
                e === valor ? ' elegida' : ''
              }`}
              onClick={() => cambiar(e)}
            >
              {e}
            </button>
          ))}
        </span>
      )}

      {error && <span className="os-form-error">{error}</span>}
    </span>
  );
}
