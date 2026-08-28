import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';

/**
 * Cuánto tarda hoy un informe desde la entrevista, para decirlo en la venta.
 *
 * La página de psicotécnicos promete un plazo, y un plazo escrito a mano
 * envejece: se promete lo que se cumplía el día que alguien lo redactó. Esto
 * sale de las evaluaciones ya entregadas, así que lo que se publica es lo que
 * está pasando.
 *
 * **Se mide de la entrevista a la entrega y no de la solicitud**, porque es el
 * único tramo que depende del estudio: entre el pedido y la entrevista está la
 * agenda del candidato, que la coordinamos pero no la manejamos.
 *
 * **La misma cuenta que el Data Hub**: días corridos y mediana por evaluadora.
 * Es el número que ellas ven adentro del sistema, y publicar acá otro (hábiles,
 * o promedio) daría dos verdades sobre lo mismo según dónde se lo mire.
 *
 * **Promedio de las medianas de cada evaluadora**, y no una sola mediana de
 * todas las evaluaciones juntas: son dos personas que trabajan a su ritmo, y la
 * que entregó más casos en el período arrastraría el número hacia el suyo.
 *
 * La mediana y no el promedio dentro de cada una: un caso raro, con la entrega
 * demorada por algo que pasó afuera, mueve un promedio de veinte casos casi un
 * día entero.
 */

/** Casos mínimos por evaluadora para que su mediana entre en la cuenta. */
const MINIMO = 3;

/** Cuántas entregas hacen falta para publicar el número. */
const MINIMO_TOTAL = 10;

type Fila = {
  fecha_entrevista: string | null;
  fecha_entrega: string | null;
  evaluadoras: { nombre: string } | null;
};

export type TiempoEntrega = { dias: number; casos: number };

export async function tiempoDeEntrega(): Promise<TiempoEntrega | null> {
  let filas: Fila[] = [];
  try {
    filas = await select<Fila>(
      'evaluaciones',
      'select=fecha_entrevista,fecha_entrega,evaluadoras(nombre)&fecha_entrega=not.is.null',
      CACHE_PSICOTECNICOS
    );
  } catch {
    // La página comercial se sirve igual sin el dato: el plazo que promete el
    // texto no depende de esta consulta.
    return null;
  }

  const porEvaluadora = new Map<string, number[]>();
  for (const f of filas) {
    const nombre = f.evaluadoras?.nombre;
    if (!nombre || !f.fecha_entrevista || !f.fecha_entrega) continue;
    const a = new Date(f.fecha_entrevista).getTime();
    const b = new Date(f.fecha_entrega).getTime();
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) continue;
    porEvaluadora.set(nombre, [...(porEvaluadora.get(nombre) ?? []), (b - a) / 86_400_000]);
  }

  const medianas: number[] = [];
  let casos = 0;
  for (const dias of porEvaluadora.values()) {
    if (dias.length < MINIMO) continue;
    medianas.push(mediana(dias));
    casos += dias.length;
  }

  if (medianas.length === 0 || casos < MINIMO_TOTAL) return null;
  const dias = medianas.reduce((a, b) => a + b, 0) / medianas.length;
  return { dias: Math.round(dias * 10) / 10, casos };
}

function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
