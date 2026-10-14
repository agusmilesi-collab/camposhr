import { NextResponse } from 'next/server';
import { claveCorrecta } from '@/lib/centro-acceso';
import { armarCookie, COOKIE, DURACION } from '@/lib/centro-cookie';
import { insert, select } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * La entrada del inquilino: correo y contraseña.
 *
 * **El error es siempre el mismo.** Decir "ese correo no existe" le confirma a
 * cualquiera quién alquila en el Centro, que es justo lo que no tiene por qué
 * saberse desde afuera.
 *
 * Sin `CENTRO_SECRETO` no se entra. La zona falla cerrada porque adentro hay
 * plata y datos de terceros.
 *
 * **Hay tope de intentos**, por correo y por dirección. Sin tope, contra el
 * correo de un inquilino se podían probar contraseñas sin límite. El intento
 * se anota antes de contar, para que mandarlos todos juntos no lo saltee.
 */
const POR_CORREO = { cuantos: 5, minutos: 15 };
const POR_DIRECCION = { cuantos: 20, minutos: 15 };

async function fallidos(minutos: number, filtro: string): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return 0;
  const desde = new Date(Date.now() - minutos * 60 * 1000).toISOString();
  const res = await fetch(`${url}/rest/v1/centro_intentos?select=id&creado_at=gt.${desde}&${filtro}`, {
    method: 'HEAD',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
    cache: 'no-store',
  });
  return Number(res.headers.get('content-range')?.split('/')[1] ?? 0) || 0;
}

/** Saca el intento de quien entró bien o llegó frenado: solo cuentan los errados. */
async function desanotar(id: number | undefined) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!id || !url || !key) return;
  try {
    await fetch(`${url}/rest/v1/centro_intentos?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
  } catch (e) {
    console.error('centro entrar, desanotar:', e);
  }
}

export async function POST(req: Request) {
  const secreto = process.env.CENTRO_SECRETO;
  if (!secreto) {
    return NextResponse.json({ ok: false, motivo: 'El acceso todavía no está configurado.' }, { status: 503 });
  }

  const datos = await req.json().catch(() => null);
  const correo = String(datos?.correo ?? '').trim().toLowerCase();
  const clave = String(datos?.clave ?? '');
  if (!correo || !clave) {
    return NextResponse.json({ ok: false, motivo: 'Faltan el correo o la contraseña.' }, { status: 400 });
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip';
  let anotado: number | undefined;
  try {
    anotado = (await insert<{ id: number }>('centro_intentos', { correo, ip }))?.id;
    const [delCorreo, deLaDireccion] = await Promise.all([
      fallidos(POR_CORREO.minutos, `correo=eq.${encodeURIComponent(correo)}`),
      fallidos(POR_DIRECCION.minutos, `ip=eq.${encodeURIComponent(ip)}`),
    ]);
    if (delCorreo > POR_CORREO.cuantos || deLaDireccion > POR_DIRECCION.cuantos) {
      await desanotar(anotado);
      return NextResponse.json(
        { ok: false, motivo: 'Hubo demasiados intentos fallidos. Probá de nuevo en quince minutos.' },
        { status: 429 }
      );
    }
  } catch (e) {
    // Si no se puede contar, se deja pasar: que la base no conteste el conteo
    // no puede dejar a los inquilinos afuera.
    console.error('centro entrar, tope:', e);
  }

  const filas = await select<{ id: string; hash: string | null; activo: boolean }>(
    'inquilinos',
    `select=id,hash,activo&correo=eq.${encodeURIComponent(correo)}`
  );
  const yo = filas[0];
  const entra = yo && yo.activo && (await claveCorrecta(clave, yo.hash));
  if (!entra) {
    return NextResponse.json({ ok: false, motivo: 'Correo o contraseña incorrectos.' }, { status: 401 });
  }

  await desanotar(anotado);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await armarCookie(yo.id, yo.hash, secreto), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: DURACION,
  });
  return res;
}
