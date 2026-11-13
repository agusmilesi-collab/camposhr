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
  pedido: string;
  autor: string;
  ultimo: string;
};

export async function ticketsParaContestar(nombre: string): Promise<TicketParaContestar[]> {
  try {
    const filas = await select<{ numero: number; texto: string; ticket_mensajes: Mensaje[] }>(
      'tickets',
      `select=numero,texto,ticket_mensajes(autor,texto,created_at)` +
        `&pide=eq.${encodeURIComponent(nombre)}` +
        `&estado=in.(Nuevo,"En curso",Bloqueado)` +
        `&ticket_mensajes.order=created_at.asc&order=numero.asc`
    );
    return filas.flatMap((t) => {
      const ultimo = t.ticket_mensajes?.[t.ticket_mensajes.length - 1];
      if (!ultimo || ultimo.autor === nombre) return [];
      return [{ numero: t.numero, pedido: t.texto, autor: ultimo.autor, ultimo: ultimo.texto }];
    });
  } catch (e) {
    console.error('tickets para contestar:', e);
    return [];
  }
}
