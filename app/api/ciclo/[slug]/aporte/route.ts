import { NextResponse } from 'next/server';
import {
  actividadesDelCiclo,
  anotarEnsayo,
  anotarFrases,
  asistentesDeLaSala,
  type RespuestaEnsayo,
  getAsistente,
  guardarAporte,
  normalizarValor,
  resolverCiclo,
} from '@/lib/ciclo';

/**
 * Lo que responde una persona en la actividad abierta.
 *
 * Se valida contra la actividad guardada, no contra lo que dice el navegador:
 * el tipo, el rango de la escala y los índices de las opciones salen de la fila
 * de `actividades`.
 *
 * **Las lecturas de validación salen de memoria.** El catálogo del ciclo y la
 * lista de la sala ya están cacheados porque los usa el sondeo, y este camino
 * los pedía de nuevo a la base: eran cuatro o cinco idas en fila justo en el
 * momento en que ochenta teléfonos escriben a la vez. Ahora son dos, y el techo
 * de escrituras por segundo sube con eso.
 *
 * Quien se registró hace menos de lo que dura el caché todavía no está en la
 * lista de memoria, así que ahí sí se lo pregunta a la base: es un caso por
 * encuentro y perder su respuesta sería peor que la consulta.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });
  const { corrida } = ciclo;

  let datos: { actividadId?: unknown; asistenteId?: unknown; valor?: unknown };
  try {
    datos = await req.json();
  } catch {
    return new NextResponse('Datos ilegibles', { status: 400 });
  }

  const catalogo = await actividadesDelCiclo(corrida.ciclo_id);
  const actividadId = String(datos.actividadId ?? '');
  const actividad = catalogo.find((a) => a.id === actividadId);
  if (!actividad) return new NextResponse('Actividad no encontrada', { status: 404 });

  // Cerrada quiere decir cerrada: una vez que la expositora la cierra, lo que
  // llega tarde no entra. Si no, el conteo proyectado sigue moviéndose mientras
  // ella ya está hablando de otra cosa.
  //
  // Las que se abren juntas cuentan como abiertas mientras lo esté cualquiera
  // del grupo: la expositora abre una sola vez y cada uno recorre las cinco a
  // su ritmo, así que sólo la primera figura como abierta en la corrida.
  const abierta =
    corrida.actividad_abierta_id === actividad.id ||
    (actividad.grupo !== null &&
      actividad.grupo ===
        catalogo.find((a) => a.id === corrida.actividad_abierta_id)?.grupo);

  if (!abierta) {
    return new NextResponse('La actividad está cerrada', { status: 409 });
  }

  const asistenteId = String(datos.asistenteId ?? '');
  const asistente =
    (await asistentesDeLaSala(corrida.id)).find((a) => a.id === asistenteId) ??
    (await getAsistente(corrida.id, asistenteId));
  if (!asistente) return new NextResponse('Asistente no encontrado', { status: 404 });

  /*
   * El ensayo no se responde como el resto. El puesto ya está escrito por el
   * servidor y lo único que llega del teléfono es lo que vio quien observó, que
   * se guarda adentro de ese mismo puesto. Por eso pasa por su propio camino:
   * necesita leer el puesto antes, tanto para completarlo como para saber si
   * quien contesta era el que observaba.
   */
  if (actividad.tipo === 'ensayo') {
    const crudo = (datos.valor ?? {}) as Record<string, unknown>;
    const respuesta: RespuestaEnsayo = {};
    if (crudo.sostuvo === 'escucho' || crudo.sostuvo === 'explico') {
      respuesta.sostuvo = crudo.sostuvo;
    }
    if (
      crudo.motivo === 'hecho' ||
      crudo.motivo === 'juicio' ||
      crudo.motivo === 'ninguno'
    ) {
      respuesta.motivo = crudo.motivo;
    }
    if (typeof crudo.porque === 'boolean') respuesta.porque = crudo.porque;
    if (typeof crudo.cuando === 'boolean') respuesta.cuando = crudo.cuando;
    if (Object.keys(respuesta).length === 0) {
      return new NextResponse('Respuesta inválida', { status: 400 });
    }
    try {
      const guardado = await anotarEnsayo(
        corrida.id,
        actividad.id,
        asistente.id,
        respuesta
      );
      return NextResponse.json({ ok: true, valor: guardado.valor });
    } catch (e) {
      return new NextResponse((e as Error).message, { status: 409 });
    }
  }

  /*
   * El ejercicio de las frases, por el mismo camino que el ensayo: el equipo ya
   * está escrito y lo único que llega del teléfono es lo que escribió quien
   * escribe por su mitad. Necesita leer el puesto antes para saber si esta
   * persona era ésa.
   */
  if (actividad.tipo === 'frases') {
    const crudo = (datos.valor ?? {}) as Record<string, unknown>;
    const respuestas = Array.isArray(crudo.respuestas)
      ? crudo.respuestas.map((t) => String(t ?? ''))
      : null;
    if (!respuestas) return new NextResponse('Respuesta inválida', { status: 400 });
    try {
      const guardado = await anotarFrases(
        corrida.id,
        actividad.id,
        asistente.id,
        respuestas
      );
      return NextResponse.json({ ok: true, valor: guardado.valor });
    } catch (e) {
      return new NextResponse((e as Error).message, { status: 409 });
    }
  }

  let valor;
  try {
    valor = normalizarValor(actividad, datos.valor);
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 400 });
  }

  try {
    // Sin pedirle a la base que devuelva la fila: la respuesta de acá es el
    // valor que ya está en la mano, y son ochenta escrituras en el mismo
    // minuto.
    await guardarAporte(corrida.id, actividad.id, asistente.id, valor, false);
  } catch {
    return new NextResponse('No se pudo guardar', { status: 500 });
  }

  return NextResponse.json({ ok: true, valor });
}
