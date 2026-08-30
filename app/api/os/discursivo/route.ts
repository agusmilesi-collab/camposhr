import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';
import { esNivel } from '@/lib/discursivo';
import { edadValida, esCelda, esModo } from '@/lib/potencial';

export const runtime = 'nodejs';

/**
 * El nivel del análisis discursivo y sus dos textos.
 *
 * El nivel es una de las cuatro posiciones de la pirámide y lo ubica la
 * evaluadora: acá solo se comprueba que sea una de ellas. Null lo borra, que es
 * lo que hace falta cuando se eligió el escalón equivocado.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LARGO_MAXIMO = 4000;

function parrafo(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const limpio = v.trim();
  return limpio ? limpio.slice(0, LARGO_MAXIMO) : null;
}

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

  /* El nivel es opcional como todo lo demás: cada pantalla escribe lo suyo y lo
     que no manda queda como estaba. La hoja de la entrevista guarda el relato
     sin saber en qué estrato quedó, que se codifica después. */
  const nivel = 'nivel' in (datos ?? {}) ? datos.nivel : undefined;
  if (nivel !== undefined && nivel !== null && !esNivel(nivel)) {
    return NextResponse.json(
      { ok: false, motivo: 'El nivel tiene que ser uno de los cuatro de la pirámide.' },
      { status: 400 }
    );
  }

  const yo = await quienSoy();

  /**
   * Solo se pisa lo que vino en el cuerpo.
   *
   * El upsert reemplaza la fila entera, así que mandar la ficha con el nivel
   * solo, que es lo que hace la pantalla donde se elige el escalón, borraba los
   * dos párrafos de quien los hubiera escrito. Una clave ausente es "no lo
   * toques" y no "ponelo en null".
   */
  const fila: Record<string, unknown> = {
    evaluacion_id: id,
    quien: yo.nombre,
    actualizado_at: new Date().toISOString(),
  };
  if (nivel !== undefined) fila.nivel = nivel;
  for (const campo of ['actual', 'futura', 'relato', 'fundamentacion'] as const) {
    if (campo in (datos ?? {})) fila[campo] = parrafo(datos?.[campo]);
  }

  /* Cómo ordena lo que dice, leído en los cinco minutos de discurso libre. Es
     la vía del modelo que mide la capacidad de la persona, así que se guarda
     con su propio nombre y no mezclada con lo que contestó del trabajo. */
  if ('discursoModo' in (datos ?? {})) {
    const m = datos.discursoModo;
    if (m !== null && !esModo(m)) {
      return NextResponse.json(
        { ok: false, motivo: 'El modo de procesamiento tiene que ser uno de los cuatro.' },
        { status: 400 }
      );
    }
    fila.discurso_modo = m;
  }
  if ('discursoAbstracto' in (datos ?? {})) {
    fila.discurso_abstracto = Boolean(datos.discursoAbstracto);
  }
  /* La celda no le cambia el estrato: dice dónde cae dentro de él, que es la
     subdivisión que la lámina rotula en su columna. */
  if ('discursoCelda' in (datos ?? {})) {
    const c = datos.discursoCelda;
    if (c !== null && !esCelda(c)) {
      return NextResponse.json(
        { ok: false, motivo: 'La celda tiene que ser A, B o C.' },
        { status: 400 }
      );
    }
    fila.discurso_celda = c;
  }

  /* Si el puesto que la persona ocupa hoy no le exige lo que puede. El estrato
     mide el alcance de lo asignado, así que sin esta marca un puesto que la
     subutiliza se lee como un techo de la persona. */
  if ('subutilizado' in (datos ?? {})) {
    fila.subutilizado = Boolean(datos.subutilizado);
  }

  /* Los dos del diagrama de progreso potencial. Van con la misma regla: la
     clave ausente no se toca, y null la borra. Un número que no sirva se
     rechaza en vez de guardarse en cero, que dibujaría un punto en el piso. */
  if ('edad' in (datos ?? {})) {
    const e = datos.edad;
    if (e !== null && edadValida(e) === null) {
      return NextResponse.json(
        { ok: false, motivo: 'La edad tiene que estar entre 16 y 80.' },
        { status: 400 }
      );
    }
    fila.edad = e === null ? null : edadValida(e);
  }
  if ('horizonteDias' in (datos ?? {})) {
    const h = datos.horizonteDias;
    const limpio = typeof h === 'number' && Number.isInteger(h) && h >= 1 && h <= 40_000 ? h : null;
    if (h !== null && limpio === null) {
      return NextResponse.json(
        { ok: false, motivo: 'El horizonte tiene que ir entre un día y cincuenta años.' },
        { status: 400 }
      );
    }
    fila.horizonte_dias = limpio;
  }
  /* Las cinco preguntas de complejidad, contestadas sobre las asignaciones que
     la persona manejó al límite de lo que pudo. */
  if ('complejidad' in (datos ?? {})) {
    const c = datos.complejidad;
    const ok =
      c === null ||
      (typeof c === 'object' &&
        !Array.isArray(c) &&
        Object.entries(c as Record<string, unknown>).every(
          ([k, v]) => /^[1-5]$/.test(k) && typeof v === 'boolean'
        ));
    if (!ok) {
      return NextResponse.json({ ok: false, motivo: 'Respuestas inválidas.' }, { status: 400 });
    }
    fila.complejidad = c;
  }

  /* Lo que no vino en el cuerpo se rellena con lo que ya estaba guardado: el
     upsert escribe la fila con las columnas que le mandan, y una que falte
     quedaría en null. La pantalla del estrato manda el nivel solo, y la de los
     dos datos del diagrama manda esos dos. */
  const opcionales = [
    'nivel',
    'actual',
    'futura',
    'relato',
    'edad',
    'horizonte_dias',
    'complejidad',
  ] as const;
  if (opcionales.some((c) => !(c in fila))) {
    const antes = await fetch(
      `${url}/rest/v1/analisis_discursivo?evaluacion_id=eq.${id}` +
        `&select=${opcionales.join(',')}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
    );
    const suya = (await antes.json().catch(() => []))[0] ?? {};
    for (const c of opcionales) if (!(c in fila)) fila[c] = suya[c] ?? null;
  }

  const res = await fetch(`${url}/rest/v1/analisis_discursivo?on_conflict=evaluacion_id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(fila),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}.` },
      { status: 400 }
    );
  }

  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'analisis_discursivo',
    recursoId: id,
    detalle: { nivel: (nivel ?? fila.nivel ?? 'sin ubicar') as string },
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
