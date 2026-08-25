import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_CLIENTES, CACHE_COMERCIAL, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';
import { listarAFacturar } from '@/lib/facturas';
import { ESTADOS_FACTURA, totalDe } from '@/lib/facturas-tipos';
import { CATEGORIAS_SERVICIOS } from '@/lib/monotributo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

async function escribir(camino: string, metodo: string, cuerpo?: unknown) {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${camino}`, {
    method: metodo,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: metodo === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return metodo === 'POST' ? (await res.json())[0] : null;
}

function refrescar() {
  revalidateTag(CACHE_COMERCIAL);
  revalidateTag(CACHE_CLIENTES);
  revalidateTag(CACHE_PSICOTECNICOS);
}

/**
 * Alta y mantenimiento de facturas.
 *
 * **Los importes no vienen del navegador.** Se recalculan acá desde las
 * evaluaciones tildadas: el precio de la batería a la fecha del pedido más el
 * adicional Benziger al dólar del día. Lo que el formulario manda es qué entra
 * y con qué número sale, no cuánto sale.
 *
 * **No llama a ARCA.** No hay certificados cargados y, antes de eso, falta la
 * cuenta por persona que pide `SPECS-facturacion.md`. Cuando eso exista, la
 * emisión escribe en esta misma fila el CAE que devuelva, y el comprobante deja
 * de salir con la marca de muestra.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }

  let datos: any;
  try {
    datos = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const yo = await quienSoy();

  try {
    switch (datos?.accion) {
      case 'nueva': {
        const { emisorId, empresaId } = datos;
        if (!UUID.test(emisorId ?? '')) {
          return NextResponse.json({ error: 'Falta quién factura.' }, { status: 400 });
        }
        if (!UUID.test(empresaId ?? '')) {
          return NextResponse.json({ error: 'Falta el cliente.' }, { status: 400 });
        }

        const fecha = String(datos.fecha ?? '');
        if (!FECHA.test(fecha)) {
          return NextResponse.json({ error: 'La fecha no es válida.' }, { status: 400 });
        }

        const numero =
          datos.numero === '' || datos.numero === null || datos.numero === undefined
            ? null
            : Number(datos.numero);
        if (numero !== null && (!Number.isInteger(numero) || numero < 1)) {
          return NextResponse.json(
            { error: 'El número de comprobante tiene que ser entero.' },
            { status: 400 }
          );
        }

        const puntoVenta =
          datos.puntoVenta === '' || datos.puntoVenta === null || datos.puntoVenta === undefined
            ? null
            : Number(datos.puntoVenta);

        const pedidas: string[] = Array.isArray(datos.evaluaciones)
          ? datos.evaluaciones.filter((x: unknown) => typeof x === 'string' && UUID.test(x))
          : [];
        if (pedidas.length === 0) {
          return NextResponse.json(
            { error: 'Hay que elegir al menos una evaluación.' },
            { status: 400 }
          );
        }

        // El precio se vuelve a calcular del lado del servidor. Que la pantalla
        // lo muestre no significa que pueda decidirlo.
        const cola = await listarAFacturar();
        const entran = cola.filter((c) => pedidas.includes(c.evaluacionId));
        if (entran.length !== pedidas.length) {
          return NextResponse.json(
            { error: 'Alguna evaluación ya está facturada. Recargá la pantalla.' },
            { status: 409 }
          );
        }
        // Un comprobante es de un solo cliente: el receptor es uno.
        if (entran.some((e) => e.empresaId !== empresaId)) {
          return NextResponse.json(
            { error: 'No se puede facturar a dos clientes en el mismo comprobante.' },
            { status: 400 }
          );
        }
        const sinPrecio = entran.filter((e) => e.precio === null);
        if (sinPrecio.length > 0) {
          return NextResponse.json(
            {
              error: `Falta el precio de la batería de ${sinPrecio
                .map((e) => e.candidato)
                .join(', ')}. Se carga en Sistema → Baterías.`,
            },
            { status: 400 }
          );
        }

        const total = entran.reduce((n, e) => n + totalDe(e), 0);
        const dolar = entran.find((e) => e.benziger !== null)?.dolar ?? null;

        const factura = await escribir('facturas', 'POST', {
          origen: 'os',
          emisor_id: emisorId,
          empresa_id: empresaId,
          numero,
          punto_venta: puntoVenta,
          fecha,
          imp_total: total,
          moneda: 'PES',
          concepto: String(datos.concepto ?? '').trim() || 'Evaluaciones psicotécnicas',
          orden_compra: String(datos.ordenCompra ?? '').trim() || null,
          notas: String(datos.notas ?? '').trim() || null,
          estado: ESTADOS_FACTURA.includes(datos.estado) ? datos.estado : 'emitida',
          cobrada_at: FECHA.test(datos.cobradaAt ?? '') ? datos.cobradaAt : null,
          // La cotización queda congelada en la factura: el mes que viene el
          // dólar es otro y el comprobante tiene que seguir explicando su total.
          dolar_tarjeta: dolar,
          dolar_fecha: dolar === null ? null : new Date().toISOString(),
          quien: yo.nombre,
        });

        // Un renglón por evaluación, más uno por cada adicional Benziger: en el
        // comprobante son dos conceptos distintos y con dos precios distintos.
        const renglones: Record<string, unknown>[] = [];
        for (const e of entran) {
          renglones.push({
            factura_id: factura.id,
            evaluacion_id: e.evaluacionId,
            descripcion: `Evaluación psicotécnica · ${e.candidato} · ${e.puesto}`,
            detalle: [
              e.bateria,
              e.bateriaNombre,
              e.fechaEntrega ? `informe entregado el ${formatoDia(e.fechaEntrega)}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
            cantidad: 1,
            precio_unitario: e.precio,
            importe: e.precio,
          });
          if (e.benziger !== null) {
            renglones.push({
              factura_id: factura.id,
              // `evaluacion_id` en null y no ausente: el índice único es por
              // evaluación y el adicional es un segundo renglón de la misma.
              // Escrito y no omitido porque PostgREST rechaza un alta en lote
              // donde los objetos no tienen exactamente las mismas claves.
              evaluacion_id: null,
              descripcion: `Adicional Benziger · ${e.candidato}`,
              detalle:
                dolar === null
                  ? 'USD 40'
                  : `USD 40 al dólar tarjeta de hoy ($ ${dolar.toLocaleString('es-AR')})`,
              cantidad: 1,
              precio_unitario: e.benziger,
              importe: e.benziger,
            });
          }
        }

        try {
          await escribir('factura_items', 'POST', renglones);
        } catch (e) {
          // Sin renglones la factura no dice a quién cubre, que es justamente
          // lo que esta pantalla vino a resolver. Se deshace el alta.
          await escribir(`facturas?id=eq.${factura.id}`, 'DELETE');
          // El choque esperable es el índice único por evaluación; cualquier
          // otro error se dice como es, porque atribuirlo a una doble factura
          // manda a buscar el problema donde no está.
          const texto = e instanceof Error ? e.message : '';
          const duplicada = texto.includes('23505') || texto.includes('duplicate key');
          console.error('facturas renglones:', texto);
          return NextResponse.json(
            {
              error: duplicada
                ? 'Alguna evaluación ya está en otra factura. No se guardó nada.'
                : 'No se pudieron guardar los renglones. No se guardó nada.',
            },
            { status: duplicada ? 409 : 500 }
          );
        }

        // La tilde de cobro de la evaluación sigue existiendo y la mira el
        // pipeline: se marca acá para que las dos pantallas digan lo mismo.
        await escribir(`evaluaciones?id=in.(${pedidas.join(',')})`, 'PATCH', {
          facturado: true,
          numero_factura: numero === null ? null : String(numero),
        });

        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'factura',
          recursoId: factura.id,
          detalle: { alta: true, numero, total, evaluaciones: pedidas.length },
        });
        refrescar();
        return NextResponse.json({ ok: true, id: factura.id });
      }

      case 'cobro': {
        const { id } = datos;
        if (!UUID.test(id ?? '')) {
          return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
        }
        const cobradaAt = datos.cobradaAt === null ? null : String(datos.cobradaAt ?? '');
        if (cobradaAt !== null && !FECHA.test(cobradaAt)) {
          return NextResponse.json({ error: 'La fecha de cobro no es válida.' }, { status: 400 });
        }
        await escribir(`facturas?id=eq.${id}`, 'PATCH', { cobrada_at: cobradaAt });
        const cubiertas = await evaluacionesDe(id);
        if (cubiertas) {
          await escribir(`evaluaciones?id=in.(${cubiertas})`, 'PATCH', {
            pagado: cobradaAt !== null,
          });
        }
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'factura',
          recursoId: id,
          detalle: { cobrada_at: cobradaAt },
        });
        refrescar();
        return NextResponse.json({ ok: true });
      }

      /**
       * La categoría del monotributo de una emisora.
       *
       * La elige cada una y la usa la pantalla para decirle cuánto le queda
       * antes de pasarse del tope. De la I a la K son solo para venta de cosas
       * muebles, así que un prestador de servicios no puede estar ahí: se
       * rechazan acá y no solo en el desplegable.
       */
      case 'categoria': {
        const { emisorId, categoria } = datos;
        if (!UUID.test(emisorId ?? '')) {
          return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
        }
        const letra = categoria === null || categoria === '' ? null : String(categoria).toUpperCase();
        if (letra !== null && !CATEGORIAS_SERVICIOS.some((c) => c.letra === letra)) {
          return NextResponse.json({ error: 'Esa categoría no existe.' }, { status: 400 });
        }
        await escribir(`emisores?id=eq.${emisorId}`, 'PATCH', { categoria: letra });
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'emisor',
          recursoId: emisorId,
          detalle: { categoria: letra },
        });
        refrescar();
        return NextResponse.json({ ok: true });
      }

      case 'estado': {
        const { id, estado } = datos;
        if (!UUID.test(id ?? '') || !ESTADOS_FACTURA.includes(estado)) {
          return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
        }
        await escribir(`facturas?id=eq.${id}`, 'PATCH', { estado });
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'factura',
          recursoId: id,
          detalle: { estado },
        });
        refrescar();
        return NextResponse.json({ ok: true });
      }

      case 'borrar': {
        const { id } = datos;
        if (!UUID.test(id ?? '')) {
          return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
        }
        // Los renglones se van con la factura por la clave foránea, y las
        // evaluaciones vuelven a la cola: si la factura no existe, nadie las
        // cubrió.
        const ids = await evaluacionesDe(id);
        await escribir(`facturas?id=eq.${id}`, 'DELETE');
        if (ids) {
          await escribir(`evaluaciones?id=in.(${ids})`, 'PATCH', {
            facturado: false,
            pagado: false,
            numero_factura: null,
          });
        }
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'factura',
          recursoId: id,
          detalle: { borrada: true },
        });
        refrescar();
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
    }
  } catch (e) {
    console.error('facturas:', e);
    return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  }
}

function formatoDia(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/** Los ids de las evaluaciones que entraron en una factura, listos para `in.()`. */
async function evaluacionesDe(facturaId: string): Promise<string> {
  const { url, key } = config();
  const res = await fetch(
    `${url}/rest/v1/factura_items?select=evaluacion_id&factura_id=eq.${facturaId}&evaluacion_id=not.is.null`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
  );
  if (!res.ok) return '';
  const filas: { evaluacion_id: string }[] = await res.json();
  return filas.map((f) => f.evaluacion_id).join(',');
}
