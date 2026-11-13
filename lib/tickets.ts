import 'server-only';
import { select } from '@/lib/supabase';
import type { Mensaje } from '@/lib/tickets-tipos';

/**
 * Los tickets que pidió esta persona y esperan que ella conteste: abiertos y
 * con el último mensaje de otro (el agente que lo está resolviendo). Van como
 * tarjeta en Hoy, en Inicio. Se van solos cuando ella contesta en el hilo o el
 * ticket se cierra.
 */
export type TicketParaContestar = {
  numero: number;
  /** Quién lo pidió: la tarjeta lo nombra cuando quien mira ve todo. */
  pide: string;
  pedido: string;
  autor: string;
  ultimo: string;
};

/**
 * Quien ve todo (`alcance: 'todo'`, Agustín) recibe los de todas, como en el
 * resto de Inicio; las demás, solo los suyos.
 */
export async function ticketsParaContestar(
  nombre: string,
  todos = false
): Promise<TicketParaContestar[]> {
  try {
    const filas = await select<{ numero: number; pide: string; texto: string; ticket_mensajes: Mensaje[] }>(
      'tickets',
      `select=numero,pide,texto,ticket_mensajes(autor,texto,created_at)` +
        (todos ? '' : `&pide=eq.${encodeURIComponent(nombre)}`) +
        `&estado=in.(Nuevo,"En curso",Bloqueado)` +
        `&ticket_mensajes.order=created_at.asc&order=numero.asc`
    );
    return filas.flatMap((t) => {
      const ultimo = t.ticket_mensajes?.[t.ticket_mensajes.length - 1];
      // Espera respuesta de quien lo pidió: el último mensaje es de otro.
      if (!ultimo || ultimo.autor === t.pide) return [];
      return [{ numero: t.numero, pide: t.pide, pedido: t.texto, autor: ultimo.autor, ultimo: ultimo.texto }];
    });
  } catch (e) {
    console.error('tickets para contestar:', e);
    return [];
  }
}
