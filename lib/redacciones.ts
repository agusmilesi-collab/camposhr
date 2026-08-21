/**
 * Traduce los índices del Rorschach a lenguaje llano, con su recomendación.
 *
 * Las redacciones salen de `Redacciones códigos Rorschach.docx.md`, el
 * diccionario del método: para cada índice fuera de banda dice qué significa
 * para el trabajo y qué se recomienda hacer. Acá se aplican las reglas sobre el
 * sumario de cada persona, así que la recomendación no la escribe el motor: la
 * escribe el instrumento y el motor la selecciona.
 *
 * Es el port a TypeScript de `redacciones.py`, que venía generando los informes
 * de mapeo. Se portó tal cual: los textos son los que validó la psicóloga.
 *
 * Tres cosas que el diccionario pide expresamente y se respetan:
 *
 *   · Zf bajo no se informa cuando el Raven también dio bajo, porque entonces
 *     el motivo probable es la capacidad y no la motivación.
 *   · De DQv alto se informa la conducta observable y se omite la atribución a
 *     limitaciones intelectuales, que el diccionario marca como no publicable.
 *   · Y alto y Afr fuera de banda no llevan recomendación, así que entran solo
 *     como lectura.
 *
 * Las constelaciones quedan afuera enteras. Su contenido corresponde a la
 * devolución individual con la psicóloga y no entra en un documento de gestión.
 */

export type Lectura = {
  area: string;
  indice: string;
  valor: string;
  dice: string;
  recomienda: string;
};

/** El sumario tal como lo deja el motor Exner, sección por sección. */
export type SumarioCrudo = Record<string, Record<string, unknown>>;

// Bandas del diccionario. Donde el instrumento y el baremo difieren, manda el
// instrumento, porque es el que sostiene la redacción.
const LAMBDA_BANDA: [number, number] = [0.3, 0.8];
const ZD_BANDA = 3.0;
const AFR_BANDA: Record<string, [number, number]> = {
  Introversivo: [0.53, 0.78],
  Ambigual: [0.53, 0.83],
  Extratensivo: [0.6, 0.89],
};

/** Un número del sumario, buscado en las secciones donde puede estar. */
function n(s: SumarioCrudo, seccion: string, clave: string, respaldo = 0): number {
  const v = s[seccion]?.[clave];
  return typeof v === 'number' && Number.isFinite(v) ? v : respaldo;
}

function texto(s: SumarioCrudo, seccion: string, clave: string, respaldo = ''): string {
  const v = s[seccion]?.[clave];
  return typeof v === 'string' ? v : respaldo;
}

/** Decimales con coma, como se escriben en castellano. */
function dec(v: number, d = 2): string {
  return v.toFixed(d).replace('.', ',');
}

function conSigno(v: number, d = 2): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d).replace('.', ',')}`;
}

/** D y AdjD siempre con signo, y con el menos tipográfico. */
function dd(d: number, adjd: number): string {
  return `D ${conSigno(d, 0)} · AdjD ${conSigno(adjd, 0)}`;
}

/** Populares esperadas según la cantidad de respuestas del protocolo. */
function pEsperado(r: number): [number, number] {
  if (r < 17) return [4, 6];
  if (r <= 28) return [5, 7];
  return [6, 9];
}

/** Contenidos humanos esperados, por cantidad de respuestas y estilo. */
function hEsperado(r: number, estilo: string): [number, number] {
  if (r < 17) return estilo === 'Introversivo' ? [4, 6] : [2, 4];
  if (r <= 27) {
    if (estilo === 'Introversivo') return [5, 8];
    if (estilo === 'Ambigual') return [4, 7];
    return [3, 6];
  }
  if (estilo === 'Introversivo') return [7, 11];
  if (estilo === 'Ambigual') return [5, 9];
  return [4, 7];
}

/**
 * Devuelve las lecturas que aplican, en el orden del diccionario.
 *
 * Cada lectura trae el índice que la dispara, qué dice y qué se recomienda.
 * Cuando el diccionario no fija recomendación, el campo queda vacío y la
 * lectura entra igual, porque describe cómo trabaja la persona.
 */
export function leer(s: SumarioCrudo, ravenRango: string): Lectura[] {
  const salida: Lectura[] = [];
  const sumar = (area: string, indice: string, valor: string, dice: string, recomienda = '') => {
    salida.push({ area, indice, valor, dice, recomienda });
  };

  const r = n(s, 'cabecera', 'R');
  const estilo = texto(s, 'control_estres', 'estilo', 'Ambigual');
  const ravenBajo = ravenRango.startsWith('Rango IV') || ravenRango.startsWith('Rango V');

  // ── Cómo procesa la información ────────────────────────────────────────────
  const lam = n(s, 'cabecera', 'Lambda');
  if (lam < LAMBDA_BANDA[0]) {
    sumar(
      'Cómo procesa la información',
      'Lambda',
      dec(lam),
      'Intenta captar todo, sin discriminar entre información relevante y accesoria. No se le escapa nada, y corre el riesgo de llenarse de datos que no sirven para resolver el problema, lo que puede hacer caer su eficacia.',
      'Ayudarlo a separar la información relevante de la accesoria, para que cuando tenga que resolver algo rápido pueda hacerlo sin impulsividad.'
    );
  } else if (lam > LAMBDA_BANDA[1]) {
    sumar(
      'Cómo procesa la información',
      'Lambda',
      dec(lam),
      'Simplifica sus percepciones más de lo esperado. Con eso evita procesar emociones y que los afectos lo invadan, y puede perder algún dato importante para la tarea.',
      'En situaciones con carga emocional, darle seguimiento para que no pierda datos o información importante.'
    );
  }

  const zd = n(s, 'procesamiento', 'Zd');
  if (zd > ZD_BANDA) {
    sumar(
      'Cómo procesa la información',
      'Zd',
      conSigno(zd, 1),
      'Muy meticuloso en el análisis de la información: dedica más esfuerzo y energía que la mayoría a rastrear y explorar datos, por temor a equivocarse. Bajo presión externa, eso puede hacer fallar la toma de decisiones.',
      'Dar indicaciones claras y concretas para ayudarlo a enfocar en lo importante, y mostrarse abierto a consultas para calmar su temor a cometer errores, sobre todo al decidir.'
    );
  } else if (zd < -ZD_BANDA) {
    sumar(
      'Cómo procesa la información',
      'Zd',
      conSigno(zd, 1),
      'Examina el entorno de manera poco cuidadosa: hace un rastreo apresurado, no llega a recoger datos suficientes y decide antes de que aparezcan todos los puntos clave. Puede cometer más errores por responder antes de procesar toda la información disponible.',
      'Establecer instancias de chequeo o procedimientos que incluyan revisar determinados puntos antes de avanzar o decidir, para que no le falten datos en esas decisiones.'
    );
  }

  // W vive en la sección de localización, que es donde el motor del OS lo deja.
  const w = n(s, 'localizacion', 'global', n(s, 'procesamiento', 'W'));
  const dLoc = n(s, 'procesamiento', 'D', n(s, 'localizacion', 'D'));
  const ddLoc = n(s, 'procesamiento', 'Dd', n(s, 'localizacion', 'Dd'));
  const totalLoc = w + dLoc + ddLoc;
  if (totalLoc) {
    const wPct = w / totalLoc;
    const ddPct = ddLoc / totalLoc;
    if (wPct < 0.3 && dLoc) {
      sumar(
        'Cómo procesa la información',
        'W',
        `W:D:Dd ${w}:${dLoc}:${ddLoc}`,
        'Puede necesitar ayuda para armar una visión global de las situaciones, con tendencia a centrarse en los detalles.',
        'Darle información de contexto para ayudarlo a generar mayor visión de conjunto.'
      );
    } else if (wPct > 0.5) {
      sumar(
        'Cómo procesa la información',
        'W',
        `W:D:Dd ${w}:${dLoc}:${ddLoc}`,
        'Intenta abarcarlo todo y consigue tener visión global de las situaciones.'
      );
    }
    if (ddPct > 0.15) {
      sumar(
        'Cómo procesa la información',
        'Dd',
        `Dd ${ddLoc}`,
        'Revisa de manera minuciosa para evitar errores, y al fijarse en aspectos poco relevantes pierde la visión de conjunto: se fija en lo que la mayoría no mira y deja de lado datos obvios.',
        'Ayudarlo a priorizar los aspectos centrales de la tarea, para que no se detenga en detalles poco relevantes.'
      );
    }
  }

  const dqv = n(s, 'procesamiento', 'DQv', n(s, 'localizacion', 'DQv'));
  if (dqv > 2) {
    // El diccionario marca la atribución causal como no publicable: acá va la
    // conducta observable y la recomendación, sin el porqué.
    sumar(
      'Cómo procesa la información',
      'DQv',
      `DQv ${dqv}`,
      'Aparece un modo de resolver poco reflexivo: puede avanzar sin detenerse a elaborar.',
      'Pedirle que comparta su razonamiento antes de avanzar con una decisión, para chequear criterios sobre todo al principio.'
    );
  }

  const psv = n(s, 'procesamiento', 'PSV');
  if (psv > 2) {
    sumar(
      'Cómo procesa la información',
      'PSV',
      `PSV ${psv}`,
      'Las preocupaciones pueden interferir en su proceso cognitivo, y eso se nota en el día a día como cierta rigidez para flexibilizarse.',
      'Acompañarlo en los cambios, no dejarlo solo, y darle información y datos concretos para que logre flexibilizar.'
    );
  }

  const zf = n(s, 'procesamiento', 'Zf');
  if (zf < r * 0.3 && !ravenBajo) {
    // El diccionario pide omitir este indicador cuando el Raven dio bajo.
    sumar(
      'Cómo procesa la información',
      'Zf',
      `Zf ${zf}`,
      'Hace pocos esfuerzos por procesar los datos, con menos iniciativa de la esperada para buscar información.',
      'Definir objetivos concretos y hacer seguimiento periódico para sostener su nivel de actividad.'
    );
  } else if (zf > r * 0.55) {
    sumar(
      'Cómo procesa la información',
      'Zf',
      `Zf ${zf}`,
      'Tiene una motivación elevada para procesar información, investigar y buscar datos.'
    );
  }

  const mTotal = n(s, 'determinantes', 'M');
  if (mTotal && w > mTotal * 2.5) {
    sumar(
      'Cómo procesa la información',
      'W:M',
      `W:M ${w}:${mTotal}`,
      'Tiende a comprometerse con asignaciones sin revisar antes si cuenta con los recursos para llevarlas adelante en tiempo y forma. Le cuesta decir que no puede o poner un límite.',
      'Antes de asignarle una tarea nueva, ayudarlo a chequear si realmente tiene con qué responder, porque va a tender a aceptar todo.'
    );
  }

  // ── Cómo interpreta lo que ve ──────────────────────────────────────────────
  const xa = n(s, 'calidad_formal', 'XA_pct');
  const wda = n(s, 'calidad_formal', 'WDA_pct');
  if (xa < 0.8 && wda >= 0.8) {
    sumar(
      'Cómo interpreta lo que ve',
      'XA% / WDA%',
      `XA ${dec(xa)} · WDA ${dec(wda)}`,
      'Su percepción es apropiada en las situaciones obvias, y puede no serlo en otras circunstancias.',
      'En situaciones complejas, ayudarlo a validar su interpretación antes de avanzar.'
    );
  } else if (xa < 0.8) {
    sumar(
      'Cómo interpreta lo que ve',
      'XA%',
      `XA ${dec(xa)}`,
      'Es poco convencional en sus percepciones: en buena parte de las ocasiones no va a ver las cosas como las ve la mayoría, sino de un modo más personal.',
      'Chequear que el mensaje que se le quiere transmitir se entienda, por ejemplo preguntándole qué entendió de lo que se le pidió.'
    );
  }

  const xMenos = n(s, 'calidad_formal', 'X_menos_pct');
  if (xMenos > 0.25) {
    sumar(
      'Cómo interpreta lo que ve',
      'X−%',
      `X− ${dec(xMenos)}`,
      'Aparece un apartamiento de lo convencional que puede aumentar el comportamiento desajustado frente a lo que la situación exige, y con eso las dificultades de comunicación con el entorno.',
      'Conviene considerar si lo que el puesto necesita se sostiene con este nivel de interpretación de los datos, porque puede traer roce con otros y caída de productividad.'
    );
  }

  const xu = n(s, 'calidad_formal', 'Xu_pct');
  if (xu > 0.2) {
    sumar(
      'Cómo interpreta lo que ve',
      'Xu%',
      `Xu ${dec(xu)}`,
      'Marcada tendencia a ver las cosas desde su propio punto de vista, con reticencia a sumarse a visiones más convencionales. Si el entorno no lo presiona a ajustarse, no es relevante; si hay exigencia fuerte de ajustarse a lo ya definido, el riesgo de conflicto sube.',
      'Marcarle qué cosas se hacen de una manera establecida y sin modificaciones por más que las vea distinto, y dónde sí puede poner su impronta.'
    );
  }

  const p = n(s, 'procesamiento', 'P', n(s, 'calidad_formal', 'P'));
  const [pMin, pMax] = pEsperado(r);
  if (p < pMin) {
    sumar(
      'Cómo interpreta lo que ve',
      'P',
      `P ${p}`,
      'Tiene una mirada de las situaciones distinta a la de la mayoría de su entorno. Es alguien singular que, sin violar la realidad, prefiere manejarla de forma menos convencional.',
      'Marcarle qué cosas se necesitan hacer de una manera determinada, y dónde puede ser original.'
    );
  } else if (p > pMax) {
    sumar(
      'Cómo interpreta lo que ve',
      'P',
      `P ${p}`,
      'Se esfuerza por satisfacer las expectativas que cree que los demás tienen sobre él.',
      'Ayudarlo a clarificar expectativas reales y criterios de desempeño, para que no opere desde supuestos sino desde acuerdos concretos.'
    );
  }

  // ── Cómo decide y cómo piensa ──────────────────────────────────────────────
  const eb = texto(s, 'control_estres', 'EB');
  if (estilo === 'Introversivo') {
    sumar(
      'Cómo decide y cómo piensa',
      'EB',
      `${eb} · introversivo`,
      'Prefiere la reflexión para resolver problemas: espera a considerar todas las alternativas antes de decidir, no procesa emoción mientras busca soluciones, y se apoya fuerte en su propia evaluación interna para elaborar juicios.'
    );
  } else if (estilo === 'Extratensivo') {
    sumar(
      'Cómo decide y cómo piensa',
      'EB',
      `${eb} · extratensivo`,
      'Mezcla los sentimientos con sus decisiones. El contacto con los demás y el procesamiento de la emoción son prioritarios, y el control de esas descargas queda en segundo plano. Usa el ensayo y el error.',
      'Al decidir o resolver un problema, acompañarlo para que distinga la carga emocional que le provoca la situación, y con ese registro llegue a resoluciones mejores.'
    );
  } else {
    sumar(
      'Cómo decide y cómo piensa',
      'EB',
      `${eb} · ambigual`,
      'A veces resuelve dejando de lado la emoción y centrándose en las ideas, y otras veces sus afectos influyen en la evaluación. Al no tener un estilo definido, la decisión le puede llevar más tiempo y resultar menos previsible.'
    );
  }

  const a = n(s, 'ideacion', 'a');
  const pas = n(s, 'ideacion', 'p');
  if (a && pas >= a * 4) {
    sumar(
      'Cómo decide y cómo piensa',
      'a:p',
      `a:p ${a}:${pas}`,
      'Tiende a aferrarse a sus pensamientos, le cuesta cambiar de punto de vista y aprender pautas nuevas de funcionamiento.',
      'Promover la revisión de sus ideas y la incorporación de otras miradas antes de definir acciones.'
    );
  } else if (a && pas >= a * 3) {
    sumar(
      'Cómo decide y cómo piensa',
      'a:p',
      `a:p ${a}:${pas}`,
      'Tiende a oponerse a los cambios: le cuesta bastante cambiar de punto de vista y aprender pautas nuevas.',
      'Mostrarle información concreta con datos para ayudarlo a ver otro punto de vista.'
    );
  } else if (pas > a + 1) {
    sumar(
      'Cómo decide y cómo piensa',
      'a:p',
      `a:p ${a}:${pas}`,
      'Tiende a adoptar un papel pasivo en sus relaciones: puede quedar como receptor de las acciones de los demás y esperar que otros le resuelvan los problemas.',
      'Diseñar un camino de aprendizaje por etapas, para ir generando autonomía paso a paso.'
    );
  }

  const ma = n(s, 'ideacion', 'Ma');
  const mp = n(s, 'ideacion', 'Mp');
  if (mp > ma + 1) {
    sumar(
      'Cómo decide y cómo piensa',
      'Ma:Mp',
      `Ma:Mp ${ma}:${mp}`,
      'Evita la responsabilidad y la toma de decisiones, y recurre a la fantasía para negar los aspectos incómodos de la realidad. Eso conlleva cierta dependencia de que otros resuelvan.',
      'Darle lineamientos claros y promover que asuma de a poco la responsabilidad sobre sus decisiones, evitando resolver por él lo que puede abordar solo.'
    );
  } else if (mp > ma) {
    sumar(
      'Cómo decide y cómo piensa',
      'Ma:Mp',
      `Ma:Mp ${ma}:${mp}`,
      'Tiende a refugiarse en la imaginación para compensar frustraciones. Usado de manera creativa suma; usado para evitar dificultades, reemplaza la búsqueda de soluciones, y se acentúa bajo estrés.',
      'Ayudarlo a enfocar las situaciones en acciones concretas, sobre todo en los momentos de mayor exigencia.'
    );
  }

  const intel = n(s, 'ideacion', 'Intelectualizacion');
  if (intel > 5) {
    sumar(
      'Cómo decide y cómo piensa',
      'Intelectualización',
      `2AB+(Art+Ay) ${intel}`,
      'Procesa las emociones como si fueran pensamientos. Con eso neutraliza su efecto, y a la vez tiende a distorsionar las situaciones, con lo cual las soluciones pierden eficacia. Se vuelve más vulnerable cuando la situación sube de intensidad.',
      'Ayudarlo con el registro de sus emociones, y darle lugar para procesarlas y encontrar respuestas más eficientes.'
    );
  }

  const mMenos = n(s, 'ideacion', 'M_menos');
  if (mMenos > 1) {
    sumar(
      'Cómo decide y cómo piensa',
      'M−',
      `M− ${mMenos}`,
      'Aparece cierta probabilidad de dificultades en la calidad de sus ideas.'
    );
  }

  const fm = n(s, 'determinantes', 'FM');
  if (fm === 0) {
    sumar(
      'Cómo decide y cómo piensa',
      'FM',
      'FM 0',
      'Se le dificulta tomar registro de sus propias necesidades.',
      'Puede necesitar ayuda externa para empezar a registrarlas. Un entorno donde se le permita darse prioridad ayuda.'
    );
  } else if (fm > 5) {
    sumar(
      'Cómo decide y cómo piensa',
      'FM',
      `FM ${fm}`,
      'Está con el malestar interno elevado por sus propias necesidades, y eso se manifiesta como tensión: puede afectar la atención, la concentración y el sueño.',
      'Ayudarlo a ordenar prioridades cuando se incrementa la carga de trabajo.'
    );
  }

  const m = n(s, 'determinantes', 'm');
  if (m > 2) {
    sumar(
      'Cómo decide y cómo piensa',
      'm',
      `m ${m}`,
      'Hay circunstancias externas que le están causando molestias importantes: está atravesando una situación estresante.',
      'Generar un espacio de charla para consultarle si necesita algo de la empresa o de su jefe para trabajar más tranquilo.'
    );
  }

  // ── Cómo maneja lo que siente ──────────────────────────────────────────────
  const fc = n(s, 'afectos', 'FC');
  const cfd = n(s, 'afectos', 'CF');
  const cpuro = n(s, 'afectos', 'C_puro');
  const descarga = cfd + cpuro;
  if (descarga === 0 || (descarga && fc > descarga * 3)) {
    sumar(
      'Cómo maneja lo que siente',
      'FC:CF+C',
      `${fc}:${descarga}`,
      'Controla sus descargas más de lo esperado: casi nunca se relaja cuando maneja emociones, porque desconfía de cualquier expresión abierta del afecto. Le cuesta expresar lo que siente con libertad.'
    );
  } else if (descarga > fc) {
    if (descarga - fc > 2) {
      sumar(
        'Cómo maneja lo que siente',
        'FC:CF+C',
        `${fc}:${descarga}`,
        'Tiende a expresarse de manera intensa, y eso da impresión de impulsividad por la dificultad de control emocional.'
      );
    } else {
      sumar(
        'Cómo maneja lo que siente',
        'FC:CF+C',
        `${fc}:${descarga}`,
        'Expresa sus afectos sin filtro, de manera más espontánea que el adulto medio. No se esfuerza por controlar sus emociones en el mismo grado que la mayoría, sin que eso implique un problema serio de control.',
        'Mostrarle, sobre todo al principio, los filtros que se esperan y qué información se mantiene reservada.'
      );
    }
  }

  if (cpuro > 1) {
    sumar(
      'Cómo maneja lo que siente',
      'C pura',
      `C pura ${cpuro}`,
      'Disfruta de las situaciones vertiginosas, y en ellas es más propenso a desplegar conductas poco reflexivas.',
      'Mostrarle los límites que se esperan incluso en las situaciones más caóticas.'
    );
  }

  const afr = n(s, 'afectos', 'Afr');
  const bandaAfr = AFR_BANDA[estilo] ?? [0.53, 0.83];
  if (afr < bandaAfr[0]) {
    sumar(
      'Cómo maneja lo que siente',
      'Afr',
      dec(afr),
      'Prefiere no verse implicado en situaciones con carga emocional. Esa misma tendencia neutraliza los problemas de descontrol, si los hubiera.'
    );
  } else if (afr > bandaAfr[1]) {
    sumar(
      'Cómo maneja lo que siente',
      'Afr',
      dec(afr),
      'Las situaciones con carga emocional lo estimulan, y puede sentirse más productivo en ellas.'
    );
  }

  const sBlanco = n(s, 'afectos', 'S', n(s, 'localizacion', 'S'));
  if (sBlanco > 4) {
    sumar(
      'Cómo maneja lo que siente',
      'S',
      `S ${sBlanco}`,
      'Actitud de oposición hacia el entorno, difícil de modificar.',
      'Para que pueda flexibilizarla, evitar la confrontación directa y marcar límites claros y consistentes.'
    );
  } else if (sBlanco > 2) {
    sumar(
      'Cómo maneja lo que siente',
      'S',
      `S ${sBlanco}`,
      'Le cuesta cambiar de opinión.',
      'Ayudarlo a ver los otros puntos de vista mostrándole información concreta.'
    );
  }

  const cPrima = n(s, 'afectos', 'SumC_prima', n(s, 'determinantes', 'SumC_prima'));
  if (cPrima > 4) {
    sumar(
      'Cómo maneja lo que siente',
      "C'",
      `C' ${cPrima}`,
      'Está conteniendo una irritación interna fuerte, que puede tardar bastante en bajar.',
      'Generar un espacio de conversación donde se le consulte si necesita algo de la empresa o de su jefe para trabajar más tranquilo.'
    );
  }

  const sumt = n(s, 'interpersonal', 'SumT', n(s, 'determinantes', 'T'));
  if (sumt === 0) {
    sumar(
      'Cómo maneja lo que siente',
      'SumT',
      'SumT 0',
      'Es distante en el contacto con los demás: no se siente cómodo en las situaciones de cercanía emocional y tiende a evitarlas. Cuida mantener una distancia de seguridad.',
      'Ver cuánta cercanía emocional pide el puesto. Conviene no forzarla y respetar la distancia que prefiere, dejando una vía por la cual pueda pedir apoyo cuando lo necesite.'
    );
  } else if (sumt > 1) {
    sumar(
      'Cómo maneja lo que siente',
      'SumT',
      `SumT ${sumt}`,
      'Necesita más cercanía y contacto que lo habitual: tiende a sentirse más solo y a depender de la presencia afectiva de otros.',
      'Adoptar un estilo de conducción cercano, que le dé contención.'
    );
  }

  const sumv = n(s, 'autopercepcion', 'SumV', n(s, 'determinantes', 'V'));
  if (sumv > 0) {
    sumar(
      'Cómo maneja lo que siente',
      'V',
      `V ${sumv}`,
      'Cuando se autoevalúa lo hace de manera severa: pocas veces está conforme con su propio desempeño, y se exige mucho.',
      'Evitar sumarle exigencia externa, porque ya se exige por dentro.'
    );
  }

  const sumy = n(s, 'determinantes', 'SumY', n(s, 'determinantes', 'Y'));
  if (sumy > 1) {
    sumar(
      'Cómo maneja lo que siente',
      'Y',
      `Y ${sumy}`,
      'Está atravesando una situación que le genera tensión y frente a la cual se siente inundado. Buena parte de ese malestar es reactivo y va a ceder si se resuelven las circunstancias que lo provocan.'
    );
  }

  // ── Cómo se ve a sí mismo ──────────────────────────────────────────────────
  const ego = n(s, 'autopercepcion', 'Ego');
  if (ego < 0.33) {
    sumar(
      'Cómo se ve a sí mismo',
      'Ego',
      dec(ego),
      'No se toma a sí mismo como foco de atención en el grado suficiente: tiene una imagen desvalorizada de sí y no confía en sus recursos, con lo cual se puede dejar influenciar por los demás.',
      'Alentar y reconocer su desempeño, para fomentar su autoestima.'
    );
  } else if (ego > 0.55) {
    sumar(
      'Cómo se ve a sí mismo',
      'Ego',
      dec(ego),
      'Tiende a centrarse en sí mismo más de lo habitual, dando prioridad a su punto de vista, con dificultad para mirar las cosas desde otra óptica y ponerse en el lugar del otro.',
      'En instancias de negociación puede necesitar asistencia: mostrarle datos que lo ayuden a considerar una visión distinta de la suya.'
    );
  }

  const reflejos = n(s, 'autopercepcion', 'Fr') + n(s, 'autopercepcion', 'rF');
  if (reflejos > 0) {
    sumar(
      'Cómo se ve a sí mismo',
      'Fr+rF',
      `Fr+rF ${reflejos}`,
      'Necesita confirmación continua de su valor.',
      'El reconocimiento de él y de sus resultados funciona como motor de motivación.'
    );
  }

  const anXy = n(s, 'autopercepcion', 'An_plus_Xy');
  if (anXy > 3) {
    sumar(
      'Cómo se ve a sí mismo',
      'An+Xy',
      `An+Xy ${anXy}`,
      'Está más preocupado de lo habitual por su funcionamiento corporal.'
    );
  }

  // ── Cómo se relaciona ──────────────────────────────────────────────────────
  const cop = n(s, 'interpersonal', 'COP');
  const ag = n(s, 'interpersonal', 'AG');
  if (cop === 0 && ag <= 1) {
    sumar(
      'Cómo se relaciona',
      'COP / AG',
      `COP ${cop} · AG ${ag}`,
      'No está especialmente interesado en las situaciones interpersonales, y los demás lo pueden percibir como distante.',
      'En las relaciones su alcance va a ser superficial. Si alguna situación necesita más profundidad, conviene asistirlo.'
    );
  } else if (cop <= 1 && ag === 2) {
    sumar(
      'Cómo se relaciona',
      'COP / AG',
      `COP ${cop} · AG ${ag}`,
      'La agresividad es un componente natural de sus relaciones, y es más propenso a manifestar conductas de ese tipo.'
    );
  } else if (cop <= 2 && ag > 2) {
    sumar(
      'Cómo se relaciona',
      'COP / AG',
      `COP ${cop} · AG ${ag}`,
      'Buena parte de su actividad interpersonal está marcada por actitudes agresivas hacia los demás, como estrategia defensiva frente a un ambiente que vive como hostil.'
    );
  } else if (cop >= 2 && ag <= 1) {
    sumar(
      'Cómo se relaciona',
      'COP / AG',
      `COP ${cop} · AG ${ag}`,
      'Tiende a mantener actitudes socialmente positivas y a ser percibido como alguien agradable. Entiende la actividad interpersonal como parte importante de su día y busca interacciones armoniosas.'
    );
  }

  const ghr = n(s, 'interpersonal', 'GHR');
  const phr = n(s, 'interpersonal', 'PHR');
  if (phr > ghr) {
    sumar(
      'Cómo se relaciona',
      'GHR:PHR',
      `${ghr}:${phr}`,
      'Sus herramientas interpersonales no alcanzan para generar vínculos de buena calidad: el estilo de sus intercambios no es el esperado.'
    );
  }

  const ais = n(s, 'interpersonal', 'Aislamiento');
  if (ais > 0.33) {
    sumar(
      'Cómo se relaciona',
      'Índice de aislamiento',
      dec(ais),
      'Logra apenas contactos significativos.',
      'Al asignarle tareas nuevas, tener presente su preferencia por resolver de manera independiente.'
    );
  } else if (ais > 0.25) {
    sumar(
      'Cómo se relaciona',
      'Índice de aislamiento',
      dec(ais),
      'Está menos implicado de lo habitual en las interacciones, y puede preferir trabajar de manera independiente.',
      'Conviene que la mayoría de sus tareas sean asignaciones individuales.'
    );
  }

  const per = n(s, 'interpersonal', 'PER');
  if (per > 2) {
    sumar(
      'Cómo se relaciona',
      'PER',
      `PER ${per}`,
      'Cuando se siente cuestionado puede reaccionar a la defensiva para justificarse.',
      'Hacerle las consultas y los pedidos de forma concreta, para que no los reciba como un cuestionamiento.'
    );
  }

  const fd = n(s, 'interpersonal', 'Fd');
  if (fd > 0) {
    sumar(
      'Cómo se relaciona',
      'Fd',
      `Fd ${fd}`,
      'Presenta más conductas de dependencia de lo esperable: espera que los demás busquen la solución a los problemas.',
      'Alentar su autonomía paso a paso. Al principio necesita un referente con quien validar sus acciones o ideas.'
    );
  }

  const hPura = n(s, 'autopercepcion', 'H_pura', n(s, 'interpersonal', 'H_pura'));
  const hParen = n(s, 'autopercepcion', 'H_paren');
  const hd = n(s, 'autopercepcion', 'Hd');
  const hdParen = n(s, 'autopercepcion', 'Hd_paren');
  const humanos = hPura + hParen + hd + hdParen;
  const [, hMax] = hEsperado(r, estilo);
  if (humanos > hMax) {
    const extra =
      cop >= 1 ? ' Con la disposición a la cooperación presente, eso se traduce en una actitud solícita.' : '';
    sumar('Cómo se relaciona', 'Contenidos humanos', `H total ${humanos}`, `Marcado interés por los demás.${extra}`);
  }

  const otrosH = hParen + hd + hdParen;
  if (otrosH > hPura) {
    sumar(
      'Cómo se relaciona',
      'H pura',
      `H ${hPura} contra ${otrosH}`,
      'Tiene una visión poco realista de sí mismo y de los demás: le puede costar ver tanto las fortalezas como las debilidades, propias y ajenas.',
      'Cuando se le marque un error, hacerlo con información concreta para que le resulte más fácil registrarlo.'
    );
  }

  // ── Cuánta exigencia sostiene ──────────────────────────────────────────────
  const d = n(s, 'control_estres', 'D');
  const adjd = n(s, 'control_estres', 'AdjD');
  if (adjd === 0 && d === 0) {
    sumar(
      'Cuánta exigencia sostiene',
      'D / AdjD',
      dd(d, adjd),
      'Tolera de manera adecuada las tensiones del día a día. Solo ante un estrés intenso, prolongado o inesperado podrían fallar los controles de manera significativa.'
    );
  } else if (adjd >= 1) {
    sumar(
      'Cuánta exigencia sostiene',
      'D / AdjD',
      dd(d, adjd),
      'Tiene una capacidad de control y de tolerancia al estrés fuera de lo común: cuenta con muchos más recursos de lo esperado para manejar sus tensiones y responder a las demandas.'
    );
  } else if (adjd === -1) {
    sumar(
      'Cuánta exigencia sostiene',
      'D / AdjD',
      dd(d, adjd),
      'Tiene dificultades ante las situaciones nuevas, y funciona mejor en entornos rutinarios y previsibles.',
      'Necesita acompañamiento ante los cambios y ante las situaciones tensionantes en sí mismas.'
    );
  } else {
    sumar(
      'Cuánta exigencia sostiene',
      'D / AdjD',
      dd(d, adjd),
      'Está en estado de sobrecarga: vive con mucha más tensión de la que puede manejar, y como resultado sus respuestas pierden eficiencia. Al ser negativo también el valor ajustado, la sobrecarga está instalada en su funcionamiento y no es solo del momento.',
      'Regular la carga y priorizar tareas, con apoyo para organizar el trabajo y generar pausas, con el fin de bajar la tensión y mejorar la calidad de sus respuestas.'
    );
  }

  const ea = n(s, 'control_estres', 'EA');
  if (ea < 7) {
    sumar('Cuánta exigencia sostiene', 'EA', `EA ${dec(ea)}`, 'Sus recursos de afrontamiento son limitados.');
  } else if (ea > 11 && adjd > 0) {
    sumar('Cuánta exigencia sostiene', 'EA', `EA ${dec(ea)}`, 'Confirma un nivel de control elevado.');
  } else if (ea >= 7 && ea <= 11 && adjd === 0) {
    sumar('Cuánta exigencia sostiene', 'EA', `EA ${dec(ea)}`, 'Confirma una capacidad de control adecuada.');
  }

  if (d < adjd) {
    sumar(
      'Cuánta exigencia sostiene',
      'D contra AdjD',
      dd(d, adjd),
      'Hay tensión situacional: su tolerancia al estrés de hoy está por debajo de la habitual.'
    );
  }

  return salida;
}

/** Agrupa conservando el orden en que las áreas aparecen. */
export function porArea(lecturas: Lectura[]): { area: string; lecturas: Lectura[] }[] {
  const orden: string[] = [];
  const grupos = new Map<string, Lectura[]>();
  for (const l of lecturas) {
    if (!grupos.has(l.area)) {
      orden.push(l.area);
      grupos.set(l.area, []);
    }
    grupos.get(l.area)!.push(l);
  }
  return orden.map((area) => ({ area, lecturas: grupos.get(area)! }));
}

/**
 * Si lo que dice cada lectura suma, está en lo esperado o hay que desarrollarlo.
 *
 * El esqueleto del informe reparte las competencias en tres secciones y la
 * separación no coincide con "tiene recomendación": hay lecturas sin
 * recomendación que describen un problema (GHR:PHR por debajo, M−) y otras que
 * describen una fortaleza (visión global, motivación para procesar).
 *
 * Se resuelve por el texto de la lectura, que es único por regla. Lo que no
 * está en la tabla se toma como esperado, que es el lugar donde una lectura
 * mal clasificada hace menos daño: describe sin recomendar ni destacar.
 */
export type Senal = 'destacada' | 'esperada' | 'desarrollar';

const DESTACADAS = [
  'Intenta abarcarlo todo y consigue',
  'Tiene una motivación elevada para procesar',
  'Tiene una capacidad de control y de tolerancia al estrés fuera de lo común',
  'Confirma un nivel de control elevado',
  'Tiende a mantener actitudes socialmente positivas',
  'Marcado interés por los demás',
  'Las situaciones con carga emocional lo estimulan',
];

const ESPERADAS = [
  'Tolera de manera adecuada las tensiones',
  'Confirma una capacidad de control adecuada',
  'Prefiere la reflexión para resolver problemas',
  'A veces resuelve dejando de lado la emoción',
  'Mezcla los sentimientos con sus decisiones',
  'Prefiere no verse implicado en situaciones con carga emocional',
];

export function senalDe(l: Lectura): Senal {
  if (DESTACADAS.some((t) => l.dice.startsWith(t))) return 'destacada';
  if (ESPERADAS.some((t) => l.dice.startsWith(t))) return 'esperada';
  return 'desarrollar';
}
