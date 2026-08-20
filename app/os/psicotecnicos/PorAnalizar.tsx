/**
 * Lo que está esperando análisis, en tarjetas.
 *
 * Es la única etapa donde el trabajo no es recorrer una lista y avanzar filas:
 * es entrar a cada persona, leer su sumario y su informe, y recién entonces
 * cerrarla. Por eso la tarjeta entera lleva a su ficha, y lo que muestra es lo
 * que sirve para elegir por cuál seguir: hace cuánto espera, con qué batería
 * se la evaluó y si ya está cerrada.
 *
 * Entregar se hace en la ficha, que es donde se ve lo que sostiene esa
 * decisión.
 */

import Link from 'next/link';
import type { Evaluacion } from '@/lib/psicotecnicos';
import { COLOR_RECOMENDACION } from '@/lib/psicotecnicos-tipos';
import { haceCuanto } from '@/lib/hora';

function Tarjeta({ e }: { e: Evaluacion }) {
  // Pasada la semana la espera se marca: el informe se está demorando.
  const demorada = (e.dias ?? 0) > 7;

  return (
    <Link
      className="os-analizar-card"
      href={`/os/psicotecnicos/ficha/${e.id}?desde=por-analizar`}
    >
      <span className="os-tarjeta-cliente">{e.empresa}</span>
      <span className="os-analizar-nombre">{e.nombre}</span>
      <span className="os-analizar-puesto">{e.puesto}</span>

      <span className="os-analizar-datos">
        <span className="os-analizar-dato">
          <span className="os-analizar-rotulo">Batería</span>
          {e.bateria ?? 'a definir'}
        </span>
        <span className={`os-analizar-dato${demorada ? ' demorada' : ''}`}>
          <span className="os-analizar-rotulo">Espera</span>
          {haceCuanto(e.dias)}
        </span>
      </span>

      <span className="os-analizar-pie">
        {e.recomendacion ? (
          <span className={`os-sello-estado ${COLOR_RECOMENDACION[e.recomendacion] ?? 'os-gris'}`}>
            {e.recomendacion}
          </span>
        ) : (
          <span className="os-dato-falta">sin cerrar</span>
        )}
      </span>
    </Link>
  );
}

export default function PorAnalizar({ filas }: { filas: Evaluacion[] }) {
  return (
    <div className="os-analizar">
      {filas.map((e) => (
        <Tarjeta key={e.id} e={e} />
      ))}
    </div>
  );
}
