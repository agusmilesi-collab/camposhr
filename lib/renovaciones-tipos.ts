/**
 * Lo de la renovación que necesita un componente de cliente. Aparte de
 * `lib/renovaciones.ts`, que es `server-only`: un módulo de cliente no puede
 * importar de ahí ni una constante.
 */

/** Desde qué día del mes se pregunta por el mes siguiente. */
export const DIA_DE_RENOVAR = 25;

export type Respuesta = 'si' | 'no' | 'cambiar';

export type Renovacion = {
  id: string;
  inquilino_id: string;
  periodo: string;
  respuesta: Respuesta;
  nota: string | null;
  /** Los feriados de ese mes en los que igual quiere usar su sala. */
  feriados: string[];
  respondido_at: string;
};
