import Shell from '../Shell';
import Textos, { type Renglon } from './Textos';
import { quienSoy } from '@/lib/identidad';
import { TEXTOS } from '@/lib/redacciones';
import { loQueRige } from '@/lib/informe';

export const dynamic = 'force-dynamic';

/**
 * Lo que el informe escribe para cada lectura.
 *
 * El diccionario del método dice, para cada índice fuera de banda, qué
 * significa para el trabajo y qué se recomienda hacer. El motor no escribe: los
 * selecciona. Acá se corrigen esos textos sin tocar el algoritmo, que es lo que
 * decide cuándo entra cada uno.
 */
export default async function Redacciones() {
  const [yo, rige] = await Promise.all([quienSoy(), loQueRige()]);
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

  const tocado = Object.keys(escritos).length > 0;

  return (
    <Shell
      titulo="Redacciones"
      identidad={yo.nombre}
      ancho
      nota={tocado ? `${Object.keys(escritos).length} reescritas` : 'de fábrica'}
    >
      <div className="os-encabezado">
        <h1>Redacciones</h1>
        <p>
          Lo que el informe escribe cuando una lectura se dispara. Cuándo entra cada una lo
          decide el índice y su corte, que se ven al lado del nombre. Rige desde el próximo
          informe que se abra; los ya entregados no se recalculan solos.
        </p>
      </div>

      <Textos renglones={renglones} tocado={tocado} />
    </Shell>
  );
}
