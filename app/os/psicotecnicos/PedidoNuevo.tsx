'use client';

/**
 * Abrir un pedido sin salir del tablero.
 *
 * Es el mismo cajón que usa el alta de cliente: entra desde la derecha, deja
 * la columna de "Sin asignar" atrás y devuelve el pedido creado a la tarjeta,
 * que lo elige y sigue cargando candidatos.
 *
 * Los ocho campos van a la vista, en dos columnas. Un pedido nuevo se abre
 * cuando llega el mail del cliente, con todo lo que ese mail dice adelante: no
 * hay un campo que se conteste tan poco como para esconderlo.
 *
 * Lo que no está acá son las nueve preguntas de puesto y jefe, que describen
 * contra qué se mide a la persona. Se contestan con el cliente al teléfono y
 * viven en la ficha del pedido, que es donde se las lee juntas.
 */

import { useEffect, useRef, useState } from 'react';
import { BENZIGER_USD } from '@/lib/benziger';
import { hoy } from '@/lib/hora';
import { FAMILIAS, SENIORITY } from '@/lib/pedido-campos';
import type { BateriaOpcion, Opcion, PedidoOpcion } from './Agregar';

export default function PedidoNuevo({
  empresas,
  baterias,
  onCreado,
  onCerrar,
}: {
  empresas: Opcion[];
  baterias: BateriaOpcion[];
  /** El pedido recién abierto, para que la tarjeta lo elija. */
  onCreado: (pedido: PedidoOpcion) => void;
  onCerrar: () => void;
}) {
  const [clienteNuevo, setClienteNuevo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primero = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    primero.current?.focus();
  }, []);

  // Escape cierra, como en la tarjeta: la mano no se va del teclado.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar();
    }
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const puesto = String(datos.get('puesto') ?? '').trim();
    const empresaId = String(datos.get('empresaId') ?? '');
    const empresaNueva = String(datos.get('empresaNueva') ?? '').trim();

    setError(null);
    setEnviando(true);
    try {
      datos.set('tipo', 'pedido');
      datos.set('conBenziger', datos.get('conBenziger') ? 'si' : '');
      const res = await fetch('/api/os/altas', { method: 'POST', body: datos });
      const r = await res.json().catch(() => ({ error: 'Sin respuesta.' }));
      if (!res.ok) {
        setError(r.error ?? 'No se pudo abrir el pedido.');
        return;
      }
      const empresa = empresas.find((x) => x.id === empresaId)?.nombre ?? empresaNueva;
      onCreado({ id: r.id, puesto, empresa });
    } catch {
      setError('No se pudo abrir el pedido.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button className="os-cajon-fondo" aria-label="Cerrar" onClick={onCerrar} />
      <div className="os-cajon" role="dialog" aria-modal="true" aria-labelledby="pedido-nuevo">
        <div className="os-cajon-top">
          <h2 id="pedido-nuevo">Pedido nuevo</h2>
          <button className="os-cajon-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="os-cajon-cuerpo">
          <form className="os-form" onSubmit={enviar}>
            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="empresaId">
                Cliente
              </label>
              {clienteNuevo ? (
                <input
                  className="os-campo"
                  name="empresaNueva"
                  placeholder="Nombre del cliente"
                  maxLength={120}
                  required
                  autoFocus
                />
              ) : (
                <select
                  ref={primero}
                  className="os-campo"
                  id="empresaId"
                  name="empresaId"
                  required
                  defaultValue=""
                >
                  <option value="">Elegí un cliente</option>
                  {empresas.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="os-enlace-boton"
                onClick={() => setClienteNuevo((v) => !v)}
              >
                {clienteNuevo ? 'Elegir uno de la lista' : 'Es un cliente nuevo'}
              </button>
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="puesto">
                Puesto que se busca
              </label>
              <input
                className="os-campo"
                id="puesto"
                name="puesto"
                required
                maxLength={120}
                placeholder="Jefe de depósito"
              />
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="familia">
                Área
              </label>
              <select className="os-campo" id="familia" name="familia" defaultValue="">
                <option value="">Sin definir</option>
                {FAMILIAS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="os-campo-bloque">
              <label className="os-etiqueta-campo" htmlFor="seniority">
                Nivel
              </label>
              <select className="os-campo" id="seniority" name="seniority" defaultValue="">
                <option value="">Sin definir</option>
                {SENIORITY.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="os-campo-bloque">
              <label className="os-etiqueta-campo" htmlFor="bateriaId">
                Batería
              </label>
              <select className="os-campo" id="bateriaId" name="bateriaId" defaultValue="">
                <option value="">A definir</option>
                {baterias.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.codigo} · {b.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* El Benziger es opcional en cualquier batería y se cobra aparte.
                Se decide por búsqueda, no por candidato: el cliente compra el
                alcance una vez y vale para todos los que evalúe en ese pedido. */}
            <div className="os-campo-bloque os-campo-entero">
              <label className="os-agregar-opcion">
                <input type="checkbox" name="conBenziger" value="si" />
                Con Benziger · USD {BENZIGER_USD} por evaluación
              </label>
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="fechaPedido">
                Fecha del pedido
              </label>
              {/* Va como `defaultValue` y en hora de Argentina: el servidor
                  corre en UTC y de noche fecharía el pedido al día siguiente. */}
              <input
                className="os-campo"
                id="fechaPedido"
                name="fechaPedido"
                type="date"
                defaultValue={hoy()}
              />
            </div>

            <div className="os-campo-bloque os-campo-entero">
              <label className="os-etiqueta-campo" htmlFor="notas">
                Qué pidió el cliente
              </label>
              <textarea
                className="os-campo"
                id="notas"
                name="notas"
                rows={3}
                maxLength={4000}
                placeholder="Lo que dice el mail: contexto, urgencia, a quién reporta."
              />
            </div>

            {error && <p className="os-form-error">{error}</p>}

            <div className="os-campo-entero os-form-pie">
              <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
                {enviando ? 'Abriendo…' : 'Abrir el pedido'}
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
