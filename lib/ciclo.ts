/**
 * Ciclo de encuentros — la capa de acceso.
 *
 * Mismo criterio que el resto: todo server-side con la service key, sin SDK.
 * Este módulo no puede importarse desde un componente de cliente.
 *
 * Hay dos cosas separadas y conviene no confundirlas:
 *
 *   el ciclo    el material. Liderazgos Humanos y sus actividades, escritas
 *               una sola vez y las mismas para todos los clientes.
 *
 *   la corrida  el ciclo dictado a un cliente. Guarda su clave de control,
 *               qué actividad tiene abierta y quiénes asistieron.
 *
 * Casi todo arranca en `getCorridaPorSlug`: la dirección del encuentro nombra a
 * la empresa, y de ahí sale la corrida activa con su ciclo.
 *
 * Las formas de responder están fijadas en `TIPOS`. Una actividad nueva es una
 * fila en `actividades`, no código nuevo: por eso la validación y el resumen se
 * resuelven acá adentro con un switch sobre el tipo y no en cada pantalla.
 */

import 'server-only';

import { DIAS } from '@/lib/opciones';
import {
  getEmpresaPorSlug,
  insert,
  patch,
  perfilesDeCorrida,
  select,
  upsert,
  upsertVarias,
} from '@/lib/supabase';
import type { Empresa } from '@/lib/supabase';
import { armarGrupos, type Candidato, type Grupo } from '@/lib/cruce';
import { PERFILES, type Perfil } from '@/lib/perfiles';

// -------------------------------------------------------------------- tipos

export const TIPOS = [
  'palabra',
  'opcion',
  'escala',
  'texto',
  'marcas',
  /** No se responde acá: lleva a una herramienta que ya existe aparte. La
   *  dirección va en `opciones[0]`. */
  'enlace',
  /** El cuestionario de perfil de la charla 3, dentro de la misma pantalla:
   *  la persona ya está identificada por el ciclo y no vuelve a cargar nada.
   *  Sus respuestas van a su propia tabla, no a `aportes`. */
  'cuestionario',
  /** El compromiso de la charla 1: día, hora y antes de qué. Con eso el
   *  teléfono arma un evento que el calendario agenda con la alarma puesta, y
   *  el informe puede contar cuándo eligió cada uno en vez de leer textos. */
  'plan',
  /** No se responde: el teléfono recibe con quién juntarse. El reparto lo hace
   *  el servidor al abrirla, cruzando los cuadrantes del cuestionario. */
  'cruce',
] as const;
export type TipoActividad = (typeof TIPOS)[number];

export type Ciclo = {
  id: string;
  nombre: string;
  activo: boolean;
};

/** Un ciclo dictado a un cliente. Es lo que se da de alta por cada encuentro. */
export type Corrida = {
  id: string;
  empresa_id: string;
  ciclo_id: string;
  clave_control: string;
  /** Qué se está respondiendo ahora, o null si los teléfonos están guardados. */
  actividad_abierta_id: string | null;
  activa: boolean;
};

export type Actividad = {
  id: string;
  ciclo_id: string;
  /** Identificador legible dentro de la empresa, por ejemplo 'c1-multitarea'. */
  clave: string;
  charla: number;
  orden: number;
  tipo: TipoActividad;
  titulo: string;
  enunciado: string | null;
  /** Alternativas de 'opcion' y 'marcas', en orden. */
  opciones: string[];
  /**
   * Actividades que se abren juntas y se responden en fila desde el teléfono.
   * La expositora abre una vez y cada uno recorre las suyas a su ritmo, sin
   * que ella tenga que ir habilitando de a una mientras dicta.
   */
  grupo: string | null;
  /**
   * En qué placa del deck la expositora abre esta actividad. El mismo número
   * que el deck le recuerda al pie, para que el panel y lo proyectado digan lo
   * mismo mientras ella está dictando.
   */
  placa: number | null;
  /**
   * Cómo la nombra el panel de la expositora. El título es el que lee el
   * asistente en su teléfono, y cuando varias se abren juntas ese título es el
   * de la primera: no alcanza para reconocer el momento de la charla.
   */
  titulo_control: string | null;
  abierta: boolean;
  created_at: string;
};

export type Asistente = {
  id: string;
  corrida_id: string;
  nombre: string;
  apellido: string;
  foto_path: string | null;
  created_at: string;
  /** Cuándo entró desde algún teléfono. Null si todavía no entró nadie por él. */
  entro_en: string | null;
};

export type Aporte = {
  id: string;
  corrida_id: string;
  actividad_id: string;
  asistente_id: string;
  valor: Valor;
  created_at: string;
};

/** Lo que responde la persona, etiquetado por tipo para leerlo sin adivinar. */
export type Valor =
  | { tipo: 'palabra'; palabra: string }
  | { tipo: 'opcion'; opcion: number }
  | { tipo: 'escala'; escala: number }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'marcas'; marcas: number[] }
  /** Días de la semana (1 lunes a 5 viernes), hora en 24 horas y antes de qué.
   *  Varios días porque la pausa se sostiene mejor repetida que una sola vez. */
  | { tipo: 'plan'; dias: number[]; hora: string; texto: string }
  /** Con quién le toca juntarse. Esto no lo responde la persona: lo escribe el
   *  servidor al abrir la actividad. Va en `aportes` igual que una respuesta
   *  porque necesita lo mismo: una fila por persona, que no cambie después. */
  | { tipo: 'cruce'; conIds: string[] };

/** La dirección de una actividad de tipo 'enlace'. Sólo se acepta https. */
export function destinoDe(actividad: Actividad): string | null {
  const url = actividad.opciones?.[0];
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

const CAMPOS_ACTIVIDAD =
  'id,ciclo_id,clave,charla,orden,tipo,titulo,enunciado,opciones,grupo,' +
  'placa,titulo_control,created_at';
const CAMPOS_ASISTENTE =
  'id,corrida_id,nombre,apellido,foto_path,created_at,entro_en';
const CAMPOS_APORTE = 'id,corrida_id,actividad_id,asistente_id,valor,created_at';
const CAMPOS_CORRIDA =
  'id,empresa_id,ciclo_id,clave_control,actividad_abierta_id,activa';

/**
 * Todo id que viaja a PostgREST se valida antes de entrar en la query.
 * Sin esto, un id armado a mano puede cambiar el filtro entero.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAVE = /^[a-z0-9-]{2,60}$/;

// ----------------------------------------------------------------- corridas

/**
 * De la dirección del encuentro al encuentro.
 *
 * Todas las pantallas del ciclo entran por acá: la dirección nombra a la
 * empresa y hace falta su corrida activa para saber de qué ciclo se trata y
 * qué está abierto. Devuelve null si la empresa no existe o si no tiene una
 * corrida en curso, que para el visitante es lo mismo.
 */
export async function resolverCiclo(
  slug: string
): Promise<{ empresa: Empresa; corrida: Corrida } | null> {
  const empresa = await getEmpresaPorSlug(slug);
  if (!empresa) return null;
  const corrida = await getCorridaActiva(empresa.id);
  if (!corrida) return null;
  return { empresa, corrida };
}


/**
 * La corrida activa de una empresa, con su ciclo.
 *
 * Es el punto de entrada de casi todo: la dirección del encuentro nombra a la
 * empresa (camposhr.com/ciclo/pla-sa) y de ahí sale para qué ciclo es y qué
 * está abierto. Si el año que viene el mismo cliente repite, la corrida vieja
 * se marca inactiva y la dirección pasa a resolver a la nueva.
 */
export async function getCorridaActiva(empresaId: string): Promise<Corrida | null> {
  if (!UUID.test(empresaId)) return null;
  const filas = await select<Corrida>(
    'corridas',
    `select=${CAMPOS_CORRIDA}&empresa_id=eq.${empresaId}&activa=is.true&limit=1`
  );
  return filas[0] ?? null;
}

export async function listarCorridas(): Promise<
  (Corrida & { empresas: { nombre: string; slug: string }; ciclos: { nombre: string } })[]
> {
  return select(
    'corridas',
    `select=${CAMPOS_CORRIDA},empresas(nombre,slug),ciclos(nombre)` +
      `&activa=is.true&order=created_at.desc`
  );
}

export async function listarCiclos(): Promise<Ciclo[]> {
  return select<Ciclo>('ciclos', 'select=id,nombre,activo&activo=is.true&order=nombre.asc');
}

/**
 * La dirección del encuentro sale del nombre del cliente.
 *
 * "John Deere S.A." queda en john-deere-s-a. Se calcula acá y no lo escribe la
 * persona: es lo que va en el código QR de la primera placa, y una errata ahí
 * se descubre con treinta personas escaneando.
 */
export function slugDe(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Da de alta un encuentro: el cliente si no estaba, y su corrida del ciclo.
 *
 * La clave del control se genera acá. Que la elija una persona termina en
 * claves cortas y repetidas, y esta es la única barrera entre el control y los
 * asistentes, que conocen la dirección porque la escanearon.
 */
export async function crearEncuentro(
  nombreEmpresa: string,
  cicloId: string,
  clave: string
): Promise<{ slug: string; clave: string }> {
  const nombre = nombreEmpresa.trim().slice(0, 80);
  const slug = slugDe(nombre);
  if (nombre.length < 2 || !slug) throw new Error('El nombre no sirve como dirección');
  if (!UUID.test(cicloId)) throw new Error('Ciclo inválido');

  let empresa = await getEmpresaPorSlug(slug);
  if (!empresa) {
    empresa = await insert<Empresa>('empresas', { nombre, slug });
  }

  const enCurso = await getCorridaActiva(empresa.id);
  if (enCurso) throw new Error('Ese cliente ya tiene un encuentro en curso');

  await insert<Corrida>('corridas', {
    empresa_id: empresa.id,
    ciclo_id: cicloId,
    clave_control: clave,
  });

  return { slug, clave };
}

/** Las actividades de un grupo, en el orden en que se responden. */
export async function listarGrupo(
  cicloId: string,
  grupo: string
): Promise<Actividad[]> {
  if (!UUID.test(cicloId) || !CLAVE.test(grupo)) return [];
  return select<Actividad>(
    'actividades',
    `select=${CAMPOS_ACTIVIDAD}&ciclo_id=eq.${cicloId}&grupo=eq.${grupo}` +
      `&order=orden.asc`
  );
}

export async function getCiclo(cicloId: string): Promise<Ciclo | null> {
  if (!UUID.test(cicloId)) return null;
  const filas = await select<Ciclo>(
    'ciclos',
    `select=id,nombre,activo&id=eq.${cicloId}&limit=1`
  );
  return filas[0] ?? null;
}

// --------------------------------------------------------------- actividades

/** Las actividades del ciclo. Las mismas para todos los clientes. */
export async function listarActividades(cicloId: string): Promise<Actividad[]> {
  if (!UUID.test(cicloId)) return [];
  return select<Actividad>(
    'actividades',
    `select=${CAMPOS_ACTIVIDAD}&ciclo_id=eq.${cicloId}&order=charla.asc,orden.asc`
  );
}

/**
 * Lo que esta corrida tiene abierto en este momento, o null.
 *
 * El teléfono de cada persona muestra esto y nada más. Sale de la corrida y no
 * de la actividad: la actividad es compartida, y un booleano ahí abriría la
 * consigna en la sala de otro cliente.
 */
export async function getActividadAbierta(
  corrida: Corrida
): Promise<Actividad | null> {
  if (!corrida.actividad_abierta_id) return null;
  return getActividad(corrida.ciclo_id, corrida.actividad_abierta_id);
}

export async function getActividad(
  cicloId: string,
  actividadId: string
): Promise<Actividad | null> {
  if (!UUID.test(cicloId) || !UUID.test(actividadId)) return null;
  const filas = await select<Actividad>(
    'actividades',
    `select=${CAMPOS_ACTIVIDAD}&ciclo_id=eq.${cicloId}&id=eq.${actividadId}&limit=1`
  );
  return filas[0] ?? null;
}

export async function getActividadPorClave(
  cicloId: string,
  clave: string
): Promise<Actividad | null> {
  if (!UUID.test(cicloId) || !CLAVE.test(clave)) return null;
  const filas = await select<Actividad>(
    'actividades',
    `select=${CAMPOS_ACTIVIDAD}&ciclo_id=eq.${cicloId}&clave=eq.${clave}&limit=1`
  );
  return filas[0] ?? null;
}

/**
 * Abre una actividad en esta corrida.
 *
 * Una sola escritura: el estado vive en la corrida, así que abrir una cierra la
 * anterior por definición y no hay un instante intermedio donde el teléfono vea
 * lo que no es.
 */
export async function abrirActividad(
  corridaId: string,
  actividadId: string
): Promise<void> {
  if (!UUID.test(corridaId) || !UUID.test(actividadId)) {
    throw new Error('Actividad inválida');
  }
  await patch('corridas', `id=eq.${corridaId}`, {
    actividad_abierta_id: actividadId,
  });
}

export async function cerrarActividades(corridaId: string): Promise<void> {
  if (!UUID.test(corridaId)) throw new Error('Corrida inválida');
  await patch('corridas', `id=eq.${corridaId}`, { actividad_abierta_id: null });
}

// ---------------------------------------------------------------- asistentes

/**
 * Los asistentes de la corrida, por apellido.
 *
 * Es la lista que arma la grilla de caras del segundo día: la persona que abre
 * desde otro teléfono se busca a sí misma en vez de escribir un código.
 */
export async function listarAsistentes(corridaId: string): Promise<Asistente[]> {
  if (!UUID.test(corridaId)) return [];
  return select<Asistente>(
    'asistentes',
    `select=${CAMPOS_ASISTENTE}&corrida_id=eq.${corridaId}` +
      `&order=apellido.asc,nombre.asc`
  );
}

export async function getAsistente(
  corridaId: string,
  asistenteId: string
): Promise<Asistente | null> {
  if (!UUID.test(corridaId) || !UUID.test(asistenteId)) return null;
  const filas = await select<Asistente>(
    'asistentes',
    `select=${CAMPOS_ASISTENTE}&corrida_id=eq.${corridaId}&id=eq.${asistenteId}&limit=1`
  );
  return filas[0] ?? null;
}

/**
 * Deja anotado que este asistente ya entró desde un teléfono.
 *
 * Sirve para sacar su cara de la grilla: con treinta personas entrando a la
 * vez, las caras de los que ya entraron son ruido para el que todavía busca la
 * suya. Se escribe una sola vez, y el filtro lo garantiza aunque dos teléfonos
 * lo intenten juntos.
 */
export async function marcarIngreso(asistenteId: string): Promise<void> {
  if (!UUID.test(asistenteId)) return;
  await patch('asistentes', `id=eq.${asistenteId}&entro_en=is.null`, {
    entro_en: new Date().toISOString(),
  });
}

export async function crearAsistente(fila: {
  corrida_id: string;
  nombre: string;
  apellido: string;
  foto_path: string | null;
}): Promise<Asistente> {
  return insert<Asistente>('asistentes', fila);
}

// ------------------------------------------------------------------- aportes

/** Lo respondido en esta corrida. Filtra por corrida: la actividad es compartida. */
export async function listarAportes(
  corridaId: string,
  actividadId: string
): Promise<Aporte[]> {
  if (!UUID.test(corridaId) || !UUID.test(actividadId)) return [];
  return select<Aporte>(
    'aportes',
    `select=${CAMPOS_APORTE}&corrida_id=eq.${corridaId}` +
      `&actividad_id=eq.${actividadId}&order=created_at.asc`
  );
}

export async function getAporteDe(
  actividadId: string,
  asistenteId: string
): Promise<Aporte | null> {
  if (!UUID.test(actividadId) || !UUID.test(asistenteId)) return null;
  const filas = await select<Aporte>(
    'aportes',
    `select=${CAMPOS_APORTE}&actividad_id=eq.${actividadId}` +
      `&asistente_id=eq.${asistenteId}&limit=1`
  );
  return filas[0] ?? null;
}

/**
 * Lo que esta persona respondió en varias actividades, de una sola consulta.
 *
 * El sondeo lo hace cada teléfono cada pocos segundos. Preguntando de a una,
 * las cinco de la encuesta son cinco consultas por teléfono y por sondeo: con
 * treinta teléfonos en la sala eso es lo que tumbó la base el 7 de agosto de
 * 2026 y dejó a la gente trabada en la primera pregunta.
 */
export async function aportesDeEn(
  actividadIds: string[],
  asistenteId: string
): Promise<Map<string, Aporte>> {
  const ids = actividadIds.filter((id) => UUID.test(id));
  if (ids.length === 0 || !UUID.test(asistenteId)) return new Map();
  const filas = await select<Aporte>(
    'aportes',
    `select=${CAMPOS_APORTE}&actividad_id=in.(${ids.join(',')})` +
      `&asistente_id=eq.${asistenteId}`
  );
  return new Map(filas.map((f) => [f.actividad_id, f]));
}

/** Guarda la respuesta. Si la persona ya había respondido, la corrige. */
export async function guardarAporte(
  corridaId: string,
  actividadId: string,
  asistenteId: string,
  valor: Valor
): Promise<Aporte> {
  if (!UUID.test(corridaId) || !UUID.test(actividadId) || !UUID.test(asistenteId)) {
    throw new Error('Aporte inválido');
  }
  return upsert<Aporte>(
    'aportes',
    {
      corrida_id: corridaId,
      actividad_id: actividadId,
      asistente_id: asistenteId,
      valor,
    },
    'actividad_id,asistente_id'
  );
}

// -------------------------------------------------------------------- cruce

/**
 * Reparte quién consulta a quién, y lo deja escrito.
 *
 * Se guarda en `aportes` en vez de calcularse cada vez que el teléfono
 * pregunta, y la razón es la sala: el sondeo llega cada cuatro segundos, y un
 * reparto calculado al vuelo le cambiaría el nombre a la persona en cuanto
 * entre alguien más, con medio grupo ya conversando.
 *
 * Es incremental. Se reparte sólo a quien todavía no tiene pareja, así que
 * cerrar la actividad y volver a abrirla no rehace lo que ya está andando, y
 * el que llega tarde entra sin desarmarle el grupo a nadie.
 */
export async function repartirCruce(
  corrida: Corrida,
  actividad: Actividad
): Promise<void> {
  if (actividad.tipo !== 'cruce') return;

  const [asistentes, previos, perfiles] = await Promise.all([
    listarAsistentes(corrida.id),
    listarAportes(corrida.id, actividad.id),
    perfilesDeCorrida(corrida.id),
  ]);

  const vigentes = new Set(asistentes.map((a) => a.id));
  const yaTienen = new Set(previos.map((p) => p.asistente_id));
  const nuevos: Candidato[] = asistentes
    .filter((a) => !yaTienen.has(a.id))
    .map((a) => ({ id: a.id, perfil: perfilValido(perfiles.get(a.id)) }));
  if (nuevos.length === 0) return;

  const grupos = armarGrupos(nuevos);
  const aEscribir: Grupo[] = [...grupos];

  // Uno solo sin pareja: o es el primero del encuentro, o llegó tarde. Si ya
  // hay grupos armados se suma al más chico, y los que estaban en él pasan a
  // verlo. Si no hay ninguno, no hay nada que repartir todavía.
  const repartidos = new Set(grupos.flat());
  const solo = nuevos.find((n) => !repartidos.has(n.id));
  if (solo) {
    const destino = [...gruposDe(previos, vigentes), ...grupos].sort(
      (a, b) => a.length - b.length || a[0].localeCompare(b[0])
    )[0];
    if (!destino) return;
    destino.push(solo.id);
    if (!aEscribir.includes(destino)) aEscribir.push(destino);
  }

  await upsertVarias(
    'aportes',
    aEscribir.flatMap((g) =>
      g.map((id) => ({
        corrida_id: corrida.id,
        actividad_id: actividad.id,
        asistente_id: id,
        valor: { tipo: 'cruce', conIds: g.filter((otro) => otro !== id) },
      }))
    ),
    'actividad_id,asistente_id'
  );
}

/**
 * Los grupos ya repartidos, reconstruidos desde lo que guardó cada persona.
 *
 * Se descarta a quien ya no está en la corrida. Alguien puede haberse borrado
 * después del reparto, y su id sigue nombrado en el grupo de los demás:
 * escribirlo de nuevo lo rechaza la base y el teléfono del que llega tarde se
 * queda sin pantalla.
 */
function gruposDe(aportes: Aporte[], vigentes: Set<string>): Grupo[] {
  const vistos = new Map<string, Grupo>();
  for (const a of aportes) {
    if (a.valor?.tipo !== 'cruce') continue;
    const integrantes = [a.asistente_id, ...a.valor.conIds].filter((id) =>
      vigentes.has(id)
    );
    if (integrantes.length === 0) continue;
    const clave = [...integrantes].sort().join('|');
    if (!vistos.has(clave)) vistos.set(clave, integrantes);
  }
  return [...vistos.values()];
}

/** Lo guardado en `respuestas` es texto suelto: no entra sin validarse. */
function perfilValido(p: string | undefined): Perfil | null {
  return PERFILES.includes(p as Perfil) ? (p as Perfil) : null;
}

// ------------------------------------------------------------------ control

/**
 * La clave que protege la pantalla de control.
 *
 * Hace falta porque los asistentes conocen la dirección del ciclo: la
 * escanearon para entrar. Sin clave, cualquiera puede abrir la actividad de la
 * charla 5 mientras se está dando la 1.
 *
 * Es por corrida: si fuera una sola para todo el sistema, quien controla un
 * cliente podría abrir actividades en la sala de otro.
 */
export function claveControlOk(
  corrida: Corrida,
  recibida: string | null | undefined
): boolean {
  return Boolean(corrida.clave_control) && recibida === corrida.clave_control;
}

// ---------------------------------------------------------------- validación

const MAX_PALABRA = 24;
const MAX_TEXTO = 400;

/**
 * Convierte lo que mandó el navegador en un `Valor` válido para esta actividad.
 * Lanza si no lo es. Nunca se guarda nada que no haya pasado por acá.
 */
export function normalizarValor(actividad: Actividad, crudo: unknown): Valor {
  const dato = (crudo ?? {}) as Record<string, unknown>;

  switch (actividad.tipo) {
    case 'palabra': {
      // Una palabra: si la persona escribe tres, se queda la primera. La nube
      // deja de tener sentido cuando cada punto es una frase distinta.
      const palabra = String(dato.palabra ?? '')
        .trim()
        .split(/\s+/)[0]
        .slice(0, MAX_PALABRA);
      if (palabra.length < 2) throw new Error('Escribí una palabra');
      return { tipo: 'palabra', palabra };
    }

    case 'opcion': {
      const opcion = Number(dato.opcion);
      if (!Number.isInteger(opcion) || opcion < 0 || opcion >= actividad.opciones.length) {
        throw new Error('Elegí una opción');
      }
      return { tipo: 'opcion', opcion };
    }

    case 'escala': {
      const escala = Number(dato.escala);
      if (!Number.isInteger(escala) || escala < 1 || escala > 10) {
        throw new Error('Elegí un número del 1 al 10');
      }
      return { tipo: 'escala', escala };
    }

    case 'texto': {
      const texto = String(dato.texto ?? '').trim().slice(0, MAX_TEXTO);
      if (texto.length < 3) throw new Error('Escribí tu respuesta');
      return { tipo: 'texto', texto };
    }

    case 'plan': {
      const crudos = Array.isArray(dato.dias) ? dato.dias : [];
      const dias = [
        ...new Set(
          crudos
            .map((d) => Number(d))
            .filter((d) => Number.isInteger(d) && d >= 1 && d <= 5)
        ),
      ].sort((a, b) => a - b);
      if (dias.length === 0) throw new Error('Elegí al menos un día');
      const hora = String(dato.hora ?? '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Error('Elegí una hora');
      const texto = String(dato.texto ?? '').trim().slice(0, 120);
      if (texto.length < 3) throw new Error('Escribí antes de qué');
      return { tipo: 'plan', dias, hora, texto };
    }

    case 'enlace':
    case 'cuestionario':
      throw new Error('Esta actividad se responde en su propia pantalla');

    case 'cruce':
      // Llega repartida desde el servidor. Si un teléfono manda algo acá, es
      // alguien tratando de elegirse la pareja.
      throw new Error('Esta actividad no se responde');

    case 'marcas': {
      const crudas = Array.isArray(dato.marcas) ? dato.marcas : [];
      const marcas = [
        ...new Set(
          crudas
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 0 && n < actividad.opciones.length)
        ),
      ].sort((a, b) => a - b);
      if (marcas.length === 0) throw new Error('Marcá al menos una');
      return { tipo: 'marcas', marcas };
    }
  }
}

// ------------------------------------------------------------------- resumen

export type Resumen =
  | { tipo: 'palabra'; total: number; nube: { texto: string; veces: number }[] }
  | { tipo: 'opcion'; total: number; conteo: { texto: string; veces: number }[] }
  | {
      tipo: 'escala';
      total: number;
      promedio: number;
      distribucion: { valor: number; veces: number }[];
    }
  | { tipo: 'texto'; total: number; textos: string[] }
  | { tipo: 'marcas'; total: number; conteo: { texto: string; veces: number }[] }
  | {
      tipo: 'plan';
      total: number;
      /** Cuántos eligieron cada día, de lunes a viernes. */
      porDia: { dia: string; veces: number }[];
      /** Las franjas horarias elegidas, de la más temprana a la más tarde. */
      horas: string[];
    }
  | { tipo: 'enlace'; total: number }
  | { tipo: 'cuestionario'; total: number }
  | { tipo: 'cruce'; total: number; grupos: number };

/** Para agrupar 'apurado' con 'Apurado' y con 'apurada' no, que es otra cosa. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Lo que se proyecta. Se calcula acá y no en la pantalla porque la proyección y
 * el informe tienen que contar lo mismo.
 */
export function resumir(actividad: Actividad, aportes: Aporte[]): Resumen {
  const total = aportes.length;

  switch (actividad.tipo) {
    case 'palabra': {
      // Se agrupa por la forma normalizada y se muestra la escritura más
      // frecuente: en la pantalla queda 'Apurado' y no 'apurado' si la mayoría
      // la escribió con mayúscula.
      const grupos = new Map<string, Map<string, number>>();
      for (const a of aportes) {
        if (a.valor?.tipo !== 'palabra') continue;
        const clave = normalizar(a.valor.palabra);
        if (!clave) continue;
        const formas = grupos.get(clave) ?? new Map<string, number>();
        formas.set(a.valor.palabra, (formas.get(a.valor.palabra) ?? 0) + 1);
        grupos.set(clave, formas);
      }
      const nube = [...grupos.values()]
        .map((formas) => {
          const orden = [...formas.entries()].sort((a, b) => b[1] - a[1]);
          const veces = orden.reduce((s, [, n]) => s + n, 0);
          return { texto: orden[0][0], veces };
        })
        .sort((a, b) => b.veces - a.veces || a.texto.localeCompare(b.texto));
      return { tipo: 'palabra', total, nube };
    }

    case 'opcion': {
      const veces = new Array(actividad.opciones.length).fill(0) as number[];
      for (const a of aportes) {
        if (a.valor?.tipo === 'opcion' && veces[a.valor.opcion] !== undefined) {
          veces[a.valor.opcion] += 1;
        }
      }
      return {
        tipo: 'opcion',
        total,
        conteo: actividad.opciones.map((texto, i) => ({ texto, veces: veces[i] })),
      };
    }

    case 'escala': {
      const valores = aportes
        .map((a) => (a.valor?.tipo === 'escala' ? a.valor.escala : null))
        .filter((n): n is number => n !== null);
      const suma = valores.reduce((s, n) => s + n, 0);
      const distribucion = Array.from({ length: 10 }, (_, i) => ({
        valor: i + 1,
        veces: valores.filter((n) => n === i + 1).length,
      }));
      return {
        tipo: 'escala',
        total,
        promedio: valores.length ? Math.round((suma / valores.length) * 10) / 10 : 0,
        distribucion,
      };
    }

    case 'texto': {
      // Anónimo a propósito: la expositora elige cuáles leer en voz alta, y
      // nadie queda expuesto por lo que escribió.
      const textos = aportes
        .map((a) => (a.valor?.tipo === 'texto' ? a.valor.texto : null))
        .filter((t): t is string => Boolean(t));
      return { tipo: 'texto', total, textos };
    }

    case 'plan': {
      const planes = aportes
        .map((a) => (a.valor?.tipo === 'plan' ? a.valor : null))
        .filter(
          (v): v is { tipo: 'plan'; dias: number[]; hora: string; texto: string } =>
            Boolean(v)
        );
      // Una persona puede sumar en varios días: el total de arriba cuenta
      // personas y estas barras cuentan elecciones.
      const porDia = DIAS.map((dia, i) => ({
        dia,
        veces: planes.filter((p) => p.dias.includes(i + 1)).length,
      }));
      const horas = planes.map((p) => p.hora).sort();
      return { tipo: 'plan', total, porDia, horas };
    }

    case 'enlace':
      // Lo que respondieron no está en `aportes`: está en la tabla de la
      // herramienta a la que lleva. La placa lo cuenta con su propia vista.
      return { tipo: 'enlace', total };

    case 'cuestionario':
      return { tipo: 'cuestionario', total };

    case 'cruce': {
      // Cuántos grupos distintos se armaron. Cada persona guarda a los otros de
      // su grupo, así que el grupo se identifica por sus integrantes ordenados.
      const vistos = new Set<string>();
      for (const a of aportes) {
        if (a.valor?.tipo !== 'cruce') continue;
        vistos.add([a.asistente_id, ...a.valor.conIds].sort().join('|'));
      }
      return { tipo: 'cruce', total, grupos: vistos.size };
    }

    case 'marcas': {
      const veces = new Array(actividad.opciones.length).fill(0) as number[];
      for (const a of aportes) {
        if (a.valor?.tipo !== 'marcas') continue;
        for (const m of a.valor.marcas) {
          if (veces[m] !== undefined) veces[m] += 1;
        }
      }
      return {
        tipo: 'marcas',
        total,
        conteo: actividad.opciones.map((texto, i) => ({ texto, veces: veces[i] })),
      };
    }
  }
}
