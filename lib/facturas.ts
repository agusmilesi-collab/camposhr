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
import { CACHE_COMERCIAL, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { BENZIGER_USD, dolarTarjeta, precioA, type Precio } from '@/lib/baterias-precios';
import { llevaBenziger } from '@/lib/benziger';
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
import { ETAPAS_ENTREVISTADO, type Marcha } from '@/lib/facturas-tipos';
import { cortes, mesesDelAnio } from '@/lib/monotributo';
import { esDePsicotecnicos, esDeServicios } from '@/lib/facturas-tipos';

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
  cotizacion_id: string | null;
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
    evaluaciones: {
      personas: { nombre: string } | null;
      pedidos: { puesto: string } | null;
    } | null;
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
    'select=id,numero,punto_venta,fecha,emisor_id,empresa_id,concepto,orden_compra,cotizacion_id,' +
      'imp_total,moneda,estado,cobrada_at,notas,cae,cae_vence_el,' +
      'emisores(razon_social,evaluadoras(nombre)),empresas(nombre),' +
      'factura_items(id,evaluacion_id,descripcion,detalle,importe,' +
      'evaluaciones(personas(nombre),pedidos(puesto)))' +
      '&order=fecha.desc,numero.desc',
    CACHE_COMERCIAL
  );
  return filas.map(armarFactura);
}

/** Una sola, para el comprobante. */
export async function verFactura(id: string): Promise<Factura | null> {
  const filas = await select<FilaFactura>(
    'facturas',
    'select=id,numero,punto_venta,fecha,emisor_id,empresa_id,concepto,orden_compra,cotizacion_id,' +
      'imp_total,moneda,estado,cobrada_at,notas,cae,cae_vence_el,' +
      'emisores(razon_social,evaluadoras(nombre)),empresas(nombre),' +
      'factura_items(id,evaluacion_id,descripcion,detalle,importe,' +
      'evaluaciones(personas(nombre),pedidos(puesto)))' +
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
    cotizacionId: f.cotizacion_id,
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
      persona: r.evaluaciones?.personas?.nombre ?? null,
      puesto: r.evaluaciones?.pedidos?.puesto ?? null,
    })),
  };
}

type FilaFacturable = {
  id: string;
  estado: string;
  fecha_entrevista: string | null;
  fecha_entrega: string | null;
  benziger_administrado: boolean | null;
  con_benziger: boolean | null;
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
      'select=id,estado,fecha_entrevista,fecha_entrega,benziger_administrado,con_benziger,' +
        'personas(nombre),evaluadoras(nombre),' +
        'pedidos(puesto,empresa_id,fecha_pedido,con_benziger,empresas(nombre),' +
        'baterias(id,codigo,nombre))' +
        `&estado=in.(${etapas})&order=fecha_entrevista.desc`,
      // Con las dos etiquetas: una evaluación entra en esta cola cuando se le
      // toma la entrevista, que se marca desde Psicotécnicos. Con la etiqueta
      // comercial sola, el candidato aparecía para facturar recién cuando algo
      // del lado comercial invalidaba la lista, o a los cinco minutos.
      [CACHE_COMERCIAL, CACHE_PSICOTECNICOS]
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
      // El Benziger se cobra cuando el pedido lo pidió, cuando se le pidió a
      // esta persona o cuando se administró: las tres significan que ese
      // trabajo se hizo.
      const conBenziger = llevaBenziger(e);
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

/**
 * Lo que lleva facturado cada emisora, para su monotributo.
 *
 * **Solo lo emitido y en pesos.** Un borrador o una factura rechazada no son un
 * ingreso, y una en dólares no se puede sumar a un tope que está en pesos: se
 * cuenta aparte para que la pantalla lo avise en vez de mezclarla.
 *
 * La cuenta es sobre lo que se emitió en el OS. Lo facturado antes entra cuando
 * esas facturas se carguen, así que mientras dure la migración el número es un
 * piso y no el total.
 */
export async function marchaMonotributo(hoy = new Date()): Promise<Marcha[]> {
  const [emisoras, facturas] = await Promise.all([listarEmisoras(), listarFacturas()]);
  const emitidas = facturas.filter((f) => f.estado === 'emitida');
  const { mes, anio, doce } = cortes(hoy);
  const meses = mesesDelAnio(hoy);

  return emisoras.map((e) => {
    const suyas = emitidas.filter((f) => f.emisorId === e.id && f.moneda !== 'DOL');
    const suma = (desde: string) =>
      suyas.filter((f) => f.fecha >= desde).reduce((n, f) => n + (f.importe ?? 0), 0);
    return {
      emisorId: e.id,
      nombre: e.nombre,
      categoria: e.categoria,
      mes: suma(mes),
      anio: suma(anio),
      doce: suma(doce),
      enDolares: emitidas.filter((f) => f.emisorId === e.id && f.moneda === 'DOL').length,
      meses: meses.map((m) => {
        const delMes = suyas.filter((f) => f.fecha.slice(0, 7) === m.clave);
        // Una factura es de psicotécnicos si cubre alguna evaluación. Se mira
        // la factura entera y no el renglón: el adicional Benziger va sin
        // evaluación pero es de un candidato que sí está en el comprobante.
        const suma = (cuales: Factura[]) =>
          cuales.reduce((n, f) => n + (f.importe ?? 0), 0);
        const psico = delMes.filter(esDePsicotecnicos);
        const servicios = delMes.filter(esDeServicios);
        return {
          ...m,
          psico: suma(psico),
          servicios: suma(servicios),
          total: suma(delMes),
        };
      }),
    };
  });
}
