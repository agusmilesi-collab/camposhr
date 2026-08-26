'use client';

/**
 * El cliente del pedido: se escribe, no se despliega.
 *
 * El campo es el `Buscador` del OS; acá está lo propio del pedido, que es qué
 * manda el formulario: `empresaId` cuando se eligió una de la lista y
 * `empresaNueva` cuando se está dando de alta. Nunca los dos.
 */

import { useState } from 'react';
import Buscador from '@/app/os/Buscador';
import type { Opcion } from './Agregar';

export default function BuscarCliente({
  empresas,
  autoFocus = false,
}: {
  empresas: Opcion[];
  autoFocus?: boolean;
}) {
  /** El de la lista, si se eligió uno. */
  const [elegido, setElegido] = useState<Opcion | null>(null);
  /** El nombre del que se está dando de alta, si es uno nuevo. */
  const [nuevo, setNuevo] = useState<string | null>(null);

  return (
    <>
      <input type="hidden" name="empresaId" value={elegido?.id ?? ''} />
      <input type="hidden" name="empresaNueva" value={nuevo ?? ''} />

      <Buscador
        id="empresaId"
        opciones={empresas}
        autoFocus={autoFocus}
        placeholder="Escribí el nombre del cliente"
        alElegir={(e) => {
          setElegido(e as Opcion);
          setNuevo(null);
        }}
        alCrear={(nombre) => {
          setNuevo(nombre);
          setElegido(null);
        }}
        // Mientras se escribe no hay nada elegido: si quedara el anterior, el
        // pedido se cargaría al cliente de antes con otro nombre a la vista.
        alEscribir={() => {
          setElegido(null);
          setNuevo(null);
        }}
      />

      {nuevo && (
        <span className="os-form-nota">
          Se da de alta <b>{nuevo}</b> junto con el pedido.
        </span>
      )}
    </>
  );
}
