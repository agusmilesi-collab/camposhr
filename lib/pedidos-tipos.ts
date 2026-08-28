/**
 * El pedido y las cuentas que se hacen sobre él, sin nada del servidor adentro.
 *
 * Vive aparte de `lib/pedidos.ts` porque ese lee Supabase y lleva
 * `server-only`: la ficha del cliente dibuja las búsquedas del lado del
 * navegador y necesita el tipo y las dos cuentas. La misma separación que hay
 * entre `facturas-tipos` y `facturas`.
 */

import { DEL_JEFE, DEL_PUESTO } from '@/lib/pedido-campos';

export type Pedido = {
  id: string;
  puesto: string;
  empresa: string;
  empresaId: string;
  bateria: string | null;
  bateriaId: string | null;
  conBenziger: boolean;
  /** Con qué exigencia se leen los informes de este pedido. Null es la default. */
  exigenciaId: string | null;
  familia: string | null;
  seniority: string | null;
  estado: string;
  /**
   * Cuándo se pidió lo que está en curso.
   *
   * Si el pedido se reabrió, es la fecha de la reapertura: la solicitud abierta
   * es la nueva, y contarla desde el día en que se pidió la primera tanda diría
   * que lleva meses esperando.
   */
  fechaPedido: string | null;
  /** Cuándo se reabrió, si se reabrió. */
  reabierto: string | null;
  /** El día en que se pidió por primera vez, aunque se haya reabierto. */
  fechaOriginal: string | null;
  notas: string | null;
  contexto: string | null;
  /** Cuántas evaluaciones cuelgan del pedido y cuántas ya se entregaron. */
  candidatos: number;
  entregados: number;
  /** Quiénes son, para poder saltar a su ficha desde el pedido. */
  gente: { id: string; nombre: string; estado: string }[];
  puesto_problemas: string | null;
  puesto_presion: string | null;
  puesto_interaccion: string | null;
  puesto_estabilidad: string | null;
  puesto_contacto_jefe: string | null;
  puesto_innovacion: string | null;
  jefe_estilo: string | null;
  jefe_paciencia: string | null;
  jefe_emociones: string | null;
  /**
   * El nivel de trabajo del puesto, por los dos caminos del modelo de Jaques.
   *
   * El time-span es el tiempo máximo de finalización de la tarea más larga que
   * el puesto lleva hasta el final, y `complejidad` son las respuestas a las
   * cinco preguntas. `estratoPuesto` es el que rige: sale de los dos y solo se
   * elige a mano cuando discrepan.
   */
  timeSpanDias: number | null;
  complejidad: Record<string, boolean> | null;
  estratoPuesto: number | null;
};

/**
 * Cuántas de las nueve preguntas de puesto y jefe están contestadas.
 *
 * Son las que describen contra qué se mide a la persona, y sin ellas el informe
 * sale genérico. Se contestan con el cliente por teléfono, casi nunca el mismo
 * día que entra el pedido, así que quedan a medias sin que nadie se entere:
 * había que abrir los pedidos de a uno para descubrir a cuál le faltaba.
 */
export function perfilContestado(p: Pedido): { hechas: number; total: number } {
  const campos = [...DEL_PUESTO, ...DEL_JEFE].map((q) => q.campo);
  const fila = p as unknown as Record<string, string | null>;
  return {
    hechas: campos.filter((c) => fila[c]).length,
    total: campos.length,
  };
}

/**
 * Qué le falta al pedido para poder trabajarlo, en orden de urgencia.
 *
 * Sin batería no se puede cotizar ni saber qué se le administra; sin nivel el
 * baremo del Raven no tiene contra qué comparar. El perfil va último porque se
 * completa con el cliente y admite esperar unos días.
 */
export function loQueFalta(p: Pedido): string[] {
  const falta: string[] = [];
  if (!p.bateriaId) falta.push('batería');
  if (!p.seniority) falta.push('nivel');
  const perfil = perfilContestado(p);
  if (perfil.hechas === 0) falta.push('el perfil del puesto');
  else if (perfil.hechas < perfil.total) falta.push(`${perfil.total - perfil.hechas} del perfil`);
  return falta;
}
