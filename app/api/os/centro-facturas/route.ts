import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { CACHE_COMERCIAL } from '@/lib/etiquetas';
import { aFacturarDelCentro, periodoLindo } from '@/lib/facturas-centro';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';

/**
 * Emitir las facturas del alquiler de consultorios.
 *
 * Dos acciones y la misma cuenta detrás: `mes` factura a un inquilino y `lote`
 * factura a varios de una vez, que es lo que se hace al cerrar el mes. En el
 * lote la numeración es correlativa desde el número que se escribe una sola
 * vez: pedir trece números a mano es donde aparecen los saltos.
 *
 * **No llama a ARCA**, igual que la facturación de psicotécnicos: no hay
 * certificados cargados. El OS registra el comprobante con su número y lo
 * imprime; el día que ARCA esté, el número y el CAE vienen de ahí.
 *
 * **Un cargo entra en una sola factura.** El renglón guarda de qué movimiento
 * salió, y la cola los saltea: sin eso, dos personas cerrando el mes a la vez
 * facturan lo mismo dos veces.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const PERIODO = /^\d{4}-\d{2}-\d{2}$/;

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

async function escribir(camino: string, cuerpo: unknown) {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${camino}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(cuerpo),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}: ${await res.text()}`);
  const filas = await res.json();
  return Array.isArray(filas) ? filas[0] : filas;
}

function refrescar() {
  revalidateTag(CACHE_COMERCIAL);
  // La ficha del inquilino lee los movimientos con esta etiqueta.
  revalidateTag('consultorios');
}

export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  let datos: any;
  try {
    datos = await req.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'Cuerpo inválido.' }, { status: 400 });
  }

  const emisorId = datos?.emisorId;
  const periodo = String(datos?.periodo ?? '');
  const fecha = String(datos?.fecha ?? '');
  const puntoVenta =
    datos?.puntoVenta === '' || datos?.puntoVenta === null || datos?.puntoVenta === undefined
      ? null
      : Number(datos.puntoVenta);
  let numero =
    datos?.numero === '' || datos?.numero === null || datos?.numero === undefined
      ? null
      : Number(datos.numero);

  if (!UUID.test(emisorId ?? '')) {
    return NextResponse.json({ ok: false, motivo: 'Falta quién factura.' }, { status: 400 });
  }
  if (!PERIODO.test(periodo)) {
    return NextResponse.json({ ok: false, motivo: 'El período no es válido.' }, { status: 400 });
  }
  if (!FECHA.test(fecha)) {
    return NextResponse.json({ ok: false, motivo: 'La fecha no es válida.' }, { status: 400 });
  }
  if (numero !== null && (!Number.isInteger(numero) || numero < 1)) {
    return NextResponse.json(
      { ok: false, motivo: 'El número de comprobante tiene que ser entero.' },
      { status: 400 }
    );
  }

  const pedidos: string[] = Array.isArray(datos?.inquilinos)
    ? datos.inquilinos.filter((x: unknown) => typeof x === 'string' && UUID.test(x))
    : [];
  if (pedidos.length === 0) {
    return NextResponse.json({ ok: false, motivo: 'No se eligió a quién facturar.' }, { status: 400 });
  }

  // Qué cargos entran, cuando se eligieron algunos: en la ficha de una persona
  // se tildan renglón por renglón, porque hay meses en los que una reserva se
  // factura aparte o no se factura.
  const soloCargos: string[] | null = Array.isArray(datos?.cargos)
    ? datos.cargos.filter((x: unknown) => typeof x === 'string' && UUID.test(x))
    : null;

  try {
    const cola = await aFacturarDelCentro(periodo);
    const entran = cola
      .filter((i) => pedidos.includes(i.id))
      .map((i) =>
        soloCargos === null
          ? i
          : {
              ...i,
              cargos: i.cargos.filter((c) => soloCargos.includes(c.id)),
            }
      )
      .map((i) => ({ ...i, total: i.cargos.reduce((n, c) => n + c.importe, 0) }))
      .filter((i) => i.cargos.length > 0);
    if (entran.length === 0) {
      return NextResponse.json(
        { ok: false, motivo: 'Eso ya está facturado o no tiene cargos en el período.' },
        { status: 400 }
      );
    }

    const yo = await quienSoy();
    const hechas: { id: string; inquilino: string; numero: number | null }[] = [];

    for (const i of entran) {
      const factura = await escribir('facturas', {
        origen: 'os',
        emisor_id: emisorId,
        inquilino_id: i.id,
        empresa_id: null,
        numero,
        punto_venta: puntoVenta,
        fecha,
        periodo,
        doc_nro: i.cuit,
        imp_total: i.total,
        moneda: 'PES',
        concepto: `Alquiler de consultorio · ${periodoLindo(periodo)}`,
        estado: 'emitida',
        quien: yo.nombre,
      });

      // Un renglón por cargo: el comprobante dice qué día y qué sala se usó, y
      // el movimiento queda atado para que no se vuelva a facturar.
      await escribir(
        'factura_items',
        i.cargos.map((c) => ({
          factura_id: factura.id,
          evaluacion_id: null,
          movimiento_id: c.id,
          descripcion: c.detalle ?? 'Alquiler de consultorio',
          detalle: c.fecha,
          cantidad: 1,
          precio_unitario: c.importe,
          importe: c.importe,
        }))
      );

      hechas.push({ id: factura.id, inquilino: i.nombre, numero });
      if (numero !== null) numero += 1;
    }

    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'facturas_centro',
      recursoId: null,
      detalle: { periodo, facturas: hechas.length, total: entran.reduce((n, i) => n + i.total, 0) },
    });

    refrescar();
    return NextResponse.json({ ok: true, facturas: hechas });
  } catch (e) {
    return NextResponse.json(
      { ok: false, motivo: e instanceof Error ? e.message : 'No se pudo facturar.' },
      { status: 500 }
    );
  }
}
