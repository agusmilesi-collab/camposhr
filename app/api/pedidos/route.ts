import { hoyIso } from '@/lib/hora';
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_CLIENTES, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { select } from '@/lib/supabase';
import { crearCandidato, crearPedido } from '@/lib/altas';
import { MAX_DESCRIPTIVO, subirDescriptivo } from '@/lib/descriptivo';
import { crearOrden } from '@/lib/orden-compra';
import { avisarOrden } from '@/lib/correo-orden';
import { empresasDelGrupo } from '@/lib/grupo';
import { avisarPedidoNuevo } from '@/lib/correo-equipo';
import { empresaDelToken } from '@/lib/portal-supabase';
import { esDemo, NOMBRE_DEMO } from '@/lib/portal-demo';
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
 *
 * **Los candidatos pueden ser varios y la búsqueda puede ser una que ya
 * existe.** Es como llega el trabajo: el cliente manda tres para el mismo
 * puesto, o pide dos más para uno que ya se entregó. En ese segundo caso el
 * pedido se reabre solo, con la fecha del día, porque el estado lo mantiene la
 * base (`pedido_estado_al_dia`).
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
  const delEnlace = esDemo(token) ? await empresaDePrueba() : await empresaDelToken(token);
  if (!delEnlace) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }

  /**
   * Para qué empresa es el pedido.
   *
   * Casi siempre la del enlace. En un grupo de empresas (`lib/grupo.ts`) el
   * portal es uno solo y quien pide elige para cuál: el pedido, su orden de
   * compra y su factura son de esa. Solo vale una empresa del mismo grupo: con
   * cualquier otro identificador el pedido no entra.
   */
  const grupo = await empresasDelGrupo(delEnlace.id);
  const paraCual = texto('empresaId');
  let empresa: typeof delEnlace = delEnlace;
  if (paraCual && paraCual !== delEnlace.id) {
    const otra = grupo.includes(paraCual)
      ? (
          await select<{ id: string; nombre: string; pedido_con_ciudad?: boolean }>(
            'empresas',
            `select=id,nombre,pedido_con_ciudad&id=eq.${encodeURIComponent(paraCual)}&limit=1`
          )
        )[0]
      : undefined;
    if (!otra) return NextResponse.json({ error: 'Esa empresa no es de este portal.' }, { status: 404 });
    empresa = otra as typeof delEnlace;
  }

  /**
   * Para qué búsqueda entran.
   *
   * Puede ser una que ya existe, abierta o entregada entera: en el segundo caso
   * la reapertura la hace la base sola cuando entra el candidato, y le deja la
   * fecha del día. O una nueva, y entonces vienen el puesto y la batería.
   */
  const pedidoId = texto('pedidoId');
  const puesto = texto('puesto');
  // Los clientes que piden el mismo puesto para varias ciudades mandan la de
  // cada candidato; las demás empresas no la tienen y se ignora.
  const conCiudad = Boolean((empresa as { pedido_con_ciudad?: boolean }).pedido_con_ciudad);
  const bateria = texto('bateria');
  const descripcion = texto('descripcion');
  const comentarios = texto('comentarios');
  const conBenziger = texto('benziger') === 'si';

  /**
   * El perfil del puesto, si el cliente lo contestó.
   *
   * Solo se aceptan las respuestas que están entre las opciones de cada
   * pregunta: es lo que hace que el dato sirva para comparar entre pedidos, y
   * lo que impide que llegue cualquier cosa por una dirección abierta.
   */
  const perfil: Record<string, string> = {};
  for (const p of [...DEL_PUESTO, ...DEL_JEFE]) {
    const v = texto(p.campo);
    if (v && p.opciones.includes(v)) perfil[p.campo] = v;
  }

  /**
   * El nivel de trabajo del puesto, cuando la batería lleva potencial.
   *
   * Dos caminos, los mismos que el equipo contesta en la ficha del pedido: el
   * plazo de la tarea de mayor alcance y las cinco preguntas de complejidad.
   * Los dos dan un estrato solos; si coinciden, o si vino uno solo, queda
   * guardado, y si se contradicen queda null y lo resuelve la evaluadora.
   *
   * Todo lo que llega se valida acá: es una dirección abierta con token, y un
   * plazo de mil años o una pregunta que no existe entrarían igual.
   */
  const cantidad = Number(texto('spanCantidad').replace(',', '.'));
  const unidad = texto('spanUnidad');
  const timeSpanDias =
    Number.isFinite(cantidad) && cantidad > 0 && UNIDADES.some((u) => u.clave === unidad)
      ? aDias(cantidad, unidad as Unidad)
      : null;

  const complejidad: Record<string, boolean> = {};
  for (const pr of PREGUNTAS) {
    const v = texto(`complejidad-${pr.estrato}`);
    if (v === 'si' || v === 'no') complejidad[String(pr.estrato)] = v === 'si';
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
  const nivelDelPuesto = {
    timeSpanDias,
    complejidad: Object.keys(complejidad).length > 0 ? complejidad : null,
    estratoPuesto: unico ? ESTRATOS.findIndex((e) => e.romano === unico.romano) + 1 : null,
  };

  /** Quién lo pidió, del lado del cliente. Tiene que ser de esa empresa, o de
   *  su grupo: ahí las personas están cargadas una vez y piden para todas. */
  const contactoId = texto('contactoId');
  const quienPide = contactoId
    ? (
        await select<{ id: string; nombre: string; email: string | null }>(
          'contactos',
          `select=id,nombre,email&id=eq.${encodeURIComponent(contactoId)}` +
            `&empresa_id=in.(${grupo.join(',')})&activo=is.true&limit=1`
        )
      )[0]
    : undefined;

  /* Quién pide es obligatorio y sale de los contactos que cargó Campos HR:
     el cliente no se da de alta solo. Un id que no es de esta empresa es lo
     mismo que no haber elegido. */
  if (!quienPide) {
    return NextResponse.json({ error: 'Elegí quién hace el pedido.' }, { status: 400 });
  }

  /**
   * Los candidatos, que pueden ser varios.
   *
   * Vienen numerados desde el formulario, que agrega y saca filas: se recorre
   * hasta que no haya más nombre. Uno sin nombre no es un candidato a medias,
   * es una fila que quedó vacía y se descarta.
   */
  const gente: {
    /** El nombre solo; `completo` lleva también el apellido. */
    nombre: string;
    apellido: string;
    completo: string;
    telefono: string;
    mail: string;
    cv: File | null;
    ciudad: string | null;
  }[] = [];
  for (let i = 0; i < 40; i++) {
    const nombre = texto(`nombre-${i}`);
    if (!nombre) continue;
    const adjunto = form.get(`cv-${i}`);
    const apellido = texto(`apellido-${i}`);
    gente.push({
      nombre,
      apellido,
      completo: `${nombre} ${apellido}`.trim(),
      telefono: texto(`telefono-${i}`),
      mail: texto(`mail-${i}`),
      cv: adjunto instanceof File && adjunto.size > 0 ? adjunto : null,
      ciudad: conCiudad ? texto(`ciudad-${i}`).slice(0, 60) || null : null,
    });
  }

  if (gente.length === 0) {
    return NextResponse.json({ error: 'Cargá al menos un candidato.' }, { status: 400 });
  }
  const sinApellido = gente.find((g) => !g.apellido);
  if (sinApellido) {
    return NextResponse.json(
      { error: `Falta el apellido de ${sinApellido.nombre}.` },
      { status: 400 }
    );
  }
  const sinContacto = gente.find((g) => !g.telefono && !g.mail);
  if (sinContacto) {
    return NextResponse.json(
      {
        error: `Falta un teléfono o un mail de ${sinContacto.completo}: es por donde se lo cita.`,
      },
      { status: 400 }
    );
  }
  const sinCiudad = conCiudad && gente.find((g) => !g.ciudad);
  if (sinCiudad) {
    return NextResponse.json(
      { error: `Falta la ciudad de ${sinCiudad.completo}.` },
      { status: 400 }
    );
  }
  const pesado = gente.find((g) => g.cv && g.cv.size > MAX_CV);
  if (pesado) {
    return NextResponse.json(
      { error: `El CV de ${pesado.nombre} supera los 10 MB.` },
      { status: 400 }
    );
  }

  /* El descriptivo de puesto, si lo adjuntaron: es opcional, en un pedido
     nuevo y al sumarle candidatos a uno que ya existe. */
  const adjuntoPuesto = form.get('descriptivo');
  const descriptivoPuesto =
    adjuntoPuesto instanceof File && adjuntoPuesto.size > 0 ? adjuntoPuesto : null;
  if (descriptivoPuesto && descriptivoPuesto.size > MAX_DESCRIPTIVO) {
    return NextResponse.json(
      { error: 'El descriptivo de puesto supera los 10 MB.' },
      { status: 400 }
    );
  }

  const pide = quienPide;

  /** La búsqueda que ya existe, si el cliente eligió una. Tiene que ser suya. */
  const suyo = pedidoId
    ? (
        await select<{ id: string; puesto: string; baterias: { codigo: string } | null }>(
          'pedidos',
          `select=id,puesto,baterias(codigo)&id=eq.${encodeURIComponent(pedidoId)}` +
            `&empresa_id=eq.${empresa.id}&limit=1`
        )
      )[0]
    : undefined;
  if (pedidoId && !suyo) {
    return NextResponse.json({ error: 'Esa búsqueda no existe.' }, { status: 404 });
  }

  // La batería se busca por su código en la tabla, que es de donde salen las
  // opciones del formulario: así una batería que se agregue entra sola, y una
  // que no exista no arma un pedido a medias. En una búsqueda que ya existe la
  // batería es la suya: los que entran para el mismo puesto se miden con lo
  // mismo, o sus informes no se pueden comparar.
  let elegida: { id: string; codigo: string } | undefined;
  if (!suyo) {
    if (!puesto) {
      return NextResponse.json({ error: 'Falta el puesto de la búsqueda.' }, { status: 400 });
    }
    elegida = (
      await select<{ id: string; codigo: string }>(
        'baterias',
        `select=id,codigo&codigo=eq.${encodeURIComponent(bateria)}&limit=1`
      )
    )[0];
    if (!elegida) {
      return NextResponse.json({ error: 'Elegí una batería.' }, { status: 400 });
    }
  }

  const conCv = gente.filter((g) => g.cv).length;
  const base =
    `${gente.length === 1 ? gente[0].completo : `${gente.length} candidatos`} para ` +
    `${suyo ? suyo.puesto : puesto}, con ${suyo?.baterias?.codigo ?? elegida?.codigo}` +
    (conBenziger && !suyo ? ' y la evaluación de perfil' : '') +
    (conCv ? ` y ${conCv === 1 ? 'el CV adjunto' : `${conCv} CV adjuntos`}` : '') +
    '.';

  try {
    // Sobre una búsqueda que ya existe no se crea nada: los candidatos se le
    // cuelgan, y si estaba entregada entera la base la reabre sola con la
    // fecha de hoy.
    const pedidoDestino =
      suyo?.id ??
      (
        await crearPedido({
          empresaId: empresa.id,
          puesto,
          bateriaId: elegida!.id,
          conBenziger,
          familia: null,
          seniority: null,
          // La fecha la pone el servidor: no viaja en el formulario, así que el
          // pedido no puede quedar fechado en otro día.
          fechaPedido: hoyIso(),
          notas:
            [
              descripcion,
              pide ? `Lo pidió ${pide.nombre}.` : '',
              comentarios,
            ]
              .filter(Boolean)
              .join('\n\n') || null,
          origen: 'portal',
          // Quién lo pidió queda en el pedido y no solo en las notas: el
          // informe lo nombra debajo de la empresa.
          solicitanteId: pide?.id ?? null,
        },
          perfil,
          nivelDelPuesto
        )
      ).id;

    // El descriptivo se cuelga del pedido. No tira: si falla, el pedido entra
    // igual.
    if (descriptivoPuesto) await subirDescriptivo(pedidoDestino, descriptivoPuesto);

    // De a uno y no todos a la vez: cada candidato sube su CV, y si algo falla
    // en el tercero los dos primeros ya quedaron cargados en vez de perderse.
    const cargadas: string[] = [];
    for (const g of gente) {
      const evaluacion = await crearCandidato({
        pedidoId: pedidoDestino,
        nombre: g.nombre,
        apellido: g.apellido,
        email: g.mail || null,
        telefono: g.telefono || null,
        evaluadoraId: null,
        origen: 'portal',
        cv: g.cv,
        ciudad: g.ciudad,
        // Lo que se eligió en "Enviar como", en cada candidato: el pedido puede
        // haberlo abierto otra persona.
        solicitanteId: pide?.id ?? null,
      });
      cargadas.push(evaluacion.id);
    }

    // La orden de compra de esta carga: lo que acaban de pedir y cuánto sale.
    // Va detrás de un try porque es un paso de más: si falla, los candidatos
    // ya entraron y el pedido se confirma igual, sin la orden.
    let orden = null;
    try {
      orden = await crearOrden(cargadas, 'portal');
    } catch (e) {
      console.error('[orden de compra]', e);
    }
    // Y a quien la pidió le llega por correo, con el PDF. No tira.
    await avisarOrden(orden);
    // Y a las evaluadoras, que entró un pedido: llega sin dueña. No tira.
    await avisarPedidoNuevo(cargadas);

    revalidateTag(CACHE_PSICOTECNICOS);
    revalidateTag(CACHE_CLIENTES);
    return NextResponse.json({ resumen: base, guardado: true, orden });
  } catch (e) {
    console.error('[alta de pedido]', e);
    return NextResponse.json(
      { error: 'El pedido no se pudo guardar. Probá de nuevo o avisanos.' },
      { status: 502 }
    );
  }
}
