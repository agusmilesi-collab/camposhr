'use client';

/**
 * Facturar esta evaluación desde la hoja de entrevista.
 *
 * Aparece cuando la entrevista por competencias está administrada: ahí el
 * trabajo ya se hizo y se puede facturar sin ir a la pantalla de Facturación.
 * El botón va al lado de "Entrevista tomada" y despliega abajo lo mismo que
 * esa pantalla muestra para el cliente: los datos fiscales, la emisora, el
 * número y el importe, con esta evaluación sola.
 *
 * El panel se dibuja debajo de la tarjeta de cierre (con un portal al lugar
 * que la hoja le deja), porque el botón vive en la fila de botones y ahí no
 * entra.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AFacturar } from '../../facturacion/Facturacion';
import type { Emisora, Facturable, Fiscal } from '@/lib/facturas-tipos';

export const LUGAR_FACTURAR = 'hoja-facturar';

export default function Facturar({
  pendiente,
  emisoras,
  siguientes,
  fiscal,
  quien,
}: {
  pendiente: Facturable;
  emisoras: Emisora[];
  siguientes: Record<string, number>;
  fiscal?: Fiscal;
  quien: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [lugar, setLugar] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setLugar(document.getElementById(LUGAR_FACTURAR));
  }, []);

  return (
    <>
      <button
        type="button"
        className={`os-boton${abierto ? ' os-boton-marcado' : ''}`}
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        Facturar
      </button>
      {abierto &&
        lugar &&
        createPortal(
          <AFacturar
            pendientes={[pendiente]}
            emisoras={emisoras}
            siguientes={siguientes}
            fiscales={fiscal ? { [pendiente.empresaId]: fiscal } : {}}
            quien={quien}
            conRotulo={false}
          />,
          lugar,
        )}
    </>
  );
}
