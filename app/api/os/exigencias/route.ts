import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';
import { LARGO_NOMBRE, cortesValidos } from '@/lib/exigencia';

export const runtime = 'nodejs';

/**
 * Alta, edición, borrado y cambio de predeterminada de un perfil de exigencia.
 *
 * **La exigencia no cambia ningún puntaje**, solo dónde corta cada banda: un
 * mismo 62 puede leerse Adecuado con una y Bajo con otra. Por eso se puede
 * mover con informes ya emitidos sin que nada se recalcule solo; los que están
 * abiertos se releen con la exigencia que tengan asignada.
 *
 * La predeterminada no se puede borrar ni dejar en cero: es la que rige cuando
 * el pedido no pide otra, así que siempre tiene que haber una.
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
  const cabeceras = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const yo = await quienSoy();
  const listo = async (accion: string, detalle: Record<string, unknown>) => {
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'exigencia',
      recursoId: id || null,
      detalle: { accion, ...detalle },
    });
    revalidateTag(CACHE_PSICOTECNICOS);
    return NextResponse.json({ ok: true });
  };

  if (id && !UUID.test(id)) {
    return NextResponse.json({ error: 'Exigencia inválida.' }, { status: 400 });
  }

  // Pasar a predeterminada: se apaga la que estaba, porque el índice único no
  // deja dos, y se prende la nueva.
  if (id && datos.predeterminar) {
    const apagar = await fetch(`${url}/rest/v1/exigencias?predeterminada=is.true`, {
      method: 'PATCH',
      headers: cabeceras,
      body: JSON.stringify({ predeterminada: false }),
      cache: 'no-store',
    });
    if (!apagar.ok) {
      return NextResponse.json({ error: `Supabase ${apagar.status}.` }, { status: 400 });
    }
    const res = await fetch(`${url}/rest/v1/exigencias?id=eq.${id}`, {
      method: 'PATCH',
      headers: cabeceras,
      body: JSON.stringify({ predeterminada: true }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Supabase ${res.status}.` }, { status: 400 });
    }
    return listo('predeterminar', {});
  }

  // Borrar: la predeterminada no, y tampoco una que algún pedido esté usando.
  if (id && datos.borrar) {
    const suya = await fetch(
      `${url}/rest/v1/exigencias?id=eq.${id}&select=predeterminada,nombre`,
      { headers: cabeceras, cache: 'no-store' }
    );
    const fila = (await suya.json().catch(() => []))[0];
    if (!fila) return NextResponse.json({ error: 'No existe.' }, { status: 404 });
    if (fila.predeterminada) {
      return NextResponse.json(
        { error: 'Es la predeterminada. Poné otra en su lugar antes de borrarla.' },
        { status: 400 }
      );
    }
    for (const tabla of ['pedidos', 'evaluaciones']) {
      const uso = await fetch(
        `${url}/rest/v1/${tabla}?exigencia_id=eq.${id}&select=id&limit=1`,
        { headers: cabeceras, cache: 'no-store' }
      );
      if (((await uso.json().catch(() => [])) as unknown[]).length > 0) {
        return NextResponse.json(
          {
            error:
              tabla === 'pedidos'
                ? 'Hay pedidos que la usan. Cambiáselas antes de borrarla.'
                : 'Hay candidatos que la usan. Cambiáselas antes de borrarla.',
          },
          { status: 400 }
        );
      }
    }
    const res = await fetch(`${url}/rest/v1/exigencias?id=eq.${id}`, {
      method: 'DELETE',
      headers: cabeceras,
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Supabase ${res.status}.` }, { status: 400 });
    }
    return listo('borrar', { nombre: fila.nombre });
  }

  const nombre = String(datos.nombre ?? '').trim();
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  if (nombre.length > LARGO_NOMBRE) {
    return NextResponse.json(
      { error: `El nombre no puede pasar de ${LARGO_NOMBRE} caracteres.` },
      { status: 400 }
    );
  }

  const entero = (k: string) => Math.round(Number(datos[k]));
  const cortes = {
    sobresaliente: entero('sobresaliente'),
    alto: entero('alto'),
    adecuado: entero('adecuado'),
  };
  const mal = cortesValidos(cortes);
  if (mal) return NextResponse.json({ error: mal }, { status: 400 });

  const notas = String(datos.notas ?? '').trim() || null;
  const fila = { nombre, ...cortes, notas };

  const res = id
    ? await fetch(`${url}/rest/v1/exigencias?id=eq.${id}`, {
        method: 'PATCH',
        headers: cabeceras,
        body: JSON.stringify(fila),
        cache: 'no-store',
      })
    : await fetch(`${url}/rest/v1/exigencias`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify(fila),
        cache: 'no-store',
      });

  if (!res.ok) {
    const cuerpo = await res.text().catch(() => '');
    return NextResponse.json(
      {
        error: cuerpo.includes('exigencias_nombre_key')
          ? 'Ya hay una exigencia con ese nombre.'
          : `Supabase ${res.status}.`,
      },
      { status: 400 }
    );
  }
  const guardada = (await res.json().catch(() => []))[0];
  return listo(id ? 'editar' : 'crear', { nombre, id: guardada?.id ?? id });
}
