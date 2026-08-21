/**
 * Los clientes, con lo que hace falta para facturarles y para llamarlos.
 *
 * La tabla de verdad es `public.empresas`. Los que todavía no se migraron
 * viven en Airtable y se listan igual, marcados, porque una pantalla de
 * clientes a la que le faltan la mitad de los clientes no sirve para nada.
 *
 * Lo que se carga de ahora en adelante nace en Supabase.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { listarClientesConToken } from '@/lib/airtable';
import { claveEmpresa } from '@/lib/os';
import { CACHE_CLIENTES } from '@/lib/etiquetas';

export type Cliente = {
  id: string | null;
  origen: 'supabase' | 'airtable';
  nombre: string;
  razonSocial: string | null;
  cuit: string | null;
  condicionIva: string | null;
  emailFacturacion: string | null;
  contacto: string | null;
  direccionFiscal: string | null;
  rubro: string | null;
  tamano: number | null;
  notas: string | null;
  /** El enlace secreto del portal. Todo cliente tiene el suyo desde el alta. */
  token: string | null;
  /** Qué hay cargado de este cliente en Supabase. */
  pedidos: number;
  evaluaciones: number;
  cotizaciones: number;
};

export { CONDICIONES_IVA } from '@/lib/clientes-tipos';

type FilaEmpresa = {
  id: string;
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  condicion_iva: string | null;
  email_facturacion: string | null;
  contacto: string | null;
  direccion_fiscal: string | null;
  rubro: string | null;
  tamano: number | null;
  notas: string | null;
  token_portal: string | null;
  pedidos: { id: string; evaluaciones: { id: string }[] }[];
  cotizaciones: { id: string }[];
};

const CAMPOS =
  'id,nombre,razon_social,cuit,condicion_iva,email_facturacion,contacto,' +
  'direccion_fiscal,rubro,tamano,notas,token_portal,' +
  'pedidos(id,evaluaciones(id)),cotizaciones(id)';

export async function listarClientes(): Promise<Cliente[]> {
  const [enSupabase, conToken] = await Promise.all([
    select<FilaEmpresa>(
      'empresas',
      `select=${CAMPOS}&activa=is.true&order=nombre.asc`,
      CACHE_CLIENTES
    ).catch(() => [] as FilaEmpresa[]),
    listarClientesConToken().catch(() => []),
  ]);

  const tokensPorClave = new Map(conToken.map((c) => [claveEmpresa(c.nombre), c.token]));

  const clientes: Cliente[] = enSupabase.map((e) => ({
    id: e.id,
    origen: 'supabase' as const,
    nombre: e.nombre,
    razonSocial: e.razon_social,
    cuit: e.cuit,
    condicionIva: e.condicion_iva,
    emailFacturacion: e.email_facturacion,
    contacto: e.contacto,
    direccionFiscal: e.direccion_fiscal,
    rubro: e.rubro,
    tamano: e.tamano,
    notas: e.notas,
    // El de Airtable primero: es el que el cliente ya tiene en la mano. El de
    // Supabase nace con la empresa, así que cubre a las que nunca tuvieron uno
    // y a las que se dan de alta desde acá.
    token: tokensPorClave.get(claveEmpresa(e.nombre)) ?? e.token_portal ?? null,
    pedidos: e.pedidos?.length ?? 0,
    evaluaciones: (e.pedidos ?? []).reduce((n, p) => n + (p.evaluaciones?.length ?? 0), 0),
    cotizaciones: e.cotizaciones?.length ?? 0,
  }));

  // Los de Airtable que todavía no existen de este lado.
  const yaEstan = new Set(clientes.map((c) => claveEmpresa(c.nombre)));
  for (const c of conToken) {
    if (yaEstan.has(claveEmpresa(c.nombre))) continue;
    clientes.push({
      id: null,
      origen: 'airtable',
      nombre: c.nombre,
      razonSocial: null,
      cuit: null,
      condicionIva: null,
      emailFacturacion: null,
      contacto: null,
      direccionFiscal: null,
      rubro: null,
      tamano: null,
      notas: null,
      token: c.token,
      pedidos: 0,
      evaluaciones: 0,
      cotizaciones: 0,
    });
  }

  return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
}
