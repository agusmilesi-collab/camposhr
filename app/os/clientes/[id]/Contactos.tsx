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
import { queHace, type Contacto } from '@/lib/contactos-tipos';

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
            placeholder="Teléfono"
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
    <section className="os-panel os-panel-separado">
      <div className="os-panel-top">
        <h2>Contactos</h2>
        <span className="os-columna-monto">
          {contactos.length === 0
            ? 'ninguno cargado'
            : contactos.length === 1
              ? '1 persona'
              : `${contactos.length} personas`}
        </span>
        {!borrador && (
          <button className="os-boton" onClick={() => setBorrador(VACIO)}>
            Agregar
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
            <div className="os-contacto" key={c.id}>
              <div className="os-contacto-quien">
                <span className="os-contacto-nombre">{c.nombre}</span>
                {c.cargo && <span className="os-tabla-flojo">{c.cargo}</span>}
              </div>

              <div className="os-contacto-datos">
                {c.email ? (
                  <a href={`mailto:${c.email}`}>{c.email}</a>
                ) : (
                  <span
                    className="os-dato-falta"
                    title="Sin mail no le llega la confirmación de lo que pide."
                  >
                    sin mail
                  </span>
                )}
                {c.telefono && <span className="os-tabla-flojo">{c.telefono}</span>}
              </div>

              <span className="os-contacto-hace">{queHace(c)}</span>

              <div className="os-contacto-acciones">
                <button className="os-boton" onClick={() => setBorrador(desde(c))}>
                  Editar
                </button>
                <button
                  className="os-boton"
                  disabled={guardando}
                  onClick={() => mandar({ id: c.id, baja: true })}
                  title="Deja de estar entre los que se eligen. Las facturas viejas lo conservan."
                >
                  Dar de baja
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
