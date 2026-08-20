import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { enlaceDelInforme, guardarBenziger } from '@/lib/benziger-datos';
import { extraerBenziger } from '@/lib/benziger-pdf';
import { PERFILES } from '@/lib/perfiles';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PDF = 20 * 1024 * 1024;

async function sinSesion(): Promise<boolean> {
  if (!hayPuerta()) return false;
  const clave = process.env.OS_CLAVE as string;
  const cookie = cookies().get(COOKIE)?.value;
  return !cookie || !igual(cookie, await huella(clave));
}

/** Carga el informe Benziger y el cuadrante que eligió la evaluadora. */
export async function POST(req: Request) {
  if (await sinSesion()) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, motivo: 'No se pudo leer el formulario.' },
      { status: 400 }
    );
  }

  const id = (form.get('evaluacionId') ?? '').toString().trim();
  const cuadrantes = form
    .getAll('cuadrante')
    .map((c) => c.toString())
    .filter((c) => PERFILES.includes(c as (typeof PERFILES)[number]));

  const adjunto = form.get('pdf');
  const pdf = adjunto instanceof File && adjunto.size > 0 ? adjunto : null;
  if (pdf && pdf.size > MAX_PDF) {
    return NextResponse.json({ ok: false, motivo: 'El informe supera los 20 MB.' }, { status: 400 });
  }

  try {
    // El informe se lee al subirlo: es un formulario fijo y se puede leer con
    // reglas, así que no hace falta que nadie transcriba nada a mano.
    let leido = null;
    let avisoLectura: string | null = null;
    if (pdf) {
      try {
        leido = await extraerBenziger(new Uint8Array(await pdf.arrayBuffer()));
      } catch (e) {
        console.error('benziger: no se pudo leer el PDF', e);
        // El archivo se guarda igual: perder el adjunto por un problema de
        // lectura sería peor que quedarse sin los números.
        avisoLectura = 'El informe se guardó pero no se pudo leer.';
      }
    }

    const r = await guardarBenziger(id, { cuadrantes, pdf, leido });
    if (!r.ok) return NextResponse.json(r, { status: 400 });

    const yo = await quienSoy();
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'benziger',
      recursoId: id,
      detalle: { cuadrantes, con_pdf: r.conPdf, leido: Boolean(leido) },
    });

    revalidateTag(CACHE_PSICOTECNICOS);
    return NextResponse.json({ ok: true, leido: Boolean(leido), aviso: avisoLectura });
  } catch (e) {
    console.error('benziger:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo cargar.' }, { status: 500 });
  }
}

/**
 * Abre el informe.
 *
 * El bucket es privado, así que se firma una dirección de vida corta y se
 * redirige. Queda anotado quién lo abrió: es un informe con el nombre y el
 * perfil de una persona identificable.
 */
export async function GET(req: Request) {
  if (await sinSesion()) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id') ?? '';
  const enlace = await enlaceDelInforme(id);
  if (!enlace) {
    return NextResponse.json({ ok: false, motivo: 'No hay informe cargado.' }, { status: 404 });
  }

  const yo = await quienSoy();
  await anotarAcceso({
    quien: yo.nombre,
    accion: 'descarga',
    recurso: 'benziger',
    recursoId: id,
  });

  return NextResponse.redirect(enlace);
}
