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

/**
 * Un bloque de detalle debajo de un paso: la teoría de la charla que explica
 * ese paso, con las mismas palabras de la placa de donde sale.
 */
export type DetalleDelPaso = {
  titulo?: string;
  items: {
    nombre?: string;
    texto: string;
    /** Lo que se dice mal, tachado, antes del texto que lo corrige. */
    juicio?: string;
  }[];
  nota?: string;
};

export type PasoDelCamino = { titulo: string; texto: string; detalle?: DetalleDelPaso[] };

/** Una etapa del recorrido, en orden de tiempo. */
export type EtapaDelCamino = {
  nombre: string;
  detalle?: string;
  /** El color de la etapa, el mismo en todo el recorrido. */
  tono: 'anio' | 'antes' | 'conversacion' | 'despues';
  pasos: PasoDelCamino[];
  /** Una línea debajo de los pasos de la etapa. */
  nota?: string;
};

export type RepasoCharla = {
  /**
   * El camino de una conversación difícil: lo que se enseñó en la charla,
   * puesto en el orden en que se hace, con la teoría de cada paso debajo.
   * Cada texto sale de una placa, con las mismas palabras.
   */
  camino: EtapaDelCamino[];
  /** La quinta herramienta del repaso, que no es un paso de la conversación. */
  aparte?: { titulo: string; bajada: string };
};

export const REPASOS: Record<string, RepasoCharla> = {
  'Conversaciones difíciles': {
    camino: [
      {
        nombre: 'Durante el año',
        detalle: 'Lo que tiene que haber pasado antes',
        tono: 'anio',
        pasos: [
          // Placa 13 y repaso.
          { titulo: 'Decí la expectativa', texto: 'Que sepa qué se espera antes de que se lo reclames.' },
          {
            // Repaso y placa 5.
            titulo: 'Reconocé en 3 pasos',
            texto: 'Cuándo fue, qué hizo, qué cambió. Decilo en el momento.',
            detalle: [
              {
                // Placa 5.
                titulo: 'Situación, conducta, impacto',
                items: [
                  { nombre: 'Situación: decí cuándo fue', texto: '“En el informe del jueves…”' },
                  { nombre: 'Conducta: decí qué hizo', texto: '“…sumaste una recomendación por tu cuenta.”' },
                  {
                    nombre: 'Impacto: decí qué cambió',
                    texto: '“Esa recomendación destrabó la decisión y pudimos cerrar el presupuesto a tiempo.”',
                  },
                ],
              },
              {
                // Placa 6.
                titulo: 'El mismo reconocimiento, dicho de dos maneras',
                items: [
                  { nombre: 'Con juicio', texto: '“Sos un crack. Hiciste todo bien. Me salvaste las papas.”' },
                  {
                    nombre: 'Con hechos',
                    texto:
                      '“En el informe del jueves sumaste una recomendación por tu cuenta. Esa recomendación destrabó la decisión y pudimos cerrar el presupuesto a tiempo.”',
                  },
                ],
                nota: 'El que lo escucha sabe qué repetir.',
              },
              {
                // Placa 7.
                titulo: 'Un cierre opcional, y recomendado: el agradecimiento',
                items: [
                  { nombre: 'Agradece', texto: '“Gracias por sumarla.” Corto, y sobre lo que hizo.' },
                  {
                    nombre: 'Agradece y refuerza',
                    texto:
                      '“Me gustó que la sumaras sin que nadie te la pidiera.” Vuelve a marcar la iniciativa, que es lo que querés que repita.',
                  },
                  { nombre: 'Muestra que se vio', texto: '“Quiero que sepas que se notó.” Le confirma que alguien lo registró.' },
                ],
                nota: 'La condición es que el agradecimiento apunte a lo que hizo, no a quién es.',
              },
            ],
          },
          // Placa 13.
          { titulo: 'Anotá los hechos', texto: 'Que tengas el día y el número cuando llegue la conversación.' },
        ],
        // Placa 14.
        nota: 'El GPM se apoya en las conversaciones de desarrollo del año.',
      },
      {
        nombre: 'Antes de hablar',
        tono: 'antes',
        pasos: [
          {
            // Repaso.
            titulo: 'Pasá el juicio a hecho',
            texto: 'Preguntate: ¿la otra persona lo puede verificar? Si no, no lo puede corregir.',
            detalle: [
              {
                // Placa 11.
                titulo: 'Si no lo puede verificar, no lo puede corregir',
                items: [
                  {
                    nombre: 'Un hecho abre una conversación',
                    texto: '“Llegaste tarde el martes, el jueves y el viernes.” Puede ir a mirar el reloj, y entonces puede corregirlo.',
                  },
                  {
                    nombre: 'Una interpretación abre una discusión',
                    texto: '“No te importa nada.” No hay dónde ir a mirarlo, así que lo único que puede hacer es defenderse.',
                  },
                ],
              },
              {
                // Placa 16.
                titulo: 'De adjetivo a hecho',
                items: [
                  { juicio: 'Es desprolijo', texto: 'Dejó el puesto sin ordenar al terminar el turno, el martes y el jueves.' },
                  { juicio: 'No le importa el trabajo', texto: 'Entregó los tres últimos informes después de la fecha.' },
                  { juicio: 'Siempre llega tarde', texto: 'Llegó tarde el martes, el jueves y el viernes.' },
                  {
                    juicio: 'Le falta mirada estratégica',
                    texto: 'En la reunión del 12 revisó el precio de cada ítem y no definió si cambiábamos de proveedor.',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        nombre: 'En la conversación',
        detalle: 'Los cuatro momentos',
        tono: 'conversacion',
        // Placa 18, los cuatro momentos con sus nombres. Debajo de los tres
        // primeros, la forma de no tener la conversación que cada uno evita
        // (placa 10): el guion las presenta como lo contrario de los momentos.
        pasos: [
          {
            titulo: 'Encuadre',
            texto: 'Elegí dónde y cuándo. Lugar privado, sin apuro, y un aviso corto antes.',
            detalle: [
              {
                titulo: 'Lo que evita',
                items: [{ nombre: 'Postergar', texto: '“Hoy se lo digo.” Pasan tres semanas y sigue haciendo lo mismo, porque nadie le avisó.' }],
              },
            ],
          },
          {
            titulo: 'Decilo claro',
            texto: 'Decilo en dos frases. La decisión primero y el motivo enseguida.',
            detalle: [
              {
                titulo: 'Lo que evita',
                items: [
                  {
                    nombre: 'Suavizar',
                    texto: '“Habría que mejorar algunas cositas.” Vos creés que se lo dijiste; la otra persona cree que está todo bien.',
                  },
                ],
              },
            ],
          },
          {
            titulo: 'Sostené el silencio',
            texto: 'No negocies ni discutas aunque llore o levante la voz. Cuando pare, repetí una vez lo ya dicho.',
            detalle: [
              {
                titulo: 'Lo que evita',
                items: [
                  {
                    nombre: 'Apurar',
                    texto: 'Treinta segundos, en el pasillo. Te lo sacaste de encima, y la otra persona se quedó sola con eso.',
                  },
                ],
              },
              {
                // Placa 12.
                titulo: 'Las 3 capas de una conversación difícil',
                items: [
                  { nombre: 'El hecho', texto: 'Qué pasó: “entregó tres informes fuera de fecha”.' },
                  { nombre: 'La emoción de la otra persona', texto: 'Lo que se siente al escucharlo: enojo, vergüenza, miedo.' },
                  {
                    nombre: 'La interpretación de la otra persona',
                    texto: 'Lo que la otra persona concluye sobre sí misma: “¿esto significa que no sirvo?”.',
                  },
                ],
                nota: 'El hecho dispara las otras dos.',
              },
            ],
          },
          { titulo: 'Cerrá con una fecha', texto: 'Qué tiene que pasar y cuándo.' },
        ],
      },
      {
        nombre: 'Después',
        tono: 'despues',
        // No está en ninguna placa: cierra el recorrido.
        pasos: [
          {
            titulo: 'Volvé en esa fecha',
            texto: 'Mirá si pasó lo acordado y anotalo: es el hecho de la próxima conversación.',
          },
        ],
      },
    ],
    aparte: {
      titulo: 'La importancia de compartir la experiencia en gestión',
      bajada:
        'Transmitir lo aprendido también es parte del rol de un líder con trayectoria. Y para el que empieza, es la oportunidad de nutrirse de quienes ya lo transitaron.',
    },
  },
};
