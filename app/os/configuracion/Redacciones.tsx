import Textos, { type Renglon } from './Textos';
import { TEXTOS } from '@/lib/redacciones';
import { loQueRige } from '@/lib/informe';

/**
 * Lo que el informe escribe para cada lectura.
 *
 * El diccionario del método dice, para cada índice fuera de banda, qué
 * significa para el trabajo y qué se recomienda hacer. El motor no escribe: los
 * selecciona. Acá se corrigen esos textos sin tocar el algoritmo, que es lo que
 * decide cuándo entra cada uno.
 */
export default async function Redacciones() {
  const rige = await loQueRige();
  const escritos = rige.textos;

  const renglones: Renglon[] = Object.entries(TEXTOS).map(([clave, t]) => ({
    clave,
    area: t.area,
    indice: t.indice,
    cuando: t.cuando,
    dice: escritos[clave]?.dice ?? t.dice,
    recomienda: escritos[clave]?.recomienda ?? t.recomienda,
    diceFabrica: t.dice,
    recomiendaFabrica: t.recomienda,
  }));

  return <Textos renglones={renglones} tocado={Object.keys(escritos).length > 0} />;
}
