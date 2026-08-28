/**
 * Las tres baterías que el cliente puede pedir, como se le muestran.
 *
 * Lo que ve en el portal sale de la tabla `baterias` de Supabase, que es la
 * misma que se edita en el OS (Sistema → Configuración → Baterías). Hasta el
 * 25/8/2026 esto era una copia fija con sus propios textos: corregir la
 * duración o para quién se recomienda había que hacerlo en dos lados, y solo
 * uno de los dos se podía tocar sin una entrega.
 *
 * El precio no viaja al portal a propósito: lo que el cliente elige es el
 * alcance de la evaluación, y el importe se acuerda por otro lado.
 */

export type BateriaDelPortal = {
  codigo: string;
  /** Qué incluye. */
  queIncluye: string;
  /** A qué puestos se recomienda. Una línea, que abajo de cada opción compite
   *  con el resto del cajón. */
  paraQuien: string;
  minutos: number | null;
  /**
   * Si esa batería incluye el análisis de potencial.
   *
   * Cuando lo incluye, el formulario del portal le pide al cliente el nivel de
   * trabajo del puesto: el informe compara a la persona contra ese nivel, y sin
   * él dice en qué estrato está la persona y deja la cuenta que importa sin
   * hacer.
   */
  conPotencial: boolean;
};

/**
 * Lo que se muestra si la base no contesta.
 *
 * Un formulario de pedido sin baterías no se puede completar, así que acá va
 * lo que había cargado el 25/8/2026. Queda viejo el día que alguien edite y
 * justo falle la lectura, que es preferible a un cajón vacío.
 */
export const RESPALDO: BateriaDelPortal[] = [
  {
    codigo: 'Batería 1',
    queIncluye:
      'Evaluación psicotécnica con test proyectivo abreviado (Zulliger) más tests cognitivos y de estilo de pensamiento.',
    paraQuien: 'Puestos operativos y mandos medios.',
    minutos: 135,
    conPotencial: false,
  },
  {
    codigo: 'Batería 2',
    queIncluye:
      'Evaluación psicotécnica con test proyectivo completo (Rorschach, Sistema Comprehensivo de Exner) más tests cognitivos y de estilo de pensamiento.',
    paraQuien: 'Perfiles profesionales y mandos medios calificados.',
    minutos: 180,
    conPotencial: false,
  },
  {
    codigo: 'Batería 3',
    queIncluye:
      'Todo lo de la estándar más análisis discursivo según el modelo de Elliot Jaques, sobre cinco minutos de discurso del candidato.',
    paraQuien: 'Jefaturas, gerencias y puestos de decisión.',
    minutos: 210,
    conPotencial: true,
  },
];

export const CODIGOS_BATERIA = RESPALDO.map((b) => b.codigo);
