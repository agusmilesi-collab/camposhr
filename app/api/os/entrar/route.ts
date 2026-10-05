import { NextResponse } from 'next/server';
import { COOKIE, DURACION, huella, igual } from '@/lib/os-sesion';
import { insert } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * Entrada al OS. Recibe la clave, deja la sesión y vuelve a donde se iba.
 *
 * La respuesta no distingue entre "no hay clave configurada" y "la clave está
 * mal": las dos dan lo mismo del lado de afuera.
 */
/**
 * Cuántas veces se puede errar la clave.
 *
 * La clave del equipo es corta, y sin tope un programa prueba todas las
 * combinaciones en minutos. Son dos topes porque uno solo no alcanza: el de
 * cada dirección frena a quien prueba desde un lugar, y el general frena a
 * quien cambia de dirección en cada intento. Con el general, recorrer todas
 * las claves lleva semanas en vez de minutos, y queda anotado.
 *
 * El costo es que, mientras alguien esté probando, el equipo tampoco puede
 * entrar desde un navegador nuevo. Quien ya entró no se entera: su sesión
 * dura un mes y no pasa por acá.
 */
const POR_DIRECCION = { cuantos: 5, minutos: 15 };
const EN_TOTAL = { cuantos: 30, minutos: 60 };

/** Cuántos intentos fallidos hubo desde ese momento, de una dirección o de todas. */
async function fallidos(minutos: number, ip?: string): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return 0;
  const desde = new Date(Date.now() - minutos * 60 * 1000).toISOString();
  const filtro = `creado_at=gt.${desde}` + (ip ? `&ip=eq.${encodeURIComponent(ip)}` : '');
  const res = await fetch(`${url}/rest/v1/os_intentos?select=id&${filtro}`, {
    method: 'HEAD',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
    cache: 'no-store',
  });
  // "0-4/5": lo que importa es el total, después de la barra.
  return Number(res.headers.get('content-range')?.split('/')[1] ?? 0) || 0;
}

export async function POST(req: Request) {
  const datos = await req.formData();
  const clave = String(datos.get('clave') ?? '');
  const destino = String(datos.get('destino') ?? '/os');
  const esperada = process.env.OS_CLAVE;
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip';

  // El tope se mira antes de comparar la clave: frenado, ni la correcta entra,
  // que es lo que hace que seguir probando no sirva.
  try {
    const [suyos, todos] = await Promise.all([
      fallidos(POR_DIRECCION.minutos, ip),
      fallidos(EN_TOTAL.minutos),
    ]);
    if (suyos >= POR_DIRECCION.cuantos || todos >= EN_TOTAL.cuantos) {
      return NextResponse.redirect(
        new URL(`/os/entrar?error=2&destino=${encodeURIComponent(destino)}`, req.url),
        303
      );
    }
  } catch (e) {
    // Si no se puede contar, se deja pasar: que la base no conteste no puede
    // dejar al equipo afuera.
    console.error('entrar, tope:', e);
  }

  const ok = Boolean(esperada) && clave.length > 0 && clave === esperada;
  if (!ok) {
    try {
      await insert('os_intentos', { ip });
    } catch (e) {
      console.error('entrar, anotar:', e);
    }
    return NextResponse.redirect(
      new URL(`/os/entrar?error=1&destino=${encodeURIComponent(destino)}`, req.url),
      303
    );
  }

  // El destino se limita a rutas del propio OS: sin esto, un enlace armado
  // desde afuera podría usar esta puerta para redirigir a otro sitio.
  const limpio = destino.startsWith('/os') ? destino : '/os';
  const res = NextResponse.redirect(new URL(limpio, req.url), 303);
  res.cookies.set(COOKIE, await huella(esperada as string), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: DURACION,
  });
  return res;
}
