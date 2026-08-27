import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_CLIENTES, CACHE_COMERCIAL } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { ESTADOS, TIPOS_COSTO } from '@/lib/cotizaciones';
import { esObjecion } from '@/lib/comercial-tipos';
import { slugDeEmpresa } from '@/lib/empresa-slug';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

async function escribir(camino: string, metodo: string, cuerpo: unknown) {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${camino}`, {
    method: metodo,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: metodo === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: JSON.stringify(cuerpo),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return metodo === 'POST' ? (await res.json())[0] : null;
}

async function leer<T>(camino: string): Promise<T[]> {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${camino}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * El cliente de la oportunidad, como fila de Clientes.
 *
 * Una oportunidad guardaba el nombre escrito y nada más, así que un cliente que
 * nacía en el embudo no aparecía en Clientes: no tenía dónde cargarle el CUIT ni
 * de dónde salirle el enlace del portal. Acá se resuelve contra `empresas`: si
 * se eligió uno de la lista es ese, y si el nombre es nuevo se da de alta.
 *
 * Se busca por el slug y no por el nombre tal cual, que es la misma clave con la
 * que la base impide dos veces el mismo cliente: "Pla SA" y "pla sa" son uno.
 */
async function empresaDe(
  nombre: string,
  empresaId?: unknown
): Promise<{ id: string; nombre: string }> {
  if (UUID.test(String(empresaId ?? ''))) {
    const [ya] = await leer<{ id: string; nombre: string }>(
      `empresas?select=id,nombre&id=eq.${empresaId}&limit=1`
    );
    if (ya) return ya;
  }
  const clave = slugDeEmpresa(nombre);
  const [ya] = await leer<{ id: string; nombre: string }>(
    `empresas?select=id,nombre&slug=eq.${encodeURIComponent(clave)}&limit=1`
  );
  // Si ya está, no se le toca nada: puede estar inactivo a propósito, y una
  // oportunidad nueva no es motivo para reactivarlo por su cuenta.
  if (ya) return ya;
  return escribir('empresas', 'POST', { nombre, slug: clave, activa: true });
}

/**
 * Movimientos del embudo y carga de costos.
 *
 * Son cuatro acciones sobre dos tablas, así que van por una sola puerta con un
 * campo que dice cuál: partirlo en cuatro rutas sería repetir la sesión, la
 * validación y el registro cuatro veces.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }

  let datos: any;
  try {
    datos = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const yo = await quienSoy();

  try {
    switch (datos?.accion) {
      case 'estado': {
        const { id, estado, motivo } = datos;
        if (!UUID.test(id ?? '') || !ESTADOS.includes(estado)) {
          return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
        }
        // La objeción solo vale en una perdida, y solo si es una de las cinco:
        // el sentido de tenerlas es poder contar cuál se repite.
        const objecion = estado === 'Perdida' && esObjecion(datos.objecion) ? datos.objecion : null;
        if (estado === 'Perdida' && datos.objecion && !objecion) {
          return NextResponse.json({ error: 'Esa objeción no existe.' }, { status: 400 });
        }
        await escribir(`cotizaciones?id=eq.${id}`, 'PATCH', {
          estado,
          motivo: estado === 'Perdida' ? motivo ?? null : null,
          objecion,
        });
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'cotizacion',
          recursoId: id,
          detalle: { estado, motivo: motivo ?? null, objecion },
        });
        revalidateTag(CACHE_CLIENTES);
        revalidateTag(CACHE_COMERCIAL);
                return NextResponse.json({ ok: true });
      }

      case 'nueva': {
        const cliente = String(datos.cliente ?? '').trim();
        const concepto = String(datos.concepto ?? '').trim();
        const importe = Number(datos.importe);
        if (!cliente || !concepto) {
          return NextResponse.json({ error: 'Faltan el cliente y el concepto.' }, { status: 400 });
        }
        if (!Number.isFinite(importe) || importe < 0) {
          return NextResponse.json({ error: 'El importe no es un número.' }, { status: 400 });
        }
        // El cliente pasa a ser una fila de Clientes: el nombre queda escrito
        // igual, para que la tarjeta diga lo mismo aunque la empresa se
        // renombre después.
        const empresa = await empresaDe(cliente, datos.empresaId);
        const fila = await escribir('cotizaciones', 'POST', {
          cliente: empresa.nombre,
          empresa_id: empresa.id,
          concepto,
          importe,
          estado: ESTADOS.includes(datos.estado) ? datos.estado : 'Lead',
          fecha: datos.fecha || new Date().toISOString().slice(0, 10),
          nota: String(datos.nota ?? '').trim() || null,
        });
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'cotizacion',
          recursoId: fila.id,
          detalle: { alta: true, cliente: empresa.nombre, empresaId: empresa.id, importe },
        });
        revalidateTag(CACHE_CLIENTES);
        revalidateTag(CACHE_COMERCIAL);
                return NextResponse.json({ ok: true, id: fila.id });
      }

      /**
       * Editar lo que dice la tarjeta.
       *
       * El estado no entra acá: se mueve arrastrando de columna, que es lo que
       * hace esa pantalla. Mezclarlo daría dos formas de cambiar lo mismo.
       */
      case 'editar': {
        const { id } = datos;
        if (!UUID.test(id ?? '')) {
          return NextResponse.json({ error: 'Falta la oportunidad.' }, { status: 400 });
        }
        const cliente = String(datos.cliente ?? '').trim();
        const concepto = String(datos.concepto ?? '').trim();
        const importe = Number(datos.importe);
        if (!cliente || !concepto) {
          return NextResponse.json({ error: 'Faltan el cliente y el concepto.' }, { status: 400 });
        }
        if (concepto.length > 200) {
          return NextResponse.json({ error: 'El concepto es muy largo.' }, { status: 400 });
        }
        if (!Number.isFinite(importe) || importe < 0) {
          return NextResponse.json({ error: 'El importe no es un número.' }, { status: 400 });
        }
        const fecha = String(datos.fecha ?? '');
        if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          return NextResponse.json({ error: 'La fecha no es válida.' }, { status: 400 });
        }
        const empresa = await empresaDe(cliente, datos.empresaId);
        await escribir(`cotizaciones?id=eq.${id}`, 'PATCH', {
          cliente: empresa.nombre,
          empresa_id: empresa.id,
          concepto,
          importe,
          ...(fecha ? { fecha } : {}),
          nota: String(datos.nota ?? '').trim() || null,
        });
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'cotizacion',
          recursoId: id,
          detalle: { edicion: true, cliente: empresa.nombre, concepto, importe },
        });
        revalidateTag(CACHE_CLIENTES);
        revalidateTag(CACHE_COMERCIAL);
        return NextResponse.json({ ok: true });
      }

      case 'costo': {
        const { cotizacionId, concepto, tipo } = datos;
        const importe = Number(datos.importe);
        if (!UUID.test(cotizacionId ?? '')) {
          return NextResponse.json({ error: 'Falta la oportunidad.' }, { status: 400 });
        }
        if (!String(concepto ?? '').trim()) {
          return NextResponse.json({ error: 'Falta el concepto del costo.' }, { status: 400 });
        }
        if (!Number.isFinite(importe) || importe < 0) {
          return NextResponse.json({ error: 'El importe no es un número.' }, { status: 400 });
        }
        const fila = await escribir('costos', 'POST', {
          cotizacion_id: cotizacionId,
          concepto: String(concepto).trim(),
          importe,
          tipo: TIPOS_COSTO.includes(tipo) ? tipo : 'Directo',
          fecha: datos.fecha || new Date().toISOString().slice(0, 10),
        });
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'costo',
          recursoId: fila.id,
          detalle: { cotizacion_id: cotizacionId, importe },
        });
        revalidateTag(CACHE_CLIENTES);
        revalidateTag(CACHE_COMERCIAL);
                return NextResponse.json({ ok: true, id: fila.id });
      }

      case 'borrarCosto': {
        const { id } = datos;
        if (!UUID.test(id ?? '')) {
          return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
        }
        await escribir(`costos?id=eq.${id}`, 'DELETE', undefined);
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'costo',
          recursoId: id,
          detalle: { borrado: true },
        });
        revalidateTag(CACHE_CLIENTES);
        revalidateTag(CACHE_COMERCIAL);
                return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
    }
  } catch (e) {
    console.error('comercial:', e);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
}
