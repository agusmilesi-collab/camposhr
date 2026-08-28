import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_CLIENTES, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { ABIERTO, CAMPOS_PEDIDO, ESTADOS_PEDIDO, type EstadoPedido } from '@/lib/pedido-campos';

export const runtime = 'nodejs';

/**
 * Guarda un cambio en un pedido.
 *
 * Los campos editables están declarados en `CAMPOS_PEDIDO` y no se acepta
 * ninguno fuera de esa lista: la ruta recibe el nombre de la columna desde el
 * navegador y sin la lista cualquiera podría escribir `empresa_id`.
 *
 * `bateria_id` y `con_benziger` se aceptan aparte porque no son texto: uno es
 * una referencia y el otro un booleano.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }

  const datos = await req.json().catch(() => null);
  const id = datos?.id;
  const campo = datos?.campo;
  const valor = datos?.valor as unknown;

  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Pedido inválido.' }, { status: 400 });
  }

  let fila: Record<string, unknown>;

  if (campo === 'bateria_id') {
    if (valor !== null && !(typeof valor === 'string' && UUID.test(valor))) {
      return NextResponse.json({ ok: false, motivo: 'Batería inválida.' }, { status: 400 });
    }
    fila = { bateria_id: valor };
  } else if (campo === 'solicitante_id') {
    // Quién pidió la búsqueda, de los contactos de esa empresa. Null es "no se
    // sabe": los pedidos que vinieron de Airtable no lo traen.
    if (valor !== null && !(typeof valor === 'string' && UUID.test(valor))) {
      return NextResponse.json({ ok: false, motivo: 'Contacto inválido.' }, { status: 400 });
    }
    fila = { solicitante_id: valor };
  } else if (campo === 'exigencia_id') {
    // Null es "la predeterminada", y por eso se guarda null y no la
    // predeterminada copiada: si mañana cambia cuál es, este pedido la sigue.
    if (valor !== null && !(typeof valor === 'string' && UUID.test(valor))) {
      return NextResponse.json({ ok: false, motivo: 'Exigencia inválida.' }, { status: 400 });
    }
    fila = { exigencia_id: valor };
  } else if (campo === 'time_span_dias' || campo === 'estrato_puesto') {
    /* Los dos números del nivel de trabajo. El time-span va en días, del día a
       los cincuenta años; el estrato, del I al VII. Null los borra. */
    const tope = campo === 'time_span_dias' ? 40_000 : 7;
    const n = typeof valor === 'number' && Number.isInteger(valor) && valor >= 1 && valor <= tope
      ? valor
      : null;
    if (valor !== null && n === null) {
      return NextResponse.json({ ok: false, motivo: 'Valor fuera de rango.' }, { status: 400 });
    }
    fila = { [campo]: n };
  } else if (campo === 'complejidad') {
    /* Las cinco preguntas: un objeto con claves del 1 al 5 y sí o no. Se
       comprueba entero, porque de acá sale el estrato. */
    if (valor !== null) {
      const ok =
        valor !== null &&
        typeof valor === 'object' &&
        !Array.isArray(valor) &&
        Object.entries(valor as Record<string, unknown>).every(
          ([k, v]) => /^[1-5]$/.test(k) && typeof v === 'boolean'
        );
      if (!ok) {
        return NextResponse.json({ ok: false, motivo: 'Respuestas inválidas.' }, { status: 400 });
      }
    }
    fila = { complejidad: valor };
  } else if (campo === 'con_benziger') {
    if (typeof valor !== 'boolean') {
      return NextResponse.json({ ok: false, motivo: 'Valor inválido.' }, { status: 400 });
    }
    fila = { con_benziger: valor };
  } else if (typeof campo === 'string' && CAMPOS_PEDIDO.includes(campo)) {
    if (valor !== null && typeof valor !== 'string') {
      return NextResponse.json({ ok: false, motivo: 'Valor inválido.' }, { status: 400 });
    }
    if (campo === 'estado' && !ESTADOS_PEDIDO.includes(valor as EstadoPedido)) {
      return NextResponse.json({ ok: false, motivo: 'Estado inválido.' }, { status: 400 });
    }
    if (campo === 'puesto' && !String(valor ?? '').trim()) {
      return NextResponse.json({ ok: false, motivo: 'El puesto no puede quedar vacío.' }, { status: 400 });
    }
    fila = { [campo]: valor === '' ? null : valor };
    // Reabrir a mano deja fecha, igual que reabrir cargando un candidato: la
    // solicitud que queda en curso es la de hoy y no la del día en que se pidió
    // la primera tanda. Ver `pedido_estado_al_dia` en la base.
    if (campo === 'estado' && valor === ABIERTO) {
      fila.reabierto_el = new Date().toISOString().slice(0, 10);
    }
  } else {
    return NextResponse.json({ ok: false, motivo: 'Campo no editable.' }, { status: 400 });
  }

  const res = await fetch(`${url}/rest/v1/pedidos?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fila),
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
    recurso: 'pedido',
    recursoId: id,
    detalle: fila,
  });

  revalidateTag(CACHE_PSICOTECNICOS);
  revalidateTag(CACHE_CLIENTES);

  return NextResponse.json({ ok: true });
}

/**
 * Borra un pedido.
 *
 * Solo si no tiene ninguna evaluación colgando. Un pedido con candidatos no se
 * borra en cascada: dejaría evaluaciones de personas reales sin saber a qué
 * búsqueda entraron, y esa es la única forma de reconstruir qué se le tomó y
 * por qué. Para esos está cerrarlo, que lo saca del selector de alta sin
 * perder nada.
 *
 * Borrar es para lo que nunca debió existir: el pedido de prueba, el que se
 * cargó dos veces, el que se abrió con el cliente equivocado. Cerrarlo dejaría
 * basura en la lista de cerrados para siempre.
 */
export async function DELETE(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Pedido inválido.' }, { status: 400 });
  }

  const cabeceras = { apikey: key, Authorization: `Bearer ${key}` };
  const cuantas = await fetch(
    `${url}/rest/v1/evaluaciones?select=id&pedido_id=eq.${id}`,
    { headers: cabeceras, cache: 'no-store' }
  );
  const evaluaciones = cuantas.ok ? ((await cuantas.json()) as unknown[]).length : 0;
  if (evaluaciones > 0) {
    return NextResponse.json(
      {
        ok: false,
        motivo:
          evaluaciones === 1
            ? 'Tiene un candidato cargado. Para sacarlo de la lista, cerralo.'
            : `Tiene ${evaluaciones} candidatos cargados. Para sacarlo de la lista, cerralo.`,
      },
      { status: 409 }
    );
  }

  const res = await fetch(`${url}/rest/v1/pedidos?id=eq.${id}`, {
    method: 'DELETE',
    headers: { ...cabeceras, Prefer: 'return=representation' },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('pedidos borrar:', res.status, await res.text());
    return NextResponse.json({ ok: false, motivo: 'No se pudo borrar.' }, { status: 500 });
  }
  const borrado = (await res.json())[0];
  if (!borrado) {
    return NextResponse.json({ ok: false, motivo: 'Ese pedido no existe.' }, { status: 404 });
  }

  await anotarAcceso({
    accion: 'escritura',
    recurso: 'pedido',
    recursoId: id,
    detalle: { borrado: borrado.puesto },
  });

  revalidateTag(CACHE_PSICOTECNICOS);
  revalidateTag(CACHE_CLIENTES);

  return NextResponse.json({ ok: true });
}
