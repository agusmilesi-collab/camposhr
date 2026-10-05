import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_CLIENTES, CACHE_COMERCIAL, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';
import { listarAFacturar } from '@/lib/facturas';
import { conceptoDe, conceptoPorDefecto, totalDe } from '@/lib/facturas-tipos';
import { CATEGORIAS_SERVICIOS } from '@/lib/monotributo';
import { anularConNotaDeCredito, emitirEnArca } from '@/lib/arca/emitir';
import { guardarPdfDeFactura } from '@/lib/factura-archivo';
import { enumerar, faltaParaEmitir, faltaParaFacturarle } from '@/lib/clientes-tipos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Pedir el CAE son tres idas a ARCA, y la primera del día suma el ticket.
export const maxDuration = 60;

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
 * **El alta no llama a ARCA; el CAE se pide aparte**, con la acción `arca`,
 * sobre una factura que ya está guardada en borrador. Separadas, una factura
 * que ARCA rechaza no se pierde: queda con su detalle y el motivo, y se vuelve
 * a pedir cuando se corrigió lo que faltaba.
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

        // Con recibo y sin factura: el mismo alta, sin número ni punto de
        // venta, que son de un comprobante fiscal y acá no hay ninguno.
        const sinComprobante = datos.sinComprobante === true;

        const numero =
          sinComprobante || datos.numero === '' || datos.numero === null || datos.numero === undefined
            ? null
            : Number(datos.numero);
        if (numero !== null && (!Number.isInteger(numero) || numero < 1)) {
          return NextResponse.json(
            { error: 'El número de comprobante tiene que ser entero.' },
            { status: 400 }
          );
        }

        const puntoVenta =
          sinComprobante || datos.puntoVenta === '' || datos.puntoVenta === null || datos.puntoVenta === undefined
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

        // El concepto sale de las evaluaciones, en el orden en que están en la
        // cola, y se puede pisar: hay clientes que piden otro texto. La orden
        // de compra va adentro del concepto además de en su renglón, porque es
        // ahí donde el cliente la busca para aprobar el pago.
        const porDefecto = conceptoPorDefecto(entran);
        const escrito = String(datos.concepto ?? '').trim();
        const ordenCompra = String(datos.ordenCompra ?? '').trim() || null;
        const base = escrito || porDefecto;
        const concepto =
          ordenCompra && !base.includes(ordenCompra)
            ? `${base} · Orden de compra del cliente ${ordenCompra}`
            : base;
        // Con una sola persona, el texto que pidió el cliente es también el del
        // renglón: si no, la factura diría dos cosas distintas por lo mismo.
        const propio = escrito && escrito !== porDefecto && entran.length === 1 ? escrito : null;

        // El control de verdad está acá y no solo en el formulario. A una
        // factura no le puede faltar ningún dato de los que la norma exige del
        // cliente ni de quien emite, y a quien exige su orden de compra no se
        // le factura sin ella. No rige para lo que va sin factura, que no es
        // un comprobante.
        // Con la emisora en producción y sin número, la factura se le va a
        // pedir a ARCA: hasta que la autorice es un borrador.
        let porArca = false;
        if (!sinComprobante) {
          const { url, key } = config();
          const leer = async <T,>(camino: string): Promise<T | undefined> => {
            const res = await fetch(`${url}/rest/v1/${camino}`, {
              headers: { apikey: key, Authorization: `Bearer ${key}` },
              cache: 'no-store',
            });
            return res.ok ? ((await res.json()) as T[])[0] : undefined;
          };
          const [empresa, emisor] = await Promise.all([
            leer<{
              nombre: string;
              razon_social: string | null;
              cuit: string | null;
              condicion_iva: string | null;
              direccion_fiscal: string | null;
              exige_orden_compra: boolean;
            }>(
              'empresas?select=nombre,razon_social,cuit,condicion_iva,direccion_fiscal,exige_orden_compra' +
                `&id=eq.${empresaId}&limit=1`
            ),
            leer<{
              cuit: string | null;
              domicilio: string | null;
              inicio_actividades: string | null;
              ingresos_brutos: string | null;
              ambiente: string | null;
            }>(
              `emisores?select=cuit,domicilio,inicio_actividades,ingresos_brutos,ambiente&id=eq.${emisorId}&limit=1`
            ),
          ]);
          porArca = emisor?.ambiente === 'produccion' && numero === null;
          const faltaCliente = faltaParaFacturarle({
            razonSocial: empresa?.razon_social,
            cuit: empresa?.cuit,
            condicionIva: empresa?.condicion_iva,
            domicilio: empresa?.direccion_fiscal,
          });
          if (faltaCliente.length > 0) {
            return NextResponse.json(
              {
                error: `No se puede facturar: a ${empresa?.nombre ?? 'ese cliente'} le falta ${enumerar(faltaCliente)}. Se carga en su ficha.`,
              },
              { status: 400 }
            );
          }
          const faltaEmisora = faltaParaEmitir({
            cuit: emisor?.cuit,
            domicilio: emisor?.domicilio,
            inicioActividades: emisor?.inicio_actividades,
            ingresosBrutos: emisor?.ingresos_brutos,
          });
          if (faltaEmisora.length > 0) {
            return NextResponse.json(
              { error: `No se puede facturar: a la emisora le falta ${enumerar(faltaEmisora)}.` },
              { status: 400 }
            );
          }
          if (puntoVenta === null) {
            return NextResponse.json(
              { error: 'Falta el punto de venta de la factura.' },
              { status: 400 }
            );
          }
          if (!ordenCompra && empresa?.exige_orden_compra) {
            return NextResponse.json(
              { error: 'Este cliente exige su orden de compra en la factura. Cargala antes de generarla.' },
              { status: 400 }
            );
          }
        }

        const factura = await escribir('facturas', 'POST', {
          origen: 'os',
          emisor_id: emisorId,
          empresa_id: empresaId,
          numero,
          punto_venta: puntoVenta,
          fecha,
          imp_total: total,
          moneda: 'PES',
          concepto,
          orden_compra: ordenCompra,
          notas: String(datos.notas ?? '').trim() || null,
          // La que se le va a pedir a ARCA todavía no salió por ningún lado:
          // es un borrador hasta que la autorice. Como emitida contaba para
          // el monotributo y se le podía marcar el cobro antes de existir.
          estado: porArca ? 'borrador' : 'emitida',
          sin_comprobante: sinComprobante,
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
            descripcion: propio ?? conceptoDe(e),
            // Sin segunda línea: la batería y la fecha de entrega son datos
            // del trabajo interno, y en el papel del cliente no van.
            detalle: null,
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
              descripcion: `Adicional BTSA, ${e.candidato}`,
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
          detalle: { alta: true, numero, total, evaluaciones: pedidas.length, sinComprobante },
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
        // Se cobra lo que se emitió. Un borrador, una rechazada, una anulada
        // o una nota de crédito no tienen qué cobrar, y marcarlas les daba
        // un recibo de pago numerado. Desmarcar se puede siempre.
        if (cobradaAt !== null) {
          const f = await leerFactura(id);
          if (!f) return NextResponse.json({ error: 'Esa factura no existe.' }, { status: 404 });
          if (f.cbte_tipo !== 11 || f.estado !== 'emitida') {
            return NextResponse.json(
              { error: 'Solo se marca el cobro de una factura emitida.' },
              { status: 409 }
            );
          }
        }
        await escribir(`facturas?id=eq.${id}`, 'PATCH', { cobrada_at: cobradaAt });
        // Al cobrar se le pone número al recibo de pago, si todavía no tiene.
        // Desmarcar no lo borra: ese recibo ya pudo haberse entregado.
        if (cobradaAt !== null) {
          try {
            await escribir('rpc/asignar_recibo_pago', 'POST', { factura: id });
          } catch (e) {
            console.error('facturas, recibo de pago:', e);
          }
        }
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
       * Una factura que no sale del pipeline.
       *
       * Las evaluadoras no facturan solo psicotécnicos: los servicios de Campos
       * HR (un ciclo de encuentros, un trabajo de estructura) los emite una de
       * las dos con su propio CUIT, y ese ingreso va contra su monotributo
       * igual que los psicotécnicos. Sin poder cargarlas, la cuenta del tope
       * mentía por abajo, que es la forma peligrosa de mentir.
       *
       * **Acá el importe sí viene del formulario.** En las del pipeline se
       * recalcula desde las evaluaciones tildadas, porque hay de dónde; en
       * estas no hay nada que calcular: lo que se factura es lo que se acordó.
       */
      case 'suelta': {
        const { emisorId, empresaId } = datos;
        if (!UUID.test(emisorId ?? '') || !UUID.test(empresaId ?? '')) {
          return NextResponse.json(
            { error: 'Falta quién factura o a quién.' },
            { status: 400 }
          );
        }
        const fecha = String(datos.fecha ?? '');
        if (!FECHA.test(fecha)) {
          return NextResponse.json({ error: 'La fecha no es válida.' }, { status: 400 });
        }
        const concepto = String(datos.concepto ?? '').trim();
        if (concepto.length < 3) {
          return NextResponse.json(
            { error: 'Escribí qué se está facturando.' },
            { status: 400 }
          );
        }
        const importe = Number(datos.importe);
        if (!Number.isFinite(importe) || importe <= 0) {
          return NextResponse.json({ error: 'El importe no es válido.' }, { status: 400 });
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

        const factura = await escribir('facturas', 'POST', {
          origen: 'os',
          emisor_id: emisorId,
          empresa_id: empresaId,
          numero,
          punto_venta: puntoVenta,
          fecha,
          imp_total: importe,
          moneda: 'PES',
          concepto,
          // De qué trabajo es: es lo que deja cruzar lo cobrado con lo que ese
          // trabajo costó. Sin cotización la factura entra igual.
          cotizacion_id: UUID.test(datos.cotizacionId ?? '') ? datos.cotizacionId : null,
          orden_compra: String(datos.ordenCompra ?? '').trim() || null,
          notas: String(datos.notas ?? '').trim() || null,
          // En borrador cuando el CAE se va a pedir desde acá; emitida cuando
          // se está anotando una que ya salió por Comprobantes en Línea.
          estado: datos.estado === 'borrador' ? 'borrador' : 'emitida',
          quien: yo.nombre,
        });

        // Un renglón, con lo mismo que el concepto: el comprobante necesita
        // decir qué se cobra, y sin renglones sale en blanco.
        await escribir('factura_items', 'POST', [
          {
            factura_id: factura.id,
            evaluacion_id: null,
            descripcion: concepto,
            detalle: String(datos.detalle ?? '').trim() || null,
            cantidad: 1,
            precio_unitario: importe,
            importe,
          },
        ]);

        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'factura',
          recursoId: factura.id,
          detalle: { suelta: true, concepto, importe },
        });
        refrescar();
        return NextResponse.json({ ok: true, id: factura.id });
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

      /**
       * Pedir el CAE. Todo lo que decide el comprobante está en
       * `lib/arca/emitir.ts`; acá se anota quién lo pidió y se pasa el número
       * a las evaluaciones, que es lo que mira el pipeline.
       */
      case 'arca': {
        const { id } = datos;
        if (!UUID.test(id ?? '')) {
          return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
        }
        const r = await emitirEnArca(id);
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'factura',
          recursoId: id,
          detalle: r.ok
            ? { arca: 'autorizada', ambiente: r.ambiente, numero: r.numero, cae: r.cae }
            : { arca: 'sin autorizar', motivo: r.error },
        });
        refrescar();
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        // Autorizada. Lo que sigue es accesorio: si falla, la factura está
        // emitida igual y la respuesta no puede decir "no se pudo guardar".
        try {
          // Su PDF, con los tres ejemplares.
          await guardarPdfDeFactura(id);
          const cubiertas = await evaluacionesDe(id);
          if (cubiertas) {
            await escribir(`evaluaciones?id=in.(${cubiertas})`, 'PATCH', {
              numero_factura: String(r.numero),
            });
          }
        } catch (e) {
          console.error('facturas, después del CAE:', e);
        }
        return NextResponse.json(r);
      }

      /**
       * Anular una factura con CAE, con una nota de crédito por el total.
       * Todo lo que decide está en `lib/arca/emitir.ts`.
       */
      case 'anular': {
        const { id } = datos;
        if (!UUID.test(id ?? '')) {
          return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
        }
        const r = await anularConNotaDeCredito(id, yo.nombre);
        await anotarAcceso({
          quien: yo.nombre,
          accion: 'escritura',
          recurso: 'factura',
          recursoId: id,
          detalle: r.ok
            ? { anulada: true, nota_de_credito: r.numero, cae: r.cae, ambiente: r.ambiente }
            : { anulada: false, motivo: r.error },
        });
        refrescar();
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
        // La nota de crédito también es un comprobante: se guarda su PDF.
        try {
          await guardarPdfDeFactura(r.notaId);
        } catch (e) {
          console.error('facturas, PDF de la nota:', e);
        }
        return NextResponse.json(r);
      }

      case 'borrar': {
        const { id } = datos;
        if (!UUID.test(id ?? '')) {
          return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
        }
        // Una factura autorizada por ARCA existe en ARCA, se quite de acá o
        // no: borrarla dejaría a esas personas otra vez en la cola y a la
        // evaluadora con una factura emitida que el sistema ya no conoce. Se
        // anula con una nota de crédito. Las de homologación sí se quitan: su
        // CAE no vale.
        const f = await leerFactura(id);
        // Sin poder leerla no se borra: borrar a ciegas es justo lo que este
        // control vino a impedir.
        if (!f) return NextResponse.json({ error: 'Esa factura no existe.' }, { status: 404 });
        if (f.cbte_tipo !== 11) {
          return NextResponse.json({ error: 'Una nota de crédito no se quita.' }, { status: 409 });
        }
        if (f.ambiente === 'produccion' && f.cae) {
          return NextResponse.json(
            { error: 'Esa factura tiene CAE: no se quita, se anula con una nota de crédito.' },
            { status: 409 }
          );
        }
        // Con número reservado y sin CAE no se sabe si ARCA la autorizó:
        // borrarla ahí es perder una factura que quizá existe.
        if (f.ambiente === 'produccion' && f.numero !== null && f.solicitud !== null) {
          return NextResponse.json(
            {
              error:
                'Esa factura quedó a medio emitir. Abrila y apretá Pedir CAE: averigua en qué quedó, y después se puede quitar.',
            },
            { status: 409 }
          );
        }
        // Una de prueba que se anuló arrastra su nota de crédito, que apunta
        // a ella: se va primero.
        if (f.ambiente === 'homologacion') {
          await escribir(`facturas?anula_id=eq.${id}&ambiente=eq.homologacion`, 'DELETE');
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

type Leida = {
  cae: string | null;
  ambiente: string | null;
  numero: number | null;
  estado: string;
  cbte_tipo: number;
  solicitud: unknown;
};

/** Lo que hay que saber de una factura antes de tocarla. Tira error si la lectura falla. */
async function leerFactura(id: string): Promise<Leida | undefined> {
  const { url, key } = config();
  const res = await fetch(
    `${url}/rest/v1/facturas?select=cae,ambiente,numero,estado,cbte_tipo,solicitud&id=eq.${id}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return ((await res.json()) as Leida[])[0];
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
