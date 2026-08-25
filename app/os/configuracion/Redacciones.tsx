import Textos, { type Renglon } from './Textos';
import { TEXTOS, corteDe, cuandoDe, type ClaveDeTexto, type Redaccion } from '@/lib/redacciones';
import { loQueRige } from '@/lib/informe';

/**
 * Lo que el informe escribe para cada lectura, y contra qué número entra.
 *
 * El diccionario del método dice, para cada índice fuera de banda, qué
 * significa para el trabajo y qué se recomienda hacer. El motor no escribe: los
 * selecciona. Acá se corrigen esos textos y se mueven los cortes contra los que
 * el motor los selecciona, sin tocar el algoritmo.
 *
 * El corte que se mueve acá es el mismo que después pinta el sumario
 * estructural de verde o de rojo: el informe y la hoja no pueden decir cosas
 * distintas porque leen la misma tabla.
 */
export default async function Redacciones() {
  const rige = await loQueRige();
  const escritos = rige.textos;
  const cortes = rige.cortes;

  const renglones: Renglon[] = Object.entries(TEXTOS as Record<string, Redaccion>).map(
    ([clave, t]) => ({
      clave,
      area: t.area,
      indice: t.indice,
      cuando: cuandoDe(clave as ClaveDeTexto, cortes),
      dice: escritos[clave]?.dice ?? t.dice,
      recomienda: escritos[clave]?.recomienda ?? t.recomienda,
      diceFabrica: t.dice,
      recomiendaFabrica: t.recomienda,
      corte: t.corte
        ? {
            op: t.corte.op,
            decimales: t.corte.decimales,
            ademas: t.corte.ademas ?? null,
            valor: corteDe(clave as ClaveDeTexto, cortes),
            fabrica: t.corte.valor,
          }
        : null,
    })
  );

  return (
    <Textos
      renglones={renglones}
      tocado={Object.keys(escritos).length > 0 || Object.keys(cortes).length > 0}
    />
  );
}
