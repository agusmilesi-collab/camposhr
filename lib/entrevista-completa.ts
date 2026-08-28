import 'server-only';
import { select } from '@/lib/supabase';
import { llevaBenziger } from '@/lib/benziger';

/**
 * Cuándo una entrevista ya está tomada.
 *
 * La evaluación pasa sola a Por analizar en cuanto queda administrado el último
 * test de su batería. Hasta ahora había que acordarse de apretar "Entrevista
 * tomada" al final, con la persona ya saludando: el botón sigue estando para
 * cerrarla antes, pero olvidarse deja de sacar la evaluación de la lista.
 *
 * Solo cuentan los tests que dejan marca. La entrevista por competencias y el
 * análisis discursivo no la dejan, así que exigirlos sería exigir algo que
 * nadie puede tildar.
 */

type Fila = {
  estado: string;
  proyectivo_administrado: boolean;
  bender_administrado: boolean;
  grafico_2_personas_administrado: boolean;
  benziger_administrado: boolean;
  /** Si a esta persona le corresponde, aunque el pedido no lo haya comprado. */
  con_benziger: boolean | null;
  /** Uno a uno: PostgREST lo devuelve como objeto, no como lista. */
  raven: { raw: number | null } | null;
  pedidos: { con_benziger: boolean | null; baterias: { tests: string[] | null } | null } | null;
};

const CAMPOS =
  'estado,proyectivo_administrado,bender_administrado,grafico_2_personas_administrado,' +
  'benziger_administrado,con_benziger,raven(raw),pedidos(con_benziger,baterias(tests))';

/** Qué marca mira cada test de la batería. Los que no están, no dejan marca. */
const MARCA: Record<string, (f: Fila) => boolean> = {
  Rorschach: (f) => f.proyectivo_administrado,
  Zulliger: (f) => f.proyectivo_administrado,
  Bender: (f) => f.bender_administrado,
  'Gráfico 2 personas': (f) => f.grafico_2_personas_administrado,
  Raven: (f) => f.raven?.raw !== null && f.raven?.raw !== undefined,
};

/**
 * Pasa la evaluación a Por analizar si ya se le tomó todo.
 *
 * Se llama después de cualquier cambio que pueda completar la entrevista. Si
 * todavía falta algo, o si la evaluación no está en Por entrevistar, no hace
 * nada: no vuelve atrás una que ya avanzó ni empuja una que todavía no se citó.
 */
export async function siEstaTodoTomado(evaluacionId: string): Promise<boolean> {
  try {
    return await revisar(evaluacionId);
  } catch (e) {
    // Nunca tumba lo que se estaba guardando: esto es un paso de más, y que
    // falle no puede hacer perder la marca que la evaluadora acaba de poner.
    console.error('entrevista completa:', e);
    return false;
  }
}

async function revisar(evaluacionId: string): Promise<boolean> {
  const filas = await select<Fila>(
    'evaluaciones',
    `select=${CAMPOS}&id=eq.${evaluacionId}&limit=1`
  );
  const f = filas[0];
  if (!f || f.estado !== 'Por entrevistar') return false;

  const tests = f.pedidos?.baterias?.tests ?? [];
  const pendientes = tests.filter((t) => MARCA[t] && !MARCA[t](f));
  if (pendientes.length > 0) return false;
  // El Benziger no está en la batería: lo agrega el pedido, o el candidato.
  if (llevaBenziger(f) && !f.benziger_administrado) return false;
  // Sin ningún test que deje marca no hay nada que dar por terminado.
  if (!tests.some((t) => MARCA[t])) return false;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return false;
  const res = await fetch(`${url}/rest/v1/evaluaciones?id=eq.${evaluacionId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ estado: 'Por analizar' }),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('entrevista completa:', res.status, await res.text());
    return false;
  }
  return true;
}
