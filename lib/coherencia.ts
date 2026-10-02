/**
 * Lo que la psicóloga tiene que mirar antes de firmar.
 *
 * El sistema no interpreta: elige textos ya escritos según los índices. Eso
 * hace que dos lecturas de la misma persona puedan decir cosas opuestas, o que
 * el nivel de ajuste que eligió quien firma vaya por un lado y los puntajes por
 * otro, sin que nada lo marque. El cliente lo lee entero y se encuentra con la
 * contradicción.
 *
 * Esto no corrige nada ni escribe nada en el informe: **avisa**. Quien firma
 * decide qué lectura queda, cuál saca de la lista, o cómo lo explica en la
 * fundamentación, que es el único texto del informe que integra.
 *
 * Son tres chequeos:
 *
 * 1. **El nivel de ajuste contra los puntajes y el potencial.** Es lo que pesa
 *    en la decisión del cliente, y la primera hoja no puede decir lo contrario
 *    de lo que dicen las siguientes.
 * 2. **Pares de lecturas que se contradicen.** Cada par está escrito acá con
 *    por qué choca.
 * 3. **El Rorschach contra el cuadrante del Benziger.** Dos técnicas que
 *    describen a la misma persona de maneras opuestas.
 *
 * Las tablas son un borrador armado el 2/10/2026 mirando los protocolos
 * cargados, para que las psicólogas las corrijan: un par que no corresponde se
 * borra, uno que falta se agrega.
 */

import type { Lectura } from '@/lib/redacciones';
import type { Perfil } from '@/lib/perfiles';
import { INFO } from '@/lib/perfiles';

export type Aviso = {
  tipo: 'nivel' | 'lecturas' | 'benziger' | 'perfil';
  /** Qué choca, dicho para quien firma. */
  texto: string;
};

/** Dos lecturas que no pueden afirmarse juntas sin explicarlo. */
const PARES: { a: string; b: string; por: string }[] = [
  {
    a: 'lambda-bajo',
    b: 'zd-bajo',
    por: 'una dice que capta todo sin discriminar y la otra que rastrea poco y decide con pocos datos',
  },
  {
    a: 'zd-alto',
    b: 'dqv-alto',
    por: 'una dice que examina la información de más y la otra que avanza sin detenerse a elaborar',
  },
  {
    a: 'zd-alto',
    b: 'zf-bajo',
    por: 'una dice que analiza de manera muy meticulosa y la otra que hace pocos esfuerzos por procesar los datos',
  },
  {
    a: 'eb-introversivo',
    b: 'zd-bajo',
    por: 'una dice que espera a considerar todas las alternativas y la otra que hace un rastreo apresurado',
  },
  {
    a: 'eb-introversivo',
    b: 'dqv-alto',
    por: 'una dice que espera a considerar todas las alternativas y la otra que avanza sin elaborar',
  },
  {
    a: 'ego-bajo',
    b: 'reflejos-presentes',
    por: 'una describe una imagen desvalorizada de sí y la otra una necesidad de confirmación propia del autocentramiento',
  },
  {
    a: 'p-alto',
    b: 'xu-alto',
    por: 'una dice que se esfuerza por satisfacer lo que los demás esperan y la otra que es reticente a sumarse a las visiones convencionales',
  },
  {
    a: 'cop-alto-ag-bajo',
    b: 'aislamiento-muy-alto',
    por: 'una dice que entiende la actividad interpersonal como parte importante de su día y la otra que logra apenas contactos significativos',
  },
  {
    a: 'humanos-alto',
    b: 'aislamiento-muy-alto',
    por: 'una dice que tiene marcado interés por los demás y la otra que logra apenas contactos significativos',
  },
  {
    a: 'adjd-positivo',
    b: 'ea-bajo',
    por: 'una dice que tiene recursos de control fuera de lo común y la otra que sus recursos de afrontamiento son limitados',
  },
];

/**
 * Lecturas del Rorschach que describen lo opuesto de cada cuadrante.
 *
 * El "por" dice qué afirma el Benziger de ese cuadrante, con la misma fuente
 * que el texto del informe (`lib/benziger-textos.ts`).
 */
const CONTRA_CUADRANTE: Record<Perfil, { clave: string; por: string }[]> = {
  BI: [
    { clave: 'xu-alto', por: 'el basal izquierdo busca pautas y cumple normas, y esta lectura dice que se resiste a lo convencional' },
    { clave: 'p-bajo', por: 'el basal izquierdo se apoya en lo establecido, y esta lectura dice que mira las situaciones distinto a la mayoría' },
    { clave: 'dqv-alto', por: 'el basal izquierdo trabaja de manera metódica, y esta lectura dice que avanza sin detenerse a elaborar' },
    { clave: 'zd-bajo', por: 'el basal izquierdo es minucioso, y esta lectura dice que examina el entorno de manera poco cuidadosa' },
    { clave: 'c-pura-alta', por: 'el basal izquierdo prefiere lo previsible, y esta lectura dice que disfruta de las situaciones vertiginosas' },
  ],
  FI: [
    { clave: 'eb-extratensivo', por: 'el frontal izquierdo decide por lógica y sin carga emocional, y esta lectura dice que mezcla los sentimientos con sus decisiones' },
    { clave: 'afr-alto', por: 'el frontal izquierdo deja la emoción afuera de la decisión, y esta lectura dice que las situaciones con carga emocional lo estimulan' },
    { clave: 'zf-bajo', por: 'el frontal izquierdo analiza y pondera variables, y esta lectura dice que hace pocos esfuerzos por procesar los datos' },
  ],
  FD: [
    { clave: 'dd-alto', por: 'el frontal derecho ve el panorama completo, y esta lectura dice que se fija en lo poco relevante y pierde la visión de conjunto' },
    { clave: 'w-bajo', por: 'el frontal derecho ve el panorama completo, y esta lectura dice que le cuesta armar una visión global' },
    { clave: 's-alto', por: 'el frontal derecho busca el cambio y lo nuevo, y esta lectura dice que le cuesta cambiar de opinión' },
    { clave: 'a-p-pasivo-triple', por: 'el frontal derecho busca el cambio y lo nuevo, y esta lectura dice que tiende a oponerse a los cambios' },
    { clave: 'a-p-pasivo-cuadruple', por: 'el frontal derecho busca el cambio y lo nuevo, y esta lectura dice que se aferra a sus pensamientos' },
  ],
  BD: [
    { clave: 'sumt-cero', por: 'el basal derecho se orienta a las personas y a los vínculos, y esta lectura dice que es distante y evita la cercanía' },
    { clave: 'aislamiento-muy-alto', por: 'el basal derecho se orienta a las personas, y esta lectura dice que logra apenas contactos significativos' },
    { clave: 'cop-cero-ag-bajo', por: 'el basal derecho se orienta a las personas, y esta lectura dice que no muestra interés en las situaciones interpersonales' },
    { clave: 'phr-mayor-que-ghr', por: 'el basal derecho genera confianza y armonía, y esta lectura dice que sus herramientas interpersonales no alcanzan' },
    { clave: 'afr-bajo', por: 'el basal derecho se mueve en lo emocional, y esta lectura dice que prefiere no implicarse en situaciones con carga emocional' },
  ],
};

/** El índice con su valor, como sale en el sello del informe. */
const cita = (l: Lectura) => (/[a-zA-Z]/.test(l.valor) ? l.valor : `${l.indice} ${l.valor}`);

export function revisar(datos: {
  /** La clave del nivel que eligió la evaluadora, o null si no eligió. */
  nivel: 'alto' | 'desarrollar' | 'alertas' | 'bajo' | null;
  /** Las competencias con puntaje en banda Bajo, por nombre. */
  bajas: string[];
  /** Cuántas competencias tienen puntaje. */
  conPuntaje: number;
  /** Negativo si el puesto pide más de lo que la persona maneja hoy; null sin los dos datos. */
  alcanza: number | null;
  lecturas: Lectura[];
  /** El cuadrante predominante del Benziger, o null. */
  cuadrante: Perfil | null;
}): Aviso[] {
  const avisos: Aviso[] = [];
  const { nivel, bajas } = datos;

  // ── 1. El nivel contra los puntajes y el potencial ─────────────────────
  const lista = (xs: string[]) =>
    xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
  if (nivel === 'alto' && bajas.length > 0) {
    avisos.push({
      tipo: 'nivel',
      texto: `Elegiste "Ajuste alto" y ${bajas.length === 1 ? 'una competencia da' : `${bajas.length} competencias dan`} en Bajo: ${lista(bajas)}.`,
    });
  }
  if (nivel === 'desarrollar' && bajas.length >= 3) {
    avisos.push({
      tipo: 'nivel',
      texto: `Elegiste "Ajuste con aspectos a desarrollar", que dice que no deberían impactar de manera significativa, y ${bajas.length} competencias dan en Bajo: ${lista(bajas)}.`,
    });
  }
  if ((nivel === 'alto' || nivel === 'desarrollar') && datos.alcanza !== null && datos.alcanza < 0) {
    avisos.push({
      tipo: 'nivel',
      texto:
        'El capítulo de potencial dice que el puesto pide más de lo que la persona maneja hoy, y el nivel de ajuste elegido no lo refleja.',
    });
  }
  if ((nivel === 'bajo' || nivel === 'alertas') && datos.conPuntaje > 0 && bajas.length === 0) {
    avisos.push({
      tipo: 'nivel',
      texto: `Elegiste "${nivel === 'bajo' ? 'Ajuste bajo' : 'Ajuste con alertas'}" y ninguna competencia da en Bajo. Si el motivo está en otro lado, conviene que la fundamentación lo diga.`,
    });
  }

  // ── 2. Pares de lecturas que se contradicen ────────────────────────────
  const por = new Map(datos.lecturas.map((l) => [l.clave, l]));
  for (const p of PARES) {
    const a = por.get(p.a);
    const b = por.get(p.b);
    if (a && b) {
      avisos.push({
        tipo: 'lecturas',
        texto: `${cita(a)} y ${cita(b)} se contradicen: ${p.por}.`,
      });
    }
  }

  // ── 3. El Rorschach contra el Benziger ────────────────────────────────
  if (datos.cuadrante) {
    for (const c of CONTRA_CUADRANTE[datos.cuadrante]) {
      const l = por.get(c.clave);
      if (l) {
        avisos.push({
          tipo: 'benziger',
          texto: `Benziger ${INFO[datos.cuadrante].nombre.toLowerCase()} contra ${cita(l)}: ${c.por}.`,
        });
      }
    }
  }

  return avisos;
}
