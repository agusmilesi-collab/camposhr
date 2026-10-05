import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { insert, patch, select } from '@/lib/supabase';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';
import { esTestConLaminas, TESTS } from '@/lib/laminas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El enlace cuelga del host principal, que es donde vive lo público. */
function base(req: Request): string {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return `http://${host}`;
  return 'https://camposhr.com';
}

/**
 * El enlace de las láminas para mandarle a la persona evaluada.
 *
 * Si ya tiene uno vigente se devuelve el mismo: el botón se aprieta más de una
 * vez en la misma sesión, y dos enlaces distintos en el chat hacen dudar de
 * cuál abrir.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  const datos = await req.json().catch(() => null);
  const id = datos?.evaluacionId;
  const test = datos?.test;
  if (typeof id !== 'string' || !UUID.test(id) || typeof test !== 'string' || !esTestConLaminas(test)) {
    return NextResponse.json({ ok: false, motivo: 'Pedido inválido.' }, { status: 400 });
  }

  // Con `lamina`, no se pide un enlace: se le dice a la pantalla de la persona
  // cuál tiene que mostrar. Si no hay ningún enlace vigente no cambia nada, y
  // por eso la pantalla de codificación puede mandarlo sin preguntar antes.
  if (datos.lamina !== undefined) {
    const n = Number(datos.lamina);
    if (!Number.isInteger(n) || n < 1 || n > TESTS[test].laminas) {
      return NextResponse.json({ ok: false, motivo: 'Lámina inválida.' }, { status: 400 });
    }
    try {
      await patch(
        'laminas_enlaces',
        `evaluacion_id=eq.${id}&test=eq.${test}&vence_at=gt.${new Date().toISOString()}`,
        { lamina: n }
      );
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error('laminas-link, lámina:', e);
      return NextResponse.json({ ok: false, motivo: 'No se pudo avisar.' }, { status: 500 });
    }
  }

  try {
    const vigentes = await select<{ token: string }>(
      'laminas_enlaces',
      `select=token&evaluacion_id=eq.${id}&test=eq.${test}` +
        `&vence_at=gt.${new Date(Date.now() + 60 * 60 * 1000).toISOString()}&order=vence_at.desc&limit=1`
    );
    if (vigentes[0]) {
      return NextResponse.json({ ok: true, enlace: `${base(req)}/laminas/${vigentes[0].token}` });
    }

    const token = `lm_${randomBytes(16).toString('base64url')}`;
    await insert('laminas_enlaces', { token, evaluacion_id: id, test });

    const yo = await quienSoy();
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'laminas_enlace',
      recursoId: id,
      detalle: { test },
    });
    return NextResponse.json({ ok: true, enlace: `${base(req)}/laminas/${token}` });
  } catch (e) {
    console.error('laminas-link:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo generar el enlace.' }, { status: 500 });
  }
}
