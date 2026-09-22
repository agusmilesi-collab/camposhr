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
  /** Los seis temas del encuentro, los mismos que la placa del repaso. */
  temas: { titulo: string; bajada: string }[];
  momentos: { numero: number; nombre: string; que: string }[];
  traducciones: { juicio: string; hecho: string }[];
};

export const REPASOS: Record<string, RepasoCharla> = {
  'Conversaciones difíciles': {
    temas: [
      {
        titulo: 'A vos tampoco te dicen cómo vas',
        bajada:
          '¿Cómo sabés si vas bien? Es la misma pregunta que se hace alguien de tu equipo, y vos la podrías contestar.',
      },
      {
        titulo: 'Solo el hecho se puede corregir',
        bajada:
          '"Llegaste tarde el martes, el jueves y el viernes" se puede ir a mirar. "No te importa nada" no, y por eso abre una pelea.',
      },
      {
        titulo: 'Lo bueno se dice con el hecho',
        bajada:
          'Qué hizo, cuándo lo hizo y el valor que entregó con eso. Cuando pasa, sin esperar al GPM.',
      },
      {
        titulo: 'La conversación se prepara todo el año',
        bajada:
          'Decir la expectativa antes de reclamarla, y anotar los hechos para llegar con el día y el número.',
      },
      {
        titulo: 'La conversación difícil tiene cuatro momentos',
        bajada:
          'Elegí dónde y cuándo, decilo en dos frases, sostené el silencio, cerrá con una fecha.',
      },
      {
        titulo: 'Lo que aprendió uno le sirve al que empieza',
        bajada:
          'Pasa si alguien lo pregunta y alguien lo contesta. Hoy pasó acá, y puede volver a pasar mañana.',
      },
    ],
    momentos: [
      {
        numero: 1,
        nombre: 'Elegí dónde y cuándo',
        que: 'Lugar privado, sin apuro, y un aviso corto antes de empezar.',
      },
      {
        numero: 2,
        nombre: 'Decilo en dos frases',
        que: 'La decisión primero y el motivo enseguida, con hechos. El motivo se repite después del silencio, que es cuando lo escucha.',
      },
      {
        numero: 3,
        nombre: 'Sostené el silencio',
        que: 'No negocies ni discutas mientras reacciona. Cuando pare, repetí una vez lo ya dicho.',
      },
      {
        numero: 4,
        nombre: 'Cerrá con una fecha',
        que: 'Qué tiene que pasar y cuándo, con día y hora.',
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
