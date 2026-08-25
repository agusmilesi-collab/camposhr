import Shell from '../Shell';
import Baremo from './Baremo';
import { quienSoy } from '@/lib/identidad';
import { RANGOS } from '@/lib/raven';
import { rangosQueRigen } from '@/lib/informe';

export const dynamic = 'force-dynamic';

/**
 * Lo que las psicólogas pueden mover del motor.
 *
 * Hay decisiones del sistema que son criterio clínico y no técnico: dónde corta
 * cada rango del Raven, cuánto pesa cada indicador dentro de su competencia, qué
 * dice cada lectura. Estaban escritas en el código, así que cambiarlas pedía una
 * entrega y el criterio de quien firma el informe quedaba esperando.
 *
 * Empieza por el baremo, que es el que decide si el sistema pide más o menos
 * para cada rango.
 */
export default async function Baremos() {
  const [yo, rangos] = await Promise.all([quienSoy(), rangosQueRigen()]);
  const tocado = rangos.some((r) => RANGOS.find((f) => f.numeral === r.numeral)?.desde !== r.desde);

  return (
    <Shell titulo="Baremos" identidad={yo.nombre} ancho nota={tocado ? 'modificado' : 'de fábrica'}>
      <div className="os-encabezado">
        <h1>Baremos</h1>
        <p>
          Lo que decide cuánto pide el sistema. Se guarda acá y rige desde el próximo informe
          que se abra; los ya entregados no se recalculan solos.
        </p>
      </div>

      <Baremo rangos={rangos} fabrica={RANGOS} tocado={tocado} />
    </Shell>
  );
}
