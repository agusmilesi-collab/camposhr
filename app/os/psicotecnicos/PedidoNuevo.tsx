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
import BuscarCliente from './BuscarCliente';
import Desplegable from '../Desplegable';
import { COLOR, CORTO } from './Bateria';

export default function PedidoNuevo({
  empresas,
  baterias,
  empresaFija,
  onCreado,
  onCerrar,
}: {
  empresas: Opcion[];
  baterias: BateriaOpcion[];
  /**
   * El cliente ya elegido, cuando el pedido se abre desde su ficha.
   *
   * Ahí no hay nada que elegir: el pedido es de ese cliente y ofrecer la lista
   * entera es ofrecer equivocarse.
   */
  empresaFija?: string;
  /** El pedido recién abierto, para que la tarjeta lo elija. */
  onCreado: (pedido: PedidoOpcion) => void;
  onCerrar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* La batería va por el desplegable del OS y no por uno del navegador: es lo
     único del formulario que se reconoce por su color, y el del navegador no
     deja pintar sus opciones. El valor viaja en un campo escondido, que es lo
     que se manda con el resto. */
  const [bateriaId, setBateriaId] = useState('');

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

    if (!empresaId && !empresaNueva) {
      setError('Elegí un cliente de la lista, o escribí uno nuevo y agregalo.');
      return;
    }

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
              {empresaFija ? (
                <>
                  <input type="hidden" name="empresaId" value={empresaFija} />
                  <p className="os-form-nota">
                    {empresas.find((x) => x.id === empresaFija)?.nombre ?? 'Este cliente'}
                  </p>
                </>
              ) : (
                /* Se escribe y se filtra, y lo que no está se da de alta desde
                   el mismo campo: cargar el pedido de un cliente que todavía no
                   existe es el caso de todos los días. */
                <BuscarCliente empresas={empresas} autoFocus />
              )}
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
              <span className="os-etiqueta-campo">Batería</span>
              <input type="hidden" name="bateriaId" value={bateriaId} />
              <Desplegable
                valor={bateriaId}
                etiqueta="Batería"
                vacio="A definir"
                alElegir={setBateriaId}
                opciones={[
                  { valor: '', texto: 'A definir' },
                  ...baterias.map((b) => ({
                    valor: b.id,
                    // El código corto y el nombre: "Batería 2 · Batería
                    // estándar…" repite la palabra dos veces y era lo que
                    // empujaba la lista fuera de la pantalla.
                    texto: `${CORTO[b.codigo] ?? b.codigo} · ${b.nombre}`,
                    color: COLOR[b.codigo] ?? 'os-gris',
                  })),
                ]}
              />
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
