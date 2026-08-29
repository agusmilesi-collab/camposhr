import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { CC_EE, CONTENIDOS, DETERMINANTES, FQ, LAMINA, LOCALIZACION } from '@/lib/rorschach';

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
};

type Fallo = { ok: false; motivo: string };

/** Deja pasar solo lo que la tabla acepta, con el tipo que corresponde. */
function limpiar(campos: Record<string, unknown>): Record<string, unknown> | Fallo {
  const fila: Record<string, unknown> = {};

  for (const [campo, valor] of Object.entries(campos)) {
    switch (campo) {
      case 'lamina':
      case 'localizacion':
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
  const cookie = cookies().get(COOKIE)?.value;
  return Boolean(cookie && igual(cookie, await huella(clave)));
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
  await anotarAcceso({
    accion: 'escritura',
    recurso: 'rorschach',
    detalle: { evaluacion, alta: fila?.id },
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true, fila });
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

  /* Corregir la lámina corrige el test: la fila pasa de una lámina romana a una
     Z cuando el protocolo se empezó con la lámina que no era, y dejar el test
     viejo sostiene el error en la columna con la que se elige la norma. */
  if (typeof limpio.lamina === 'string' && limpio.lamina) {
    limpio.test = limpio.lamina.startsWith('Z') ? 'Zulliger' : 'Rorschach';
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

  await anotarAcceso({ accion: 'escritura', recurso: 'rorschach', detalle: { fila: id, campos: limpio } });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
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
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `Supabase respondió ${res.status}: ${await res.text()}` },
      { status: 400 }
    );
  }

  await anotarAcceso({ accion: 'escritura', recurso: 'rorschach', detalle: { baja: id } });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
