'use client';

/**
 * Qué avisos quiere recibir por correo quien envía el pedido.
 *
 * Aparece debajo de "Enviar como", cuando la persona eligió su nombre: es ella
 * la que decide qué correos quiere: la orden de compra, la fecha de la
 * entrevista, el informe terminado, la factura y el recibo de pago. Se guarda
 * al tildar, en su contacto, y vale para todos sus pedidos: son las mismas
 * marcas que el equipo ve en la ficha del cliente.
 *
 * Va siempre a la vista, sin desplegar (pedido de Agustín, 8/10/2026): son
 * cinco renglones, y plegado nadie se enteraba de que podía elegir.
 */

import { useState } from 'react';
import type { Contacto } from '@/lib/contactos-tipos';

const AVISOS = [
  { campo: 'recibeOrden', texto: 'Orden de compra', dePlata: false },
  { campo: 'recibeEntrevista', texto: 'Fecha de entrevista', dePlata: false },
  { campo: 'recibeInforme', texto: 'Informe terminado', dePlata: false },
  { campo: 'recibeFactura', texto: 'Factura', dePlata: true },
  { campo: 'recibeRecibo', texto: 'Recibo de pago', dePlata: true },
] as const;

type Campo = (typeof AVISOS)[number]['campo'];
type Marcas = Record<Campo, boolean>;

export default function Notificaciones({
  token,
  contactos,
  elegido,
}: {
  token: string;
  contactos: Contacto[];
  /** El contacto elegido en "Enviar como". */
  elegido: string;
}) {
  // Lo que cada persona tiene tildado, para todas: si se cambia de nombre y se
  // vuelve, lo recién guardado sigue ahí sin volver a pedir la página.
  const [marcas, setMarcas] = useState<Record<string, Marcas>>(() =>
    Object.fromEntries(
      contactos.map((c) => [
        c.id,
        {
          recibeOrden: c.recibeOrden,
          recibeEntrevista: c.recibeEntrevista,
          recibeInforme: c.recibeInforme,
          recibeFactura: c.recibeFactura,
          recibeRecibo: c.recibeRecibo,
        },
      ])
    )
  );
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado' | 'error'>('quieto');

  const quien = contactos.find((c) => c.id === elegido);
  const suyas = marcas[elegido];
  if (!quien || !suyas) return null;

  async function cambiar(campo: Campo, valor: boolean) {
    const antes = suyas;
    setMarcas((m) => ({ ...m, [elegido]: { ...antes, [campo]: valor } }));
    setEstado('guardando');
    try {
      const res = await fetch('/api/portal/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, contactoId: elegido, [campo]: valor }),
      });
      if (!res.ok) throw new Error();
      setEstado('guardado');
    } catch {
      // No se guardó: el tilde vuelve a como estaba, para no mostrar algo que no es.
      setMarcas((m) => ({ ...m, [elegido]: antes }));
      setEstado('error');
    }
  }

  return (
    <div className="pedir-avisos">
      {/* El estado del guardado va acá, al lado del título, y no en la línea
          de abajo: ahí el texto cambiaba de largo, pasaba a dos renglones y
          el botón de enviar se movía con cada tilde. */}
      <span className="pedir-avisos-titulo">
        Notificaciones por correo
        <span className="pedir-avisos-guardado" aria-live="polite">
          {estado === 'guardado' && 'Guardado'}
          {estado === 'error' && 'No se guardó'}
        </span>
      </span>

      <div className="pedir-avisos-cuerpo">
        {quien.email ? (
          <>
            {/* Una casilla por aviso, del color de las etiquetas de
                codificación: verde con su tilde si le llega, roja y vacía si
                no. Se cambia tocando el renglón. Al responsable de compras la
                factura le llega siempre: se ve tildada y no se puede destildar
                desde acá. El recibo sí lo puede apagar. */}
            <div className="pedir-avisos-etiquetas">
              {AVISOS.map((a) => {
                const fija = a.campo === 'recibeFactura' && quien.facturacion;
                const si = fija || suyas[a.campo];
                return (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={si}
                    className={`pedir-avisos-etiqueta${si ? ' si' : ''}`}
                    key={a.campo}
                    disabled={fija || estado === 'guardando'}
                    title={
                      fija
                        ? 'Te llega siempre, por ser responsable de compras'
                        : si
                          ? 'Te llega por correo. Tocá para dejar de recibirlo'
                          : 'No te llega. Tocá para recibirlo por correo'
                    }
                    onClick={() => cambiar(a.campo, !suyas[a.campo])}
                  >
                    <span className="pedir-avisos-cuadro" aria-hidden="true">
                      {si ? '✓' : ''}
                    </span>
                    {a.texto}
                  </button>
                );
              })}
            </div>
            <p className="pedir-avisos-n">Llegan a {quien.email}</p>
          </>
        ) : (
          <p className="pedir-avisos-n">
            No tenemos tu correo cargado, así que no podemos mandarte avisos. Escribinos y lo
            sumamos.
          </p>
        )}
      </div>
    </div>
  );
}
