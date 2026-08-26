/**
 * Alta de pedidos y de candidatos desde el OS.
 *
 * Existe porque el trabajo entra por dos puertas. Algunos clientes cargan la
 * solicitud en su portal; otros mandan un mail y la carga una psicóloga. Las
 * dos terminan en la misma fila, y `origen` guarda por cuál entró.
 *
 * Escribe en Supabase y no en Airtable a propósito: lo que se carga de ahora
 * en adelante nace del lado nuevo. Lo que ya está en Airtable se sigue
 * trabajando desde ahí hasta que le toque mudarse.
 *
 * El pedido y el candidato se cargan por separado, que es la diferencia con el
 * formulario del portal: adentro llega primero la búsqueda y los candidatos
 * aparecen después, de a uno.
 */

import 'server-only';
import { ajustarPedidoDe } from '@/lib/pedido-completo';
import { select } from '@/lib/supabase';
import { CACHE_CLIENTES, CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { ABIERTO } from '@/lib/pedido-campos';

const BUCKET = 'psicotecnicos';

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

async function insertar<T>(tabla: string, fila: Record<string, unknown>): Promise<T> {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${tabla}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(fila),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const filas = await res.json();
  return filas[0];
}

export type EmpresaOpcion = { id: string; nombre: string };
export type BateriaOpcion = { id: string; codigo: string; nombre: string };
export type PedidoOpcion = {
  id: string;
  puesto: string;
  empresa: string;
  candidatos: number;
};

export async function empresas(): Promise<EmpresaOpcion[]> {
  return select<EmpresaOpcion>(
    'empresas',
    'select=id,nombre&activa=is.true&order=nombre.asc',
    CACHE_CLIENTES
  );
}

export async function baterias(): Promise<BateriaOpcion[]> {
  return select<BateriaOpcion>(
    'baterias',
    'select=id,codigo,nombre&order=codigo.asc',
    CACHE_PSICOTECNICOS
  );
}

export async function evaluadoras(): Promise<EmpresaOpcion[]> {
  return select<EmpresaOpcion>(
    'evaluadoras',
    'select=id,nombre&activa=is.true&order=nombre.asc',
    CACHE_PSICOTECNICOS
  );
}

/**
 * Los pedidos a los que se le puede colgar un candidato.
 *
 * Son los que tienen trabajo por hacer, y solo esos: el estado lo mantiene la
 * base sola, y un pedido se cierra cuando todos sus candidatos quedaron
 * entregados. Reabrir uno es una decisión sobre el trabajo con ese cliente y se
 * toma en su ficha, en Clientes.
 *
 * **Ordenados por empresa y después por puesto**, y no por fecha: el que carga
 * viene leyendo un mail de un cliente y busca su nombre en la lista, no el
 * pedido más reciente de cualquiera.
 */
export async function pedidosAbiertos(): Promise<PedidoOpcion[]> {
  return pedidosDeEstado(ABIERTO);
}

async function pedidosDeEstado(estado: string): Promise<PedidoOpcion[]> {
  const filas = await select<{
    id: string;
    puesto: string;
    empresas: { nombre: string } | null;
    evaluaciones: { id: string }[];
  }>(
    'pedidos',
    `select=id,puesto,empresas(nombre),evaluaciones(id)&estado=eq.${encodeURIComponent(
      estado
    )}&order=fecha_pedido.desc`,
    CACHE_PSICOTECNICOS
  );
  return filas
    .map((f) => ({
      id: f.id,
      puesto: f.puesto,
      empresa: f.empresas?.nombre ?? 'Sin empresa',
      candidatos: f.evaluaciones?.length ?? 0,
    }))
    .sort(
      (a, b) =>
        a.empresa.localeCompare(b.empresa, 'es') || a.puesto.localeCompare(b.puesto, 'es')
    );
}

/** El nombre de una empresa como parte de una dirección. */
function slug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Da de alta un cliente que todavía no existe.
 *
 * Es lo que evita que cargar el primer pedido de un cliente nuevo obligue a
 * salir del OS. Si el nombre ya está, devuelve el que hay.
 */
export async function crearEmpresa(nombre: string): Promise<EmpresaOpcion> {
  const limpio = nombre.trim();
  const s = slug(limpio);
  const existentes = await select<EmpresaOpcion>(
    'empresas',
    `select=id,nombre&slug=eq.${s}&limit=1`
  );
  if (existentes[0]) return existentes[0];
  return insertar<EmpresaOpcion>('empresas', { nombre: limpio, slug: s, activa: true });
}

export type PedidoNuevo = {
  empresaId: string;
  puesto: string;
  bateriaId: string | null;
  /** Si la búsqueda lleva el Benziger, que es un adicional por evaluación. */
  conBenziger: boolean;
  familia: string | null;
  seniority: string | null;
  fechaPedido: string | null;
  notas: string | null;
  origen: 'interno' | 'portal';
};

export async function crearPedido(p: PedidoNuevo): Promise<{ id: string }> {
  return insertar<{ id: string }>('pedidos', {
    empresa_id: p.empresaId,
    puesto: p.puesto,
    bateria_id: p.bateriaId,
    con_benziger: p.conBenziger,
    familia: p.familia,
    seniority: p.seniority,
    fecha_pedido: p.fechaPedido,
    notas: p.notas,
    estado: ABIERTO,
    origen: p.origen,
  });
}

export type CandidatoNuevo = {
  pedidoId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  evaluadoraId: string | null;
  origen: 'interno' | 'portal';
  cv?: File | null;
};

/**
 * Carga un candidato y le abre su evaluación.
 *
 * La persona y la evaluación se crean juntas porque una persona sin
 * evaluación no es nada en este servicio: es alguien de quien se guardó el
 * nombre y no se sabe para qué.
 *
 * La etapa inicial sale de si ya tiene evaluadora: con una asignada arranca en
 * "Por citar", que es el trabajo siguiente; sin nadie, queda en "Sin asignar",
 * que es la pantalla donde se reparte.
 */
export async function crearCandidato(c: CandidatoNuevo): Promise<{ id: string }> {
  const pedido = (
    await select<{ empresa_id: string }>(
      'pedidos',
      `select=empresa_id&id=eq.${c.pedidoId}&limit=1`
    )
  )[0];
  if (!pedido) throw new Error('Ese pedido no existe.');

  const persona = await insertar<{ id: string }>('personas', {
    empresa_id: pedido.empresa_id,
    nombre: c.nombre,
    email: c.email,
    telefono: c.telefono,
    origen: c.origen,
  });

  if (c.cv) {
    const ruta = await subirCv(persona.id, c.cv);
    if (ruta) await actualizarPersona(persona.id, { cv_path: ruta });
  }

  const evaluacion = await insertar<{ id: string }>('evaluaciones', {
    persona_id: persona.id,
    pedido_id: c.pedidoId,
    evaluadora_id: c.evaluadoraId,
    estado: c.evaluadoraId ? 'Por citar' : 'Sin asignar',
    mensaje: c.evaluadoraId ? 'Sin contactar' : null,
    fecha_ingreso: new Date().toISOString().slice(0, 10),
  });

  // Un candidato nuevo en un pedido que se había cerrado lo vuelve a abrir: un
  // pedido cerrado no admite candidatos, así que dejarlo cerrado con alguien
  // adentro esconde ese trabajo.
  await ajustarPedidoDe(evaluacion.id);
  return evaluacion;
}

async function actualizarPersona(id: string, campos: Record<string, unknown>) {
  const { url, key } = config();
  await fetch(`${url}/rest/v1/personas?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(campos),
    cache: 'no-store',
  });
}

/**
 * Guarda el CV en el bucket privado y devuelve su ruta.
 *
 * Nunca va a un lugar público: el archivo trae el nombre, el teléfono y el
 * recorrido de una persona identificable. Se sirve con una dirección firmada y
 * de vida corta cuando haga falta abrirlo.
 *
 * Si falla, no tira: el candidato ya se cargó y perder el adjunto no puede
 * costar el alta entera.
 */
export async function subirCv(personaId: string, cv: File): Promise<string | null> {
  try {
    const { url, key } = config();
    const ext = (cv.name.split('.').pop() ?? 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ruta = `cv/${personaId}.${ext || 'pdf'}`;
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': cv.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: new Uint8Array(await cv.arrayBuffer()),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('cv: no se pudo subir', res.status, await res.text());
      return null;
    }
    return ruta;
  } catch (e) {
    console.error('cv: no se pudo subir', e);
    return null;
  }
}
