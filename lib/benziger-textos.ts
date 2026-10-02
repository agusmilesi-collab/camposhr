/**
 * Lo que el informe dice del cuadrante predominante del Benziger.
 *
 * Dos partes, y cada una va a un capítulo distinto. **Cómo es** describe a la
 * persona y sale en el capítulo de estilos de pensamiento: es parte de lo que
 * sostiene la decisión de contratar. **Cómo conducirla** es lo que el líder
 * necesita si la persona entra, y va en el plan de incorporación, que está al
 * final del informe porque es un agregado a la decisión y no parte de ella.
 *
 * **Nada de esto es redacción propia.** Cada texto sale del material oficial y
 * lleva su fuente, que se muestra en Configuración y no en el informe:
 *
 * - M: *Manual del Usuario del BTSA*, 2.ª edición.
 * - MX: *Maximizando la efectividad del potencial humano*, de K. Benziger. Las
 *   pautas para conducir salen casi enteras de sus pp. 278-285, "La
 *   comunicación con los empleados, siendo usted el jefe".
 * - EC: la tabla "Características cerebrales de los cuadrantes del cerebro".
 * - T: "Terminología y definiciones del BTSA".
 *
 * Donde la redacción se aleja de la fuente, la fuente lo dice ("adaptado" o
 * "derivado"). La tabla de citas textuales con su página está fuera del
 * repositorio, porque el material tiene derechos de autor y este repositorio
 * es público.
 *
 * Sale **un solo cuadrante**: el primero que marcó la evaluadora. El manual
 * dice que cada persona tiene una sola preferencia natural, y que un perfil
 * doble es esa preferencia más uno de sus auxiliares (M p. 43).
 *
 * Los textos están en tercera persona y sin género, para que sirvan igual para
 * cualquier candidato.
 */

import type { Perfil } from '@/lib/perfiles';

export type CampoBenziger =
  | 'comoEs'
  | 'motivar'
  | 'devoluciones'
  | 'autonomia'
  | 'comunicacion'
  | 'energia'
  | 'desgaste'
  | 'animo';

export type TextosDeCuadrante = Record<CampoBenziger, string>;

/** Los campos, en el orden en que se leen. `comoEs` es la primera parte; el resto, la segunda. */
export const CAMPOS_BENZIGER: { clave: CampoBenziger; rotulo: string; filas: number }[] = [
  { clave: 'comoEs', rotulo: 'Cómo es', filas: 9 },
  { clave: 'motivar', rotulo: 'Motivación', filas: 3 },
  { clave: 'devoluciones', rotulo: 'Devoluciones', filas: 3 },
  { clave: 'autonomia', rotulo: 'Autonomía', filas: 3 },
  { clave: 'comunicacion', rotulo: 'Comunicación', filas: 3 },
  { clave: 'energia', rotulo: 'Tareas que le dan energía', filas: 3 },
  { clave: 'desgaste', rotulo: 'Tareas que le quitan energía', filas: 3 },
  { clave: 'animo', rotulo: 'Levantarle el ánimo', filas: 3 },
];

/** Los siete de la segunda parte, que arman el manual para el líder. */
export const CAMPOS_DE_CONDUCCION = CAMPOS_BENZIGER.filter((c) => c.clave !== 'comoEs');

export const LARGO_MAXIMO_BENZIGER = 2000;

type Original = { textos: TextosDeCuadrante; fuentes: Record<CampoBenziger, string> };

export const TEXTOS_BENZIGER: Record<Perfil, Original> = {
  FI: {
    textos: {
      comoEs:
        'Piensa de manera lógica y analítica: separa los problemas en sus partes, pondera las variables y llega a decisiones fundadas en datos. Se orienta a metas y resultados, establece prioridades con rapidez y concentra su energía en lo que tiene impacto a largo plazo, dejando de lado lo que considera de bajo rendimiento. Prefiere la información breve y centrada en los puntos clave. Su menor facilidad está en el plano interpersonal y emocional: puede pasar por alto el efecto de su tono en los demás, y tiende a mostrarse crítico ante lo que percibe como ineficiencia o redundancia.',
      motivar:
        'Responde a reconocimientos concretos por un trabajo bien hecho: una retribución específica, más responsabilidad o posibilidades de crecimiento. El elogio afectivo y la pertenencia al grupo pesan menos para esta persona.',
      devoluciones:
        'Conviene que sean breves, directas y basadas en hechos y resultados. Valora la efectividad y le cuesta tolerar lo que percibe como incompetencia o redundancia.',
      autonomia:
        'Funciona mejor con metas específicas y libertad para decidir cómo alcanzarlas. Es esperable que delegue parte de la tarea y que asuma la responsabilidad por el resultado.',
      comunicacion:
        'Transmitirle las instrucciones de manera breve, directa y lógica, destacando los puntos clave y el resultado esperado más que el proceso. Prefiere resúmenes cortos y la discusión de argumentos.',
      energia:
        'Evaluar, analizar, ordenar prioridades y tomar decisiones, incluidas las complejas, con acceso a las herramientas que necesita.',
      desgaste:
        'Las tareas muy repetitivas y las que exigen sostener vínculos interpersonales intensos, como contener o mediar entre personas.',
      animo:
        'Recupera energía cuando puede aplicar su capacidad lógica para evaluar opciones, ordenar prioridades y resolver problemas complejos.',
    },
    fuentes: {
      comoEs: 'M p. 43 · MX p. 156 · EC Contribución y Descriptores · M p. 60 · MX p. 285',
      motivar: 'MX p. 285. Adaptado: el libro dice "dinero, un ascenso, mayor poder"; "poder" pasó a "responsabilidad".',
      devoluciones: 'MX pp. 284-285. Derivado: el libro dice cómo transmitirle información y qué valora; no habla de devoluciones.',
      autonomia: 'MX p. 284',
      comunicacion: 'MX p. 284 · EC Modo de comunicación',
      energia: 'MX pp. 284-285 · EC Aptitudes · M pp. 43-44',
      desgaste: 'MX p. 285. "Contener o mediar" es derivado de M p. 57 (tareas del basal derecho, su diagonal).',
      animo: 'MX p. 309',
    },
  },
  BI: {
    textos: {
      comoEs:
        'Su pensamiento es ordenado y secuencial. Se destaca en las tareas de rutina, en el cumplimiento de procedimientos y en la atención a los detalles, y sostiene un trabajo preciso y confiable a lo largo del tiempo. Cumple plazos, horarios y normas, y prefiere lo concreto e inmediato a lo abstracto. Para decidir busca pautas claras y antecedentes de cómo se resolvió antes. Trabaja a un ritmo metódico, prefiere horarios regulares y no suele ofrecerse para horas extra si no hay un procedimiento que lo establezca. Le cuesta improvisar o salirse de lo establecido, y los cambios que no considera necesarios le generan desgaste.',
      motivar:
        'Valora la aprobación y el reconocimiento por cumplir bien con lo establecido. Aprende mejor cuando lo nuevo tiene una aplicación clara e inmediata y se presenta organizado y por etapas.',
      devoluciones:
        'Necesita saber si hizo lo correcto. Conviene confirmarle de manera explícita cuando una tarea se hizo exactamente como se pidió.',
      autonomia:
        'Rinde mejor con procedimientos claros que con libertad para improvisar. Si hace falta resolver excepciones, conviene definir un procedimiento también para ellas.',
      comunicacion:
        'Instrucciones detalladas, paso a paso y específicas para cada tarea, con los proyectos complejos divididos en etapas. Los plazos, informados con anticipación.',
      energia:
        'Las tareas de rutina y de procedimiento, el seguimiento de cronogramas y el control operativo o administrativo, en un lugar de trabajo ordenado y con horarios previsibles.',
      desgaste:
        'La presión y los apuros, las interrupciones frecuentes, los desvíos de la rutina y las crisis para las que no hay un procedimiento previsto.',
      animo: 'Recupera energía con actividades que puede organizar y resolver siguiendo un procedimiento.',
    },
    fuentes: {
      comoEs: 'M pp. 41-42 y 44 · EC Contribución y Descriptores · MX p. 155 · MX pp. 157-158 · MX p. 279',
      motivar: 'MX p. 278 · M p. 41',
      devoluciones: 'MX pp. 278-279',
      autonomia: 'MX p. 279',
      comunicacion: 'MX pp. 278-279',
      energia: 'EC Aptitudes · MX pp. 278-279',
      desgaste: 'MX pp. 279-280 · M p. 44',
      animo: 'MX p. 308',
    },
  },
  BD: {
    textos: {
      comoEs:
        'Su pensamiento se orienta a las personas y a la armonía de los vínculos. Percibe con facilidad el lenguaje no verbal, los cambios de ánimo y el clima emocional de un grupo, y se interesa por el aspecto humano de cada problema más que por el técnico. Genera confianza, integra a los demás y cuida que todos tengan lugar para expresarse. Para decidir busca la opinión del grupo y tiende a evitar las decisiones que generan conflicto. Le cuesta poner límites, es sensible a las tensiones del entorno y su ritmo de trabajo depende de su estado de ánimo; rara vez trabaja sin interacción durante períodos largos.',
      motivar:
        'Trabaja por el reconocimiento y la pertenencia más que por el dinero o un ascenso. Responde bien a la valoración explícita de su aporte y a las actividades que incluyen a todo el equipo.',
      devoluciones:
        'Conviene darlas en un diálogo en el que se respeten sus opiniones y sentimientos, sin críticas duras. Cuando se distrae de la tarea, es más efectivo volver a ella con suavidad.',
      autonomia:
        'Responde mejor a una conducción cercana y dialogada que a la jerarquía formal, y trabaja mejor en compañía que en soledad.',
      comunicacion:
        'Preguntarle con regularidad, además de qué hizo, cómo se siente con su trabajo. Para sostener los plazos, ayuda mostrarle cómo afectan a otras personas.',
      energia:
        'Las tareas con personas: integrar, enseñar, acompañar, recibir a quienes se incorporan y atender clientes, en un ambiente cálido y con gente con la que se lleve bien.',
      desgaste:
        'Las tareas repetitivas, estadísticas o de análisis, y sobre todo los conflictos interpersonales sin resolver: mientras duran, su productividad baja.',
      animo:
        'Preguntarle qué cambiaría de lo que no le resulta cómodo. Para las tareas que no prefiere, ayuda que pueda hacerlas junto a otra persona.',
    },
    fuentes: {
      comoEs: 'M pp. 42 y 45 · EC Contribución · M p. 60 · T Sensitivo · MX p. 155 · MX p. 158',
      motivar: 'MX pp. 280 y 282',
      devoluciones: 'MX pp. 280-281',
      autonomia:
        'MX p. 280 y p. 158. Derivado: el libro habla de cómo vive la jerarquía y el trabajo en soledad, no de cuánta autonomía darle.',
      comunicacion: 'MX p. 281',
      energia: 'EC Aptitudes · MX p. 280 · M pp. 45-46',
      desgaste: 'MX p. 280',
      animo: 'MX p. 281',
    },
  },
  FD: {
    textos: {
      comoEs:
        'Su pensamiento es creativo e intuitivo: percibe posibilidades, patrones y tendencias que no son evidentes y conecta ideas de campos distintos. Se interesa por los conceptos nuevos, toma riesgos y disfruta de inventar, experimentar y resolver problemas complejos. Decide rápido y por intuición, con frecuencia con acierto, aunque le cuesta justificar sus decisiones con datos. Su menor facilidad está en lo concreto y operativo: tiende a subestimar los tiempos, tiene dificultades con los plazos y la rutina le genera aburrimiento. Necesita cambio y variedad, por lo que puede perder interés cuando un puesto se vuelve repetitivo.',
      motivar:
        'Se compromete cuando entiende para qué sirve su trabajo y ve el panorama completo. Rinde más en la etapa inicial de los proyectos, cuando hay algo por crear.',
      devoluciones:
        'Conviene reconocer primero su aporte creativo y, a partir de ahí, mostrarle cómo su forma de trabajar afecta a los demás.',
      autonomia:
        'Prefiere trabajar con poca supervisión: recibir un problema a resolver y decidir los detalles con su propio criterio.',
      comunicacion:
        'Empezar por la visión general antes que por los detalles. Ayuda pedirle que ponga sus ideas por escrito a medida que surgen.',
      energia:
        'Las tareas creativas, de innovación y de detección de problemas, idealmente con más de un proyecto en paralelo.',
      desgaste:
        'Las tareas repetitivas, el trabajo con detalles y los procesos de rutina, y también intervenir en conflictos entre personas, de los que tiende a apartarse.',
      animo:
        'Recupera energía cuando puede usar su imaginación para crear, proponer una solución nueva o pensar a futuro.',
    },
    fuentes: {
      comoEs: 'M pp. 42 y 46 · EC Contribución · MX p. 156 · MX p. 283 · MX p. 141',
      motivar: 'MX pp. 282-284',
      devoluciones: 'MX p. 283',
      autonomia: 'MX p. 283',
      comunicacion: 'MX pp. 282-284',
      energia: 'MX p. 282',
      desgaste: 'MX pp. 282-283 · M p. 51',
      animo: 'MX p. 309',
    },
  },
};

const CLAVES = CAMPOS_BENZIGER.map((c) => c.clave) as string[];
const PERFILES_VALIDOS = Object.keys(TEXTOS_BENZIGER);

/**
 * Lo guardado desde Configuración, si sirve; null si no.
 *
 * Un campo de la segunda parte se puede dejar vacío a propósito, y entonces ese
 * renglón no sale en el informe: es la forma de sacar una pauta que no se
 * quiere dar sin inventar otra. "Cómo es" no puede quedar vacío, porque sin él
 * el capítulo nombra un cuadrante y no dice nada de la persona.
 */
export function benzigerValidos(
  guardados: unknown
): Record<string, Partial<TextosDeCuadrante>> | null {
  if (!guardados || typeof guardados !== 'object' || Array.isArray(guardados)) return null;
  const limpios: Record<string, Partial<TextosDeCuadrante>> = {};
  for (const [perfil, valor] of Object.entries(guardados as Record<string, unknown>)) {
    if (!PERFILES_VALIDOS.includes(perfil)) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
    const uno: Partial<TextosDeCuadrante> = {};
    for (const [campo, texto] of Object.entries(valor as Record<string, unknown>)) {
      if (!CLAVES.includes(campo)) return null;
      if (typeof texto !== 'string' || texto.length > LARGO_MAXIMO_BENZIGER) return null;
      const limpio = texto.trim();
      if (campo === 'comoEs' && !limpio) return null;
      uno[campo as CampoBenziger] = limpio;
    }
    if (Object.keys(uno).length > 0) limpios[perfil] = uno;
  }
  return limpios;
}

/** Los textos de un cuadrante con lo que rige: lo escrito en Configuración, o el original. */
export function benzigerQueRige(
  perfil: Perfil,
  movidos: Record<string, Partial<TextosDeCuadrante>> = {}
): TextosDeCuadrante {
  return { ...TEXTOS_BENZIGER[perfil].textos, ...(movidos[perfil] ?? {}) };
}
