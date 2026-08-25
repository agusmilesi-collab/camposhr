'use client';

/**
 * Abrir un pedido desde la pantalla de pedidos.
 *
 * Hasta ahora el único lugar donde se abría uno era el cajón de alta de
 * candidato, en Sin asignar: para registrar el mail de un cliente que todavía
 * no mandó a nadie había que entrar a cargar un candidato que no existía. La
 * pantalla que se llama Pedidos no dejaba hacer un pedido.
 *
 * Es el mismo cajón, con los mismos ocho campos. Al guardarlo la lista se
 * recarga y el pedido nuevo aparece arriba, que es donde lo pone la fecha.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import PedidoNuevo from '../psicotecnicos/PedidoNuevo';
import type { BateriaOpcion, Opcion } from '../psicotecnicos/Agregar';

export default function Abrir({
  empresas,
  baterias,
  empresaFija,
}: {
  empresas: Opcion[];
  baterias: BateriaOpcion[];
  /** Cuando se abre desde la ficha de un cliente, el pedido ya es suyo. */
  empresaFija?: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [, empezar] = useTransition();

  return (
    <>
      <button
        type="button"
        className="os-boton os-boton-firme"
        onClick={() => setAbierto(true)}
      >
        Nuevo pedido
      </button>

      {abierto && (
        <PedidoNuevo
          empresas={empresas}
          baterias={baterias}
          empresaFija={empresaFija}
          onCreado={() => {
            setAbierto(false);
            empezar(() => router.refresh());
          }}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
