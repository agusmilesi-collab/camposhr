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
  conceptos: { titulo: string; bajada: string }[];
  momentos: { numero: number; nombre: string; que: string }[];
  traducciones: { juicio: string; hecho: string }[];
};

export const REPASOS: Record<string, RepasoCharla> = {
  'Conversaciones difíciles': {
    conceptos: [
      {
        titulo: 'Cuanto más arriba estás, menos te dicen',
        bajada:
          'Sos el que menos devoluciones recibe de toda la sala y el que más decisiones toma con información que nadie chequeó.',
      },
      {
        titulo: 'Si no lo puede verificar, no lo puede corregir',
        bajada:
          '"Llegaste tarde el martes, el jueves y el viernes" abre una conversación. "No te importa nada" abre una pelea.',
      },
      {
        titulo: 'La corrección de septiembre se apoya en el reconocimiento de marzo',
        bajada:
          'El reconocimiento mejora el desempeño de forma confiable. La corrección funciona solo si hubo confianza antes.',
      },
    ],
    momentos: [
      {
        numero: 1,
        nombre: 'Lo que sabés y no decís',
        que: 'Anotar los hechos cuando pasan y decir lo bueno cuando pasa, en las conversaciones de desarrollo. Sin esto, los otros cuatro no funcionan.',
      },
      {
        numero: 2,
        nombre: 'Encuadrá',
        que: 'Lugar privado, sin apuro, y un aviso corto antes de empezar.',
      },
      {
        numero: 3,
        nombre: 'Decilo claro',
        que: 'El motivo y la decisión juntos, en las primeras dos frases, con hechos verificables.',
      },
      {
        numero: 4,
        nombre: 'Sostené el silencio',
        que: 'Mientras descarga, aunque llore o levante la voz. Cuando pare, repetir una vez lo ya dicho.',
      },
      {
        numero: 5,
        nombre: 'Cerrá con una fecha',
        que: 'Qué pasa ahora, con día y hora.',
      },
    ],
    traducciones: [
      { juicio: 'Es desprolijo', hecho: 'Dejó el tablero sin cerrar el martes y el jueves' },
      {
        juicio: 'No le importa el trabajo',
        hecho: 'Entregó los tres últimos informes después de la fecha',
      },
      { juicio: 'Siempre llega tarde', hecho: 'Llegó tarde el martes, el jueves y el viernes' },
      {
        juicio: 'Le falta mirada estratégica',
        hecho:
          'En la reunión del 12, cuando salió lo del proveedor, te metiste en las cláusulas y el equipo esperaba que definieras si seguíamos',
      },
    ],
  },
};
