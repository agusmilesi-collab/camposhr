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
import { conSuplentes, repartoEnsayo, type Rol } from '@/lib/ensayo';
import { DEL_EJERCICIO, repartoFrases, type Lado } from '@/lib/frases';
import { recordar } from '@/lib/memoria';
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
  /** Una ronda del ensayo de la charla 4. El teléfono recibe su grupo, su rol,
   *  su caso y, sólo quien recibe la noticia, la reacción que le toca hacer.
   *  Las tres rondas son tres actividades sueltas, nunca del mismo grupo: si
   *  viajaran juntas, el teléfono tendría desde la primera las reacciones de
   *  las tres, y la sorpresa es lo que hace que el ensayo sirva. */
  'ensayo',
  /** El ejercicio de las frases de la charla 5. Tampoco se responde de a uno:
   *  el servidor arma los equipos de color y las dos mitades al abrirla, y de
   *  cada mitad escribe una sola persona por las tres. */
  'frases',
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
  /**
   * Quien dicta, registrada como una más para poder entrar al ensayo.
   *
   * No es parte del grupo que se mide: queda afuera de los contadores de
   * inscriptos, así que el panel llega a "34 de 34" con el taller entero y no
   * se queda esperando a dos personas que están dictando. Al ensayo entra sólo
   * cuando hace falta para completar el múltiplo de tres.
   */
  expositora: boolean;
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
  | { tipo: 'cruce'; conIds: string[] }
  /**
   * El puesto de una persona en una ronda del ensayo. Tampoco lo responde ella:
   * lo escribe el servidor al abrir la primera ronda, para las tres de una vez.
   *
   * `hablo` es lo único que se agrega después, y sólo lo escribe quien observa
   * al terminar la conversación de su trío. Va en la misma fila y no en otra
   * porque es la respuesta de esa persona a esa ronda, y así el sondeo la sigue
   * trayendo en la única consulta que ya hace.
   */
  | {
      tipo: 'ensayo';
      grupo: number;
      rol: Rol;
      caso: number;
      reaccion: number;
      /**
       * Los otros dos del trío con el rol de cada uno. El rol va guardado y no
       * deducido de la posición: la deducción funcionaba para dos de las tres
       * filas de la grilla y le daba vuelta los roles a la del medio, que es
       * justo la persona que recibe la noticia en la primera ronda. Además, en
       * un grupo de cuatro hay dos observadores y no habría forma de deducirlo.
       */
      con: { id: string; rol: Rol }[];
      /**
       * Qué hizo el que comunicó cuando el otro reaccionó. Lo anota quien
       * observa, y mide el paso 3.
       *
       * Antes preguntaba quién habló primero, y el guion de la reacción la
       * respondía sola: al que recibe se le pide que interrumpa en una ronda y
       * que no diga nada en otra, así que en dos de las tres el resultado
       * estaba decidido de antemano. Esto en cambio depende solo de lo que
       * hace quien da la noticia.
       */
      sostuvo?: 'escucho' | 'explico';
      /** Si el motivo fue un hecho verificable o un juicio sobre la persona.
       *  También lo anota quien observa: el que recibe no lo puede juzgar,
       *  porque desde su silla "sos un irresponsable" también es un motivo. */
      motivo?: 'hecho' | 'juicio' | 'ninguno';
      /** Si le dijeron por qué. Lo anota quien recibe. Mide el paso 2. */
      porque?: boolean;
      /** Si le dijeron cuándo vuelven a hablar. También quien recibe, paso 4. */
      cuando?: boolean;
    }
  /**
   * El puesto de una persona en el ejercicio de las frases. Como el del ensayo,
   * lo escribe el servidor al abrir la actividad.
   *
   * `respuestas` sólo lo completa quien escribe por su mitad, y va en la misma
   * fila y no en otra por la misma razón que en el ensayo: es lo que esa
   * persona respondió en esa actividad, y así el sondeo la sigue trayendo en la
   * consulta que ya hace.
   */
  | {
      tipo: 'frases';
      /** Índice del color del equipo. Es lo que se dice en voz alta. */
      color: number;
      lado: Lado;
      escribe: boolean;
      /** Los otros de su mitad, y la mitad de enfrente, con quién escribe. */
      con: { id: string; escribe: boolean }[];
      enfrente: { id: string; escribe: boolean }[];
      /** Una por fila del ejercicio, en el orden de `DEL_EJERCICIO`. */
      respuestas?: string[];
    };

/** La dirección de una actividad de tipo 'enlace'. Sólo se acepta https. */
export function destinoDe(actividad: Actividad): string | null {
  const url = actividad.opciones?.[0];
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

const CAMPOS_ACTIVIDAD =
  'id,ciclo_id,clave,charla,orden,tipo,titulo,enunciado,opciones,grupo,' +
  'placa,titulo_control,created_at';
const CAMPOS_ASISTENTE =
  'id,corrida_id,nombre,apellido,foto_path,created_at,entro_en,expositora';
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
  // La empresa se sirve de memoria: su nombre y su slug no cambian mientras se
  // dicta. La corrida se pregunta siempre, porque ahí vive qué está abierto y
  // ese dato viejo sería un teléfono mostrando la consigna equivocada.
  const empresa = await recordar(`empresa:${slug}`, 60, () =>
    getEmpresaPorSlug(slug)
  );
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
 * Las actividades del ciclo, servidas de memoria.
 *
 * Son las mismas veinte filas desde que el ciclo se dio de alta y no cambian
 * mientras se dicta: preguntarlas de nuevo en cada sondeo de cada teléfono es
 * la repetición que tumbó la base. Lo que sí cambia (cuál está abierta) sale
 * de la corrida, que se lee siempre.
 */
export async function actividadesDelCiclo(cicloId: string): Promise<Actividad[]> {
  if (!UUID.test(cicloId)) return [];
  return recordar(`actividades:${cicloId}`, 60, () => listarActividades(cicloId));
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

/**
 * Los del taller, sin quien dicta.
 *
 * Es lo que miden todos los contadores de "cuántos de cuántos": con las
 * expositoras adentro, el panel diría "32 de 34" mientras las dos que faltan
 * están dictando, y quien lee ese número no puede saber si espera a alguien o
 * si ya puede avanzar. Un contador tiene que poder llegar a su total.
 */
export function delTaller(asistentes: Asistente[]): Asistente[] {
  return asistentes.filter((a) => !a.expositora);
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

/**
 * Los aportes de varias actividades de una sola consulta.
 *
 * Para la placa de cierre del ensayo, que suma las tres rondas. Una consulta
 * por ronda dentro de un bucle es exactamente el error que tumbó la base el 7
 * de agosto, y esa placa se refresca sola mientras está proyectada.
 */
export async function listarAportesDeVarias(
  corridaId: string,
  actividadIds: string[]
): Promise<Aporte[]> {
  const validas = actividadIds.filter((id) => UUID.test(id));
  if (!UUID.test(corridaId) || validas.length === 0) return [];
  return select<Aporte>(
    'aportes',
    `select=${CAMPOS_APORTE}&corrida_id=eq.${corridaId}` +
      `&actividad_id=in.(${validas.join(',')})&order=created_at.asc`
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
 * La sala y sus cuadrantes, para la consigna de consultar una decisión.
 *
 * Esa pantalla necesita la lista entera: el nombre, la foto y el cuadrante de
 * la persona que a cada uno le tocó. Preguntándolo en cada sondeo de cada
 * teléfono son tres consultas por teléfono cada pocos segundos, que es la
 * forma exacta en que se saturó la base el 7 de agosto de 2026.
 *
 * Quince segundos de memoria: lo único que puede cambiar en ese rato es que
 * alguien termine su cuestionario, y su cuadrante aparece en la pantalla de
 * los demás un momento después.
 */
export async function salaDelCruce(
  corridaId: string
): Promise<{ asistentes: Asistente[]; perfiles: Map<string, string> }> {
  return recordar(`sala:${corridaId}`, 15, async () => {
    const [asistentes, perfiles] = await Promise.all([
      listarAsistentes(corridaId),
      perfilesDeCorrida(corridaId),
    ]);
    return { asistentes, perfiles };
  });
}

/**
 * Cuánta gente arrancó y cuánta terminó, para la pantalla de la expositora.
 *
 * Con varias consignas seguidas, contar la primera engaña: el 7 de agosto de
 * 2026 el panel decía 22 de 32 mientras las otras cuatro preguntas estaban en
 * 2, y la charla siguió creyendo que la encuesta estaba hecha.
 */
export async function contarAvance(
  corridaId: string,
  actividadIds: string[]
): Promise<{ empezaron: number; terminaron: number }> {
  const ids = actividadIds.filter((id) => UUID.test(id));
  if (!UUID.test(corridaId) || ids.length === 0) {
    return { empezaron: 0, terminaron: 0 };
  }
  const filas = await select<{ asistente_id: string; actividad_id: string }>(
    'aportes',
    `select=asistente_id,actividad_id&corrida_id=eq.${corridaId}` +
      `&actividad_id=in.(${ids.join(',')})`
  );
  const cuantas = new Map<string, Set<string>>();
  for (const f of filas) {
    const suyas = cuantas.get(f.asistente_id) ?? new Set<string>();
    suyas.add(f.actividad_id);
    cuantas.set(f.asistente_id, suyas);
  }
  let terminaron = 0;
  for (const suyas of cuantas.values()) if (suyas.size >= ids.length) terminaron++;
  return { empezaron: cuantas.size, terminaron };
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

// ------------------------------------------------------------------- ensayo

/**
 * Sólo quiénes están en la sala, de memoria.
 *
 * El ensayo no necesita los cuadrantes del cuestionario, que es la mitad cara
 * de `salaDelCruce`: esa lee además la tabla de respuestas. Con treinta y tres
 * teléfonos preguntando cada doce segundos, esa consulta de más se notó en la
 * prueba de carga, donde el sondeo del ensayo tardaba casi el doble que el de
 * una consigna común.
 *
 * Treinta segundos: lo único que puede cambiar en ese rato es que alguien se
 * registre tarde, y su propia pantalla no depende de esto.
 */
export async function asistentesDeLaSala(corridaId: string): Promise<Asistente[]> {
  return recordar(`asistentes:${corridaId}`, 30, () => listarAsistentes(corridaId));
}

/** Las tres rondas del ensayo, en orden. La primera es la que se reparte. */
export function rondasDelEnsayo(catalogo: Actividad[]): Actividad[] {
  return catalogo
    .filter((a) => a.tipo === 'ensayo')
    .sort((a, b) => a.orden - b.orden);
}

/**
 * Reparte las tres rondas del ensayo de una sola vez.
 *
 * Lo dispara el panel al abrir la primera ronda, y no el sondeo. Si lo hiciera
 * el sondeo, los treinta y tres teléfonos entrarían casi juntos y los primeros
 * leerían la sala entera antes de que la primera escritura llegue. El camino
 * desde el sondeo queda sólo para quien se registra tarde, que es de a uno.
 *
 * Se calcula una vez y no se recalcula: quien ya tiene su puesto lo conserva.
 * Once tríos enterándose a mitad del ejercicio de que ahora tienen otros
 * compañeros sería peor que cualquier error de la base.
 */
export async function repartirEnsayo(
  corrida: Corrida,
  rondas: Actividad[]
): Promise<void> {
  if (rondas.length !== 3 || rondas.some((r) => r.tipo !== 'ensayo')) return;

  const [asistentes, ...previos] = await Promise.all([
    listarAsistentes(corrida.id),
    ...rondas.map((r) => listarAportes(corrida.id, r.id)),
  ]);

  // El orden manda: define la grilla y, con ella, el reparto entero. Por fecha
  // de registro es estable, así que recalcular da siempre lo mismo.
  const porRegistro = [...asistentes].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  const yaTienen = new Set(previos[0].map((p) => p.asistente_id));
  const enOrden = conSuplentes(porRegistro, yaTienen);
  const vigentes = new Set(enOrden.map((a) => a.id));
  const nuevos = enOrden.filter((a) => !yaTienen.has(a.id));
  if (nuevos.length === 0) return;

  const filas: Record<string, unknown>[] = [];

  if (yaTienen.size === 0) {
    // Nadie tiene puesto todavía: se reparte la sala entera.
    if (enOrden.length < 9) return;
    const reparto = repartoEnsayo(enOrden.map((a) => a.id));
    reparto.forEach((grupos, ronda) => {
      for (const g of grupos) {
        for (const puesto of g.puestos) {
          filas.push({
            corrida_id: corrida.id,
            actividad_id: rondas[ronda].id,
            asistente_id: puesto.asistenteId,
            valor: {
              tipo: 'ensayo',
              grupo: g.grupo,
              rol: puesto.rol,
              caso: g.caso,
              reaccion: g.reaccion,
              con: g.puestos
                .filter((o) => o.asistenteId !== puesto.asistenteId)
                .map((o) => ({ id: o.asistenteId, rol: o.rol })),
            },
          });
        }
      }
    });
  } else {
    /*
     * Llegó alguien después del reparto. No se rearma nada: entra como segundo
     * observador del grupo más chico de cada ronda, y los que ya estaban en ese
     * grupo pasan a verlo. Es el mismo criterio que usa el cruce.
     */
    for (let ronda = 0; ronda < 3; ronda++) {
      const porGrupo = new Map<number, Aporte[]>();
      for (const a of previos[ronda]) {
        if (a.valor?.tipo !== 'ensayo' || !vigentes.has(a.asistente_id)) continue;
        const lista = porGrupo.get(a.valor.grupo) ?? [];
        lista.push(a);
        porGrupo.set(a.valor.grupo, lista);
      }
      for (const nuevo of nuevos) {
        const destino = [...porGrupo.entries()].sort(
          ([ga, a], [gb, b]) => a.length - b.length || ga - gb
        )[0];
        if (!destino) break;
        const [numero, integrantes] = destino;
        const primero = integrantes[0].valor as {
          caso: number;
          reaccion: number;
        };
        const puestos = [
          ...integrantes.map((a) => ({
            id: a.asistente_id,
            rol: (a.valor as { rol: Rol }).rol,
          })),
          { id: nuevo.id, rol: 'observa' as Rol },
        ];
        for (const a of integrantes) {
          filas.push({
            corrida_id: corrida.id,
            actividad_id: rondas[ronda].id,
            asistente_id: a.asistente_id,
            valor: {
              ...a.valor,
              con: puestos.filter((o) => o.id !== a.asistente_id),
            },
          });
        }
        filas.push({
          corrida_id: corrida.id,
          actividad_id: rondas[ronda].id,
          asistente_id: nuevo.id,
          valor: {
            tipo: 'ensayo',
            grupo: numero,
            rol: 'observa',
            caso: primero.caso,
            reaccion: primero.reaccion,
            con: puestos.filter((o) => o.id !== nuevo.id),
          },
        });
        // El que acaba de entrar cuenta para el próximo que llegue.
        porGrupo.set(numero, [
          ...integrantes,
          { asistente_id: nuevo.id } as Aporte,
        ]);
      }
    }
  }

  await upsertVarias('aportes', filas, 'actividad_id,asistente_id');
}

/**
 * Lo que anota cada uno al terminar la conversación de su trío.
 *
 * Son preguntas ácidas: cada una tiene una respuesta que puede ser la
 * equivocada y ninguna depende de una opinión. Quien observa mira la técnica y
 * la calidad del motivo; quien recibe contesta dos hechos que sólo él sabe.
 *
 * Se guarda dentro del puesto que ya tiene esa persona, así que hace falta
 * leerlo antes: además de dar el valor a completar, es lo que dice qué rol
 * tenía y por lo tanto qué puede contestar. Sin eso, el que comunica podría
 * anotar por su propio trío.
 *
 * Es idempotente: escribe los mismos campos con el mismo criterio, así que
 * tocar el botón dos veces deja lo mismo que tocarlo una.
 */
export type RespuestaEnsayo = {
  sostuvo?: 'escucho' | 'explico';
  motivo?: 'hecho' | 'juicio' | 'ninguno';
  porque?: boolean;
  cuando?: boolean;
};

const DE_QUIEN: Record<keyof RespuestaEnsayo, Rol> = {
  sostuvo: 'observa',
  motivo: 'observa',
  porque: 'recibe',
  cuando: 'recibe',
};

export async function anotarEnsayo(
  corridaId: string,
  actividadId: string,
  asistenteId: string,
  respuesta: RespuestaEnsayo
): Promise<Aporte> {
  const campos = Object.keys(respuesta) as (keyof RespuestaEnsayo)[];
  if (campos.length === 0) throw new Error('No hay nada para anotar');

  const puesto = await getAporteDe(actividadId, asistenteId);
  if (puesto?.valor?.tipo !== 'ensayo') {
    throw new Error('Todavía no tenés puesto en esta ronda');
  }
  for (const campo of campos) {
    if (DE_QUIEN[campo] !== puesto.valor.rol) {
      throw new Error(
        DE_QUIEN[campo] === 'observa'
          ? 'Esto lo contesta quien observa'
          : 'Esto lo contesta quien recibe la noticia'
      );
    }
  }

  return guardarAporte(corridaId, actividadId, asistenteId, {
    ...puesto.valor,
    ...respuesta,
  });
}

// ------------------------------------------------------------------- frases

/**
 * Arma los equipos del ejercicio de las frases y los deja escritos.
 *
 * Mismo criterio que el ensayo: lo dispara el panel al abrir la actividad y no
 * el sondeo, porque treinta y tres teléfonos entrando casi juntos leerían la
 * sala entera antes de que la primera escritura llegue. Y se calcula una sola
 * vez: quien ya tiene equipo lo conserva, porque seis equipos enterándose a
 * mitad del ejercicio de que ahora son otros sería peor que cualquier error.
 *
 * Quien llega tarde entra por el mismo camino, de a uno, desde su propio
 * sondeo: se suma al equipo más chico, del lado que tenga menos gente, y nunca
 * como quien escribe.
 */
export async function repartirFrases(
  corrida: Corrida,
  actividad: Actividad
): Promise<void> {
  if (actividad.tipo !== 'frases') return;

  const [asistentes, previos] = await Promise.all([
    listarAsistentes(corrida.id),
    listarAportes(corrida.id, actividad.id),
  ]);

  // Por fecha de registro, que es estable: recalcular da siempre lo mismo.
  const enOrden = [...asistentes].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  const yaTienen = new Set(previos.map((p) => p.asistente_id));
  const nuevos = enOrden.filter((a) => !yaTienen.has(a.id));
  if (nuevos.length === 0) return;

  const filas: Record<string, unknown>[] = [];

  if (yaTienen.size === 0) {
    if (enOrden.length < 4) return;
    for (const equipo of repartoFrases(enOrden.map((a) => a.id))) {
      for (const puesto of equipo.puestos) {
        filas.push({
          corrida_id: corrida.id,
          actividad_id: actividad.id,
          asistente_id: puesto.asistenteId,
          valor: {
            tipo: 'frases',
            color: equipo.color,
            lado: puesto.lado,
            escribe: puesto.escribe,
            con: equipo.puestos
              .filter((o) => o.lado === puesto.lado && o.asistenteId !== puesto.asistenteId)
              .map((o) => ({ id: o.asistenteId, escribe: o.escribe })),
            enfrente: equipo.puestos
              .filter((o) => o.lado !== puesto.lado)
              .map((o) => ({ id: o.asistenteId, escribe: o.escribe })),
          },
        });
      }
    }
  } else {
    /*
     * Llegó alguien después del reparto. Entra en el equipo más chico y del
     * lado que tenga menos gente, sin tocar a nadie más: los que ya están sólo
     * se enteran de que ahora son uno más.
     */
    const porColor = new Map<number, Aporte[]>();
    const vigentes = new Set(enOrden.map((a) => a.id));
    for (const a of previos) {
      if (a.valor?.tipo !== 'frases' || !vigentes.has(a.asistente_id)) continue;
      const lista = porColor.get(a.valor.color) ?? [];
      lista.push(a);
      porColor.set(a.valor.color, lista);
    }

    for (const nuevo of nuevos) {
      const destino = [...porColor.entries()].sort(
        ([ca, a], [cb, b]) => a.length - b.length || ca - cb
      )[0];
      if (!destino) break;
      const [color, integrantes] = destino;
      const cuantos = (lado: Lado) =>
        integrantes.filter((a) => (a.valor as { lado: Lado }).lado === lado).length;
      const lado: Lado = cuantos('objetivo') <= cuantos('subjetivo') ? 'objetivo' : 'subjetivo';

      const como = (a: Aporte) => ({
        id: a.asistente_id,
        escribe: (a.valor as { escribe: boolean }).escribe,
      });
      // Los que ya estaban suman al recién llegado en la lista que corresponda.
      for (const a of integrantes) {
        const suyo = a.valor as { lado: Lado; con: unknown[]; enfrente: unknown[] };
        const nueva = { id: nuevo.id, escribe: false };
        filas.push({
          corrida_id: corrida.id,
          actividad_id: actividad.id,
          asistente_id: a.asistente_id,
          valor:
            suyo.lado === lado
              ? { ...suyo, con: [...suyo.con, nueva] }
              : { ...suyo, enfrente: [...suyo.enfrente, nueva] },
        });
      }
      filas.push({
        corrida_id: corrida.id,
        actividad_id: actividad.id,
        asistente_id: nuevo.id,
        valor: {
          tipo: 'frases',
          color,
          lado,
          // Nunca escribe: su mitad ya arrancó y cambiar de mano a mitad del
          // ejercicio pierde lo que ya venía escrito.
          escribe: false,
          con: integrantes
            .filter((a) => (a.valor as { lado: Lado }).lado === lado)
            .map(como),
          enfrente: integrantes
            .filter((a) => (a.valor as { lado: Lado }).lado !== lado)
            .map(como),
        },
      });
      porColor.set(color, [...integrantes, { asistente_id: nuevo.id } as Aporte]);
    }
  }

  await upsertVarias('aportes', filas, 'actividad_id,asistente_id');
}

/**
 * Lo que escribió quien escribe por su mitad.
 *
 * Se guarda dentro del puesto que esa persona ya tiene, así que hace falta
 * leerlo antes: además de dar el valor a completar, es lo que dice si esta
 * persona era la que escribía. Sin eso, cualquiera del equipo podría contestar
 * por su mitad y la de enfrente leería algo que su compañero no dijo.
 *
 * Es idempotente: escribe el mismo campo con el mismo criterio, así que
 * guardar dos veces deja lo mismo que guardar una.
 */
export async function anotarFrases(
  corridaId: string,
  actividadId: string,
  asistenteId: string,
  respuestas: string[]
): Promise<Aporte> {
  const puesto = await getAporteDe(actividadId, asistenteId);
  if (puesto?.valor?.tipo !== 'frases') {
    throw new Error('Todavía no tenés equipo en este ejercicio');
  }
  if (!puesto.valor.escribe) {
    throw new Error('En tu mitad escribe otra persona');
  }
  const limpias = DEL_EJERCICIO.map((_, i) =>
    String(respuestas[i] ?? '').trim().slice(0, MAX_TEXTO)
  );
  if (limpias.every((t) => t.length === 0)) throw new Error('Escribí al menos una');

  return guardarAporte(corridaId, actividadId, asistenteId, {
    ...puesto.valor,
    respuestas: limpias,
  });
}

/**
 * Los puestos de este ejercicio, servidos de memoria.
 *
 * Cada teléfono necesita, además del suyo, lo que escribió quien escribe en su
 * mitad y en la de enfrente: sin eso no hay lectura cruzada, que es el momento
 * en que el ejercicio se entiende. Pedirlo en cada sondeo de cada teléfono es
 * una consulta más por teléfono cada doce segundos, que es exactamente la forma
 * en que se saturó la base el 7 de agosto de 2026.
 *
 * Ocho segundos: lo único que puede cambiar en ese rato es que una mitad
 * termine de escribir, y eso aparece en la pantalla de los demás un momento
 * después. La sala entera se sirve de una sola consulta compartida.
 */
export async function frasesDeLaSala(
  corridaId: string,
  actividadId: string
): Promise<Aporte[]> {
  return recordar(`frases:${corridaId}:${actividadId}`, 8, () =>
    listarAportes(corridaId, actividadId)
  );
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

    case 'ensayo':
      // El puesto lo escribe el servidor. Lo único que manda el teléfono es lo
      // que vio quien observa, y eso pasa por `anotarObservacion`, que necesita
      // el puesto ya guardado para saber si esa persona era la que observaba.
      throw new Error('Esta actividad no se responde');

    case 'frases':
      // Ídem: el equipo lo arma el servidor y lo que escribe una mitad pasa por
      // `anotarFrases`, que necesita el puesto para saber si esa persona era la
      // que escribía.
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
  | { tipo: 'cruce'; total: number; grupos: number }
  /**
   * Lo que mira la expositora durante el ensayo. `contestaron` sobre `observan`
   * es la señal de cuándo cerrar la ronda, y es un hecho y no una estimación:
   * los tríos no terminan todos juntos y el reloj no sabe cuáles siguen.
   *
   * El reparto de quién habló primero es el dato con el que arranca la puesta
   * en común. Si habló primero el que comunicó, ese trío no sostuvo el silencio.
   */
  | {
      tipo: 'ensayo';
      total: number;
      grupos: number;
      /** Tríos donde el observador y quien recibe contestaron todo lo suyo.
       *  Es lo que dice que la ronda terminó. */
      cerrados: number;
      observan: number;
      contestaron: number;
      sostuvo: { escucho: number; explico: number };
      motivo: { hecho: number; juicio: number; ninguno: number };
      reciben: number;
      contestaronReciben: number;
      dijoPorque: number;
      dijoCuando: number;
    }
  /**
   * Lo que mira la expositora durante el ejercicio de las frases. Las mitades
   * que ya escribieron sobre las que hay es la señal de cuándo pedir que se
   * lean, y no el reloj: los equipos no terminan todos juntos.
   */
  | {
      tipo: 'frases';
      total: number;
      equipos: number;
      mitades: number;
      escribieron: number;
      /** Equipos con las dos mitades listas, o sea los que ya pueden leerse. */
      completos: number;
    };

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

    case 'ensayo': {
      const grupos = new Set<number>();
      /*
       * Cuántos tríos ya terminaron: los dos que contestan, contestaron todo.
       *
       * Es el dato que dice que la ronda se puede cerrar. El reloj no alcanza,
       * porque los tríos no terminan juntos, y los otros dos números tampoco:
       * el observador y quien recibe pueden ir uno adelante del otro, así que
       * "10 de 12 observadores" no dice cuántas conversaciones se cerraron.
       */
      const porGrupo = new Map<number, { deben: number; listos: number }>();
      let observan = 0;
      let contestaron = 0;
      let reciben = 0;
      let contestaronReciben = 0;
      let dijoPorque = 0;
      let dijoCuando = 0;
      const sostuvo = { escucho: 0, explico: 0 };
      const motivo = { hecho: 0, juicio: 0, ninguno: 0 };
      for (const a of aportes) {
        if (a.valor?.tipo !== 'ensayo') continue;
        grupos.add(a.valor.grupo);
        const cuenta = porGrupo.get(a.valor.grupo) ?? { deben: 0, listos: 0 };
        if (a.valor.rol === 'observa') {
          observan += 1;
          // Las dos, no una: quien observa contesta qué hizo el que comunicó y
          // qué clase de motivo dio. Con una sola contestada esa conversación
          // sigue abierta.
          const listo = Boolean(a.valor.sostuvo && a.valor.motivo);
          if (listo) contestaron += 1;
          if (a.valor.sostuvo) sostuvo[a.valor.sostuvo] += 1;
          if (a.valor.motivo) motivo[a.valor.motivo] += 1;
          cuenta.deben += 1;
          if (listo) cuenta.listos += 1;
        }
        if (a.valor.rol === 'recibe') {
          reciben += 1;
          const listo =
            a.valor.porque !== undefined && a.valor.cuando !== undefined;
          if (listo) contestaronReciben += 1;
          if (a.valor.porque) dijoPorque += 1;
          if (a.valor.cuando) dijoCuando += 1;
          cuenta.deben += 1;
          if (listo) cuenta.listos += 1;
        }
        porGrupo.set(a.valor.grupo, cuenta);
      }
      // Un trío cerrado es el que tiene contestado todo lo que le toca. En un
      // grupo de cuatro son dos observadores, y también tienen que estar los
      // dos: la puesta en común usa lo que anotaron.
      let cerrados = 0;
      for (const c of porGrupo.values()) {
        if (c.deben > 0 && c.listos === c.deben) cerrados += 1;
      }
      return {
        tipo: 'ensayo',
        total,
        grupos: grupos.size,
        cerrados,
        observan,
        contestaron,
        sostuvo,
        motivo,
        reciben,
        contestaronReciben,
        dijoPorque,
        dijoCuando,
      };
    }

    case 'frases': {
      const equipos = new Set<number>();
      // Una mitad se identifica por su equipo y su lado, y está lista cuando
      // quien escribe en ella guardó algo.
      const mitades = new Set<string>();
      const listas = new Set<string>();
      for (const a of aportes) {
        if (a.valor?.tipo !== 'frases') continue;
        equipos.add(a.valor.color);
        mitades.add(`${a.valor.color}|${a.valor.lado}`);
        if (a.valor.escribe && a.valor.respuestas?.some((t) => t.length > 0)) {
          listas.add(`${a.valor.color}|${a.valor.lado}`);
        }
      }
      let completos = 0;
      for (const color of equipos) {
        const dos = ['objetivo', 'subjetivo'].filter((l) =>
          listas.has(`${color}|${l}`)
        );
        if (dos.length === 2) completos += 1;
      }
      return {
        tipo: 'frases',
        total,
        equipos: equipos.size,
        mitades: mitades.size,
        escribieron: listas.size,
        completos,
      };
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
