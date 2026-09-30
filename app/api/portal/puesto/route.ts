import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_CLIENTES, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { select } from '@/lib/supabase';
import { empresaDelToken } from '@/lib/portal-supabase';
import { DEL_JEFE, DEL_PUESTO } from '@/lib/pedido-campos';
import {
  ESTRATOS,
  PREGUNTAS,
  UNIDADES,
  aDias,
  estratoDeTimeSpan,
  estratoPorNumero,
  nivelDeRespuestas,
  type Unidad,
} from '@/lib/potencial';

export const runtime = 'nodejs';

/**
 * El perfil del puesto y su alcance, contestados por el cliente.
 *
 * Es una dirección abierta con el token de su portal, así que todo se valida
 * acá: el pedido tiene que ser de la empresa del token, cada escala solo
 * acepta sus tres opciones, el plazo tiene que dar un número de días y las
 * preguntas tienen que existir.
 *
 * El estrato del puesto sale igual que en el formulario de pedido y en la
 * ficha: si el plazo y las preguntas coinciden, o si vino uno solo, queda
 * guardado; si se contradicen queda sin definir y lo resuelve la evaluadora.
 */
export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Falta la configuración.' }, { status: 500 });
  }

  const datos = await req.json().catch(() => null);
  if (!datos || typeof datos !== 'object') {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const empresa = await empresaDelToken(String(datos.token ?? ''));
  if (!empresa) return NextResponse.json({ error: 'Enlace inválido.' }, { status: 404 });

  const pedidoId = String(datos.pedidoId ?? '');
  const suyo = (
    await select<{ id: string }>(
      'pedidos',
      `select=id&id=eq.${encodeURIComponent(pedidoId)}&empresa_id=eq.${empresa.id}&limit=1`
    ).catch(() => [])
  )[0];
  if (!suyo) return NextResponse.json({ error: 'Esa búsqueda no existe.' }, { status: 404 });

  /* Las nueve escalas: una opción válida se guarda, vacío la borra y
     cualquier otra cosa se ignora. */
  const fila: Record<string, unknown> = {};
  const perfil = (datos.perfil ?? {}) as Record<string, unknown>;
  for (const p of [...DEL_PUESTO, ...DEL_JEFE]) {
    if (!(p.campo in perfil)) continue;
    const v = perfil[p.campo];
    if (v === '' || v === null) fila[p.campo] = null;
    else if (typeof v === 'string' && p.opciones.includes(v)) fila[p.campo] = v;
  }

  /* El alcance, solo si vino: el formulario lo manda cuando la batería lleva
     análisis de potencial. */
  if ('spanCantidad' in datos || 'complejidad' in datos) {
    const cantidad = Number(String(datos.spanCantidad ?? '').replace(',', '.'));
    const unidad = String(datos.spanUnidad ?? '');
    const timeSpanDias =
      Number.isFinite(cantidad) && cantidad > 0 && UNIDADES.some((u) => u.clave === unidad)
        ? aDias(cantidad, unidad as Unidad)
        : null;

    const complejidad: Record<string, boolean> = {};
    const llegadas = (datos.complejidad ?? {}) as Record<string, unknown>;
    for (const pr of PREGUNTAS) {
      const v = llegadas[String(pr.estrato)];
      if (typeof v === 'boolean') complejidad[String(pr.estrato)] = v;
    }

    const porPreguntas = estratoPorNumero(
      nivelDeRespuestas(
        Object.entries(complejidad)
          .filter(([, si]) => si)
          .map(([n]) => Number(n))
      ) ?? 0
    );
    const porTiempo = timeSpanDias !== null ? estratoDeTimeSpan(timeSpanDias) : null;
    const unico =
      porTiempo && porPreguntas
        ? porTiempo.romano === porPreguntas.romano
          ? porTiempo
          : null
        : (porTiempo ?? porPreguntas);

    fila.time_span_dias = timeSpanDias;
    fila.complejidad = Object.keys(complejidad).length > 0 ? complejidad : null;
    fila.estrato_puesto = unico ? ESTRATOS.findIndex((e) => e.romano === unico.romano) + 1 : null;
  }

  if (Object.keys(fila).length === 0) return NextResponse.json({ ok: true });

  const res = await fetch(`${url}/rest/v1/pedidos?id=eq.${encodeURIComponent(suyo.id)}`, {
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
    console.error('portal puesto:', res.status, await res.text());
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }

  revalidateTag(CACHE_PSICOTECNICOS);
  revalidateTag(CACHE_CLIENTES);
  return NextResponse.json({ ok: true });
}
