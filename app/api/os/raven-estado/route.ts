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
 * Devuelve el estado y lo que la hoja muestra al lado: cuándo abrió (para que
 * el reloj arranque solo) y, si ya entregó, cuánto tardó y qué dio. Con eso la
 * pantalla se actualiza sola mientras la persona responde, sin que la
 * evaluadora tenga que recargar: antes el sondeo solo traía el estado y el
 * reloj recién aparecía en el redibujo siguiente.
 *
 * Sigue siendo una consulta chica, para preguntarla cada pocos segundos: dos
 * filas por evaluación. La hoja entera trae el pedido, la batería y el
 * discursivo, y eso no se pide por un reloj.
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
    const [sesiones, medidas] = await Promise.all([
      select<{ iniciado_at: string | null; terminado_at: string | null }>(
        'raven_sesiones',
        `select=iniciado_at,terminado_at&evaluacion_id=eq.${id}&order=creado_at.desc&limit=1`
      ),
      select<{ raw: number | null; percentil: number | null; resultado: string | null }>(
        'raven',
        `select=raw,percentil,resultado&evaluacion_id=eq.${id}&limit=1`
      ).catch(() => []),
    ]);
    const s = sesiones[0];
    const estado = !s
      ? 'sin enlace'
      : s.terminado_at
        ? 'terminado'
        : s.iniciado_at
          ? 'empezado'
          : 'sin abrir';

    return NextResponse.json({
      ok: true,
      estado,
      // Mientras corre, cuándo arrancó; entregado, cuánto le llevó. Son los dos
      // datos que la hoja muestra en la misma columna.
      iniciado: s?.terminado_at ? null : (s?.iniciado_at ?? null),
      duracion:
        s?.terminado_at && s.iniciado_at
          ? Math.max(
              0,
              Math.round(
                (new Date(s.terminado_at).getTime() - new Date(s.iniciado_at).getTime()) / 1000
              )
            )
          : null,
      resultado: medidas[0] ?? null,
    });
  } catch {
    // Un sondeo que falla no puede romper la pantalla que lo hace: se contesta
    // sin estado y quien pregunta se queda con el que ya tenía.
    return NextResponse.json({ ok: false });
  }
}
