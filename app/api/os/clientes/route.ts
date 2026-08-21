import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_CLIENTES } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** El nombre como parte de una dirección. */
function slug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Alta y edición de un cliente. */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Falta la configuración de Supabase.' }, { status: 500 });
  }

  let datos: any;
  try {
    datos = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const nombre = String(datos.nombre ?? '').trim();
  if (!nombre) {
    return NextResponse.json({ error: 'Falta el nombre del cliente.' }, { status: 400 });
  }

  const texto = (k: string) => {
    const v = String(datos[k] ?? '').trim();
    return v || null;
  };
  const tamano = Number(datos.tamano);

  const fila = {
    nombre,
    slug: slug(nombre),
    activa: true,
    razon_social: texto('razonSocial'),
    cuit: texto('cuit'),
    condicion_iva: texto('condicionIva'),
    email_facturacion: texto('emailFacturacion'),
    contacto: texto('contacto'),
    direccion_fiscal: texto('direccionFiscal'),
    rubro: texto('rubro'),
    tamano: Number.isFinite(tamano) && tamano > 0 ? Math.round(tamano) : null,
    notas: texto('notas'),
  };

  // Con id se está editando un cliente que ya existe; sin id, es un alta. En
  // los dos casos `token_portal` queda afuera del cuerpo: lo pone la base al
  // insertar, y mandarlo en una edición le cambiaría el enlace a quien ya lo
  // tiene en la mano.
  const id = String(datos.id ?? '').trim();
  const res = id
    ? await fetch(`${url}/rest/v1/empresas?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(fila),
        cache: 'no-store',
      })
    : // El slug es único: si el cliente ya está, se completan sus datos en vez
      // de fallar con un choque que no le dice nada a quien lo está cargando.
      await fetch(`${url}/rest/v1/empresas?on_conflict=slug`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(fila),
        cache: 'no-store',
      });

  if (!res.ok) {
    console.error('clientes:', res.status, await res.text());
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }

  const creado = (await res.json())[0];
  const yo = await quienSoy();
  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'empresa',
    recursoId: creado?.id ?? null,
    detalle: { nombre, alta: !id },
  });

  revalidateTag(CACHE_CLIENTES);

    return NextResponse.json({ ok: true, id: creado?.id });
}

/**
 * Borra un cliente.
 *
 * Solo si no tiene nada colgando. Un cliente con pedidos o cotizaciones no se
 * borra en cascada: dejaría evaluaciones de personas sin empresa, que es peor
 * que tener un cliente de más en la lista. La pantalla dice qué hay que sacar
 * primero en vez de negarse sin explicar.
 */
export async function DELETE(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Falta la configuración de Supabase.' }, { status: 500 });
  }

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 });
  }

  const cabeceras = { apikey: key, Authorization: `Bearer ${key}` };
  const mirar = async (tabla: string) => {
    const r = await fetch(
      `${url}/rest/v1/${tabla}?select=id&empresa_id=eq.${id}&limit=1`,
      { headers: cabeceras, cache: 'no-store' }
    );
    return r.ok ? ((await r.json()) as unknown[]).length : 0;
  };
  const [conPedidos, conCotizaciones] = await Promise.all([
    mirar('pedidos'),
    mirar('cotizaciones'),
  ]);
  if (conPedidos || conCotizaciones) {
    const que = [conPedidos && 'pedidos', conCotizaciones && 'cotizaciones']
      .filter(Boolean)
      .join(' y ');
    return NextResponse.json(
      { error: `No se puede borrar: el cliente todavía tiene ${que}.` },
      { status: 409 }
    );
  }

  const res = await fetch(`${url}/rest/v1/empresas?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...cabeceras, Prefer: 'return=representation' },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('clientes borrar:', res.status, await res.text());
    return NextResponse.json({ error: 'No se pudo borrar.' }, { status: 500 });
  }
  const borrado = (await res.json())[0];
  if (!borrado) return NextResponse.json({ error: 'Ese cliente no existe.' }, { status: 404 });

  const yo = await quienSoy();
  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'empresa',
    recursoId: id,
    detalle: { nombre: borrado.nombre, borrado: true },
  });

  revalidateTag(CACHE_CLIENTES);
  return NextResponse.json({ ok: true });
}
