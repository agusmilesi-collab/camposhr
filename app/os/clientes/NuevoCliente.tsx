'use client';

/**
 * Alta de cliente en un cajón.
 *
 * Entra desde la derecha y no empuja la tabla: se carga un cliente sin perder
 * de vista la lista que se estaba mirando.
 *
 * Pide los datos de facturación además del nombre, porque si el alta no puede
 * cargar el CUIT hay que ir igual a Airtable y el alta no sirvió de nada.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CONDICIONES_IVA } from '@/lib/clientes-tipos';

export default function NuevoCliente() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify(datos),
      });
      const r = await res.json();
      if (!res.ok) {
        setError(r.error ?? 'No se pudo guardar.');
        return;
      }
      form.reset();
      setAbierto(false);
      router.refresh();
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button className="os-boton os-boton-firme" onClick={() => setAbierto(true)}>
        Nuevo cliente
      </button>

      {abierto && (
        <>
          <button className="os-cajon-fondo" aria-label="Cerrar" onClick={() => setAbierto(false)} />
          <div className="os-cajon">
            <div className="os-cajon-top">
              <h2>Nuevo cliente</h2>
              <button
                className="os-cajon-cerrar"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="os-cajon-cuerpo">
              <form className="os-form" onSubmit={enviar}>
                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="nombre">
                    Nombre
                  </label>
                  <input className="os-campo" id="nombre" name="nombre" required maxLength={120} autoFocus />
                </div>

                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="razonSocial">
                    Razón social
                  </label>
                  <input className="os-campo" id="razonSocial" name="razonSocial" maxLength={160} />
                </div>

                <div className="os-campo-bloque">
                  <label className="os-etiqueta-campo" htmlFor="cuit">
                    CUIT
                  </label>
                  <input className="os-campo" id="cuit" name="cuit" maxLength={20} inputMode="numeric" />
                </div>

                <div className="os-campo-bloque">
                  <label className="os-etiqueta-campo" htmlFor="condicionIva">
                    Condición de IVA
                  </label>
                  <select className="os-campo" id="condicionIva" name="condicionIva" defaultValue="">
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
                  />
                </div>

                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="contacto">
                    Contacto
                  </label>
                  <input className="os-campo" id="contacto" name="contacto" maxLength={160} />
                </div>

                <div className="os-campo-bloque">
                  <label className="os-etiqueta-campo" htmlFor="rubro">
                    Rubro
                  </label>
                  <input className="os-campo" id="rubro" name="rubro" maxLength={120} />
                </div>

                <div className="os-campo-bloque">
                  <label className="os-etiqueta-campo" htmlFor="tamano">
                    Personas
                  </label>
                  <input className="os-campo" id="tamano" name="tamano" type="number" min="1" />
                </div>

                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="notas">
                    Notas
                  </label>
                  <textarea className="os-campo" id="notas" name="notas" rows={3} maxLength={2000} />
                </div>

                {error && <p className="os-form-error">{error}</p>}

                <div className="os-campo-entero os-form-pie">
                  <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
                    {enviando ? 'Guardando…' : 'Cargar el cliente'}
                  </button>
                  <button className="os-boton" type="button" onClick={() => setAbierto(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
