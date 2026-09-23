import 'server-only';

/**
 * Lo que se lleva cada uno: el repaso de la charla, en su teléfono.
 *
 * Vive en el código y no en la base porque es el contenido de la charla, el
 * mismo que se proyecta en las placas del cierre: si los dos lugares no dicen
 * exactamente lo mismo, lo que se descarga deja de ser el repaso de lo que
 * acaba de pasar.
 *
 * Está escrito por ciclo. El de Pla tiene su propio material y no se mezcla.
 */

export type RepasoCharla = {
  /** Las herramientas del encuentro, las mismas que la placa del repaso. */
  temas: { titulo: string; bajada: string }[];
  /** El reconocimiento en sus tres pasos, con el ejemplo de la placa. */
  reconocimiento?: {
    pasos: { etapa: string; nombre: string; ejemplo: string }[];
    agradecimiento: string;
  };
  /** Las formas de no tener la conversación. */
  evitar?: { nombre: string; que: string }[];
  /** Lo que le llega a quien escucha una conversación difícil. */
  recibe?: { nombre: string; que: string }[];
  momentos: { numero: number; nombre: string; que: string }[];
  traducciones: { juicio: string; hecho: string }[];
};

export const REPASOS: Record<string, RepasoCharla> = {
  'Conversaciones difíciles': {
    temas: [
      {
        titulo: '1. Prepará la conversación',
        bajada: 'Decí la expectativa antes de reclamarla y anotá los hechos con día y número.',
      },
      {
        titulo: '2. Reconocé en 3 pasos',
        bajada: 'Cuándo fue, qué hizo, qué cambió. Si agradecés, agradecé lo que hizo.',
      },
      {
        titulo: '3. Pasá el juicio a hecho',
        bajada: 'Preguntate: ¿la otra persona lo puede verificar? Si no, no lo puede corregir.',
      },
      {
        titulo: '4. Seguí los 4 momentos',
        bajada:
          'Encuadre, decilo claro, sostené el silencio, cerrá con fecha. Sin postergar, suavizar ni apurar.',
      },
      {
        titulo: 'La importancia de compartir la experiencia en gestión',
        bajada:
          'Transmitir lo aprendido también es parte del rol de un líder con trayectoria. Y para el que empieza, es la oportunidad de nutrirse de quienes ya lo transitaron.',
      },
    ],
    reconocimiento: {
      pasos: [
        { etapa: 'Situación', nombre: 'Decí cuándo fue', ejemplo: 'En el informe del jueves…' },
        { etapa: 'Conducta', nombre: 'Decí qué hizo', ejemplo: '…sumaste una recomendación por tu cuenta.' },
        {
          etapa: 'Impacto',
          nombre: 'Decí qué cambió',
          ejemplo: 'Esa recomendación destrabó la decisión y pudimos cerrar el presupuesto a tiempo.',
        },
      ],
      agradecimiento:
        'Y al final, si querés, el agradecimiento: "Me gustó que la sumaras sin que nadie te la pidiera". La condición es que apunte a lo que hizo, no a quién es.',
    },
    evitar: [
      { nombre: 'Postergar', que: '"Hoy se lo digo." Pasan tres semanas y sigue haciendo lo mismo, porque nadie le avisó.' },
      { nombre: 'Suavizar', que: '"Habría que mejorar algunas cositas." Vos creés que se lo dijiste; la otra persona cree que está todo bien.' },
      { nombre: 'Apurar', que: 'Treinta segundos, en el pasillo. Te lo sacaste de encima, y la otra persona se quedó sola con eso.' },
    ],
    recibe: [
      { nombre: 'El hecho', que: 'Qué pasó: "entregó tres informes fuera de fecha".' },
      { nombre: 'La emoción', que: 'Lo que se siente al escucharlo.' },
      {
        nombre: 'La interpretación',
        que: 'Lo que la otra persona concluye sobre sí misma: "¿esto significa que no sirvo?".',
      },
    ],
    momentos: [
      {
        numero: 1,
        nombre: 'Encuadre',
        que: 'Elegí dónde y cuándo. Lugar privado, sin apuro, y un aviso corto antes: "necesito hablarte de algo importante".',
      },
      {
        numero: 2,
        nombre: 'Decilo claro',
        que: 'Decilo en dos frases: la decisión primero y el motivo enseguida. Repetí el motivo después del silencio, que es cuando lo escucha.',
      },
      {
        numero: 3,
        nombre: 'Sostené el silencio',
        que: 'No negocies ni discutas mientras reacciona. Cuando pare, repetí una vez lo ya dicho.',
      },
      {
        numero: 4,
        nombre: 'Cerrá con una fecha',
        que: 'Qué tiene que pasar y cuándo: "el lunes 24 a las 9:30 espero el reporte del último trimestre".',
      },
    ],
    traducciones: [
      {
        juicio: 'Es desprolijo',
        hecho: 'Dejó el puesto sin ordenar al terminar el turno, el martes y el jueves',
      },
      {
        juicio: 'No le importa el trabajo',
        hecho: 'Entregó los tres últimos informes después de la fecha',
      },
      { juicio: 'Siempre llega tarde', hecho: 'Llegó tarde el martes, el jueves y el viernes' },
      {
        juicio: 'Le falta mirada estratégica',
        hecho:
          'En la reunión del 12 revisó el precio de cada ítem y no definió si cambiábamos de proveedor',
      },
    ],
  },
};
