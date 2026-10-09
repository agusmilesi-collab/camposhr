import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_CLIENTES } from '@/lib/etiquetas';
import type { Contacto } from '@/lib/contactos-tipos';
import { empresasDelGrupo } from '@/lib/grupo';

/**
 * Los contactos de un cliente.
 *
 * Los de baja no se traen: siguen en la base para que las facturas viejas
 * conserven a quién se le mandaron, y dejan de estar entre los que se eligen.
 */
export async function contactosDe(empresaId: string): Promise<Contacto[]> {
  return leer(empresaId, [empresaId]);
}

/**
 * Lee los contactos de una o varias empresas y resuelve la factura y el
 * recibo **mirando a `empresaId`**: de quién es el responsable de compras
 * depende de para qué empresa es el pedido, no de dónde está cargada la
 * persona.
 */
async function leer(empresaId: string, deCuales: string[]): Promise<Contacto[]> {
  type Fila = Omit<Contacto, 'recibeFactura' | 'recibeRecibo' | 'facturaFija'> & {
    recibeFactura: boolean | null;
    recibeRecibo: boolean | null;
    empresa_id: string;
  };
  const filas = await select<Fila>(
    'contactos',
    // Los nombres de la base, con el alias que usa la aplicación.
    `select=id,nombre,cargo,email,telefono,pide,facturacion,activo,empresa_id,` +
      `recibeOrden:recibe_orden,recibeEntrevista:recibe_entrevista,recibeInforme:recibe_informe,recibeTodo:recibe_todo,` +
      `recibeFactura:recibe_factura,recibeRecibo:recibe_recibo` +
      `&empresa_id=in.(${deCuales.map(encodeURIComponent).join(',')})&activo=is.true&order=nombre.asc`,
    CACHE_CLIENTES
  ).catch(() => [] as Fila[]);
  // La factura y el recibo dependen de si la empresa tiene un responsable de
  // compras al que mandárselos. Es la misma cuenta que hace el envío
  // (`lib/correo-destinos.ts`).
  const esCompras = (c: Fila) => c.facturacion && c.empresa_id === empresaId;
  const hayCompras = filas.some((c) => esCompras(c) && c.email);
  return filas.map(({ empresa_id: _, ...c }) => {
    // Responsable de compras lo es de su empresa: quien paga en otra del grupo
    // acá es una persona más.
    const compras = c.facturacion && _ === empresaId;
    return {
      ...c,
      facturacion: compras,
      // Sin compras la factura le llega a quien solicita sí o sí: no depende
      // de lo que haya tildado, y las pantallas no la dejan destildar.
      facturaFija: compras || !hayCompras,
      recibeFactura: hayCompras ? c.recibeFactura === true : true,
      // Al responsable de compras el recibo le llega mientras no lo apague.
      recibeRecibo: c.recibeRecibo ?? (compras ? true : !hayCompras),
    };
  });
}

/**
 * Los que piden evaluaciones, que son los que el portal ofrece.
 *
 * En un grupo de empresas son las personas de todo el grupo: están cargadas
 * una vez, en la que lo encabeza, y piden para cualquiera (`lib/grupo.ts`).
 */
export async function quienesPiden(empresaId: string): Promise<Contacto[]> {
  return (await contactosDelGrupo(empresaId)).filter((c) => c.pide);
}

/** Las personas de la empresa y de su grupo, vistas desde esa empresa. */
export async function contactosDelGrupo(empresaId: string): Promise<Contacto[]> {
  return leer(empresaId, await empresasDelGrupo(empresaId));
}
