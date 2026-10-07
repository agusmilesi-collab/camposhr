import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_CLIENTES } from '@/lib/etiquetas';
import type { Contacto } from '@/lib/contactos-tipos';

/**
 * Los contactos de un cliente.
 *
 * Los de baja no se traen: siguen en la base para que las facturas viejas
 * conserven a quién se le mandaron, y dejan de estar entre los que se eligen.
 */
export async function contactosDe(empresaId: string): Promise<Contacto[]> {
  return select<Contacto>(
    'contactos',
    // Los nombres de la base, con el alias que usa la aplicación.
    `select=id,nombre,cargo,email,telefono,pide,facturacion,activo,` +
      `recibeOrden:recibe_orden,recibeEntrevista:recibe_entrevista,recibeInforme:recibe_informe,recibeTodo:recibe_todo` +
      `&empresa_id=eq.${encodeURIComponent(empresaId)}&activo=is.true&order=nombre.asc`,
    CACHE_CLIENTES
  ).catch(() => []);
}

/** Los que piden evaluaciones, que son los que el portal ofrece. */
export async function quienesPiden(empresaId: string): Promise<Contacto[]> {
  return (await contactosDe(empresaId)).filter((c) => c.pide);
}
