import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { select } from '@/lib/supabase';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * De dónde cuelga el enlace que se le manda al candidato.
 *
 * El OS vive en su subdominio y detrás de la puerta; el test lo responde una
 * persona de afuera, así que el enlace tiene que apuntar al host principal,
 * que es donde vive lo público.
 */
function base(req: Request): string {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return `http://${host}`;
  return 'https://camposhr.com';
}

/**
 * El enlace del test de Raven de un candidato.
 *
 * Se pide en el momento de la entrevista y se pega en el chat donde se esté
 * hablando con la persona. Si ya tiene uno sin usar se devuelve el mismo: dos
 * enlaces para la misma evaluación son dos tests, y el segundo pisaría al
 * primero.
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
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }

  try {
    // El que ya está, si todavía no se entregó.
    const abiertas = await select<{ token: string; iniciado_at: string | null }>(
      'raven_sesiones',
      `select=token,iniciado_at&evaluacion_id=eq.${id}&terminado_at=is.null&order=creado_at.desc&limit=1`
    );
    if (abiertas[0]) {
      return NextResponse.json({
        ok: true,
        enlace: `${base(req)}/raven/${abiertas[0].token}`,
        empezado: abiertas[0].iniciado_at !== null,
        nuevo: false,
      });
    }

    const token = `rv_${randomBytes(16).toString('base64url')}`;
    const res = await fetch(`${url}/rest/v1/raven_sesiones`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ evaluacion_id: id, token }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
        { status: 500 }
      );
    }

    const yo = await quienSoy();
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'raven_sesion',
      recursoId: id,
      detalle: { alta: 'enlace' },
    });

    return NextResponse.json({ ok: true, enlace: `${base(req)}/raven/${token}`, empezado: false, nuevo: true });
  } catch (e) {
    console.error('raven-link:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo generar el enlace.' }, { status: 500 });
  }
}
