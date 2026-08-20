import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { esCampoEditable, guardarCampos } from '@/lib/psicotecnicos';
import { anotarAcceso } from '@/lib/accesos';

export const runtime = 'nodejs';

/**
 * Guarda un cambio del pipeline.
 *
 * Comprueba la sesión acá además del middleware, porque el middleware filtra
 * por host y esta ruta existe en todos. Cuando no hay puerta configurada,
 * tampoco la hay acá: si la hubiera, guardar desde localhost no funcionaría.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  let datos: any;
  try {
    datos = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'Cuerpo inválido.' }, { status: 400 });
  }

  const { id, campo, valor } = datos ?? {};
  if (typeof id !== 'string') {
    return NextResponse.json({ ok: false, motivo: 'Identificador inválido.' }, { status: 400 });
  }

  // Se acepta un campo suelto o varios juntos: hay cambios que son uno solo,
  // como asignar una evaluadora, que además saca a la persona de Sin asignar.
  const cambios: Record<string, string | boolean | null> =
    datos.cambios && typeof datos.cambios === 'object'
      ? datos.cambios
      : { [campo]: valor };

  for (const [c, v] of Object.entries(cambios)) {
    if (!esCampoEditable(c)) {
      return NextResponse.json({ ok: false, motivo: 'Campo no editable.' }, { status: 400 });
    }
    if (v !== null && typeof v !== 'string' && typeof v !== 'boolean') {
      return NextResponse.json({ ok: false, motivo: 'Valor inválido.' }, { status: 400 });
    }
  }

  const r = await guardarCampos(id, cambios);
  if (!r.ok) return NextResponse.json(r, { status: 400 });

  await anotarAcceso({
    accion: 'escritura',
    recurso: 'evaluacion',
    detalle: { fila: id, cambios },
  });

  revalidateTag(CACHE_PSICOTECNICOS);

    return NextResponse.json({ ok: true });
}
