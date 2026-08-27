/**
 * En qué anda el Raven de una evaluación, y cómo se dice.
 *
 * Vive acá y no en `Raven.tsx` porque ese componente lleva `'use client'`, y un
 * módulo de servidor no puede leer una constante de un componente de cliente:
 * del lado del servidor eso no es el valor sino una referencia, y el build
 * falla con "Cannot access terminado.color on the server". Es la misma razón
 * por la que existen `lib/comercial-tipos.ts` y `lib/pendientes-tipos.ts` (ver
 * `CLAUDE.md`).
 *
 * Lo usan la hoja de la entrevista, que dibuja el sello al lado del nombre del
 * test, y el bloque del Raven, que mira si cambió mientras la persona responde.
 */

export type EstadoRaven = 'sin enlace' | 'sin abrir' | 'empezado' | 'terminado';

export const SELLO_RAVEN: Record<
  EstadoRaven,
  { texto: string; detalle: string; color: string }
> = {
  'sin enlace': {
    texto: 'Sin mandar',
    detalle: 'Todavía no se le generó el enlace.',
    color: 'os-gris',
  },
  'sin abrir': {
    texto: 'Sin abrir',
    detalle: 'Ya se le mandó el enlace y todavía no lo abrió.',
    color: 'os-ambar',
  },
  empezado: { texto: 'En curso', detalle: 'Lo está respondiendo.', color: 'os-ambar' },
  terminado: {
    texto: 'Terminado',
    detalle: 'Lo terminó y el puntaje está en la ficha.',
    color: 'os-verde',
  },
};
