'use client';

/**
 * El embudo como tablero.
 *
 * Una columna por estado y una tarjeta por oportunidad. Se mueve arrastrando,
 * que es la forma más corta de contestar la única pregunta que se le hace a
 * esta pantalla: dónde está cada cosa y qué se mueve hoy.
 *
 * Cada tarjeta lleva además un selector, porque arrastrar no funciona en una
 * pantalla táctil y porque es lo que puede usar quien navega con el teclado.
 *
 * Perder una oportunidad pide el motivo: una perdida sin motivo no enseña nada
 * cuando se la revisa el mes que viene.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Desplegable from '@/app/os/Desplegable';
import {
  ESTADOS,
  SERVICIOS,
  formatoFecha,
  formatoImporte,
  type Estado,
} from '@/lib/comercial-tipos';

/** El valor del desplegable que pide escribir un cliente que no está. */
const OTRO = '__otro__';

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
  concepto: string;
  importe: number;
  moneda: string;
  version: string;
  estado: Estado;
  fecha: string;
  token: string | null;
  nota: string | null;
  motivo: string | null;
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

export function Tablero({ oportunidades }: { oportunidades: Oportunidad[] }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [perdiendo, setPerdiendo] = useState<Oportunidad | null>(null);

  async function mover(id: string, estado: Estado, motivo?: string) {
    setError(null);
    try {
      await mandar({ accion: 'estado', id, estado, motivo: motivo ?? null });
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
                    {o.concepto} · v{o.version} · {formatoFecha(o.fecha)}
                  </div>
                  {o.motivo && (
                    <div className="os-etiquetas">
                      <span className="os-etiqueta">Se perdió: {o.motivo}</span>
                    </div>
                  )}
                  <div className="os-tarjeta-pie">
                    <span className="os-tarjeta-importe">
                      {formatoImporte(o.importe, o.moneda)}
                    </span>
                    {o.token && (
                      <a href={`/q/${o.token}`} target="_blank" rel="noreferrer" className="os-enlace-boton">
                        Propuesta
                      </a>
                    )}
                    <Desplegable
                      valor={o.estado}
                      opciones={ESTADOS.map((e) => ({
                        valor: e,
                        texto: e,
                        color: COLOR_ESTADO[e],
                      }))}
                      alElegir={(v) => pedirMover(o, v as Estado)}
                      etiqueta={`Mover ${o.cliente}`}
                    />
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
                  const motivo = String(new FormData(e.currentTarget).get('motivo') ?? '').trim();
                  const o = perdiendo;
                  setPerdiendo(null);
                  if (o) mover(o.id, 'Perdida', motivo || undefined);
                }}
              >
                <p className="os-form-nota">
                  {perdiendo.cliente} · {formatoImporte(perdiendo.importe, perdiendo.moneda)}
                </p>
                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="motivo">
                    Por qué se perdió
                  </label>
                  <input
                    className="os-campo"
                    id="motivo"
                    name="motivo"
                    maxLength={200}
                    autoFocus
                    defaultValue={perdiendo.motivo ?? ''}
                    placeholder="Precio, tiempos, se lo quedó otro…"
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
    </>
  );
}

export function NuevaOportunidad({ clientes }: { clientes: string[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otroCliente, setOtroCliente] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form).entries());
    setEnviando(true);
    setError(null);
    try {
      await mandar({ accion: 'nueva', ...datos });
      form.reset();
      setOtroCliente(false);
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
              <form className="os-form" onSubmit={enviar}>
                {/* Casi siempre se cotiza a un cliente que ya está cargado:
                    la lista va primero y escribir queda para el que todavía no
                    existe. Escrito a mano, el mismo cliente entraba con tres
                    grafías distintas y el embudo no se podía leer por cliente. */}
                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="cliente">
                    Cliente
                  </label>
                  {otroCliente ? (
                    <input
                      className="os-campo"
                      id="cliente"
                      name="cliente"
                      required
                      maxLength={120}
                      autoFocus
                      placeholder="Nombre del cliente nuevo"
                    />
                  ) : (
                    <select
                      className="os-campo"
                      id="cliente"
                      name="cliente"
                      required
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value === OTRO) setOtroCliente(true);
                      }}
                    >
                      <option value="" disabled>
                        Elegí el cliente
                      </option>
                      {clientes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value={OTRO}>Otro, lo escribo…</option>
                    </select>
                  )}
                  {otroCliente && (
                    <button
                      className="os-enlace-boton"
                      type="button"
                      onClick={() => setOtroCliente(false)}
                    >
                      Elegir uno de la lista
                    </button>
                  )}
                </div>

                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="concepto">
                    Qué se le vende
                  </label>
                  <select className="os-campo" id="concepto" name="concepto" required defaultValue="">
                    <option value="" disabled>
                      Elegí el servicio
                    </option>
                    {SERVICIOS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="os-campo-bloque">
                  <label className="os-etiqueta-campo" htmlFor="importe">
                    Precio de venta
                  </label>
                  <input
                    className="os-campo"
                    id="importe"
                    name="importe"
                    type="number"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div className="os-campo-bloque">
                  <label className="os-etiqueta-campo" htmlFor="estado">
                    Estado
                  </label>
                  <select className="os-campo" id="estado" name="estado" defaultValue="Lead">
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="fecha">
                    Fecha
                  </label>
                  <input className="os-campo" id="fecha" name="fecha" type="date" />
                </div>

                <div className="os-campo-bloque os-campo-entero">
                  <label className="os-etiqueta-campo" htmlFor="nota">
                    Nota
                  </label>
                  <input className="os-campo" id="nota" name="nota" maxLength={300} />
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
