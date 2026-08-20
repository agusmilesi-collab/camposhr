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

export type Pedido = {
  id: string;
  puesto: string;
  empresa: string;
  empresaId: string;
  bateria: string | null;
  bateriaId: string | null;
  conBenziger: boolean;
  familia: string | null;
  seniority: string | null;
  estado: string;
  fechaPedido: string | null;
  notas: string | null;
  contexto: string | null;
  /** Cuántas evaluaciones cuelgan del pedido y cuántas ya se entregaron. */
  candidatos: number;
  entregados: number;
  puesto_problemas: string | null;
  puesto_presion: string | null;
  puesto_interaccion: string | null;
  puesto_estabilidad: string | null;
  puesto_contacto_jefe: string | null;
  puesto_innovacion: string | null;
  jefe_estilo: string | null;
  jefe_paciencia: string | null;
  jefe_emociones: string | null;
};

type Fila = {
  id: string;
  puesto: string;
  empresa_id: string;
  bateria_id: string | null;
  con_benziger: boolean;
  familia: string | null;
  seniority: string | null;
  estado: string;
  fecha_pedido: string | null;
  notas: string | null;
  contexto: string | null;
  empresas: { nombre: string } | null;
  baterias: { codigo: string } | null;
  evaluaciones: { id: string; estado: string | null }[];
  puesto_problemas: string | null;
  puesto_presion: string | null;
  puesto_interaccion: string | null;
  puesto_estabilidad: string | null;
  puesto_contacto_jefe: string | null;
  puesto_innovacion: string | null;
  jefe_estilo: string | null;
  jefe_paciencia: string | null;
  jefe_emociones: string | null;
};

const CAMPOS =
  'id,puesto,empresa_id,bateria_id,con_benziger,familia,seniority,estado,' +
  'fecha_pedido,notas,contexto,puesto_problemas,puesto_presion,' +
  'puesto_interaccion,puesto_estabilidad,puesto_contacto_jefe,' +
  'puesto_innovacion,jefe_estilo,jefe_paciencia,jefe_emociones,' +
  'empresas(nombre),baterias(codigo),evaluaciones(id,estado)';

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
    familia: f.familia,
    seniority: f.seniority,
    estado: f.estado,
    fechaPedido: f.fecha_pedido,
    notas: f.notas,
    contexto: f.contexto,
    candidatos: evaluaciones.length,
    entregados: evaluaciones.filter((e) => e.estado && CERRADAS.has(e.estado)).length,
    puesto_problemas: f.puesto_problemas,
    puesto_presion: f.puesto_presion,
    puesto_interaccion: f.puesto_interaccion,
    puesto_estabilidad: f.puesto_estabilidad,
    puesto_contacto_jefe: f.puesto_contacto_jefe,
    puesto_innovacion: f.puesto_innovacion,
    jefe_estilo: f.jefe_estilo,
    jefe_paciencia: f.jefe_paciencia,
    jefe_emociones: f.jefe_emociones,
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
