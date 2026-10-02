/**
 * Lo que el informe saca del Benziger además del cuadrante predominante.
 *
 * El cuestionario trae más datos que los cuatro totales, y tres tienen corte y
 * lectura en el material oficial, así que el sistema puede usarlos sin
 * interpretar nada: elige un texto ya escrito según el valor.
 *
 * 1. **El entorno en el que rinde**, del nivel de extraversión del adulto (0 a
 *    12). Cortes: M p. 25. Textos: MX pp. 89-92. Va al cliente, en el
 *    capítulo del Benziger: dice si el puesto le ofrece el ritmo y el nivel de
 *    actividad que necesita para rendir, que es parte de si encaja. No va en
 *    la primera hoja porque ahí ya no entra sin pasarse de una carilla.
 * 2. **Su mayor fortaleza y su mayor debilidad**: el modo predominante y el
 *    opuesto en diagonal, cada uno con su banda del perfil adulto (M p. 25) y
 *    las tareas de trabajo que dependen de él (M pp. 43-47 y 55-57). Van al
 *    cliente, en el capítulo del Benziger: el cliente las cruza con lo que el
 *    puesto pide. Si pide sobre todo la debilidad, la persona tiende a irse
 *    (MX p. 99).
 * 3. **Si el perfil adulto puede ser adaptado**: cuántas de las cinco
 *    mediciones encabeza el predominante (M pp. 76-77), y si el nivel de
 *    extraversión cambió desde la adolescencia (M p. 84). Van a quien firma,
 *    en "Revisar antes de firmar": el manual lo plantea como algo a explorar
 *    con la persona, no como un resultado.
 *
 * Quedan afuera los puntos de estrés y el estado emocional. El manual los
 * reserva al profesional y aclara que el test no mide salud mental (M p. 68 y
 * p. 73), y no trae cortes para ninguno de los dos.
 *
 * Los textos están redactados para el trabajo, en tercera persona y sin
 * género. Donde se alejan de la fuente, la fuente lo dice ("adaptado").
 */

import type { Cuatro } from '@/lib/benziger-perfil';
import { estiloDeAlerta, type Estilo } from '@/lib/benziger-perfil';
import { DIAGONAL, INFO, type Perfil } from '@/lib/perfiles';

// ── 1. El entorno en el que rinde ─────────────────────────────────────────

export const ENTORNO: Record<Estilo, { texto: string; fuente: string }> = {
  Extravertido: {
    texto:
      'Rinde mejor en entornos de alto nivel de actividad: varias tareas en simultáneo, contacto frecuente con personas, ritmo de trabajo intenso y situaciones que requieren negociar o resolver urgencias. En puestos de trabajo individual, con poco movimiento o con tareas en solitario, su rendimiento tiende a bajar.',
    fuente: 'MX pp. 89-91. Adaptado',
  },
  Equilibrado: {
    texto:
      'Rinde mejor en entornos de actividad moderada, sin presión excesiva ni aislamiento prolongado. Puede sostener períodos de alta exigencia o de trabajo en solitario si tiene margen para organizar su agenda y compensarlos antes y después.',
    fuente: 'MX p. 92. Adaptado',
  },
  Introvertido: {
    texto:
      'Rinde mejor en entornos de bajo nivel de actividad: trabajo individual, pocas interrupciones, equipos que priorizan la colaboración por sobre la competencia, y tareas de asesoramiento o servicio antes que de venta. En puestos con exposición constante, presión sostenida o negociación frente a varias personas, su rendimiento tiende a bajar.',
    fuente: 'MX pp. 89-92. Adaptado',
  },
};

/** El entorno que le corresponde al nivel de extraversión del adulto. */
export function entornoDe(nivelAdulto: number | null) {
  const estilo = estiloDeAlerta(nivelAdulto);
  return estilo ? { estilo, nivel: nivelAdulto as number, ...ENTORNO[estilo] } : null;
}

// ── 2. Su mayor debilidad ─────────────────────────────────────────────────

/** Las bandas del perfil adulto, de 0 a 140 (M p. 25). */
export function bandaDelModo(puntaje: number): string {
  if (puntaje <= 40) return 'evitado';
  if (puntaje <= 80) return 'moderado';
  if (puntaje <= 100) return 'fuerte';
  return 'comprometido';
}

/**
 * Las tareas de trabajo que dependen de cada modo. Salen de las aptitudes que
 * el manual lista por perfil (M pp. 43-47) y de su tabla de tareas de
 * supervisión y gerencia por modo (M pp. 55-57), sin las que no son laborales.
 * Sirven para las dos lecturas: en el predominante son donde rinde, en su
 * diagonal son las que le cuestan.
 */
export const TAREAS: Record<Perfil, { tareas: string; fuente: string }> = {
  FI: {
    tareas:
      'fijar objetivos y prioridades, analizar problemas y sus causas, evaluar opciones con criterios medibles, decidir cómo usar los recursos, negociar y tomar decisiones complejas',
    fuente: 'M pp. 43-44 y 55. Adaptado',
  },
  BI: {
    tareas:
      'seguir procedimientos establecidos sin errores, cumplir cronogramas y plazos, controlar detalles operativos, llevar registros, inventarios y documentación precisos, y verificar que se respeten normas y procedimientos',
    fuente: 'M pp. 44-45 y 57. Adaptado',
  },
  BD: {
    tareas:
      'construir y sostener relaciones de confianza con clientes y compañeros, atender quejas y reclamos, orientar y acompañar a otras personas, integrar a quienes ingresan, lograr que todos participen en las reuniones y leer la comunicación no verbal',
    fuente: 'M pp. 45-46 y 57. Adaptado',
  },
  FD: {
    tareas:
      'generar ideas y soluciones nuevas, resolver problemas para los que no hay un procedimiento, detectar problemas en situaciones cambiantes, identificar patrones a partir de pocos datos, diseñar productos, sistemas o procesos nuevos y liderar cambios',
    fuente: 'M pp. 46-47 y 57. Adaptado',
  },
};

/** Un modo del perfil adulto con su puntaje, su banda y sus tareas. */
function modo(clave: Perfil, adulto: Cuatro | null) {
  const puntaje = adulto?.[clave] ?? null;
  return {
    clave,
    nombre: INFO[clave].nombre,
    puntaje,
    banda: puntaje === null ? null : bandaDelModo(puntaje),
    ...TAREAS[clave],
  };
}

/** Su mayor fortaleza: el modo predominante. */
export function fortalezaDe(predominante: Perfil, adulto: Cuatro | null) {
  return modo(predominante, adulto);
}

/**
 * Su mayor debilidad: el modo opuesto en diagonal al predominante (MX p. 99,
 * la regla Astuto-Tonto: si el trabajo exige sobre todo ese modo, la persona
 * tiende a dejarlo).
 */
export function debilidadDe(predominante: Perfil, adulto: Cuatro | null) {
  return modo(DIAGONAL[predominante], adulto);
}

// ── 3. Si el perfil adulto puede ser adaptado ─────────────────────────────

/** Las cinco mediciones que el manual cruza para confiar en el resultado (M p. 76). */
export const MEDICIONES = [
  { fila: 'Total joven', nombre: 'adolescencia' },
  { fila: 'Trabajo', nombre: 'trabajo' },
  { fila: 'Tiempo libre', nombre: 'tiempo libre' },
  { fila: 'Autopercepción', nombre: 'percepción de sí' },
  { fila: 'Total adulto', nombre: 'adulto' },
] as const;

const ORDEN: Perfil[] = ['FI', 'FD', 'BI', 'BD'];

/** Los modos que encabezan una medición; dos si empatan. Vacío sin datos. */
function encabezan(v: Cuatro | null): Perfil[] {
  if (!v) return [];
  const conDato = ORDEN.filter((p) => typeof v[p] === 'number');
  if (conDato.length === 0) return [];
  const max = Math.max(...conDato.map((p) => v[p] as number));
  return conDato.filter((p) => v[p] === max);
}

/**
 * Avisos para quien firma. Ninguno sale si faltan datos: sin las cinco
 * mediciones no se puede contar, y sin los dos niveles no hay cambio que ver.
 */
export function adaptacionDe(
  predominante: Perfil | null,
  filas: { titulo: string; valores: Cuatro }[],
  alerta: { adulto: number | null; joven: number | null }
): string[] {
  const avisos: string[] = [];

  if (predominante) {
    const medidas = MEDICIONES.map((m) => ({
      nombre: m.nombre,
      arriba: encabezan(filas.find((f) => f.titulo === m.fila)?.valores ?? null),
    }));
    if (medidas.every((m) => m.arriba.length > 0)) {
      const coincide = medidas.filter((m) => m.arriba.includes(predominante)).length;
      if (coincide < 4) {
        const detalle = medidas
          .map((m) => `${m.nombre} ${m.arriba.map((p) => INFO[p].nombre.toLowerCase()).join(' y ')}`)
          .join(', ');
        avisos.push(
          `El ${INFO[predominante].nombre.toLowerCase()} encabeza ${coincide} de las cinco mediciones del Benziger. El manual pide cuatro o cinco para afirmar que es la preferencia natural; con menos, el perfil adulto puede ser adaptado (M p. 77). Encabeza cada una: ${detalle}.`
        );
      }
    }
  }

  const antes = estiloDeAlerta(alerta.joven);
  const hoy = estiloDeAlerta(alerta.adulto);
  if (antes && hoy && antes !== hoy) {
    const haciaIntroversion = (alerta.adulto as number) < (alerta.joven as number);
    avisos.push(
      `El nivel de extraversión pasó de ${antes.toLowerCase()} (${alerta.joven}) en la adolescencia a ${hoy.toLowerCase()} (${alerta.adulto}) hoy. El manual vincula ese cambio con ${
        haciaIntroversion ? 'un estado de ansiedad crónica' : 'un estado de seguridad crónica'
      } (M p. 84).`
    );
  }

  return avisos;
}
