import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_CLIENTES, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { crearCandidato, crearEmpresa, crearPedido } from '@/lib/altas';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CV = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Alta de un pedido o de un candidato desde el OS.
 *
 * Recibe un formulario y no JSON, porque el alta de candidato puede traer el
 * CV adjunto.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario.' }, { status: 400 });
  }

  const texto = (k: string) => (form.get(k) ?? '').toString().trim();
  const yo = await quienSoy();

  try {
    if (texto('tipo') === 'pedido') return await altaPedido(form, texto, yo.nombre);
    if (texto('tipo') === 'candidato') return await altaCandidato(form, texto, yo.nombre);
    return NextResponse.json({ error: 'Falta saber qué se está cargando.' }, { status: 400 });
  } catch (e) {
    console.error('altas:', e);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
}

async function altaPedido(
  form: FormData,
  texto: (k: string) => string,
  quien: string
) {
  const puesto = texto('puesto');
  if (!puesto) {
    return NextResponse.json({ error: 'Falta el puesto que se busca.' }, { status: 400 });
  }

  // El cliente puede venir elegido de la lista o escrito porque es nuevo.
  let empresaId = texto('empresaId');
  const empresaNueva = texto('empresaNueva');
  if (!empresaId && empresaNueva) {
    empresaId = (await crearEmpresa(empresaNueva)).id;
  }
  if (!UUID.test(empresaId)) {
    return NextResponse.json({ error: 'Elegí un cliente o escribí uno nuevo.' }, { status: 400 });
  }

  const bateriaId = texto('bateriaId');
  const pedido = await crearPedido({
    empresaId,
    puesto,
    bateriaId: UUID.test(bateriaId) ? bateriaId : null,
    conBenziger: texto('conBenziger') === 'si',
    familia: texto('familia') || null,
    seniority: texto('seniority') || null,
    fechaPedido: texto('fechaPedido') || new Date().toISOString().slice(0, 10),
    notas: texto('notas') || null,
    origen: 'interno',
  });

  await anotarAcceso({
    quien,
    accion: 'escritura',
    recurso: 'pedido',
    recursoId: pedido.id,
    detalle: { puesto, empresa_id: empresaId, alta: 'interna' },
  });

  revalidateTag(CACHE_CLIENTES);

  revalidateTag(CACHE_PSICOTECNICOS);

    return NextResponse.json({ ok: true, id: pedido.id });
}

async function altaCandidato(
  form: FormData,
  texto: (k: string) => string,
  quien: string
) {
  const pedidoId = texto('pedidoId');
  const nombre = texto('nombre');
  const email = texto('email');
  const telefono = texto('telefono');

  if (!UUID.test(pedidoId)) {
    return NextResponse.json({ error: 'Elegí a qué búsqueda entra.' }, { status: 400 });
  }
  if (!nombre) {
    return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  }
  if (!telefono && !email) {
    // Es la misma regla del portal: sin una de las dos no se puede citar.
    return NextResponse.json(
      { error: 'Hace falta un teléfono o un correo para poder citarla.' },
      { status: 400 }
    );
  }

  const adjunto = form.get('cv');
  const cv = adjunto instanceof File && adjunto.size > 0 ? adjunto : null;
  if (cv && cv.size > MAX_CV) {
    return NextResponse.json({ error: 'El CV supera los 10 MB.' }, { status: 400 });
  }

  const evaluadoraId = texto('evaluadoraId');
  const evaluacion = await crearCandidato({
    pedidoId,
    nombre,
    email: email || null,
    telefono: telefono || null,
    evaluadoraId: UUID.test(evaluadoraId) ? evaluadoraId : null,
    origen: 'interno',
    cv,
  });

  await anotarAcceso({
    quien,
    accion: 'escritura',
    recurso: 'evaluacion',
    recursoId: evaluacion.id,
    detalle: { nombre, pedido_id: pedidoId, alta: 'interna', con_cv: Boolean(cv) },
  });

  revalidateTag(CACHE_CLIENTES);

  revalidateTag(CACHE_PSICOTECNICOS);

    return NextResponse.json({ ok: true, id: evaluacion.id });
}
