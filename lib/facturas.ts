/**
 * Las facturas emitidas, y qué evaluación entró en cada una.
 *
 * Registra lo que ya se emitió. No emite: emitir contra ARCA necesita
 * certificados y, antes que eso, una cuenta real por persona, porque cada
 * evaluadora factura con su CUIT y hoy la identidad del OS es una cookie de
 * preferencia. El plan entero está en `CAMPOS OS/SPECS-facturacion.md`.
 *
 * Las tablas son las que ese spec define, así que cuando ARCA entre no hay que
 * mudar nada: una factura emitida por el sistema es esta misma fila con `cae`
 * cargado.
 *
 * **"A facturar" no es una etapa que alguien marca, se deduce.** Una evaluación
 * está para facturar cuando la entrevista ya se tomó y todavía no entró en
 * ningún comprobante. Por eso corre en paralelo al estado del informe: se
 * factura el trabajo hecho, y que el informe esté escrito o no es otra cosa.
 * Deducirlo evita el problema de siempre, que es una tilde que nadie actualizó.
 *
 * **El cobro es otro eje que la emisión.** `estado` dice qué pasó con el
 * comprobante y `cobrada_at` dice si entró la plata. Una factura emitida y sin
 * cobrar es la situación normal.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_COMERCIAL } from '@/lib/etiquetas';
import { BENZIGER_USD, dolarTarjeta, precioA, type Precio } from '@/lib/baterias-precios';
import type { Emisora, Factura, Facturable } from '@/lib/facturas-tipos';

export {
  ESTADOS_FACTURA,
  ETAPAS_ENTREVISTADO,
  formatoFecha,
  formatoImporte,
  numeroDe,
  type Emisora,
  type EstadoFactura,
  type Factura,
  type Facturable,
  type Renglon,
} from '@/lib/facturas-tipos';

/**
 * Las etapas en las que la entrevista ya se tomó.
 *
 * No se importa de `facturas-tipos` para tenerla al lado de la consulta que la
 * usa; la constante vive allá porque también la lee el navegador.
 */
import { ETAPAS_ENTREVISTADO } from '@/lib/facturas-tipos';

type FilaEmisor = {
  id: string;
  cuit: string | null;
  razon_social: string;
  nombre_fantasia: string | null;
  punto_venta: number | null;
  domicilio: string | null;
  inicio_actividades: string | null;
  condicion_iva: string;
  categoria: string | null;
  evaluadoras: { nombre: string } | null;
};

type FilaFactura = {
  id: string;
  numero: number | null;
  punto_venta: number | null;
  fecha: string;
  emisor_id: string;
  empresa_id: string;
  concepto: string | null;
  orden_compra: string | null;
  imp_total: string | number | null;
  moneda: string;
  estado: Factura['estado'];
  cobrada_at: string | null;
  notas: string | null;
  cae: string | null;
  cae_vence_el: string | null;
  emisores: { razon_social: string; evaluadoras: { nombre: string } | null } | null;
  empresas: { nombre: string } | null;
  factura_items: {
    id: string;
    evaluacion_id: string | null;
    descripcion: string;
    detalle: string | null;
    importe: string | number | null;
  }[];
};

const numeroOno = (x: string | number | null) => (x === null ? null : Number(x));

/** Quiénes pueden facturar. Son las evaluadoras que tienen su monotributo. */
export async function listarEmisoras(): Promise<Emisora[]> {
  const filas = await select<FilaEmisor>(
    'emisores',
    'select=id,cuit,razon_social,nombre_fantasia,punto_venta,domicilio,inicio_actividades,' +
      'condicion_iva,categoria,evaluadoras(nombre)&activo=eq.true&order=razon_social',
    CACHE_COMERCIAL
  );
  return filas.map((f) => ({
    id: f.id,
    nombre: f.evaluadoras?.nombre ?? f.razon_social,
    razonSocial: f.razon_social,
    nombreFantasia: f.nombre_fantasia,
    cuit: f.cuit,
    puntoVenta: f.punto_venta,
    domicilio: f.domicilio,
    inicioActividades: f.inicio_actividades,
    condicionIva: f.condicion_iva,
    categoria: f.categoria,
  }));
}

/** Todas, de la más reciente a la más vieja, con sus renglones. */
export async function listarFacturas(): Promise<Factura[]> {
  const filas = await select<FilaFactura>(
    'facturas',
    'select=id,numero,punto_venta,fecha,emisor_id,empresa_id,concepto,orden_compra,' +
      'imp_total,moneda,estado,cobrada_at,notas,cae,cae_vence_el,' +
      'emisores(razon_social,evaluadoras(nombre)),empresas(nombre),' +
      'factura_items(id,evaluacion_id,descripcion,detalle,importe)' +
      '&order=fecha.desc,numero.desc',
    CACHE_COMERCIAL
  );
  return filas.map(armarFactura);
}

/** Una sola, para el comprobante. */
export async function verFactura(id: string): Promise<Factura | null> {
  const filas = await select<FilaFactura>(
    'facturas',
    'select=id,numero,punto_venta,fecha,emisor_id,empresa_id,concepto,orden_compra,' +
      'imp_total,moneda,estado,cobrada_at,notas,cae,cae_vence_el,' +
      'emisores(razon_social,evaluadoras(nombre)),empresas(nombre),' +
      'factura_items(id,evaluacion_id,descripcion,detalle,importe)' +
      `&id=eq.${id}&limit=1`
  );
  return filas[0] ? armarFactura(filas[0]) : null;
}

function armarFactura(f: FilaFactura): Factura {
  return {
    id: f.id,
    numero: f.numero,
    puntoVenta: f.punto_venta,
    fecha: f.fecha,
    emisorId: f.emisor_id,
    emisora: f.emisores?.evaluadoras?.nombre ?? f.emisores?.razon_social ?? 'sin emisora',
    empresaId: f.empresa_id,
    cliente: f.empresas?.nombre ?? 'sin cliente',
    concepto: f.concepto,
    ordenCompra: f.orden_compra,
    importe: numeroOno(f.imp_total),
    moneda: f.moneda,
    estado: f.estado,
    cobradaAt: f.cobrada_at,
    notas: f.notas,
    cae: f.cae,
    caeVenceEl: f.cae_vence_el,
    renglones: (f.factura_items ?? []).map((r) => ({
      id: r.id,
      evaluacionId: r.evaluacion_id,
      descripcion: r.descripcion,
      detalle: r.detalle,
      importe: numeroOno(r.importe),
    })),
  };
}

type FilaFacturable = {
  id: string;
  estado: string;
  fecha_entrevista: string | null;
  fecha_entrega: string | null;
  benziger_administrado: boolean | null;
  personas: { nombre: string } | null;
  evaluadoras: { nombre: string } | null;
  pedidos: {
    puesto: string;
    empresa_id: string;
    fecha_pedido: string | null;
    con_benziger: boolean | null;
    empresas: { nombre: string } | null;
    baterias: { id: string; codigo: string; nombre: string } | null;
  } | null;
};

/**
 * Lo que está para facturar: entrevista tomada y sin comprobante.
 *
 * El precio no sale de la batería de hoy sino de su historia a la fecha del
 * pedido, igual que en la ficha: un aumento de esta semana no cambia lo que
 * valió una evaluación de marzo. El adicional Benziger se pesifica al dólar
 * tarjeta del día, y recién se congela cuando la factura se emite.
 */
export async function listarAFacturar(): Promise<Facturable[]> {
  const etapas = ETAPAS_ENTREVISTADO.map((e) => `"${e}"`).join(',');
  const [evaluaciones, renglones, precios, cambio] = await Promise.all([
    select<FilaFacturable>(
      'evaluaciones',
      'select=id,estado,fecha_entrevista,fecha_entrega,benziger_administrado,' +
        'personas(nombre),evaluadoras(nombre),' +
        'pedidos(puesto,empresa_id,fecha_pedido,con_benziger,empresas(nombre),' +
        'baterias(id,codigo,nombre))' +
        `&estado=in.(${etapas})&order=fecha_entrevista.desc`,
      CACHE_COMERCIAL
    ),
    select<{ evaluacion_id: string | null }>(
      'factura_items',
      'select=evaluacion_id&evaluacion_id=not.is.null',
      CACHE_COMERCIAL
    ),
    select<Precio>(
      'bateria_precios',
      'select=id,bateria_id,precio,desde,quien&order=desde.desc',
      CACHE_COMERCIAL
    ),
    dolarTarjeta(),
  ]);

  const facturadas = new Set(renglones.map((r) => r.evaluacion_id));

  return evaluaciones
    .filter((e) => !facturadas.has(e.id) && e.pedidos)
    .map((e) => {
      const pedido = e.pedidos!;
      const suyos = precios.filter((p) => p.bateria_id === pedido.baterias?.id);
      const precio = precioA(suyos, pedido.fecha_pedido ?? e.fecha_entrevista);
      // El Benziger se cobra cuando el pedido lo pidió o cuando se administró:
      // las dos cosas significan que ese trabajo se hizo.
      const conBenziger = Boolean(pedido.con_benziger || e.benziger_administrado);
      const benziger = conBenziger && cambio ? Math.round(BENZIGER_USD * cambio.valor) : null;
      return {
        evaluacionId: e.id,
        candidato: e.personas?.nombre ?? 'sin nombre',
        puesto: pedido.puesto,
        empresaId: pedido.empresa_id,
        cliente: pedido.empresas?.nombre ?? 'sin cliente',
        evaluadora: e.evaluadoras?.nombre ?? null,
        etapa: e.estado,
        bateria: pedido.baterias?.codigo ?? null,
        bateriaNombre: pedido.baterias?.nombre ?? null,
        fechaEntrevista: e.fecha_entrevista,
        fechaEntrega: e.fecha_entrega,
        precio,
        conBenziger,
        benziger,
        dolar: cambio?.valor ?? null,
      };
    });
}
