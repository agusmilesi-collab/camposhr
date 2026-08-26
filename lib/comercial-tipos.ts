/**
 * Las constantes y los tipos de comercial, sin nada del servidor adentro.
 *
 * Vive aparte de `lib/cotizaciones.ts` porque ese lee Supabase y lleva
 * `server-only`: un componente de cliente que importe de ahí no compila. Los
 * cuatro estados y los tipos de costo los necesitan las dos mitades.
 */

export const ESTADOS = ['Lead', 'Enviada', 'Aprobada', 'Perdida'] as const;

/**
 * Lo que se vende, para que el embudo se pueda leer por servicio.
 *
 * Escrito a mano, cada oportunidad nombraba lo mismo de cuatro maneras y no
 * había forma de sumar cuánto se cotizó de cada cosa. El detalle de la
 * propuesta va en la nota.
 */
export const SERVICIOS = ['Psicotécnicos', 'Mapeos', 'Liderazgo', 'Mindfulness'] as const;
export type Servicio = (typeof SERVICIOS)[number];
export type Estado = (typeof ESTADOS)[number];

/** Las que todavía se pueden ganar. */
export const ABIERTOS: readonly Estado[] = ['Lead', 'Enviada'];

/**
 * Por qué no avanzó una oportunidad.
 *
 * El motivo se escribía a mano y cada perdida decía lo suyo, así que revisar el
 * mes no dejaba ver qué se repite. Son cinco y son excluyentes: lo que le faltó
 * al otro para avanzar. El detalle del caso va aparte, en el texto libre.
 */
export const OBJECIONES = [
  { nombre: 'Valor', que: 'No percibe suficiente beneficio por el precio.' },
  { nombre: 'Ajuste', que: 'La solución no encaja con su necesidad.' },
  { nombre: 'Timing', que: 'No es el momento adecuado para avanzar.' },
  { nombre: 'Riesgo', que: 'Tiene dudas o falta de confianza.' },
  { nombre: 'Capacidad', que: 'No puede concretar la compra ahora.' },
] as const;

export type Objecion = (typeof OBJECIONES)[number]['nombre'];

export const esObjecion = (x: unknown): x is Objecion =>
  OBJECIONES.some((o) => o.nombre === x);

export const TIPOS_COSTO = ['Directo', 'Honorarios', 'Terceros', 'Otro'] as const;
export type TipoCosto = (typeof TIPOS_COSTO)[number];

/** El resultado de una oportunidad: qué entró, qué costó y qué quedó. */
export type Resultado = {
  ingreso: number;
  costo: number;
  resultado: number;
  /** Porcentaje del ingreso que queda. Nulo cuando no hay ingreso. */
  margen: number | null;
};

export function resultadoDe(ingreso: number, costo: number): Resultado {
  const resultado = ingreso - costo;
  return {
    ingreso,
    costo,
    resultado,
    margen: ingreso > 0 ? (resultado / ingreso) * 100 : null,
  };
}

/** Importe en pesos, sin decimales: 8800000 -> "ARS 8.800.000". */
export function formatoImporte(n: number, moneda = 'ARS'): string {
  return `${moneda} ${Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

/** "18/08/2026" a partir de "2026-08-18". */
export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
}
