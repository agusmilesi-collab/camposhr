/**
 * Capa 3 del playbook: lo que la persona marcó, no sólo su cuadrante.
 *
 * Las quince frases de una placa no dicen todas lo mismo. En Basal Derecho
 * conviven "presto atención al lenguaje corporal" y "me encanta cantar,
 * bailar": son dos personas distintas dentro del mismo cuadrante.
 *
 * Cada cuadrante agrupa sus quince frases en cinco facetas. Una faceta se
 * activa cuando la persona marcó dos o más de sus frases, y agrega una línea a
 * la dimensión que corresponda. Así el playbook se vuelve específico sin
 * escribir un texto por combinación posible.
 */

import type { Perfil, Puntajes } from './perfiles';
import { PERFILES, UMBRAL } from './perfiles';
import type { DimensionId } from './playbook';

export type Faceta = {
  id: string;
  titulo: string;
  /** Índices (0 = A) de las frases de la placa que forman esta faceta. */
  frases: number[];
  /** Qué le agrega a cada dimensión cuando está activa. */
  aporta: Partial<Record<DimensionId, string>>;
};

const L = (letra: string) => letra.charCodeAt(0) - 65;
const idx = (letras: string) => letras.split('').map(L);

export const FACETAS: Record<Perfil, Faceta[]> = {
  BD: [
    {
      id: 'no-verbal',
      titulo: 'Radar no verbal',
      frases: idx('AHO'),
      aporta: {
        comunicar:
          'Marcó que lee el lenguaje corporal: en una videollamada con cámara apagada, o por chat, se pierde la mitad de lo que vos decís.',
      },
    },
    {
      id: 'escucha',
      titulo: 'Escucha y vínculo',
      frases: idx('CEL'),
      aporta: {
        feedback:
          'Marcó que le resulta fácil sentir lo que sienten los demás: la conversación difícil la va a procesar también desde tu estado, no sólo desde tus palabras.',
        motivar: 'Se engancha cuando la tarea implica escuchar o acompañar a otro.',
      },
    },
    {
      id: 'expresion',
      titulo: 'Expresión y entusiasmo',
      frases: idx('FGI'),
      aporta: {
        motivar:
          'Marcó que se destaca generando entusiasmo: usalo para arrancar cosas con el equipo, no lo dejes sólo ejecutando.',
        animo: 'Cuando está bien, contagia. Que se apague es la señal más visible.',
      },
    },
    {
      id: 'armonia',
      titulo: 'Armonía y conflicto',
      frases: idx('MN'),
      aporta: {
        feedback:
          'Marcó que le incomoda el conflicto: si el planteo suena a reproche, va a priorizar cerrar la tensión antes que entender el punto.',
      },
    },
    {
      id: 'sentido',
      titulo: 'Sentido y crecimiento',
      frases: idx('BDJK'),
      aporta: {
        motivar:
          'Marcó que le importa el desarrollo personal y la calidad de la experiencia: una tarea que no le enseña nada la sostiene poco, aunque sea cómoda.',
      },
    },
  ],

  BI: [
    {
      id: 'orden',
      titulo: 'Orden y lugar',
      frases: idx('ADH'),
      aporta: {
        tareas:
          'Marcó que disfruta clasificar y archivar: darle el ordenamiento de algo desprolijo no es castigarlo, es aprovecharlo.',
      },
    },
    {
      id: 'metodo',
      titulo: 'Método y secuencia',
      frases: idx('FIM'),
      aporta: {
        autonomia:
          'Marcó que prefiere guiarse por instrucciones específicas: dale el procedimiento una vez y después no lo supervises.',
      },
    },
    {
      id: 'reglas',
      titulo: 'Reglas y previsibilidad',
      frases: idx('EGJL'),
      aporta: {
        feedback:
          'Marcó que le disgusta la ambigüedad: si el criterio no está explícito, el feedback lo deja peor que antes.',
        comunicar: 'Las excepciones a la regla necesitan explicación, no sólo aviso.',
      },
    },
    {
      id: 'rutina',
      titulo: 'Rutina y planificación',
      frases: idx('KNO'),
      aporta: {
        tareas:
          'Marcó que programa su vida y le molesta desviarse: los cambios de último momento le cuestan más que a otros.',
        autonomia: 'Avisale los cambios de agenda con anticipación, aunque sean menores.',
      },
    },
    {
      id: 'confiable',
      titulo: 'Confiabilidad y detalle',
      frases: idx('BC'),
      aporta: {
        motivar:
          'Marcó que se considera productivo y autodisciplinado: reconocerle el detalle es reconocerle lo que él valora de sí.',
      },
    },
  ],

  FD: [
    {
      id: 'cuadro',
      titulo: 'Cuadro general',
      frases: idx('AH'),
      aporta: {
        tareas:
          'Marcó que se concentra en el cuadro general antes que en el detalle: no le pidas a él el control final de un documento.',
      },
    },
    {
      id: 'innovacion',
      titulo: 'Innovación y síntesis',
      frases: idx('BEGJ'),
      aporta: {
        motivar:
          'Marcó que se destaca sintetizando temas distintos en algo nuevo: dale problemas que crucen áreas, no tareas de una sola.',
      },
    },
    {
      id: 'simultaneo',
      titulo: 'Simultaneidad',
      frases: idx('DF'),
      aporta: {
        tareas:
          'Marcó que prefiere trabajar en varias cosas a la vez y que la rutina lo aburre: un solo frente largo lo apaga.',
        autonomia: 'Poné los hitos de cierre; el arranque no necesita ayuda.',
      },
    },
    {
      id: 'intuicion',
      titulo: 'Intuición',
      frases: idx('KM'),
      aporta: {
        autonomia:
          'Marcó que confía en sus presentimientos: pedile que fundamente después, no antes, o pierde la idea.',
        feedback: 'Si rechazás una intuición suya, explicá con qué dato la estás midiendo.',
      },
    },
    {
      id: 'visual',
      titulo: 'Expresión visual',
      frases: idx('CILNO'),
      aporta: {
        comunicar:
          'Marcó que explica con metáforas e imágenes: si le devolvés todo en texto, la conversación se vuelve unidireccional.',
      },
    },
  ],

  FI: [
    {
      id: 'analisis',
      titulo: 'Análisis y diagnóstico',
      frases: idx('ABCD'),
      aporta: {
        tareas:
          'Marcó que le gusta el pensamiento crítico y resolver problemas de diagnóstico: dale lo que nadie entiende por qué falla.',
      },
    },
    {
      id: 'debate',
      titulo: 'Debate',
      frases: idx('EH'),
      aporta: {
        feedback:
          'Marcó que recarga energías discutiendo: que te discuta el planteo es buena señal, no resistencia.',
        comunicar: 'Bancá el ida y vuelta; cerrar la discusión rápido lo desconecta.',
      },
    },
    {
      id: 'maquinas',
      titulo: 'Máquinas y herramientas',
      frases: idx('F'),
      aporta: {
        tareas: 'Marcó que disfruta entender cómo funcionan las máquinas y reparar cosas.',
      },
    },
    {
      id: 'mando',
      titulo: 'Decisión y mando',
      frases: idx('GKN'),
      aporta: {
        autonomia:
          'Marcó que prefiere tener la responsabilidad final: dale decisiones completas, no partes de una decisión.',
      },
    },
    {
      id: 'resultados',
      titulo: 'Resultados y recursos',
      frases: idx('IJLMO'),
      aporta: {
        motivar:
          'Marcó que evalúa su éxito por el resultado final: mostrale el número que se movió gracias a lo que hizo.',
      },
    },
  ],
};

/** Frases marcadas por cuadrante, tal como quedaron guardadas. */
export type Marcadas = Partial<Record<Perfil, number[]>>;

const MINIMO = 2;

/** Facetas activas de un cuadrante, según lo que marcó la persona. */
export function facetasActivas(perfil: Perfil, marcadas: number[]): Faceta[] {
  return (FACETAS[perfil] ?? []).filter((f) => {
    const cuantas = f.frases.filter((i) => marcadas.includes(i)).length;
    // Una faceta de una sola frase se activa con esa frase.
    return cuantas >= Math.min(MINIMO, f.frases.length);
  });
}

/**
 * Cuadrantes que se leen: el dominante y, si está a tres puntos o menos, el
 * segundo. Pilar es Basal Derecho 12 y Basal Izquierdo 10: sin el segundo, el
 * informe describe media persona.
 */
export const CERCANIA = 3;

export function cuadrantesALeer(totales: Puntajes, dominante: Perfil): Perfil[] {
  const segundo = [...PERFILES]
    .filter((p) => p !== dominante)
    .sort((a, b) => totales[b] - totales[a])[0];
  const cerca = totales[dominante] - totales[segundo] <= CERCANIA;
  return cerca ? [dominante, segundo] : [dominante];
}

/**
 * Lee del detalle guardado qué frases marcó la persona en cada placa.
 * El detalle tiene las ocho placas en orden: escala y frases de cada modo.
 */
const ORDEN_PLACAS: Perfil[] = ['BI', 'BD', 'FD', 'FI'];

export function marcadasDe(detalle: unknown): Marcadas {
  const respuestas = (detalle as { respuestas?: unknown[] })?.respuestas;
  if (!Array.isArray(respuestas)) return {};

  const out: Marcadas = {};
  ORDEN_PLACAS.forEach((perfil, i) => {
    const bloque = respuestas[i * 2 + 1] as { seleccion?: unknown };
    const sel = bloque?.seleccion;
    if (Array.isArray(sel)) {
      out[perfil] = sel.filter((n): n is number => Number.isInteger(n));
    }
  });
  return out;
}

export { UMBRAL };
