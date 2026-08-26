import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { select } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * En qué anda el Raven de una evaluación.
 *
 * Es la consulta más chica posible, para preguntarla cada quince segundos
 * mientras el candidato responde: la hoja de la entrevista trae la evaluación
 * entera y volver a pedirla para enterarse de que alguien abrió una lámina
 * sería traer todo el pedido, la batería y el discursivo por un dato de dos
 * campos.
 *
 * Lo único que se devuelve es el estado. Quien pregunta compara contra el que
 * está mostrando y, si cambió, pide la pantalla de nuevo: el sondeo es barato y
 * el redibujo pasa una vez, cuando efectivamente hay algo nuevo.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }

  const id = new URL(req.url).searchParams.get('evaluacion') ?? '';
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Evaluación inválida.' }, { status: 400 });
  }

  try {
    const sesiones = await select<{ iniciado_at: string | null; terminado_at: string | null }>(
      'raven_sesiones',
      `select=iniciado_at,terminado_at&evaluacion_id=eq.${id}&order=creado_at.desc&limit=1`
    );
    const s = sesiones[0];
    const estado = !s
      ? 'sin enlace'
      : s.terminado_at
        ? 'terminado'
        : s.iniciado_at
          ? 'empezado'
          : 'sin abrir';
    return NextResponse.json({ ok: true, estado });
  } catch {
    // Un sondeo que falla no puede romper la pantalla que lo hace: se contesta
    // sin estado y quien pregunta se queda con el que ya tenía.
    return NextResponse.json({ ok: false });
  }
}
