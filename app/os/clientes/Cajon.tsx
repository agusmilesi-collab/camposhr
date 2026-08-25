'use client';

/**
 * La ficha de un cliente en un cajón.
 *
 * El mismo cajón da de alta y edita: los campos son los mismos y tener dos
 * formularios significa arreglar cada cosa dos veces. Entra desde la derecha y
 * no empuja la tabla, así se carga o se corrige un cliente sin perder de vista
 * la lista que se estaba mirando.
 *
 * Pide los datos de facturación además del nombre, porque si el alta no puede
 * cargar el CUIT hay que ir igual a Airtable y el alta no sirvió de nada.
 *
 * Al editar muestra además sus pedidos, que es lo que se va a mirar cuando
 * alguien pregunte por un cliente, y el borrado.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CONDICIONES_IVA } from '@/lib/clientes-tipos';
import type { Cliente } from '@/lib/clientes';
import { fechaCorta } from '@/lib/hora';

export default function Cajon({
  cliente,
  alCerrar,
}: {
  /** El cliente que se edita, o null para dar de alta uno nuevo. */
  cliente: Cliente | null;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const editando = Boolean(cliente?.id);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form).entries());
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, id: cliente?.id ?? '' }),
      });
      const r = await res.json();
      if (!res.ok) {
        setError(r.error ?? 'No se pudo guardar.');
        return;
      }
      form.reset();
      alCerrar();
      router.refresh();
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  async function borrar() {
    if (!cliente?.id) return;
    setBorrando(true);
    setError(null);
    try {
      const res = await fetch(`/api/os/clientes?id=${cliente.id}`, { method: 'DELETE' });
      const r = await res.json();
      if (!res.ok) {
        setError(r.error ?? 'No se pudo borrar.');
        setConfirmando(false);
        return;
      }
      alCerrar();
      router.refresh();
    } catch {
      setError('No se pudo borrar.');
    } finally {
      setBorrando(false);
    }
  }

  const v = (x: string | number | null | undefined) => (x === null || x === undefined ? '' : String(x));

  return (
    <>
      <button className="os-cajon-fondo" aria-label="Cerrar" onClick={alCerrar} />
      <div className="os-cajon">
        <div className="os-cajon-top">
          <h2>{editando ? cliente?.nombre : 'Nuevo cliente'}</h2>
          <button className="os-cajon-cerrar" onClick={alCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="os-cajon-cuerpo">
          <form className="os-form" onSubmit={enviar}>
            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="nombre">
                Nombre
              </label>
              <input
                className="os-campo"
                id="nombre"
                name="nombre"
                required
                maxLength={120}
                autoFocus={!editando}
                defaultValue={v(cliente?.nombre)}
              />
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="razonSocial">
                Razón social
              </label>
              <input
                className="os-campo"
                id="razonSocial"
                name="razonSocial"
                maxLength={160}
                defaultValue={v(cliente?.razonSocial)}
              />
            </div>

            <div className="os-campo-bloque">
              <label className="os-etiqueta-campo" htmlFor="cuit">
                CUIT
              </label>
              <input
                className="os-campo"
                id="cuit"
                name="cuit"
                maxLength={20}
                inputMode="numeric"
                defaultValue={v(cliente?.cuit)}
              />
            </div>

            <div className="os-campo-bloque">
              <label className="os-etiqueta-campo" htmlFor="condicionIva">
                Condición de IVA
              </label>
              <select
                className="os-campo"
                id="condicionIva"
                name="condicionIva"
                defaultValue={v(cliente?.condicionIva)}
              >
                <option value="">Sin definir</option>
                {CONDICIONES_IVA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="direccionFiscal">
                Dirección fiscal
              </label>
              <input
                className="os-campo"
                id="direccionFiscal"
                name="direccionFiscal"
                maxLength={200}
                defaultValue={v(cliente?.direccionFiscal)}
              />
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="emailFacturacion">
                Correo de facturación
              </label>
              <input
                className="os-campo"
                id="emailFacturacion"
                name="emailFacturacion"
                type="email"
                maxLength={160}
                defaultValue={v(cliente?.emailFacturacion)}
              />
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="contacto">
                Contacto
              </label>
              <input
                className="os-campo"
                id="contacto"
                name="contacto"
                maxLength={160}
                defaultValue={v(cliente?.contacto)}
              />
            </div>

            <div className="os-campo-bloque">
              <label className="os-etiqueta-campo" htmlFor="rubro">
                Rubro
              </label>
              <input
                className="os-campo"
                id="rubro"
                name="rubro"
                maxLength={120}
                defaultValue={v(cliente?.rubro)}
              />
            </div>

            <div className="os-campo-bloque">
              <label className="os-etiqueta-campo" htmlFor="tamano">
                Personas
              </label>
              <input
                className="os-campo"
                id="tamano"
                name="tamano"
                type="number"
                min="1"
                defaultValue={v(cliente?.tamano)}
              />
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="notas">
                Notas
              </label>
              <textarea
                className="os-campo"
                id="notas"
                name="notas"
                rows={3}
                maxLength={2000}
                defaultValue={v(cliente?.notas)}
              />
            </div>

            {error && <p className="os-form-error os-campo-entero">{error}</p>}

            <div className="os-campo-entero os-form-pie">
              <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
                {enviando ? 'Guardando…' : editando ? 'Guardar' : 'Cargar el cliente'}
              </button>
              <button className="os-boton" type="button" onClick={alCerrar}>
                Cancelar
              </button>
            </div>
          </form>

          {editando && (
            <>
              <section className="os-cajon-bloque">
                <h3 className="os-cajon-subtitulo">Sus pedidos</h3>
                {cliente!.susPedidos.length === 0 ? (
                  <p className="os-vacio">Todavía no tiene pedidos cargados.</p>
                ) : (
                  <ul className="os-cajon-lista">
                    {cliente!.susPedidos.map((p) => (
                      <li key={p.id}>
                        <a className="os-cajon-item" href={`/os/pedidos/${p.id}`}>
                          <span className="os-cajon-item-titulo">{p.puesto}</span>
                          <span className="os-cajon-item-detalle">
                            {[
                              p.estado,
                              fechaCorta(p.fecha),
                              p.evaluaciones
                                ? `${p.evaluaciones} ${p.evaluaciones === 1 ? 'persona' : 'personas'}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* El borrado va al final y en dos pasos: es lo único de esta
                  pantalla que no se puede deshacer. */}
              <section className="os-cajon-bloque">
                {confirmando ? (
                  <div className="os-cajon-borrar">
                    <span>¿Borrar {cliente!.nombre}?</span>
                    <button
                      className="os-boton os-boton-peligro"
                      type="button"
                      onClick={borrar}
                      disabled={borrando}
                    >
                      {borrando ? 'Borrando…' : 'Sí, borrar'}
                    </button>
                    <button
                      className="os-boton"
                      type="button"
                      onClick={() => setConfirmando(false)}
                      disabled={borrando}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="os-enlace-boton"
                    type="button"
                    onClick={() => setConfirmando(true)}
                  >
                    Borrar este cliente
                  </button>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
