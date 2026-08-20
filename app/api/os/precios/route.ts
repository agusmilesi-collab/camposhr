import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';

/**
 * Actualiza el precio de una batería, desde una fecha.
 *
 * No pisa el precio anterior: agrega una fila a la historia. Las evaluaciones
 * ya cargadas conservan el que regía cuando entraron, que es la regla completa
 * de `supabase/precios-de-baterias.sql`.
 *
 * Lo puede hacer cualquiera de las tres, y queda registrado quién.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

async function conSesion(): Promise<boolean> {
  if (!hayPuerta()) return true;
  const clave = process.env.OS_CLAVE as string;
  const cookie = cookies().get(COOKIE)?.value;
  return Boolean(cookie && igual(cookie, await huella(clave)));
}

export async function POST(req: Request) {
  if (!(await conSesion())) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }

  const datos = await req.json().catch(() => null);
  const bateriaId = datos?.bateriaId;
  const precio = Number(datos?.precio);
  const desde = datos?.desde;

  if (typeof bateriaId !== 'string' || !UUID.test(bateriaId)) {
    return NextResponse.json({ ok: false, motivo: 'Batería inválida.' }, { status: 400 });
  }
  if (!Number.isFinite(precio) || precio < 0) {
    return NextResponse.json({ ok: false, motivo: 'El precio tiene que ser un número.' }, { status: 400 });
  }
  if (typeof desde !== 'string' || !FECHA.test(desde)) {
    return NextResponse.json({ ok: false, motivo: 'Falta desde cuándo rige.' }, { status: 400 });
  }

  const yo = await quienSoy();
  const cabeceras = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  // Con `merge-duplicates`, volver a cargar el mismo día corrige ese precio en
  // vez de fallar: es lo que pasa cuando alguien se equivoca en un número y lo
  // rehace en el momento.
  const res = await fetch(`${url}/rest/v1/bateria_precios?on_conflict=bateria_id,desde`, {
    method: 'POST',
    headers: { ...cabeceras, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ bateria_id: bateriaId, precio, desde, quien: yo.nombre }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
      { status: 400 }
    );
  }

  // `baterias.precio` queda como estaba: la historia manda. Se mantiene para no
  // romper lo que todavía lo lee, y se va a borrar cuando nada lo use.
  await anotarAcceso({
    accion: 'escritura',
    recurso: 'bateria_precio',
    detalle: { bateria: bateriaId, precio, desde },
  });

  return NextResponse.json({ ok: true });
}
