/**
 * Editar y borrar un candidato ya cargado.
 *
 * Lo que se ve en la tarjeta del tablero vive repartido en dos tablas: el
 * nombre y el contacto son de la persona, y el pedido y la evaluadora son de
 * la evaluación. Acá se guardan juntos, que es como se los corrige: se abre la
 * tarjeta, se arregla el teléfono mal tipeado y se cierra.
 *
 * Escribe en Supabase y solo en Supabase: una fila que todavía vive en
 * Airtable se sigue trabajando desde ahí (ver `CLAUDE.md`).
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { subirCv } from '@/lib/altas';

const BUCKET = 'psicotecnicos';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Las etapas en las que el trabajo ya salió del OS.
 *
 * Un informe entregado es trabajo cobrado y una constancia de lo que se dijo
 * del candidato: no se borra desde el tablero.
 */
const ENTREGADAS = new Set(['Entregado', 'Seguimiento']);

type Resultado = { ok: true } | { ok: false; motivo: string };

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');
  return { url, key };
}

async function patch(tabla: string, filtro: string, campos: Record<string, unknown>) {
  const { url, key } = config();
  const res = await fetch(`${url}/rest/v1/${tabla}?${filtro}`, {
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
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

type Actual = {
  persona_id: string;
  pedido_id: string | null;
  estado: string;
  informe_path: string | null;
};

async function actual(id: string): Promise<Actual | null> {
  const filas = await select<Actual>(
    'evaluaciones',
    `select=persona_id,pedido_id,estado,informe_path&id=eq.${id}&limit=1`
  );
  return filas[0] ?? null;
}

export type CandidatoEditado = {
  nombre: string;
  email: string | null;
  telefono: string | null;
  pedidoId: string;
  /** El nombre de la evaluadora, o vacío para devolverlo a Sin asignar. */
  evaluadora: string;
  /**
   * Cuándo y cómo es la entrevista, o null para borrarlas.
   *
   * Se corrigen desde acá además de desde el tablero: una reprogramación se
   * avisa mientras se está mirando la ficha, y hasta ahora había que volver a
   * Entrevistas a buscar la tarjeta. `undefined` es "no se tocó"; `null`, "se
   * vació", que no es lo mismo.
   */
  fechaEntrevista?: string | null;
  modalidad?: string | null;
  cv?: File | null;
};

/** Las dos formas en que se toma una entrevista. */
const MODALIDADES = ['Presencial', 'Online'];

export async function editarCandidato(id: string, c: CandidatoEditado): Promise<Resultado> {
  if (!UUID.test(id)) return { ok: false, motivo: 'Identificador inválido.' };
  if (!c.nombre) return { ok: false, motivo: 'Falta el nombre.' };
  if (!c.telefono && !c.email) {
    // Es la misma regla del alta: sin una de las dos no se puede citar.
    return { ok: false, motivo: 'Hace falta un teléfono o un correo para poder citarla.' };
  }
  if (!UUID.test(c.pedidoId)) return { ok: false, motivo: 'Elegí a qué búsqueda entra.' };

  const fila = await actual(id);
  if (!fila) return { ok: false, motivo: 'Esa evaluación no existe.' };

  const persona: Record<string, unknown> = {
    nombre: c.nombre,
    email: c.email,
    telefono: c.telefono,
  };
  const evaluacion: Record<string, unknown> = {};

  // Cambiar de pedido puede cambiar de cliente, y la persona guarda de qué
  // empresa es: si no se mueve con el pedido, queda contada en la anterior.
  if (c.pedidoId !== fila.pedido_id) {
    const pedido = (
      await select<{ empresa_id: string }>(
        'pedidos',
        `select=empresa_id&id=eq.${c.pedidoId}&limit=1`
      )
    )[0];
    if (!pedido) return { ok: false, motivo: 'Ese pedido no existe.' };
    evaluacion.pedido_id = c.pedidoId;
    persona.empresa_id = pedido.empresa_id;
  }

  if (c.evaluadora) {
    const encontrada = await select<{ id: string }>(
      'evaluadoras',
      `select=id&nombre=eq.${encodeURIComponent(c.evaluadora)}&limit=1`
    );
    if (!encontrada[0]) return { ok: false, motivo: 'Esa evaluadora no está cargada.' };
    evaluacion.evaluadora_id = encontrada[0].id;
    // La misma regla del reparto: darle dueño la manda al trabajo siguiente.
    if (fila.estado === 'Sin asignar') evaluacion.estado = 'Por citar';
  } else {
    evaluacion.evaluadora_id = null;
    if (fila.estado === 'Por citar') evaluacion.estado = 'Sin asignar';
  }

  if (c.modalidad !== undefined) {
    if (c.modalidad && !MODALIDADES.includes(c.modalidad)) {
      return { ok: false, motivo: 'Esa modalidad no existe.' };
    }
    evaluacion.modalidad = c.modalidad || null;
  }

  if (c.fechaEntrevista !== undefined) {
    if (c.fechaEntrevista && Number.isNaN(Date.parse(c.fechaEntrevista))) {
      return { ok: false, motivo: 'Esa fecha de entrevista no se entiende.' };
    }
    evaluacion.fecha_entrevista = c.fechaEntrevista || null;
  }

  if (c.cv) {
    const ruta = await subirCv(fila.persona_id, c.cv);
    if (ruta) persona.cv_path = ruta;
  }

  await patch('personas', `id=eq.${fila.persona_id}`, persona);
  if (Object.keys(evaluacion).length > 0) {
    await patch('evaluaciones', `id=eq.${id}`, evaluacion);
  }
  return { ok: true };
}

/**
 * Borra la evaluación y, si a la persona no le queda ninguna otra, también a
 * la persona y su CV.
 *
 * Todo lo que cuelga de la evaluación (manchas, sumario, Benziger, tests e
 * informe) se va con ella por `on delete cascade`. La persona no: la misma
 * puede haber sido evaluada para dos búsquedas, y borrar una no puede llevarse
 * la otra.
 */
export async function borrarCandidato(
  id: string
): Promise<{ ok: true; nombre: string } | { ok: false; motivo: string }> {
  if (!UUID.test(id)) return { ok: false, motivo: 'Identificador inválido.' };

  const fila = await actual(id);
  if (!fila) return { ok: false, motivo: 'Esa evaluación no existe.' };
  if (fila.informe_path || ENTREGADAS.has(fila.estado)) {
    return { ok: false, motivo: 'El informe ya salió: esta evaluación no se borra desde acá.' };
  }

  const persona = (
    await select<{ nombre: string; cv_path: string | null }>(
      'personas',
      `select=nombre,cv_path&id=eq.${fila.persona_id}&limit=1`
    )
  )[0];

  const { url, key } = config();
  const cabeceras = { apikey: key, Authorization: `Bearer ${key}` };

  const res = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${id}`, {
    method: 'DELETE',
    headers: cabeceras,
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` };
  }

  const otras = await select<{ id: string }>(
    'evaluaciones',
    `select=id&persona_id=eq.${fila.persona_id}&limit=1`
  );
  if (otras.length === 0) {
    if (persona?.cv_path) {
      // Si el archivo no se va, el borrado no fue tal: el CV tiene el nombre,
      // el teléfono y el recorrido de la persona.
      await fetch(`${url}/storage/v1/object/${BUCKET}/${persona.cv_path}`, {
        method: 'DELETE',
        headers: cabeceras,
        cache: 'no-store',
      }).catch(() => null);
    }
    await fetch(`${url}/rest/v1/personas?id=eq.${fila.persona_id}`, {
      method: 'DELETE',
      headers: cabeceras,
      cache: 'no-store',
    });
  }

  return { ok: true, nombre: persona?.nombre ?? 'La evaluación' };
}
