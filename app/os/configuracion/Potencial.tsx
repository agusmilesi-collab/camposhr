import Estratos from './Estratos';
import Conclusiones from './Conclusiones';
import {
  CONCLUSIONES_POTENCIAL,
  NIVELES,
  conclusionesQueRigen,
  conclusionesValidas,
  nivelesQueRigen,
} from '@/lib/discursivo';
import { ajuste } from '@/lib/ajustes';
import { nivelesValidos, type TextoDeNivel } from '@/lib/discursivo';

/**
 * Los textos del potencial de desarrollo, editables.
 *
 * Son los cuatro estratos del modelo de Jaques: qué horizonte de tiempo abarca
 * la tarea más larga de ese nivel, qué complejidad de trabajo puede abordar
 * quien está ahí, y qué exige el nivel siguiente. La evaluadora ubica a la
 * persona en uno de los cuatro escuchando su discurso, y estos textos son los
 * que sostienen esa decisión y los que arman el capítulo del informe.
 */
export default async function Potencial() {
  const guardados = await ajuste<Record<string, Partial<TextoDeNivel>>>('discursivo_niveles');
  const movidos = nivelesValidos(guardados) ?? {};

  const niveles = nivelesQueRigen(movidos).map((n, i) => ({
    ...n,
    original: {
      que: NIVELES[i].que,
      horizonte: NIVELES[i].horizonte,
      actual: NIVELES[i].actual,
      ejemplos: NIVELES[i].ejemplos,
      proyeccion: NIVELES[i].proyeccion,
    },
  }));

  /* Las conclusiones se editan al pie de los estratos: son lo que se lee
     después de ubicar a la persona, y el orden de la pantalla sigue el orden en
     que se usa. */
  const guardadasConclusiones = await ajuste<Record<string, string>>('discursivo_conclusiones');
  const movidasConclusiones = conclusionesValidas(guardadasConclusiones) ?? {};

  return (
    <>
      <Estratos niveles={niveles} tocado={Object.keys(movidos).length > 0} />
      <Conclusiones
        textos={conclusionesQueRigen(movidasConclusiones)}
        originales={{ ...CONCLUSIONES_POTENCIAL }}
        tocado={Object.keys(movidasConclusiones).length > 0}
      />
    </>
  );
}
