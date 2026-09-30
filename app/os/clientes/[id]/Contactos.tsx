'use client';

/**
 * Quién es quién del lado del cliente.
 *
 * Una empresa tiene varias personas y hacen cosas distintas: una o varias piden
 * las evaluaciones y otra recibe la factura. Antes era un campo de texto suelto
 * en la ficha, con lugar para una sola y sin mail.
 *
 * **El mail es lo que va a usar el aviso automático**: quien pide una
 * evaluación desde el portal recibe la confirmación de su solicitud, así que un
 * contacto sin mail queda marcado, sin bloquear nada.
 *
 * Se edita en la misma fila y no en un cajón: son cuatro datos y dos marcas, y
 * abrir una ventana para cambiar un teléfono es más trabajo que el cambio.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Contacto } from '@/lib/contactos-tipos';
import Whatsapp from '../../psicotecnicos/Whatsapp';

/** Una fila en edición, o la que se está dando de alta. */
type Borrador = {
  id: string | null;
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
  pide: boolean;
  facturacion: boolean;
};

const VACIO: Borrador = {
  id: null,
  nombre: '',
  cargo: '',
  email: '',
  telefono: '',
  pide: true,
  facturacion: false,
};

function desde(c: Contacto): Borrador {
  return {
    id: c.id,
    nombre: c.nombre,
    cargo: c.cargo ?? '',
    email: c.email ?? '',
    telefono: c.telefono ?? '',
    pide: c.pide,
    facturacion: c.facturacion,
  };
}

export default function Contactos({
  empresaId,
  contactos,
}: {
  empresaId: string;
  contactos: Contacto[];
}) {
  const router = useRouter();
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mandar(cuerpo: Record<string, unknown>) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/contactos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, ...cuerpo }),
      });
      const r = await res.json().catch(() => ({ error: 'Sin respuesta.' }));
      if (!res.ok) {
        setError(r.error ?? 'No se pudo guardar.');
        return false;
      }
      setBorrador(null);
      router.refresh();
      return true;
    } finally {
      setGuardando(false);
    }
  }

  /**
   * La fila en edición.
   *
   * Es una función que devuelve el marcado y no un componente declarado acá
   * adentro: un componente definido dentro de otro es un tipo nuevo en cada
   * dibujo, así que React lo desmonta y lo vuelve a montar en cada tecla, el
   * campo pierde el foco y lo escrito se va con él.
   */
  function formulario(b: Borrador) {
    return (
      <div className="os-contacto os-contacto-edita">
        <div className="os-contacto-campos">
          <input
            className="os-campo"
            placeholder="Nombre y apellido"
            value={b.nombre}
            autoFocus
            onChange={(e) => setBorrador({ ...b, nombre: e.target.value })}
          />
          <input
            className="os-campo"
            placeholder="Cargo"
            value={b.cargo}
            onChange={(e) => setBorrador({ ...b, cargo: e.target.value })}
          />
          <input
            className="os-campo"
            type="email"
            placeholder="Mail"
            value={b.email}
            onChange={(e) => setBorrador({ ...b, email: e.target.value })}
          />
          <input
            className="os-campo"
            type="tel"
            placeholder="WhatsApp"
            value={b.telefono}
            onChange={(e) => setBorrador({ ...b, telefono: e.target.value })}
          />
        </div>

        <div className="os-contacto-marcas">
          <label className="os-contacto-marca">
            <input
              type="checkbox"
              checked={b.pide}
              onChange={(e) => setBorrador({ ...b, pide: e.target.checked })}
            />
            Pide evaluaciones
          </label>
          <label className="os-contacto-marca">
            <input
              type="checkbox"
              checked={b.facturacion}
              onChange={(e) => setBorrador({ ...b, facturacion: e.target.checked })}
            />
            Recibe la factura
          </label>
        </div>

        <div className="os-contacto-acciones">
          <button
            className="os-boton os-boton-azul"
            disabled={guardando || !b.nombre.trim()}
            onClick={() => mandar({ ...b, id: b.id ?? undefined })}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="os-boton" disabled={guardando} onClick={() => setBorrador(null)}>
            Cancelar
          </button>
        </div>
        {error && <p className="os-form-error">{error}</p>}
      </div>
    );
  }

  return (
    /* Va adentro de la tarjeta de datos de la empresa, como su segunda parte:
       quién pide y quién paga es un dato más del cliente. */
    <section className="os-cliente-contactos">
      <div className="os-panel-top">
        <h2>Contactos</h2>
        {!borrador && (
          <button className="os-boton" onClick={() => setBorrador(VACIO)}>
            Agregar contacto
          </button>
        )}
      </div>

      <div className="os-panel-cuerpo">
        {borrador?.id === null && formulario(borrador)}

        {contactos.length === 0 && !borrador && (
          <p className="os-vacio">
            Todavía no hay nadie cargado. Hace falta al menos quien pide las
            evaluaciones: es quien elige el portal al cargar un pedido y quien
            recibe la confirmación.
          </p>
        )}

        {contactos.map((c) =>
          borrador?.id === c.id ? (
            <div key={c.id}>{formulario(borrador)}</div>
          ) : (
            <div className="os-contacto os-contacto-fila" key={c.id}>
              {/* Todo en un renglón: nombre, cargo, mail, WhatsApp y qué hace. */}
              <span className="os-contacto-nombre">{c.nombre}</span>
              <span className="os-tabla-flojo">{c.cargo ?? ''}</span>
              {c.email ? (
                <a className="os-contacto-mail" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              ) : (
                <span
                  className="os-dato-falta"
                  title="Sin mail no le llega la confirmación de lo que pide."
                >
                  sin mail
                </span>
              )}
              {/* El teléfono del contacto es su WhatsApp: con el enlace, se le
                  escribe de un toque, como al candidato. */}
              {c.telefono ? <Whatsapp telefono={c.telefono} /> : <span />}

              <div className="os-contacto-acciones">
                {/* Íconos y no palabras: son dos acciones por renglón, y con
                    texto se llevaban un tercio de la fila. Lo que hacen lo
                    dicen al pasar el mouse y al lector de pantalla. */}
                <button
                  className="os-boton os-boton-icono"
                  onClick={() => setBorrador(desde(c))}
                  title="Editar"
                  aria-label={`Editar a ${c.nombre}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  className="os-boton os-boton-icono"
                  disabled={guardando}
                  onClick={() => mandar({ id: c.id, baja: true })}
                  title="Dar de baja: deja de estar entre los que se eligen. Las facturas viejas lo conservan."
                  aria-label={`Dar de baja a ${c.nombre}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 11v5M13.5 11v5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
