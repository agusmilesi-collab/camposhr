/**
 * Dónde corta un indicador del velocímetro, como dato.
 *
 * Vive aparte de `lib/competencias.ts` porque lo usan los dos lados: el motor
 * para puntuar y la pantalla de Configuración para mostrar y dejar mover cada
 * número. Con la frase escrita a mano al lado de la cuenta, mover un corte
 * dejaba la pantalla diciendo el corte viejo.
 */

/** Bajo, medio o alto. Null cuando el dato no está cargado. */
export type Nivel = 1 | 2 | 3 | null;

/**
 * Dónde corta un indicador entre bajo, medio y alto.
 *
 * Está declarado como dato y no como una frase, porque es lo que la psicóloga
 * revisa y mueve desde Configuración. De acá salen tres cosas que antes se
 * escribían a mano y se desincronizaban entre sí: la cuenta, el texto de cada
 * banda en la pantalla y los números editables.
 *
 * `umbral` es el caso corriente: un valor a partir del cual es alto y otro a
 * partir del cual es medio. `banda` es para los índices donde lo esperable es
 * un intervalo y desviarse para cualquiera de los dos lados es peor, como el
 * índice de egocentrismo o Lambda.
 */
export type Escala =
  | {
      forma: 'umbral';
      /** true: cuanto más alto mejor. false: cuanto más bajo mejor. */
      mayorEsMejor: boolean;
      alto: number;
      medio: number;
      decimales?: number;
      /** Se muestra y se escribe como porcentaje, aunque se calcule de 0 a 1. */
      porcentaje?: boolean;
    }
  | {
      forma: 'banda';
      alto: [number, number];
      medio: [number, number];
      decimales?: number;
      porcentaje?: boolean;
    };

/** Los números de una escala, en el orden en que se guardan y se editan. */
export function numerosDe(e: Escala): number[] {
  return e.forma === 'umbral' ? [e.alto, e.medio] : [...e.alto, ...e.medio];
}

/**
 * En qué banda cae un valor, con los números que rigen.
 *
 * En `banda` se prueba alto primero y medio después, así que los dos intervalos
 * pueden compartir el borde sin que haya que escribirlo con un épsilon.
 */
export function nivelPorEscala(v: number | null, e: Escala, n: number[]): Nivel {
  if (v === null) return null;
  if (e.forma === 'umbral') {
    const [alto, medio] = n;
    if (e.mayorEsMejor) return v >= alto ? 3 : v >= medio ? 2 : 1;
    return v <= alto ? 3 : v <= medio ? 2 : 1;
  }
  const [ad, ah, md, mh] = n;
  if (v >= ad && v <= ah) return 3;
  if (v >= md && v <= mh) return 2;
  return 1;
}



/** Un número como se escribe en la pantalla y en el informe. */
export function comoNumero(v: number, e: Escala): string {
  const n = e.porcentaje ? v * 100 : v;
  const dec = e.porcentaje ? 0 : (e.decimales ?? 0);
  return n.toFixed(dec).replace('.', ',') + (e.porcentaje ? '%' : '');
}

/**
 * Qué tiene que pasar para que el indicador caiga en una banda.
 *
 * Sale de la escala y de los números que rigen, así que la frase que lee la
 * psicóloga y la cuenta que hace el informe no se pueden separar. `bajo` no
 * lleva números propios: es todo lo que no entró en las otras dos.
 */
export function reglaDeBanda(
  e: Escala | null | undefined,
  n: number[] | undefined,
  cual: 0 | 1 | 2,
  reglas?: readonly string[]
): string {
  if (!e) return reglas?.[cual] ?? '';
  const num = n ?? numerosDe(e);
  const esc = (v: number) => comoNumero(v, e);
  if (e.forma === 'umbral') {
    if (cual === 2) return e.mayorEsMejor ? `menos de ${esc(num[1])}` : `más de ${esc(num[1])}`;
    const corte = num[cual];
    return e.mayorEsMejor ? `desde ${esc(corte)}` : `hasta ${esc(corte)}`;
  }
  if (cual === 2) return 'fuera de las dos bandas';
  const [d, h] = cual === 0 ? [num[0], num[1]] : [num[2], num[3]];
  return d === h ? `exactamente ${esc(d)}` : `entre ${esc(d)} y ${esc(h)}`;
}
