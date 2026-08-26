import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_CLIENTES } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';

/**
 * Alta, edición y baja de un contacto del cliente.
 *
 * **La baja no borra**: marca inactivo. El contacto al que se le mandó una
 * factura el año pasado tiene que seguir existiendo para que ese comprobante
 * siga diciendo a quién se le mandó.
 *
 * Un contacto sin nombre no existe; el resto puede faltar. El mail no es
 * obligatorio todavía porque los ocho que venían del campo viejo no lo tienen,
 * y exigirlo dejaría la ficha sin poder guardarse hasta ir a buscarlos.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    return NextResponse.json({ error: 'Falta la configuración.' }, { status: 500 });
  }

  const datos = await req.json().catch(() => null);
  if (!datos) return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });

  const id = String(datos.id ?? '').trim();
  const empresaId = String(datos.empresaId ?? '').trim();
  const texto = (k: string) => {
    const v = String(datos[k] ?? '').trim();
    return v || null;
  };

  const cabeceras = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const yo = await quienSoy();

  // Dar de baja: se marca inactivo y se conserva.
  if (id && datos.baja) {
    if (!UUID.test(id)) return NextResponse.json({ error: 'Contacto inválido.' }, { status: 400 });
    const res = await fetch(`${url}/rest/v1/contactos?id=eq.${id}`, {
      method: 'PATCH',
      headers: cabeceras,
      body: JSON.stringify({ activo: false }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Supabase ${res.status}.` }, { status: 400 });
    }
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'contacto',
      recursoId: id,
      detalle: { baja: true },
    });
    revalidateTag(CACHE_CLIENTES);
    return NextResponse.json({ ok: true });
  }

  const nombre = String(datos.nombre ?? '').trim();
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });

  const fila = {
    nombre,
    cargo: texto('cargo'),
    email: texto('email'),
    telefono: texto('telefono'),
    pide: Boolean(datos.pide),
    facturacion: Boolean(datos.facturacion),
  };

  // Ni pide ni factura es un contacto que no hace nada: no se guarda así.
  if (!fila.pide && !fila.facturacion) {
    return NextResponse.json(
      { error: 'Marcá si pide evaluaciones, si recibe la factura, o las dos.' },
      { status: 400 }
    );
  }

  const res = id
    ? await fetch(`${url}/rest/v1/contactos?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: cabeceras,
        body: JSON.stringify(fila),
        cache: 'no-store',
      })
    : await fetch(`${url}/rest/v1/contactos`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify({ ...fila, empresa_id: empresaId }),
        cache: 'no-store',
      });

  if (!res.ok) {
    return NextResponse.json({ error: `Supabase ${res.status}.` }, { status: 400 });
  }
  const guardado = (await res.json().catch(() => []))[0];

  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'contacto',
    recursoId: guardado?.id ?? id,
    detalle: { nombre, alta: !id },
  });
  revalidateTag(CACHE_CLIENTES);
  return NextResponse.json({ ok: true, id: guardado?.id ?? id });
}
