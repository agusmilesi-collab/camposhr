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
 * subdivisión del estrato (IIIB es la parte del medio del estrato III).
 *
 * Cada marca es el **techo** de su franja: la franja IA va de un mes a tres
 * meses, y su rótulo es "3 meses". El piso de la más baja, ID, queda fuera de
 * la escala, igual que en la lámina.
 */
export const ESCALERA = [
  { dias: 1, texto: '1 día', celda: 'ID' },
  { dias: 7, texto: '1 semana', celda: 'IC' },
  { dias: 30, texto: '1 mes', celda: 'IB' },
  { dias: 91, texto: '3 meses', celda: 'IA' },
  { dias: 182, texto: '6 meses', celda: 'IIC' },
  { dias: 273, texto: '9 meses', celda: 'IIB' },
  { dias: 365, texto: '1 año', celda: 'IIA' },
  { dias: 487, texto: '16 meses', celda: 'IIIC' },
  { dias: 608, texto: '20 meses', celda: 'IIIB' },
  { dias: 730, texto: '2 años', celda: 'IIIA' },
  { dias: 1095, texto: '3 años', celda: 'IVC' },
  { dias: 1460, texto: '4 años', celda: 'IVB' },
  { dias: 1825, texto: '5 años', celda: 'IVA' },
  { dias: 2555, texto: '7 años', celda: 'VC' },
  { dias: 3103, texto: '8,5 años', celda: 'VB' },
  { dias: 3650, texto: '10 años', celda: 'VA' },
  { dias: 5110, texto: '14 años', celda: 'VIC' },
  { dias: 6205, texto: '17 años', celda: 'VIB' },
  { dias: 7300, texto: '20 años', celda: 'VIA' },
  { dias: 10950, texto: '30 años', celda: 'VIIC' },
  { dias: 14600, texto: '40 años', celda: 'VIIB' },
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
 * Cada una viene en dos redacciones: `texto` describe el trabajo y es la que se
 * contesta del puesto; `alCandidato` es la misma pregunta hecha a la persona,
 * sobre lo que ella contó. Son dos formas de averiguar lo mismo, y la segunda
 * existe para que la evaluadora pueda contestarla mientras escucha, sin tener
 * que traducir nada.
 *
 * La quinta existe para los puestos: una jefatura puede exigir un estrato V, y
 * saberlo cambia la búsqueda aunque el análisis discursivo no certifique ese
 * nivel en una persona.
 */
export const PREGUNTAS = [
  {
    estrato: 1,
    corto: 'Juicio directo',
    texto:
      '¿El trabajo se puede llevar adelante siguiendo un plan ya asignado, resolviendo los obstáculos a medida que aparecen con la experiencia y el criterio práctico?',
    alCandidato: '¿Lo resolviste siguiendo un método o un procedimiento que ya conocías?',
  },
  {
    estrato: 2,
    corto: 'Acumulación diagnóstica',
    texto:
      '¿Exige reunir e interpretar datos que van apareciendo, y llegar a un diagnóstico que los vincule para recién ahí decidir cómo resolver?',
    alCandidato:
      '¿Tuviste que ir juntando información y armar vos qué estaba pasando, antes de saber cómo resolverlo?',
  },
  {
    estrato: 3,
    corto: 'Caminos alternativos',
    texto:
      '¿Exige construir un plan que equilibre lo que hay que hacer hoy contra lo que se necesita más adelante, con otros caminos en reserva por si el elegido no funciona?',
    alCandidato:
      '¿Armaste distintas maneras de resolverlo y elegiste una? ¿Tenías otra preparada por si esa no funcionaba?',
  },
  {
    estrato: 4,
    corto: 'Procesamiento paralelo',
    texto:
      '¿Exige llevar adelante varios proyectos que se afectan entre sí, ajustando cada uno en relación con los otros?',
    alCandidato:
      '¿Estabas llevando varios frentes a la vez, donde lo que hacías en uno te cambiaba otro?',
  },
  {
    estrato: 5,
    corto: 'Sistema completo',
    texto:
      '¿Exige seguir cómo un cambio en cualquier punto impacta en el sistema entero, y decidir contando las consecuencias que eso arrastra aguas abajo?',
    alCandidato:
      '¿Tenías que seguir cómo un cambio en cualquier punto te movía todo lo demás, y decidir contando eso?',
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
 * **Es el plazo del resultado y no el trabajo que cuesta hacerlo.** Jaques lo
 * define como el *target completion time* de la tarea más larga asignada al
 * rol: la fecha en la que se ve si salió bien. Fijar los objetivos del año
 * puede llevar una tarde de trabajo y su plazo es un año, porque de eso
 * responde la persona hasta que el año cierra.
 *
 * Va después y no junto con la anterior: preguntadas a la vez, la persona
 * contesta el plazo del proyecto entero del que participa y no el de aquello
 * de lo que responde, que es lo que se está midiendo.
 */
export const PREGUNTA_HORIZONTE =
  '¿Para cuándo tenés que tener terminado el resultado de esa tarea?';

/** Lo que hay que tener en la cabeza al contestarla. */
export const AVISO_HORIZONTE =
  'Es el plazo del resultado del que responde, no las horas que le lleva hacerlo: fijar los objetivos del año puede llevar una tarde y el plazo es un año.';

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
    return `${r.toString().replace('.5', ' años y medio').replace('.', ',')}${
      r % 1 === 0 ? (r === 1 ? ' año' : ' años') : ''
    }`;
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
