import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { hayPuerta, huella, igual } from '@/lib/os-sesion';
import { cookieDelOs } from '@/lib/os-sesion-servidor';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';
import { CACHE_CLIENTES, CACHE_COMERCIAL } from '@/lib/etiquetas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Los precios acordados con un cliente (`empresa_precios`).
 *
 * Nacen de una licitación: se respetan el plazo que fija, y después el
 * cliente vuelve solo a la lista general. `bateriaId` nulo es el adicional
 * Benziger, en pesos. La regla de lectura está en
 * `supabase/precios-por-cliente.sql`.
 *
 * POST agrega o corrige (mismo cliente, mismo concepto, mismo `desde`: se
 * pisa). DELETE saca una fila, para un acuerdo mal cargado.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

async function conSesion(): Promise<boolean> {
  if (!hayPuerta()) return true;
  const clave = process.env.OS_CLAVE as string;
  const cookie = await cookieDelOs();
  return Boolean(cookie && igual(cookie, await huella(clave)));
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return {
    url,
    cabeceras: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
}

function invalidar() {
  // La cola de facturación y la ficha del cliente leen con estas etiquetas.
  revalidateTag(CACHE_COMERCIAL, { expire: 0 });
  revalidateTag(CACHE_CLIENTES, { expire: 0 });
}

export async function POST(req: Request) {
  if (!(await conSesion())) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }
  const c = config();
  if (!c) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const datos = await req.json().catch(() => null);
  const empresaId = datos?.empresaId;
  const bateriaId = datos?.bateriaId ?? null;
  const precio = Number(datos?.precio);
  const desde = datos?.desde;
  const hasta = datos?.hasta ? String(datos.hasta) : null;

  if (typeof empresaId !== 'string' || !UUID.test(empresaId)) {
    return NextResponse.json({ ok: false, motivo: 'Cliente inválido.' }, { status: 400 });
  }
  if (bateriaId !== null && (typeof bateriaId !== 'string' || !UUID.test(bateriaId))) {
    return NextResponse.json({ ok: false, motivo: 'Batería inválida.' }, { status: 400 });
  }
  if (!Number.isFinite(precio) || precio < 0) {
    return NextResponse.json({ ok: false, motivo: 'El precio tiene que ser un número.' }, { status: 400 });
  }
  if (typeof desde !== 'string' || !FECHA.test(desde)) {
    return NextResponse.json({ ok: false, motivo: 'Falta desde cuándo rige.' }, { status: 400 });
  }
  if (hasta !== null && !FECHA.test(hasta)) {
    return NextResponse.json({ ok: false, motivo: 'La fecha de fin no es válida.' }, { status: 400 });
  }
  if (hasta !== null && hasta < desde) {
    return NextResponse.json(
      { ok: false, motivo: 'El acuerdo no puede terminar antes de empezar.' },
      { status: 400 }
    );
  }

  const yo = await quienSoy();

  // Mismo cliente, mismo concepto, mismo día: se corrige en vez de duplicar.
  // Se borra y se escribe, porque el `on_conflict` de PostgREST no toma el
  // índice único con `nulls not distinct` que hace falta para el Benziger.
  const mismo =
    `empresa_id=eq.${empresaId}&desde=eq.${desde}&` +
    (bateriaId === null ? 'bateria_id=is.null' : `bateria_id=eq.${bateriaId}`);
  const borrado = await fetch(`${c.url}/rest/v1/empresa_precios?${mismo}`, {
    method: 'DELETE',
    headers: c.cabeceras,
    cache: 'no-store',
  });
  if (!borrado.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${borrado.status}: ${await borrado.text()}` },
      { status: 400 }
    );
  }
  const res = await fetch(`${c.url}/rest/v1/empresa_precios`, {
    method: 'POST',
    headers: { ...c.cabeceras, Prefer: 'return=minimal' },
    body: JSON.stringify({
      empresa_id: empresaId,
      bateria_id: bateriaId,
      precio,
      desde,
      hasta,
      quien: yo.nombre,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
      { status: 400 }
    );
  }

  await anotarAcceso({
    accion: 'escritura',
    recurso: 'empresa_precio',
    detalle: { empresa: empresaId, bateria: bateriaId, precio, desde, hasta },
  });
  invalidar();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await conSesion())) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }
  const c = config();
  if (!c) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const datos = await req.json().catch(() => null);
  const id = datos?.id;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Acuerdo inválido.' }, { status: 400 });
  }

  const res = await fetch(`${c.url}/rest/v1/empresa_precios?id=eq.${id}`, {
    method: 'DELETE',
    headers: c.cabeceras,
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
      { status: 400 }
    );
  }

  await anotarAcceso({ accion: 'escritura', recurso: 'empresa_precio', detalle: { borrado: id } });
  invalidar();
  return NextResponse.json({ ok: true });
}
