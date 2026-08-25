import 'server-only';
import { select } from '@/lib/supabase';
import { ABIERTO } from '@/lib/pedido-campos';

/**
 * Cuándo un pedido ya no espera nada.
 *
 * Un pedido se cierra cuando se entregaron los informes de todos sus
 * candidatos: eso es lo que significa que la búsqueda terminó. Hasta ahora
 * había que acordarse de cerrarlo a mano, y un pedido que queda abierto para
 * siempre ensucia el selector de la tarjeta de alta, que termina ofreciendo
 * búsquedas terminadas hace meses.
 *
 * **Y se reabre solo si vuelve a haber trabajo.** Si se le suma un candidato o
 * una evaluación entregada vuelve atrás, el pedido está otra vez en curso: un
 * pedido cerrado no admite candidatos nuevos, así que dejarlo cerrado con
 * trabajo adentro esconde ese trabajo.
 *
 * Un pedido sin candidatos no se cierra: no hay nada entregado, está esperando
 * al primero.
 */

type Fila = {
  id: string;
  estado: string;
  evaluaciones: { estado: string | null }[];
};

/** Las etapas en las que el informe ya salió. */
const ENTREGADAS = new Set(['Entregado', 'Seguimiento']);

/**
 * Ajusta el estado del pedido de esa evaluación, si hace falta.
 *
 * Se llama después de cualquier cambio que pueda entregar o desentregar una
 * evaluación. Devuelve el estado nuevo cuando lo cambió, y null cuando lo dejó
 * como estaba.
 */
export async function ajustarPedidoDe(evaluacionId: string): Promise<string | null> {
  try {
    return await revisar(evaluacionId);
  } catch (e) {
    // Nunca tumba lo que se estaba guardando: esto es un paso de más, y que
    // falle no puede hacer perder el cambio que la evaluadora acaba de hacer.
    console.error('pedido completo:', e);
    return null;
  }
}

async function revisar(evaluacionId: string): Promise<string | null> {
  const cuales = await select<{ pedido_id: string | null }>(
    'evaluaciones',
    `select=pedido_id&id=eq.${evaluacionId}&limit=1`
  );
  const pedidoId = cuales[0]?.pedido_id;
  if (!pedidoId) return null;

  const filas = await select<Fila>(
    'pedidos',
    `select=id,estado,evaluaciones(estado)&id=eq.${pedidoId}&limit=1`
  );
  const p = filas[0];
  if (!p) return null;
  // Cancelado es una decisión, no un estado que se deduzca del trabajo: si
  // alguien lo canceló, que se entregue un informe no lo revive.
  if (p.estado !== ABIERTO && p.estado !== 'Finalizado') return null;

  const evaluaciones = p.evaluaciones ?? [];
  const terminado =
    evaluaciones.length > 0 && evaluaciones.every((e) => e.estado && ENTREGADAS.has(e.estado));
  const debeSer = terminado ? 'Finalizado' : ABIERTO;
  if (p.estado === debeSer) return null;

  await escribirEstado(pedidoId, debeSer);
  return debeSer;
}

async function escribirEstado(pedidoId: string, estado: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/pedidos?id=eq.${pedidoId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ estado }),
    cache: 'no-store',
  });
}
