'use client';

/**
 * Qué avisos quiere recibir por correo quien envía el pedido.
 *
 * Aparece debajo de "Enviar como", cuando la persona eligió su nombre: es ella
 * la que decide si quiere el correo con la fecha de la entrevista y el de que
 * el informe está listo. Se guarda al tildar, en su contacto, y vale para todos
 * sus pedidos: son las mismas marcas que el equipo ve en la ficha del cliente.
 *
 * Va siempre a la vista, sin desplegar (pedido de Agustín, 8/10/2026): son
 * cuatro renglones, y plegado nadie se enteraba de que podía elegir.
 */

import { useState } from 'react';
import type { Contacto } from '@/lib/contactos-tipos';

const AVISOS = [
  { campo: 'recibeEntrevista', texto: 'Fecha de la entrevista', dePlata: false },
  { campo: 'recibeInforme', texto: 'Informe listo', dePlata: false },
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
      <span className="pedir-avisos-titulo">Notificaciones por correo</span>

      <div className="pedir-avisos-cuerpo">
        {quien.email ? (
          <>
            {/* Una casilla: tildada si le llega, vacía si no. Se cambia
                tocando el renglón. */}
            {/* Al responsable de compras la factura y el recibo le llegan
                siempre: no son algo que pueda apagar desde acá. */}
            {AVISOS.filter((a) => !(a.dePlata && quien.facturacion)).map((a) => (
              <button
                type="button"
                role="switch"
                aria-checked={suyas[a.campo]}
                className="pedir-avisos-marca"
                key={a.campo}
                disabled={estado === 'guardando'}
                onClick={() => cambiar(a.campo, !suyas[a.campo])}
              >
                <span
                  className={`pedir-avisos-caja${suyas[a.campo] ? ' si' : ''}`}
                  aria-hidden="true"
                >
                  {suyas[a.campo] ? '✓' : ''}
                </span>
                <span className="pedir-avisos-que">{a.texto}</span>
              </button>
            ))}
            <p className="pedir-avisos-n" aria-live="polite">
              {estado === 'error'
                ? 'No se pudo guardar. Probá de nuevo.'
                : `${estado === 'guardado' ? 'Guardado. ' : ''}Llegan a ${quien.email}.`}
            </p>
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
