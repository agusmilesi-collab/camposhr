import 'server-only';
import { select } from '@/lib/supabase';
import type { Busqueda, Candidato, DatosCliente } from '@/lib/airtable';

/**
 * Los datos del portal, para las empresas que ya viven en Supabase.
 *
 * Devuelve la misma forma que la versión de Airtable, así el portal las trata
 * igual y no hay dos pantallas: se resuelve el token contra Supabase primero y,
 * si no está, contra Airtable, que es donde siguen las empresas sin migrar.
 *
 * Lo que sale de acá lo ve el cliente. Van los candidatos de sus propios
 * pedidos y nada más: ni evaluadora, ni precio, ni nada de otra empresa.
 */

const TOKEN_VALIDO = /^[A-Za-z0-9_-]{6,128}$/;

type FilaPedido = {
  id: string;
  puesto: string;
  estado: string | null;
  familia: string | null;
  seniority: string | null;
  fecha_pedido: string | null;
  evaluaciones: {
    id: string;
    estado: string;
    fecha_entrevista: string | null;
    fecha_entrega: string | null;
    modalidad: string | null;
    recomendacion: string | null;
    informe_path: string | null;
    facturado: boolean | null;
    pagado: boolean | null;
    personas: { nombre: string } | null;
    evaluadoras: { nombre: string } | null;
  }[];
};

const CAMPOS =
  'id,puesto,estado,familia,seniority,fecha_pedido,' +
  'evaluaciones(id,estado,fecha_entrevista,fecha_entrega,modalidad,recomendacion,' +
  'informe_path,facturado,pagado,personas(nombre),evaluadoras(nombre))';

/** La empresa a la que corresponde ese enlace, si es de una migrada. */
async function empresaDelToken(token: string): Promise<{ id: string; nombre: string } | null> {
  if (!TOKEN_VALIDO.test(token)) return null;
  const filas = await select<{ id: string; nombre: string }>(
    'empresas',
    `select=id,nombre&token_portal=eq.${encodeURIComponent(token)}&limit=1`
  );
  return filas[0] ?? null;
}

export async function datosClienteDeSupabase(token: string): Promise<DatosCliente | null> {
  const empresa = await empresaDelToken(token);
  if (!empresa) return null;

  const pedidos = await select<FilaPedido>(
    'pedidos',
    `select=${CAMPOS}&empresa_id=eq.${empresa.id}&order=fecha_pedido.desc`
  );

  const busquedas: Busqueda[] = pedidos.map((p) => ({
    id: p.id,
    puesto: p.puesto,
    estado: p.estado ?? '',
    area: p.familia,
    seniority: p.seniority,
    fecha: p.fecha_pedido,
    candidatos: (p.evaluaciones ?? []).map(
      (e): Candidato => ({
        id: e.id,
        nombre: e.personas?.nombre ?? 'Sin nombre',
        estado: e.estado,
        evaluadora: e.evaluadoras?.nombre ?? null,
        fechaEntrevista: e.fecha_entrevista,
        fechaEntrega: e.fecha_entrega,
        modalidad: e.modalidad,
        // La conclusión solo viaja cuando la evaluación está entregada: antes
        // es trabajo en curso y el cliente no la tiene que ver.
        recomendacion: e.estado === 'Entregado' ? e.recomendacion : null,
        // El informe se genera desde los datos, así que existe cuando la
        // evaluación está entregada, sin depender de un archivo subido.
        tieneInforme: e.estado === 'Entregado',
        facturado: e.facturado,
        pagado: e.pagado,
      })
    ),
  }));

  return { empresa: empresa.nombre, empresaId: null, busquedas };
}

/** Si ese enlace corresponde a una empresa de Supabase. */
export async function esPortalDeSupabase(token: string): Promise<boolean> {
  return (await empresaDelToken(token)) !== null;
}
