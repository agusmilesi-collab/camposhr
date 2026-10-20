import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { hayPuerta, huella, igual } from '@/lib/os-sesion';
import { cookieDelOs } from '@/lib/os-sesion-servidor';
import { anotarAcceso } from '@/lib/accesos';
import { CC_EE, CONTENIDOS, DETERMINANTES, FQ, LAMINA, LOCALIZACION, POSICION } from '@/lib/rorschach';
import { CAMPOS_HR, conRepresentacionHumana } from '@/lib/representacion-humana';

export const runtime = 'nodejs';

/**
 * La codificación Rorschach de una evaluación: alta, cambio y baja de filas.
 *
 * Va en Supabase, como todo lo que el OS guarda (ver `CLAUDE.md`). Cada fila es
 * una respuesta del protocolo y vive en `rorschach_respuestas`.
 *
 * Los valores se comprueban contra las mismas listas que ve la evaluadora en
 * pantalla: un desplegable puede mandar cualquier cosa si alguien arma el
 * pedido a mano, y una codificación con un código inventado rompe el cálculo
 * del sumario más adelante, cuando ya nadie se acuerda de dónde salió.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALIDOS = {
  lamina: new Set(LAMINA.map((o) => o.v)),
  localizacion: new Set(LOCALIZACION.map((o) => o.v)),
  fq: new Set(FQ.map((o) => o.v)),
  determinantes: new Set(DETERMINANTES.map((o) => o.v)),
  contenidos: new Set(CONTENIDOS.map((o) => o.v)),
  cc_ee: new Set(CC_EE.map((o) => o.v)),
  posicion: new Set(POSICION.map((o) => o.v)),
};

type Fallo = { ok: false; motivo: string };

/** Deja pasar solo lo que la tabla acepta, con el tipo que corresponde. */
function limpiar(campos: Record<string, unknown>): Record<string, unknown> | Fallo {
  const fila: Record<string, unknown> = {};

  for (const [campo, valor] of Object.entries(campos)) {
    switch (campo) {
      case 'lamina':
      case 'localizacion':
      case 'posicion':
      case 'fq': {
        if (valor === null || valor === '') {
          fila[campo] = null;
          break;
        }
        if (typeof valor !== 'string' || !VALIDOS[campo].has(valor)) {
          return { ok: false, motivo: `Valor no válido en ${campo}: ${String(valor)}` };
        }
        fila[campo] = valor;
        break;
      }
      case 'determinantes':
      case 'contenidos':
      case 'cc_ee': {
        if (!Array.isArray(valor)) return { ok: false, motivo: `${campo} tiene que ser una lista.` };
        for (const v of valor) {
          if (typeof v !== 'string' || !VALIDOS[campo].has(v)) {
            return { ok: false, motivo: `Valor no válido en ${campo}: ${String(v)}` };
          }
        }
        fila[campo] = valor;
        break;
      }
      // Las áreas marcadas en la lámina ("D2", "Dd25", "WS"): de acá sale el Z
      // cuando la localización queda como Dd99.
      case 'areas': {
        if (valor === null) {
          fila[campo] = null;
          break;
        }
        if (
          !Array.isArray(valor) ||
          valor.some((v) => typeof v !== 'string' || !/^(WS?|D|DS|Dd|DdS)\d{0,3}$/.test(v))
        ) {
          return { ok: false, motivo: 'Las áreas tienen que ser una lista de códigos de área.' };
        }
        fila[campo] = valor;
        break;
      }
      case 'par':
      case 'popular':
      case 'agc':
      case 'sl': {
        if (typeof valor !== 'boolean') return { ok: false, motivo: `${campo} tiene que ser sí o no.` };
        fila[campo] = valor;
        break;
      }
      case 'n_respuesta': {
        if (valor === null || valor === '') {
          fila[campo] = null;
          break;
        }
        const n = Number(valor);
        if (!Number.isInteger(n) || n < 0) return { ok: false, motivo: 'El número de respuesta tiene que ser entero.' };
        fila[campo] = n;
        break;
      }
      case 'z': {
        if (valor === null || valor === '') {
          fila[campo] = null;
          break;
        }
        const n = Number(valor);
        if (!Number.isFinite(n)) return { ok: false, motivo: 'El puntaje Z tiene que ser un número.' };
        fila[campo] = n;
        break;
      }
      case 'n_localizacion':
      // Lo que dijo el candidato, textual. Tiene columna propia y no va con las
      // notas: es el dato de la primera instancia y lo que se lee en la
      // segunda para preguntarle dónde lo vio.
      case 'verbalizacion':
      // Qué de la mancha le hizo ver eso, dicho en la encuesta: la ayuda para
      // codificar los determinantes.
      case 'caracteristica':
      case 'observacion': {
        if (valor !== null && typeof valor !== 'string') {
          return { ok: false, motivo: `${campo} es texto.` };
        }
        fila[campo] = valor === '' ? null : valor;
        break;
      }
      case 'origen': {
        // Dice de dónde vino la fila. Una capturada llega con campos vacíos a
        // propósito (los que la pantalla no puede saber) y sin esto no se
        // distingue de una que se empezó a cargar a mano y quedó por la mitad.
        if (valor !== 'captura' && valor !== 'manual') {
          return { ok: false, motivo: `Origen no válido: ${String(valor)}` };
        }
        fila[campo] = valor;
        break;
      }
      default:
        return { ok: false, motivo: `Campo desconocido: ${campo}` };
    }
  }

  return fila;
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function conSesion(): Promise<boolean> {
  if (!hayPuerta()) return true;
  const clave = process.env.OS_CLAVE as string;
  const cookie = await cookieDelOs();
  return Boolean(cookie && igual(cookie, await huella(clave)));
}

/**
 * Vuelve a numerar el protocolo entero, de 1 en adelante, y devuelve el número
 * que quedó en cada fila.
 *
 * El número de respuesta es correlativo de todo el protocolo y es lo que cuenta
 * el sumario. Se corregía sumando o restando uno a las demás en cada alta y
 * cada baja, desde la pantalla: con la ficha y la encuesta abiertas a la vez, o
 * con un pedido que fallaba a mitad de camino, quedaban números repetidos y
 * huecos (el protocolo de prueba llegó a tener cuatro respuestas 2 y ninguna
 * 1). Recontar todo después de cada cambio no depende de lo que cada pantalla
 * creía que había.
 *
 * El orden es el de las láminas; adentro de cada una, el número que ya tenían,
 * y a igual número, la que se cargó antes. Solo se escriben las que cambian.
 */
async function renumerar(
  cfg: { url: string; key: string },
  evaluacion: string
): Promise<Record<string, number> | null> {
  const cabeza = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` };
  const res = await fetch(
    `${cfg.url}/rest/v1/rorschach_respuestas?select=id,lamina,n_respuesta,created_at&evaluacion_id=eq.${evaluacion}`,
    { headers: cabeza, cache: 'no-store' }
  ).catch(() => null);
  if (!res?.ok) return null;
  const filas = (await res.json()) as {
    id: string;
    lamina: string | null;
    n_respuesta: number | null;
    created_at: string;
  }[];
  const orden = LAMINA.map((o) => o.v);
  const lugar = (l: string | null) => {
    const i = orden.indexOf(l ?? '');
    return i === -1 ? orden.length : i;
  };
  filas.sort(
    (a, b) =>
      lugar(a.lamina) - lugar(b.lamina) ||
      (a.n_respuesta ?? Infinity) - (b.n_respuesta ?? Infinity) ||
      a.created_at.localeCompare(b.created_at)
  );
  const numeros: Record<string, number> = {};
  const cambios = filas.flatMap((f, i) => {
    numeros[f.id] = i + 1;
    return f.n_respuesta === i + 1 ? [] : [{ id: f.id, n: i + 1 }];
  });
  const hechos = await Promise.all(
    cambios.map(({ id, n }) =>
      fetch(`${cfg.url}/rest/v1/rorschach_respuestas?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...cabeza, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ n_respuesta: n }),
        cache: 'no-store',
      })
        .then((r) => r.ok)
        .catch(() => false)
    )
  );
  return hechos.every(Boolean) ? numeros : null;
}

/**
 * De qué test es una respuesta que se está dando de alta.
 *
 * Manda la lámina, que es lo que se le mostró a la persona: las tres de Zdunic
 * son Z1, Z2 y Z3, y las diez del Sistema Comprehensivo van en romanos. Sin
 * lámina se cae en lo que dice la batería que se le vendió al cliente, que es
 * lo que se le va a tomar.
 *
 * Estaba escrito 'Rorschach' fijo, así que cada protocolo de Zulliger que se
 * codificaba acá quedaba marcado como Rorschach: la pestaña cambiaba de nombre,
 * saltaba el aviso de desajuste y el sumario se iba a calcular con las normas
 * que no son.
 */
async function testDe(
  cfg: { url: string; key: string },
  evaluacion: string,
  lamina: unknown
): Promise<'Rorschach' | 'Zulliger'> {
  if (typeof lamina === 'string' && lamina) return lamina.startsWith('Z') ? 'Zulliger' : 'Rorschach';

  const res = await fetch(
    `${cfg.url}/rest/v1/evaluaciones?select=pedidos(baterias(tests))&id=eq.${evaluacion}`,
    {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
      cache: 'no-store',
    }
  ).catch(() => null);
  if (!res?.ok) return 'Rorschach';
  const [fila] = (await res.json().catch(() => [])) as {
    pedidos?: { baterias?: { tests?: string[] | null } | null } | null;
  }[];
  return fila?.pedidos?.baterias?.tests?.includes('Zulliger') ? 'Zulliger' : 'Rorschach';
}

/**
 * Las respuestas de una evaluación, como las trae la pantalla de la encuesta al
 * abrirse. La pantalla las vuelve a pedir al cambiar de lámina y al volver a la
 * pestaña: lo que se guardó desde la ficha, o desde otra pestaña, no le llegaba
 * hasta recargar.
 */
export async function GET(req: Request) {
  if (!(await conSesion())) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }
  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  const evaluacion = new URL(req.url).searchParams.get('evaluacion') ?? '';
  if (!UUID.test(evaluacion)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }
  const res = await fetch(
    `${cfg.url}/rest/v1/rorschach_respuestas?select=id,n_respuesta,lamina,localizacion,n_localizacion,areas,fq,` +
      `determinantes,par,contenidos,popular,z,observacion,verbalizacion,posicion,caracteristica` +
      `&evaluacion_id=eq.${evaluacion}&order=n_respuesta`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, cache: 'no-store' }
  ).catch(() => null);
  if (!res?.ok) return NextResponse.json({ ok: false, motivo: 'No se pudo leer.' }, { status: 502 });
  return NextResponse.json({ ok: true, filas: await res.json() });
}

/** Alta de una respuesta, al final del protocolo. */
export async function PUT(req: Request) {
  if (!(await conSesion())) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }
  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const datos = await req.json().catch(() => null);
  const evaluacion = datos?.evaluacionId;
  if (typeof evaluacion !== 'string' || !UUID.test(evaluacion)) {
    return NextResponse.json({ ok: false, motivo: 'Evaluación inválida.' }, { status: 400 });
  }

  const limpio = limpiar(datos.campos ?? {});
  if ('ok' in limpio) return NextResponse.json(limpio, { status: 400 });

  const test = await testDe(cfg, evaluacion, limpio.lamina);
  // La respuesta capturada en la encuesta entra con sus contenidos y su FQ.
  if (CAMPOS_HR.some((c) => c in limpio)) limpio.cc_ee = conRepresentacionHumana(limpio as never);

  const res = await fetch(`${cfg.url}/rest/v1/rorschach_respuestas`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ ...limpio, evaluacion_id: evaluacion, test }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
      { status: 400 }
    );
  }

  const [fila] = await res.json();
  const numeros = await renumerar(cfg, evaluacion);
  if (fila && numeros?.[fila.id]) fila.n_respuesta = numeros[fila.id];
  await anotarAcceso({
    accion: 'escritura',
    recurso: 'rorschach',
    detalle: { evaluacion, alta: fila?.id },
  });
  revalidateTag(CACHE_PSICOTECNICOS, { expire: 0 });
  return NextResponse.json({ ok: true, fila, numeros });
}

/** Cambio de una celda. Guarda sola, como el resto del pipeline. */
export async function POST(req: Request) {
  if (!(await conSesion())) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }
  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const datos = await req.json().catch(() => null);
  const id = datos?.id;
  if (typeof id !== 'string' || !UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Identificador inválido.' }, { status: 400 });
  }

  const limpio = limpiar(datos.campos ?? {});
  if ('ok' in limpio) return NextResponse.json(limpio, { status: 400 });
  if (Object.keys(limpio).length === 0) return NextResponse.json({ ok: true });

  /* Corregir el número de localización a mano, en la ficha, deja de lado las
     áreas que se marcaron en la lámina: si quedaran, el Z se seguiría
     calculando con las viejas. */
  if ('n_localizacion' in limpio && !('areas' in limpio)) limpio.areas = null;

  /* Corregir la lámina corrige el test: la fila pasa de una lámina romana a una
     Z cuando el protocolo se empezó con la lámina que no era, y dejar el test
     viejo sostiene el error en la columna con la que se elige la norma. */
  if (typeof limpio.lamina === 'string' && limpio.lamina) {
    limpio.test = limpio.lamina.startsWith('Z') ? 'Zulliger' : 'Rorschach';
  }

  /* GHR y PHR los pone el sistema (`lib/representacion-humana.ts`): un cambio
     en algo de lo que dependen se cruza con el resto de la fila guardada y la
     lista de códigos especiales viaja con el que corresponde. */
  if (CAMPOS_HR.some((c) => c in limpio)) {
    const actual = await fetch(
      `${cfg.url}/rest/v1/rorschach_respuestas?select=${CAMPOS_HR.join(',')}&id=eq.${id}`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, cache: 'no-store' }
    ).catch(() => null);
    const [fila] = actual?.ok ? await actual.json().catch(() => []) : [];
    if (fila) limpio.cc_ee = conRepresentacionHumana({ ...fila, ...limpio });
  }

  const res = await fetch(`${cfg.url}/rest/v1/rorschach_respuestas?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(limpio),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
      { status: 400 }
    );
  }

  /* Pasar una respuesta a otra lámina la cambia de lugar en el protocolo. */
  let numeros: Record<string, number> | null = null;
  if ('lamina' in limpio) {
    const de = await fetch(
      `${cfg.url}/rest/v1/rorschach_respuestas?select=evaluacion_id&id=eq.${id}`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, cache: 'no-store' }
    ).catch(() => null);
    const [fila] = de?.ok ? await de.json().catch(() => []) : [];
    if (fila?.evaluacion_id) numeros = await renumerar(cfg, fila.evaluacion_id);
  }

  await anotarAcceso({ accion: 'escritura', recurso: 'rorschach', detalle: { fila: id, campos: limpio } });
  revalidateTag(CACHE_PSICOTECNICOS, { expire: 0 });
  return NextResponse.json({ ok: true, numeros });
}

/** Baja de una respuesta cargada de más. */
export async function DELETE(req: Request) {
  if (!(await conSesion())) {
    return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
  }
  const cfg = config();
  if (!cfg) return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) {
    return NextResponse.json({ ok: false, motivo: 'Identificador inválido.' }, { status: 400 });
  }

  const res = await fetch(`${cfg.url}/rest/v1/rorschach_respuestas?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Prefer: 'return=representation',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
      { status: 400 }
    );
  }

  const [borrada] = (await res.json().catch(() => [])) as { evaluacion_id?: string }[];
  const numeros = borrada?.evaluacion_id ? await renumerar(cfg, borrada.evaluacion_id) : null;

  await anotarAcceso({ accion: 'escritura', recurso: 'rorschach', detalle: { baja: id } });
  revalidateTag(CACHE_PSICOTECNICOS, { expire: 0 });
  return NextResponse.json({ ok: true, numeros });
}
