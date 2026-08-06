/**
 * Ciclo de encuentros — la capa de acceso a las tres tablas de `ciclo.sql`.
 *
 * Mismo criterio que el resto: todo server-side con la service key, sin SDK.
 * Este módulo no puede importarse desde un componente de cliente.
 *
 * Las cinco formas de responder están fijadas en `TIPOS`. Una actividad nueva es
 * una fila en `actividades`, no código nuevo: por eso la validación y el resumen
 * se resuelven acá adentro con un switch sobre el tipo y no en cada pantalla.
 */

import 'server-only';
import { insert, patch, select, upsert } from '@/lib/supabase';

// -------------------------------------------------------------------- tipos

export const TIPOS = [
  'palabra',
  'opcion',
  'escala',
  'texto',
  'marcas',
  /** No se responde acá: lleva a una herramienta que ya existe aparte, como el
   *  cuestionario de perfil de la charla 3. La dirección va en `opciones[0]`. */
  'enlace',
] as const;
export type TipoActividad = (typeof TIPOS)[number];

export type Actividad = {
  id: string;
  empresa_id: string;
  /** Identificador legible dentro de la empresa, por ejemplo 'c1-multitarea'. */
  clave: string;
  charla: number;
  orden: number;
  tipo: TipoActividad;
  titulo: string;
  enunciado: string | null;
  /** Alternativas de 'opcion' y 'marcas', en orden. */
  opciones: string[];
  abierta: boolean;
  created_at: string;
};

export type Asistente = {
  id: string;
  empresa_id: string;
  nombre: string;
  apellido: string;
  foto_path: string | null;
  created_at: string;
};

export type Aporte = {
  id: string;
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
  | { tipo: 'marcas'; marcas: number[] };

/** La dirección de una actividad de tipo 'enlace'. Sólo se acepta https. */
export function destinoDe(actividad: Actividad): string | null {
  const url = actividad.opciones?.[0];
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

const CAMPOS_ACTIVIDAD =
  'id,empresa_id,clave,charla,orden,tipo,titulo,enunciado,opciones,abierta,created_at';
const CAMPOS_ASISTENTE = 'id,empresa_id,nombre,apellido,foto_path,created_at';
const CAMPOS_APORTE = 'id,actividad_id,asistente_id,valor,created_at';

/**
 * Todo id que viaja a PostgREST se valida antes de entrar en la query.
 * Sin esto, un id armado a mano puede cambiar el filtro entero.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAVE = /^[a-z0-9-]{2,60}$/;

// --------------------------------------------------------------- actividades

export async function listarActividades(empresaId: string): Promise<Actividad[]> {
  if (!UUID.test(empresaId)) return [];
  return select<Actividad>(
    'actividades',
    `select=${CAMPOS_ACTIVIDAD}&empresa_id=eq.${empresaId}` +
      `&order=charla.asc,orden.asc`
  );
}

/**
 * La actividad que está abierta en este momento, o null.
 *
 * El teléfono de cada persona muestra esto y nada más. Si por algún motivo
 * quedara más de una abierta, gana la última que se abrió.
 */
export async function getActividadAbierta(
  empresaId: string
): Promise<Actividad | null> {
  if (!UUID.test(empresaId)) return null;
  const filas = await select<Actividad>(
    'actividades',
    `select=${CAMPOS_ACTIVIDAD}&empresa_id=eq.${empresaId}&abierta=is.true` +
      `&order=charla.desc,orden.desc&limit=1`
  );
  return filas[0] ?? null;
}

export async function getActividad(
  empresaId: string,
  actividadId: string
): Promise<Actividad | null> {
  if (!UUID.test(empresaId) || !UUID.test(actividadId)) return null;
  const filas = await select<Actividad>(
    'actividades',
    `select=${CAMPOS_ACTIVIDAD}&empresa_id=eq.${empresaId}&id=eq.${actividadId}&limit=1`
  );
  return filas[0] ?? null;
}

export async function getActividadPorClave(
  empresaId: string,
  clave: string
): Promise<Actividad | null> {
  if (!UUID.test(empresaId) || !CLAVE.test(clave)) return null;
  const filas = await select<Actividad>(
    'actividades',
    `select=${CAMPOS_ACTIVIDAD}&empresa_id=eq.${empresaId}&clave=eq.${clave}&limit=1`
  );
  return filas[0] ?? null;
}

/**
 * Abre una actividad y cierra las demás de la empresa.
 *
 * Se cierra primero y se abre después: si el orden fuera al revés, entre las dos
 * llamadas habría un instante con dos actividades abiertas y un teléfono que
 * consulte justo ahí mostraría la que no es.
 */
export async function abrirActividad(
  empresaId: string,
  actividadId: string
): Promise<void> {
  if (!UUID.test(empresaId) || !UUID.test(actividadId)) {
    throw new Error('Actividad inválida');
  }
  await cerrarActividades(empresaId);
  await patch(
    'actividades',
    `empresa_id=eq.${empresaId}&id=eq.${actividadId}`,
    { abierta: true }
  );
}

export async function cerrarActividades(empresaId: string): Promise<void> {
  if (!UUID.test(empresaId)) throw new Error('Empresa inválida');
  await patch(
    'actividades',
    `empresa_id=eq.${empresaId}&abierta=is.true`,
    { abierta: false }
  );
}

// ---------------------------------------------------------------- asistentes

/**
 * Los asistentes del ciclo, por apellido.
 *
 * Es la lista que arma la grilla de caras del segundo día: la persona que abre
 * desde otro teléfono se busca a sí misma en vez de escribir un código.
 */
export async function listarAsistentes(empresaId: string): Promise<Asistente[]> {
  if (!UUID.test(empresaId)) return [];
  return select<Asistente>(
    'asistentes',
    `select=${CAMPOS_ASISTENTE}&empresa_id=eq.${empresaId}` +
      `&order=apellido.asc,nombre.asc`
  );
}

export async function getAsistente(
  empresaId: string,
  asistenteId: string
): Promise<Asistente | null> {
  if (!UUID.test(empresaId) || !UUID.test(asistenteId)) return null;
  const filas = await select<Asistente>(
    'asistentes',
    `select=${CAMPOS_ASISTENTE}&empresa_id=eq.${empresaId}&id=eq.${asistenteId}&limit=1`
  );
  return filas[0] ?? null;
}

export async function crearAsistente(fila: {
  empresa_id: string;
  nombre: string;
  apellido: string;
  foto_path: string | null;
}): Promise<Asistente> {
  return insert<Asistente>('asistentes', fila);
}

// ------------------------------------------------------------------- aportes

export async function listarAportes(actividadId: string): Promise<Aporte[]> {
  if (!UUID.test(actividadId)) return [];
  return select<Aporte>(
    'aportes',
    `select=${CAMPOS_APORTE}&actividad_id=eq.${actividadId}&order=created_at.asc`
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

/** Guarda la respuesta. Si la persona ya había respondido, la corrige. */
export async function guardarAporte(
  actividadId: string,
  asistenteId: string,
  valor: Valor
): Promise<Aporte> {
  if (!UUID.test(actividadId) || !UUID.test(asistenteId)) {
    throw new Error('Aporte inválido');
  }
  return upsert<Aporte>(
    'aportes',
    { actividad_id: actividadId, asistente_id: asistenteId, valor },
    'actividad_id,asistente_id'
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
 * Sale de CICLO_CONTROL_CLAVE. Si la variable no está definida, el control
 * queda abierto, para poder probarlo en local sin configurar nada.
 */
export function claveControlOk(recibida: string | null | undefined): boolean {
  const esperada = process.env.CICLO_CONTROL_CLAVE;
  if (!esperada) return true;
  return recibida === esperada;
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

    case 'enlace':
      throw new Error('Esta actividad se responde en su propia pantalla');

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
  | { tipo: 'enlace'; total: number };

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

    case 'enlace':
      // Lo que respondieron no está en `aportes`: está en la tabla de la
      // herramienta a la que lleva. La placa lo cuenta con su propia vista.
      return { tipo: 'enlace', total };

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
