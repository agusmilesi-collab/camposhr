import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { ESTADOS } from '@/lib/pendientes-tipos';

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
      case 'estado': {
        if (!ESTADOS.includes(valor as never)) return { motivo: 'Ese estado no existe.' };
        fila.estado = valor;
        // `hecha` sale del estado y no se manda aparte: es lo que ordena la
        // lista y lo que cuenta el "sin hacer" del encabezado, y con dos
        // caminos para escribirlo quedaba una tarea tachada en estado
        // Pendiente.
        fila.hecha = valor === 'Hecha';
        break;
      }
      case 'orden': {
        if (valor !== null && !Number.isInteger(valor)) return { motivo: 'Orden inválido.' };
        fila.orden = valor;
        break;
      }
      case 'vence': {
        if (valor !== null && (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor))) {
          return { motivo: 'La fecha tiene que ser un día del calendario.' };
        }
        fila.vence = valor === '' ? null : valor;
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

  /**
   * Reordenar la lista entera: llega el orden nuevo y cada fila se queda con su
   * posición.
   *
   * Va junto y no de a una fila porque mover un tema cambia el lugar de todos
   * los que estaban debajo: mandados de a uno, una petición que falla deja la
   * lista con dos temas en la misma posición.
   */
  if (Array.isArray(datos?.orden)) {
    const ids: unknown[] = datos.orden;
    if (ids.length > 200 || ids.some((x) => typeof x !== 'string' || !UUID.test(x))) {
      return NextResponse.json({ ok: false, motivo: 'Orden inválido.' }, { status: 400 });
    }
    for (const [i, uno] of (ids as string[]).entries()) {
      const res = await fetch(`${cfg.url}/rest/v1/pendientes?id=eq.${uno}`, {
        method: 'PATCH',
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ orden: i, actualizado_at: new Date().toISOString() }),
        cache: 'no-store',
      });
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, motivo: `Supabase respondió ${res.status}` },
          { status: 400 }
        );
      }
    }
    return NextResponse.json({ ok: true });
  }

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
