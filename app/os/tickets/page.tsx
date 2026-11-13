import Shell from '../Shell';
import Tickets from './Tickets';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';
import { select } from '@/lib/supabase';
import { ABIERTO, type Ticket } from '@/lib/tickets-tipos';

export const metadata = { title: 'Tickets — Campos OS' };
export const dynamic = 'force-dynamic';

/**
 * Los pedidos de cambio del OS. Las evaluadoras dejan acá lo que necesitan que
 * cambie, en vez de mandarlo por WhatsApp, y la cola queda numerada y con su
 * estado (`supabase/tickets.sql`).
 */
export default async function PaginaTickets() {
  const yo = await quienSoy();
  const cuentas = await cuentasDeLaBarra();
  let tickets: Ticket[] = [];
  let error: string | null = null;
  try {
    tickets = await select<Ticket>(
      'tickets',
      'select=numero,pide,texto,donde,prioridad,estado,respuesta,created_at&order=numero.desc&limit=500'
    );
  } catch (e) {
    console.error('tickets:', e);
    error = 'No se pudo leer la cola de tickets.';
  }
  const abiertos = tickets.filter((t) => ABIERTO[t.estado]).length;

  return (
    <Shell
      identidad={yo.nombre}
      titulo="Tickets"
      cuentas={cuentas}
      nota={abiertos ? `${abiertos} ${abiertos === 1 ? 'abierto' : 'abiertos'}` : undefined}
    >
      <div className="os-encabezado">
        <h1>Pedidos de cambio del sistema</h1>
        <p>Lo que necesitás que cambie en el OS. Queda numerado y se sigue desde acá.</p>
      </div>
      {error && <p className="os-form-error">{error}</p>}
      <Tickets tickets={tickets} yo={yo.nombre} />
    </Shell>
  );
}
