import Pesos, { type Hoja, type Casos } from './Pesos';
import {
  HOJAS,
  PESOS_DE_FABRICA,
  calcularCompetencias,
  claveDePeso,
  conDireccion,
  numerosDe,
} from '@/lib/competencias';
import { loQueRige } from '@/lib/informe';
import { select } from '@/lib/supabase';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { esEmpresaEjemplo } from '@/lib/portal-ejemplo';
import type { SumarioCrudo } from '@/lib/redacciones';

type SumarioFila = { evaluacion_id: string; crudo: SumarioCrudo | null };
type RavenFila = { evaluacion_id: string; raw: number | null; corto: number | null };
type EvaluacionFila = { id: string; pedidos: { empresas: { nombre: string } | null } | null };

/**
 * En qué nivel cae cada indicador en los protocolos cargados, con los pesos y
 * cortes que rigen.
 *
 * Es la comprobación de cada corte: un indicador que deja a 36 de 47 en bajo
 * describe al corte y no a la gente, y uno que nunca cambia de nivel no
 * aporta nada al número. Sin esta columna, mover un corte era adivinar qué
 * hacía con los protocolos reales (14/10/2026). La empresa de muestra queda
 * afuera, como en el data hub.
 */
async function casosPorIndicador(rige: Awaited<ReturnType<typeof loQueRige>>): Promise<Record<string, Casos>> {
  const [sumarios, ravens, evaluaciones] = await Promise.all([
    select<SumarioFila>('sumario_exner', 'select=evaluacion_id,crudo', CACHE_PSICOTECNICOS),
    select<RavenFila>('raven', 'select=evaluacion_id,raw,corto', CACHE_PSICOTECNICOS),
    select<EvaluacionFila>('evaluaciones', 'select=id,pedidos(empresas(nombre))', CACHE_PSICOTECNICOS),
  ]);
  const deMuestra = new Set(
    evaluaciones.filter((e) => esEmpresaEjemplo(e.pedidos?.empresas?.nombre)).map((e) => e.id)
  );
  const raven = new Map(ravens.map((r) => [r.evaluacion_id, r]));
  const casos: Record<string, Casos> = {};
  for (const s of sumarios) {
    if (!s.crudo || deMuestra.has(s.evaluacion_id)) continue;
    const meta = (s.crudo as { meta?: { test?: string } }).meta;
    const test = meta?.test === 'Zulliger' ? 'Zulliger' : 'Rorschach';
    const r = raven.get(s.evaluacion_id);
    const competencias = calcularCompetencias(
      s.crudo,
      {
        ravenPercentil: null,
        ravenRaw: r?.raw ?? null,
        ravenCorto: r?.corto ?? null,
        rangos: rige.rangos,
        pesos: rige.pesos,
        cortesCompetencias: rige.cortesCompetencias,
        direcciones: rige.direcciones,
      },
      test
    );
    for (const c of competencias) {
      for (const renglon of c.renglones) {
        const clave = claveDePeso(test, c.nombre, renglon.indicador);
        const suyo = (casos[clave] ??= { alto: 0, medio: 0, bajo: 0, sin: 0 });
        if (renglon.nivel === 3) suyo.alto++;
        else if (renglon.nivel === 2) suyo.medio++;
        else if (renglon.nivel === 1) suyo.bajo++;
        else suyo.sin++;
      }
    }
  }
  return casos;
}

/**
 * El velocímetro: dónde corta cada indicador y cuánto pesa en su competencia.
 *
 * Se llama así por lo que produce, que es la aguja de cada competencia en el
 * informe.
 *
 * Cada indicador cae en una de tres bandas y aporta cien, cincuenta o cero. El
 * puntaje de la competencia es el promedio de esos aportes, cada uno por su
 * peso. Las dos cosas que deciden ese número se editan acá: **dónde corta** cada
 * indicador entre bajo, medio y alto, y **cuánto pesa** frente a los otros.
 *
 * Los pesos son criterio clínico: que la calidad del vínculo valga el doble que
 * el índice de egocentrismo en Habilidad interpersonal es una decisión sobre qué
 * define esa competencia, no una cuenta.
 *
 * Las filas se arman acá y no en el componente porque cada indicador trae su
 * función de nivel, que no viaja al navegador. Lo que viaja es la escala, que
 * es dato: con eso la pantalla escribe las tres bandas y deja mover sus
 * números.
 */
export default async function Ponderaciones() {
  const rige = await loQueRige();
  const movidos = rige.pesos;
  const cortes = rige.cortesCompetencias;
  const direcciones = rige.direcciones;
  const casos = await casosPorIndicador(rige);

  const hojas: Hoja[] = Object.entries(HOJAS).map(([test, hoja]) => ({
    test,
    competencias: hoja.map((c) => ({
      nombre: c.competencia,
      mide: c.mide,
      indicadores: c.indicadores.map((i) => {
        const clave = claveDePeso(test, c.competencia, i.nombre);
        return {
          clave,
          nombre: i.nombre,
          mide: i.mide,
          // La escala con la dirección que rige, que puede no ser la del
          // código: hacia dónde es mejor se elige por indicador.
          escala: i.escala ? conDireccion(i.escala, direcciones[clave]) : null,
          // La del código, para poder decir que se invirtió.
          escalaFabrica: i.escala ?? null,
          reglas: i.reglas ? [...i.reglas] : null,
          formula: i.formula,
          cortes: i.escala ? (cortes[clave] ?? numerosDe(i.escala)) : [],
          cortesFabrica: i.escala ? numerosDe(i.escala) : [],
          peso: movidos[clave] ?? PESOS_DE_FABRICA[clave],
          fabrica: PESOS_DE_FABRICA[clave],
          casos: casos[clave] ?? { alto: 0, medio: 0, bajo: 0, sin: 0 },
        };
      }),
    })),
  }));

  return (
    <Pesos
      hojas={hojas}
      tocado={Object.keys(movidos).length > 0}
      cortesTocados={Object.keys(cortes).length > 0 || Object.keys(direcciones).length > 0}
    />
  );
}
