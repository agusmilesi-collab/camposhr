import { NextResponse } from 'next/server';
import { CODIGOS_BATERIA } from '@/lib/baterias';
import { crearPedido, puedeEscribir } from '@/lib/airtable-alta';
import { EMPRESA_DEMO, esDemo } from '@/lib/portal-demo';

export const dynamic = 'force-dynamic';

/**
 * Alta de pedido desde el portal del cliente.
 *
 * Crea el pedido en `Pedidos`, el candidato en `Individuo` y le engancha el CV,
 * todo colgado de la empresa de prueba. Para escribir hace falta
 * `AIRTABLE_TOKEN_ESCRITURA`: sin esa variable valida igual y devuelve el
 * resumen sin guardar, que es lo que permite mirar el formulario sin darle
 * permiso de escritura a nadie.
 *
 * **Solo responde al token del cliente de prueba.** Es la única empresa donde
 * el alta está abierta, y sin esta comprobación cualquiera que conozca la
 * dirección podría escribir en la base. El día que se abra para los clientes de
 * verdad, acá va la resolución del token a su empresa, y el pedido se cuelga de
 * esa y no de una constante.
 */
const MAX_CV = 10 * 1024 * 1024;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario.' }, { status: 400 });
  }

  const texto = (k: string) => (form.get(k) ?? '').toString().trim();

  if (!esDemo(texto('token'))) {
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
    return NextResponse.json(
      { error: 'Faltan el pedido y el candidato.' },
      { status: 400 }
    );
  }
  if (!telefono && !mail) {
    return NextResponse.json(
      { error: 'Hace falta un teléfono o un mail para citar al candidato.' },
      { status: 400 }
    );
  }
  if (!CODIGOS_BATERIA.includes(bateria)) {
    return NextResponse.json({ error: 'Elegí una batería.' }, { status: 400 });
  }

  const cv = form.get('cv');
  const archivo = cv instanceof File && cv.size > 0 ? cv : null;
  if (archivo && archivo.size > MAX_CV) {
    return NextResponse.json({ error: 'El CV supera los 10 MB.' }, { status: 400 });
  }

  const pedido = {
    puesto,
    candidato,
    telefono: telefono || null,
    mail: mail || null,
    bateria,
    descripcion: descripcion || null,
    comentarios: comentarios || null,
    cv: archivo ? { nombre: archivo.name, bytes: archivo.size } : null,
    // La fecha la pone el servidor: no viaja en el formulario ni la elige quien
    // carga, así que el pedido no puede quedar fechado en otro día.
    solicitado: new Date().toISOString(),
  };

  const base =
    `${pedido.candidato} para ${pedido.puesto}, con ${pedido.bateria}` +
    (archivo ? ` y el CV adjunto (${Math.round(archivo.size / 1024)} kB)` : '') +
    '.';

  if (!puedeEscribir()) {
    console.log('[pedido sin guardar, falta AIRTABLE_TOKEN_ESCRITURA]', pedido);
    return NextResponse.json({
      resumen: `${base} Todavía no se guardó: falta cargar el token de escritura de Airtable.`,
      guardado: false,
    });
  }

  try {
    const r = await crearPedido({
      empresaId: EMPRESA_DEMO,
      puesto,
      candidato,
      telefono: pedido.telefono,
      mail: pedido.mail,
      bateria,
      descripcion: pedido.descripcion,
      comentarios: pedido.comentarios,
      cv: archivo,
    });
    return NextResponse.json({
      resumen:
        base +
        (archivo && !r.cvCargado
          ? ' El CV no se pudo adjuntar y hay que subirlo a mano.'
          : ''),
      guardado: true,
      ...r,
    });
  } catch (e) {
    console.error('[alta de pedido]', e);
    return NextResponse.json(
      { error: 'El pedido no se pudo guardar. Probá de nuevo o avisanos.' },
      { status: 502 }
    );
  }
}
