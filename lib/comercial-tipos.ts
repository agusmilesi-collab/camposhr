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
 * había forma de sumar cuánto se cotizó de cada cosa. Qué se acordó en cada una
 * va en la descripción.
 */
export const SERVICIOS = [
  'Psicotécnicos',
  'Diseño organizacional',
  'Liderazgo',
  'Mindfulness',
] as const;
export type Servicio = (typeof SERVICIOS)[number];

/**
 * El color de cada servicio, para reconocerlo sin leerlo.
 *
 * Cuatro tonos que no se confunden de reojo, como los de las baterías. El rojo
 * queda afuera: en este tablero es el color de lo que se perdió.
 */
export const COLOR_SERVICIO: Record<string, string> = {
  'Psicotécnicos': 'os-azul',
  'Diseño organizacional': 'os-violeta',
  Liderazgo: 'os-verde',
  Mindfulness: 'os-ambar',
};
export type Estado = (typeof ESTADOS)[number];

/** Las que todavía se pueden ganar. */
export const ABIERTOS: readonly Estado[] = ['Lead', 'Enviada'];

/**
 * El precio, escrito como se escribe un precio.
 *
 * El campo era `type="number"` con `step` de mil, así que el navegador rechazaba
 * "525.000" (los puntos de miles) y también cualquier importe que no fuera
 * múltiplo de mil: el formulario no se enviaba y el botón parecía no hacer nada.
 * Acá se acepta lo que alguien escribe y se lo lee: puntos de miles, coma
 * decimal, un signo de peso adelante.
 *
 * Devuelve null cuando no hay un número adentro, que es lo que el formulario
 * muestra como error en vez de mandar un NaN.
 */
export function precioDeTexto(escrito: string): number | null {
  const limpio = String(escrito ?? '')
    .replace(/[^\d.,-]/g, '')
    .trim();
  if (!limpio) return null;

  let normal = limpio;
  if (limpio.includes(',')) {
    // Con coma, la coma es el decimal y los puntos son de miles.
    normal = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    const puntos = limpio.split('.');
    // Un solo punto con tres dígitos detrás es de miles ("525.000"); con uno o
    // dos, es decimal ("1.5"). Con varios puntos, todos son de miles.
    const deMiles = puntos.length > 2 || (puntos.length === 2 && puntos[1].length === 3);
    normal = deMiles ? puntos.join('') : limpio;
  }

  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

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
