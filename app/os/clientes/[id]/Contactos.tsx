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
 * Las marcas se tildan en la fila misma y se guardan al tocarlas; el lápiz abre
 * solo los datos (nombre, cargo, mail y WhatsApp), en la misma fila y no en un
 * cajón: abrir una ventana para cambiar un teléfono es más trabajo que el
 * cambio.
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
  // Por defecto le llegan la orden de compra y la factura (que nace tildada
  // en la base). La fecha de entrevista, el informe y el recibo nacen
  // apagados: los prende la persona en el portal.
  recibeOrden: true,
  recibeEntrevista: false,
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

const recibeAvisos = (c: {
  recibeOrden: boolean;
  recibeEntrevista: boolean;
  recibeInforme: boolean;
}) => c.recibeOrden || c.recibeEntrevista || c.recibeInforme;

/** Un tilde en su columna: se cambia tocándolo y se guarda en el acto. */
function Tilde({
  si,
  que,
  rotulo,
  alCambiar,
  deshabilitado = false,
}: {
  si: boolean;
  que: string;
  rotulo: string;
  alCambiar: () => void;
  deshabilitado?: boolean;
}) {
  return (
    // El rótulo viaja para el teléfono, donde no hay cabecera de columnas.
    <button
      type="button"
      role="switch"
      aria-checked={si}
      className="os-ctc-tilde"
      title={`${si ? '' : 'No '}${que}`}
      data-rotulo={rotulo}
      disabled={deshabilitado}
      onClick={alCambiar}
    >
      <span className={`os-chequeo-caja${si ? ' si' : ''}`} aria-hidden="true">
        {si ? '✓' : '✕'}
      </span>
      <span className="os-oculto">{`${si ? '' : 'No '}${que}`}</span>
    </button>
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
  /**
   * Las marcas recién tocadas, mientras el servidor vuelve a dibujar: el tilde
   * cambia al tocarlo y no un segundo después.
   */
  const [tocadas, setTocadas] = useState<Record<string, Partial<Contacto>>>({});
  const vista = (c: Contacto): Contacto => ({ ...c, ...tocadas[c.id] });

  /** Cambiar una marca desde la fila: se guarda con el resto de sus datos. */
  async function marcar(
    c: Contacto,
    cambio: Partial<
      Pick<
        Contacto,
        | 'pide'
        | 'facturacion'
        | 'recibeOrden'
        | 'recibeEntrevista'
        | 'recibeInforme'
        | 'recibeTodo'
        | 'recibeFactura'
        | 'recibeRecibo'
      >
    >,
  ) {
    const antes = tocadas[c.id];
    setTocadas((t) => ({ ...t, [c.id]: { ...t[c.id], ...cambio } }));
    setError(null);
    try {
      const res = await fetch('/api/os/contactos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, ...desde(vista(c)), ...cambio }),
      });
      const r = await res.json().catch(() => ({ error: 'Sin respuesta.' }));
      if (!res.ok) throw new Error(r.error ?? 'No se pudo guardar.');
      router.refresh();
    } catch (e) {
      setTocadas((t) => ({ ...t, [c.id]: antes ?? {} }));
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  }

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

  /**
   * Nombre y WhatsApp: lo mismo en las dos listas. El cargo y el mail no van
   * en la tabla, que es para ver quién recibe qué; se ven y se corrigen con el
   * lápiz.
   */
  function datos(c: Contacto) {
    return (
      <>
        <span className="os-contacto-nombre" title={[c.cargo, c.email].filter(Boolean).join(' · ')}>
          {c.nombre}
        </span>
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
  const todos = contactos.map(vista);
  const solicitan = todos.filter((c) => c.pide || recibeAvisos(c));
  const compras = todos.filter((c) => c.facturacion);

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
        {!borrador && error && <p className="os-form-error">{error}</p>}

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
            <span className="os-ctc-tildes">
              <span className="os-ctc-col">Solicita</span>
              <span className="os-ctc-col">Compras</span>
              <span className="os-ctc-raya" />
              <span className="os-ctc-sobre">Recibe por correo</span>
              {AVISOS.map((a) => (
                <span className="os-ctc-col" key={a.campo}>
                  {a.fila}
                </span>
              ))}
              <span className="os-ctc-col">Factura</span>
              <span className="os-ctc-col">Recibo</span>
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
                <Tilde
                  si={c.pide}
                  que="solicita evaluaciones"
                  rotulo="Solicita"
                  alCambiar={() => marcar(c, { pide: !c.pide })}
                />
                <Tilde
                  si={c.facturacion}
                  que="es responsable de compras: recibe las facturas y los recibos de pago"
                  rotulo="Compras"
                  alCambiar={() => marcar(c, { facturacion: !c.facturacion })}
                />
                <span className="os-ctc-raya" />
                {AVISOS.map((a) => (
                  <Tilde
                    si={c[a.campo]}
                    que={`recibe por correo: ${a.texto.toLowerCase()}`}
                    rotulo={a.fila}
                    key={a.campo}
                    alCambiar={() => marcar(c, { [a.campo]: !c[a.campo] })}
                  />
                ))}
                {/* La factura y el recibo, las mismas marcas que la persona
                    elige en el portal. La factura no se toca cuando llega sí o
                    sí: al responsable de compras, y a quien solicita si la
                    empresa no tiene ninguno. */}
                <Tilde
                  si={c.facturaFija || c.recibeFactura}
                  que={
                    c.facturacion
                      ? 'recibe la factura siempre, por ser responsable de compras'
                      : c.facturaFija
                        ? 'recibe la factura siempre: no hay responsable de compras y a alguien hay que mandársela'
                        : 'recibe por correo: la factura'
                  }
                  rotulo="Factura"
                  deshabilitado={c.facturaFija}
                  alCambiar={() => marcar(c, { recibeFactura: !c.recibeFactura })}
                />
                <Tilde
                  si={c.recibeRecibo}
                  que="recibe por correo: el recibo de pago"
                  rotulo="Recibo"
                  alCambiar={() => marcar(c, { recibeRecibo: !c.recibeRecibo })}
                />
                {/* Quien no pide nada recibe siempre lo de todos, y sin avisos
                    tildados la marca no dice nada: ahí no se toca. */}
                <Tilde
                  si={c.recibeTodo && recibeAvisos(c)}
                  que="recibe también lo de los candidatos que piden otros"
                  rotulo="De todos"
                  deshabilitado={!c.pide || !recibeAvisos(c)}
                  alCambiar={() => marcar(c, { recibeTodo: !c.recibeTodo })}
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
