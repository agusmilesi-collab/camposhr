/**
 * Pedirle a ARCA el CAE de una factura que ya está armada en el OS.
 *
 * La factura llega en `borrador`, con sus renglones y su total calculados por
 * la ruta de alta. Acá no se decide cuánto sale: se le pone número, se pide la
 * autorización y se guarda lo que ARCA contestó.
 *
 * Siempre es factura C (las dos emisoras son monotributistas), concepto
 * servicios, en pesos y sin IVA. El detalle de los renglones no viaja: ARCA
 * autoriza un total.
 *
 * **El número se reserva en la base antes de llamar.** Se pregunta el último
 * autorizado, se escribe el siguiente en la factura, y el índice único hace que
 * dos emisiones simultáneas no pidan el mismo. Por eso no se usa
 * `createNextVoucher`, que hace las dos cosas del lado de ARCA sin dejar nada
 * anotado acá.
 *
 * **Si la llamada se corta, no se sabe si ARCA autorizó.** Antes de dar el
 * número por libre se le pregunta por ese comprobante: soltarlo estando
 * autorizado deja una factura con CAE que el OS no conoce y otra factura
 * pidiendo un número que ya no existe.
 *
 * **En homologación solo se emite a la empresa de prueba.** El CAE de
 * homologación no vale, y una factura de prueba a un cliente real sacaría sus
 * evaluaciones de la cola como si ya estuvieran facturadas.
 */

import 'server-only';
import { select, patch } from '@/lib/supabase';
import { arcaDe, tieneCertificado, type Ambiente } from '@/lib/arca/cliente';
import { esEmpresaDePrueba } from '@/lib/empresa-prueba';

const FACTURA_C = 11;
const CONCEPTO_SERVICIOS = 2;
const DOC_CUIT = 80;
const DOC_SIN_IDENTIFICAR = 99;

/** El identificador de ARCA de cada condición frente al IVA del receptor. */
const CONDICION_IVA: Record<string, number> = {
  'Responsable Inscripto': 1,
  Exento: 4,
  'Consumidor Final': 5,
  Monotributo: 6,
};


type Receptor = {
  nombre: string;
  cuit: string | null;
  condicion_iva: string | null;
};

type Fila = {
  id: string;
  estado: string;
  cae: string | null;
  numero: number | null;
  sin_comprobante: boolean;
  fecha: string;
  imp_total: string | number | null;
  moneda: string;
  servicio_desde: string | null;
  servicio_hasta: string | null;
  vence_pago: string | null;
  emisores: { cuit: string | null; punto_venta: number | null; ambiente: Ambiente } | null;
  empresas: Receptor | null;
  inquilinos: Receptor | null;
};

export type Emision =
  | { ok: true; numero: number; puntoVenta: number; cae: string; caeVenceEl: string; ambiente: Ambiente }
  | { ok: false; error: string; status: number };

const compacta = (iso: string) => iso.slice(0, 10).replace(/-/g, '');
const aIso = (compacta: string) =>
  `${compacta.slice(0, 4)}-${compacta.slice(4, 6)}-${compacta.slice(6, 8)}`;

const fallo = (error: string, status = 400): Emision => ({ ok: false, error, status });

/** Lo que ARCA escribió al rechazar, en una sola línea para mostrar. */
function motivos(respuesta: any): string {
  const errores: { Code?: number; Msg?: string }[] = respuesta?.Errors?.Err ?? [];
  const obs: { Code?: number; Msg?: string }[] =
    respuesta?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs ?? [];
  const textos = [...errores, ...obs].map((e) => `${e.Msg ?? ''} (${e.Code ?? 's/c'})`.trim());
  return textos.join(' · ') || 'ARCA rechazó el comprobante sin decir por qué.';
}

export async function emitirEnArca(facturaId: string): Promise<Emision> {
  const filas = await select<Fila>(
    'facturas',
    'select=id,estado,cae,numero,sin_comprobante,fecha,imp_total,moneda,servicio_desde,servicio_hasta,vence_pago,' +
      'emisores(cuit,punto_venta,ambiente),empresas(nombre,cuit,condicion_iva),' +
      'inquilinos(nombre,cuit,condicion_iva)' +
      `&id=eq.${facturaId}&limit=1`
  );
  const f = filas[0];
  if (!f) return fallo('Esa factura no existe.', 404);
  if (f.cae) return fallo('Esa factura ya tiene CAE.', 409);
  if (f.sin_comprobante) return fallo('Eso se cobra con recibo: no se le pide CAE.', 409);
  // Una factura con número y sin CAE es una que salió por Comprobantes en
  // Línea y se anotó acá: pedirle CAE sería emitirla dos veces.
  const sinEmitir = f.estado === 'borrador' || f.estado === 'rechazada' || f.numero === null;
  if (f.estado === 'anulada' || !sinEmitir) {
    return fallo('Esa factura ya figura emitida. No se le pide CAE.', 409);
  }

  const emisor = f.emisores;
  if (!emisor?.cuit) return fallo('La emisora no tiene CUIT cargado.');
  const ambiente = emisor.ambiente;
  if (!tieneCertificado(emisor.cuit, ambiente)) {
    return fallo(`Falta el certificado de ${ambiente} de esta emisora.`);
  }
  // En homologación ARCA acepta cualquier punto de venta; en producción tiene
  // que ser el que la emisora dio de alta para web services.
  const puntoVenta = emisor.punto_venta ?? (ambiente === 'homologacion' ? 1 : null);
  if (puntoVenta === null) return fallo('La emisora no tiene punto de venta de web services.');

  const receptor = f.empresas ?? f.inquilinos;
  if (!receptor) return fallo('La factura no tiene a quién.');
  if (ambiente === 'homologacion' && !esEmpresaDePrueba(receptor.nombre)) {
    return fallo(
      'Esta emisora todavía factura contra el ARCA de prueba, que solo admite a Distribuidora Andina.'
    );
  }
  const condicion = receptor.condicion_iva ? CONDICION_IVA[receptor.condicion_iva] : undefined;
  if (!condicion) {
    return fallo(`Falta la condición frente al IVA de ${receptor.nombre}. Se carga en su ficha.`);
  }
  const cuitReceptor = (receptor.cuit ?? '').replace(/\D/g, '');
  if (cuitReceptor.length !== 11 && condicion !== CONDICION_IVA['Consumidor Final']) {
    return fallo(`Falta el CUIT de ${receptor.nombre}. Se carga en su ficha.`);
  }

  const total = Number(f.imp_total ?? 0);
  if (!(total > 0)) return fallo('La factura no tiene importe.');
  if (f.moneda !== 'PES') return fallo('Por ahora solo se emite en pesos.');

  // El período y el vencimiento de pago son el día de la factura, que es como
  // las vienen emitiendo en Comprobantes en Línea: se factura un trabajo ya
  // hecho y no un abono con plazo.
  const dia = f.fecha.slice(0, 10);
  const desde = f.servicio_desde ?? dia;
  const hasta = f.servicio_hasta ?? dia;
  const vencePago = f.vence_pago ?? dia;

  const arca = arcaDe(emisor.cuit, ambiente).electronicBillingService;

  let numero: number;
  try {
    const ultimo = await arca.getLastVoucher(puntoVenta, FACTURA_C);
    numero = Number(ultimo.cbteNro) + 1;
  } catch (e) {
    console.error('arca último comprobante:', e);
    return fallo('ARCA no contestó. No se emitió nada; se puede volver a intentar.', 502);
  }

  const solicitud = {
    CantReg: 1,
    PtoVta: puntoVenta,
    CbteTipo: FACTURA_C,
    Concepto: CONCEPTO_SERVICIOS,
    DocTipo: cuitReceptor.length === 11 ? DOC_CUIT : DOC_SIN_IDENTIFICAR,
    DocNro: cuitReceptor.length === 11 ? Number(cuitReceptor) : 0,
    CbteDesde: numero,
    CbteHasta: numero,
    CbteFch: compacta(f.fecha),
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: total,
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    FchServDesde: compacta(desde),
    FchServHasta: compacta(hasta),
    FchVtoPago: compacta(vencePago),
    MonId: 'PES',
    MonCotiz: 1,
    CondicionIVAReceptorId: condicion,
  };

  // La reserva. Si otra emisión de la misma emisora tomó ese número un instante
  // antes, el índice único rechaza esta escritura y no se llama a ARCA.
  try {
    await patch('facturas', `id=eq.${f.id}`, {
      numero,
      punto_venta: puntoVenta,
      ambiente,
      estado: 'borrador',
      doc_tipo: solicitud.DocTipo,
      doc_nro: String(solicitud.DocNro),
      condicion_iva_receptor: condicion,
      servicio_desde: desde,
      servicio_hasta: hasta,
      vence_pago: vencePago,
      solicitud,
      respuesta: null,
    });
  } catch (e) {
    console.error('arca reserva:', e);
    return fallo('Hay otra factura de esta emisora emitiéndose. Probá de nuevo en un momento.', 409);
  }

  const soltar = (respuesta: unknown, estado: 'borrador' | 'rechazada') =>
    patch('facturas', `id=eq.${f.id}`, { numero: null, estado, respuesta });

  const guardar = async (cae: string, vence: string, respuesta: unknown): Promise<Emision> => {
    const caeVenceEl = aIso(vence);
    await patch('facturas', `id=eq.${f.id}`, {
      cae,
      cae_vence_el: caeVenceEl,
      estado: 'emitida',
      respuesta,
    });
    return { ok: true, numero, puntoVenta, cae, caeVenceEl, ambiente };
  };

  try {
    const r = await arca.createVoucher(solicitud);
    const detalle = r.response?.FeDetResp?.FECAEDetResponse?.[0];
    if (detalle?.Resultado === 'A' && r.cae) {
      return await guardar(r.cae, r.caeFchVto, r.response);
    }
    await soltar(r.response, 'rechazada');
    return fallo(`ARCA rechazó la factura: ${motivos(r.response)}`, 422);
  } catch (e) {
    console.error('arca emisión:', e);
    // No se sabe si llegó. Se le pregunta a ARCA por ese número antes de
    // soltarlo.
    try {
      const info = await arca.getVoucherInfo(numero, puntoVenta, FACTURA_C);
      if (info?.codAutorizacion && Number(info.impTotal) === total) {
        return await guardar(String(info.codAutorizacion), String(info.fchVto), info);
      }
      await soltar({ error: String(e) }, 'borrador');
      return fallo('ARCA no contestó. No se emitió nada; se puede volver a intentar.', 502);
    } catch (e2) {
      console.error('arca consulta tras el corte:', e2);
      // Ni la emisión ni la consulta contestaron: el número queda reservado y
      // la factura en borrador, que es lo único que no puede terminar en dos
      // comprobantes por el mismo trabajo.
      return fallo(
        `No se pudo confirmar con ARCA si la factura ${numero} quedó emitida. ` +
          'Antes de reintentar hay que mirarla en Comprobantes en Línea.',
        502
      );
    }
  }
}
