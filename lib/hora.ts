/**
 * Fechas y horas en la zona del trabajo, no en la del servidor.
 *
 * Vercel corre en UTC y el navegador de quien mira corre en Argentina. Sin
 * fijar la zona, la misma entrevista sale con dos horas distintas según dónde
 * se pinte, y encima el servidor y el cliente no coinciden al hidratar.
 *
 * La zona es la que ya usa el campo "Fecha entrevista" de Airtable, así que
 * las dos pantallas dicen lo mismo. Argentina no cambia la hora en verano, por
 * eso el desfase fijo de tres horas alcanza para armar el valor que se guarda.
 */

export const ZONA = 'America/Argentina/Cordoba';
const DESFASE = '-03:00';

/** "18/08, 09:55" para una fecha con hora; "18/08" para una sin hora. */
export function fechaHora(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const conHora = iso.includes('T');
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    ...(conHora ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(d);
}

/** "18/08/2026", sin hora. */
export function fecha(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/** Las partes de una fecha en la zona del trabajo. */
function partes(d: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return Object.fromEntries(
    fmt.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
}

/** El valor que espera un input datetime-local, en hora de Argentina. */
export function paraInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = partes(d);
  const hora = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hora}:${p.minute}`;
}

/** Lo que escribió la persona en el input, leído como hora de Argentina. */
export function desdeInput(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}:00${DESFASE}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Cuántos días pasaron desde una fecha, con o sin hora.
 *
 * Los dos formatos conviven en Airtable: "Fecha entrevista" trae hora y
 * "Fecha de ingreso" no. Una fecha sin hora se lee a mediodía de Argentina y
 * no a medianoche UTC, que caería el día anterior y correría la cuenta uno.
 */
export function diasDesde(iso: string | null, hoy: Date = new Date()): number | null {
  if (!iso) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T12:00:00${DESFASE}`)
    : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((hoy.getTime() - d.getTime()) / 86_400_000);
}

/** "1 día", "6 días". */
export function enDias(n: number | null): string {
  if (n === null) return '—';
  const x = Math.abs(n);
  return `${x} ${x === 1 ? 'día' : 'días'}`;
}

/**
 * La distancia en palabras: "hace 6 días", "hoy", "en 2 días".
 *
 * Los negativos son lo que todavía no pasó, que en este pipeline son las
 * entrevistas agendadas para adelante.
 */
export function haceCuanto(n: number | null): string {
  if (n === null) return '—';
  if (n === 0) return 'hoy';
  if (n < 0) return n === -1 ? 'mañana' : `en ${enDias(n)}`;
  return `hace ${enDias(n)}`;
}

/**
 * Qué día de la semana cae una fecha: "martes".
 *
 * Va debajo de la fecha en la agenda. Al mirar lo que viene, lo primero que se
 * busca es el día, no el número.
 */
export function diaDeLaSemana(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, weekday: 'long' }).format(d);
}
