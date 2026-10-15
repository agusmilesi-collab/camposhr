import { NextResponse } from 'next/server';
import { HORAS_DEL_ENLACE, tokenDeAlta } from '@/lib/centro-acceso';
import { hayCorreo } from '@/lib/correo';
import { enviarEnlaceDeClave } from '@/lib/correo-centro';
import { DIRECCION } from '@/lib/direccion';
import { insert, patch, select } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * "Olvidé mi contraseña": el inquilino pone su correo y recibe el enlace de un
 * solo uso, el mismo que Lorena y Lucila generan desde el OS.
 *
 * **La respuesta es siempre la misma**, exista el correo o no: decir "ese
 * correo no es de ningún inquilino" le confirma a cualquiera quién alquila en
 * el Centro. Por eso también se contesta igual cuando el inquilino está dado
 * de baja.
 *
 * **Un enlace cada diez minutos por persona.** Se sabe por `alta_vence`: un
 * enlace que todavía tiene más de 47 h 50 min de vida se generó hace menos de
 * diez minutos. Sin esto, con el correo de un inquilino se le podía llenar la
 * casilla a voluntad, y cada pedido le quemaba el enlace anterior.
 *
 * **Y tope de pedidos**, como en el ingreso: por dirección y en total, porque
 * cada pedido manda un correo y la cuenta de Resend tiene cupo. Se anotan en
 * `centro_intentos` con el correo precedido por `enlace:`, para que no cuenten
 * como contraseñas erradas de esa persona. El pedido se anota antes de contar,
 * para que mandarlos todos juntos no lo saltee.
 */
const MINUTOS_ENTRE_ENLACES = 10;
const POR_DIRECCION = { cuantos: 5, minutos: 15 };
const EN_TOTAL = { cuantos: 30, minutos: 60 };

async function pedidos(minutos: number, filtro: string): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return 0;
  const desde = new Date(Date.now() - minutos * 60 * 1000).toISOString();
  const res = await fetch(
    `${url}/rest/v1/centro_intentos?select=id&correo=like.enlace:*&creado_at=gt.${desde}${filtro}`,
    {
      method: 'HEAD',
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      cache: 'no-store',
    }
  );
  return Number(res.headers.get('content-range')?.split('/')[1] ?? 0) || 0;
}

const RESPUESTA = {
  ok: true,
  mensaje: `Si ese correo es de un inquilino del Centro, te mandamos el enlace. Vale ${HORAS_DEL_ENLACE} horas.`,
};

export async function POST(req: Request) {
  if (!hayCorreo()) {
    return NextResponse.json(
      { ok: false, motivo: 'El envío de correo no está configurado. Pedile el enlace a Lorena o a Lucila.' },
      { status: 503 }
    );
  }

  const datos = await req.json().catch(() => null);
  const correo = String(datos?.correo ?? '').trim().toLowerCase();
  if (!DIRECCION.test(correo)) {
    return NextResponse.json({ ok: false, motivo: 'Escribí un correo válido.' }, { status: 400 });
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip';
  try {
    await insert('centro_intentos', { correo: `enlace:${correo}`, ip });
    const [deLaDireccion, enTotal] = await Promise.all([
      pedidos(POR_DIRECCION.minutos, `&ip=eq.${encodeURIComponent(ip)}`),
      pedidos(EN_TOTAL.minutos, ''),
    ]);
    if (deLaDireccion > POR_DIRECCION.cuantos || enTotal > EN_TOTAL.cuantos) {
      return NextResponse.json(
        { ok: false, motivo: 'Hubo demasiados pedidos seguidos. Probá de nuevo en un rato.' },
        { status: 429 }
      );
    }
  } catch (e) {
    // Si no se puede contar, se deja pasar: la base sin contestar el conteo
    // no puede dejar a un inquilino sin su enlace.
    console.error('centro recuperar, tope:', e);
  }

  const filas = await select<{ id: string; nombre: string; activo: boolean; alta_vence: string | null }>(
    'inquilinos',
    `select=id,nombre,activo,alta_vence&correo=eq.${encodeURIComponent(correo)}`
  );
  const yo = filas[0];
  if (!yo || !yo.activo) return NextResponse.json(RESPUESTA);

  const recien =
    yo.alta_vence &&
    new Date(yo.alta_vence).getTime() >
      Date.now() + (HORAS_DEL_ENLACE * 60 - MINUTOS_ENTRE_ENLACES) * 60 * 1000;
  if (recien) return NextResponse.json(RESPUESTA);

  const token = tokenDeAlta();
  const vence = new Date(Date.now() + HORAS_DEL_ENLACE * 3600 * 1000).toISOString();
  await patch('inquilinos', `id=eq.${yo.id}`, { alta_token: token, alta_vence: vence });

  const host = req.headers.get('host') ?? '';
  const base = host.startsWith('localhost') ? `http://${host}` : 'https://centro.camposhr.com';
  const envio = await enviarEnlaceDeClave({
    correo,
    nombre: yo.nombre,
    enlace: `${base}/centro/clave/${token}`,
    token,
  });
  if (!envio.ok) {
    console.error('centro recuperar, no salió el correo:', envio);
    return NextResponse.json(
      { ok: false, motivo: 'No se pudo mandar el correo. Probá de nuevo o pedile el enlace a Lorena o a Lucila.' },
      { status: 502 }
    );
  }
  return NextResponse.json(RESPUESTA);
}
