import 'server-only';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { calcularCompetencias } from '@/lib/competencias';
import type { SumarioCrudo } from '@/lib/redacciones';
import { esEmpresaDePrueba } from '@/lib/empresa-prueba';
import { esEmpresaEjemplo } from '@/lib/portal-ejemplo';
import type { Regulacion } from '@/lib/informe';

/**
 * La mediana de cada competencia entre todas las personas evaluadas.
 *
 * Es contra qué se compara el radar de un informe: el puntaje de una persona
 * dice dónde cae en la escala, y la mediana dice dónde cae la mitad de quienes
 * pasaron por la misma evaluación.
 *
 * **Se calcula y no se lee.** Los puntajes de un informe no se guardan en
 * ningún lado: `informe_competencias` está vacía y cada informe los calcula al
 * dibujarse. Acá se hace lo mismo para todos a la vez, con cuatro consultas,
 * una por tabla, en lugar de una ficha entera por persona.
 *
 * **Con el criterio que rige hoy.** Todos los protocolos se puntúan con los
 * pesos y los cortes vigentes, los mismos del informe que se está mirando: si
 * no, la mediana y el puntaje saldrían de dos reglas distintas.
 *
 * Tres decisiones de qué entra:
 *
 * - **Rorschach y Zulliger juntos.** Las competencias se llaman igual en los
 *   dos y separarlos dejaba a cada mitad con muy pocos casos.
 * - **La empresa de prueba no cuenta**: son candidatos inventados.
 * - **Un protocolo que no alcanza no suma**: sale sin puntaje y no es un cero.
 *   El Raven se sigue contando, que no depende del protocolo.
 *
 * Mediana y no promedio porque los puntajes se amontonan contra los extremos
 * de la escala y unos pocos muy bajos corren el promedio.
 */
export type Medianas = {
  /** La mediana de cada competencia, por su nombre. */
  porCompetencia: Record<string, number>;
  /** Cuántas personas aportaron al menos un puntaje. */
  casos: number;
  /**
   * Todos los puntajes, por test y por competencia, ordenados de menor a
   * mayor. Es lo que permite decir en qué percentil cae una persona entre los
   * candidatos evaluados con su mismo test (14/10/2026).
   */
  porTest: Record<string, Record<string, number[]>>;
};

/**
 * Qué porcentaje de esos puntajes queda por debajo de uno dado.
 *
 * Los empates cuentan la mitad: así quien tiene el valor mediano sale en el
 * percentil 50 y no en el 30 porque hubo muchos iguales.
 */
export function percentilEntre(valores: number[], p: number): number {
  if (valores.length === 0) return 50;
  let menores = 0;
  let iguales = 0;
  for (const v of valores) {
    if (v < p) menores++;
    else if (v === p) iguales++;
  }
  return Math.round((100 * (menores + iguales / 2)) / valores.length);
}

/** Con menos casos que estos, una mediana es el puntaje de alguien en particular. */
const MINIMO_DE_CASOS = 10;

type Fila = {
  id: string;
  pedidos: { baterias: { tests: string[] | null } | null; empresas: { nombre: string | null } | null } | null;
};

export async function medianasDeCompetencias(rige: Regulacion): Promise<Medianas | null> {
  const [sumarios, ravens, discursivos, evaluaciones] = await Promise.all([
    select<{ evaluacion_id: string; crudo: SumarioCrudo | null }>(
      'sumario_exner',
      'select=evaluacion_id,crudo',
      CACHE_PSICOTECNICOS
    ),
    select<{ evaluacion_id: string; raw: number | null; corto: number | null; percentil: number | null }>(
      'raven',
      'select=evaluacion_id,raw,corto,percentil',
      CACHE_PSICOTECNICOS
    ),
    select<{ evaluacion_id: string; nivel: string | null; discurso_celda: string | null }>(
      'analisis_discursivo',
      'select=evaluacion_id,nivel,discurso_celda',
      CACHE_PSICOTECNICOS
    ),
    select<Fila>(
      'evaluaciones',
      'select=id,pedidos(baterias(tests),empresas(nombre))',
      CACHE_PSICOTECNICOS
    ),
  ]);

  const ravenDe = new Map(ravens.map((r) => [r.evaluacion_id, r]));
  const discursivoDe = new Map(discursivos.map((d) => [d.evaluacion_id, d]));
  const evaluacionDe = new Map(evaluaciones.map((e) => [e.id, e]));

  const puntajes: Record<string, number[]> = {};
  const porTest: Record<string, Record<string, number[]>> = { Rorschach: {}, Zulliger: {} };
  let casos = 0;

  for (const s of sumarios) {
    const e = evaluacionDe.get(s.evaluacion_id);
    // Ni la empresa de prueba ni la de muestra del portal: sus fichas son
    // inventadas y moverían la distribución.
    if (!s.crudo || !e) continue;
    if (esEmpresaDePrueba(e.pedidos?.empresas?.nombre) || esEmpresaEjemplo(e.pedidos?.empresas?.nombre)) continue;

    const raven = ravenDe.get(s.evaluacion_id);
    const discursivo = discursivoDe.get(s.evaluacion_id);
    const tests = e.pedidos?.baterias?.tests ?? [];
    // El test sale del protocolo y no de la batería: una persona puede tener
    // cargado un Zulliger con una batería que dice Rorschach.
    const meta = (s.crudo as { meta?: { test?: string } }).meta;
    const test =
      meta?.test === 'Zulliger' || meta?.test === 'Rorschach'
        ? meta.test
        : tests.includes('Zulliger')
          ? 'Zulliger'
          : 'Rorschach';
    const calculadas = calcularCompetencias(
      s.crudo,
      {
        ravenPercentil: raven?.percentil ?? null,
        ravenRaw: raven?.raw ?? null,
        ravenCorto: raven?.corto ?? null,
        potencial: discursivo
          ? { nivel: discursivo.nivel, celda: discursivo.discurso_celda }
          : null,
        rangos: rige.rangos,
        pesos: rige.pesos,
        cortesCompetencias: rige.cortesCompetencias,
        direcciones: rige.direcciones,
      },
      test
    );

    let aporto = false;
    for (const c of calculadas) {
      if (c.puntaje === null) continue;
      (puntajes[c.nombre] ??= []).push(c.puntaje);
      (porTest[test][c.nombre] ??= []).push(c.puntaje);
      aporto = true;
    }
    if (aporto) casos++;
  }

  if (casos < MINIMO_DE_CASOS) return null;

  const porCompetencia: Record<string, number> = {};
  for (const [nombre, valores] of Object.entries(puntajes)) {
    if (valores.length < MINIMO_DE_CASOS) continue;
    const orden = valores.slice().sort((a, b) => a - b);
    const medio = Math.floor(orden.length / 2);
    porCompetencia[nombre] = Math.round(
      orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2
    );
  }
  for (const t of Object.values(porTest)) for (const v of Object.values(t)) v.sort((a, b) => a - b);
  return { porCompetencia, casos, porTest };
}
