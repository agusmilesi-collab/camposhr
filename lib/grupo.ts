/**
 * Empresas del mismo dueño que piden por una sola puerta.
 *
 * Macro Agro pide candidatos para tres CUIT (el propio, JHB y Campo Simple):
 * las mismas personas cargan los pedidos de las tres, y cada una factura lo
 * suyo. Cada CUIT es una empresa, y `empresas.grupo_id` dice a cuál pertenece;
 * la que encabeza el grupo lo lleva en null.
 *
 * **Lo que se comparte son las personas que piden.** Están cargadas una vez, en
 * la empresa que encabeza, y valen para todas. Lo que no se comparte es lo de
 * la plata: el responsable de compras, la orden de compra y la factura son de
 * la empresa del pedido.
 */

import 'server-only';
import { select } from '@/lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Las empresas del grupo de esta, con ella primera. Una empresa suelta
 * devuelve solo su identificador.
 *
 * Si la lectura falla devuelve la empresa sola: es preferible no ver a las
 * personas del grupo que no poder cargar un pedido.
 */
export async function empresasDelGrupo(empresaId: string): Promise<string[]> {
  if (!UUID.test(empresaId)) return [empresaId];
  try {
    const [ella] = await select<{ grupo_id: string | null }>(
      'empresas',
      `select=grupo_id&id=eq.${empresaId}&limit=1`
    );
    const cabeza = ella?.grupo_id ?? empresaId;
    const resto = await select<{ id: string }>('empresas', `select=id&grupo_id=eq.${cabeza}`);
    return [...new Set([empresaId, cabeza, ...resto.map((e) => e.id)])];
  } catch (e) {
    console.error('[grupo de empresas]', e);
    return [empresaId];
  }
}
