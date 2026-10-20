import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { empresasDelGrupo } from '@/lib/grupo';
import { empresaDelToken } from '@/lib/portal-supabase';
import { select } from '@/lib/supabase';
import { guardarCampos } from '@/lib/psicotecnicos';
import { yaEntregada } from '@/lib/psicotecnicos-tipos';
import { CACHE_CLIENTES, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Noventa días después del ingreso: cuándo sale el correo de seguimiento. */
function noventaDias(desde: string): string {
  const d = new Date(`${desde}T12:00:00`);
  d.setDate(d.getDate() + 90);
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
}

/**
 * Si la persona entró a trabajar y desde cuándo, cargado por el cliente.
 *
 * Reemplaza la planilla de ingresos que se les mandaba por correo: lo marcan
 * en la tabla de entregados de su portal, y queda en las mismas columnas que
 * carga el equipo desde la ficha. Hace lo mismo que la ficha: con la fecha
 * agenda el correo de los noventa días, y un "no" borra la fecha y el
 * seguimiento.
 *
 * El token del portal es la credencial y solo alcanza a las evaluaciones
 * entregadas de esa empresa o de su grupo. De acá no se toca nada más.
 */
export async function POST(req: Request) {
  const datos = await req.json().catch(() => null);
  const token = String(datos?.token ?? '').trim();
  const id = String(datos?.id ?? '').trim();
  const empresa = token ? await empresaDelToken(token) : null;
  if (!empresa || !UUID.test(id)) {
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 404 });
  }

  // `ingreso`: true, false o null (sin respuesta). `fecha`: solo con ingreso.
  const ingreso = datos.ingreso;
  if (ingreso !== true && ingreso !== false && ingreso !== null) {
    return NextResponse.json({ error: 'Respuesta inválida.' }, { status: 400 });
  }
  const fecha = datos.fecha === undefined ? undefined : datos.fecha;
  if (fecha !== undefined && fecha !== null && !(typeof fecha === 'string' && FECHA.test(fecha))) {
    return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 });
  }

  try {
    const [evaluacion] = await select<{
      estado: string;
      baja_el: string | null;
      pedido_id: string;
    }>('evaluaciones', `select=estado,baja_el,pedido_id&id=eq.${id}&limit=1`);
    if (!evaluacion || evaluacion.baja_el || !yaEntregada(evaluacion.estado)) {
      return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 404 });
    }
    // De esa empresa o de su grupo: el portal de un grupo es uno solo.
    const grupo = await empresasDelGrupo(empresa.id);
    const [suyo] = await select<{ id: string }>(
      'pedidos',
      `select=id&id=eq.${evaluacion.pedido_id}&empresa_id=in.(${grupo.join(',')})&limit=1`
    );
    if (!suyo) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 404 });
  } catch (e) {
    console.error('[ingreso del portal]', e);
    return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 502 });
  }

  const cambios: Record<string, string | boolean | null> =
    ingreso === true
      ? fecha === undefined
        ? { ingreso }
        : { ingreso, fechaIngresoEmpresa: fecha, seguimientoAl: fecha ? noventaDias(fecha) : null }
      : { ingreso, fechaIngresoEmpresa: null, seguimientoAl: null, seguimientoResultado: null };

  const r = await guardarCampos(id, cambios);
  if (!r.ok) {
    console.error('[ingreso del portal]', r.motivo);
    return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 502 });
  }
  revalidateTag(CACHE_PSICOTECNICOS, { expire: 0 });
  revalidateTag(CACHE_CLIENTES, { expire: 0 });
  return NextResponse.json({ ok: true });
}
