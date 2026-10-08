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
  type Fila = Omit<Contacto, 'recibeFactura' | 'recibeRecibo'> & {
    recibeFactura: boolean | null;
    recibeRecibo: boolean | null;
  };
  const filas = await select<Fila>(
    'contactos',
    // Los nombres de la base, con el alias que usa la aplicación.
    `select=id,nombre,cargo,email,telefono,pide,facturacion,activo,` +
      `recibeOrden:recibe_orden,recibeEntrevista:recibe_entrevista,recibeInforme:recibe_informe,recibeTodo:recibe_todo,` +
      `recibeFactura:recibe_factura,recibeRecibo:recibe_recibo` +
      `&empresa_id=eq.${encodeURIComponent(empresaId)}&activo=is.true&order=nombre.asc`,
    CACHE_CLIENTES
  ).catch(() => [] as Fila[]);
  // La factura y el recibo, mientras la persona no eligió: los recibe si su
  // empresa no tiene un responsable de compras al que mandárselos. Es la
  // misma cuenta que hace el envío (`lib/correo-destinos.ts`).
  const hayCompras = filas.some((c) => c.facturacion && c.email);
  return filas.map((c) => ({
    ...c,
    recibeFactura: c.recibeFactura ?? !hayCompras,
    // Al responsable de compras el recibo le llega mientras no lo apague.
    recibeRecibo: c.recibeRecibo ?? (c.facturacion ? true : !hayCompras),
  }));
}

/** Los que piden evaluaciones, que son los que el portal ofrece. */
export async function quienesPiden(empresaId: string): Promise<Contacto[]> {
  return (await contactosDe(empresaId)).filter((c) => c.pide);
}
