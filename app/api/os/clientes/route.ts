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

  // El slug es único: si el cliente ya está, se completan sus datos en vez de
  // fallar con un choque que no le dice nada a quien lo está cargando.
  const res = await fetch(`${url}/rest/v1/empresas?on_conflict=slug`, {
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
    detalle: { nombre, alta: true },
  });

  revalidateTag(CACHE_CLIENTES);

    return NextResponse.json({ ok: true, id: creado?.id });
}
