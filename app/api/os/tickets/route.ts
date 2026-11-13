import { NextResponse } from 'next/server';
import { hayPuerta, huella, igual } from '@/lib/os-sesion';
import { cookieDelOs } from '@/lib/os-sesion-servidor';
import { quienSoy } from '@/lib/identidad';
import { ESTADOS_TICKET, LARGO_TICKET, PRIORIDADES } from '@/lib/tickets-tipos';

export const runtime = 'nodejs';

/**
 * Alta de un pedido de cambio y cambio de su estado.
 *
 * Quién lo pide no viaja en el pedido: sale de la identidad con la que se está
 * trabajando en el OS (`quienSoy`), la misma del pie de la barra lateral.
 */

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url, key } : null;
}

async function conSesion(): Promise<boolean> {
  if (!hayPuerta()) return true;
  const clave = process.env.OS_CLAVE as string;
  const cookie = await cookieDelOs();
  return Boolean(cookie && igual(cookie, await huella(clave)));
}

function cabeceras(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

/** Alta. */
export async function PUT(req: Request) {
  if (!(await conSesion())) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const datos = await req.json().catch(() => null);
  const texto = typeof datos?.texto === 'string' ? datos.texto.trim() : '';
  const donde = typeof datos?.donde === 'string' ? datos.donde.trim() : '';
  const prioridad = datos?.prioridad ?? 'Media';
  if (!texto) return NextResponse.json({ ok: false, motivo: 'Falta qué pedís.' }, { status: 400 });
  if (!PRIORIDADES.includes(prioridad)) {
    return NextResponse.json({ ok: false, motivo: 'Esa prioridad no existe.' }, { status: 400 });
  }
  if (texto.length > LARGO_TICKET || donde.length > 200) {
    return NextResponse.json({ ok: false, motivo: 'El texto es demasiado largo.' }, { status: 400 });
  }

  const yo = await quienSoy();
  const res = await fetch(`${cfg.url}/rest/v1/tickets`, {
    method: 'POST',
    headers: cabeceras(cfg.key),
    body: JSON.stringify({ pide: yo.nombre, texto, donde: donde || null, prioridad }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, motivo: `Supabase respondió ${res.status}` }, { status: 400 });
  }
  const [fila] = await res.json();
  return NextResponse.json({ ok: true, fila });
}

/** Cambio de estado o de prioridad, o un mensaje nuevo en la conversación. */
export async function POST(req: Request) {
  if (!(await conSesion())) return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const datos = await req.json().catch(() => null);
  const numero = datos?.numero;
  if (!Number.isInteger(numero) || numero < 1) {
    return NextResponse.json({ ok: false, motivo: 'Número inválido.' }, { status: 400 });
  }
  /* Un mensaje nuevo en la conversación, firmado por quien está en el OS. */
  if (datos?.mensaje !== undefined) {
    const texto = typeof datos.mensaje === 'string' ? datos.mensaje.trim() : '';
    if (!texto || texto.length > LARGO_TICKET) {
      return NextResponse.json({ ok: false, motivo: 'Mensaje inválido.' }, { status: 400 });
    }
    const yo = await quienSoy();
    const res = await fetch(`${cfg.url}/rest/v1/ticket_mensajes`, {
      method: 'POST',
      headers: cabeceras(cfg.key),
      body: JSON.stringify({ numero, autor: yo.nombre, texto }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, motivo: `Supabase respondió ${res.status}` }, { status: 400 });
    }
    const [fila] = await res.json();
    return NextResponse.json({ ok: true, fila });
  }

  const cambios: Record<string, string | null> = {};
  if (datos?.estado !== undefined) {
    if (!ESTADOS_TICKET.includes(datos.estado)) {
      return NextResponse.json({ ok: false, motivo: 'Ese estado no existe.' }, { status: 400 });
    }
    cambios.estado = datos.estado;
  }
  if (datos?.prioridad !== undefined) {
    if (!PRIORIDADES.includes(datos.prioridad)) {
      return NextResponse.json({ ok: false, motivo: 'Esa prioridad no existe.' }, { status: 400 });
    }
    cambios.prioridad = datos.prioridad;
  }
  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ ok: false, motivo: 'Nada para cambiar.' }, { status: 400 });
  }

  const res = await fetch(`${cfg.url}/rest/v1/tickets?numero=eq.${numero}`, {
    method: 'PATCH',
    headers: cabeceras(cfg.key),
    body: JSON.stringify({ ...cambios, actualizado_at: new Date().toISOString() }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, motivo: `Supabase respondió ${res.status}` }, { status: 400 });
  }
  const [fila] = await res.json();
  return NextResponse.json({ ok: true, fila });
}
