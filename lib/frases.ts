/**
 * El ejercicio de las frases de la charla 5, donde se separa el hecho de lo que
 * uno se cuenta sobre el hecho.
 *
 * La sala se parte en equipos con nombre de color, y cada equipo en dos mitades
 * que se sientan enfrentadas, el Team A y el Team B. En cada frase una recibe
 * el hecho y tiene que agregarle la interpretación, y la otra recibe la
 * interpretación y tiene que dejar el hecho solo. Las dos trabajan **los
 * mismos cuatro casos**, y ahí está todo el ejercicio: lo que una mitad tiene
 * que escribir es exactamente el punto de partida de la otra, así que cuando
 * se leen, la respuesta la tiene el de enfrente y no quien dicta.
 *
 * Y a mitad de camino las direcciones se invierten, así que las dos mitades
 * pasan por las dos: dos frases sacando la interpretación y dos agregándola.
 *
 * Dentro de cada mitad escribe una sola persona. No es una limitación técnica:
 * es lo que obliga a que los tres discutan si una palabra es un hecho o una
 * opinión, que es donde se aprende. Con un teléfono por cabeza cada uno
 * contesta lo suyo y no habla con nadie.
 *
 * Acá no hay nada de base de datos a propósito: es una función de una lista de
 * personas a un reparto, y por eso se puede verificar sola.
 */

/**
 * Las dos mitades de cada equipo.
 *
 * Se llaman A y B y no por la dirección que hacen, porque **cada una hace las
 * dos**: dos frases sacando la interpretación y dos agregándola. Antes cada
 * mitad hacía una sola dirección, así que la mitad de la sala nunca practicaba
 * ir de subjetivo a objetivo, que es la que cuesta y la única que se usa
 * después, cuando en la charla de malas noticias hay que decir un motivo que
 * el otro pueda verificar.
 */
export const MITADES = ['a', 'b'] as const;
export type Mitad = (typeof MITADES)[number];

export const NOMBRE_DE_MITAD: Record<Mitad, string> = {
  a: 'Team A',
  b: 'Team B',
};

/** A dónde hay que llegar en una frase. */
export type Direccion = 'objetivo' | 'subjetivo';

/**
 * Qué dirección le toca a cada mitad en cada una de las cuatro frases.
 *
 * Cruzadas: en cada frase una mitad va hacia el hecho y la otra hacia la
 * interpretación. Eso es lo que sostiene el ejercicio, porque el punto de
 * partida de una es la llegada de la otra, y por eso al leerse la respuesta la
 * tiene el de enfrente. Que además se inviertan a mitad de camino es lo que
 * hace que todos pasen por las dos.
 */
export function direccionDe(mitad: Mitad, frase: number): Direccion {
  const primeras = frase < 2;
  if (mitad === 'a') return primeras ? 'objetivo' : 'subjetivo';
  return primeras ? 'subjetivo' : 'objetivo';
}

/**
 * Qué hay que hacer en cada dirección, en las palabras que se leen en el
 * teléfono, y con las mismas de la hoja impresa de respaldo.
 */
export const CONSIGNA: Record<Direccion, { de: string; a: string; como: string }> = {
  objetivo: {
    de: 'Les tocaron frases subjetivas',
    a: 'De subjetivo a objetivo',
    como: 'Saquen todo lo que no se pueda verificar y dejen solo lo que vio ' +
      'cualquiera que estuviera ahí.',
  },
  subjetivo: {
    de: 'Les tocaron frases objetivas',
    a: 'De objetivo a subjetivo',
    como: 'Agréguenle lo que uno se cuenta cuando pasa eso, eso que pensás ' +
      'sin darte cuenta.',
  },
};

/**
 * Los colores de los equipos. Se dicen en voz alta y se buscan en la sala, así
 * que van los que se distinguen de lejos y no se confunden entre sí al oírlos.
 */
export const COLORES = [
  'Rojo',
  'Azul',
  'Verde',
  'Amarillo',
  'Violeta',
  'Naranja',
  'Celeste',
  'Marrón',
] as const;

/**
 * Las diez filas del ejercicio, tal como están impresas en las dos hojas.
 *
 * Cada fila es el mismo suceso contado de las dos maneras. La columna `hecho`
 * es el punto de partida del Team Subjetivo y la llegada del Team Objetivo; la
 * columna `interpretacion`, al revés.
 */
export const FILAS = [
  {
    hecho: 'Los objetivos del mes son un 30% más altos que el mes pasado.',
    interpretacion:
      'Es obvio que no llegamos a cumplir con los objetivos de este mes ' +
      'porque son difíciles.',
  },
  { hecho: 'Me levanto a las 6 de la mañana.', interpretacion: 'Me encanta levantarme temprano.' },
  {
    hecho: 'El menú de hoy del bar de la esquina es un plato de pastas.',
    interpretacion: 'Nada más rico que un buen plato de pastas del bar de la esquina.',
  },
  {
    hecho: 'Las chicas de Sentir nos indicaron resolver un ejercicio sobre la comunicación.',
    interpretacion: 'Este ejercicio está buenísimo, qué capas que son las chicas de Sentir.',
  },
  { hecho: 'Juancito se puso perfume.', interpretacion: 'Qué rico perfume el de Juancito.' },
  {
    hecho: 'En la ciudad hay una temperatura de 39 grados.',
    interpretacion: 'Hace un calor insoportable.',
  },
  {
    hecho: 'Juanita frunció el ceño en la reunión.',
    interpretacion: 'Qué enojada estaba Juanita en la reunión.',
  },
  {
    hecho: 'Juancito una vez cometió un error. Hoy no hay coincidencia en el reporte.',
    interpretacion: 'Juancito siempre hace lo mismo, otra vez los números no cierran.',
  },
  {
    hecho: 'Recibí un mail de Juancito reclamando una tarea que prometí cumplir ayer.',
    interpretacion: 'Seguro que Juancito me manda este mail porque está enojado por lo de ayer.',
  },
  {
    hecho: 'Necesito contar con este dato de Juanita para las 15.',
    interpretacion: 'Cómo no se da cuenta Juanita que necesito esto urgente.',
  },
] as const;

/**
 * Las cuatro que se hacen en la sala, de las diez impresas.
 *
 * Son las mismas para todos los equipos: la puesta en común compara seis
 * versiones de la misma frase, que dice mucho más que diez frases sueltas
 * resueltas una sola vez.
 *
 * La primera es de calentamiento y da risa. Las otras tres tienen una persona
 * adentro y cada una es uno de los sesgos de la placa anterior: adivinar lo que
 * el otro siente, generalizar por una vez, y dar por sabido lo que nunca se
 * dijo. Escribir en el teléfono es lento, así que cuatro es lo que entra en los
 * seis minutos del bloque.
 */
export const DEL_EJERCICIO = [5, 6, 7, 9];

export type PuestoFrases = {
  asistenteId: string;
  mitad: Mitad;
  /** Quien escribe por los tres. El resto discute y le dicta. */
  escribe: boolean;
};

export type EquipoFrases = {
  /** Índice en COLORES. Es lo que se dice en voz alta para juntarse. */
  color: number;
  puestos: PuestoFrases[];
};

/**
 * Arma los equipos y reparte los dos lados.
 *
 * `ids` tiene que venir en un orden estable, por ejemplo por fecha de registro:
 * el reparto se calcula una sola vez y se guarda, y si alguna vez hubiera que
 * recalcularlo tiene que dar lo mismo.
 *
 * Apunta a equipos de seis, que es donde el ejercicio funciona mejor: tres de
 * cada mitad, discusión real adentro y una sola conversación cruzada al final.
 * Cuando la cantidad no da, los equipos quedan de cinco o de siete antes que
 * dejar a alguien afuera, y cada equipo se parte lo más parejo que se pueda.
 */
export function repartoFrases(ids: string[]): EquipoFrases[] {
  if (ids.length < 4) throw new Error('el ejercicio necesita al menos cuatro personas');

  const cuantos = Math.max(1, Math.round(ids.length / 6));
  const base = Math.floor(ids.length / cuantos);
  const conUnoMas = ids.length % cuantos;

  const equipos: EquipoFrases[] = [];
  let desde = 0;
  for (let e = 0; e < cuantos; e++) {
    const tamaño = base + (e < conUnoMas ? 1 : 0);
    const gente = ids.slice(desde, desde + tamaño);
    desde += tamaño;

    // Con un equipo impar la persona de más cae en la mitad B. Las dos hacen
    // las dos direcciones, así que ya no hay una que gane con una cabeza extra
    // y alcanza con partir parejo.
    const cuantosA = Math.ceil(gente.length / 2);
    const puestos: PuestoFrases[] = gente.map((asistenteId, i) => {
      const mitad: Mitad = i < cuantosA ? 'a' : 'b';
      // El primero de cada mitad escribe. Se define por posición y no al azar
      // para que el reparto sea el mismo cada vez que se calcule.
      const primeroDeSuMitad = i === 0 || i === cuantosA;
      return { asistenteId, mitad, escribe: primeroDeSuMitad };
    });

    equipos.push({ color: e % COLORES.length, puestos });
  }
  return equipos;
}
