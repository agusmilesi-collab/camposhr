/**
 * El pipeline de psicotécnicos en Airtable. SOLO LECTURA.
 *
 * **El OS no escribe en Airtable.** La regla está en `CLAUDE.md` y en
 * `CAMPOS OS/LEEME.md`, y la hace cumplir `lib/psicotecnicos.ts`, que rechaza
 * cualquier guardado sobre una fila de este lado. `guardarCampos` quedó acá
 * sin quien lo llame, a la espera de irse con la migración: no se lo enchufe
 * de nuevo.
 *
 * Todo lo que el OS guarda va a Supabase. Lo que hoy vive de este lado se
 * migra antes de construir la pantalla que lo necesita, nunca después.
 *
 * Es el lado viejo de la migración. Quien lo usa es `lib/psicotecnicos.ts`,
 * que junta esto con lo que ya vive en Supabase. Cuando no quede nada de este
 * lado, se borra el archivo y la capa de arriba no se entera.
 *
 * Va aparte de `lib/airtable.ts` a propósito. Ese archivo sirve al portal del
 * cliente y su lista blanca deja afuera el teléfono, el correo y todo lo
 * clínico. Acá el lector es el equipo interno, que sí necesita el contacto
 * para citar, así que la lista blanca es otra y este archivo se sirve
 * únicamente detrás de la puerta del OS (ver `lib/os-sesion.ts`).
 *
 * **Lo clínico todavía no entra.** El sumario estructural, el Benziger y el
 * Raven quedan fuera de esta lista hasta que el OS tenga una cuenta por
 * psicóloga y el registro de accesos pueda decir quién leyó qué. Las columnas
 * ya existen en Supabase (`supabase/psicotecnicos.sql`); lo que falta es la
 * identidad, no el lugar donde guardarlo.
 *
 * Lee con `AIRTABLE_TOKEN`. La escritura quedó sin uso: `CAMPOS_EDITABLES` y
 * `guardarCampos` siguen acá solamente hasta que la migración se los lleve.
 */

import 'server-only';
import { esEmpresaDePrueba } from '@/lib/empresa-prueba';
import { diasDesde, habilesDesde } from '@/lib/hora';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { ETAPAS, RUTA, type Etapa, type Evaluacion } from '@/lib/psicotecnicos-tipos';
export { ETAPAS, RUTA, ETAPA_DE_RUTA } from '@/lib/psicotecnicos-tipos';
export type { Etapa } from '@/lib/psicotecnicos-tipos';

const BASE = 'appGhbo58t44fOIGe';
const API = 'https://api.airtable.com/v0';
const T_INDIVIDUO = 'tbl6Ji4P7d6hOKNUY';
const T_EVALUADORAS = 'tblBhmxk02yBccL8d';
const T_PEDIDOS = 'tblA3o1XsDXyJXSgF';
const T_EMPRESAS = 'tblNKMu8gqYmoA70N';
const T_BATERIAS = 'tbl32bHLZ3sKv4Lt2';

const F = {
  nombre: 'fldB61ycDOKvlCTaQ',
  pedido: 'fldbaPMlvmaIcAwHX',
  email: 'fldR8YFPuYJT0C4bA',
  telefono: 'fldUYat8d8k5KVESU',
  evaluadoras: 'fldsBC99zh44BSgBN',
  estado: 'fld8LoQEBcWSqzJhY',
  mensaje: 'fldD6cjnhvZVSALt4',
  modalidad: 'fldsKnmbEoilCde7P',
  fechaIngreso: 'fldFeNoGlmSHpPLvb',
  fechaEntrevista: 'fldWRpCder4umuBs6',
  fechaEntrega: 'fldaS7nfUewSX3EkQ',
  bender: 'fldLO8rQzmuV9WAqT',
  grafico: 'fldypANqCcNk2daAn',
  linkRaven: 'fldDMApS3ScuGHiJf',
  recomendacion: 'fldIWX9RcrBUCpTE6',
  informe: 'fldE7x9euo0ElSLqI',
  servicio: 'fldQyug26Nwo9CYmU',
} as const;

const F_EVALUADORA_NOMBRE = 'fldqhNqXayYQcyKJA';
const F_EMPRESA_NOMBRE = 'fldxtqa4czxTXkLav';
const F_BATERIA_CODIGO = 'fldIW8Dx6nzpEqOSM';
const F_PEDIDO = {
  puesto: 'fldtTUFvYpONO0bVy',
  cliente: 'fldjIThg01jtXWch3',
  bateria: 'fldnaf4eGW4IWojjx',
};

function token(lectura = true): string {
  const t = lectura
    ? process.env.AIRTABLE_TOKEN
    : process.env.AIRTABLE_TOKEN_ESCRITURA;
  if (!t) throw new Error(lectura ? 'Falta AIRTABLE_TOKEN.' : 'Falta AIRTABLE_TOKEN_ESCRITURA.');
  return t;
}

export function puedeEscribir(): boolean {
  return Boolean(process.env.AIRTABLE_TOKEN_ESCRITURA);
}

/**
 * Un diccionario `id de registro -> texto` de una tabla chica.
 *
 * Existe porque varios campos de Individuo son lookups de vínculos, y un
 * lookup de vínculo devuelve identificadores y no nombres. Empresas, Pedidos y
 * Baterías tienen pocas filas y se cachean cinco minutos.
 */
async function diccionario(
  tabla: string,
  campo: string
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const params = new URLSearchParams({ returnFieldsByFieldId: 'true', pageSize: '100' });
  params.append('fields[]', campo);
  let offset: string | undefined;
  do {
    const p = new URLSearchParams(params);
    if (offset) p.set('offset', offset);
    const res = await fetch(`${API}/${BASE}/${tabla}?${p}`, {
      headers: { Authorization: `Bearer ${token()}` },
      next: { revalidate: 300, tags: [CACHE_PSICOTECNICOS] },
    });
    if (!res.ok) return mapa;
    const datos = await res.json();
    for (const r of datos.records ?? []) mapa.set(r.id, r.fields?.[campo] ?? '');
    offset = datos.offset;
  } while (offset);
  return mapa;
}

/** Cada pedido con su puesto, su empresa y su batería ya resueltos a texto. */
async function pedidos(): Promise<
  Map<string, { puesto: string; empresaId: string | null; bateriaId: string | null }>
> {
  const mapa = new Map<string, { puesto: string; empresaId: string | null; bateriaId: string | null }>();
  const params = new URLSearchParams({ returnFieldsByFieldId: 'true', pageSize: '100' });
  for (const id of Object.values(F_PEDIDO)) params.append('fields[]', id);
  let offset: string | undefined;
  do {
    const p = new URLSearchParams(params);
    if (offset) p.set('offset', offset);
    const res = await fetch(`${API}/${BASE}/${T_PEDIDOS}?${p}`, {
      headers: { Authorization: `Bearer ${token()}` },
      next: { revalidate: 300, tags: [CACHE_PSICOTECNICOS] },
    });
    if (!res.ok) return mapa;
    const datos = await res.json();
    for (const r of datos.records ?? []) {
      const f = r.fields ?? {};
      const ref = (v: unknown): string | null => {
        const x = Array.isArray(v) ? v[0] : null;
        if (!x) return null;
        return typeof x === 'string' ? x : (x as any).id ?? null;
      };
      mapa.set(r.id, {
        puesto: f[F_PEDIDO.puesto] ?? 'Sin puesto',
        empresaId: ref(f[F_PEDIDO.cliente]),
        bateriaId: ref(f[F_PEDIDO.bateria]),
      });
    }
    offset = datos.offset;
  } while (offset);
  return mapa;
}

/** Nombre de cada evaluadora, por ID de registro. */
async function nombresEvaluadoras(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (ids.length === 0) return mapa;
  const params = new URLSearchParams({
    returnFieldsByFieldId: 'true',
    pageSize: '100',
    filterByFormula: `OR(${ids.map((i) => `RECORD_ID()='${i}'`).join(',')})`,
  });
  params.append('fields[]', F_EVALUADORA_NOMBRE);
  const res = await fetch(`${API}/${BASE}/${T_EVALUADORAS}?${params}`, {
    headers: { Authorization: `Bearer ${token()}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) return mapa;
  const datos = await res.json();
  for (const r of datos.records ?? []) {
    mapa.set(r.id, r.fields?.[F_EVALUADORA_NOMBRE] ?? '');
  }
  return mapa;
}

/**
 * Todas las evaluaciones cargadas, con solo los campos de la lista blanca.
 *
 * Sin filtro de etapa: son pocas y el filtrado se hace en memoria, así una
 * sola lectura sirve al resumen y a las cuatro pantallas de etapa.
 */
export async function listar(): Promise<Evaluacion[]> {
  const params = new URLSearchParams({
    returnFieldsByFieldId: 'true',
    pageSize: '100',
  });
  for (const id of Object.values(F)) params.append('fields[]', id);

  const filas: any[] = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams(params);
    if (offset) p.set('offset', offset);
    // Cinco minutos, y se invalida en cuanto se guarda algo: sin esto, cada
    // vez que se pasa de una etapa a otra se vuelven a pedir las 63 filas.
    const res = await fetch(`${API}/${BASE}/${T_INDIVIDUO}?${p}`, {
      headers: { Authorization: `Bearer ${token()}` },
      next: { revalidate: 300, tags: [CACHE_PSICOTECNICOS] },
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    const datos = await res.json();
    filas.push(...(datos.records ?? []));
    offset = datos.offset;
  } while (offset);

  const idsEvaluadoras = new Set<string>();
  for (const r of filas) {
    for (const e of r.fields?.[F.evaluadoras] ?? []) {
      idsEvaluadoras.add(typeof e === 'string' ? e : e.id);
    }
  }
  const [nombres, mapaPedidos, mapaEmpresas, mapaBaterias] = await Promise.all([
    nombresEvaluadoras([...idsEvaluadoras]),
    pedidos(),
    diccionario(T_EMPRESAS, F_EMPRESA_NOMBRE),
    diccionario(T_BATERIAS, F_BATERIA_CODIGO),
  ]);

  const hoy = new Date();
  return filas.map((r) => {
    const f = r.fields ?? {};
    const evals = (f[F.evaluadoras] ?? []).map((e: any) =>
      nombres.get(typeof e === 'string' ? e : e.id) ?? ''
    );
    const pedidoId = (() => {
      const v = f[F.pedido];
      const x = Array.isArray(v) ? v[0] : null;
      if (!x) return null;
      return typeof x === 'string' ? x : (x as any).id ?? null;
    })();
    const pedido = pedidoId ? mapaPedidos.get(pedidoId) : undefined;
    const empresa =
      (pedido?.empresaId ? mapaEmpresas.get(pedido.empresaId) : null) || 'Sin empresa';
    const fechaEntrevista = f[F.fechaEntrevista] ?? null;
    return {
      id: r.id,
      origen: 'airtable' as const,
      nombre: f[F.nombre] ?? 'Sin nombre',
      empresa,
      puesto: pedido?.puesto ?? 'Sin puesto',
      // El pedido de una fila de Airtable no se elige desde el OS: esa fila se
      // sigue trabajando allá hasta que se mude. El CV, por lo mismo, se mira
      // del lado de Airtable.
      pedidoId: null,
      tieneCv: false,
      bateria: (pedido?.bateriaId ? mapaBaterias.get(pedido.bateriaId) : null) || null,
      // El Benziger se pide en Supabase: lo que quedó en Airtable es anterior.
      conBenziger: false,
      email: f[F.email] ?? null,
      telefono: f[F.telefono] ?? null,
      evaluadora: evals.filter(Boolean).join(', ') || null,
      etapa: f[F.estado] ?? 'Sin asignar',
      mensaje: f[F.mensaje] ?? null,
      modalidad: f[F.modalidad] ?? null,
      fechaIngreso: f[F.fechaIngreso] ?? null,
      fechaEntrevista,
      fechaEntrega: f[F.fechaEntrega] ?? null,
      benderAdministrado: Boolean(f[F.bender]),
      graficoAdministrado: Boolean(f[F.grafico]),
      linkRaven: f[F.linkRaven] || null,
      recomendacion: f[F.recomendacion] ?? null,
      tieneInforme: Array.isArray(f[F.informe]) && f[F.informe].length > 0,
      // El seguimiento se lleva del lado de Supabase: lo de Airtable no lo trae.
      ingreso: null,
      seguimientoAl: null,
      seguimientoResultado: null,
      // Del lado viejo no se leen: la facturación vive entera en Supabase y
      // estas filas ya no se muestran en el OS.
      facturado: false,
      pagado: false,
      servicio: f[F.servicio] ?? null,
      dias: diasDesde(fechaEntrevista, hoy),
      diasHabiles: habilesDesde(fechaEntrevista, hoy),
      diasEsperando: fechaEntrevista ? null : diasDesde(f[F.fechaIngreso] ?? null, hoy),
      diasSolicitud: diasDesde(f[F.fechaIngreso] ?? null, hoy),
      // El tablero de la home es de Supabase: acá no hay dónde guardarlo, y
      // estas filas ni siquiera se muestran (ver `lib/psicotecnicos.ts`).
      tablero: null,
      prioridad: null,
      prueba: esEmpresaDePrueba(empresa),
    };
  });
}

/** Las evaluadoras cargadas, para el filtro de "lo mío". */
export async function evaluadoras(): Promise<string[]> {
  const params = new URLSearchParams({ returnFieldsByFieldId: 'true', pageSize: '100' });
  params.append('fields[]', F_EVALUADORA_NOMBRE);
  const res = await fetch(`${API}/${BASE}/${T_EVALUADORAS}?${params}`, {
    headers: { Authorization: `Bearer ${token()}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const datos = await res.json();
  return (datos.records ?? [])
    .map((r: any) => r.fields?.[F_EVALUADORA_NOMBRE])
    .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0)
    .sort((a: string, b: string) => a.localeCompare(b));
}

// ------------------------------------------------------------------ escritura

/**
 * Lo único que esta pantalla puede escribir.
 *
 * Es una lista blanca y no una validación: un campo que no está acá no se
 * puede tocar desde el OS aunque alguien arme el pedido a mano. Lo clínico no
 * está en la lista, así que no se puede editar desde acá.
 */
const CAMPOS_EDITABLES = {
  etapa: { id: F.estado, opciones: ETAPAS as readonly string[] },
  mensaje: { id: F.mensaje, opciones: ['Sin contactar', 'Esperando respuesta'] },
  modalidad: { id: F.modalidad, opciones: ['Presencial', 'Online'] },
  fechaEntrevista: { id: F.fechaEntrevista, opciones: null },
  benderAdministrado: { id: F.bender, opciones: null },
  graficoAdministrado: { id: F.grafico, opciones: null },
  // La evaluadora es un vínculo y no un texto: se guarda el identificador de
  // su fila, que se resuelve desde el nombre en `guardarCampos`.
  evaluadora: { id: F.evaluadoras, opciones: null },
  recomendacion: {
    id: F.recomendacion,
    opciones: [
      'Apto',
      'Apto con observaciones',
      'Apto con alertas',
      'No apto',
      'Encaja con el puesto',
      'Encaja, con desarrollo',
      'Encaja si cambia el puesto',
      'Sin puesto contra el cual medir',
    ],
  },
} as const;

export type CampoEditable = keyof typeof CAMPOS_EDITABLES;

export function esCampoEditable(x: string): x is CampoEditable {
  return Object.prototype.hasOwnProperty.call(CAMPOS_EDITABLES, x);
}

const REGISTRO = /^rec[A-Za-z0-9]{14}$/;

/**
 * Guarda un cambio de una evaluación.
 *
 * Devuelve el motivo del rechazo en vez de tirar, porque quien llama es una
 * ruta de API que tiene que contestar algo legible.
 */
export async function guardarCampos(
  id: string,
  cambios: Partial<Record<CampoEditable, string | boolean | null>>
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!REGISTRO.test(id)) return { ok: false, motivo: 'Identificador inválido.' };
  if (!puedeEscribir()) return { ok: false, motivo: 'Falta el token de escritura.' };

  const campos: Record<string, unknown> = {};

  for (const [campo, valor] of Object.entries(cambios) as [
    CampoEditable,
    string | boolean | null,
  ][]) {
    const def: { id: string; opciones: readonly string[] | null } = CAMPOS_EDITABLES[campo];
    if (!def) return { ok: false, motivo: 'Campo no editable.' };

    if (
      typeof valor === 'string' &&
      valor !== '' &&
      def.opciones &&
      !def.opciones.includes(valor)
    ) {
      return { ok: false, motivo: 'Ese valor no es una opción del campo.' };
    }

    if (campo === 'evaluadora') {
      // Un campo de vínculo espera una lista de identificadores de fila.
      if (!valor) {
        campos[def.id] = [];
      } else {
        const registro = await idDeEvaluadora(String(valor));
        if (!registro) return { ok: false, motivo: 'Esa evaluadora no está cargada.' };
        campos[def.id] = [registro];
      }
      continue;
    }

    campos[def.id] = valor === '' ? null : valor;
  }

  if (Object.keys(campos).length === 0) return { ok: true };

  const res = await fetch(`${API}/${BASE}/${T_INDIVIDUO}/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token(false)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: campos, typecast: true }),
  });

  if (!res.ok) {
    return { ok: false, motivo: `Airtable respondió ${res.status}.` };
  }
  return { ok: true };
}

/** El identificador de la fila de una evaluadora, por su nombre. */
async function idDeEvaluadora(nombre: string): Promise<string | null> {
  const params = new URLSearchParams({ returnFieldsByFieldId: 'true', pageSize: '100' });
  params.append('fields[]', F_EVALUADORA_NOMBRE);
  const res = await fetch(`${API}/${BASE}/${T_EVALUADORAS}?${params}`, {
    headers: { Authorization: `Bearer ${token()}` },
    next: { revalidate: 300, tags: [CACHE_PSICOTECNICOS] },
  });
  if (!res.ok) return null;
  const datos = await res.json();
  const fila = (datos.records ?? []).find(
    (r: any) => (r.fields?.[F_EVALUADORA_NOMBRE] ?? '').trim() === nombre.trim()
  );
  return fila?.id ?? null;
}
