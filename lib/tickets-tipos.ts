/**
 * Los pedidos de cambio del OS (`public.tickets`, `supabase/tickets.sql`).
 *
 * Los tipos van aparte de la lectura porque la pantalla es un componente de
 * cliente: es la misma razón por la que existe `lib/pendientes-tipos.ts`.
 */

export const ESTADOS_TICKET = ['Nuevo', 'En curso', 'Bloqueado', 'Hecho', 'Descartado'] as const;

export type EstadoTicket = (typeof ESTADOS_TICKET)[number];

export const COLOR_TICKET: Record<EstadoTicket, string> = {
  Nuevo: 'os-azul',
  'En curso': 'os-ambar',
  Bloqueado: 'os-violeta',
  Hecho: 'os-verde',
  Descartado: 'os-gris',
};

/** Lo que está abierto va arriba; lo cerrado, abajo. */
export const ABIERTO: Record<EstadoTicket, boolean> = {
  Nuevo: true,
  'En curso': true,
  /** Sigue abierto: espera algo de afuera para avanzar. */
  Bloqueado: true,
  Hecho: false,
  Descartado: false,
};

export const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const;

export type Prioridad = (typeof PRIORIDADES)[number];

export const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  Alta: 'os-rojo',
  Media: 'os-ambar',
  Baja: 'os-gris',
};

/** Para ordenar: la alta primero. */
export const PESO_PRIORIDAD: Record<Prioridad, number> = { Alta: 3, Media: 2, Baja: 1 };

export const LARGO_TICKET = 2000;

export type Ticket = {
  numero: number;
  pide: string;
  texto: string;
  donde: string | null;
  prioridad: Prioridad;
  estado: EstadoTicket;
  /** Qué se hizo, en palabras de quien lo resolvió. */
  respuesta: string | null;
  created_at: string;
};
