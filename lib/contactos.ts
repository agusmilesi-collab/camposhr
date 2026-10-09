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
  type Fila = Omit<Contacto, 'recibeFactura' | 'recibeRecibo' | 'facturaFija'> & {
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
  // La factura y el recibo dependen de si la empresa tiene un responsable de
  // compras al que mandárselos. Es la misma cuenta que hace el envío
  // (`lib/correo-destinos.ts`).
  const hayCompras = filas.some((c) => c.facturacion && c.email);
  return filas.map((c) => ({
    ...c,
    // Sin compras la factura le llega a quien solicita sí o sí: no depende de
    // lo que haya tildado, y las pantallas no la dejan destildar.
    facturaFija: c.facturacion || !hayCompras,
    recibeFactura: hayCompras ? c.recibeFactura === true : true,
    // Al responsable de compras el recibo le llega mientras no lo apague.
    recibeRecibo: c.recibeRecibo ?? (c.facturacion ? true : !hayCompras),
  }));
}

/** Los que piden evaluaciones, que son los que el portal ofrece. */
export async function quienesPiden(empresaId: string): Promise<Contacto[]> {
  return (await contactosDe(empresaId)).filter((c) => c.pide);
}
