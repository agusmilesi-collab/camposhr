'use client';

/**
 * Reescribir el capítulo Benziger para una persona, como se editan las listas
 * del análisis y del plan.
 *
 * Son cuatro párrafos con nombre y no una lista: cómo es, mayor fortaleza,
 * mayor debilidad y entorno en el que rinde. Se guarda **solo el que cambió**
 * respecto de lo calculado, en `informe_listas.benziger`: el que no se tocó
 * sigue a los textos de Configuración, y un cambio ahí le llega.
 *
 * Fuera de la ficha (`id` vacío) no dibuja nada propio: muestra el capítulo
 * tal cual, que es lo que imprime la descarga y lee el portal.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ParrafoBenziger } from '@/lib/informe';

const ROTULO: Record<ParrafoBenziger, string> = {
  comoEs: 'Cuadrante predominante',
  fortaleza: 'Mayor fortaleza',
  debilidad: 'Mayor debilidad',
  entorno: 'Entorno en el que rinde',
};

export default function EditarBenziger({
  id,
  parrafos,
  editado,
  children,
}: {
  id?: string;
  parrafos: Record<ParrafoBenziger, string | null>;
  editado: Partial<Record<ParrafoBenziger, string>>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Partial<Record<ParrafoBenziger, string>>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claves = (Object.keys(ROTULO) as ParrafoBenziger[]).filter((k) => parrafos[k]);
  const intervenido = Object.keys(editado).length > 0;

  if (!id) return <>{children}</>;

  function abrir() {
    setBorrador(Object.fromEntries(claves.map((k) => [k, editado[k] ?? parrafos[k] ?? ''])));
    setError(null);
    setEditando(true);
  }

  async function mandar(cuerpo: Partial<Record<ParrafoBenziger, string>> | null) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/informe-listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lista: 'benziger', items: cuerpo }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      setEditando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  /** Solo lo que quedó distinto de lo calculado. */
  function diferencias() {
    return Object.fromEntries(
      claves
        .map((k) => [k, (borrador[k] ?? '').trim()] as const)
        .filter(([k, v]) => v && v !== parrafos[k])
    );
  }

  return (
    <div className="inf-bzg-edita">
      {!editando && (
        <span className="inf-edita-barra inf-bzg-barra">
          {intervenido && (
            <span className="inf-edita-marca" title="Este capítulo tiene texto escrito a mano">
              Editado a mano
            </span>
          )}
          <button type="button" className="os-boton" onClick={abrir}>
            Editar el texto
          </button>
        </span>
      )}

      {editando ? (
        <div className="inf-edita">
          {claves.map((k) => (
            <label key={k} className="inf-bzg-campo">
              <span>{ROTULO[k]}</span>
              <textarea
                className="os-campo"
                rows={k === 'comoEs' ? 7 : 4}
                value={borrador[k] ?? ''}
                onChange={(e) => setBorrador((b) => ({ ...b, [k]: e.target.value }))}
              />
            </label>
          ))}
          {error && <p className="os-form-error">{error}</p>}
          <div className="inf-edita-pie">
            <span />
            <div className="inf-edita-acciones">
              {intervenido && (
                <button
                  type="button"
                  className="os-boton"
                  disabled={guardando}
                  onClick={() => mandar(null)}
                  title="Descarta lo escrito y vuelve a los textos de Configuración"
                >
                  Volver a lo calculado
                </button>
              )}
              <button
                type="button"
                className="os-boton"
                disabled={guardando}
                onClick={() => setEditando(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="os-boton os-boton-firme"
                disabled={guardando}
                onClick={() => mandar(diferencias())}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
