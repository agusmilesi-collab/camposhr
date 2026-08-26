'use client';

/**
 * Cargar un candidato sin salir del tablero.
 *
 * Es la tarjeta que cierra la columna de "Sin asignar". Está pensada para el
 * caso real: llega un mail con tres candidatos para el mismo pedido y hay que
 * meterlos ya.
 *
 * Las decisiones que la hacen rápida, en orden de cuánto ahorran:
 *
 * 1. **El pedido va primero**, como en el formulario del portal: lo primero
 *    que se define es para qué búsqueda entra, y recién después quién es.
 * 2. **No cierra al guardar.** Guarda, se limpia y vuelve el foco al nombre.
 *    Cargar cinco candidatos es escribir cinco nombres, no abrir el formulario
 *    cinco veces.
 * 3. **El pedido queda elegido** entre una carga y la siguiente, incluso el
 *    que se acaba de abrir, porque los candidatos vienen de a tandas del mismo
 *    pedido.
 * 4. **Tres campos a la vista**, que son los que la fila necesita para
 *    existir: pedido, nombre y un contacto. El correo, la evaluadora y el CV
 *    están detrás de un clic, cerrados por defecto.
 * 5. **Enter guarda, Escape cierra.** Sin llevar la mano al mouse.
 * 6. **Va en la columna, no en una ventana encima.** Lo que se está cargando
 *    se ve contra la lista a la que se va a sumar.
 *
 * Cuando el pedido todavía no existe, "+ Pedido nuevo" abre el cajón de la
 * derecha con sus ocho campos, y al guardarlo la tarjeta lo deja elegido. Los
 * dos trabajos tienen tamaños distintos y cada uno ocupa el lugar que necesita:
 * tres campos en la columna, ocho en el cajón.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import PedidoNuevo from './PedidoNuevo';

export type PedidoOpcion = { id: string; puesto: string; empresa: string };
export type Opcion = { id: string; nombre: string };
export type BateriaOpcion = { id: string; codigo: string; nombre: string };

/** El valor del selector de pedido que abre el cajón. */
const NUEVO = 'nuevo';

/**
 * El valor que lleva a reabrir un pedido.
 *
 * Los entregados enteros no se eligen desde acá: reabrir uno es una decisión
 * sobre el trabajo con ese cliente y se toma en su ficha, donde están sus
 * cerrados con lo que se le entregó a cada uno.
 */
const REABRIR = 'reabrir';

export default function Agregar({
  pedidos,
  empresas,
  baterias,
  evaluadoras,
}: {
  /**
   * Los pedidos abiertos, y solo esos.
   *
   * Un pedido entregado entero no se elige desde acá: reabrirlo es una decisión
   * sobre el trabajo con ese cliente y se toma en su ficha, en Clientes.
   */
  pedidos: PedidoOpcion[];
  empresas: Opcion[];
  baterias: BateriaOpcion[];
  evaluadoras: Opcion[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [masDatos, setMasDatos] = useState(false);
  const [cajon, setCajon] = useState(false);
  // Los pedidos que se abrieron desde el cajón. El servidor todavía no los
  // devolvió cuando se carga el primer candidato, y sin esto el selector
  // quedaría apuntando a un pedido que no está en la lista.
  const [nuevos, setNuevos] = useState<PedidoOpcion[]>([]);
  const [pedido, setPedido] = useState(pedidos[0]?.id ?? '');
  /**
   * El candidato entra sin evaluadora, que es donde está la tarjeta.
   *
   * Antes se proponía a sí misma quien estuviera cargando, y el candidato
   * saltaba a su columna apenas se guardaba: se agregaba en "Sin asignar" y
   * aparecía en otro lado. Repartir es lo que se hace en esta pantalla,
   * arrastrando. Quien quiera quedárselo lo elige en "Correo, evaluadora y
   * CV".
   */
  const [evaluadora, setEvaluadora] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const nombre = useRef<HTMLInputElement>(null);

  const opciones = [...pedidos, ...nuevos.filter((n) => !pedidos.some((p) => p.id === n.id))];

  useEffect(() => {
    if (abierto) nombre.current?.focus();
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    setError(null);
    setHecho(null);
    setMasDatos(false);
  }

  /** El pedido recién abierto queda elegido: los candidatos son de ese. */
  function tomarPedido(nuevo: PedidoOpcion) {
    setNuevos((v) => [...v, nuevo]);
    setPedido(nuevo.id);
    setCajon(false);
    setError(null);
    setHecho(`${nuevo.puesto} quedó abierto.`);
    nombre.current?.focus();
    empezar(() => router.refresh());
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const telefono = String(datos.get('telefono') ?? '').trim();
    const email = String(datos.get('email') ?? '').trim();

    setError(null);
    setHecho(null);

    if (!pedido) {
      setError('Abrí primero el pedido al que entra.');
      return;
    }
    if (!telefono && !email) {
      setError('Hace falta el teléfono o el correo para poder citarla.');
      return;
    }

    setEnviando(true);
    try {
      datos.set('tipo', 'candidato');
      datos.set('pedidoId', pedido);
      datos.set('evaluadoraId', evaluadora);
      const res = await fetch('/api/os/altas', { method: 'POST', body: datos });
      const r = await res.json().catch(() => ({ error: 'Sin respuesta.' }));
      if (!res.ok) {
        setError(r.error ?? 'No se pudo guardar.');
        return;
      }
      // Se limpia y queda listo para el siguiente, con el pedido puesto.
      form.reset();
      setHecho(`${String(datos.get('nombre') ?? '').trim()} quedó cargada.`);
      nombre.current?.focus();
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="os-agregar-card" onClick={() => setAbierto(true)}>
        <span className="os-agregar-mas" aria-hidden="true">
          +
        </span>
        Agregar candidato
      </button>
    );
  }

  return (
    <>
      <form
        className="os-agregar-abierto"
        onSubmit={guardar}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cerrar();
        }}
      >
        <select
          className="os-campo"
          value={pedido}
          onChange={(e) => {
            // El cajón se abre y el selector no se mueve: si se cancela, sigue
            // elegido el pedido que estaba.
            if (e.target.value === NUEVO) setCajon(true);
            else if (e.target.value === REABRIR) router.push('/os/clientes');
            else setPedido(e.target.value);
          }}
          aria-label="Para qué pedido"
        >
          {opciones.length === 0 && <option value="">Ningún pedido abierto</option>}
          {opciones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.empresa} · {p.puesto}
            </option>
          ))}
          <option value={NUEVO}>+ Pedido nuevo</option>
          <option value={REABRIR}>↗ Reabrir un pedido entregado</option>
        </select>

        <input
          ref={nombre}
          className="os-campo"
          name="nombre"
          required
          maxLength={120}
          placeholder="Nombre y apellido"
          aria-label="Nombre y apellido"
        />

        <input
          className="os-campo"
          name="telefono"
          placeholder="Teléfono"
          aria-label="Teléfono"
        />

        {masDatos && (
          <>
            <input className="os-campo" name="email" placeholder="Correo" aria-label="Correo" />
            <select
              className="os-campo"
              value={evaluadora}
              onChange={(e) => setEvaluadora(e.target.value)}
              aria-label="Evaluadora"
            >
              <option value="">Sin asignar</option>
              {evaluadoras.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
            <label className="os-agregar-rotulo">
              CV
              <input
                className="os-campo os-agregar-archivo"
                name="cv"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
              />
            </label>
          </>
        )}

        {!masDatos && (
          <button type="button" className="os-agregar-mas-datos" onClick={() => setMasDatos(true)}>
            Correo, evaluadora y CV
          </button>
        )}

        {error && <p className="os-form-error">{error}</p>}
        {hecho && <p className="os-form-ok">{hecho}</p>}

        <div className="os-agregar-pie">
          <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Agregar'}
          </button>
          <button type="button" className="os-boton" onClick={cerrar}>
            Listo
          </button>
        </div>
      </form>

      {cajon && (
        <PedidoNuevo
          empresas={empresas}
          baterias={baterias}
          onCreado={tomarPedido}
          onCerrar={() => setCajon(false)}
        />
      )}
    </>
  );
}
