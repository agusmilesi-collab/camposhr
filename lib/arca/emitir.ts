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
 * **Volver a pedir el CAE nunca emite dos veces.** Una factura que quedó con
 * número reservado y sin CAE (la función se cortó, o ARCA autorizó y falló el
 * guardado) no se sabe en qué quedó. Al reintentar, lo primero es averiguarlo:
 * si ARCA la tiene, se guarda su CAE y no se pide nada; solo si no la tiene se
 * suelta el número y se sigue. Lo mismo con una nota de crédito a medio hacer.
 *
 * **En homologación solo se emite a la empresa de prueba.** El CAE de
 * homologación no vale, y una factura de prueba a un cliente real sacaría sus
 * evaluaciones de la cola como si ya estuvieran facturadas.
 */

import 'server-only';
import { insert, select, patch } from '@/lib/supabase';
import { arcaDe, tieneCertificado, type Ambiente } from '@/lib/arca/cliente';
import { esEmpresaDePrueba } from '@/lib/empresa-prueba';
import { condicionArca, enumerar, faltaParaEmitir, faltaParaFacturarle } from '@/lib/clientes-tipos';
import { hoyIso } from '@/lib/hora';

const FACTURA_C = 11;
const NOTA_DE_CREDITO_C = 13;
const CONCEPTO_SERVICIOS = 2;
const DOC_CUIT = 80;
const DOC_SIN_IDENTIFICAR = 99;

type Servicio = ReturnType<typeof arcaDe>['electronicBillingService'];

type Receptor = {
  nombre: string;
  cuit: string | null;
  condicion_iva: string | null;
};

type Fila = {
  id: string;
  estado: string;
  cae: string | null;
  cbte_tipo: number;
  numero: number | null;
  punto_venta: number | null;
  ambiente: Ambiente | null;
  solicitud: { ImpTotal?: number; DocNro?: number } | null;
  sin_comprobante: boolean;
  fecha: string;
  imp_total: string | number | null;
  moneda: string;
  servicio_desde: string | null;
  servicio_hasta: string | null;
  vence_pago: string | null;
  emisores: {
    cuit: string | null;
    punto_venta: number | null;
    ambiente: Ambiente;
    domicilio: string | null;
    inicio_actividades: string | null;
    ingresos_brutos: string | null;
  } | null;
  empresas: (Receptor & { razon_social: string | null; direccion_fiscal: string | null }) | null;
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

/**
 * Escribir solo si la fila sigue como se la dejó, y saber si se escribió.
 *
 * `patch` no dice cuántas filas tocó. Acá hace falta: la reserva del número
 * vale solo si la factura todavía no tenía uno, y eso es lo que impide que dos
 * pedidos sobre la misma factura salgan los dos hacia ARCA.
 */
async function escribirSi(query: string, cambios: Record<string, unknown>): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY as string;
  const res = await fetch(`${url}/rest/v1/facturas?${query}&select=id`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(cambios),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase facturas ${res.status}: ${await res.text()}`);
  return ((await res.json()) as unknown[]).length;
}

async function borrarFila(id: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY as string;
  const res = await fetch(`${url}/rest/v1/facturas?id=eq.${id}&cae=is.null`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase borrar factura ${res.status}: ${await res.text()}`);
}

/**
 * El último número que ARCA autorizó de ese tipo en ese punto de venta.
 *
 * Tira error si ARCA contestó con un error en vez de un número (pasa con un
 * punto de venta que no está habilitado para web services): seguir de largo
 * con eso es pedir el comprobante "NaN".
 */
async function ultimoDe(arca: Servicio, puntoVenta: number, tipo: number): Promise<number> {
  const u: any = await arca.getLastVoucher(puntoVenta, tipo);
  const n = Number(u?.cbteNro);
  if (u?.errors || !Number.isInteger(n) || n < 0) {
    throw new Error(`ARCA no dio el último comprobante: ${JSON.stringify(u?.errors ?? u)}`);
  }
  return n;
}

type Averiguado =
  | { que: 'autorizado'; cae: string; vence: string; info: unknown }
  | { que: 'libre'; ultimo: number };

/**
 * En qué quedó un comprobante que se mandó y del que no se supo la respuesta.
 *
 * Primero el último autorizado: si es menor que el número reservado, ARCA no
 * lo tiene, seguro. Recién si lo alcanzó se pide ese comprobante y se compara
 * importe y receptor, porque el número pudo haberlo tomado otro comprobante.
 * No alcanza con pedirlo a secas: la consulta devuelve vacío tanto cuando no
 * existe como cuando ARCA falló, y confundir lo segundo con lo primero es
 * soltar un número que está autorizado.
 */
async function averiguar(
  arca: Servicio,
  puntoVenta: number,
  tipo: number,
  numero: number,
  total: number,
  docNro: number
): Promise<Averiguado> {
  const ultimo = await ultimoDe(arca, puntoVenta, tipo);
  if (ultimo < numero) return { que: 'libre', ultimo };
  const info: any = await arca.getVoucherInfo(numero, puntoVenta, tipo);
  if (!info) throw new Error(`ARCA no devolvió el comprobante ${numero}, que debería existir.`);
  const elMismo =
    Boolean(info.codAutorizacion) &&
    Math.abs(Number(info.impTotal) - total) < 0.005 &&
    Number(info.docNro) === docNro;
  if (elMismo) {
    return { que: 'autorizado', cae: String(info.codAutorizacion), vence: String(info.fchVto), info };
  }
  return { que: 'libre', ultimo };
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Prueba =
  | { ok: true; ambiente: Ambiente; puntoVenta: number; ultimaFactura: number; ultimaNota: number; puntos: unknown }
  | { ok: false; error: string };

/**
 * Probar la conexión de una emisora con ARCA, sin emitir nada.
 *
 * Pide el ticket con su certificado y pregunta el último comprobante de su
 * punto de venta. Si las tres cosas del trámite están bien (certificado,
 * relación con el servicio de facturación y punto de venta de web services),
 * contesta un número; si falta alguna, ARCA dice cuál. Es solo lectura: sirve
 * para pasar a una emisora a producción sabiendo que su primera factura no va
 * a fallar por el trámite.
 */
export async function probarConexion(
  emisorId: string,
  ambiente: Ambiente,
  puntoVenta: number
): Promise<Prueba> {
  const [e] = await select<{ cuit: string | null }>('emisores', `select=cuit&id=eq.${emisorId}&limit=1`);
  if (!e?.cuit) return { ok: false, error: 'La emisora no tiene CUIT cargado.' };
  if (!tieneCertificado(e.cuit, ambiente)) {
    return { ok: false, error: `Falta el certificado de ${ambiente} de esta emisora.` };
  }
  try {
    const arca = arcaDe(e.cuit, ambiente).electronicBillingService;
    const ultimaFactura = await ultimoDe(arca, puntoVenta, FACTURA_C);
    const ultimaNota = await ultimoDe(arca, puntoVenta, NOTA_DE_CREDITO_C);
    // La lista de puntos de venta es un dato de más: si falla, la prueba vale igual.
    const puntos = await arca.getSalesPoints().catch((x: unknown) => `no se pudo listar: ${String(x)}`);
    return { ok: true, ambiente, puntoVenta, ultimaFactura, ultimaNota, puntos };
  } catch (x) {
    return { ok: false, error: x instanceof Error ? x.message : String(x) };
  }
}

export async function emitirEnArca(facturaId: string): Promise<Emision> {
  const filas = await select<Fila>(
    'facturas',
    'select=id,estado,cae,cbte_tipo,numero,punto_venta,ambiente,solicitud,sin_comprobante,fecha,' +
      'imp_total,moneda,servicio_desde,servicio_hasta,vence_pago,' +
      'emisores(cuit,punto_venta,ambiente,domicilio,inicio_actividades,ingresos_brutos),' +
      'empresas(nombre,razon_social,cuit,condicion_iva,direccion_fiscal),' +
      'inquilinos(nombre,cuit,condicion_iva)' +
      `&id=eq.${facturaId}&limit=1`
  );
  const f = filas[0];
  if (!f) return fallo('Esa factura no existe.', 404);
  // Una nota de crédito se emite desde la anulación de su factura. Por acá
  // saldría como una factura C nueva.
  if (f.cbte_tipo !== FACTURA_C) return fallo('Eso no es una factura.', 409);
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
  const condicion = condicionArca(receptor.condicion_iva);
  if (!condicion) {
    return fallo(`Falta la condición frente al IVA de ${receptor.nombre}. Se carga en su ficha.`);
  }
  const cuitReceptor = (receptor.cuit ?? '').replace(/\D/g, '');
  if (cuitReceptor.length !== 11 && receptor.condicion_iva !== 'Consumidor Final') {
    return fallo(`Falta el CUIT de ${receptor.nombre}. Se carga en su ficha.`);
  }
  // El mismo control del alta, repetido acá: las facturas de servicios no
  // pasan por ese alta, y un dato se puede haber borrado entre el alta y el
  // pedido. Con CAE ya no hay cómo completarle el domicilio al comprobante.
  const faltaEmisora = faltaParaEmitir({
    cuit: emisor.cuit,
    domicilio: emisor.domicilio,
    inicioActividades: emisor.inicio_actividades,
    ingresosBrutos: emisor.ingresos_brutos,
  });
  if (faltaEmisora.length > 0) {
    return fallo(`No se puede emitir: a la emisora le falta ${enumerar(faltaEmisora)}.`);
  }
  if (f.empresas) {
    const faltaCliente = faltaParaFacturarle({
      razonSocial: f.empresas.razon_social,
      cuit: f.empresas.cuit,
      condicionIva: f.empresas.condicion_iva,
      domicilio: f.empresas.direccion_fiscal,
    });
    if (faltaCliente.length > 0) {
      return fallo(
        `No se puede emitir: a ${f.empresas.nombre} le falta ${enumerar(faltaCliente)}. Se carga en su ficha.`
      );
    }
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

  const guardar = async (
    numero: number,
    pv: number,
    cae: string,
    vence: string,
    respuesta: unknown
  ): Promise<Emision> => {
    const caeVenceEl = aIso(vence);
    try {
      // Con el número y el punto de venta otra vez: si un segundo pedido los
      // borró mientras este esperaba a ARCA, vuelven con el CAE.
      await patch('facturas', `id=eq.${f.id}&cae=is.null`, {
        numero,
        punto_venta: pv,
        ambiente,
        cae,
        cae_vence_el: caeVenceEl,
        estado: 'emitida',
        respuesta,
      });
    } catch (e) {
      console.error('arca, guardar el CAE:', e);
      return fallo(
        `ARCA autorizó la factura ${numero} y no se pudo guardar el CAE. ` +
          'Apretá Pedir CAE otra vez: la recupera de ARCA, no emite otra.',
        500
      );
    }
    return { ok: true, numero, puntoVenta: pv, cae, caeVenceEl, ambiente };
  };

  // ¿Quedó a medio emitir? Se averigua antes de pedir nada.
  let ultimo: number;
  const aMedias = f.numero !== null && f.punto_venta !== null && f.solicitud !== null;
  try {
    if (aMedias) {
      if (f.ambiente !== ambiente) {
        return fallo(
          `Esta factura quedó a medio emitir en ${f.ambiente} y la emisora ahora está en ${ambiente}. ` +
            'Hay que mirarla a mano antes de seguir.',
          409
        );
      }
      const a = await averiguar(
        arca,
        f.punto_venta as number,
        FACTURA_C,
        f.numero as number,
        Number(f.solicitud?.ImpTotal ?? total),
        Number(f.solicitud?.DocNro ?? 0)
      );
      if (a.que === 'autorizado') {
        return await guardar(f.numero as number, f.punto_venta as number, a.cae, a.vence, a.info);
      }
      await escribirSi(`id=eq.${f.id}&numero=eq.${f.numero}&cae=is.null`, { numero: null });
      ultimo = a.ultimo;
    } else {
      ultimo = await ultimoDe(arca, puntoVenta, FACTURA_C);
    }
  } catch (e) {
    console.error('arca último comprobante:', e);
    return fallo(
      aMedias
        ? `No se pudo confirmar con ARCA si la factura ${f.numero} quedó emitida. No se pidió nada; probá de nuevo en un momento.`
        : 'ARCA no contestó, o el punto de venta no está habilitado para web services. No se emitió nada.',
      502
    );
  }
  const numero = ultimo + 1;

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

  // La reserva. Se escribe solo si la factura sigue sin número: un segundo
  // pedido sobre la misma (otra pestaña, otro clic) no encuentra la fila y
  // se frena acá. Y si otra factura de la misma emisora tomó ese número un
  // instante antes, el índice único rechaza la escritura.
  try {
    const tocadas = await escribirSi(`id=eq.${f.id}&cae=is.null&numero=is.null`, {
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
    if (tocadas === 0) {
      return fallo('Esta factura ya se está emitiendo desde otro lado. Esperá un momento y recargá.', 409);
    }
  } catch (e) {
    const texto = e instanceof Error ? e.message : '';
    console.error('arca reserva:', texto);
    return texto.includes('23505') || texto.includes('duplicate key')
      ? fallo('Hay otra factura de esta emisora emitiéndose. Probá de nuevo en un momento.', 409)
      : fallo('No se pudo reservar el número. No se emitió nada.', 500);
  }

  // Solo suelta el número si sigue siendo el de esta reserva y no hay CAE.
  const soltar = async (respuesta: unknown, estado: 'borrador' | 'rechazada') => {
    try {
      await escribirSi(`id=eq.${f.id}&numero=eq.${numero}&cae=is.null`, {
        numero: null,
        estado,
        respuesta,
      });
    } catch (e) {
      // Queda reservado: el próximo pedido lo averigua y lo suelta.
      console.error('arca, soltar el número:', e);
    }
  };

  let r: any;
  try {
    r = await arca.createVoucher(solicitud);
  } catch (e) {
    console.error('arca emisión:', e);
    // No se sabe si llegó. Se le pregunta a ARCA antes de soltar el número,
    // dándole un momento por si todavía lo está procesando.
    try {
      await espera(2500);
      const a = await averiguar(arca, puntoVenta, FACTURA_C, numero, total, solicitud.DocNro);
      if (a.que === 'autorizado') return await guardar(numero, puntoVenta, a.cae, a.vence, a.info);
      await soltar({ error: String(e) }, 'borrador');
      return fallo('ARCA no contestó. No se emitió nada; se puede volver a intentar.', 502);
    } catch (e2) {
      console.error('arca consulta tras el corte:', e2);
      // Ni la emisión ni la consulta contestaron: el número queda reservado y
      // la factura en borrador. El próximo pedido averigua en qué quedó antes
      // de emitir nada.
      return fallo(
        `No se pudo confirmar con ARCA si la factura ${numero} quedó emitida. ` +
          'Probá de nuevo en un momento: primero averigua en qué quedó, no emite otra.',
        502
      );
    }
  }

  const detalle = r.response?.FeDetResp?.FECAEDetResponse?.[0];
  if (detalle?.Resultado === 'A' && r.cae) {
    return await guardar(numero, puntoVenta, r.cae, r.caeFchVto, r.response);
  }
  await soltar(r.response, 'rechazada');
  return fallo(`ARCA rechazó la factura: ${motivos(r.response)}`, 422);
}

// ------------------------------------------------------- la nota de crédito

type FilaAnulable = {
  id: string;
  estado: string;
  cae: string | null;
  cbte_tipo: number;
  numero: number | null;
  punto_venta: number | null;
  fecha: string;
  imp_total: string | number | null;
  ambiente: Ambiente | null;
  cobrada_at: string | null;
  sin_comprobante: boolean;
  emisor_id: string;
  empresa_id: string | null;
  inquilino_id: string | null;
  doc_tipo: number | null;
  doc_nro: string | null;
  condicion_iva_receptor: number | null;
  servicio_desde: string | null;
  servicio_hasta: string | null;
  emisores: { cuit: string | null } | null;
};

export type Anulacion =
  | { ok: true; notaId: string; numero: number; puntoVenta: number; cae: string; ambiente: Ambiente }
  | { ok: false; error: string; status: number };

const noAnula = (error: string, status = 400): Anulacion => ({ ok: false, error, status });

/**
 * Anular una factura autorizada, con una nota de crédito C por el total.
 *
 * Es la única forma de deshacer una factura con CAE: en ARCA no se borra nada,
 * se emite otro comprobante que la deja en cero. La nota se asocia a la
 * factura (`CbtesAsoc`) y repite sus importes y su receptor.
 *
 * **Solo por el total.** Sacar a una persona de una factura de tres es otra
 * operación, con otro importe y otro detalle, y no está hecha.
 *
 * **No se anula una factura cobrada.** Con la plata adentro, anular es además
 * devolverla o compensarla, y el recibo de pago que ya se entregó queda sin
 * respaldo. Primero se desmarca el cobro, que es decir que esa plata no está.
 *
 * Cuando ARCA la autoriza: la factura queda `anulada`, deja de contar para el
 * monotributo, y sus renglones sueltan a las personas (el dato pasa a
 * `evaluacion_anulada_id`) para que vuelvan a la cola y se puedan facturar de
 * nuevo. Si ARCA la rechaza, no cambia nada.
 *
 * **Se puede repetir.** Son varias escrituras y cualquiera puede fallar a
 * mitad de camino. Si ya hay una nota para esa factura, no se contesta "ya
 * hay una en curso": se termina lo que faltó. Con CAE, se repiten los pasos
 * de cierre, que dan lo mismo hechos dos veces. Sin CAE, se le pregunta a
 * ARCA por ese número y se cierra o se descarta según lo que conteste.
 */
export async function anularConNotaDeCredito(facturaId: string, quien: string): Promise<Anulacion> {
  const [f] = await select<FilaAnulable>(
    'facturas',
    'select=id,estado,cae,cbte_tipo,numero,punto_venta,fecha,imp_total,ambiente,cobrada_at,' +
      'sin_comprobante,emisor_id,empresa_id,inquilino_id,doc_tipo,doc_nro,condicion_iva_receptor,' +
      'servicio_desde,servicio_hasta,emisores(cuit)' +
      `&id=eq.${facturaId}&limit=1`
  );
  if (!f) return noAnula('Esa factura no existe.', 404);
  if (f.cbte_tipo !== FACTURA_C) return noAnula('Eso no es una factura.');

  /** Lo que sigue a la autorización de la nota. Da lo mismo hecho dos veces. */
  const terminar = async () => {
    // Recién con la nota autorizada la factura deja de valer.
    await patch('facturas', `id=eq.${f.id}`, { estado: 'anulada' });
    // Los renglones sueltan a las personas, que vuelven a la cola; el dato de
    // a quién cubrían queda guardado al lado.
    const items = await select<{ id: string; evaluacion_id: string | null }>(
      'factura_items',
      `select=id,evaluacion_id&factura_id=eq.${f.id}&evaluacion_id=not.is.null`
    );
    const personas = items.map((i) => i.evaluacion_id).filter(Boolean);
    for (const i of items) {
      await patch('factura_items', `id=eq.${i.id}`, {
        evaluacion_anulada_id: i.evaluacion_id,
        evaluacion_id: null,
      });
    }
    if (personas.length > 0) {
      await patch('evaluaciones', `id=in.(${personas.join(',')})`, {
        facturado: false,
        pagado: false,
        numero_factura: null,
      });
    }
  };

  const cerrar = async (
    notaId: string,
    numero: number,
    cae: string,
    vence: string | null,
    respuesta: unknown
  ): Promise<Anulacion> => {
    try {
      if (vence !== null) {
        await patch('facturas', `id=eq.${notaId}`, {
          cae,
          cae_vence_el: aIso(vence),
          estado: 'emitida',
          respuesta,
        });
      }
      await terminar();
    } catch (e) {
      console.error('arca, cerrar la nota de crédito:', e);
      return noAnula(
        `ARCA autorizó la nota de crédito ${numero} y no se terminó de guardar. ` +
          'Apretá Anular otra vez: completa lo que faltó, no emite otra.',
        500
      );
    }
    return {
      ok: true,
      notaId,
      numero,
      puntoVenta: f.punto_venta as number,
      cae,
      ambiente: f.ambiente as Ambiente,
    };
  };

  // Una nota que ya existe para esta factura: se termina, no se emite otra.
  const [previa] = await select<{ id: string; cae: string | null; numero: number | null }>(
    'facturas',
    `select=id,cae,numero&anula_id=eq.${f.id}&limit=1`
  );
  if (previa?.cae && previa.numero !== null) {
    return cerrar(previa.id, previa.numero, previa.cae, null, null);
  }

  if (f.estado === 'anulada') return noAnula('Esa factura ya está anulada.', 409);
  if (!f.cae || f.numero === null || f.punto_venta === null || !f.ambiente) {
    return noAnula(
      f.estado === 'emitida' && f.numero !== null
        ? 'Esa factura no se autorizó desde el OS. Si salió por Comprobantes en Línea, la nota de crédito se hace ahí.'
        : 'Esa factura no tiene CAE: no hace falta nota de crédito, se quita.'
    );
  }
  if (f.cobrada_at) {
    return noAnula('Esa factura está cobrada. Para anularla, primero desmarcá el cobro.', 409);
  }
  const cuit = f.emisores?.cuit;
  if (!cuit) return noAnula('La emisora no tiene CUIT cargado.');
  if (!tieneCertificado(cuit, f.ambiente)) {
    return noAnula(`Falta el certificado de ${f.ambiente} de esta emisora.`);
  }
  if (f.condicion_iva_receptor === null || f.doc_tipo === null) {
    return noAnula('A esa factura le faltan los datos con los que se autorizó.');
  }

  const total = Number(f.imp_total ?? 0);
  const docNro = Number(f.doc_nro ?? 0);
  const hoy = hoyIso();
  const arca = arcaDe(cuit, f.ambiente).electronicBillingService;

  let ultimo: number;
  try {
    if (previa && previa.numero !== null) {
      // Quedó en borrador con su número reservado: no se sabe si ARCA la tomó.
      const a = await averiguar(arca, f.punto_venta, NOTA_DE_CREDITO_C, previa.numero, total, docNro);
      if (a.que === 'autorizado') return cerrar(previa.id, previa.numero, a.cae, a.vence, a.info);
      await borrarFila(previa.id);
      ultimo = a.ultimo;
    } else {
      if (previa) await borrarFila(previa.id);
      ultimo = await ultimoDe(arca, f.punto_venta, NOTA_DE_CREDITO_C);
    }
  } catch (e) {
    console.error('arca último comprobante (NC):', e);
    return noAnula('ARCA no contestó. No se anuló nada; se puede volver a intentar.', 502);
  }
  const numero = ultimo + 1;

  const solicitud = {
    CantReg: 1,
    PtoVta: f.punto_venta,
    CbteTipo: NOTA_DE_CREDITO_C,
    Concepto: CONCEPTO_SERVICIOS,
    DocTipo: f.doc_tipo,
    DocNro: docNro,
    CbteDesde: numero,
    CbteHasta: numero,
    CbteFch: compacta(hoy),
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: total,
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    // El período es el de la factura que se anula. El vencimiento de pago es
    // el día de hoy: una nota de crédito no tiene nada que cobrar, pero en
    // servicios ARCA pide la fecha igual.
    FchServDesde: compacta(f.servicio_desde ?? f.fecha),
    FchServHasta: compacta(f.servicio_hasta ?? f.fecha),
    FchVtoPago: compacta(hoy),
    MonId: 'PES',
    MonCotiz: 1,
    CondicionIVAReceptorId: f.condicion_iva_receptor,
    CbtesAsoc: [
      {
        Tipo: FACTURA_C,
        PtoVta: f.punto_venta,
        Nro: f.numero,
        Cuit: cuit,
        CbteFch: compacta(f.fecha),
      },
    ],
  };

  // La nota nace en borrador con su número reservado: el índice único hace
  // que dos anulaciones a la vez no pidan el mismo, y `anula_id` que no haya
  // dos notas para la misma factura.
  let nota: { id: string };
  try {
    nota = await insert<{ id: string }>('facturas', {
      origen: 'os',
      emisor_id: f.emisor_id,
      empresa_id: f.empresa_id,
      inquilino_id: f.inquilino_id,
      cbte_tipo: NOTA_DE_CREDITO_C,
      anula_id: f.id,
      punto_venta: f.punto_venta,
      numero,
      fecha: hoy,
      doc_tipo: f.doc_tipo,
      doc_nro: f.doc_nro,
      condicion_iva_receptor: f.condicion_iva_receptor,
      imp_total: total,
      moneda: 'PES',
      concepto:
        `Anulación de la Factura C ${String(f.punto_venta).padStart(5, '0')}-` +
        `${String(f.numero).padStart(8, '0')}`,
      servicio_desde: f.servicio_desde ?? f.fecha,
      servicio_hasta: f.servicio_hasta ?? f.fecha,
      vence_pago: hoy,
      ambiente: f.ambiente,
      estado: 'borrador',
      solicitud,
      quien,
    });
  } catch (e) {
    console.error('arca reserva (NC):', e);
    return noAnula('Hay otro comprobante de esta emisora emitiéndose. Probá de nuevo en un momento.', 409);
  }

  // Si no se puede borrar, queda en borrador: el próximo pedido la averigua
  // y la descarta.
  const descartar = async () => {
    try {
      await borrarFila(nota.id);
    } catch (e) {
      console.error('arca, descartar la nota de crédito:', e);
    }
  };

  let r: any;
  try {
    r = await arca.createVoucher(solicitud);
  } catch (e) {
    console.error('arca nota de crédito:', e);
    try {
      await espera(2500);
      const a = await averiguar(arca, f.punto_venta, NOTA_DE_CREDITO_C, numero, total, docNro);
      if (a.que === 'autorizado') return cerrar(nota.id, numero, a.cae, a.vence, a.info);
      await descartar();
      return noAnula('ARCA no contestó. No se anuló nada; se puede volver a intentar.', 502);
    } catch (e2) {
      console.error('arca consulta tras el corte (NC):', e2);
      return noAnula(
        `No se pudo confirmar con ARCA si la nota de crédito ${numero} quedó emitida. ` +
          'Probá de nuevo en un momento: primero averigua en qué quedó, no emite otra.',
        502
      );
    }
  }

  const detalle = r.response?.FeDetResp?.FECAEDetResponse?.[0];
  if (detalle?.Resultado === 'A' && r.cae) {
    return cerrar(nota.id, numero, r.cae, r.caeFchVto, r.response);
  }
  await descartar();
  return noAnula(`ARCA rechazó la nota de crédito: ${motivos(r.response)}`, 422);
}
