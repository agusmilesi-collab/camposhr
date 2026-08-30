/**
 * El diagrama de progreso potencial de Elliot Jaques, redibujado.
 *
 * Jaques ordena la capacidad de trabajo por **horizonte temporal**: el lapso de
 * la tarea más larga que la persona puede sostener sin que alguien se lo
 * ordene. Ese horizonte crece con la edad, y crece por caminos regulares: las
 * *bandas de maduración*. Ubicando a alguien por su edad y su horizonte de hoy
 * se ve por cuál de esas bandas viene subiendo, y la banda dice hasta dónde
 * llega y cuándo.
 *
 * Son dos datos de la evaluadora y ninguno lo calcula el sistema: la edad del
 * día de la entrevista y el horizonte que ella le atribuye después de
 * escucharlo. Acá está la geometría que los convierte en un punto del diagrama.
 *
 * ## El eje vertical
 *
 * No es lineal ni logarítmico parejo: es la escalera de horizontes del propio
 * modelo (un día, una semana, un mes, tres meses, …, cincuenta años), con todos
 * sus escalones del mismo alto. Cada estrato son tres escalones, así que el
 * estrato ocupa siempre la misma altura y se lee de un vistazo cuánto falta
 * para el siguiente. Es como está dibujado el original.
 *
 * ## Las curvas
 *
 * **Son un redibujo, no la lámina escaneada.** Cada límite entre dos bandas
 * arranca a los veinte años en un escalón de la escalera y se va acercando al
 * techo de un estrato: el límite entre la primera banda y la segunda termina
 * pegado a los tres meses (techo del estrato I), el siguiente al año (techo del
 * II), el siguiente a los dos años, y así. Esa es la forma que tiene la lámina
 * publicada, y es lo que hace que las bandas de arriba sigan subiendo a los
 * sesenta y cinco mientras las de abajo ya se aplanaron a los cuarenta.
 *
 * La curva es `techo − (techo − arranque) · e^(−k·(edad−20))`, con una `k` por
 * banda calibrada contra la lámina. **Cerca de un límite, la banda es un
 * criterio y no una medición**: el diagrama ubica, no dictamina, y así hay que
 * leerlo cuando el punto cae sobre una raya.
 *
 * Sin `server-only`: lo usan la ficha, donde se cargan los dos datos, y el
 * informe, donde se dibuja.
 */

/** Desde y hasta qué edad se dibuja, como en la lámina. */
export const EDAD_MIN = 20;
export const EDAD_MAX = 65;

/**
 * La escalera de horizontes, de abajo hacia arriba.
 *
 * Los veintidós escalones del modelo. `dias` es lo que mide cada marca y sirve
 * para ubicar un horizonte cualquiera entre dos de ellas; `celda` es el nombre
 * con el que la lámina rotula la franja que termina en esa marca, y que es la
 * subdivisión del estrato: A arriba, M en el medio y B abajo, así que IIIM es
 * la parte del medio del estrato III. El original de Jaques las llama A, B y C;
 * acá se dicen por lo que significan.
 *
 * Cada marca es el **techo** de su franja: la franja IA va de un mes a tres
 * meses, y su rótulo es "3 meses". El piso de la más baja queda fuera de la
 * escala, igual que en la lámina, y por eso esa fila va sin letra.
 */
export const ESCALERA = [
  { dias: 1, texto: '1 día', celda: 'I' },
  { dias: 7, texto: '1 semana', celda: 'IB' },
  { dias: 30, texto: '1 mes', celda: 'IM' },
  { dias: 91, texto: '3 meses', celda: 'IA' },
  { dias: 182, texto: '6 meses', celda: 'IIB' },
  { dias: 273, texto: '9 meses', celda: 'IIM' },
  { dias: 365, texto: '1 año', celda: 'IIA' },
  { dias: 487, texto: '16 meses', celda: 'IIIB' },
  { dias: 608, texto: '20 meses', celda: 'IIIM' },
  { dias: 730, texto: '2 años', celda: 'IIIA' },
  { dias: 1095, texto: '3 años', celda: 'IVB' },
  { dias: 1460, texto: '4 años', celda: 'IVM' },
  { dias: 1825, texto: '5 años', celda: 'IVA' },
  { dias: 2555, texto: '7 años', celda: 'VB' },
  { dias: 3103, texto: '8,5 años', celda: 'VM' },
  { dias: 3650, texto: '10 años', celda: 'VA' },
  { dias: 5110, texto: '14 años', celda: 'VIB' },
  { dias: 6205, texto: '17 años', celda: 'VIM' },
  { dias: 7300, texto: '20 años', celda: 'VIA' },
  { dias: 10950, texto: '30 años', celda: 'VIIB' },
  { dias: 14600, texto: '40 años', celda: 'VIIM' },
  { dias: 18250, texto: '50 años', celda: 'VIIA' },
] as const;

/** El escalón más alto del diagrama: el techo de la franja VIIA. */
export const ALTO = ESCALERA.length - 1;

/**
 * El piso del cuadro.
 *
 * Un escalón por debajo de "1 día", que es donde empieza la franja ID: la
 * lámina la dibuja entera aunque su piso no tenga número.
 */
export const PISO = -1;

/**
 * Los estratos, con sus franjas.
 *
 * `desde` y `hasta` son posiciones de la escalera; el I llega hasta el piso del
 * cuadro (−1) porque tiene cuatro franjas y los demás tres, como en la lámina.
 * `grupo` es el nombre que la lámina pone al costado, que agrupa estratos: los
 * dos primeros son "Operacional" y los dos últimos "Estratégico corporativo". Los cuatro primeros son los
 * que mide el análisis discursivo y llevan el nombre con el que se los escribe
 * en el informe; del quinto para arriba se nombran como en el modelo, porque
 * están por encima del alcance del instrumento y en el informe se dicen como
 * referencia y no como resultado.
 */
export const ESTRATOS = [
  { romano: 'I', desde: -1, hasta: 3, nombre: 'Operativo', mide: true, grupo: 'Operacional' },
  { romano: 'II', desde: 3, hasta: 6, nombre: 'Especialista', mide: true, grupo: 'Operacional' },
  { romano: 'III', desde: 6, hasta: 9, nombre: 'Liderazgo 1', mide: true, grupo: 'Táctico' },
  {
    romano: 'IV',
    desde: 9,
    hasta: 12,
    nombre: 'Liderazgo 2',
    mide: true,
    grupo: 'Estratégico funcional',
  },
  {
    romano: 'V',
    desde: 12,
    hasta: 15,
    nombre: 'Estratégico general',
    mide: false,
    grupo: 'Estratégico general',
  },
  {
    romano: 'VI',
    desde: 15,
    hasta: 18,
    nombre: 'Estratégico corporativo',
    mide: false,
    grupo: 'Estratégico corporativo',
  },
  {
    romano: 'VII',
    desde: 18,
    hasta: 21,
    nombre: 'Estratégico corporativo',
    mide: false,
    grupo: 'Estratégico corporativo',
  },
] as const;

export type Estrato = (typeof ESTRATOS)[number];

/**
 * Las ocho bandas de maduración, de la más baja a la más alta.
 *
 * `arranque` es el escalón en el que el límite superior de la banda está a los
 * veinte años, y `techo` aquel al que se acerca sin llegar. `k` es cuán rápido
 * lo hace: las bandas bajas se aplanan antes de los cuarenta y las altas siguen
 * subiendo después de los sesenta, que es lo que dice el modelo ("cuanto más
 * alto es el modo, más veloz es el ritmo de maduración y más se prolonga").
 */
const BANDAS = Array.from({ length: 8 }, (_, i) => {
  const n = i + 1;
  return { n, arranque: n, techo: 3 * n, k: 0.05 + 0.06 / n };
});

/** Cuántas bandas hay. */
export const CUANTAS_BANDAS = BANDAS.length;

/** Dónde está el límite superior de una banda a cierta edad, en escalones. */
export function limiteDeBanda(n: number, edad: number): number {
  const b = BANDAS[n - 1];
  if (!b) return 0;
  return b.techo - (b.techo - b.arranque) * Math.exp(-b.k * (edad - EDAD_MIN));
}

/**
 * En qué escalón cae un horizonte, con decimales.
 *
 * Entre dos marcas se interpola por logaritmo y no derecho: de un año a
 * dieciséis meses hay ciento veinte días y de veinte años a treinta hay tres
 * mil seiscientos, y en el mismo alto de escalón. El logaritmo es lo que hace
 * que un horizonte a mitad de camino se dibuje a mitad del escalón.
 */
export function escalonDe(dias: number): number {
  if (!Number.isFinite(dias) || dias <= 0) return 0;
  if (dias <= ESCALERA[0].dias) return 0;
  if (dias >= ESCALERA[ALTO].dias) return ALTO;
  for (let i = 0; i < ALTO; i++) {
    const a = ESCALERA[i].dias;
    const b = ESCALERA[i + 1].dias;
    if (dias <= b) return i + Math.log(dias / a) / Math.log(b / a);
  }
  return ALTO;
}

/** La vuelta: cuántos días mide un escalón con decimales. */
export function diasDeEscalon(escalon: number): number {
  const e = Math.max(0, Math.min(ALTO, escalon));
  const i = Math.min(ALTO - 1, Math.floor(e));
  const a = ESCALERA[i].dias;
  const b = ESCALERA[i + 1].dias;
  return a * Math.pow(b / a, e - i);
}

/**
 * En qué estrato cae un escalón.
 *
 * Las marcas de la escalera son los techos: tres meses es el techo del estrato
 * I y dos años el del III. Un horizonte que cae justo sobre una marca es del
 * estrato de abajo y no del de arriba, que es como lo dice el modelo y como lo
 * elige la evaluadora cuando escribe "dos años".
 */
export function estratoDeEscalon(escalon: number): Estrato {
  const e = Math.max(0, Math.min(ALTO, escalon));
  return ESTRATOS.find((x) => e <= x.hasta) ?? ESTRATOS[ESTRATOS.length - 1];
}

/**
 * Por qué banda viene subiendo alguien de esta edad con este horizonte.
 *
 * La banda es la que tiene su límite superior justo por encima del punto. Por
 * debajo de la primera devuelve 1, que es el piso del diagrama, y por encima de
 * la última devuelve 8.
 */
export function bandaDe(edad: number, dias: number): number {
  const e = escalonDe(dias);
  for (const b of BANDAS) {
    if (e <= limiteDeBanda(b.n, edad)) return b.n;
  }
  return CUANTAS_BANDAS;
}

/**
 * Hasta dónde llega esa banda, edad por edad.
 *
 * Se toma el medio de la banda y no su límite superior: el límite es el borde
 * con la banda de arriba, y proyectar por el borde le atribuye a la persona el
 * techo de una banda a la que todavía no se sabe si pertenece.
 */
export function horizonteEn(banda: number, edad: number): number {
  const arriba = limiteDeBanda(banda, edad);
  const abajo = banda > 1 ? limiteDeBanda(banda - 1, edad) : 0;
  return (arriba + abajo) / 2;
}

/**
 * Cómo se nombra un estrato al que la banda proyecta.
 *
 * Del quinto para arriba el instrumento no mide: el análisis discursivo ubica
 * entre el I y el IV, y decir "va a llegar al VI" sería afirmar algo que esta
 * evaluación no puede sostener. Se dice hasta dónde llega el alcance y se
 * nombra el resto como lo que es.
 */
export function comoSeDice(e: Estrato): string {
  return e.mide ? `estrato ${e.romano}` : 'un nivel por encima del alcance de este análisis';
}

/**
 * Las preguntas que determinan el nivel de complejidad, en cascada.
 *
 * Son las del procedimiento de Jaques (*Determining the Level of Task
 * Complexity*): se contestan por sí o por no y **el nivel es el número más alto
 * contestado que sí**. Sirven para las dos puntas del mismo problema, porque
 * describen el trabajo y no a la persona:
 *
 * - sobre el **puesto**, contestando qué exige el trabajo que hay que hacer;
 * - sobre la **persona**, contestando sobre las dos o tres asignaciones que
 *   manejó al límite de lo que pudo, que es como el libro indica juzgarlo.
 *
 * Elegir entre cuatro descripciones es una impresión; contestar cuatro
 * preguntas deja registrado por qué dio ese nivel.
 *
 * Cada una viene en tres redacciones: `texto` describe el trabajo y es la que
 * se contesta del puesto; `alCandidato` es la misma pregunta hecha a la
 * persona, sobre lo que ella contó; `simple` dice qué es ese nivel para alguien
 * que no conoce el modelo, y es la que sale en la comparación. Son dos formas de averiguar lo mismo, y la segunda
 * existe para que la evaluadora pueda contestarla mientras escucha, sin tener
 * que traducir nada.
 *
 * La quinta existe para los puestos: una jefatura puede exigir un estrato V, y
 * saberlo cambia la búsqueda aunque el análisis discursivo no certifique ese
 * nivel en una persona.
 */
/*
 * `simple` va en infinitivo porque describe el trabajo y no a quien lo hace:
 * se lee debajo de "¿Qué exige el trabajo que hay que hacer?", donde el sujeto
 * es el puesto, y en la tabla de comparación, donde es el nivel.
 */
export const PREGUNTAS = [
  {
    estrato: 1,
    corto: 'Juicio directo',
    simple: 'Seguir un método ya conocido y resolver los obstáculos sobre la marcha.',
    texto:
      '¿El trabajo se puede llevar adelante siguiendo un plan ya asignado, resolviendo los obstáculos a medida que aparecen con la experiencia y el criterio práctico?',
    alCandidato: '¿Lo resolviste siguiendo un método o un procedimiento que ya conocías?',
    repreguntas: [
      '¿De dónde salió ese método? ¿Te lo pasaron o lo armaste vos?',
      '¿Qué hiciste cuando algo no estaba en el procedimiento?',
    ],
  },
  {
    estrato: 2,
    corto: 'Acumulación diagnóstica',
    simple: 'Reunir información, darse cuenta de qué está pasando y recién ahí decidir.',
    texto:
      '¿Exige reunir e interpretar datos que van apareciendo, y llegar a un diagnóstico que los vincule para recién ahí decidir cómo resolver?',
    alCandidato:
      '¿Tuviste que ir juntando información y armar vos qué estaba pasando, antes de saber cómo resolverlo?',
    repreguntas: [
      '¿Qué información juntaste y de dónde la sacaste?',
      '¿A qué conclusión llegaste que no era evidente al principio?',
    ],
  },
  {
    estrato: 3,
    corto: 'Caminos alternativos',
    simple: 'Armar varias maneras de resolverlo, elegir una y guardar otra por si falla.',
    texto:
      '¿Exige construir un plan que equilibre lo que hay que hacer hoy contra lo que se necesita más adelante, con otros caminos en reserva por si el elegido no funciona?',
    alCandidato:
      '¿Armaste distintas maneras de resolverlo y elegiste una? ¿Tenías otra preparada por si esa no funcionaba?',
    repreguntas: [
      'Contame el camino que descartaste. ¿Por qué lo descartaste?',
      'El plan B, ¿estaba armado o era una idea? ¿Qué tenía adentro?',
    ],
  },
  {
    estrato: 4,
    corto: 'Procesamiento paralelo',
    simple: 'Llevar varios frentes a la vez y ajustar cada uno según los otros.',
    texto:
      '¿Exige llevar adelante varios proyectos que se afectan entre sí, ajustando cada uno en relación con los otros?',
    alCandidato:
      '¿Estabas llevando varios frentes a la vez, donde lo que hacías en uno te cambiaba otro?',
    repreguntas: [
      '¿Qué otras cosas llevabas en paralelo? ¿Cómo decidías a cuál darle prioridad?',
      'Cuando se movió una, ¿qué tuviste que rehacer de las otras?',
    ],
  },
  {
    estrato: 5,
    corto: 'Sistema completo',
    simple: 'Seguir cómo un cambio en un punto mueve todo lo demás y decidir contando eso.',
    texto:
      '¿Exige seguir cómo un cambio en cualquier punto impacta en el sistema entero, y decidir contando las consecuencias que eso arrastra aguas abajo?',
    alCandidato:
      '¿Tenías que seguir cómo un cambio en cualquier punto te movía todo lo demás, y decidir contando eso?',
    repreguntas: [
      'Cuando cambiabas algo acá, ¿qué se movía en otra área?',
      '¿A quién más le pegaba esa decisión? ¿Cómo lo tuviste en cuenta?',
    ],
  },
] as const;

/**
 * Con qué se abre: el pedido de ejemplos.
 *
 * Es lo primero y es una sola frase, porque de acá sale todo lo demás. Sin
 * ejemplos concretos las cuatro preguntas se contestan sobre una impresión, que
 * es exactamente lo que el procedimiento evita.
 */
export const APERTURA =
  '¿Cuál es la tarea de mayor alcance temporal que hacés en tu trabajo y que sea responsabilidad tuya?';

/**
 * Y con qué se averigua el horizonte: para cuándo tiene que estar el resultado.
 *
 * **Es el plazo del resultado y no el de la entrega.** Jaques lo define como el
 * *target completion time* de la tarea más larga asignada al rol: la fecha en
 * la que se ve si salió bien. Planificar los objetivos del año se entrega la
 * semana que viene, y de esos objetivos la persona responde hasta que el año
 * cierra: el plazo es un año. Preguntando "¿para cuándo tiene que estar lista?"
 * se contesta la fecha de la entrega, que es otra cosa.
 *
 * Va después y no junto con la anterior: preguntadas a la vez, la persona
 * contesta el plazo del proyecto entero del que participa y no el de aquello
 * de lo que responde, que es lo que se está midiendo.
 */
export const PREGUNTA_HORIZONTE =
  'El resultado de esa tarea, ¿cuándo se sabe si salió bien?';

/** Lo que hay que tener en la cabeza al contestarla. */
/**
 * Lo que hay que repreguntar para que el plazo sea un dato y no una impresión.
 *
 * Un plazo dicho de memoria se estira: "más o menos un año" suele ser tres
 * meses de trabajo y nueve de espera. La primera lo convierte en dos fechas, y
 * la segunda dice si respondía sola por el resultado, que es lo que separa la
 * tarea propia de la tarea supervisada.
 */
export const REPREGUNTAS_PLAZO = [
  '¿En qué fecha empezó y en qué fecha se supo si había salido bien?',
  '¿Quién lo revisaba antes de que saliera? Si te equivocabas, ¿quién se enteraba y cuándo?',
] as const;

/**
 * Los cinco minutos de discurso libre.
 *
 * Es la otra vía del modelo, la de Gillian Stamp: el nivel de la persona se lee
 * en cómo arma el argumento y no en lo que cuenta. Por eso el tema lo elige la
 * persona y da lo mismo cuál sea: lo que se mira es si enumera razones sueltas,
 * si las acumula hasta un diagnóstico, si encadena consecuencias o si sostiene
 * varias líneas a la vez.
 *
 * En la entrevista solo se pide y se graba. Se codifica después, escuchando, en
 * la pestaña Potencial.
 */
export const PEDIDO_DISCURSO =
  'Elegí un tema que te interese, el que quieras, y contame cinco minutos sobre eso. No es sobre trabajo y no hay respuesta correcta.';

export const AVISO_HORIZONTE =
  'Se cuenta hasta la fecha en la que se ve el resultado: un plan anual se entrega en una semana y su plazo es de un año.';

/**
 * Cómo la persona ordena lo que dice, que es la medida de Stamp.
 *
 * Los cuatro modos de procesamiento se repiten en cada orden de complejidad de
 * la información. En el orden verbal simbólico, que es el de casi todas las
 * evaluaciones, van del estrato I al IV; sobre conceptos abstractos, los mismos
 * cuatro dan del V al VIII.
 *
 * **Se lee cómo arma el argumento y no de qué habla.** El tema lo elige la
 * persona y no dice nada del nivel; lo que dice es si las razones quedan
 * sueltas, si se acumulan hasta un diagnóstico, si se encadenan o si van varias
 * a la vez.
 */
export const MODOS = [
  {
    clave: 'declarativo',
    nombre: 'Declarativo',
    estrato: 1,
    suena:
      'Da razones sueltas, una atrás de otra. Cada una vale por sí sola y no las relaciona entre sí.',
  },
  {
    clave: 'acumulativo',
    nombre: 'Acumulativo',
    estrato: 2,
    suena:
      'Junta varias razones que recién juntas dicen algo, y con eso llega a una conclusión que ninguna daba sola.',
  },
  {
    clave: 'serial',
    nombre: 'Serial',
    estrato: 3,
    suena:
      'Encadena una línea: si pasa esto entonces esto, y por eso aquello. Sigue la consecuencia hasta el final.',
  },
  {
    clave: 'paralelo',
    nombre: 'Paralelo',
    estrato: 4,
    suena:
      'Sostiene dos o más líneas a la vez y las cruza: cómo lo que pasa en una mueve a la otra, y decide con las dos.',
  },
] as const;

export type ModoDeDiscurso = (typeof MODOS)[number]['clave'];

/**
 * Dónde cae dentro de su estrato.
 *
 * Cada estrato se subdivide en tres celdas, que son las que la lámina rotula en
 * su columna: IIB abajo, IIM en el medio y IIA arriba. Es la granularidad del
 * propio modelo, y estar en A es estar a punto de pasar al estrato siguiente.
 */
export const CELDAS = [
  { clave: 'A', nombre: 'A · alto', dice: 'En el borde de arriba, a punto de pasar al siguiente.' },
  { clave: 'M', nombre: 'M · medio', dice: 'En el medio de su estrato, sostenido.' },
  { clave: 'B', nombre: 'B · bajo', dice: 'Recién entrando en ese estrato.' },
] as const;

export type CeldaDelEstrato = (typeof CELDAS)[number]['clave'];

/** Si lo guardado es una de las tres celdas. Sin valor se lee como M. */
export function esCelda(v: unknown): v is CeldaDelEstrato {
  return typeof v === 'string' && CELDAS.some((c) => c.clave === v);
}

/** Si lo guardado es uno de los cuatro modos. */
export function esModo(v: unknown): v is ModoDeDiscurso {
  return typeof v === 'string' && MODOS.some((m) => m.clave === v);
}

/**
 * El estrato que da el discurso.
 *
 * Los cuatro modos sobre cosas concretas dan del I al IV. Los mismos cuatro
 * sobre conceptos, que es el orden siguiente de complejidad, dan del V al VIII.
 */
export function estratoDeDiscurso(modo: ModoDeDiscurso | null, abstracto = false): number | null {
  const m = MODOS.find((x) => x.clave === modo);
  if (!m) return null;
  /* El cuarto modo sobre conceptos daría el estrato VIII, que en Jaques existe
     y en esta tabla no: la escalera del diagrama llega al VII. Se topea ahí en
     vez de devolver un estrato que no está, que dejaba a la persona sin ninguno
     y sin decir por qué. */
  return Math.min(m.estrato + (abstracto ? 4 : 0), ESTRATOS.length);
}

/**
 * Con qué horizonte se dibuja el punto en el diagrama de progreso.
 *
 * El diagrama ubica a la persona por su edad y su horizonte, y el horizonte que
 * corresponde es el de su capacidad. Cuando esa capacidad se leyó en el
 * discurso, lo que hay es un estrato y no un número de días: se dibuja en el
 * medio de su franja, que es el punto que no queda apoyado sobre ninguna de las
 * dos rayas que la limitan.
 *
 * Si el plazo que se le midió en el trabajo cae dentro de ese mismo estrato,
 * manda el plazo medido, que dice lo mismo con más precisión.
 */
export function diasParaElDiagrama(
  porDiscurso: Estrato | null,
  diasMedidos: number | null,
  celda: CeldaDelEstrato = 'M'
): number | null {
  if (!porDiscurso) return diasMedidos;
  /* En el medio de la celda que se eligió: las tres del estrato son las tres
     últimas marcas de la escalera antes de su techo, y el medio de cada una es
     el punto que no queda apoyado sobre ninguna raya.

     El plazo del trabajo no entra acá: lo que se está diciendo es dónde cae la
     capacidad dentro del estrato, y eso se leyó en el discurso. */
  const desde = { A: 0.5, M: 1.5, B: 2.5 }[celda];
  return diasDeEscalon(Math.max(0, porDiscurso.hasta - desde));
}

/**
 * El nivel que dan las respuestas: el más alto contestado que sí.
 *
 * Null cuando no se contestó ninguna que sí, que no es lo mismo que estrato I:
 * es que todavía no se preguntó.
 */
export function nivelDeRespuestas(sies: number[]): number | null {
  const validos = sies.filter((n) => PREGUNTAS.some((p) => p.estrato === n));
  return validos.length > 0 ? Math.max(...validos) : null;
}

/** El estrato por su número, del I al VII. */
export function estratoPorNumero(n: number): Estrato | null {
  return ESTRATOS[n - 1] ?? null;
}

/**
 * El estrato que le corresponde a un time-span, que es la medida objetiva.
 *
 * El tiempo máximo de finalización de la tarea más larga que el puesto tiene
 * que llevar hasta el final. Los cortes son los del modelo y ya están en la
 * escalera: tres meses, un año, dos años, cinco, diez.
 */
export function estratoDeTimeSpan(dias: number): Estrato {
  return estratoDeEscalon(escalonDe(dias));
}

/**
 * El plazo de un estrato, en palabras: "de 1 año a 2 años", "hasta 3 meses".
 *
 * Sale de los cortes del modelo y no de un texto escrito a mano, así que dice
 * exactamente lo mismo que mide el diagrama.
 */
export function plazoDe(e: Estrato): string {
  const marcas: readonly { texto: string }[] = ESCALERA;
  const hasta = marcas[e.hasta]?.texto ?? '';
  // El estrato I arranca por debajo de la escalera: su piso no tiene marca.
  const desde = e.desde >= 0 ? marcas[e.desde]?.texto : null;
  return desde ? `De ${desde} a ${hasta}` : `Hasta ${hasta}`;
}

/**
 * Qué tan lejos está una persona de un puesto, en estratos.
 *
 * Cero es el ajuste: la persona puede con la complejidad que el puesto pide.
 * Positivo es que le sobra nivel y negativo que le falta. Jaques mide la
 * distancia entre un jefe y su subordinado con la misma cuenta: un estrato de
 * diferencia es lo que corresponde, y cero (los dos en el mismo) es "demasiado
 * cerca", porque el jefe no puede agregar contexto.
 */
export function distancia(persona: number, puesto: number): number {
  return persona - puesto;
}

/** El horizonte en palabras: "3 años", "8 meses", "2 semanas". */
export function enPalabras(dias: number): string {
  if (dias < 14) {
    const d = Math.max(1, Math.round(dias));
    return `${d} ${d === 1 ? 'día' : 'días'}`;
  }
  if (dias < 60) {
    const s = Math.round(dias / 7);
    return `${s} ${s === 1 ? 'semana' : 'semanas'}`;
  }
  if (dias < 365) {
    const m = Math.round(dias / 30.4);
    return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  }
  const a = dias / 365;
  if (a < 10) {
    const r = Math.round(a * 2) / 2;
    if (r === 1) return 'un año';
    if (r === 1.5) return 'un año y medio';
    const entero = Math.floor(r);
    return r % 1 === 0 ? `${entero} años` : `${entero} años y medio`;
  }
  return `${Math.round(a)} años`;
}

/** Las unidades en que se carga un horizonte, y cuántos días vale cada una. */
export const UNIDADES = [
  { clave: 'dias', texto: 'días', dias: 1 },
  { clave: 'semanas', texto: 'semanas', dias: 7 },
  { clave: 'meses', texto: 'meses', dias: 30.4 },
  { clave: 'anios', texto: 'años', dias: 365 },
] as const;

export type Unidad = (typeof UNIDADES)[number]['clave'];

/** Cuántos días son, redondeado, o null si el número no sirve. */
export function aDias(cantidad: number, unidad: Unidad): number | null {
  const u = UNIDADES.find((x) => x.clave === unidad);
  if (!u || !Number.isFinite(cantidad) || cantidad <= 0) return null;
  const dias = Math.round(cantidad * u.dias);
  return dias >= 1 && dias <= 40_000 ? dias : null;
}

/**
 * Cómo mostrar unos días en el par número + unidad con que se cargaron.
 *
 * Elige la unidad más grande que dé un número redondo: 730 días vuelve como
 * "2 años" y no como "730 días", que es lo que se escribió.
 */
export function desdeDias(dias: number): { cantidad: number; unidad: Unidad } {
  // Primero la unidad más grande que dé un número entero, y recién después una
  // que dé un medio: 547 días son "18 meses" y no "1,5 años", que es lo que se
  // escribió y lo que la evaluadora espera volver a ver.
  for (const enteros of [true, false]) {
    for (const u of [...UNIDADES].reverse()) {
      const n = dias / u.dias;
      const redondo = enteros ? Math.round(n) : Math.round(n * 2) / 2;
      if (n >= 1 && Math.abs(n - redondo) < 0.02) return { cantidad: redondo, unidad: u.clave };
    }
  }
  return { cantidad: dias, unidad: 'dias' };
}

/** Una edad que sirva para el diagrama. */
export function edadValida(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n >= 16 && n <= 80 ? n : null;
}
