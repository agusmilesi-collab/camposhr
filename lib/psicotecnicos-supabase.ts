/**
 * Psicotécnicos leídos y escritos en Supabase.
 *
 * Es el módulo que va a reemplazar al de Airtable. Mientras dure la
 * transición los dos conviven detrás de `lib/psicotecnicos.ts`, que junta lo
 * que devuelven y manda cada guardado al lado donde vive esa fila.
 *
 * Devuelve la misma forma que el lector de Airtable a propósito: si las dos
 * mitades no tuvieran el mismo tipo, la pantalla tendría que saber de dónde
 * salió cada persona, y ahí la capa de servicios deja de servir para algo.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { diasDesde } from '@/lib/hora';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import {
  esColumnaTablero,
  esPrioridad,
  yaEntregada,
  type Evaluacion,
} from '@/lib/psicotecnicos-tipos';
import { siEstaTodoTomado } from '@/lib/entrevista-completa';
import { ajustarPedidoDe } from '@/lib/pedido-completo';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los campos que una pantalla puede guardar, por su nombre en la aplicación. */
export function esCampoEditable(x: string): boolean {
  return Object.prototype.hasOwnProperty.call(COLUMNA, x) || x === 'evaluadora';
}

export function esDeSupabase(id: string): boolean {
  return UUID.test(id);
}

/**
 * Los campos editables, con el nombre que tienen en la tabla.
 *
 * Las columnas se llaman como los campos de Airtable (ver `CLAUDE.md` y
 * `supabase/renombrar-campos-como-airtable.sql`), así que a la izquierda queda
 * el nombre interno de la aplicación y a la derecha el de la base.
 */
const COLUMNA: Record<string, string> = {
  etapa: 'estado',
  mensaje: 'mensaje',
  modalidad: 'modalidad',
  fechaEntrevista: 'fecha_entrevista',
  enlaceEntrevista: 'enlace_entrevista',
  benderAdministrado: 'bender_administrado',
  graficoAdministrado: 'grafico_2_personas_administrado',
  proyectivoAdministrado: 'proyectivo_administrado',
  benzigerAdministrado: 'benziger_administrado',
  benderObservaciones: 'bender_observaciones',
  graficoObservaciones: 'grafico_2_personas_observaciones',
  recomendacion: 'recomendacion',
  recomendacionNotas: 'recomendacion_notas',
  ingreso: 'ingreso',
  fechaIngresoEmpresa: 'fecha_ingreso_empresa',
  numeroFactura: 'numero_factura',
  facturado: 'facturado',
  pagado: 'pagado',
  seguimientoAl: 'seguimiento_al',
  seguimientoResultado: 'seguimiento_resultado',
  seguimientoNotas: 'seguimiento_notas',
  tablero: 'tablero',
  prioridad: 'prioridad',
};

type Fila = {
  id: string;
  estado: string;
  mensaje: string | null;
  modalidad: string | null;
  fecha_ingreso: string | null;
  fecha_entrevista: string | null;
  fecha_entrega: string | null;
  bender_administrado: boolean;
  grafico_2_personas_administrado: boolean;
  benziger_administrado: boolean | null;
  recomendacion: string | null;
  informe_path: string | null;
  ingreso: boolean | null;
  seguimiento_al: string | null;
  seguimiento_resultado: string | null;
  facturado: boolean | null;
  pagado: boolean | null;
  tablero: string | null;
  prioridad: string | null;
  personas: {
    nombre: string;
    email: string | null;
    telefono: string | null;
    cv_path: string | null;
  } | null;
  evaluadoras: { nombre: string } | null;
  pedido_id: string | null;
  pedidos: {
    puesto: string;
    con_benziger: boolean | null;
    empresas: { nombre: string } | null;
    baterias: { codigo: string } | null;
  } | null;
};

const CAMPOS =
  'id,estado,mensaje,modalidad,fecha_ingreso,fecha_entrevista,fecha_entrega,' +
  'bender_administrado,grafico_2_personas_administrado,benziger_administrado,' +
  'recomendacion,informe_path,' +
  'ingreso,seguimiento_al,seguimiento_resultado,facturado,pagado,tablero,prioridad,' +
  'personas(nombre,email,telefono,cv_path),evaluadoras(nombre),pedido_id,' +
  'pedidos(puesto,con_benziger,empresas(nombre),baterias(codigo))';

export async function listar(): Promise<Evaluacion[]> {
  const filas = await select<Fila>(
    'evaluaciones',
    `select=${CAMPOS}&order=created_at.desc`,
    CACHE_PSICOTECNICOS
  );

  const hoy = new Date();
  return filas.map((f) => ({
    id: f.id,
    origen: 'supabase' as const,
    nombre: f.personas?.nombre ?? 'Sin nombre',
    empresa: f.pedidos?.empresas?.nombre ?? 'Sin empresa',
    puesto: f.pedidos?.puesto ?? 'Sin puesto',
    pedidoId: f.pedido_id,
    bateria: f.pedidos?.baterias?.codigo ?? null,
    // Lo pidió el pedido o se le tomó igual: las dos cosas quieren decir que
    // esta persona tiene Benziger, que es lo que el sello dice.
    conBenziger: f.pedidos?.con_benziger === true || f.benziger_administrado === true,
    email: f.personas?.email ?? null,
    telefono: f.personas?.telefono ?? null,
    evaluadora: f.evaluadoras?.nombre ?? null,
    etapa: f.estado,
    mensaje: f.mensaje,
    modalidad: f.modalidad,
    fechaIngreso: f.fecha_ingreso,
    fechaEntrevista: f.fecha_entrevista,
    fechaEntrega: f.fecha_entrega,
    benderAdministrado: f.bender_administrado,
    graficoAdministrado: f.grafico_2_personas_administrado,
    linkRaven: null,
    recomendacion: f.recomendacion,
    // El informe no es un archivo subido: se arma con los datos cargados, así
    // que existe desde que la evaluación se entrega.
    tieneInforme: yaEntregada(f.estado) || Boolean(f.informe_path),
    ingreso: f.ingreso,
    seguimientoAl: f.seguimiento_al,
    seguimientoResultado: f.seguimiento_resultado,
    facturado: f.facturado === true,
    pagado: f.pagado === true,
    tieneCv: Boolean(f.personas?.cv_path),
    servicio: null,
    dias: diasDesde(f.fecha_entrevista, hoy),
    diasEsperando: f.fecha_entrevista ? null : diasDesde(f.fecha_ingreso, hoy),
    diasSolicitud: diasDesde(f.fecha_ingreso, hoy),
    tablero: esColumnaTablero(f.tablero) ? f.tablero : null,
    prioridad: esPrioridad(f.prioridad) ? f.prioridad : null,
    prueba: /^distribuidora andina/i.test(f.pedidos?.empresas?.nombre ?? ''),
  }));
}

/** Las evaluadoras cargadas. */
export async function evaluadoras(): Promise<string[]> {
  const filas = await select<{ nombre: string }>(
    'evaluadoras',
    'select=nombre&activa=is.true&order=nombre.asc',
    CACHE_PSICOTECNICOS
  );
  return filas.map((f) => f.nombre);
}

export async function guardarCampos(
  id: string,
  cambios: Record<string, string | boolean | null>
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!UUID.test(id)) return { ok: false, motivo: 'Identificador inválido.' };

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { ok: false, motivo: 'Falta la configuración de Supabase.' };

  const fila: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(cambios)) {
    if (campo === 'evaluadora') {
      // La evaluadora es una fila aparte: se guarda su identificador.
      if (!valor) {
        fila.evaluadora_id = null;
      } else {
        const encontrada = await select<{ id: string }>(
          'evaluadoras',
          `select=id&nombre=eq.${encodeURIComponent(String(valor))}&limit=1`
        );
        if (!encontrada[0]) return { ok: false, motivo: 'Esa evaluadora no está cargada.' };
        fila.evaluadora_id = encontrada[0].id;
      }
      continue;
    }
    const columna = COLUMNA[campo];
    if (!columna) return { ok: false, motivo: 'Campo no editable.' };
    // Los dos campos del tablero tienen su lista cerrada y la base los
    // comprueba: si llega otra cosa, el rechazo tiene que decir qué pasó y no
    // devolver el texto de la restricción de Postgres.
    if (campo === 'tablero' && valor !== null && !esColumnaTablero(valor)) {
      return { ok: false, motivo: 'Esa columna del tablero no existe.' };
    }
    if (campo === 'prioridad' && valor !== null && !esPrioridad(valor)) {
      return { ok: false, motivo: 'Esa prioridad no existe.' };
    }
    fila[columna] = valor === '' ? null : valor;
  }

  /**
   * Entregar sella la fecha.
   *
   * Antes venía del archivo que se subía a mano; ahora el informe se genera y
   * nadie sube nada, así que la fecha la pone el paso de etapa. Solo si no
   * estaba: volver a entregar algo ya entregado no cambia cuándo se entregó.
   */
  if (fila.estado === 'Entregado' && !('fecha_entrega' in fila)) {
    const previas = await select<{ fecha_entrega: string | null }>(
      'evaluaciones',
      `select=fecha_entrega&id=eq.${id}&limit=1`
    );
    if (!previas[0]?.fecha_entrega) fila.fecha_entrega = new Date().toISOString();
  }

  /**
   * El seguimiento se prende solo cuando la persona entró a trabajar.
   *
   * A los noventa días del ingreso se llama al cliente para preguntar cómo le
   * fue, y esa fecha la agenda la ficha al cargar desde cuándo trabaja. Lo que
   * faltaba era mover la etapa: quedaba en Entregado con el reloj puesto, así
   * que la columna de seguimiento decía "sin seguir", el aviso de vencidos no
   * la contaba y el cliente no veía "en seguimiento" en su portal. Era la mitad
   * del circuito prendida.
   *
   * Y al revés: si después se corrige que no entró, o se borra la fecha, la
   * evaluación vuelve a Entregado. Un seguimiento sin reloj no vence nunca y
   * quedaría en la lista para siempre.
   *
   * No pisa un cambio de etapa hecho a mano: mover la etapa ya dice a dónde va.
   */
  if (!('estado' in fila) && ('ingreso' in fila || 'fecha_ingreso_empresa' in fila)) {
    const previas = await select<{
      estado: string;
      ingreso: boolean | null;
      fecha_ingreso_empresa: string | null;
    }>(
      'evaluaciones',
      `select=estado,ingreso,fecha_ingreso_empresa&id=eq.${id}&limit=1`
    );
    const antes = previas[0];
    if (antes) {
      const ingreso = 'ingreso' in fila ? fila.ingreso : antes.ingreso;
      const desde =
        'fecha_ingreso_empresa' in fila
          ? fila.fecha_ingreso_empresa
          : antes.fecha_ingreso_empresa;
      const sigue = ingreso === true && Boolean(desde);
      if (sigue && antes.estado === 'Entregado') fila.estado = 'Seguimiento';
      if (!sigue && antes.estado === 'Seguimiento') fila.estado = 'Entregado';
    }
  }

  if (Object.keys(fila).length === 0) return { ok: true };

  const res = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fila),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` };
  }

  // Marcar el último test como administrado cierra la entrevista sola. No pasa
  // si el cambio fue de etapa: mover a mano ya dice a dónde va.
  if (!('estado' in fila)) await siEstaTodoTomado(id);

  // Y entregar el último informe cierra el pedido, que es lo que significa que
  // la búsqueda terminó. Va después de escribir: mira cómo quedó, no cómo
  // estaba.
  if ('estado' in fila) await ajustarPedidoDe(id);
  return { ok: true };
}
