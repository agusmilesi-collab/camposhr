/**
 * Las opciones de cada campo del pedido, como están en Airtable.
 *
 * Copiadas del esquema de la tabla `Pedidos` (tblA3o1XsDXyJXSgF, base
 * Psicotécnicos). Si allá se agrega una opción, se agrega acá: la base guarda
 * texto libre justamente para no pedir un DDL por cada cambio de lista.
 *
 * Las nueve preguntas de puesto y jefe describen contra qué se mide a la
 * persona. No son datos administrativos: son lo que separa un informe del
 * puesto de un informe genérico, y por eso viven en el pedido y no en cada
 * evaluación.
 */

export const ESTADOS_PEDIDO = ['En curso', 'Finalizado', 'Cancelado'] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

/** El único estado en el que un pedido admite candidatos nuevos. */
export const ABIERTO: EstadoPedido = 'En curso';

/**
 * El estado de un pedido entregado entero.
 *
 * No lo pone nadie a mano: la base lo mantiene sola con lo que pasa en sus
 * evaluaciones (`pedido_estado_al_dia`). Cerrado es tener al menos un candidato
 * y todos entregados; entrar uno nuevo lo devuelve a `ABIERTO` y le deja la
 * fecha de la reapertura en `reabierto_el`.
 */
export const CERRADO: EstadoPedido = 'Finalizado';

export const FAMILIAS = [
  'Comercial / Ventas',
  'Administración / Contable / Finanzas',
  'Operaciones / Producción / Logística',
  'IT / Sistemas / Tecnología',
  'RRHH / Capital Humano',
  'Marketing / Comunicación',
  'Ingeniería / Técnica',
  'Dirección / Gerencia',
];

export const SENIORITY = ['Junior', 'Semi Senior', 'Senior', 'Jefatura', 'Dirección'];

/**
 * Una pregunta del pedido: la columna, cómo se lee y qué se puede contestar.
 *
 * `ayudas` va en el mismo orden que `opciones` y dice qué significa cada una.
 * Quien contesta desde el portal no trabaja acá: "problemas mixtos" o "equipo
 * reducido" se entienden distinto en cada empresa, y una escala que cada
 * cliente interpreta a su modo no sirve para comparar dos pedidos.
 *
 * Las tres opciones de cada pregunta son una escala: se excluyen entre sí y
 * cubren todos los casos. Cuando no lo hacían se corrigieron (28/8/2026):
 * "pocas personas" y "equipo reducido" eran lo mismo dicho de dos maneras, y
 * entre "una vez al día" y "una vez por semana o menos" quedaba afuera quien ve
 * a su jefe tres veces por semana.
 */
export type Pregunta = {
  campo: string;
  rotulo: string;
  opciones: string[];
  ayudas: string[];
};

export const DEL_PUESTO: Pregunta[] = [
  {
    campo: 'puesto_problemas',
    rotulo: 'Tipo de problemas',
    opciones: ['Tareas claras', 'Problemas mixtos', 'Problemas complejos'],
    ayudas: [
      'Se sabe qué hay que hacer y cómo hacerlo.',
      'Parte está pautada y parte hay que resolverla.',
      'Cada caso es distinto y hay que definir cómo encararlo.',
    ],
  },
  {
    campo: 'puesto_presion',
    rotulo: 'Presión',
    opciones: ['Rara vez', 'Algunas veces', 'Todos los días'],
    ayudas: [
      'Los plazos se cumplen sin apuro.',
      'Hay picos y después se acomoda.',
      'Se trabaja siempre contra el reloj.',
    ],
  },
  {
    campo: 'puesto_interaccion',
    rotulo: 'Interacción',
    opciones: ['Solo o casi solo', 'Un equipo fijo', 'Mucha gente distinta'],
    ayudas: [
      'El trabajo se hace sin depender de otros.',
      'Siempre con las mismas personas.',
      'Otras áreas, clientes o proveedores, y van cambiando.',
    ],
  },
  {
    campo: 'puesto_estabilidad',
    rotulo: 'Estabilidad',
    opciones: ['Muy estable', 'Cambios moderados', 'Cambia todo el tiempo'],
    ayudas: [
      'Las prioridades duran meses.',
      'Se reordena cada tanto.',
      'Lo de hoy puede no valer la semana que viene.',
    ],
  },
  {
    campo: 'puesto_contacto_jefe',
    rotulo: 'Contacto con el jefe',
    opciones: ['Varias veces al día', 'Casi todos los días', 'Una o dos veces por semana'],
    ayudas: [
      'Le consulta sobre la marcha.',
      'Se ven o hablan casi a diario.',
      'Se maneja solo y reporta cada tanto.',
    ],
  },
  {
    campo: 'puesto_innovacion',
    rotulo: 'Espacio para innovar',
    opciones: ['Poco o nada', 'Algo de espacio', 'Mucho espacio'],
    ayudas: [
      'Hay un procedimiento y se sigue.',
      'Se puede proponer dentro de lo pautado.',
      'Se espera que traiga ideas nuevas.',
    ],
  },
];

export const DEL_JEFE: Pregunta[] = [
  {
    campo: 'jefe_estilo',
    rotulo: 'Estilo de liderazgo',
    opciones: ['Cercano', 'Equilibrado', 'Delegador'],
    ayudas: [
      'Acompaña de cerca y marca el camino.',
      'Da margen y sigue de cerca lo importante.',
      'Da el objetivo y deja hacer.',
    ],
  },
  {
    campo: 'jefe_paciencia',
    rotulo: 'Paciencia para el arranque',
    opciones: ['Mucha', 'Algo', 'Poca'],
    ayudas: [
      'Hay tiempo para aprender el puesto.',
      'Se espera que rinda en unos meses.',
      'Tiene que rendir desde el primer día.',
    ],
  },
  {
    campo: 'jefe_emociones',
    rotulo: 'Comodidad con emociones',
    opciones: ['Muy cómodo', 'Más o menos', 'Poco cómodo'],
    ayudas: [
      'Habla de cómo está la gente sin problema.',
      'Lo hace cuando hace falta.',
      'Prefiere quedarse en los hechos.',
    ],
  },
];

/** Todas las columnas de texto que se pueden editar en la ficha del pedido. */
export const CAMPOS_PEDIDO = [
  'puesto',
  'familia',
  'seniority',
  'estado',
  'fecha_pedido',
  'notas',
  'contexto',
  ...DEL_PUESTO.map((p) => p.campo),
  ...DEL_JEFE.map((p) => p.campo),
];
