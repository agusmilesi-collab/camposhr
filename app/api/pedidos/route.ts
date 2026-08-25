import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_CLIENTES, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { select } from '@/lib/supabase';
import { crearCandidato, crearPedido } from '@/lib/altas';
import { empresaDelToken } from '@/lib/portal-supabase';
import { esDemo, NOMBRE_DEMO } from '@/lib/portal-demo';

export const dynamic = 'force-dynamic';

/**
 * Alta de pedido desde el portal del cliente.
 *
 * Crea el pedido y, adentro, la persona con su evaluación y su CV, todo en
 * Supabase (`lib/altas.ts`, el mismo camino que usa el OS por dentro). Hasta el
 * 25/8/2026 escribía en Airtable y solo respondía al cliente de prueba.
 *
 * **El pedido se cuelga de la empresa del token**, que es lo único que se
 * acepta como identidad acá: quien carga solo puede cargar en la suya, y un
 * token que no resuelve a ninguna empresa no existe para esta ruta.
 *
 * **Entra sin evaluadora**, así que la evaluación arranca en "Sin asignar", que
 * es la pantalla donde el equipo reparte. Nadie de afuera elige quién evalúa.
 */

const MAX_CV = 10 * 1024 * 1024;

/** La empresa donde caen los pedidos que se cargan probando. */
async function empresaDePrueba(): Promise<{ id: string; nombre: string } | null> {
  const filas = await select<{ id: string; nombre: string }>(
    'empresas',
    `select=id,nombre&nombre=ilike.${encodeURIComponent(NOMBRE_DEMO)}*&limit=1`
  );
  return filas[0] ?? null;
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario.' }, { status: 400 });
  }

  const texto = (k: string) => (form.get(k) ?? '').toString().trim();
  const token = texto('token');

  // El enlace de prueba no tiene su empresa en Supabase, así que sus pedidos
  // caen en la de prueba: es lo mismo que hacía antes contra Airtable.
  const empresa = esDemo(token) ? await empresaDePrueba() : await empresaDelToken(token);
  if (!empresa) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }

  const puesto = texto('puesto');
  const candidato = texto('candidato');
  const telefono = texto('telefono');
  const mail = texto('mail');
  const bateria = texto('bateria');
  const descripcion = texto('descripcion');
  const comentarios = texto('comentarios');

  if (!puesto || !candidato) {
    return NextResponse.json({ error: 'Faltan el pedido y el candidato.' }, { status: 400 });
  }
  if (!telefono && !mail) {
    return NextResponse.json(
      { error: 'Hace falta un teléfono o un mail para citar al candidato.' },
      { status: 400 }
    );
  }

  // La batería se busca por su código en la tabla, que es de donde salen las
  // opciones del formulario: así una batería que se agregue entra sola, y una
  // que no exista no arma un pedido a medias.
  const elegida = (
    await select<{ id: string; codigo: string }>(
      'baterias',
      `select=id,codigo&codigo=eq.${encodeURIComponent(bateria)}&limit=1`
    )
  )[0];
  if (!elegida) {
    return NextResponse.json({ error: 'Elegí una batería.' }, { status: 400 });
  }

  const adjunto = form.get('cv');
  const cv = adjunto instanceof File && adjunto.size > 0 ? adjunto : null;
  if (cv && cv.size > MAX_CV) {
    return NextResponse.json({ error: 'El CV supera los 10 MB.' }, { status: 400 });
  }

  const base =
    `${candidato} para ${puesto}, con ${elegida.codigo}` +
    (cv ? ` y el CV adjunto (${Math.round(cv.size / 1024)} kB)` : '') +
    '.';

  try {
    const pedido = await crearPedido({
      empresaId: empresa.id,
      puesto,
      bateriaId: elegida.id,
      conBenziger: false,
      familia: null,
      seniority: null,
      // La fecha la pone el servidor: no viaja en el formulario, así que el
      // pedido no puede quedar fechado en otro día.
      fechaPedido: new Date().toISOString().slice(0, 10),
      notas: [descripcion, comentarios].filter(Boolean).join('\n\n') || null,
      origen: 'portal',
    });

    await crearCandidato({
      pedidoId: pedido.id,
      nombre: candidato,
      email: mail || null,
      telefono: telefono || null,
      evaluadoraId: null,
      origen: 'portal',
      cv,
    });

    revalidateTag(CACHE_PSICOTECNICOS);
    revalidateTag(CACHE_CLIENTES);
    return NextResponse.json({ resumen: base, guardado: true });
  } catch (e) {
    console.error('[alta de pedido]', e);
    return NextResponse.json(
      { error: 'El pedido no se pudo guardar. Probá de nuevo o avisanos.' },
      { status: 502 }
    );
  }
}
