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

export type PedidoDelCliente = {
  id: string;
  puesto: string;
  estado: string | null;
  fecha: string | null;
  evaluaciones: number;
};

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
  /**
   * Si su portal deja abrir los informes.
   *
   * Se prende y se apaga desde la ficha. Apagado, la tabla de entregados sale
   * sin la columna del informe y las direcciones que lo sirven contestan que no
   * existe. El resto del portal no cambia: el cliente sigue viendo en qué anda
   * cada búsqueda.
   */
  informesVisibles: boolean;
  /**
   * Si se está trabajando con él **ahora**.
   *
   * Son dos cosas a la vez y las dos tienen que darse: la marca de la base, que
   * es la decisión de alguien, y que haya trabajo en curso. Trabajo en curso es
   * un pedido abierto o una cotización que salió y todavía no se perdió: lo que
   * ya se entregó y lo que se perdió son historia, y un cliente cuyo único
   * pedido se cerró hace tres meses no es un cliente activo.
   *
   * La marca sola no alcanza porque nace en verdadero y nadie la toca.
   */
  activa: boolean;
  /** Qué hay cargado de este cliente en Supabase. */
  pedidos: number;
  /** Sus búsquedas, para verlas sin salir de la ficha del cliente. */
  susPedidos: PedidoDelCliente[];
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
  informes_visibles: boolean | null;
  activa: boolean | null;
  pedidos: { id: string; puesto: string; estado: string | null; fecha_pedido: string | null; evaluaciones: { id: string }[] }[];
  cotizaciones: { id: string; estado: string | null }[];
};

const CAMPOS =
  'id,nombre,razon_social,cuit,condicion_iva,email_facturacion,contacto,' +
  'direccion_fiscal,rubro,tamano,notas,token_portal,informes_visibles,activa,' +
  'pedidos(id,puesto,estado,fecha_pedido,evaluaciones(id)),cotizaciones(id,estado)';

export async function listarClientes(): Promise<Cliente[]> {
  const [enSupabase, conToken] = await Promise.all([
    select<FilaEmpresa>(
      'empresas',
      // Vienen los dos: los inactivos se muestran aparte, no se esconden. Un
      // cliente que no aparece en ningún lado no se puede volver a activar.
      `select=${CAMPOS}&order=nombre.asc`,
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
    // El de Supabase primero. Hasta el 26/8/2026 mandaba el de Airtable, con
    // el argumento de que era el que el cliente ya tenía en la mano, y por eso
    // el enlace que se copiaba de acá abría el portal anterior. Los dos abren
    // la misma empresa y muestran lo mismo (ver `empresaDelToken`), así que el
    // que se reparte es el de la base donde viven los datos.
    token: e.token_portal ?? tokensPorClave.get(claveEmpresa(e.nombre)) ?? null,
    informesVisibles: e.informes_visibles !== false,
    activa:
      e.activa !== false &&
      ((e.pedidos ?? []).some((p) => p.estado === 'En curso') ||
        (e.cotizaciones ?? []).some((c) => c.estado === 'Enviada' || c.estado === 'Aprobada')),
    pedidos: e.pedidos?.length ?? 0,
    susPedidos: (e.pedidos ?? [])
      .map((p) => ({
        id: p.id,
        puesto: p.puesto,
        estado: p.estado,
        fecha: p.fecha_pedido,
        evaluaciones: p.evaluaciones?.length ?? 0,
      }))
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')),
    evaluaciones: (e.pedidos ?? []).reduce((n, p) => n + (p.evaluaciones?.length ?? 0), 0),
    // Las que salieron: un lead sin mandar es una idea, no trabajo con este
    // cliente.
    cotizaciones: (e.cotizaciones ?? []).filter((c) => c.estado && c.estado !== 'Lead').length,
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
      informesVisibles: true,
      // De los de Airtable el OS no ve un solo pedido, así que por la misma
      // regla que los demás no tienen trabajo en curso. Aparecen entre los
      // inactivos hasta que se migren, que es lo que son para este sistema.
      activa: false,
      pedidos: 0,
      susPedidos: [],
      evaluaciones: 0,
      cotizaciones: 0,
    });
  }

  return clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));
}
