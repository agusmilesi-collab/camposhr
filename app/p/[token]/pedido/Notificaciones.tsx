'use client';

/**
 * Qué avisos quiere recibir por correo quien envía el pedido.
 *
 * Aparece debajo de "Enviar como", cuando la persona eligió su nombre: es ella
 * la que decide si quiere el correo con la fecha de la entrevista y el de que
 * el informe está listo. Se guarda al tildar, en su contacto, y vale para todos
 * sus pedidos: son las mismas marcas que el equipo ve en la ficha del cliente.
 *
 * Va plegado: la mayoría no lo toca nunca, y abierto empujaría el botón de
 * enviar fuera de la vista.
 */

import { useState } from 'react';
import type { Contacto } from '@/lib/contactos-tipos';

const AVISOS = [
  { campo: 'recibeEntrevista', texto: 'La fecha de la entrevista, cuando se agenda' },
  { campo: 'recibeInforme', texto: 'El aviso de que el informe está listo' },
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
  const [abierto, setAbierto] = useState(false);
  // Lo que cada persona tiene tildado, para todas: si se cambia de nombre y se
  // vuelve, lo recién guardado sigue ahí sin volver a pedir la página.
  const [marcas, setMarcas] = useState<Record<string, Marcas>>(() =>
    Object.fromEntries(
      contactos.map((c) => [c.id, { recibeEntrevista: c.recibeEntrevista, recibeInforme: c.recibeInforme }])
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
      <button
        type="button"
        className="pedir-avisos-abrir"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        Configurar notificaciones
      </button>

      {abierto && (
        <div className="pedir-avisos-cuerpo">
          {quien.email ? (
            <>
              <p className="pedir-avisos-t">Quiero recibir por correo:</p>
              {AVISOS.map((a) => (
                <label className="pedir-avisos-marca" key={a.campo}>
                  <input
                    type="checkbox"
                    checked={suyas[a.campo]}
                    disabled={estado === 'guardando'}
                    onChange={(e) => cambiar(a.campo, e.target.checked)}
                  />
                  {a.texto}
                </label>
              ))}
              <p className="pedir-avisos-n" aria-live="polite">
                {estado === 'error'
                  ? 'No se pudo guardar. Probá de nuevo.'
                  : `${estado === 'guardado' ? 'Guardado. ' : ''}Llegan a ${quien.email} y vale para todos tus pedidos.`}
              </p>
            </>
          ) : (
            <p className="pedir-avisos-t">
              No tenemos tu correo cargado, así que no podemos mandarte avisos. Escribinos y lo
              sumamos.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
