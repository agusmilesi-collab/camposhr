'use client';

/**
 * El botón que abre el cajón con los datos del candidato.
 *
 * Los cinco campos del alta (pedido, nombre, teléfono, correo y evaluadora) y
 * el CV se corrigen desde acá, que es la pestaña donde se leen. Antes el cajón
 * colgaba de la tarjeta del tablero de entrevistas, y ahí competía con lo que
 * la tarjeta hace, que es arrastrarse entre columnas.
 */

import { useState } from 'react';
import Candidato, { type DatosDelCandidato } from '../../Candidato';
import type { PedidoOpcion } from '../../Agregar';

export default function Editar({
  datos,
  pedidos,
  evaluadoras,
}: {
  datos: DatosDelCandidato;
  pedidos: PedidoOpcion[];
  evaluadoras: string[];
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button className="os-boton" onClick={() => setAbierto(true)}>
        Editar datos y CV
      </button>
      {abierto && (
        <Candidato
          e={datos}
          pedidos={pedidos}
          evaluadoras={evaluadoras}
          enLaFicha
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
