'use client';

/**
 * El embudo como tablero.
 *
 * Una columna por estado y una tarjeta por oportunidad. Se mueve arrastrando,
 * que es la forma más corta de contestar la única pregunta que se le hace a
 * esta pantalla: dónde está cada cosa y qué se mueve hoy.
 *
 * **Perder pide la objeción**: con cuál de las cinco se cayó. Escrito a mano
 * cada perdida decía lo suyo y revisar el mes no dejaba ver qué se repite; el
 * detalle del caso va al lado, en el texto libre.
 *
 * La tarjeta se edita desde su propio cajón. El estado no está ahí: se mueve
 * arrastrando de columna, y tenerlo en los dos lados daría dos formas de hacer
 * lo mismo.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Buscador from '@/app/os/Buscador';
import Desplegable from '@/app/os/Desplegable';
import {
  ESTADOS,
  OBJECIONES,
  SERVICIOS,
  formatoFecha,
  formatoImporte,
  precioDeTexto,
  type Estado,
  type Objecion,
} from '@/lib/comercial-tipos';

/** El color de cada estado, el mismo que en el Inicio. */
const COLOR_ESTADO: Record<string, string> = {
  Lead: 'os-gris',
  Enviada: 'os-ambar',
  Aprobada: 'os-verde',
  Perdida: 'os-rojo',
};

export type Oportunidad = {
  id: string;
  cliente: string;
  /** El cliente en Clientes, cuando la oportunidad ya está enlazada. */
  empresaId: string | null;
  concepto: string;
  importe: number;
  moneda: string;
  estado: Estado;
  fecha: string;
  token: string | null;
  nota: string | null;
  motivo: string | null;
  objecion: Objecion | null;
};

const QUE_ES: Record<Estado, string> = {
  Lead: 'Hay interés, todavía no se mandó nada.',
  Enviada: 'La propuesta está del lado del cliente.',
  Aprobada: 'Se cerró. Entra a la cuenta de resultado.',
  Perdida: 'No se cerró.',
};

async function mandar(cuerpo: unknown) {
  const res = await fetch('/api/os/comercial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({ error: 'Sin respuesta.' }));
  if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar.');
  return datos;
}

/** Un cliente de la lista: el id es el que ya está cargado en Clientes. */
export type ClienteOpcion = { id: string | null; nombre: string };

export function Tablero({
  oportunidades,
  clientes,
}: {
  oportunidades: Oportunidad[];
  /** Los que ya están cargados, para no escribir el mismo de tres maneras. */
  clientes: ClienteOpcion[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [perdiendo, setPerdiendo] = useState<Oportunidad | null>(null);
  const [editando, setEditando] = useState<Oportunidad | null>(null);

  async function mover(id: string, estado: Estado, cierre?: { objecion: Objecion; motivo: string }) {
    setError(null);
    try {
      await mandar({
        accion: 'estado',
        id,
        estado,
        motivo: cierre?.motivo || null,
        objecion: cierre?.objecion ?? null,
      });
      empezar(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  }

  function pedirMover(o: Oportunidad, estado: Estado) {
    if (estado === o.estado) return;
    if (estado === 'Perdida') {
      setPerdiendo(o);
      return;
    }
    mover(o.id, estado);
  }

  return (
    <>
      {error && <p className="os-form-error">{error}</p>}

      <div className="os-kanban">
        {ESTADOS.map((estado) => {
          const filas = oportunidades.filter((o) => o.estado === estado);
          const monto = filas.reduce((n, o) => n + o.importe, 0);
          return (
            <div
              key={estado}
              className={`os-columna${encima === estado ? ' encima' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setEncima(estado);
              }}
              onDragLeave={() => setEncima((v) => (v === estado ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                setEncima(null);
                const id = e.dataTransfer.getData('text/plain');
                const o = oportunidades.find((x) => x.id === id);
                if (o) pedirMover(o, estado);
              }}
            >
              <div className="os-columna-top">
                <span className="os-columna-titulo">{estado}</span>
                <span className="os-columna-monto">
                  {filas.length} · {formatoImporte(monto)}
                </span>
              </div>
              <p className="os-columna-nota">{QUE_ES[estado]}</p>

              {filas.map((o) => (
                <article
                  key={o.id}
                  className={`os-tarjeta-op${arrastrando === o.id ? ' arrastrando' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', o.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setArrastrando(o.id);
                  }}
                  onDragEnd={() => setArrastrando(null)}
                >
                  <div className="os-tarjeta-cliente">{o.cliente}</div>
                  <div className="os-tarjeta-concepto">
                    {o.concepto} · {formatoFecha(o.fecha)}
                  </div>
                  {o.nota && <div className="os-tarjeta-nota">{o.nota}</div>}
                  {(o.objecion || o.motivo) && (
                    <div className="os-etiquetas">
                      {o.objecion && (
                        <span className="os-etiqueta os-etiqueta-objecion">{o.objecion}</span>
                      )}
                      {o.motivo && <span className="os-etiqueta">{o.motivo}</span>}
                    </div>
                  )}
                  <div className="os-tarjeta-pie">
                    <span className="os-tarjeta-importe">
                      {formatoImporte(o.importe, o.moneda)}
                    </span>
                    {/* Un lápiz y no la palabra: la tarjeta es angosta y el
                        pie tiene que dejarle el renglón al importe, que es lo
                        que se compara al recorrer la columna. */}
                    <button
                      type="button"
                      className="os-tarjeta-editar"
                      title="Editar"
                      aria-label={`Editar ${o.cliente}`}
                      // La tarjeta se arrastra: sin esto, apretar el botón
                      // arranca el arrastre en vez de abrir el cajón.
                      draggable={false}
                      onDragStart={(e) => e.stopPropagation()}
                      onClick={() => setEditando(o)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
                        <path d="M13.5 6.5l4 4" />
                      </svg>
                    </button>
                  </div>
                </article>
              ))}

              {filas.length === 0 && <p className="os-columna-vacia">Nada acá</p>}
            </div>
          );
        })}
      </div>

      {perdiendo && (
        <>
          <button
            className="os-cajon-fondo"
            aria-label="Cancelar"
            onClick={() => setPerdiendo(null)}
          />
          <div className="os-cajon" style={{ width: 'min(400px, 100vw)' }}>
            <div className="os-cajon-top">
              <h2>Se perdió</h2>
              <button className="os-cajon-cerrar" onClick={() => setPerdiendo(null)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className="os-cajon-cuerpo">
              <form
                className="os-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const campos = new FormData(e.currentTarget);
                  const objecion = String(campos.get('objecion') ?? '') as Objecion;
                  const motivo = String(campos.get('motivo') ?? '').trim();
                  const o = perdiendo;
                  setPerdiendo(null);
                  if (o) mover(o.id, 'Perdida', { objecion, motivo });
                }}
              >
                <p className="os-form-nota">
                  {perdiendo.cliente} · {formatoImporte(perdiendo.importe, perdiendo.moneda)}
                </p>

                {/* Las cinco con lo que quiere decir cada una: el nombre solo
                    se presta a que dos personas clasifiquen distinto lo mismo,
                    y entonces contarlas no sirve. */}
                <fieldset className="os-campo-entero os-objeciones">
                  <legend className="os-etiqueta-campo">Qué la frenó</legend>
                  {OBJECIONES.map((x, i) => (
                    <label className="os-objecion" key={x.nombre}>
                      <input
                        type="radio"
                        name="objecion"
                        value={x.nombre}
                        required
                        defaultChecked={perdiendo.objecion === x.nombre || (!perdiendo.objecion && i === 0)}
                      />
                      <span className="os-objecion-cuerpo">
                        <span className="os-objecion-nombre">{x.nombre}</span>
                        <span className="os-objecion-que">{x.que}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="motivo">
                    El detalle del caso
                  </label>
                  <input
                    className="os-campo"
                    id="motivo"
                    name="motivo"
                    maxLength={200}
                    defaultValue={perdiendo.motivo ?? ''}
                    placeholder="Se lo quedó otro, lo pasan a marzo…"
                  />
                </div>

                <div className="os-campo-entero os-form-pie">
                  <button className="os-boton os-boton-firme" type="submit">
                    Marcar perdida
                  </button>
                  <button className="os-boton" type="button" onClick={() => setPerdiendo(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
      {editando && (
        <Editar
          oportunidad={editando}
          clientes={clientes}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            empezar(() => router.refresh());
          }}
        />
      )}
    </>
  );
}

/**
 * Cambiar lo que dice una tarjeta.
 *
 * Los mismos campos con los que se carga, menos el estado: eso se mueve
 * arrastrando de columna.
 */
function Editar({
  oportunidad,
  clientes,
  onCerrar,
  onGuardado,
}: {
  oportunidad: Oportunidad;
  clientes: ClienteOpcion[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [cliente, setCliente] = useState(oportunidad.cliente);
  /** El de Clientes, cuando se eligió uno de la lista. */
  const [empresaId, setEmpresaId] = useState<string | null>(oportunidad.empresaId);
  const [servicio, setServicio] = useState(oportunidad.concepto);
  const [precio, setPrecio] = useState(String(oportunidad.importe));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget).entries());
    const importe = precioDeTexto(precio);
    if (importe === null || importe < 0) {
      setError('Ese precio no se entiende. Va en números, con o sin puntos.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await mandar({
        accion: 'editar',
        id: oportunidad.id,
        ...datos,
        cliente,
        empresaId,
        concepto: servicio,
        importe,
      });
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button className="os-cajon-fondo" aria-label="Cerrar" onClick={onCerrar} />
      <div className="os-cajon">
        <div className="os-cajon-top">
          <h2>Editar oportunidad</h2>
          <button className="os-cajon-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="os-cajon-cuerpo">
          {/* El documento que abre el cliente, acá y no en la tarjeta: se mira
              cuando se entra a la oportunidad, no cada vez que se recorre el
              tablero. */}
          {oportunidad.token && (
            <p className="os-form-nota">
              <a
                className="os-tabla-enlace"
                href={`/q/${oportunidad.token}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver la propuesta que abre el cliente
              </a>
            </p>
          )}
          <form className="os-form os-form-cotizacion" onSubmit={enviar}>
            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="cliente-editar">
                Cliente
              </label>
              <Buscador
                id="cliente-editar"
                opciones={clientes.map((c) => ({ id: c.id ?? c.nombre, nombre: c.nombre }))}
                inicial={oportunidad.cliente}
                placeholder="Escribí el nombre del cliente"
                alElegir={(o) => {
                  setCliente(o.nombre);
                  setEmpresaId(clientes.find((c) => c.nombre === o.nombre)?.id ?? null);
                }}
                alCrear={(nombre) => {
                  setCliente(nombre);
                  setEmpresaId(null);
                }}
                alEscribir={(texto) => {
                  setCliente(texto);
                  setEmpresaId(null);
                }}
              />
            </div>

            {/* Las oportunidades que vienen de antes dicen qué es el trabajo
                ("Rediseño organizacional · cinco fases en once semanas") en vez
                de uno de los cuatro servicios: lo que dice esta sigue en la
                lista, o abrir el cajón le cambiaría el nombre. */}
            <div className="os-campo-bloque os-campo-entero">
              <span className="os-etiqueta-campo">Servicio</span>
              <Desplegable
                valor={servicio}
                opciones={[
                  ...SERVICIOS.map((x) => ({ valor: x, texto: x })),
                  ...(SERVICIOS.includes(oportunidad.concepto as (typeof SERVICIOS)[number])
                    ? []
                    : [{ valor: oportunidad.concepto, texto: oportunidad.concepto }]),
                ]}
                alElegir={setServicio}
                etiqueta="Qué servicio es"
              />
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="nota-editar">
                Descripción
              </label>
              <textarea
                className="os-campo"
                id="nota-editar"
                name="nota"
                rows={3}
                maxLength={300}
                defaultValue={oportunidad.nota ?? ''}
              />
            </div>

            {/* Se escribe como se escribe un precio. Con `type="number"` el
                navegador rechazaba los puntos de miles y todo lo que no fuera
                múltiplo de mil, y el formulario no se enviaba. */}
            <div className="os-campo-bloque">
              <label className="os-etiqueta-campo" htmlFor="importe-editar">
                Precio de venta
              </label>
              <input
                className="os-campo"
                id="importe-editar"
                inputMode="decimal"
                autoComplete="off"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />
              <span className="os-dato-flojo">
                {precioDeTexto(precio) === null
                  ? 'En números'
                  : formatoImporte(precioDeTexto(precio) as number, oportunidad.moneda)}
              </span>
            </div>

            <div className="os-campo-bloque">
              <label className="os-etiqueta-campo" htmlFor="fecha-editar">
                Fecha
              </label>
              <input
                className="os-campo"
                id="fecha-editar"
                name="fecha"
                type="date"
                defaultValue={oportunidad.fecha}
              />
            </div>

            {error && <p className="os-form-error">{error}</p>}

            <div className="os-campo-entero os-form-pie">
              <button className="os-boton os-boton-firme" type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button className="os-boton" type="button" onClick={onCerrar}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export function NuevaOportunidad({ clientes }: { clientes: ClienteOpcion[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState('');
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [servicio, setServicio] = useState('');
  const [estado, setEstado] = useState<Estado>('Lead');
  const [precio, setPrecio] = useState('');

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form).entries());
    if (!cliente.trim()) {
      setError('Falta el cliente.');
      return;
    }
    if (!servicio) {
      setError('Falta el servicio.');
      return;
    }
    const importe = precioDeTexto(precio);
    if (importe === null || importe < 0) {
      setError('Ese precio no se entiende. Va en números, con o sin puntos.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await mandar({
        accion: 'nueva',
        ...datos,
        cliente: cliente.trim(),
        empresaId,
        concepto: servicio,
        estado,
        importe,
      });
      form.reset();
      setCliente('');
      setEmpresaId(null);
      setServicio('');
      setEstado('Lead');
      setPrecio('');
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button className="os-boton os-boton-firme" onClick={() => setAbierto(true)}>
        Nueva oportunidad
      </button>

      {abierto && (
        <>
          <button
            className="os-cajon-fondo"
            aria-label="Cerrar"
            onClick={() => setAbierto(false)}
          />
          <div className="os-cajon">
            <div className="os-cajon-top">
              <h2>Nueva oportunidad</h2>
              <button className="os-cajon-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className="os-cajon-cuerpo">
              <form className="os-form os-form-cotizacion" onSubmit={enviar}>
                {/* Se escribe y van quedando los que coinciden, el mismo
                    campo con el que se carga un pedido. Con un desplegable
                    había que recorrer la lista entera, y escrito a mano el
                    mismo cliente entraba con tres grafías distintas y el embudo
                    no se podía leer por cliente. */}
                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="cliente">
                    Cliente
                  </label>
                  <Buscador
                    id="cliente"
                    opciones={clientes.map((c) => ({ id: c.id ?? c.nombre, nombre: c.nombre }))}
                    autoFocus
                    placeholder="Escribí el nombre del cliente"
                    alElegir={(o) => {
                      setCliente(o.nombre);
                      setEmpresaId(clientes.find((c) => c.nombre === o.nombre)?.id ?? null);
                    }}
                    alCrear={(nombre) => {
                      setCliente(nombre);
                      setEmpresaId(null);
                    }}
                    alEscribir={(texto) => {
                      setCliente(texto);
                      setEmpresaId(null);
                    }}
                  />
                  {/* Lo que no está en la lista se da de alta: así el cliente
                      nuevo aparece en Clientes con su enlace del portal, en vez
                      de quedar como un nombre escrito adentro del embudo. */}
                  {cliente.trim() && !empresaId && (
                    <span className="os-form-nota">
                      Se da de alta <b>{cliente.trim()}</b> como cliente.
                    </span>
                  )}
                </div>

                {/* El desplegable del OS y no el del navegador: es el mismo
                    control que en el resto de las pantallas, y el del navegador
                    se dibuja distinto en cada sistema. */}
                <div className="os-campo-bloque os-campo-entero">
                  <span className="os-etiqueta-campo">Servicio</span>
                  <Desplegable
                    valor={servicio}
                    opciones={SERVICIOS.map((x) => ({ valor: x, texto: x }))}
                    alElegir={setServicio}
                    etiqueta="Qué servicio se vende"
                    vacio="Elegí el servicio"
                  />
                </div>

                {/* Debajo del servicio, que es lo que describe: qué se acordó,
                    en cuántas fases, con qué condición de pago. */}
                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="nota">
                    Descripción
                  </label>
                  <textarea
                    className="os-campo"
                    id="nota"
                    name="nota"
                    rows={3}
                    maxLength={300}
                  />
                </div>

                {/* Se escribe como se escribe un precio: "525.000" con los
                    puntos de miles entra igual, y abajo se lee qué entendió. */}
                <div className="os-campo-bloque">
                  <label className="os-etiqueta-campo" htmlFor="importe">
                    Precio de venta
                  </label>
                  <input
                    className="os-campo"
                    id="importe"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="525.000"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                  />
                  <span className="os-dato-flojo">
                    {precioDeTexto(precio) === null
                      ? 'En números'
                      : formatoImporte(precioDeTexto(precio) as number)}
                  </span>
                </div>

                <div className="os-campo-bloque">
                  <span className="os-etiqueta-campo">Estado</span>
                  <Desplegable
                    valor={estado}
                    opciones={ESTADOS.map((e) => ({
                      valor: e,
                      texto: e,
                      color: COLOR_ESTADO[e],
                    }))}
                    alElegir={(v) => setEstado(v as Estado)}
                    etiqueta="En qué columna entra"
                  />
                </div>

                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="fecha">
                    Fecha
                  </label>
                  <input className="os-campo" id="fecha" name="fecha" type="date" />
                </div>

                {error && <p className="os-form-error">{error}</p>}

                <div className="os-campo-entero os-form-pie">
                  <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
                    {enviando ? 'Guardando…' : 'Cargar'}
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
