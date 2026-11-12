import { NextResponse } from 'next/server';
import { hayPuerta, huella, igual } from '@/lib/os-sesion';
import { cookieDelOs } from '@/lib/os-sesion-servidor';
import { select } from '@/lib/supabase';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';
import { randomBytes } from 'node:crypto';
import { admiteRaven12, BATERIA_RAVEN_12, serieDe } from '@/lib/raven';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * De dónde cuelga el enlace que se le manda al candidato.
 *
 * El OS vive en su subdominio y detrás de la puerta; el test lo responde una
 * persona de afuera, así que el enlace tiene que apuntar al host principal,
 * que es donde vive lo público.
 */
function base(req: Request): string {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return `http://${host}`;
  return 'https://camposhr.com';
}

/**
 * El enlace del test de Raven de un candidato.
 *
 * Se pide en el momento de la entrevista y se pega en el chat donde se esté
 * hablando con la persona. Si ya tiene uno sin usar se devuelve el mismo: dos
 * enlaces para la misma evaluación son dos tests, y el segundo pisaría al
 * primero.
 *
 * La evaluadora elige la serie (`laminas`: 36 o 12). Si el enlace abierto es de
 * la otra y todavía no lo abrió, se cambia la serie de ese mismo enlace: así
 * no quedan dos tests vivos y el que ya se mandó lleva al que se eligió. Si ya
 * lo empezó, no se cambia: tiene respuestas sobre otras láminas.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = await cookieDelOs();
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  const datos = await req.json().catch(() => null);
  const id = datos?.evaluacionId;
  const laminas = serieDe(datos?.laminas);
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }

  try {
    // La serie corta es solo de la Batería 1.
    if (laminas === 12) {
      const ev = await select<{ pedidos: { baterias: { codigo: string } | null } | null }>(
        'evaluaciones',
        `select=pedidos(baterias(codigo))&id=eq.${id}&limit=1`
      );
      if (!admiteRaven12(ev[0]?.pedidos?.baterias?.codigo)) {
        return NextResponse.json(
          { ok: false, motivo: `El Raven de 12 es solo para la ${BATERIA_RAVEN_12}.` },
          { status: 400 }
        );
      }
    }

    // El que ya está, si todavía no se entregó.
    const abiertas = await select<{ id: string; token: string; iniciado_at: string | null; laminas: number | null }>(
      'raven_sesiones',
      `select=id,token,iniciado_at,laminas&evaluacion_id=eq.${id}&terminado_at=is.null&order=creado_at.desc&limit=1`
    );
    const abierta = abiertas[0];
    if (abierta) {
      if (serieDe(abierta.laminas) !== laminas) {
        if (abierta.iniciado_at !== null) {
          return NextResponse.json(
            {
              ok: false,
              motivo: `Ya está respondiendo el de ${serieDe(abierta.laminas)} láminas.`,
            },
            { status: 409 }
          );
        }
        const cambio = await fetch(`${url}/rest/v1/raven_sesiones?id=eq.${abierta.id}`, {
          method: 'PATCH',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ laminas }),
          cache: 'no-store',
        });
        if (!cambio.ok) {
          return NextResponse.json(
            { ok: false, motivo: `Supabase respondió ${cambio.status}: ${await cambio.text()}` },
            { status: 500 }
          );
        }
      }
      return NextResponse.json({
        ok: true,
        enlace: `${base(req)}/raven/${abierta.token}`,
        empezado: abierta.iniciado_at !== null,
        nuevo: false,
        laminas,
      });
    }

    const token = `rv_${randomBytes(16).toString('base64url')}`;
    const res = await fetch(`${url}/rest/v1/raven_sesiones`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ evaluacion_id: id, token, laminas }),
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
        { status: 500 }
      );
    }

    const yo = await quienSoy();
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'raven_sesion',
      recursoId: id,
      detalle: { alta: 'enlace', laminas },
    });

    return NextResponse.json({ ok: true, enlace: `${base(req)}/raven/${token}`, empezado: false, nuevo: true, laminas });
  } catch (e) {
    console.error('raven-link:', e);
    return NextResponse.json({ ok: false, motivo: 'No se pudo generar el enlace.' }, { status: 500 });
  }
}
