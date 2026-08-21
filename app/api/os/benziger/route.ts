import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { guardarBenziger } from '@/lib/benziger-datos';
import { extraerBenziger, faltantesDe, descuadresDe } from '@/lib/benziger-pdf';
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
    // Lo que se lee es todo lo que queda: el archivo no se guarda. Por eso una
    // lectura incompleta se rechaza en vez de entrar a medias, que es lo que
    // pasaba antes, cuando el lector seguía de largo si no encontraba un
    // rótulo y el problema recién aparecía en el informe terminado.
    let leido = null;
    if (pdf) {
      try {
        leido = await extraerBenziger(new Uint8Array(await pdf.arrayBuffer()));
      } catch (e) {
        console.error('benziger: no se pudo leer el PDF', e);
        return NextResponse.json(
          { ok: false, motivo: 'No se pudo leer el informe, así que no se cargó nada.' },
          { status: 400 }
        );
      }

      const faltan = faltantesDe(leido);
      const descuadres = descuadresDe(leido);
      if (faltan.length || descuadres.length) {
        console.error('benziger: lectura incompleta', { faltan, descuadres });
        const detalle = faltan.length
          ? `No se encontraron ${faltan.length} datos (${faltan.slice(0, 6).join(', ')}${faltan.length > 6 ? '…' : ''}).`
          : `Las cuentas del informe no cierran: ${descuadres.join('; ')}.`;
        return NextResponse.json(
          {
            ok: false,
            motivo: `El informe se leyó mal y no se cargó. ${detalle} Probá con el PDF original de la plataforma Benziger.`,
          },
          { status: 400 }
        );
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
      detalle: { cuadrantes, con_informe: r.conInforme, leido: Boolean(leido) },
    });

    revalidateTag(CACHE_PSICOTECNICOS);
    return NextResponse.json({ ok: true, leido: Boolean(leido) });
  } catch (e) {
    console.error('benziger:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo cargar.' }, { status: 500 });
  }
}
