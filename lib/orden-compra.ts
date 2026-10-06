/**
 * La orden de compra: crearla cuando se cargan candidatos, y leerla.
 *
 * Ver `supabase/ordenes-compra.sql` para qué es y por qué no vive en
 * `facturas`. Acá están las dos cosas que la arman: lo que sale una carga de
 * candidatos, y cómo se lee una orden ya guardada para dibujarla.
 *
 * Hay además una forma vieja: antes de que la orden naciera con la carga, el
 * botón "Sin factura" generaba el papel desde una fila de `facturas`. Esas
 * siguen pudiéndose bajar, y `ordenDeFactura` las lee con la misma forma.
 */

import 'server-only';
import { randomBytes } from 'node:crypto';
import { insert, select } from '@/lib/supabase';
import { BENZIGER_USD, dolarTarjeta, precioA, type Precio } from '@/lib/baterias-precios';
import { llevaBenziger } from '@/lib/benziger';
import { verFactura } from '@/lib/facturas';
import { conceptoDe } from '@/lib/facturas-tipos';
import { REFERENCIA_EN_LA_HOJA, type FilaOrden, type Orden } from '@/lib/orden-compra-tipos';

export * from '@/lib/orden-compra-tipos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^oc_[A-Za-z0-9_-]{16,40}$/;

const conCargo = (s: { nombre: string; cargo: string | null }) =>
  s.cargo ? `${s.nombre.trim()}, ${s.cargo.trim()}` : s.nombre.trim();

/**
 * La aclaración del adicional, que se cobra en dólares.
 *
 * El importe que muestra la orden está pesificado al dólar tarjeta del día en
 * que se generó, pero **lo que se cobra es al dólar del día de facturación**:
 * la orden sale semanas antes que la factura. Hay que decirlo en el papel, o
 * el cliente reclama la diferencia con razón.
 */
function notaDelDolar(concepto: string, dolares: number, cotizacion: number | null): string {
  return (
    `${concepto}: USD ${dolares}, que se facturan al dólar tarjeta del día de facturación.` +
    (cotizacion
      ? ` El importe de esta orden usa como referencia ${REFERENCIA_EN_LA_HOJA} ($ ${cotizacion.toLocaleString('es-AR')}).`
      : '')
  );
}

type FilaCarga = {
  id: string;
  con_benziger: boolean | null;
  benziger_administrado: boolean | null;
  solicitante_id: string | null;
  personas: { nombre: string } | null;
  pedidos: {
    id: string;
    puesto: string;
    empresa_id: string;
    fecha_pedido: string | null;
    con_benziger: boolean | null;
    solicitante_id: string | null;
    baterias: { id: string } | null;
  } | null;
};

/**
 * La orden de una carga de candidatos.
 *
 * Una orden por carga y no por pedido: es lo que la persona acaba de pedir, y
 * lo que tiene que poder mirar y aprobar. Si mañana suma dos candidatos al
 * mismo pedido, esos dos van en otra.
 *
 * El precio de la batería es el que regía a la fecha del pedido, igual que en
 * la factura: sumar un candidato a una búsqueda de marzo no le aplica el
 * aumento de esta semana. Sin precio cargado el renglón va sin importe, y la
 * orden se genera igual: que falte un precio no puede frenar una carga.
 */
export async function crearOrden(
  evaluacionIds: string[],
  origen: 'portal' | 'os'
): Promise<Orden | null> {
  const ids = evaluacionIds.filter((x) => UUID.test(x));
  if (ids.length === 0) return null;

  const [cargas, cambio] = await Promise.all([
    select<FilaCarga>(
      'evaluaciones',
      'select=id,con_benziger,benziger_administrado,solicitante_id,personas(nombre),' +
        'pedidos(id,puesto,empresa_id,fecha_pedido,con_benziger,solicitante_id,baterias(id))' +
        `&id=in.(${ids.join(',')})`
    ),
    dolarTarjeta(),
  ]);
  // En el orden en que se cargaron, que es como el cliente los escribió.
  const enOrden = ids
    .map((id) => cargas.find((c) => c.id === id))
    .filter((c): c is FilaCarga => Boolean(c?.pedidos));
  if (enOrden.length === 0) return null;

  const pedido = enOrden[0].pedidos!;
  const baterias = [...new Set(enOrden.map((c) => c.pedidos!.baterias?.id).filter(Boolean))];
  const precios =
    baterias.length > 0
      ? await select<Precio>(
          'bateria_precios',
          `select=id,bateria_id,precio,desde,quien&bateria_id=in.(${baterias.join(',')})&order=desde.desc`
        )
      : [];

  const items: Record<string, unknown>[] = [];
  for (const c of enOrden) {
    const p = c.pedidos!;
    const nombre = c.personas?.nombre?.trim() ?? 'sin nombre';
    const suyos = precios.filter((x) => x.bateria_id === p.baterias?.id);
    items.push({
      evaluacion_id: c.id,
      concepto: `Perfil ${p.puesto.trim()}`,
      detalle: nombre,
      nota: null,
      importe: precioA(suyos, p.fecha_pedido),
    });
    if (llevaBenziger(c)) {
      items.push({
        evaluacion_id: c.id,
        concepto: 'Adicional BTSA',
        detalle: nombre,
        nota: notaDelDolar('Adicional BTSA', BENZIGER_USD, cambio?.valor ?? null),
        importe: cambio ? Math.round(BENZIGER_USD * cambio.valor) : null,
      });
    }
  }
  const total = items.reduce((n, i) => n + (Number(i.importe) || 0), 0);

  const orden = await insert<{ id: string }>('ordenes_compra', {
    token: `oc_${randomBytes(16).toString('base64url')}`,
    empresa_id: pedido.empresa_id,
    pedido_id: pedido.id,
    solicitante_id: enOrden[0].solicitante_id ?? pedido.solicitante_id,
    dolar_tarjeta: cambio?.valor ?? null,
    total,
    origen,
  });
  for (const [i, item] of items.entries()) {
    await insert('orden_items', { ...item, orden_id: orden.id, posicion: i });
  }
  return verOrden(orden.id);
}

type FilaOrdenGuardada = {
  id: string;
  numero: number;
  token: string;
  fecha: string;
  total: string | number;
  empresas: { nombre: string; razon_social: string | null } | null;
  solicitante: { nombre: string; cargo: string | null } | null;
  pedidos: { solicitante: { nombre: string; cargo: string | null } | null } | null;
  orden_items: {
    posicion: number;
    concepto: string;
    detalle: string | null;
    nota: string | null;
    importe: string | number | null;
    evaluaciones: { pagado: boolean | null } | null;
  }[];
};

/** Una orden guardada, por su identificador o por el token con que la baja el cliente. */
export async function verOrden(clave: string): Promise<Orden | null> {
  const filtro = UUID.test(clave) ? `id=eq.${clave}` : TOKEN.test(clave) ? `token=eq.${clave}` : null;
  if (!filtro) return null;
  const [o] = await select<FilaOrdenGuardada>(
    'ordenes_compra',
    'select=id,numero,token,fecha,total,empresas(nombre,razon_social),' +
      'solicitante:contactos!solicitante_id(nombre,cargo),' +
      'pedidos(solicitante:contactos!solicitante_id(nombre,cargo)),' +
      'orden_items(posicion,concepto,detalle,nota,importe,evaluaciones(pagado))' +
      `&${filtro}&limit=1`
  );
  if (!o) return null;
  const items = [...o.orden_items].sort((a, b) => a.posicion - b.posicion);
  const pagas = items.filter((i) => i.evaluaciones).every((i) => i.evaluaciones?.pagado);
  return {
    id: o.id,
    numero: String(o.numero).padStart(4, '0'),
    token: o.token,
    fecha: o.fecha,
    cliente: o.empresas?.razon_social ?? o.empresas?.nombre ?? 'sin cliente',
    // El de la orden y, si no quedó guardado, el del pedido: al pedido se le
    // puede cargar quién lo pidió después de que la orden ya existe.
    solicitantes: [o.solicitante ?? o.pedidos?.solicitante ?? null]
      .filter((x): x is { nombre: string; cargo: string | null } => Boolean(x?.nombre))
      .map(conCargo),
    estado: items.length > 0 && pagas ? 'Pagado' : 'Pendiente de pago',
    referencia: null,
    filas: items.map((i) => ({
      concepto: i.concepto,
      detalle: i.detalle ?? '',
      nota: i.nota ?? '',
      importe: i.importe === null ? null : Number(i.importe),
    })),
    total: Number(o.total),
    notas: null,
  };
}

/**
 * Las órdenes de compra que cubren a esas evaluaciones, de la más vieja a la
 * más nueva.
 *
 * **Pueden ser varias.** Una factura junta candidatos de distintas cargas (los
 * tres del arranque y los dos que se sumaron después), y cada carga tiene su
 * orden. `todas` dice si no quedó ninguna evaluación afuera: las cargadas
 * antes de que existieran las órdenes no tienen ninguna.
 */
export async function ordenesQueCubren(
  evaluacionIds: string[]
): Promise<{ ordenes: { id: string; numero: string }[]; todas: boolean }> {
  const ids = evaluacionIds.filter((x) => UUID.test(x));
  if (ids.length === 0) return { ordenes: [], todas: false };
  const filas = await select<{
    evaluacion_id: string;
    ordenes_compra: { id: string; numero: number } | null;
  }>('orden_items', `select=evaluacion_id,ordenes_compra(id,numero)&evaluacion_id=in.(${ids.join(',')})`);
  const porId = new Map<string, number>();
  for (const f of filas) if (f.ordenes_compra) porId.set(f.ordenes_compra.id, f.ordenes_compra.numero);
  const cubiertas = new Set(filas.map((f) => f.evaluacion_id));
  return {
    ordenes: [...porId.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([id, numero]) => ({ id, numero: String(numero).padStart(4, '0') })),
    todas: ids.every((id) => cubiertas.has(id)),
  };
}

/**
 * El número de orden de cada evaluación, de un saque.
 *
 * Para la lista de facturas: lo que va sin factura se nombra por su orden de
 * compra, y pedirlas de a una factura serían tantas consultas como filas.
 */
export async function ordenPorEvaluacion(evaluacionIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(evaluacionIds.filter((x) => UUID.test(x)))];
  const mapa = new Map<string, string>();
  // De a tandas: los ids viajan en la dirección de la consulta.
  for (let i = 0; i < ids.length; i += 100) {
    const filas = await select<{ evaluacion_id: string; ordenes_compra: { numero: number } | null }>(
      'orden_items',
      `select=evaluacion_id,ordenes_compra(numero)&evaluacion_id=in.(${ids.slice(i, i + 100).join(',')})`
    );
    for (const f of filas) {
      if (f.ordenes_compra) mapa.set(f.evaluacion_id, String(f.ordenes_compra.numero).padStart(4, '0'));
    }
  }
  return mapa;
}

// ------------------------------------------------------- la forma vieja

/**
 * El renglón de una factura partido en dos: qué se hizo y sobre quién.
 *
 * Los renglones de las facturas se guardan como una sola frase ("Perfil Jefe
 * de depósito, Nahuel Ibarra"). Solo se separan cuando la frase es la que arma
 * el sistema: una que escribió alguien a mano va entera.
 */
function filaDeFactura(r: {
  descripcion: string;
  detalle: string | null;
  importe: number | null;
  persona: string | null;
  puesto: string | null;
}): FilaOrden {
  if (r.persona && r.puesto && r.descripcion === conceptoDe({ puesto: r.puesto, candidato: r.persona })) {
    return { concepto: `Perfil ${r.puesto.trim()}`, detalle: r.persona.trim(), nota: '', importe: r.importe };
  }
  const adicional = r.descripcion.match(/^(Adicional BTSA), (.+)$/);
  if (adicional) {
    // El renglón guarda "USD 40 al dólar tarjeta de hoy ($ 2.002)".
    const dolares = Number(r.detalle?.match(/USD\s*([\d.,]+)/)?.[1]?.replace(/\./g, '').replace(',', '.'));
    const cotizacion = Number(
      r.detalle?.match(/\(\$\s*([\d.,]+)\)/)?.[1]?.replace(/\./g, '').replace(',', '.')
    );
    return {
      concepto: adicional[1],
      detalle: adicional[2],
      nota: dolares ? notaDelDolar(adicional[1], dolares, cotizacion || null) : r.detalle ?? '',
      importe: r.importe,
    };
  }
  return { concepto: r.descripcion, detalle: r.detalle ?? '', nota: '', importe: r.importe };
}

type FilaSolicitante = {
  evaluaciones: {
    solicitante: { nombre: string; cargo: string | null } | null;
    pedidos: { solicitante: { nombre: string; cargo: string | null } | null } | null;
  } | null;
};

/**
 * El papel de una fila de `facturas` marcada "sin comprobante", con la forma
 * de una orden. Son las que se generaron antes de que la orden naciera con la
 * carga de candidatos.
 */
export async function ordenDeFactura(facturaId: string): Promise<Orden | null> {
  if (!UUID.test(facturaId)) return null;
  const f = await verFactura(facturaId);
  if (!f || !f.sinComprobante) return null;
  // Si a esas personas las cubre una sola orden, de las que nacen con la
  // carga, el papel es esa orden: el cliente ya la tiene, con ese número, y no
  // hay que darle otra. Si son varias, este papel las junta y las nombra.
  const { ordenes, todas } = await ordenesQueCubren(
    f.renglones.map((r) => r.evaluacionId).filter((x): x is string => Boolean(x))
  );
  if (ordenes.length === 1 && todas) return verOrden(ordenes[0].id);
  const [[extra], pidieron] = await Promise.all([
    select<{ recibo_numero: number | null; empresas: { razon_social: string | null } | null }>(
      'facturas',
      `select=recibo_numero,empresas(razon_social)&id=eq.${f.id}&limit=1`
    ),
    select<FilaSolicitante>(
      'factura_items',
      'select=evaluaciones(solicitante:contactos!solicitante_id(nombre,cargo),' +
        'pedidos(solicitante:contactos!solicitante_id(nombre,cargo)))' +
        `&factura_id=eq.${f.id}&evaluacion_id=not.is.null`
    ),
  ]);
  const solicitantes = pidieron
    .map((p) => p.evaluaciones?.solicitante ?? p.evaluaciones?.pedidos?.solicitante ?? null)
    .filter((s): s is { nombre: string; cargo: string | null } => Boolean(s?.nombre))
    .map(conCargo);
  const filas: FilaOrden[] =
    f.renglones.length > 0
      ? f.renglones.map(filaDeFactura)
      : [{ concepto: f.concepto ?? 'Servicios profesionales', detalle: '', nota: '', importe: f.importe }];
  return {
    id: f.id,
    numero: extra?.recibo_numero ? String(extra.recibo_numero).padStart(4, '0') : null,
    token: null,
    fecha: f.fecha,
    cliente: extra?.empresas?.razon_social ?? f.cliente,
    solicitantes: [...new Set(solicitantes)],
    estado: f.cobradaAt ? 'Pagado' : 'Pendiente de pago',
    referencia: f.ordenCompra,
    reune: ordenes.map((o) => o.numero),
    filas,
    total: f.renglones.reduce((n, r) => n + (r.importe ?? 0), 0) || f.importe || 0,
    notas: f.notas,
  };
}

/**
 * El recibo de pago de una factura cobrada, con la forma de una orden: la
 * misma hoja, con otro título y otros datos (ver `formaDelRecibo`).
 *
 * Sale de cualquier fila de Facturación que esté cobrada, tenga factura o vaya
 * sin ella. Null si no está cobrada: no hay pago del que dar recibo.
 */
export async function reciboDePago(
  facturaId: string
): Promise<{ papel: Orden; pagadoEl: string; comprobante: string | null; formaPago: string | null } | null> {
  if (!UUID.test(facturaId)) return null;
  const f = await verFactura(facturaId);
  if (!f || !f.cobradaAt) return null;
  const evaluaciones = f.renglones.map((r) => r.evaluacionId).filter((x): x is string => Boolean(x));
  const [[extra], pidieron, cubre] = await Promise.all([
    select<{
      recibo_pago_numero: number | null;
      recibo_numero: number | null;
      forma_pago: string | null;
      empresas: { razon_social: string | null } | null;
    }>(
      'facturas',
      `select=recibo_pago_numero,recibo_numero,forma_pago,empresas(razon_social)&id=eq.${f.id}&limit=1`
    ),
    select<FilaSolicitante>(
      'factura_items',
      'select=evaluaciones(solicitante:contactos!solicitante_id(nombre,cargo),' +
        'pedidos(solicitante:contactos!solicitante_id(nombre,cargo)))' +
        `&factura_id=eq.${f.id}&evaluacion_id=not.is.null`
    ),
    ordenesQueCubren(evaluaciones),
  ]);
  const solicitantes = pidieron
    .map((p) => p.evaluaciones?.solicitante ?? p.evaluaciones?.pedidos?.solicitante ?? null)
    .filter((s): s is { nombre: string; cargo: string | null } => Boolean(s?.nombre))
    .map(conCargo);

  // Qué se está pagando: la factura con su número y las órdenes de compra que
  // esa factura cubre, que pueden ser varias. Las órdenes viejas guardaron su
  // número en la factura misma. Sin factura y sin orden no hay comprobante que
  // nombrar, y la línea no sale.
  const numeros = cubre.ordenes.map((o) => `#${o.numero}`);
  if (numeros.length === 0 && extra?.recibo_numero) {
    numeros.push(`#${String(extra.recibo_numero).padStart(4, '0')}`);
  }
  const deOrdenes =
    numeros.length === 0
      ? null
      : `${numeros.length === 1 ? 'Orden de compra' : 'Órdenes de compra'} ${numeros.join(', ')}`;
  const deFactura = f.sinComprobante
    ? null
    : f.numero === null
      ? 'Factura C'
      : `Factura C ${f.puntoVenta === null ? '' : `${String(f.puntoVenta).padStart(5, '0')}-`}${String(f.numero).padStart(8, '0')}`;
  const comprobante = [deFactura, deOrdenes].filter(Boolean).join(' · ') || null;

  return {
    pagadoEl: f.cobradaAt,
    comprobante,
    formaPago: extra?.forma_pago ?? null,
    papel: {
      id: f.id,
      numero: extra?.recibo_pago_numero ? String(extra.recibo_pago_numero).padStart(4, '0') : null,
      token: null,
      fecha: f.cobradaAt,
      cliente: extra?.empresas?.razon_social ?? f.cliente,
      solicitantes: [...new Set(solicitantes)],
      estado: 'Pagado',
      referencia: f.ordenCompra,
      // Sin las aclaraciones de los renglones: la del dólar habla de cómo se
      // va a facturar, y acá ya se pagó.
      filas:
        f.renglones.length > 0
          ? f.renglones.map((r) => ({ ...filaDeFactura(r), nota: '' }))
          : [{ concepto: f.concepto ?? 'Servicios profesionales', detalle: '', nota: '', importe: f.importe }],
      total: f.renglones.reduce((n, r) => n + (r.importe ?? 0), 0) || f.importe || 0,
      notas: null,
    },
  };
}

/** Una orden por su identificador, sea de las nuevas o de las viejas. */
export async function ordenPorId(id: string): Promise<Orden | null> {
  return (await verOrden(id)) ?? (await ordenDeFactura(id));
}
