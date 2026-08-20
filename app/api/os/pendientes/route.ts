import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';

export const runtime = 'nodejs';

/**
 * Alta, cambio y baja de lo pendiente del equipo.
 *
 * Sin registro de accesos, a diferencia del resto del OS: acá no hay datos de
 * personas evaluadas, son notas del equipo sobre su propio trabajo.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LARGO = 500;

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url, key } : null;
}

async function conSesion(): Promise<boolean> {
  if (!hayPuerta()) return true;
  const clave = process.env.OS_CLAVE as string;
  const cookie = cookies().get(COOKIE)?.value;
  return Boolean(cookie && igual(cookie, await huella(clave)));
}

function limpiar(campos: Record<string, unknown>) {
  const fila: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(campos)) {
    switch (campo) {
      case 'texto': {
        if (typeof valor !== 'string' || valor.trim() === '') {
          return { motivo: 'Falta el texto.' };
        }
        if (valor.length > LARGO) return { motivo: `El texto no puede pasar de ${LARGO} caracteres.` };
        fila.texto = valor.trim();
        break;
      }
      case 'responsable': {
        if (valor !== null && typeof valor !== 'string') return { motivo: 'Responsable inválido.' };
        fila.responsable = valor === '' ? null : valor;
        break;
      }
      case 'para_reunion':
      case 'hecha': {
        if (typeof valor !== 'boolean') return { motivo: `${campo} tiene que ser sí o no.` };
        fila[campo] = valor;
        break;
      }
      default:
        return { motivo: `Campo desconocido: ${campo}` };
    }
  }
  return { fila };
}

/** Alta. */
export async function PUT(req: Request) {
  if (!(await conSesion())) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const datos = await req.json().catch(() => null);
  const r = limpiar(datos?.campos ?? {});
  if ('motivo' in r) return NextResponse.json({ ok: false, ...r }, { status: 400 });
  if (!r.fila.texto) return NextResponse.json({ ok: false, motivo: 'Falta el texto.' }, { status: 400 });

  const res = await fetch(`${cfg.url}/rest/v1/pendientes`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(r.fila),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, motivo: `Supabase respondió ${res.status}` }, { status: 400 });
  }
  const [fila] = await res.json();
  return NextResponse.json({ ok: true, fila });
}

/** Cambio: marcar hecha, reasignar, mover a la reunión o corregir el texto. */
export async function POST(req: Request) {
  if (!(await conSesion())) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const datos = await req.json().catch(() => null);
  const id = datos?.id;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Identificador inválido.' }, { status: 400 });
  }
  const r = limpiar(datos?.campos ?? {});
  if ('motivo' in r) return NextResponse.json({ ok: false, ...r }, { status: 400 });
  if (Object.keys(r.fila).length === 0) return NextResponse.json({ ok: true });

  const res = await fetch(`${cfg.url}/rest/v1/pendientes?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ ...r.fila, actualizado_at: new Date().toISOString() }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, motivo: `Supabase respondió ${res.status}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/** Baja. */
export async function DELETE(req: Request) {
  if (!(await conSesion())) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Identificador inválido.' }, { status: 400 });
  }

  const res = await fetch(`${cfg.url}/rest/v1/pendientes?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, motivo: `Supabase respondió ${res.status}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
