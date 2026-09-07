import Shell from '../Shell';
import Explorador from './Explorador';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

export const metadata = { title: 'Progreso del potencial — Campos OS' };

/**
 * La lámina de Jaques, con los dos datos a mano.
 *
 * Sirve para dos cosas: ver a qué banda pertenece un punto antes de tener la
 * ficha cargada, y contestar con el dibujo delante cuando un cliente pregunta
 * hasta dónde puede llegar alguien de tal edad con tal horizonte.
 *
 * No guarda nada ni lee ninguna evaluación: es la lámina y nada más. El punto
 * de una persona real se carga en su ficha, en Potencial.
 */
export default async function Potencial() {
  const [yo, cuentas] = await Promise.all([quienSoy(), cuentasDeLaBarra()]);

  return (
    <Shell titulo="Progreso del potencial" identidad={yo.nombre} cuentas={cuentas}>
      <div className="os-encabezado">
        <h1>Progreso del potencial</h1>
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>Leer un punto</h2>
        </div>
        <p className="os-panel-nota">
          Los mismos dos datos que se cargan en la ficha: la edad del día de la evaluación y el
          horizonte temporal que sale del discurso. Acá no se guarda nada.
        </p>
        <Explorador />
      </div>
    </Shell>
  );
}
