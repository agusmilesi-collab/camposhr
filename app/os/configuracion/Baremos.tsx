import Baremo from './Baremo';
import { RANGOS } from '@/lib/raven';
import { META, frecuencias, ravenPropio } from '@/lib/raven-propio';
import { loQueRige } from '@/lib/informe';

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
  const rige = await loQueRige();
  const rangos = rige.rangos;
  const propio = await ravenPropio(rangos);
  const tocado = rangos.some((r) => RANGOS.find((f) => f.numeral === r.numeral)?.desde !== r.desde);

  return (
    <Baremo
      rangos={rangos}
      fabrica={RANGOS}
      tocado={tocado}
      casos={propio.casos}
      meta={META}
      media={propio.media}
      frecuencia={frecuencias(propio, rangos)}
      enCadaRango={propio.porRango}
    />
  );
}
