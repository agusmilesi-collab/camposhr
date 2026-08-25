import Shell from '../Shell';
import Pesos, { type Hoja } from './Pesos';
import { quienSoy } from '@/lib/identidad';
import { HOJAS, PESOS_DE_FABRICA, claveDePeso } from '@/lib/competencias';
import { loQueRige } from '@/lib/informe';

export const dynamic = 'force-dynamic';

/**
 * Cuánto pesa cada indicador dentro de su competencia.
 *
 * El puntaje de una competencia es el promedio de sus indicadores, cada uno por
 * su peso. Los pesos son criterio clínico: que la calidad del vínculo valga el
 * doble que el índice de egocentrismo en Habilidad interpersonal es una decisión
 * sobre qué define esa competencia, no una cuenta.
 *
 * Las filas se arman acá y no en el componente porque cada indicador trae su
 * función de nivel, que no viaja al navegador.
 */
export default async function Ponderaciones() {
  const [yo, rige] = await Promise.all([quienSoy(), loQueRige()]);
  const movidos = rige.pesos;

  const hojas: Hoja[] = Object.entries(HOJAS).map(([test, hoja]) => ({
    test,
    competencias: hoja.map((c) => ({
      nombre: c.competencia,
      mide: c.mide,
      indicadores: c.indicadores.map((i) => {
        const clave = claveDePeso(test, c.competencia, i.nombre);
        return {
          clave,
          nombre: i.nombre,
          mide: i.mide,
          corte: i.corte,
          peso: movidos[clave] ?? PESOS_DE_FABRICA[clave],
          fabrica: PESOS_DE_FABRICA[clave],
        };
      }),
    })),
  }));

  const tocado = Object.keys(movidos).length > 0;

  return (
    <Shell
      titulo="Ponderaciones"
      identidad={yo.nombre}
      ancho
      nota={tocado ? 'modificadas' : 'de fábrica'}
    >
      <div className="os-encabezado">
        <h1>Ponderaciones</h1>
        <p>
          Cuánto pesa cada indicador dentro de su competencia. El puntaje es el
          promedio de los indicadores que tienen dato, cada uno por su peso.
          Rige desde el próximo informe que se abra; los ya entregados no se
          recalculan solos.
        </p>
      </div>

      <Pesos hojas={hojas} tocado={tocado} />
    </Shell>
  );
}
