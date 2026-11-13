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

/**
 * Los tickets que pidió esta persona y se cerraron sin que ella lo viera
 * (`visto_el` null; ver `supabase/tickets-visto.sql`). Van como tarjeta en
 * Hoy hasta que la abre. Solo a quien lo pidió: es su aviso, y lo apaga ella.
 */
export type TicketResuelto = {
  numero: number;
  estado: string;
  pedido: string;
  /** El último mensaje, que dice qué se hizo. */
  ultimo: string | null;
};

export async function ticketsResueltos(nombre: string): Promise<TicketResuelto[]> {
  try {
    const filas = await select<{ numero: number; estado: string; texto: string; ticket_mensajes: Mensaje[] }>(
      'tickets',
      `select=numero,estado,texto,ticket_mensajes(autor,texto,created_at)` +
        `&pide=eq.${encodeURIComponent(nombre)}` +
        `&estado=in.(Hecho,Descartado)&visto_el=is.null` +
        `&ticket_mensajes.order=created_at.asc&order=numero.asc`
    );
    return filas.map((t) => ({
      numero: t.numero,
      estado: t.estado,
      pedido: t.texto,
      ultimo: t.ticket_mensajes?.[t.ticket_mensajes.length - 1]?.texto ?? null,
    }));
  } catch (e) {
    console.error('tickets resueltos:', e);
    return [];
  }
}
