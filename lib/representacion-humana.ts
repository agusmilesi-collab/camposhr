/**
 * GHR y PHR, los dos códigos especiales que no elige la evaluadora.
 *
 * Salen del resto de la codificación de la respuesta siguiendo la secuencia de
 * siete pasos del Sistema Comprehensivo (Exner), que las psicólogas pidieron
 * que el OS aplique solo (19/10/2026). Fuentes: Tabla 10 del capítulo 7,
 * "Códigos especiales", p. 87, para Rorschach; y el apartado "E) Las
 * respuestas de representación humana (HR)", p. 67, para Zulliger. Las dos
 * secuencias son la misma salvo el paso 5: en Rorschach cuentan las populares
 * de las láminas III, IV, VII y IX, y en Zulliger solo las de la lámina III.
 *
 * Los pasos se prueban en orden y el primero que se cumple decide: "las
 * restantes" de cada paso son las que no cayeron en uno anterior.
 */

type Codificada = {
  lamina: string | null;
  determinantes: string[] | null;
  fq: string | null;
  contenidos: string[] | null;
  popular: boolean | null;
  cc_ee: string[] | null;
};

/** Los contenidos que hacen de una respuesta una representación humana. */
const CONTENIDO_HUMANO = ['H', '(H)', 'Hd', '(Hd)', 'Hx'];

/** Los códigos especiales cognitivos, en sus dos niveles. */
const COGNITIVOS = ['DV', 'DV2', 'DR', 'DR2', 'INCOM', 'INCOM2', 'FABCOM', 'FABCOM2', 'ALOG', 'CONTAM'];
const NIVEL_2 = ['DV2', 'DR2', 'INCOM2', 'FABCOM2'];

/** Las láminas cuya popular es GHR en el paso 5. */
const POPULARES_HUMANAS = new Set(['III', 'IV', 'VII', 'IX', 'Z3']);

/**
 * Si la respuesta es de representación humana: todas las H, (H), Hd, (Hd) y Hx,
 * todas las M, y las FM que llevan COP o AG. Son los tres criterios que abren
 * la p. 87 del Rorschach y la p. 67 del Zulliger, iguales en los dos libros.
 */
export function esRepresentacionHumana(f: Codificada): boolean {
  const det = f.determinantes ?? [];
  const cc = f.cc_ee ?? [];
  if ((f.contenidos ?? []).some((c) => CONTENIDO_HUMANO.includes(c))) return true;
  if (det.some((d) => d.startsWith('M'))) return true;
  return det.some((d) => d.startsWith('FM')) && (cc.includes('COP') || cc.includes('AG'));
}

/**
 * GHR, PHR o ninguno.
 *
 * Sin calidad formal cargada no se decide: los pasos 1 y 2 dependen de ella, y
 * una respuesta a medio codificar saldría con un código que cambia al terminar
 * de cargarla. "Sin FQ" es la opción `none`, no la celda vacía. Confirmado
 * por las psicólogas el 19/10/2026.
 */
export function representacionHumana(f: Codificada): 'GHR' | 'PHR' | null {
  if (!f.fq || !esRepresentacionHumana(f)) return null;

  const cc = f.cc_ee ?? [];
  const contenidos = f.contenidos ?? [];
  const tiene = (...codigos: string[]) => codigos.some((c) => cc.includes(c));
  const formaBuena = f.fq === '+' || f.fq === 'O' || f.fq === 'U';

  /* 1. H pura con buena forma, sin cognitivos salvo DV y sin AG ni MOR. El DV
        que se perdona es el de nivel 1: el DV2 es de nivel 2 y el paso 2 lo
        manda a PHR. Confirmado por las psicólogas el 19/10/2026. */
  if (
    contenidos.includes('H') &&
    formaBuena &&
    !COGNITIVOS.some((c) => c !== 'DV' && cc.includes(c)) &&
    !tiene('AG', 'MOR')
  ) {
    return 'GHR';
  }
  // 2. Forma menos o sin forma; o buena forma con ALOG, CONTAM o un cognitivo de nivel 2.
  if (!formaBuena) return 'PHR';
  if (tiene('ALOG', 'CONTAM', ...NIVEL_2)) return 'PHR';
  // 3. COP sin AG.
  if (tiene('COP') && !tiene('AG')) return 'GHR';
  // 4. FABCOM, MOR o contenido An.
  if (tiene('FABCOM', 'MOR') || contenidos.includes('An')) return 'PHR';
  // 5. Popular en las láminas de figura humana.
  if (f.popular && f.lamina && POPULARES_HUMANAS.has(f.lamina)) return 'GHR';
  // 6. AG, INCOM, DR o contenido Hd, que no es lo mismo que (Hd).
  if (tiene('AG', 'INCOM', 'DR') || contenidos.includes('Hd')) return 'PHR';
  // 7. Las que quedan.
  return 'GHR';
}

/**
 * Los códigos especiales de la respuesta con el GHR o PHR que le corresponde.
 *
 * Saca el que hubiera y pone el calculado, en el lugar donde estaba si estaba:
 * así un cambio que no lo mueve deja la lista igual y no se guarda de nuevo.
 */
export function conRepresentacionHumana(f: Codificada): string[] {
  const cc = f.cc_ee ?? [];
  const codigo = representacionHumana(f);
  const donde = cc.findIndex((c) => c === 'GHR' || c === 'PHR');
  const sin = cc.filter((c) => c !== 'GHR' && c !== 'PHR');
  if (!codigo) return sin;
  if (donde < 0) return [...sin, codigo];
  return [...sin.slice(0, donde), codigo, ...sin.slice(donde)];
}

/** Los campos de una fila de los que depende el código. */
export const CAMPOS_HR = ['lamina', 'determinantes', 'fq', 'contenidos', 'popular', 'cc_ee'] as const;
