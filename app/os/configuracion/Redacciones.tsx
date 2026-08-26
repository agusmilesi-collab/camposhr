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
 *
 * **Cada texto se escribe hasta tres veces.** El informe toma una, elegida por
 * dónde está el candidato en su pedido, así el cliente que recibe tres informes
 * de la misma búsqueda no lee tres veces el mismo párrafo.
 *
 * **El corte y la recomendación se pueden escribir aparte para Zulliger.** Las
 * normas de cada test son distintas y lo que se sugiere hacer depende de con
 * qué se midió. Lo que dice la lectura es uno solo: un Lambda alto significa lo
 * mismo se haya medido con uno o con otro.
 */
export default async function Redacciones() {
  const rige = await loQueRige();
  const escritos = rige.textos;
  const cortes = rige.cortes;

  /** Las tres casillas de un campo: lo escrito, y vacías las que falten. */
  const tres = (v: string[] | undefined) => [0, 1, 2].map((i) => v?.[i] ?? '');

  const renglones: Renglon[] = Object.entries(TEXTOS as Record<string, Redaccion>).map(
    ([clave, t]) => {
      const corteDeTest = (test: 'Rorschach' | 'Zulliger') => {
        const base = (test === 'Zulliger' ? t.zulliger?.corte : undefined) ?? t.corte;
        if (!base) return null;
        return {
          op: base.op,
          decimales: base.decimales,
          ademas: base.ademas ?? null,
          valor: corteDe(clave as ClaveDeTexto, cortes, test),
          fabrica: base.valor,
        };
      };

      return {
        clave,
        area: t.area,
        indice: t.indice,
        cuando: cuandoDe(clave as ClaveDeTexto, cortes),
        dice: tres(escritos[clave]?.dice ?? t.dice),
        recomienda: tres(escritos[clave]?.recomienda ?? t.recomienda),
        // La del Zulliger se muestra vacía mientras no se escriba: vacía quiere
        // decir "vale la del Rorschach", que es lo que pasa hoy en casi todas.
        recomiendaZ: tres(escritos[clave]?.recomiendaZ ?? t.zulliger?.recomienda),
        diceFabrica: tres(t.dice),
        recomiendaFabrica: tres(t.recomienda),
        recomiendaZFabrica: tres(t.zulliger?.recomienda),
        corte: corteDeTest('Rorschach'),
        corteZ: corteDeTest('Zulliger'),
      };
    }
  );

  return (
    <Textos
      renglones={renglones}
      tocado={Object.keys(escritos).length > 0 || Object.keys(cortes).length > 0}
    />
  );
}
