/**
 * Las preguntas del seguimiento a los noventa días.
 *
 * Las contesta quien pidió la búsqueda, desde el enlace del correo
 * (`app/seguimiento/[token]/route.ts`). Son cerradas a propósito: son las que
 * después dicen si la evaluación predijo algo, y una respuesta escrita a mano
 * no se puede contar. La cuarta, el comentario, es abierta y opcional.
 *
 * Sin `server-only`: las leen la página pública y la ficha.
 */

export type PreguntaSeguimiento = {
  campo: 'seguimiento_sigue' | 'seguimiento_desempeno' | 'seguimiento_recontrataria';
  /** Cómo se pregunta en la página, con el nombre de la persona. */
  pregunta: (nombre: string) => string;
  /** Cómo se rotula en la ficha. */
  rotulo: string;
  opciones: string[];
};

/**
 * En el orden en que pasan las cosas: primero si sigue, después cómo trabajó
 * en estos noventa días, y por último si la volverían a elegir. La primera es
 * la que viaja en el correo, con sus botones (`lib/seguimiento.ts`).
 *
 * Las opciones no dependen del género de la persona, y las preguntas valen
 * tanto si sigue como si se fue: el desempeño va en pasado y la última no
 * pregunta si la volverían a contratar, que no se entiende si sigue ahí.
 */
export const PREGUNTAS_SEGUIMIENTO: PreguntaSeguimiento[] = [
  {
    campo: 'seguimiento_sigue',
    pregunta: (n) => `¿${n} sigue trabajando con ustedes?`,
    rotulo: 'Sigue trabajando',
    // A los noventa días termina el período de prueba: no pasarlo es que la
    // empresa terminó la relación.
    opciones: ['Sí', 'No, renunció', 'No, la empresa terminó la relación'],
  },
  {
    campo: 'seguimiento_desempeno',
    pregunta: (n) => `¿Cómo fue el desempeño de ${n} en estos noventa días?`,
    rotulo: 'Desempeño',
    opciones: ['Por encima de lo esperado', 'Lo esperado', 'Por debajo, con mejora', 'Por debajo, sin mejora'],
  },
  {
    campo: 'seguimiento_recontrataria',
    pregunta: (n) => `Sabiendo lo que saben hoy, ¿volverían a elegir a ${n}?`,
    rotulo: 'La volverían a elegir',
    opciones: ['Sí', 'No', 'No sé'],
  },
];

/**
 * El "cómo le fue" de siempre (Bien, Regular, Mal), deducido de las respuestas.
 *
 * Es el dato que ya leen Entregados, la ficha y el data hub, y que antes se
 * cargaba a mano. Desvincularlo es Mal aunque el desempeño diga otra cosa; si
 * renunció, manda el desempeño, porque irse no dice cómo trabajaba.
 */
export function resultadoDelSeguimiento(sigue: string, desempeno: string): 'Bien' | 'Regular' | 'Mal' {
  if (sigue === 'No, la empresa terminó la relación') return 'Mal';
  if (desempeno === 'Por encima de lo esperado' || desempeno === 'Lo esperado') return 'Bien';
  if (desempeno === 'Por debajo, con mejora') return 'Regular';
  return 'Mal';
}

/** La primera pregunta, que es la que se toca en el correo. */
export const EN_EL_CORREO = PREGUNTAS_SEGUIMIENTO[0];

/** El largo máximo del comentario: lo que entra en un correo, no un informe. */
export const LARGO_COMENTARIO = 2000;
