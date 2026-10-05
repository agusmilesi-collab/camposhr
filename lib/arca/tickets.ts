/**
 * El ticket de acceso de ARCA, guardado en Supabase.
 *
 * El WSAA entrega un ticket que dura doce horas y se niega a dar otro mientras
 * ese siga vigente. `@arcasdk/core` lo guarda por defecto en el disco, y en
 * Vercel el disco de una función no llega a la llamada siguiente: la segunda
 * emisión del día pediría un ticket nuevo y ARCA la rechazaría. Por eso vive en
 * `public.arca_tickets` (`supabase/arca.sql`), que comparten todas.
 *
 * La biblioteca arma un store por cliente y le pregunta solo por el servicio,
 * así que el CUIT y el ambiente se fijan acá, al construirlo.
 */

import 'server-only';
import { AccessTicket, type ArcaServiceName, type ILoginCredentials, type ITicketStoragePort } from '@arcasdk/core';
import { select, upsert } from '@/lib/supabase';

export type Ambiente = 'homologacion' | 'produccion';

export class TicketsEnSupabase implements ITicketStoragePort {
  constructor(
    private readonly cuit: string,
    private readonly ambiente: Ambiente
  ) {}

  private filtro(servicio: ArcaServiceName) {
    return `cuit=eq.${this.cuit}&servicio=eq.${servicio}&ambiente=eq.${this.ambiente}`;
  }

  async save(ticket: AccessTicket, servicio: ArcaServiceName): Promise<void> {
    await upsert(
      'arca_tickets',
      {
        cuit: this.cuit,
        servicio,
        ambiente: this.ambiente,
        credenciales: ticket.toLoginCredentials(),
        expira_at: ticket.getExpiration().toISOString(),
      },
      'cuit,servicio,ambiente',
      false
    );
  }

  async get(servicio: ArcaServiceName): Promise<AccessTicket | null> {
    const filas = await select<{ credenciales: ILoginCredentials }>(
      'arca_tickets',
      `select=credenciales&${this.filtro(servicio)}&limit=1`
    );
    if (!filas[0]) return null;
    try {
      return AccessTicket.create(filas[0].credenciales);
    } catch {
      // Un ticket que no se puede leer es lo mismo que no tener ticket.
      return null;
    }
  }

  async delete(servicio: ArcaServiceName): Promise<void> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Falta la configuración de Supabase.');
    await fetch(`${url}/rest/v1/arca_tickets?${this.filtro(servicio)}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
  }
}
