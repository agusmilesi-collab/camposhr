import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import {
  corregir,
  seAcabo,
  segundosRestantes,
  sesionPorToken,
  type Sesion,
} from '@/lib/raven-test';
import { calcularRaven, OPCIONES, RAVEN_MAXIMO } from '@/lib/raven';
import { anotarAcceso } from '@/lib/accesos';
import { siEstaTodoTomado } from '@/lib/entrevista-completa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo que hace el candidato mientras rinde.
 *
 * Sin sesión del OS: quien entra es la persona evaluada, con su enlace. El
 * token es la credencial y no hay ninguna otra.
 *
 * Cuatro cosas: empezar, que arranca el reloj; responder una lámina; preguntar
 * cuánto queda; y terminar, que corrige y cierra. Las cuatro miden el tiempo
 * contra el momento en que se abrió la primera lámina, que lo fijó el servidor.
 */

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

async function patch(id: string, campos: Record<string, unknown>) {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/raven_sesiones?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(campos),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

/** Corrige, guarda el puntaje y cierra la sesión. */
async function cerrar(s: Sesion, cierre: 'entregado' | 'tiempo') {
  const aciertos = corregir(s.respuestas);
  const terminado = new Date();
  await patch(s.id, { terminado_at: terminado.toISOString(), cierre });

  // Cuánto tardó, contado desde que abrió la primera lámina. Con el tiempo
  // agotado son los 45 minutos enteros; entregando antes, lo que haya usado.
  const duracion = s.iniciado_at
    ? Math.max(0, Math.round((terminado.getTime() - new Date(s.iniciado_at).getTime()) / 1000))
    : null;

  // Sin la clave cargada no se corrige: dejar un cero sería un resultado, y lo
  // que hay es una corrección pendiente.
  if (aciertos !== null) {
    const r = calcularRaven(aciertos);
    const { url, key } = config();
    await fetch(`${url}/rest/v1/raven`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        evaluacion_id: s.evaluacion_id,
        raw: r?.raw ?? null,
        percentil: r?.percentil ?? null,
        desvios: r?.desvios ?? null,
        resultado: r?.resultado ?? null,
        origen: 'test',
        duracion_segundos: duracion,
        actualizado_at: new Date().toISOString(),
      }),
      cache: 'no-store',
    });
    // El Raven suele ser el último de la batería: si con esto quedó tomado
    // todo, la evaluación pasa sola a Por analizar.
    await siEstaTodoTomado(s.evaluacion_id);
    revalidateTag(CACHE_PSICOTECNICOS);
  }

  await anotarAcceso({
    quien: 'candidato',
    accion: 'escritura',
    recurso: 'raven_sesion',
    recursoId: s.evaluacion_id,
    detalle: { cierre, respondidas: Object.keys(s.respuestas).length, aciertos },
  });
}

export async function POST(req: Request) {
  const datos = await req.json().catch(() => null);
  const token = typeof datos?.token === 'string' ? datos.token : '';
  const accion = datos?.accion;

  const s = await sesionPorToken(token);
  if (!s) {
    return NextResponse.json({ ok: false, motivo: 'Ese enlace no existe.' }, { status: 404 });
  }
  if (s.terminado_at) {
    return NextResponse.json({ ok: false, motivo: 'Este test ya se entregó.' }, { status: 409 });
  }

  try {
    if (accion === 'empezar') {
      // El reloj arranca una sola vez: volver a entrar no lo reinicia.
      if (!s.iniciado_at) await patch(s.id, { iniciado_at: new Date().toISOString() });
      const iniciado = s.iniciado_at ?? new Date().toISOString();
      return NextResponse.json({ ok: true, restan: segundosRestantes(iniciado) });
    }

    if (accion === 'responder') {
      if (seAcabo(s)) {
        await cerrar(s, 'tiempo');
        return NextResponse.json({ ok: false, motivo: 'Se terminó el tiempo.' }, { status: 409 });
      }
      const lamina = Number(datos?.lamina);
      const opcion = datos?.opcion === null ? null : Number(datos?.opcion);
      if (!Number.isInteger(lamina) || lamina < 1 || lamina > RAVEN_MAXIMO) {
        return NextResponse.json({ ok: false, motivo: 'Lámina inválida.' }, { status: 400 });
      }
      if (opcion !== null && (!Number.isInteger(opcion) || opcion < 1 || opcion > OPCIONES)) {
        return NextResponse.json({ ok: false, motivo: 'Opción inválida.' }, { status: 400 });
      }

      const respuestas = { ...s.respuestas };
      // Volver a tocar la opción elegida la borra: quedarse sin respuesta es
      // una respuesta posible.
      if (opcion === null) delete respuestas[String(lamina)];
      else respuestas[String(lamina)] = opcion;

      await patch(s.id, { respuestas });
      return NextResponse.json({ ok: true, restan: segundosRestantes(s.iniciado_at) });
    }

    if (accion === 'reloj') {
      // La pantalla vuelve a preguntar cada vez que la pestaña se pone al
      // frente: mientras estuvo atrás su reloj pudo quedarse quieto, y el que
      // decide si el test sigue abierto es este.
      if (seAcabo(s)) {
        await cerrar(s, 'tiempo');
        return NextResponse.json({ ok: false, motivo: 'Se terminó el tiempo.' }, { status: 409 });
      }
      return NextResponse.json({ ok: true, restan: segundosRestantes(s.iniciado_at) });
    }

    if (accion === 'terminar') {
      await cerrar(s, seAcabo(s) ? 'tiempo' : 'entregado');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, motivo: 'Acción desconocida.' }, { status: 400 });
  } catch (e) {
    console.error('raven:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo guardar.' }, { status: 500 });
  }
}
