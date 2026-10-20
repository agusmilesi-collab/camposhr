'use client';

/**
 * Reescribir el resumen de la primera hoja, como se editan las listas del
 * análisis.
 *
 * Es un párrafo solo, así que se guarda como texto en `informe_listas.resumen`.
 * Guardado, ese párrafo queda de la evaluadora aunque cambie la codificación;
 * "Volver a lo calculado" borra la clave y el motor lo vuelve a armar.
 *
 * Fuera de la ficha (`id` vacío) no dibuja nada propio: muestra el resumen tal
 * cual, que es lo que imprime la descarga y lee el portal.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TOPE_RESUMEN } from '@/lib/informe-textos';

export default function EditarResumen({
  id,
  texto,
  editado,
  children,
}: {
  id?: string;
  texto: string;
  editado: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!id) return <>{children}</>;

  function abrir() {
    setBorrador(texto);
    setError(null);
    setEditando(true);
  }

  async function mandar(cuerpo: string | null) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/informe-listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lista: 'resumen', items: cuerpo }),
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

  return (
    <div className="inf-bzg-edita">
      {!editando && (
        <span className="inf-edita-barra inf-bzg-barra">
          {editado && (
            <span className="inf-edita-marca" title="Este resumen no se recalcula">
              Editado a mano
            </span>
          )}
          <button type="button" className="os-boton" onClick={abrir}>
            Editar el resumen
          </button>
        </span>
      )}

      {editando ? (
        <div className="inf-edita">
          <label className="inf-bzg-campo">
            <span className="os-fundamento-rotulo">
              <span>Resumen</span>
              <em className={`os-fundamento-cuenta${borrador.length >= TOPE_RESUMEN ? ' lleno' : ''}`}>
                {borrador.length} / {TOPE_RESUMEN}
              </em>
            </span>
            <textarea
              className="os-campo"
              rows={7}
              maxLength={TOPE_RESUMEN}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
            />
          </label>
          {error && <p className="os-form-error">{error}</p>}
          <div className="inf-edita-pie">
            <span />
            <div className="inf-edita-acciones">
              {editado && (
                <button
                  type="button"
                  className="os-boton"
                  disabled={guardando}
                  onClick={() => mandar(null)}
                  title="Descarta lo escrito y vuelve a lo que sale de la codificación"
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
                disabled={guardando || !borrador.trim()}
                onClick={() => mandar(borrador.trim())}
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
