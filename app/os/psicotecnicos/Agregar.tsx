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
 * 1. **No cierra al guardar.** Guarda, se limpia y vuelve el foco al nombre.
 *    Cargar cinco candidatos es escribir cinco nombres, no abrir el formulario
 *    cinco veces.
 * 2. **El pedido queda elegido** entre una carga y la siguiente, porque los
 *    candidatos vienen de a tandas del mismo pedido.
 * 3. **Tres campos a la vista**, que son los que la fila necesita para existir:
 *    nombre, pedido y un contacto. Evaluadora y correo están detrás de "más
 *    datos", cerrado por defecto.
 * 4. **Enter guarda, Escape cierra.** Sin llevar la mano al mouse.
 * 5. **Va en la columna, no en una ventana encima.** Lo que se está cargando se
 *    ve contra la lista a la que se va a sumar.
 *
 * Lo que no hace: crear el pedido. Eso es otro formulario, con otros campos, y
 * meterlo acá haría largo el caso frecuente para servir al raro. El enlace de
 * abajo lleva a la pantalla que lo carga.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

export type PedidoOpcion = { id: string; puesto: string; empresa: string };
export type Opcion = { id: string; nombre: string };

export default function Agregar({
  pedidos,
  evaluadoras,
  yo,
}: {
  pedidos: PedidoOpcion[];
  evaluadoras: Opcion[];
  /** Con qué evaluadora se entra: si es una de ellas, se propone a sí misma. */
  yo: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [masDatos, setMasDatos] = useState(false);
  const [pedido, setPedido] = useState(pedidos[0]?.id ?? '');
  // Si quien mira es evaluadora, el candidato arranca a su nombre: es lo que
  // pasa casi siempre, y así entra directo en su cola en vez de a repartir.
  const [evaluadora, setEvaluadora] = useState(
    evaluadoras.find((v) => v.nombre === yo)?.id ?? ''
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const nombre = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (abierto) nombre.current?.focus();
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    setError(null);
    setHecho(null);
    setMasDatos(false);
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const telefono = String(datos.get('telefono') ?? '').trim();
    const email = String(datos.get('email') ?? '').trim();

    setError(null);
    setHecho(null);

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

  if (pedidos.length === 0) {
    return (
      <div className="os-agregar-abierto">
        <p className="os-vacio">
          No hay ningún pedido abierto. <Link href="/os/psicotecnicos/cargar">Cargá el pedido</Link>{' '}
          y después sus candidatos.
        </p>
        <button type="button" className="os-boton" onClick={cerrar}>
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form
      ref={caja}
      className="os-agregar-abierto"
      onSubmit={guardar}
      onKeyDown={(e) => {
        if (e.key === 'Escape') cerrar();
      }}
    >
      <input
        ref={nombre}
        className="os-campo"
        name="nombre"
        required
        maxLength={120}
        placeholder="Nombre y apellido"
        aria-label="Nombre y apellido"
      />

      <select
        className="os-campo"
        value={pedido}
        onChange={(e) => setPedido(e.target.value)}
        aria-label="Para qué pedido"
      >
        {pedidos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.empresa} · {p.puesto}
          </option>
        ))}
      </select>

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
        </>
      )}

      {!masDatos && (
        <button type="button" className="os-agregar-mas-datos" onClick={() => setMasDatos(true)}>
          Correo y evaluadora
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
  );
}
