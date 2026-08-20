import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { calcularSumario, formatearSumario, perfilDe, type Respuesta } from '@/lib/exner';

export const runtime = 'nodejs';

/**
 * Calcula el sumario estructural de una evaluación y lo guarda.
 *
 * Es el motor que corría como automatización dentro de Airtable, ahora de este
 * lado: lee las respuestas de `rorschach_respuestas`, corre `lib/exner.ts` y
 * escribe `sumario_exner`. El JSON completo va a la columna `crudo`, que es lo
 * que después alimenta al agente que redacta el informe; las columnas sueltas
 * son las mismas que en Airtable eran los campos "Sx".
 *
 * El cálculo se dispara a mano y no al guardar cada celda a propósito: un
 * protocolo a medio codificar da un sumario que parece válido y no lo es.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FilaCruda = {
  lamina: string | null;
  n_respuesta: number | null;
  localizacion: string | null;
  n_localizacion: string | null;
  determinantes: string[] | null;
  fq: string | null;
  par: boolean | null;
  contenidos: string[] | null;
  popular: boolean | null;
  z: number | null;
  cc_ee: string[] | null;
  agc: boolean | null;
  sl: boolean | null;
};

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
  const id = datos?.evaluacionId;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }

  const cabeceras = { apikey: key, Authorization: `Bearer ${key}` };

  const res = await fetch(
    `${url}/rest/v1/rorschach_respuestas?select=*&evaluacion_id=eq.${id}&order=n_respuesta.asc`,
    { headers: cabeceras, cache: 'no-store' }
  );
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `No se pudieron leer las respuestas: ${res.status}` },
      { status: 400 }
    );
  }
  const crudas: FilaCruda[] = await res.json();

  if (crudas.length === 0) {
    return NextResponse.json(
      { ok: false, motivo: 'No hay respuestas cargadas todavía.' },
      { status: 400 }
    );
  }

  const elegido = perfilDe(crudas.map((f) => f.lamina ?? ''));
  if ('motivo' in elegido) {
    return NextResponse.json({ ok: false, motivo: elegido.motivo }, { status: 400 });
  }

  // La misma forma que esperaba el motor en Airtable. FQ va en minúscula
  // porque las opciones se guardan como las escribió la evaluadora ("O", "U")
  // y el motor compara contra "o", "u", "-", "none".
  const respuestas: Respuesta[] = crudas
    .map((f) => ({
      lam: f.lamina ?? '',
      n_rta: f.n_respuesta ?? 0,
      loc: f.localizacion ?? '',
      n_loc: f.n_localizacion,
      determinantes: f.determinantes ?? [],
      fq: (f.fq ?? 'none').toLowerCase(),
      par: Boolean(f.par),
      contenidos: f.contenidos ?? [],
      popular: Boolean(f.popular),
      z: f.z ?? null,
      ccee: f.cc_ee ?? [],
      agc: Boolean(f.agc),
      sl: Boolean(f.sl),
    }))
    .sort((a, b) => a.n_rta - b.n_rta);

  let sumario: any;
  try {
    sumario = calcularSumario(respuestas, elegido.perfil);
  } catch (e) {
    return NextResponse.json(
      { ok: false, motivo: `El motor no pudo calcular: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  const ce = sumario.control_estres, det = sumario.determinantes;
  const cf = sumario.calidad_formal, proc = sumario.procesamiento;
  const af = sumario.afectos, aut = sumario.autopercepcion, k = sumario.constelaciones;

  // Una constelación apagada guarda null, no 0: un cero se lee como "negativo,
  // todo bien" y el sumario de Zulliger no tiene constelaciones.
  const num = (c: any) => (c === null ? null : c.valor);
  const pos = (c: any) => (c === null ? null : c.positivo);

  const fila = {
    evaluacion_id: id,
    r: sumario.cabecera.R,
    lambda: sumario.cabecera.Lambda,
    ea: ce.EA,
    es: ce.es,
    d: ce.D,
    adj_d: ce.AdjD,
    eb: ce.EB,
    estilo: ce.estilo,
    wsumc: det.WSumC,
    afr: af.Afr,
    xa_pct: cf.XA_pct,
    x_mas_pct: cf.X_mas_pct,
    xu_pct: cf.Xu_pct,
    x_menos_pct: cf.X_menos_pct,
    zd: proc.Zd,
    ego: aut.Ego,
    scon: num(k.SCON),
    scon_pos: pos(k.SCON),
    depi: num(k.DEPI),
    depi_pos: pos(k.DEPI),
    cdi: num(k.CDI),
    cdi_pos: pos(k.CDI),
    hvi_pos: pos(k.HVI),
    obs_pos: pos(k.OBS),
    pti: num(k.PTI),
    pti_pos: pos(k.PTI),
    crudo: { ...sumario, texto: formatearSumario(sumario) },
    actualizado_at: new Date().toISOString(),
  };

  const guardado = await fetch(`${url}/rest/v1/sumario_exner?on_conflict=evaluacion_id`, {
    method: 'POST',
    headers: {
      ...cabeceras,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(fila),
    cache: 'no-store',
  });
  if (!guardado.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${guardado.status}: ${await guardado.text()}` },
      { status: 400 }
    );
  }

  await anotarAcceso({
    accion: 'escritura',
    recurso: 'sumario_exner',
    detalle: { evaluacion: id, test: sumario.meta.test, R: sumario.cabecera.R },
  });
  revalidateTag(CACHE_PSICOTECNICOS);

  return NextResponse.json({
    ok: true,
    test: sumario.meta.test,
    R: sumario.cabecera.R,
    avisos: sumario.meta.avisos_codificacion,
  });
}
