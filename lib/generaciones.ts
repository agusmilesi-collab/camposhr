/**
 * Bloque de generaciones (variante 'generaciones' del cuestionario).
 *
 * Cuatro preguntas de opción única. Cada opción suma 1 punto a una generación:
 * la que más puntos junta es el estilo generacional de la persona. Máximo 4.
 *
 * Ojo con el orden de las opciones: en la primera pregunta el mapeo no sigue
 * el orden A-B-C-D (A es X y C es Boomer), tal como está en el cuestionario
 * original. Por eso cada opción declara su generación de forma explícita.
 */

export const GENERACIONES = ['boomer', 'x', 'y', 'z'] as const;
export type Generacion = (typeof GENERACIONES)[number];

export type PuntajesGeneracion = Record<Generacion, number>;

export const INFO_GENERACION: Record<
  Generacion,
  { nombre: string; corto: string }
> = {
  boomer: { nombre: 'Baby Boomer', corto: 'Boomer' },
  x: { nombre: 'Generación X', corto: 'X' },
  y: { nombre: 'Millennial', corto: 'Y' },
  z: { nombre: 'Centennial', corto: 'Z' },
};

export type PreguntaGeneracion = {
  pregunta: string;
  ayuda: string;
  opciones: { texto: string; generacion: Generacion }[];
};

const AYUDA = 'Elegí la opción que más se acerca a tu preferencia';

export const PLACAS_GENERACIONES: PreguntaGeneracion[] = [
  {
    pregunta: '¿Cómo preferís comunicarte?',
    ayuda: AYUDA,
    opciones: [
      {
        texto:
          'Medios tradicionales (correo electrónico, llamadas telefónicas). Aprecian la comunicación directa y clara en el entorno laboral.',
        generacion: 'x',
      },
      {
        texto:
          'A través de la tecnología o alguna plataforma digital con un enfoque más equilibrado, formal y textual. Uso habitual de Youtube, Twitter.',
        generacion: 'y',
      },
      {
        texto:
          'Cara a cara o por teléfono en lugar de la comunicación digital. Pueden valorar un feedback más formal y reservado.',
        generacion: 'boomer',
      },
      {
        texto:
          'De manera informal, directa y rápida usando comunicación rápida, visual y menos formal. Uso habitual de Tik Tok.',
        generacion: 'z',
      },
    ],
  },
  {
    pregunta: '¿Qué te motiva en el trabajo?',
    ayuda: AYUDA,
    opciones: [
      {
        texto:
          'La estabilidad, la lealtad, el poder compartir su conocimiento y habilidades a otras generaciones.',
        generacion: 'boomer',
      },
      { texto: 'El crecimiento profesional, el producir y superarse.', generacion: 'x' },
      {
        texto:
          'El equilibrio entre vida laboral y personal, la flexibilidad, oportunidades para innovar, un propósito más allá del salario.',
        generacion: 'y',
      },
      {
        texto:
          'Entornos laborales ágiles desde la metodología de trabajo, que sea digital y que se priorice su bienestar personal.',
        generacion: 'z',
      },
    ],
  },
  {
    pregunta: '¿Con qué estilo de trabajo te sentís más cómodo?',
    ayuda: AYUDA,
    opciones: [
      {
        texto:
          'Estructurado, jerárquico donde las reglas y procedimientos son claros y respetados.',
        generacion: 'boomer',
      },
      {
        texto:
          'Enfocado en resultados en el cual te permite tener el control sobre tus tareas y trabajar de manera independiente, con la capacidad de gestionar tu tiempo de manera efectiva.',
        generacion: 'x',
      },
      {
        texto:
          'En equipo en un entorno donde las ideas fluyen libremente y donde sienten que su trabajo tiene un propósito significativo que trasciende el simple cumplimiento de tareas.',
        generacion: 'y',
      },
      {
        texto:
          'Flexible tanto en términos de horario como de ubicación, con acceso a tecnología avanzada, y oportunidades de aprendizaje continuo.',
        generacion: 'z',
      },
    ],
  },
  {
    pregunta: '¿Cuál es tu estilo de aprendizaje preferente?',
    ayuda: AYUDA,
    opciones: [
      {
        texto:
          'Clases presenciales, seminarios, manuales y materiales impresos. Interacción directa con expertos y experiencia práctica.',
        generacion: 'boomer',
      },
      {
        texto:
          'Un equilibrio entre el aprendizaje autodirigido y la interacción guiada, como cursos online así como talleres interactivos y capacitación en el trabajo para poder aplicar lo aprendido de inmediato.',
        generacion: 'x',
      },
      {
        texto:
          'A través de vídeos, plataformas digitales, y aplicaciones móviles, con feedback rápido y continuo.',
        generacion: 'y',
      },
      {
        texto:
          'Videos cortos, tutoriales online, podcasts y aprendizaje móvil. Contenido que se puede consumir rápidamente y que esté disponible on-demand.',
        generacion: 'z',
      },
    ],
  },
];

export function cerosGeneracion(): PuntajesGeneracion {
  return { boomer: 0, x: 0, y: 0, z: 0 };
}

export type ResultadoGeneracion = {
  puntajes: PuntajesGeneracion;
  generaciones: Generacion[]; // más de una si empatan en el máximo
  etiqueta: string; // lo que se guarda en la columna `generacion`
};

/**
 * Puntúa el bloque. `elecciones[i]` es el índice de opción elegido en la
 * pregunta i, o null si quedó sin responder.
 */
export function calcularGeneracion(
  elecciones: (number | null)[]
): ResultadoGeneracion {
  const puntajes = cerosGeneracion();

  PLACAS_GENERACIONES.forEach((placa, i) => {
    const elegida = elecciones[i];
    if (elegida === null || elegida === undefined) return;
    const opcion = placa.opciones[elegida];
    if (opcion) puntajes[opcion.generacion] += 1;
  });

  const maximo = Math.max(...GENERACIONES.map((g) => puntajes[g]));
  const generaciones =
    maximo === 0 ? [] : GENERACIONES.filter((g) => puntajes[g] === maximo);

  return {
    puntajes,
    generaciones,
    etiqueta: generaciones.map((g) => INFO_GENERACION[g].corto).join('/'),
  };
}
