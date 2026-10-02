/**
 * El plan de incorporación: las recomendaciones al líder ordenadas por cuándo
 * se hacen.
 *
 * Reemplaza a la lista suelta de "Recomendaciones para su líder directo". El
 * criterio y la clasificación de cada lectura están en
 * `docs/plan-incorporacion.md`.
 *
 * **Cada lectura va a un solo tramo, el tramo en que empieza la acción del
 * líder.** El tramo es de la lectura y no de cada una de sus tres
 * redacciones, que dicen lo mismo de tres formas. Lo de fábrica vive acá y se
 * mueve desde Configuración → Redacciones, que guarda la diferencia
 * (`redacciones_tramos`).
 *
 * **El foco es lo que sale de la evaluación.** Cada tramo trae un solo punto
 * fijo, igual para todos, que va después de lo propio de la persona y más
 * apagado. Un tramo sin nada propio no lo muestra, salvo el de los días 31 a
 * 90: es el único que habla de dar autonomía, y el diccionario casi no tiene
 * lecturas para eso.
 *
 * No importa el diccionario: lo usa también el informe en el navegador, y el
 * diccionario son tres mil líneas que no tienen por qué viajar.
 */

export type Tramo = 'semana' | 'mes' | 'noventa' | 'siempre';

export const TRAMOS: { clave: Tramo; titulo: string; fijo: string }[] = [
  {
    clave: 'semana',
    titulo: 'Primera semana',
    fijo: 'Tener una conversación de expectativas: qué se espera del puesto y cómo se va a medir.',
  },
  {
    clave: 'mes',
    titulo: 'Días 1 a 30',
    fijo: 'Fijar dos o tres objetivos para el mes y revisarlos en una reunión individual cada quince días.',
  },
  {
    clave: 'noventa',
    titulo: 'Días 31 a 90',
    fijo: 'Revisar los objetivos del primer mes y decidir qué tareas pasa a hacer sin supervisión.',
  },
  {
    clave: 'siempre',
    titulo: 'Durante toda la relación',
    fijo: 'Sostener la reunión individual, aunque sea una vez por mes.',
  },
];

export const CLAVES_DE_TRAMO = TRAMOS.map((t) => t.clave);

export const esTramo = (v: unknown): v is Tramo =>
  typeof v === 'string' && (CLAVES_DE_TRAMO as string[]).includes(v);

/**
 * Dónde va cada lectura que trae recomendación, de fábrica.
 *
 * Una lectura que no está acá va a "Durante toda la relación": es el tramo que
 * no promete un plazo, así que una lectura nueva sin clasificar no le dice al
 * líder que algo termina cuando no termina.
 */
export const TRAMO_DE_FABRICA: Record<string, Tramo> = {
  // Primera semana: se hace una vez, al ingresar.
  'zd-alto': 'semana',
  'd-bajo': 'semana',
  'dqv-w-alto': 'semana',
  'xu-alto': 'semana',
  'p-bajo': 'semana',
  'p-alto': 'semana',
  'fc-descarga': 'semana',
  'sumt-cero': 'semana',
  'phr-mayor-que-ghr': 'semana',
  'aislamiento-alto': 'semana',
  'dqv-d-alto': 'semana',
  // Días 1 a 30: controles que dejan de hacer falta con la práctica.
  'lambda-bajo': 'mes',
  'zd-bajo': 'mes',
  'w-bajo': 'mes',
  'dd-alto': 'mes',
  'm-baja': 'mes',
  'dqv-alto': 'mes',
  'dqvmas-w-alto': 'mes',
  'zf-bajo': 'mes',
  'xa-bajo-wda-alto': 'mes',
  'xa-bajo': 'mes',
  'm-menos-alto': 'mes',
  'm-alto': 'mes',
  'c-prima-alta': 'mes',
  'x-menos-alto': 'mes',
  // Días 31 a 90: dar autonomía de a poco.
  'w-m-alto': 'noventa',
  'a-p-pasivo': 'noventa',
  'ma-mp-pasivo-fuerte': 'noventa',
  'fd-presente': 'noventa',
  // Durante toda la relación: estilo de conducción, o una situación que puede aparecer en cualquier momento.
  'lambda-alto': 'siempre',
  'mor-alto': 'siempre',
  'dr-presente': 'siempre',
  'alog-presente': 'siempre',
  's-menos-alto': 'siempre',
  'd-alto': 'siempre',
  'complejidad-alta-sin-recursos': 'siempre',
  'color-mixto': 'siempre',
  'sumc-prima-mayor': 'siempre',
  'fc-todo-cero': 'siempre',
  'psv-alto': 'siempre',
  'xa-medio-wda-bajo': 'siempre',
  'wda-medio': 'siempre',
  'eb-extratensivo': 'siempre',
  'a-p-pasivo-cuadruple': 'siempre',
  'a-p-pasivo-triple': 'siempre',
  'ma-mp-pasivo': 'siempre',
  'intelectualizacion-alta': 'siempre',
  'fm-cero': 'siempre',
  'fm-alto': 'siempre',
  'c-pura-alta': 'siempre',
  's-muy-alto': 'siempre',
  's-alto': 'siempre',
  'sumt-alto': 'siempre',
  'v-presente': 'siempre',
  'ego-bajo': 'siempre',
  'ego-alto': 'siempre',
  'reflejos-presentes': 'siempre',
  'cop-cero-ag-bajo': 'siempre',
  'aislamiento-muy-alto': 'siempre',
  'per-alto': 'siempre',
  'h-pura-baja': 'siempre',
  'adjd-menos-uno': 'siempre',
  'adjd-sobrecarga': 'siempre',
  'ea-bajo': 'siempre',
};

/** El tramo que rige para una lectura: lo movido desde Sistema, o el de fábrica. */
export function tramoDe(clave: string, movidos: Record<string, Tramo> = {}): Tramo {
  return movidos[clave] ?? TRAMO_DE_FABRICA[clave] ?? 'siempre';
}

/**
 * Lo que llega para guardar, validado: lecturas que existen y tramos que
 * existen. Null si algo no pasa, y la ruta lo rechaza entero.
 */
export function tramosValidos(v: unknown, claves: string[]): Record<string, Tramo> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const salida: Record<string, Tramo> = {};
  for (const [k, t] of Object.entries(v as Record<string, unknown>)) {
    if (!claves.includes(k) || !esTramo(t)) return null;
    salida[k] = t;
  }
  return salida;
}

/** Un renglón del plan: lo que hace el líder y en qué tramo. */
export type PasoDelPlan = { texto: string; tramo: Tramo };
