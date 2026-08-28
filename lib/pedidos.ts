/**
 * Los pedidos: qué busca cada cliente y en qué estado está esa búsqueda.
 *
 * Un pedido se abre cuando el cliente pide cubrir un puesto y se cierra cuando
 * se evaluó a todos los candidatos que hacían falta. Sin ese cierre la lista
 * crece para siempre y el selector de la tarjeta de alta termina ofreciendo
 * búsquedas terminadas hace meses.
 *
 * Los campos son los de la tabla `Pedidos` de Airtable, con sus mismas
 * opciones (ver `lib/pedido-campos.ts`).
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { ABIERTO } from '@/lib/pedido-campos';
import type { Pedido } from '@/lib/pedidos-tipos';

export type { Pedido };
export { loQueFalta, perfilContestado } from '@/lib/pedidos-tipos';

type Fila = {
  id: string;
  puesto: string;
  empresa_id: string;
  bateria_id: string | null;
  con_benziger: boolean;
  exigencia_id: string | null;
  familia: string | null;
  seniority: string | null;
  estado: string;
  fecha_pedido: string | null;
  reabierto_el: string | null;
  notas: string | null;
  contexto: string | null;
  empresas: { nombre: string } | null;
  baterias: { codigo: string } | null;
  evaluaciones: { id: string; estado: string | null; personas: { nombre: string } | null }[];
  puesto_problemas: string | null;
  puesto_presion: string | null;
  puesto_interaccion: string | null;
  puesto_estabilidad: string | null;
  puesto_contacto_jefe: string | null;
  puesto_innovacion: string | null;
  jefe_estilo: string | null;
  jefe_paciencia: string | null;
  jefe_emociones: string | null;
  /** El nivel de trabajo del puesto, que es contra lo que se mide a la persona. */
  time_span_dias: number | null;
  complejidad: Record<string, boolean> | null;
  estrato_puesto: number | null;
};

const CAMPOS =
  'id,puesto,empresa_id,bateria_id,con_benziger,exigencia_id,familia,seniority,estado,' +
  'fecha_pedido,reabierto_el,notas,contexto,puesto_problemas,puesto_presion,' +
  'puesto_interaccion,puesto_estabilidad,puesto_contacto_jefe,' +
  'puesto_innovacion,jefe_estilo,jefe_paciencia,jefe_emociones,' +
  'time_span_dias,complejidad,estrato_puesto,' +
  'empresas(nombre),baterias(codigo),evaluaciones(id,estado,personas(nombre))';

/** Los estados de una evaluación que cuentan como trabajo terminado. */
const CERRADAS = new Set(['Entregado', 'Seguimiento']);

function armar(f: Fila): Pedido {
  const evaluaciones = f.evaluaciones ?? [];
  return {
    id: f.id,
    puesto: f.puesto,
    empresa: f.empresas?.nombre ?? 'Sin cliente',
    empresaId: f.empresa_id,
    bateria: f.baterias?.codigo ?? null,
    bateriaId: f.bateria_id,
    conBenziger: f.con_benziger,
    exigenciaId: f.exigencia_id,
    familia: f.familia,
    seniority: f.seniority,
    estado: f.estado,
    // La fecha de la solicitud que está en curso. Reabierto, es la de la
    // reapertura: contarlo desde el día en que se pidió la primera tanda diría
    // que lleva meses abierto.
    fechaPedido: f.reabierto_el ?? f.fecha_pedido,
    reabierto: f.reabierto_el,
    fechaOriginal: f.fecha_pedido,
    notas: f.notas,
    contexto: f.contexto,
    candidatos: evaluaciones.length,
    entregados: evaluaciones.filter((e) => e.estado && CERRADAS.has(e.estado)).length,
    gente: evaluaciones.map((e) => ({
      id: e.id,
      nombre: e.personas?.nombre ?? 'Sin nombre',
      estado: e.estado ?? 'Sin asignar',
    })),
    puesto_problemas: f.puesto_problemas,
    puesto_presion: f.puesto_presion,
    puesto_interaccion: f.puesto_interaccion,
    puesto_estabilidad: f.puesto_estabilidad,
    puesto_contacto_jefe: f.puesto_contacto_jefe,
    puesto_innovacion: f.puesto_innovacion,
    jefe_estilo: f.jefe_estilo,
    jefe_paciencia: f.jefe_paciencia,
    jefe_emociones: f.jefe_emociones,
    timeSpanDias: f.time_span_dias,
    complejidad: f.complejidad,
    estratoPuesto: f.estrato_puesto,
  };
}

export async function listarPedidos(): Promise<Pedido[]> {
  const filas = await select<Fila>(
    'pedidos',
    `select=${CAMPOS}&order=fecha_pedido.desc`,
    CACHE_PSICOTECNICOS
  );
  return filas.map(armar);
}

export async function leerPedido(id: string): Promise<Pedido | null> {
  const filas = await select<Fila>(
    'pedidos',
    `select=${CAMPOS}&id=eq.${id}`,
    CACHE_PSICOTECNICOS
  );
  return filas[0] ? armar(filas[0]) : null;
}

export function estaAbierto(p: Pedido): boolean {
  return p.estado === ABIERTO;
}

