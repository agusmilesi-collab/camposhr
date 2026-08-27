'use client';

/**
 * Los datos de un candidato, en un cajón.
 *
 * Trae los cinco campos que se cargaron al darlo de alta y nada más: pedido,
 * nombre, teléfono, correo y evaluadora, más el CV. Corregir un teléfono mal
 * tipeado no debería costar salir de la pantalla y volver.
 *
 * Se abre desde la pestaña Datos de su ficha, que es donde esos campos se leen.
 * Estaba colgado de la tarjeta del tablero, y ahí competía con lo que la
 * tarjeta hace, que es arrastrarse entre columnas.
 *
 * La etapa se muestra y no se edita: se cambia arrastrando la tarjeta en el
 * tablero. La evaluadora sí, y sigue la misma regla que el arrastre: darle
 * dueño a alguien que estaba en "Sin asignar" la manda a "Por citar", y
 * sacárselo la trae de vuelta.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { COLOR_ETAPA, type Origen } from '@/lib/psicotecnicos-tipos';
import type { PedidoOpcion } from './Agregar';
import SoltarArchivo from '@/app/os/SoltarArchivo';

/**
 * Lo que el cajón necesita saber del candidato.
 *
 * Son once campos y no la evaluación entera: así lo alimenta tanto el tablero,
 * que tiene una `Evaluacion`, como la ficha, que tiene otra cosa, sin que
 * ninguno de los dos tenga que fabricar los campos que no usa.
 */
export type DatosDelCandidato = {
  id: string;
  /** De qué lado vive esta fila. Decide a dónde va un guardado. */
  origen: Origen;
  nombre: string;
  empresa: string;
  puesto: string;
  pedidoId: string | null;
  email: string | null;
  telefono: string | null;
  evaluadora: string | null;
  etapa: string;
  /** Si la persona ya tiene el CV guardado. */
  tieneCv: boolean;
};

export default function Candidato({
  e,
  pedidos,
  evaluadoras,
  enLaFicha = false,
  onCerrar,
}: {
  e: DatosDelCandidato;
  pedidos: PedidoOpcion[];
  evaluadoras: string[];
  /** Abierto desde la ficha: ahí no se ofrece volver a abrirla. */
  enLaFicha?: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [enviando, setEnviando] = useState(false);
  /** El campo del CV: el archivo soltado se mete acá, que es el que se manda. */
  const cv = useRef<HTMLInputElement>(null);
  const [borrando, setBorrando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Una fila que todavía vive en Airtable se trabaja de aquel lado: el OS no
  // le escribe (ver `CLAUDE.md`).
  const editable = e.origen === 'supabase';

  useEffect(() => {
    function tecla(ev: KeyboardEvent) {
      if (ev.key === 'Escape') onCerrar();
    }
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  // El pedido puede no estar entre los abiertos: el suyo pudo cerrarse
  // después. Se suma a la lista para que el selector no lo pierda de vista.
  const opciones = pedidos.some((p) => p.id === e.pedidoId)
    ? pedidos
    : [
        ...(e.pedidoId ? [{ id: e.pedidoId, empresa: e.empresa, puesto: e.puesto }] : []),
        ...pedidos,
      ];

  async function guardar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const datos = new FormData(ev.currentTarget);
    datos.set('id', e.id);
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch('/api/os/candidatos', { method: 'POST', body: datos });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      empezar(() => router.refresh());
      onCerrar();
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  async function borrar() {
    setError(null);
    setBorrando(true);
    try {
      const res = await fetch('/api/os/candidatos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: e.id }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo borrar.');
        setConfirmando(false);
        return;
      }
      empezar(() => router.refresh());
      onCerrar();
    } catch {
      setError('No se pudo borrar.');
      setConfirmando(false);
    } finally {
      setBorrando(false);
    }
  }

  return (
    <>
      <button className="os-cajon-fondo" aria-label="Cerrar" onClick={onCerrar} />
      <div className="os-cajon" role="dialog" aria-modal="true" aria-labelledby="candidato">
        <div className="os-cajon-top">
          <h2 id="candidato">{e.nombre}</h2>
          <button className="os-cajon-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="os-cajon-cuerpo">
          <p className="os-cajon-sello">
            <span className={`os-sello-estado ${COLOR_ETAPA[e.etapa] ?? 'os-gris'}`}>
              {e.etapa}
            </span>
            <span>{e.empresa}</span>
          </p>

          {!editable && (
            <div className="os-aviso">
              Esta fila todavía vive en Airtable y se corrige desde ahí.
            </div>
          )}

          <form className="os-form" onSubmit={guardar}>
            <fieldset className="os-form-campos" disabled={!editable}>
              <div className="os-campo-bloque os-campo-entero">
                <label className="os-etiqueta-campo" htmlFor="pedidoId">
                  Para qué pedido
                </label>
                <select
                  className="os-campo"
                  id="pedidoId"
                  name="pedidoId"
                  defaultValue={e.pedidoId ?? ''}
                >
                  {opciones.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.empresa} · {p.puesto}
                    </option>
                  ))}
                </select>
              </div>

              <div className="os-campo-bloque os-campo-entero">
                <label className="os-etiqueta-campo" htmlFor="nombre">
                  Nombre y apellido
                </label>
                <input
                  className="os-campo"
                  id="nombre"
                  name="nombre"
                  required
                  maxLength={120}
                  defaultValue={e.nombre}
                />
              </div>

              <div className="os-campo-bloque">
                <label className="os-etiqueta-campo" htmlFor="telefono">
                  Teléfono
                </label>
                <input
                  className="os-campo"
                  id="telefono"
                  name="telefono"
                  type="tel"
                  maxLength={40}
                  defaultValue={e.telefono ?? ''}
                />
              </div>

              <div className="os-campo-bloque">
                <label className="os-etiqueta-campo" htmlFor="email">
                  Correo
                </label>
                <input
                  className="os-campo"
                  id="email"
                  name="email"
                  type="email"
                  maxLength={120}
                  defaultValue={e.email ?? ''}
                />
              </div>

              <div className="os-campo-bloque os-campo-entero">
                <label className="os-etiqueta-campo" htmlFor="evaluadora">
                  Evaluadora
                </label>
                <select
                  className="os-campo"
                  id="evaluadora"
                  name="evaluadora"
                  defaultValue={e.evaluadora ?? ''}
                >
                  <option value="">Sin asignar</option>
                  {evaluadoras.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="os-campo-bloque os-campo-entero">
                <label className="os-etiqueta-campo" htmlFor="cv">
                  {e.tieneCv ? 'CV cargado · subí otro para reemplazarlo' : 'CV'}
                </label>
                {/* Se elige o se suelta encima: el archivo que viene de un mail
                    ya está a la vista y abrir el buscador es el paso que sobra.
                    El input es el que viaja con el formulario, así que el
                    soltado se mete ahí. */}
                <SoltarArchivo
                  onArchivos={(xs) => {
                    if (!cv.current || !xs[0]) return;
                    const lista = new DataTransfer();
                    lista.items.add(xs[0]);
                    cv.current.files = lista.files;
                  }}
                  aviso="Soltá el CV"
                >
                  <input
                    ref={cv}
                    className="os-campo os-agregar-archivo"
                    id="cv"
                    name="cv"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf"
                  />
                </SoltarArchivo>
              </div>
            </fieldset>

            {error && <p className="os-form-error">{error}</p>}

            <div className="os-campo-entero os-form-pie">
              <button
                className="os-boton os-boton-firme"
                type="submit"
                disabled={enviando || !editable}
              >
                {enviando ? 'Guardando…' : 'Guardar'}
              </button>
              {/* El salto a la ficha solo cuando el cajón se abrió desde otro
                  lado: adentro de la ficha, ofrecer abrirla no lleva a ningún
                  lado. */}
              {!enLaFicha && (
                <Link className="os-boton" href={`/os/psicotecnicos/ficha/${e.id}`}>
                  Abrir la ficha completa
                </Link>
              )}
            </div>
          </form>

          {editable && (
            <div className="os-cajon-riesgo">
              {confirmando ? (
                <>
                  <p>
                    Se borra {e.nombre} de la base, con las manchas, los tests y el
                    informe que tenga cargados. No se puede deshacer.
                  </p>
                  <div className="os-form-pie">
                    <button
                      type="button"
                      className="os-boton os-boton-peligro"
                      onClick={borrar}
                      disabled={borrando}
                    >
                      {borrando ? 'Borrando…' : 'Sí, borrar'}
                    </button>
                    <button
                      type="button"
                      className="os-boton"
                      onClick={() => setConfirmando(false)}
                    >
                      No
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="os-enlace-boton os-enlace-peligro"
                  onClick={() => setConfirmando(true)}
                >
                  Borrar el candidato
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
