'use client';

/**
 * Quién es quién del lado del cliente.
 *
 * Son dos listas porque son dos preguntas distintas:
 *
 * - **Quién solicita**: las personas que piden evaluaciones, y qué avisos le
 *   llegan a cada una por correo (orden de compra, entrevista agendada,
 *   informe listo). Pedir y recibir avisos van en columnas separadas: una
 *   gerencia puede estar en copia de todo sin pedir nada.
 * - **Responsable de compras**: quien recibe las facturas y los recibos de
 *   pago. **Si no hay ninguno, la factura le llega a quien solicitó el
 *   candidato**, y la lista vacía lo dice.
 *
 * La misma persona puede estar en las dos. La regla de a quién va cada correo
 * está en `lib/correo-destinos.ts`.
 *
 * Se edita en la misma fila y no en un cajón: son cuatro datos y unas marcas, y
 * abrir una ventana para cambiar un teléfono es más trabajo que el cambio.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AVISOS, type Contacto } from '@/lib/contactos-tipos';
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
  recibeOrden: boolean;
  recibeEntrevista: boolean;
  recibeInforme: boolean;
  recibeTodo: boolean;
};

/** El alta desde "Quién solicita": pide y recibe sus avisos. */
const SOLICITA: Borrador = {
  id: null,
  nombre: '',
  cargo: '',
  email: '',
  telefono: '',
  pide: true,
  facturacion: false,
  recibeOrden: true,
  recibeEntrevista: true,
  // El aviso de informe está apagado: nace destildado hasta que se prenda.
  recibeInforme: false,
  recibeTodo: false,
};

/** El alta desde "Responsable de compras": solo recibe facturas y recibos. */
const COMPRAS: Borrador = {
  ...SOLICITA,
  pide: false,
  facturacion: true,
  recibeOrden: false,
  recibeEntrevista: false,
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
    recibeOrden: c.recibeOrden,
    recibeEntrevista: c.recibeEntrevista,
    recibeInforme: c.recibeInforme,
    recibeTodo: c.recibeTodo,
  };
}

const recibeAvisos = (c: { recibeOrden: boolean; recibeEntrevista: boolean; recibeInforme: boolean }) =>
  c.recibeOrden || c.recibeEntrevista || c.recibeInforme;

/** Un tilde de solo lectura, en su columna. Se cambia con el lápiz. */
function Tilde({ si, que, rotulo }: { si: boolean; que: string; rotulo: string }) {
  return (
    // El rótulo viaja para el teléfono, donde no hay cabecera de columnas.
    <span className="os-ctc-tilde" title={`${si ? '' : 'No '}${que}`} data-rotulo={rotulo}>
      <span className={`os-chequeo-caja${si ? ' si' : ''}`} aria-hidden="true">
        {si ? '✓' : ''}
      </span>
      <span className="os-oculto">{`${si ? '' : 'No '}${que}`}</span>
    </span>
  );
}

const LAPIZ = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </svg>
);

const TACHO = (
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
);

export default function Contactos({
  empresaId,
  contactos,
}: {
  empresaId: string;
  contactos: Contacto[];
}) {
  const router = useRouter();
  /** La fila en edición y en cuál de las dos listas se abrió. */
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [lista, setLista] = useState<'solicita' | 'compras'>('solicita');
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

  function abrir(b: Borrador, donde: 'solicita' | 'compras') {
    setError(null);
    setLista(donde);
    setBorrador(b);
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

        {/* Tres preguntas, una por renglón: qué hace, qué le llega, y si
            además es quien paga. */}
        <div className="os-ctc-grupos">
          <div className="os-ctc-grupo">
            <span className="os-ctc-rotulo">Qué hace</span>
            <label className="os-contacto-marca">
              <input
                type="checkbox"
                checked={b.pide}
                onChange={(e) => setBorrador({ ...b, pide: e.target.checked })}
              />
              Solicita evaluaciones
            </label>
            <label className="os-contacto-marca">
              <input
                type="checkbox"
                checked={b.facturacion}
                onChange={(e) => setBorrador({ ...b, facturacion: e.target.checked })}
              />
              Es responsable de compras: recibe las facturas y los recibos de pago
            </label>
          </div>

          <div className="os-ctc-grupo">
            <span className="os-ctc-rotulo">Recibe por correo</span>
            {AVISOS.map((a) => (
              <label className="os-contacto-marca" key={a.campo}>
                <input
                  type="checkbox"
                  checked={b[a.campo]}
                  onChange={(e) => setBorrador({ ...b, [a.campo]: e.target.checked })}
                />
                {a.texto}
              </label>
            ))}
            {/* Quien no pide nada solo puede recibir lo de los demás. */}
            <label className="os-contacto-marca">
              <input
                type="checkbox"
                checked={recibeAvisos(b) && (b.recibeTodo || !b.pide)}
                disabled={!b.pide || !recibeAvisos(b)}
                onChange={(e) => setBorrador({ ...b, recibeTodo: e.target.checked })}
              />
              También de los candidatos que piden otros
            </label>
          </div>
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

  /** Nombre, cargo, mail y WhatsApp: lo mismo en las dos listas. */
  function datos(c: Contacto) {
    return (
      <>
        <span className="os-contacto-nombre">{c.nombre}</span>
        <span className="os-tabla-flojo">{c.cargo ?? ''}</span>
        {c.email ? (
          <a className="os-contacto-mail" href={`mailto:${c.email}`}>
            {c.email}
          </a>
        ) : (
          <span className="os-dato-falta" title="Sin mail no le llega ningún correo.">
            sin mail
          </span>
        )}
        {/* El teléfono del contacto es su WhatsApp: con el enlace, se le
            escribe de un toque, como al candidato. */}
        {c.telefono ? <Whatsapp telefono={c.telefono} /> : <span />}
      </>
    );
  }

  function editar(c: Contacto, donde: 'solicita' | 'compras') {
    return (
      <button
        className="os-boton os-boton-icono"
        onClick={() => abrir(desde(c), donde)}
        title="Editar"
        aria-label={`Editar a ${c.nombre}`}
      >
        {LAPIZ}
      </button>
    );
  }

  const enEdicion = (c: Contacto, donde: 'solicita' | 'compras') =>
    borrador?.id === c.id && lista === donde;

  // Quien pide o recibe algún aviso va arriba; quien paga, abajo. La misma
  // persona puede estar en las dos.
  const solicitan = contactos.filter((c) => c.pide || recibeAvisos(c));
  const compras = contactos.filter((c) => c.facturacion);

  return (
    /* Va adentro de la tarjeta de datos de la empresa, como su segunda parte:
       quién pide y quién paga es un dato más del cliente. */
    <section className="os-cliente-contactos">
      {/* ------------------------------------------------ quién solicita */}
      <div className="os-panel-top">
        <h2>Quién solicita</h2>
        {!borrador && (
          <button className="os-boton" onClick={() => abrir(SOLICITA, 'solicita')}>
            Agregar contacto
          </button>
        )}
      </div>

      <div className="os-panel-cuerpo">
        {borrador?.id === null && lista === 'solicita' && formulario(borrador)}

        {solicitan.length === 0 && !(borrador && lista === 'solicita') && (
          <p className="os-vacio">
            Todavía no hay nadie cargado. Hace falta al menos quien pide las evaluaciones: es quien
            elige el portal al cargar un pedido y quien recibe los avisos.
          </p>
        )}

        {solicitan.length > 0 && (
          /* Los rótulos una sola vez, arriba, y debajo solo los tildes: con el
             rótulo repetido en cada fila no se leía ninguno. */
          <div className="os-contacto os-ctc-fila os-ctc-cabeza" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span className="os-ctc-tildes">
              <span className="os-ctc-col">Solicita</span>
              <span className="os-ctc-raya" />
              <span className="os-ctc-sobre">Recibe por correo</span>
              {AVISOS.map((a) => (
                <span className="os-ctc-col" key={a.campo}>
                  {a.fila}
                </span>
              ))}
              <span className="os-ctc-col">De todos</span>
            </span>
            <span />
          </div>
        )}

        {solicitan.map((c) =>
          enEdicion(c, 'solicita') ? (
            <div key={c.id}>{formulario(borrador as Borrador)}</div>
          ) : (
            <div className="os-contacto os-ctc-fila" key={c.id}>
              {datos(c)}
              <span className="os-ctc-tildes">
                <Tilde si={c.pide} que="solicita evaluaciones" rotulo="Solicita" />
                <span className="os-ctc-raya" />
                {AVISOS.map((a) => (
                  <Tilde
                    si={c[a.campo]}
                    que={`recibe por correo: ${a.texto.toLowerCase()}`}
                    rotulo={a.fila}
                    key={a.campo}
                  />
                ))}
                <Tilde
                  si={c.recibeTodo && recibeAvisos(c)}
                  que="recibe también lo de los candidatos que piden otros"
                  rotulo="De todos"
                />
              </span>
              <div className="os-contacto-acciones">
                {/* Íconos y no palabras: son dos acciones por renglón, y con
                    texto se llevaban un tercio de la fila. Lo que hacen lo
                    dicen al pasar el mouse y al lector de pantalla. */}
                {editar(c, 'solicita')}
                <button
                  className="os-boton os-boton-icono"
                  disabled={guardando}
                  onClick={() => mandar({ id: c.id, baja: true })}
                  title="Dar de baja: deja de estar entre los que se eligen. Las facturas viejas lo conservan."
                  aria-label={`Dar de baja a ${c.nombre}`}
                >
                  {TACHO}
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      {/* ------------------------------------------ responsable de compras */}
      <div className="os-panel-top os-ctc-segunda">
        <h2>Responsable de compras</h2>
        {!borrador && (
          <button className="os-boton" onClick={() => abrir(COMPRAS, 'compras')}>
            Agregar responsable
          </button>
        )}
      </div>

      <div className="os-panel-cuerpo">
        {borrador?.id === null && lista === 'compras' && formulario(borrador)}

        {compras.length === 0 && !(borrador && lista === 'compras') && (
          <p className="os-vacio">
            No hay responsable de compras cargado: la factura y el recibo de pago le llegan a quien
            solicitó el candidato.
          </p>
        )}

        {compras.map((c) =>
          enEdicion(c, 'compras') ? (
            <div key={c.id}>{formulario(borrador as Borrador)}</div>
          ) : (
            <div className="os-contacto os-ctc-fila os-ctc-fila-compras" key={c.id}>
              {datos(c)}
              <span className="os-ctc-nota">Recibe las facturas y los recibos de pago</span>
              <div className="os-contacto-acciones">
                {editar(c, 'compras')}
                {/* Quien además solicita sigue arriba: de acá solo se lo saca
                    de compras. Quien solo paga se da de baja. */}
                <button
                  className="os-boton os-boton-icono"
                  disabled={guardando}
                  onClick={() =>
                    c.pide || recibeAvisos(c)
                      ? mandar({ ...desde(c), facturacion: false })
                      : mandar({ id: c.id, baja: true })
                  }
                  title={
                    c.pide || recibeAvisos(c)
                      ? 'Sacar de compras: sigue entre quienes solicitan.'
                      : 'Dar de baja. Las facturas viejas lo conservan.'
                  }
                  aria-label={`Sacar a ${c.nombre} de compras`}
                >
                  {TACHO}
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
