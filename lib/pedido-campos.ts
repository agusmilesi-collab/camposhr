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

/** Una pregunta del pedido: la columna, cómo se lee y qué se puede contestar. */
export type Pregunta = { campo: string; rotulo: string; opciones: string[] };

export const DEL_PUESTO: Pregunta[] = [
  {
    campo: 'puesto_problemas',
    rotulo: 'Tipo de problemas',
    opciones: ['Tareas claras', 'Problemas mixtos', 'Problemas complejos'],
  },
  {
    campo: 'puesto_presion',
    rotulo: 'Presión',
    opciones: ['Rara vez', 'Algunas veces', 'Todos los días'],
  },
  {
    campo: 'puesto_interaccion',
    rotulo: 'Interacción',
    opciones: ['Pocas personas', 'Equipo reducido', 'Muchas personas'],
  },
  {
    campo: 'puesto_estabilidad',
    rotulo: 'Estabilidad',
    opciones: ['Muy estable', 'Cambios moderados', 'Cambia todo el tiempo'],
  },
  {
    campo: 'puesto_contacto_jefe',
    rotulo: 'Contacto con el jefe',
    opciones: ['Varias veces al día', 'Una vez al día', 'Una vez por semana o menos'],
  },
  {
    campo: 'puesto_innovacion',
    rotulo: 'Espacio para innovar',
    opciones: ['Poco o nada', 'Algo de espacio', 'Mucho espacio'],
  },
];

export const DEL_JEFE: Pregunta[] = [
  {
    campo: 'jefe_estilo',
    rotulo: 'Estilo de liderazgo',
    opciones: ['Cercano', 'Equilibrado', 'Delegador'],
  },
  {
    campo: 'jefe_paciencia',
    rotulo: 'Paciencia para el arranque',
    opciones: ['Mucha', 'Algo', 'Poca'],
  },
  {
    campo: 'jefe_emociones',
    rotulo: 'Comodidad con emociones',
    opciones: ['Muy cómodo', 'Más o menos', 'Poco cómodo'],
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
