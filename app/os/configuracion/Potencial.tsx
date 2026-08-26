import Estratos from './Estratos';
import { NIVELES, nivelesQueRigen } from '@/lib/discursivo';
import { ajuste } from '@/lib/ajustes';
import { nivelesValidos, type TextoDeNivel } from '@/lib/discursivo';

/**
 * Los textos del potencial de desarrollo, editables.
 *
 * Son los cuatro estratos del modelo de Jaques: qué rol abarca cada uno, qué
 * lapso de tiempo proyecta y qué lo caracteriza. La evaluadora ubica a la
 * persona en uno de los cuatro escuchando su discurso, y estos textos son los
 * que sostienen esa decisión y los que van al informe.
 */
export default async function Potencial() {
  const guardados = await ajuste<Record<string, Partial<TextoDeNivel>>>('discursivo_niveles');
  const movidos = nivelesValidos(guardados) ?? {};

  const niveles = nivelesQueRigen(movidos).map((n, i) => ({
    ...n,
    fabrica: {
      que: NIVELES[i].que,
      lapso: NIVELES[i].lapso,
      caracteristicas: NIVELES[i].caracteristicas,
    },
  }));

  return <Estratos niveles={niveles} tocado={Object.keys(movidos).length > 0} />;
}
