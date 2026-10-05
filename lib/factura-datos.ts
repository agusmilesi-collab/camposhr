/**
 * Todo lo que una factura (o una nota de crédito) lleva impreso, ya resuelto.
 *
 * Lo leen las dos formas del mismo papel: la pantalla
 * (`comprobante/[id]/Comprobante.tsx`) y el PDF que se guarda y se manda
 * (`lib/factura-pdf.ts`). Están acá, juntas, las decisiones que no pueden
 * salir distintas en una y en otra: qué punto de venta se muestra, cómo se
 * arma el QR, qué leyenda lleva el cliente.
 */

import 'server-only';
import { verFactura } from '@/lib/facturas';
import { select } from '@/lib/supabase';
import { formatoFecha } from '@/lib/facturas-tipos';
import { leyendaIva } from '@/lib/clientes-tipos';
import { ordenesQueCubren } from '@/lib/orden-compra';

/**
 * Los ejemplares de un comprobante.
 *
 * La RG 1415 (art. 14) pide dos como mínimo: el original, que va al cliente, y
 * el duplicado, que queda con quien emite. El triplicado no es obligatorio en
 * una factura común; se genera igual, como lo hace Comprobantes en Línea, para
 * quien necesite un tercer juego para archivar.
 */
export const EJEMPLARES = ['Original', 'Duplicado', 'Triplicado'] as const;
export type Ejemplar = (typeof EJEMPLARES)[number];

const cuitLindo = (c: string | null | undefined) =>
  c && c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c ?? '—';

const largo = (v: { numero: number | null; punto_venta: number | null }) =>
  `${v.punto_venta === null ? '' : `${String(v.punto_venta).padStart(5, '0')}-`}` +
  `${v.numero === null ? 'sin número' : String(v.numero).padStart(8, '0')}`;

/**
 * El contenido del QR que ARCA exige en todo comprobante electrónico (RG 4892):
 * la dirección de su verificador con los datos del comprobante en base64.
 *
 * Sigue el documento "Especificaciones del QR incluido en las facturas
 * electrónicas" de ARCA, versión 1 del formato, campo por campo y en su orden:
 *
 *   - La dirección es `https://www.arca.gob.ar/fe/qr/`.
 *   - El CUIT, el documento del receptor y el código de autorización van como
 *     números y no como texto.
 *   - El tipo y el número de documento del receptor son "de corresponder": al
 *     consumidor final sin identificar (tipo 99) no se le informa ninguno.
 */
export function direccionQr(d: {
  fecha: string;
  cuit: string;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  tipoDocRec: number;
  nroDocRec: number;
  codAut: string;
}): string {
  const SIN_IDENTIFICAR = 99;
  const datos = {
    ver: 1,
    fecha: d.fecha,
    cuit: Number(d.cuit),
    ptoVta: d.ptoVta,
    tipoCmp: d.tipoCmp,
    nroCmp: d.nroCmp,
    importe: d.importe,
    moneda: 'PES',
    ctz: 1,
    ...(d.tipoDocRec !== SIN_IDENTIFICAR && d.nroDocRec > 0
      ? { tipoDocRec: d.tipoDocRec, nroDocRec: d.nroDocRec }
      : {}),
    tipoCodAut: 'E',
    codAut: Number(d.codAut),
  };
  return `https://www.arca.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(datos)).toString('base64')}`;
}

/** Por qué ARCA no la autorizó, cuando lo dijo. */
function motivoDe(respuesta: any): string | null {
  const errores: { Msg?: string }[] = respuesta?.Errors?.Err ?? [];
  const obs: { Msg?: string }[] =
    respuesta?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs ?? [];
  const textos = [...errores, ...obs].map((e) => e.Msg).filter(Boolean);
  return textos.length > 0 ? textos.join(' · ') : null;
}

export type DatosFactura = {
  id: string;
  /** Una nota de crédito es el mismo papel con otro nombre y otro código. */
  esNota: boolean;
  titulo: 'Factura' | 'Nota de crédito';
  codigo: '011' | '013';
  /** "00003", o una raya si no se sabe. */
  puntoVenta: string;
  /** "00000607", o "sin asignar". */
  numero: string;
  /** Para nombrar el archivo y el pie: "00003-00000607". */
  numeroLargo: string;
  sinNumero: boolean;
  fecha: string;
  desde: string;
  hasta: string;
  vencePago: string;
  /** En una nota de crédito, la factura que anula. */
  anula: { numero: string; fecha: string } | null;
  /** En una factura anulada, la nota que la anuló. */
  anuladaPor: { id: string; numero: string; fecha: string } | null;
  emisor: {
    marca: string;
    razonSocial: string;
    cuit: string;
    cuitCrudo: string | null;
    condicionIva: string;
    domicilio: string;
    ingresosBrutos: string;
    inicio: string;
  };
  cliente: {
    nombre: string;
    razonSocial: string;
    cuit: string;
    condicionIva: string;
    domicilio: string;
    /** La orden de compra que dio el cliente, si dio una. */
    ordenPropia: string | null;
    /** Las órdenes de compra de Campos HR que cubre este comprobante. */
    ordenesNuestras: string[];
  };
  renglones: { id: string; texto: string; importe: number | null }[];
  total: number;
  cae: string | null;
  caeVence: string | null;
  conCae: boolean;
  /** Con CAE de homologación: se ve como una factura y no vale. */
  dePrueba: boolean;
  /** Lo que codifica el QR, cuando hay CAE. */
  qr: string | null;
  estado: string;
  /** Por qué la rechazó ARCA, si la rechazó. */
  motivo: string | null;
};

type FilaEmisor = {
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string | null;
  domicilio: string | null;
  condicion_iva: string;
  inicio_actividades: string | null;
  ingresos_brutos: string | null;
  punto_venta_manual: number | null;
};
type FilaCliente = {
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  direccion_fiscal?: string | null;
  domicilio_fiscal?: string | null;
  condicion_iva: string | null;
};
type FilaAutorizado = {
  ambiente: 'homologacion' | 'produccion' | null;
  cbte_tipo: number;
  doc_tipo: number | null;
  doc_nro: string | null;
  estado: string;
  respuesta: unknown;
  servicio_desde: string | null;
  servicio_hasta: string | null;
  vence_pago: string | null;
  anula_id: string | null;
  sin_comprobante: boolean;
};
type Vinculado = { id: string; numero: number | null; punto_venta: number | null; fecha: string };

/**
 * Los datos de una factura o una nota de crédito. Null si no existe o si es de
 * las que van sin factura, que no tienen comprobante.
 */
export async function datosDeFactura(id: string): Promise<DatosFactura | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const factura = await verFactura(id);
  if (!factura || factura.sinComprobante) return null;

  // El receptor es una empresa o un inquilino del Centro, nunca los dos: el
  // comprobante es el mismo y lo que cambia es a nombre de quién sale.
  const [emisores, clientes, inquilinos, autorizados, renglones] = await Promise.all([
    select<FilaEmisor>(
      'emisores',
      'select=razon_social,nombre_fantasia,cuit,domicilio,condicion_iva,inicio_actividades,ingresos_brutos,punto_venta_manual' +
        `&id=eq.${factura.emisorId}&limit=1`
    ),
    factura.empresaId
      ? select<FilaCliente>(
          'empresas',
          `select=nombre,razon_social,cuit,direccion_fiscal,condicion_iva&id=eq.${factura.empresaId}&limit=1`
        )
      : Promise.resolve([]),
    factura.inquilinoId
      ? select<FilaCliente>(
          'inquilinos',
          `select=nombre,razon_social,cuit,condicion_iva,domicilio_fiscal&id=eq.${factura.inquilinoId}&limit=1`
        )
      : Promise.resolve([]),
    select<FilaAutorizado>(
      'facturas',
      'select=ambiente,cbte_tipo,doc_tipo,doc_nro,estado,respuesta,servicio_desde,servicio_hasta,' +
        `vence_pago,anula_id,sin_comprobante&id=eq.${id}&limit=1`
    ),
    // A quién cubre: la evaluación del renglón o, en una anulada, la que
    // cubría antes de soltarla.
    select<{ evaluacion_id: string | null; evaluacion_anulada_id: string | null }>(
      'factura_items',
      `select=evaluacion_id,evaluacion_anulada_id&factura_id=eq.${id}`
    ),
  ]);

  const emisor = emisores[0];
  const cliente = clientes[0] ?? inquilinos[0];
  const autorizado = autorizados[0];
  const esNota = autorizado?.cbte_tipo === 13;
  const conCae = Boolean(factura.cae);
  // Con CAE manda lo que ARCA autorizó, que es el importe guardado; la suma
  // de renglones es para la que todavía no salió. A dos decimales: una suma de
  // decimales puede dar 130000.00000001, y ese número va adentro del QR.
  const suma = factura.renglones.reduce((n, r) => n + (r.importe ?? 0), 0);
  const total = Math.round(((conCae && factura.importe ? factura.importe : suma || factura.importe) || 0) * 100) / 100;

  // Las que se anotaron a mano no guardaron su punto de venta. Sin CAE son de
  // Comprobantes en Línea, así que va el de la emisora ahí: una factura sin
  // punto de venta a la vista no parece una factura.
  const puntoVenta = factura.puntoVenta ?? (conCae ? null : emisor?.punto_venta_manual ?? null);

  const [[facturaAnulada], [notaQueAnula], { ordenes }] = await Promise.all([
    esNota && autorizado?.anula_id
      ? select<Vinculado>('facturas', `select=id,numero,punto_venta,fecha&id=eq.${autorizado.anula_id}&limit=1`)
      : Promise.resolve([] as Vinculado[]),
    !esNota
      ? select<Vinculado>(
          'facturas',
          `select=id,numero,punto_venta,fecha&anula_id=eq.${id}&estado=eq.emitida&limit=1`
        )
      : Promise.resolve([] as Vinculado[]),
    ordenesQueCubren(
      renglones
        .map((r) => r.evaluacion_id ?? r.evaluacion_anulada_id)
        .filter((x): x is string => Boolean(x))
    ),
  ]);

  const dia = formatoFecha(factura.fecha);
  return {
    id: factura.id,
    esNota,
    titulo: esNota ? 'Nota de crédito' : 'Factura',
    codigo: esNota ? '013' : '011',
    puntoVenta: puntoVenta === null ? '—' : String(puntoVenta).padStart(5, '0'),
    numero: factura.numero === null ? 'sin asignar' : String(factura.numero).padStart(8, '0'),
    numeroLargo: largo({ numero: factura.numero, punto_venta: puntoVenta }),
    sinNumero: factura.numero === null,
    fecha: dia,
    desde: autorizado?.servicio_desde ? formatoFecha(autorizado.servicio_desde) : dia,
    hasta: autorizado?.servicio_hasta ? formatoFecha(autorizado.servicio_hasta) : dia,
    vencePago: autorizado?.vence_pago ? formatoFecha(autorizado.vence_pago) : dia,
    anula: facturaAnulada
      ? { numero: largo(facturaAnulada), fecha: formatoFecha(facturaAnulada.fecha) }
      : null,
    anuladaPor: notaQueAnula
      ? { id: notaQueAnula.id, numero: largo(notaQueAnula), fecha: formatoFecha(notaQueAnula.fecha) }
      : null,
    emisor: {
      marca: emisor?.nombre_fantasia ? 'Campos HR' : emisor?.razon_social ?? '',
      razonSocial: emisor?.razon_social ?? '—',
      cuit: cuitLindo(emisor?.cuit),
      cuitCrudo: emisor?.cuit ?? null,
      condicionIva:
        emisor?.condicion_iva === 'Monotributo' ? 'Responsable Monotributo' : emisor?.condicion_iva ?? '—',
      domicilio: emisor?.domicilio ?? '—',
      ingresosBrutos: emisor?.ingresos_brutos ?? 'Régimen Simplificado',
      inicio: emisor?.inicio_actividades ? formatoFecha(emisor.inicio_actividades) : '—',
    },
    cliente: {
      nombre: factura.cliente,
      razonSocial: cliente?.razon_social ?? cliente?.nombre ?? factura.cliente,
      cuit: cuitLindo(cliente?.cuit),
      condicionIva: leyendaIva(cliente?.condicion_iva) ?? '—',
      domicilio: cliente?.direccion_fiscal ?? cliente?.domicilio_fiscal ?? '—',
      ordenPropia: factura.ordenCompra,
      ordenesNuestras: ordenes.map((o) => o.numero),
    },
    renglones:
      factura.renglones.length > 0
        ? factura.renglones.map((r) => ({ id: r.id, texto: r.descripcion, importe: r.importe }))
        : [{ id: 'unico', texto: factura.concepto ?? 'Servicios profesionales', importe: total }],
    total,
    cae: factura.cae,
    caeVence: factura.caeVenceEl ? formatoFecha(factura.caeVenceEl) : null,
    conCae,
    dePrueba: autorizado?.ambiente === 'homologacion',
    qr:
      conCae && emisor?.cuit && factura.numero !== null && factura.puntoVenta !== null
        ? direccionQr({
            fecha: factura.fecha.slice(0, 10),
            cuit: emisor.cuit,
            ptoVta: factura.puntoVenta,
            tipoCmp: autorizado?.cbte_tipo ?? 11,
            nroCmp: factura.numero,
            importe: total,
            tipoDocRec: autorizado?.doc_tipo ?? 80,
            nroDocRec: Number(autorizado?.doc_nro ?? cliente?.cuit ?? 0),
            codAut: factura.cae!,
          })
        : null,
    estado: factura.estado,
    motivo: !conCae && factura.estado === 'rechazada' ? motivoDe(autorizado?.respuesta) : null,
  };
}
