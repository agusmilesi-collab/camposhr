import { NextResponse } from 'next/server';
import { COOKIE, DURACION, destinoPermitido, dominioDeCookie, huella, igual } from '@/lib/os-sesion';
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

/**
 * Saca un intento ya anotado: el de quien entró bien, o el que llegó frenado.
 * Si no se borrara el frenado, seguir probando alargaría el freno para siempre.
 */
async function desanotar(id: string | undefined) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!id || !url || !key) return;
  try {
    await fetch(`${url}/rest/v1/os_intentos?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
  } catch (e) {
    console.error('entrar, desanotar:', e);
  }
}

export async function POST(req: Request) {
  const datos = await req.formData();
  const clave = String(datos.get('clave') ?? '');
  const destino = String(datos.get('destino') ?? '/os');
  const esperada = process.env.OS_CLAVE;
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip';

  // El intento se anota antes de contar, y se cuenta con él adentro. Contando
  // primero y anotando después, cien pedidos mandados juntos leían todos "menos
  // de cinco" antes de que se anotara ninguno, y el tope no frenaba nada.
  let anotado: string | undefined;
  try {
    anotado = (await insert<{ id: string }>('os_intentos', { ip }))?.id;
  } catch (e) {
    console.error('entrar, anotar:', e);
  }

  // El tope se mira antes de comparar la clave: frenado, ni la correcta entra,
  // que es lo que hace que seguir probando no sirva.
  try {
    const [suyos, todos] = await Promise.all([
      fallidos(POR_DIRECCION.minutos, ip),
      fallidos(EN_TOTAL.minutos),
    ]);
    if (suyos > POR_DIRECCION.cuantos || todos > EN_TOTAL.cuantos) {
      await desanotar(anotado);
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
    return NextResponse.redirect(
      new URL(`/os/entrar?error=1&destino=${encodeURIComponent(destino)}`, req.url),
      303
    );
  }

  await desanotar(anotado);

  // El destino se limita al OS y al hub: sin esto, un enlace armado desde
  // afuera podría usar esta puerta para redirigir a otro sitio.
  const res = NextResponse.redirect(new URL(destinoPermitido(destino), req.url), 303);
  res.cookies.set(COOKIE, await huella(esperada as string), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: DURACION,
    domain: dominioDeCookie(req.headers.get('host') ?? ''),
  });
  return res;
}
