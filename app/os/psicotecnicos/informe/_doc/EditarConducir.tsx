'use client';

/**
 * Reescribir "Cómo conducir a esta persona" para una persona, como se edita el
 * capítulo Benziger.
 *
 * Son los renglones del Benziger para el líder (motivación, devoluciones,
 * autonomía…). Se guarda **solo el renglón que cambió** respecto de
 * Configuración, en `informe_listas.conducir`: el que no se tocó sigue a los
 * textos de Configuración, y un cambio ahí le llega.
 *
 * Fuera de la ficha (`id` vacío) no dibuja nada propio: muestra la lista tal
 * cual, que es lo que imprime la descarga y lee el portal.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Renglon = { clave: string; rotulo: string; texto: string; calculado: string; editado: boolean };

export default function EditarConducir({
  id,
  renglones,
  children,
}: {
  id?: string;
  renglones: Renglon[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervenido = renglones.some((r) => r.editado);

  if (!id) return <>{children}</>;

  function abrir() {
    setBorrador(Object.fromEntries(renglones.map((r) => [r.clave, r.texto])));
    setError(null);
    setEditando(true);
  }

  async function mandar(cuerpo: Record<string, string> | null) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/informe-listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, lista: 'conducir', items: cuerpo }),
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

  /** Solo lo que quedó distinto de Configuración. */
  function diferencias() {
    return Object.fromEntries(
      renglones
        .map((r) => [r.clave, (borrador[r.clave] ?? '').trim(), r.calculado] as const)
        .filter(([, v, calculado]) => v && v !== calculado)
        .map(([k, v]) => [k, v])
    );
  }

  return (
    <div className="inf-bzg-edita">
      {!editando && (
        <span className="inf-edita-barra inf-bzg-barra">
          {intervenido && (
            <span className="inf-edita-marca" title="Esta sección tiene texto escrito a mano">
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
          {renglones.map((r) => (
            <label key={r.clave} className="inf-bzg-campo">
              <span>{r.rotulo}</span>
              <textarea
                className="os-campo"
                rows={3}
                value={borrador[r.clave] ?? ''}
                onChange={(e) => setBorrador((b) => ({ ...b, [r.clave]: e.target.value }))}
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
