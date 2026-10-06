import 'server-only';
import { fichaDe, proyectivoDe, type Ficha } from '@/lib/ficha';
import {
  cortesValidos,
  leer,
  porArea,
  bandaDeAfr,
  bandasPorIndice,
  senalDe,
  textosValidos,
  type Cortes,
  type Lectura,
  type SumarioCrudo,
  type TestDeManchas,
  type Textos,
} from '@/lib/redacciones';
import {
  bandaDe,
  calcularCompetencias,
  pesosValidos,
  cortesDeCompetenciasValidos,
  direccionesValidas,
  protocoloAlcanza,
  type Competencia,
} from '@/lib/competencias';
import { RANGOS, rangosValidos, type Rango } from '@/lib/raven';
import { ajuste } from '@/lib/ajustes';
import { medianasDeCompetencias, type Medianas } from '@/lib/competencias-mediana';
import { TEXTOS } from '@/lib/redacciones';
import { tramoDe, tramosValidos, esTramo, type PasoDelPlan, type Tramo } from '@/lib/plan-incorporacion';
import { DE_FABRICA as EXIGENCIA_DE_FABRICA, type Exigencia } from '@/lib/exigencia';
import { exigenciasGuardadas } from '@/lib/exigencias-datos';
import {
  diasParaElDiagrama,
  esModo,
  brechaDeAplicacion,
  estratoDeDiscurso,
  estratoPorNumero,
} from '@/lib/potencial';
import { ESTRATOS as ESTRATOS_DEL_MODELO } from '@/lib/potencial';
import { revisar, type Aviso } from '@/lib/coherencia';
import {
  conclusionesValidas,
  llevaDiscursivo,
  nivelesQueRigen,
  nivelesValidos,
  type TextoDeNivel,
} from '@/lib/discursivo';
import {
  CUADRANTES,
  nivelDeConclusion,
  tecnicas,
  type Cuadrante,
  type NivelAjuste,
} from '@/lib/informe-textos';
import { leerBenziger } from '@/lib/benziger-lectura';
import { adaptacionDe, debilidadDe, entornoDe, fortalezaDe } from '@/lib/benziger-contexto';

/** Un modo del perfil adulto: su puntaje, su banda y las tareas que dependen de él. */
type ModoDelPerfil = {
  clave: string;
  nombre: string;
  puntaje: number | null;
  banda: string | null;
  tareas: string;
  fuente: string;
};
import type { Cuatro } from '@/lib/benziger-perfil';
import {
  CAMPOS_DE_CONDUCCION,
  TEXTOS_BENZIGER,
  benzigerQueRige,
  benzigerValidos,
  type CampoBenziger,
  type TextosDeCuadrante,
} from '@/lib/benziger-textos';

/**
 * El informe de selección, armado desde lo que está cargado.
 *
 * Sigue el esqueleto de la evaluadora: datos, semáforo, competencias, resumen,
 * recomendaciones al líder, análisis por competencia, Benziger, técnicas y
 * confidencialidad.
 *
 * **El veredicto no se calcula.** El nivel de ajuste sale de la recomendación
 * que cargó la psicóloga en su pestaña, y sin esa recomendación el informe no
 * se genera: es la firma de quien administró la prueba y ningún puntaje la
 * reemplaza.
 *
 * Lo que falta se dice que falta. Un informe al que le faltan las manchas sale
 * igual, con esa sección vacía y el aviso arriba, porque la evaluadora necesita
 * verlo para saber qué le falta cargar.
 */

export type Faltante = { que: string; donde: string };

/**
 * El índice que sostiene un texto del informe, con su valor y su banda.
 *
 * `dentro` es null cuando ese índice no tiene una banda con la que compararlo:
 * pasa con los que se disparan contra otra lectura o contra un valor que no es
 * un número. Ahí se muestra el índice y su valor, sin pintar, que es la misma
 * regla que sigue la hoja del sumario.
 */
export type Respaldo = {
  indice: string;
  valor: string;
  dentro: boolean | null;
  /** Qué se esperaba, escrito: "de 0,30 a 0,80". Para el título del sello. */
  esperado: string | null;
};

/**
 * Quita las recomendaciones que dicen lo mismo con otras palabras.
 *
 * El esqueleto lo pide expresamente. Dos índices distintos pueden llevar a la
 * misma indicación: "marcarle qué cosas se hacen de una manera establecida" y
 * "marcarle qué cosas se necesitan hacer de una manera determinada" son la
 * misma frase para quien la lee. Se comparan las primeras palabras, que es
 * donde está el verbo y su objeto, y se conserva la primera.
 */
function sinRepetir(textos: string[]): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const t of textos) {
    const arranque = t
      .toLowerCase()
      .replace(/[^a-záéíóúñü ]/g, '')
      .split(/\s+/)
      .slice(0, 4)
      .join(' ');
    if (vistas.has(arranque)) continue;
    vistas.add(arranque);
    salida.push(t);
  }
  return salida;
}

/**
 * El plan de incorporación: cada recomendación con el tramo de su lectura.
 *
 * Lo guardado por la evaluadora manda. Puede venir con su tramo, que es como
 * se guarda desde que existe el plan, o como texto suelto, que es como se
 * guardaba antes: ahí el tramo se busca por el texto entre las lecturas, y si
 * lo reescribió y ya no aparece, va a "Durante toda la relación", que no le
 * promete al líder un plazo que nadie eligió.
 */
function planDe(
  guardada: unknown,
  calculada: string[],
  lecturas: Lectura[],
  movidos: Record<string, Tramo>
): PasoDelPlan[] {
  const porTexto = new Map<string, Tramo>();
  for (const l of lecturas) {
    if (l.recomienda && !porTexto.has(l.recomienda)) {
      porTexto.set(l.recomienda, tramoDe(l.clave, movidos));
    }
  }
  const delTexto = (texto: string): PasoDelPlan => ({
    texto,
    tramo: porTexto.get(texto) ?? 'siempre',
  });
  if (!Array.isArray(guardada)) return calculada.map(delTexto);
  return guardada.flatMap((x): PasoDelPlan[] => {
    if (typeof x === 'string') return [delTexto(x)];
    if (x && typeof x === 'object' && typeof x.texto === 'string' && esTramo(x.tramo)) {
      return [{ texto: x.texto, tramo: x.tramo }];
    }
    return [];
  });
}

/** Los párrafos del capítulo Benziger que la evaluadora puede reescribir. */
export const PARRAFOS_BENZIGER = ['comoEs', 'fortaleza', 'debilidad', 'entorno'] as const;
export type ParrafoBenziger = (typeof PARRAFOS_BENZIGER)[number];

/** El párrafo que sale: lo reescrito si lo hay, si no lo calculado. */
export function parrafoBenziger(
  bz: { parrafos: Record<ParrafoBenziger, string | null>; editado: Partial<Record<ParrafoBenziger, string>> },
  k: ParrafoBenziger
): string | null {
  return bz.editado[k] ?? bz.parrafos[k];
}

/** Las cuatro listas del informe que la evaluadora puede tocar. */
export const LISTAS_DEL_INFORME = [
  'recomendaciones',
  'destacadas',
  'esperadas',
  'desarrollar',
] as const;

export type ListaDelInforme = (typeof LISTAS_DEL_INFORME)[number];

export type Informe = {
  nombre: string;
  empresa: string | null;
  puesto: string | null;
  evaluadora: string | null;
  /**
   * Cuándo se evaluó: el día de la entrevista, escrito entero.
   *
   * Las evaluaciones viejas sin fecha de entrevista salen con el mes y el año,
   * que es lo que se puede afirmar de ellas.
   */
  cuando: string;
  /**
   * Quién pidió la búsqueda, con su cargo si está cargado.
   *
   * Va debajo de la empresa: el informe circula reenviado entre gente que no
   * estuvo en el pedido, y de quién salió es lo primero que se pregunta.
   */
  solicitante: string | null;
  bateria: string | null;
  /** El test de manchas que se administró, para las técnicas. */
  proyectivo: string | null;
  nivel: NivelAjuste | null;
  /**
   * Qué edad tenía el día de la entrevista.
   *
   * Sale del número guardado en la evaluación y no de la fecha de nacimiento:
   * un informe de hace dos años que se vuelve a abrir tiene que decir la misma
   * edad que decía el día que salió.
   */
  edad: number | null;
  competencias: Competencia[];
  /**
   * La mediana de cada competencia entre todas las personas evaluadas, para el
   * radar. Null cuando todavía no hay casos suficientes o no se pudo calcular.
   */
  medianas: Medianas | null;
  /**
   * Con qué exigencia se nombran esos puntajes.
   *
   * Los puntajes no cambian: lo que cambia es dónde corta cada banda. Un
   * pedido para un puesto operativo puede leerse con una exigencia más baja
   * que uno de conducción.
   */
  exigencia: Exigencia;
  /**
   * Qué dio la evaluación, en dos frases que arma el motor.
   *
   * Sale de las mismas lecturas que el resto del informe y no de un modelo de
   * lenguaje: son frases escritas, elegidas por los índices.
   */
  resumen: string[];
  /**
   * Por qué se recomienda ese nivel, escrito por la evaluadora.
   *
   * Es lo que ella deja cuando elige el nivel de ajuste, en primera persona y
   * con su firma. Vacío cuando todavía no lo escribió: el informe sale igual
   * con el resumen del motor, que es lo que se puede afirmar sin ella.
   */
  fundamentacion: string[];
  /**
   * El plan de incorporación: cada recomendación al líder con su tramo.
   *
   * Sale de las lecturas, y el tramo de la lectura que la disparó. Si la
   * evaluadora reescribió la lista, manda lo suyo con el tramo que eligió.
   */
  recomendaciones: PasoDelPlan[];
  analisis: {
    destacadas: string[];
    esperadas: string[];
    desarrollar: string[];
  };
  /**
   * Qué índice respalda cada texto, por el texto mismo.
   *
   * Lo pidió la psicóloga el 28/8/2026: al revisar el informe quiere ver de
   * dónde salió cada párrafo sin tener que volver al sumario y buscarlo. **Es
   * de quien evalúa y no del cliente**: `Documento` lo dibuja solo cuando
   * recibe `editar`, que es lo que distingue la ficha de la vista para imprimir
   * y del portal.
   *
   * La clave es el texto y no la posición porque las listas se pueden reordenar
   * y editar. Un texto corregido a mano deja de encontrar su respaldo, que es
   * lo correcto: ya no es lo que dijo la codificación.
   */
  respaldos: Record<string, Respaldo>;
  /**
   * Por qué las competencias del proyectivo van sin puntaje, si es el caso.
   *
   * Vacío cuando el protocolo alcanza. Lo dice el informe una vez, arriba de
   * las competencias, en vez de repetirlo en cada una.
   */
  protocoloCorto: string | null;

  /**
   * Cuáles de esas cuatro listas dejó escritas la evaluadora.
   *
   * Lo que está acá no lo armó el motor: es lo que ella ordenó, corrigió o
   * agregó, y no se recalcula aunque cambie la codificación. La pantalla lo usa
   * para avisar que esa sección está intervenida y para ofrecer volver atrás.
   */
  intervenidas: ListaDelInforme[];
  benziger: {
    /**
     * El cuadrante que sale como predominante: el primero que marcó la
     * evaluadora, y uno solo aunque haya marcado dos (M p. 43: cada persona
     * tiene una sola preferencia natural).
     */
    preferentes: Cuadrante[];
    /** Qué se dice de la persona y cómo conducirla, con lo que rige. Null si no se eligió cuadrante. */
    textos: {
      comoEs: string;
      /** De dónde sale, para la etiqueta que ve quien evalúa. */
      comoEsFuente: string;
      /** Los renglones del manual para el líder; un campo vaciado en Configuración no sale. */
      conducir: { rotulo: string; texto: string; fuente: string }[];
    } | null;
    /** Los cuatro totales del perfil adulto, que es el que se grafica. */
    adulto: Cuatro | null;
    /** El perfil joven, que en el gráfico va punteado. */
    joven: Cuatro | null;
    /** En qué entorno rinde, del nivel de extraversión del adulto (`lib/benziger-contexto.ts`). */
    entorno: { estilo: string; nivel: number; texto: string; fuente: string } | null;
    /** El modo predominante y su diagonal, con banda y tareas. Null sin predominante. */
    fortaleza: ModoDelPerfil | null;
    debilidad: ModoDelPerfil | null;
    /**
     * Los cuatro párrafos del capítulo como los arma el sistema (null el que
     * no sale), y lo que la evaluadora reescribió para esta persona. Lo
     * reescrito pisa lo calculado; una clave ausente es "usá lo calculado".
     */
    parrafos: Record<ParrafoBenziger, string | null>;
    editado: Partial<Record<ParrafoBenziger, string>>;
  } | null;
  raven: { raw: number; resultado: string } | null;
  /**
   * Hasta qué nivel de rol puede llegar, si se cargó.
   *
   * Va solo en las baterías que incluyen el análisis discursivo, y solo cuando
   * la evaluadora lo ubicó: el nivel es su lectura y el sistema no lo deduce.
   */
  discursivo: {
    nivel: string;
    /** Los dos párrafos, si los escribió. */
    actual: string | null;
    futura: string | null;
    /**
     * Por qué la evaluadora lo ubicó ahí, con sus palabras.
     *
     * El capítulo entero sale de comparar dos estratos, y hasta acá se
     * publicaba sin una línea de quien lo firma. Es lo único del potencial que
     * no calcula el sistema.
     */
    fundamentacion: string | null;
    /**
     * Cuántos estratos por debajo de lo que puede está el trabajo que hoy le dan.
     *
     * Cero cuando le queda a la medida. Sale de comparar el estrato que dio el
     * discurso con el plazo de la tarea más larga que hoy le asignan: son dos
     * mediciones independientes, y la distancia entre ellas es lo que el puesto
     * le está dejando sin usar.
     */
    brecha: number;
    /**
     * Dónde cae en el diagrama de progreso potencial, si se cargaron los dos.
     *
     * Son dos datos de la evaluadora: la edad del día de la entrevista y el
     * horizonte temporal que le atribuye. Sin los dos no hay punto que dibujar
     * y el capítulo sale con la pirámide sola, que es como salía antes.
     */
    punto: { edad: number; dias: number; aplicado: number | null; puesto: number | null } | null;
    /**
     * El nivel de trabajo del puesto y la distancia con el de la persona.
     *
     * Es la comparación que el modelo considera central: la evaluación mide a
     * la persona, y lo que hay que decidir es si eso alcanza para este puesto.
     * Null cuando el pedido todavía no tiene determinado su nivel.
     */
    puesto: { romano: string; nombre: string; distancia: number } | null;
    /** Qué dice cada escalón de la pirámide, con lo que rige. */
    escalones: Record<string, string>;
    /**
     * El estrato en el que quedó, con lo que rige.
     *
     * Es lo que arma el capítulo: qué complejidad de trabajo puede abordar hoy
     * y qué exige el nivel siguiente. Sale del catálogo y no de lo que escriba
     * la evaluadora, porque es el marco del instrumento y no una lectura de
     * esta persona.
     */
    detalle: {
      romano: string;
      procesamiento: string;
      horizonte: string;
      actual: string;
      /** Dónde suele verse ese nivel, ya partido en renglones. */
      ejemplos: string[];
      proyeccion: string;
    } | null;
  } | null;
  tecnicas: string[];
  /**
   * El respaldo: los datos como quedaron registrados, sin interpretar.
   *
   * Va en la parte de indicadores, que es la que se archiva. Lo pidió Agustín
   * el 28/8/2026: que de todo lo que el informe afirma quede el registro con el
   * que se puede volver a revisar años después.
   *
   * **Está lo que se midió y no lo que se escribió.** La entrevista por
   * competencias, las observaciones del Bender y del gráfico y el relato del
   * análisis discursivo son texto de quien tomó la entrevista, no un dato: eso
   * queda en la ficha. Del protocolo va su codificación, que es lo que produce
   * los índices; las respuestas dichas por la persona no, que son su discurso y
   * viven en el protocolo clínico.
   */
  crudo: {
    /** El sumario estructural, con el orden y las abreviaturas de la hoja. */
    sumario: string | null;
    /** Cómo quedó codificada cada respuesta del test de manchas. */
    protocolo: {
      lamina: string;
      n: number | null;
      localizacion: string;
      determinantes: string;
      fq: string;
      par: boolean;
      contenidos: string;
      popular: boolean;
      z: number | null;
      ccee: string;
    }[];
    /** Qué opción eligió en cada lámina del Raven. */
    raven: { lamina: number; opcion: number }[];
  };
  /** Lo que no estaba cargado y por eso no salió en el informe. */
  faltantes: Faltante[];
  /**
   * Lo que choca y conviene mirar antes de firmar (`lib/coherencia.ts`).
   *
   * Es de quien evalúa, como los faltantes: se dibuja en la ficha y no se
   * imprime. El sistema no corrige nada, solo lo marca.
   */
  avisos: Aviso[];
};

/**
 * Cuándo se evaluó a la persona.
 *
 * Es el día de la entrevista, escrito entero: el informe se guarda en un legajo
 * y se lo compara con otro, y el mes y el año no alcanzan para saber cuál se
 * tomó antes ni si fue antes o después de algo que pasó en la empresa. Las
 * evaluaciones viejas que no tienen fecha de entrevista se siguen fechando por
 * mes y año, que es lo que se puede afirmar de ellas.
 *
 * Una fecha sin hora (`fecha_ingreso` es `date`) se arma con sus tres números y
 * no con `new Date`, que la lee como medianoche en Londres y en Córdoba la
 * devuelve un día antes.
 */
const ZONA = 'America/Argentina/Cordoba';

function fechaLarga(iso: string): string {
  const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = soloDia
    ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
    : new Date(iso);
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(soloDia ? {} : { timeZone: ZONA }),
  });
}

function mesYAnio(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const mes = d.toLocaleDateString('es-AR', { month: 'long', timeZone: ZONA });
  return `${mes[0].toUpperCase()}${mes.slice(1)} de ${d.getFullYear()}`;
}

/**
 * Qué pesa más entre lo que hay que desarrollar, para elegir los riesgos del
 * resumen.
 *
 * El diccionario no tiene un orden de gravedad: sus lecturas van por área. Sin
 * este orden el resumen tomaba las tres primeras del diccionario, y en un
 * protocolo con sobrecarga nombraba la localización y dejaba afuera lo más
 * serio. Va de lo que más compromete el desempeño a lo que menos: los recursos
 * frente a la tensión, la lectura de la realidad, el descontrol, la forma de
 * procesar y lo interpersonal. Lo que no está acá va después, en el orden del
 * diccionario.
 *
 * Es un borrador del 2/10/2026 para que lo corrijan las psicólogas.
 */
const GRAVEDAD = [
  // Recursos frente a la tensión.
  'adjd-sobrecarga',
  'complejidad-alta-sin-recursos',
  'ea-bajo',
  'adjd-menos-uno',
  'd-menor-que-adjd',
  // Lectura de la realidad y del pensamiento.
  'x-menos-alto',
  'xa-bajo',
  'xa-medio-wda-bajo',
  'm-menos-alto',
  'alog-presente',
  'dr-presente',
  // Descontrol y oposición.
  'fc-descarga-intensa',
  'c-pura-alta',
  'cop-bajo-ag-alto',
  's-muy-alto',
  'c-prima-alta',
  // Forma de procesar la información.
  'dqv-w-alto',
  'dqv-d-alto',
  'dqvmas-w-alto',
  'dqv-alto',
  'zd-bajo',
  'lambda-alto',
  'w-m-alto',
  // Lo interpersonal.
  'phr-mayor-que-ghr',
  'aislamiento-muy-alto',
  'cop-cero-ag-bajo',
  'sumt-cero',
  'per-alto',
  'fd-presente',
];

/**
 * Las dos oraciones del resumen, que van en la primera hoja.
 *
 * La primera hoja es la que lee quien decide la contratación, así que dice dos
 * cosas: qué se destaca y qué pesa en contra para el puesto. Lo que el líder
 * tiene que hacer va en el plan de incorporación y no acá.
 *
 * **Lo arma el motor, sin modelo de lenguaje**: pega la primera frase del "qué
 * dice" de lecturas ya escritas, elegidas por los índices.
 *
 * - **Lo que se destaca** sale solo del grupo destacado. Hasta el 2/10/2026, si
 *   no había nada destacado, tomaba lo que dio dentro de lo esperado y lo
 *   presentaba igual como "se destacan": el cliente leía como fortaleza un
 *   "criterio de realidad adecuado", que es lo esperable.
 * - **Lo que requiere atención** son las tres lecturas a desarrollar más
 *   graves según `GRAVEDAD`. No dice "para el puesto": el motor no compara la
 *   lectura contra lo que el puesto pide, eso lo hace quien firma.
 *
 * Va antes de la fundamentación porque son dos cosas distintas: esto es lo que
 * se vio, y la fundamentación es por qué se recomienda lo que se recomienda.
 */
function armarResumen(lecturas: Lectura[], destacadas: Lectura[]): string[] {
  const aFavor = destacadas.slice(0, 3);

  const rango = (l: Lectura) => {
    const i = GRAVEDAD.indexOf(l.clave);
    return i === -1 ? GRAVEDAD.length : i;
  };
  const enContra = lecturas
    .filter((l) => senalDe(l) === 'desarrollar' && l.dice)
    .map((l, orden) => ({ l, orden }))
    .sort((x, y) => rango(x.l) - rango(y.l) || x.orden - y.orden)
    .map((x) => x.l)
    // Uno por área: sin esto, en la mitad de los protocolos los tres lugares
    // se iban en el estrés (sobrecarga, recursos limitados y tensión del
    // momento), y además dos de ellos leídos juntos parecían contradecirse.
    .filter((l, i, todas) => todas.findIndex((o) => o.area === l.area) === i)
    .slice(0, 3);

  /**
   * Cada aspecto va como su propia oración, con la primera frase de su texto.
   *
   * Los textos del diccionario ya son oraciones completas: metidos en una
   * enumeración después de "son:" quedaban dos verbos encadenados ("los
   * aspectos son: sus recursos son limitados"). El encabezado solo dice
   * cuántos son, y lo que sigue se lee como está escrito.
   */
  const primera = (t: string) => t.split('. ')[0].replace(/\.$/, '');
  const CUANTOS = ['', 'un aspecto', 'dos aspectos', 'tres aspectos'];
  const oraciones = (ls: Lectura[]) => ls.map((l) => `${primera(l.dice)}.`).join(' ');

  const destaca = aFavor.length
    ? `Se ${aFavor.length === 1 ? 'destaca' : 'destacan'} ${CUANTOS[aFavor.length]}. ${oraciones(aFavor)}`
    : 'No se registran aspectos por encima de lo esperado en las competencias evaluadas.';

  const pesa = enContra.length
    ? `${enContra.length === 1 ? 'Requiere' : 'Requieren'} atención ${CUANTOS[enContra.length]}. ${oraciones(enContra)}`
    : 'No se registran aspectos fuera de lo esperado que requieran una gestión particular.';

  return [destaca, pesa];
}

/**
 * El respaldo de cada texto: de qué índice salió y si cayó dentro de lo esperado.
 *
 * Se arma sobre las lecturas, así que vale tanto para lo que dice cada grupo del
 * análisis como para las recomendaciones al líder: las dos cosas salen de la
 * misma lectura y comparten su índice.
 */
function respaldosDe(
  lecturas: Lectura[],
  cortes: Cortes,
  test: TestDeManchas,
  estilo: string
): Record<string, Respaldo> {
  const bandas = bandasPorIndice(cortes, test);
  const salida: Record<string, Respaldo> = {};

  for (const l of lecturas) {
    // Afr no tiene corte guardado: su banda depende del estilo del protocolo.
    const banda = l.indice === 'Afr' ? bandaDeAfr(estilo) : bandas[l.indice];
    // El valor viene escrito para leerse ("Xu 0,35", "+3,5", "W:M 9:3"), así
    // que el número se saca del final y solo si lo que va delante no tiene
    // dígitos: una razón como 9:3 no se compara contra una banda.
    const m = l.valor.match(/^[^\d]*([+−-]?\d+(?:[.,]\d+)?)$/);
    const numero = m ? Number(m[1].replace('−', '-').replace(',', '.')) : NaN;
    const comparable = banda && Number.isFinite(numero);
    const dentro = comparable
      ? (banda.minimo === null || numero >= banda.minimo) &&
        (banda.maximo === null || numero <= banda.maximo)
      : null;

    const n = (x: number) => x.toFixed(banda?.decimales ?? 0).replace('.', ',');
    const esperado = !banda
      ? null
      : banda.minimo !== null && banda.maximo !== null
        ? banda.minimo === banda.maximo
          ? `exactamente ${n(banda.minimo)}`
          : `de ${n(banda.minimo)} a ${n(banda.maximo)}`
        : banda.minimo !== null
          ? `${n(banda.minimo)} o más`
          : banda.maximo === 0
            ? 'en cero'
            : `hasta ${n(banda.maximo as number)}`;

    const respaldo: Respaldo = { indice: l.indice, valor: l.valor, dentro, esperado };
    if (l.dice) salida[l.dice] = respaldo;
    if (l.recomienda) salida[l.recomienda] = respaldo;
  }
  return salida;
}

export async function armarInforme(id: string): Promise<Informe | null> {
  const ficha = await fichaDe(id);
  if (!ficha) return null;
  /* La mediana de las competencias está hecha y apagada (6/10/2026): por
     ahora el radar sale solo con el perfil de la persona. Prenderla es pasar
     `await medianasQueRigen(rige)` como tercer argumento, acá y en la pestaña
     Informe de la ficha. */
  return desdeFicha(ficha, await loQueRige());
}

/**
 * Las medianas para el radar, sin que un fallo tumbe el informe.
 *
 * Es un agregado de todas las evaluaciones y el informe es de una sola: si esa
 * lectura falla, el radar sale sin la comparación y el resto no se entera.
 */
export async function medianasQueRigen(rige: Regulacion): Promise<Medianas | null> {
  try {
    return await medianasDeCompetencias(rige);
  } catch (error) {
    console.error('No se pudieron calcular las medianas de competencias', error);
    return null;
  }
}

/**
 * El criterio que rige ahora: lo movido desde Sistema, y si no lo de fábrica.
 *
 * Se resuelve del lado del servidor, una vez por informe. Un ajuste que no se
 * puede leer, o que no pasa su validación, se ignora y queda lo de fábrica: el
 * informe se arma igual.
 */
export type Regulacion = {
  rangos: Rango[];
  pesos: Record<string, number>;
  textos: Textos;
  cortes: Cortes;
  /** Dónde corta cada indicador del velocímetro, por `claveDePeso`. */
  cortesCompetencias: Record<string, number[]>;
  /** Hacia dónde es mejor cada indicador, cuando se invirtió. */
  direcciones: Record<string, boolean>;
  /** Los textos de los cuatro estratos del potencial, si se reescribieron. */
  niveles: Record<string, Partial<TextoDeNivel>>;
  /** Las conclusiones del potencial, si se reescribieron. */
  conclusiones: Record<string, string>;
  /** En qué tramo del plan de incorporación va cada lectura, si se movió. */
  tramos: Record<string, Tramo>;
  /** Los textos de los cuadrantes del Benziger, si se reescribieron. */
  benziger: Record<string, Partial<TextosDeCuadrante>>;
  /** Los perfiles de exigencia guardados. El informe usa el que le toque. */
  exigencias: Exigencia[];
};

const DE_FABRICA: Regulacion = {
  rangos: RANGOS,
  pesos: {},
  textos: {},
  cortes: {},
  cortesCompetencias: {},
  direcciones: {},
  niveles: {},
  conclusiones: {},
  tramos: {},
  benziger: {},
  exigencias: [EXIGENCIA_DE_FABRICA],
};

export async function loQueRige(): Promise<Regulacion> {
  const [r, p, t, c, k, dir, n, cl, tr, bz, x] = await Promise.all([
    ajuste('raven_rangos'),
    ajuste('competencias_pesos'),
    ajuste('redacciones_textos'),
    ajuste('redacciones_cortes'),
    ajuste('competencias_cortes'),
    ajuste('competencias_direccion'),
    ajuste('discursivo_niveles'),
    ajuste('discursivo_conclusiones'),
    ajuste('redacciones_tramos'),
    ajuste('benziger_cuadrantes'),
    exigenciasGuardadas(),
  ]);
  return {
    rangos: rangosValidos(r) ?? RANGOS,
    pesos: pesosValidos(p) ?? {},
    textos: textosValidos(t) ?? {},
    cortes: cortesValidos(c) ?? {},
    cortesCompetencias: cortesDeCompetenciasValidos(k) ?? {},
    direcciones: direccionesValidas(dir) ?? {},
    niveles: nivelesValidos(n) ?? {},
    conclusiones: conclusionesValidas(cl) ?? {},
    tramos: tramosValidos(tr, Object.keys(TEXTOS)) ?? {},
    benziger: benzigerValidos(bz) ?? {},
    exigencias: x.length > 0 ? x : [EXIGENCIA_DE_FABRICA],
  };
}

/**
 * Si a esta persona le corresponde el Benziger.
 *
 * Lo agrega el pedido y no la batería, para todos sus candidatos
 * (`pedidos.con_benziger`) o para uno solo (`evaluaciones.con_benziger`). Una
 * fila cargada también cuenta: si alguien lo tomó, se ve, aunque no estuviera
 * pedido.
 */
export function llevaBenziger(f: Ficha): boolean {
  return Boolean(
    f.cabecera.pedidos?.con_benziger || f.cabecera.con_benziger || f.benziger?.cuadrantes
  );
}

/**
 * Si una fila de cuatro cuadrantes trae algún número.
 *
 * El objeto existe igual con los cuatro en null, así que preguntar si está no
 * alcanza: eso es lo que dejaba pasar un Benziger cargado a medias.
 */
function tieneAlgo(c: Cuatro | null): boolean {
  return Boolean(c && Object.values(c).some((v) => v !== null && v !== undefined));
}

export function desdeFicha(
  f: Ficha,
  rige: Regulacion = DE_FABRICA,
  medianas: Medianas | null = null
): Informe {
  const { rangos, pesos, textos, cortes, cortesCompetencias, niveles, exigencias } = rige;
  const direcciones = rige.direcciones;
  const benzigerMovidos = rige.benziger ?? {};

  const c = f.cabecera;
  /**
   * Con qué exigencia se leen los puntajes de este informe.
   *
   * La del pedido, y si no tiene, la predeterminada. Se elige por pedido y en
   * ningún otro lado: apartarse de la default es una decisión del puesto, no de
   * un candidato suelto. Es un rótulo y no una cuenta: los puntajes son los
   * mismos, lo que cambia es cómo se los nombra.
   */
  const exigencia =
    exigencias.find((e) => e.id === c.pedidos?.exigencia_id) ??
    exigencias.find((e) => e.predeterminada) ??
    EXIGENCIA_DE_FABRICA;
  const faltantes: Faltante[] = [];

  const sumario = (f.sumario?.crudo ?? null) as SumarioCrudo | null;
  if (!sumario) faltantes.push({ que: 'El sumario del test de manchas', donde: 'la pestaña de codificación' });

  const ravenResultado = f.raven?.resultado ?? '';
  if (f.raven?.raw === null || f.raven?.raw === undefined) {
    faltantes.push({ que: 'El puntaje del Raven', donde: 'la hoja de la entrevista' });
  }

  if (llevaDiscursivo(f.cabecera.pedidos?.baterias?.tests)) {
    if (!f.discursivo?.nivel) {
      faltantes.push({ que: 'El nivel del análisis discursivo', donde: 'la pestaña Potencial' });
    }
    // Los dos párrafos que escribe la evaluadora dejaron de faltar: el capítulo
    // sale completo con los textos del estrato, y lo que ella agregue es una
    // lectura sobre esta persona, no el contenido del capítulo.
  }

  const bz =
    f.benziger?.cuadrantes
      ? leerBenziger(
          f.benziger.cuadrantes,
          f.benziger.adjetivos ?? {},
          f.benziger.abiertas ?? {},
          f.benziger.estres ?? {}
        )
      : null;
  const fila = (titulo: string): Cuatro | null =>
    bz?.filas.find((x) => x.titulo === titulo)?.valores ?? null;
  // Solo se reclama en los pedidos que lo llevan: en los demás no falta nada,
  // simplemente no se pidió.
  if (llevaBenziger(f) && !f.benziger?.cuadrante_preferente?.length) {
    faltantes.push({ que: 'El cuadrante preferente del Benziger', donde: 'la pestaña Benziger' });
  }
  if (!c.recomendacion) {
    faltantes.push({ que: 'La conclusión', donde: 'la pestaña Recomendación' });
  } else if (!nivelDeConclusion(c.recomendacion)) {
    faltantes.push({
      que: `La conclusión dice "${c.recomendacion}", que no corresponde a un nivel de ajuste`,
      donde: 'la pestaña Recomendación',
    });
  }

  /**
   * Lo que la evaluadora dejó escrito para alguna de las cuatro listas.
   *
   * Una clave ausente significa "usá lo calculado"; una lista vacía significa
   * "esta sección va sin ítems", que no es lo mismo. Por eso se pregunta si es
   * un arreglo y no si tiene largo.
   */
  const guardadas = (c.informe_listas ?? {}) as Partial<Record<ListaDelInforme, string[]>>;
  const elegir = (clave: ListaDelInforme, calculada: string[]): string[] => {
    const suya = guardadas[clave];
    return Array.isArray(suya) ? suya.filter((t) => typeof t === 'string') : calculada;
  };

  // Con qué se midió y qué lugar ocupa este candidato en su pedido: lo primero
  // decide el corte y la recomendación, lo segundo cuál de las formas de decir
  // cada cosa le toca, así dos informes del mismo pedido no se leen iguales.
  const lecturas = sumario
    ? leer(sumario, ravenResultado, textos, cortes, {
        test: proyectivoDe(f) === 'Zulliger' ? 'Zulliger' : 'Rorschach',
        vuelta: f.ordenEnPedido ?? 0,
      })
    : [];
  const destacadas = lecturas.filter((l) => senalDe(l) === 'destacada');
  const esperadas = lecturas.filter((l) => senalDe(l) === 'esperada');
  const desarrollar = lecturas.filter((l) => senalDe(l) === 'desarrollar');

  // Si el protocolo no alcanza para puntuar, el informe lo dice una vez.
  const revision = sumario ? protocoloAlcanza(sumario, proyectivoDe(f)) : null;
  const corto = revision && !revision.alcanza ? revision.motivo : null;
  if (corto) {
    faltantes.push({
      que: 'Las competencias van sin puntaje',
      donde: corto,
    });
  }

  const adulto = fila('Total adulto');
  const joven = fila('Total joven');
  const hayBenziger = Boolean(
    f.benziger && (tieneAlgo(adulto) || tieneAlgo(joven) || f.benziger.cuadrante_preferente?.length)
  );
  const competencias = sumario
    ? calcularCompetencias(
        sumario,
        {
          ravenPercentil: f.raven?.percentil ?? null,
          ravenRaw: f.raven?.raw ?? null,
          /* El estrato del potencial alimenta un indicador de Liderazgo, así
             que viaja como el Raven: lo carga la evaluadora y no sale del
             sumario. */
          potencial: f.discursivo
            ? { nivel: f.discursivo.nivel, celda: f.discursivo.discurso_celda }
            : null,
          rangos,
          pesos,
          cortesCompetencias,
          direcciones,
        },
        proyectivoDe(f)
      )
    : [];

  // Uno solo, el primero que se marcó. El arreglo guarda el orden en que la
  // evaluadora los eligió, y el primero es el que manda.
  const primero = f.benziger?.cuadrante_preferente?.[0];
  const preferentes = CUADRANTES.filter((q) => q.clave === primero);
  const textosBenziger = preferentes[0]
    ? (() => {
        const clave = preferentes[0].clave;
        const suyos = benzigerQueRige(clave, benzigerMovidos);
        // La fuente vale mientras el texto sea el original: reescrito en
        // Configuración, ya no es lo que dice esa página.
        const fuente = (c: CampoBenziger) =>
          `Benziger ${clave} · ${
            benzigerMovidos[clave]?.[c] !== undefined && benzigerMovidos[clave]?.[c] !== TEXTOS_BENZIGER[clave].textos[c]
              ? 'reescrito'
              : TEXTOS_BENZIGER[clave].fuentes[c].split(/\. (?=[A-Z"])/)[0]
          }`;
        return {
          comoEs: suyos.comoEs,
          comoEsFuente: fuente('comoEs'),
          conducir: CAMPOS_DE_CONDUCCION.map((c) => ({
            rotulo: c.rotulo,
            texto: suyos[c.clave],
            fuente: fuente(c.clave),
          })).filter((c) => c.texto),
        };
      })()
    : null;

  const inf: Informe = {
    nombre: c.personas?.nombre ?? 'Sin nombre',
    empresa: c.pedidos?.empresas?.nombre ?? null,
    puesto: c.pedidos?.puesto ?? null,
    evaluadora: c.evaluadoras?.nombre ?? null,
    cuando: c.fecha_entrevista ? fechaLarga(c.fecha_entrevista) : mesYAnio(c.fecha_ingreso),
    // El que cargó a este candidato, y si no se sabe, el que pidió el pedido.
    solicitante: (() => {
      const s = c.solicitante ?? c.pedidos?.solicitante;
      return s ? (s.cargo ? `${s.nombre} · ${s.cargo}` : s.nombre) : null;
    })(),
    edad: c.edad,
    bateria: c.pedidos?.baterias?.codigo ?? null,
    proyectivo: proyectivoDe(f),
    nivel: nivelDeConclusion(c.recomendacion),
    competencias,
    medianas,
    protocoloCorto: corto,
    resumen: armarResumen(lecturas, destacadas),
    fundamentacion: (c.recomendacion_notas ?? '')
      .split(/\n\s*\n|\n/)
      .map((t) => t.trim())
      .filter(Boolean),
    // El líder recibe cada recomendación una sola vez, aunque dos índices
    // distintos lleven a lo mismo.
    recomendaciones: planDe(
      guardadas.recomendaciones,
      sinRepetir(lecturas.map((l) => l.recomienda).filter(Boolean)),
      lecturas,
      rige.tramos ?? {}
    ),
    analisis: {
      destacadas: elegir('destacadas', destacadas.map((l) => l.dice)),
      esperadas: elegir('esperadas', esperadas.map((l) => l.dice)),
      desarrollar: elegir('desarrollar', desarrollar.map((l) => l.dice)),
    },
    respaldos: respaldosDe(
      lecturas,
      cortes,
      proyectivoDe(f) === 'Zulliger' ? 'Zulliger' : 'Rorschach',
      typeof sumario?.control_estres?.estilo === 'string'
        ? (sumario.control_estres.estilo as string)
        : 'Ambigual'
    ),
    intervenidas: LISTAS_DEL_INFORME.filter((k) => Array.isArray(guardadas[k])),
    // La sección sale si hay algo que mostrar, y no por existir la fila. Un
    // Benziger cargado a medias, sin ningún cuadrante, dibujaba el cerebro sin
    // una sola figura adentro y con los cuatro títulos alrededor: el cliente
    // leía "estilos de pensamiento predominantes" sobre un gráfico vacío.
    benziger: hayBenziger
      ? {
          preferentes,
          textos: textosBenziger,
          adulto,
          joven,
          ...(() => {
            const entorno = entornoDe(bz?.alerta.adulto ?? null);
            const fortaleza = preferentes[0] ? fortalezaDe(preferentes[0].clave, adulto) : null;
            const debilidad = preferentes[0] ? debilidadDe(preferentes[0].clave, adulto) : null;
            // Lo que reescribió la evaluadora para esta persona, en la misma
            // columna que las listas (`informe_listas.benziger`).
            const suyo = (c.informe_listas as any)?.benziger;
            const editado: Partial<Record<ParrafoBenziger, string>> = {};
            if (suyo && typeof suyo === 'object') {
              for (const k of PARRAFOS_BENZIGER) {
                if (typeof suyo[k] === 'string') editado[k] = suyo[k];
              }
            }
            return {
              entorno,
              fortaleza,
              debilidad,
              parrafos: {
                comoEs: textosBenziger?.comoEs ?? null,
                fortaleza: fortaleza ? `Rinde en: ${fortaleza.tareas}.` : null,
                debilidad: debilidad ? `Le exigen más esfuerzo: ${debilidad.tareas}.` : null,
                entorno: entorno?.texto ?? null,
              },
              editado,
            };
          })(),
        }
      : null,
    // Solo si la evaluadora lo ubicó: la pirámide sin un escalón marcado no
    // dice nada, y el capítulo entero es esa marca.
    exigencia,
    discursivo: f.discursivo?.nivel
      ? {
          nivel: f.discursivo.nivel,
          actual: f.discursivo.actual,
          futura: f.discursivo.futura,
          fundamentacion: f.discursivo.fundamentacion,
          brecha: brechaDeAplicacion(
            estratoDeDiscurso(
              esModo(f.discursivo.discurso_modo) ? f.discursivo.discurso_modo : null,
              Boolean(f.discursivo.discurso_abstracto)
            ),
            f.discursivo.horizonte_dias
          ),
          puesto: (() => {
            const n = c.pedidos?.estrato_puesto ?? null;
            const suyo = nivelesQueRigen(niveles).find((x) => x.nombre === f.discursivo?.nivel);
            const e = n ? estratoPorNumero(n) : null;
            return e && suyo && n
              ? {
                  romano: e.romano,
                  nombre: e.mide ? e.nombre : e.grupo,
                  distancia: suyo.estrato - n,
                }
              : null;
          })(),
          punto: (() => {
            // La edad sale de la fecha de nacimiento, que se carga en la
            // entrevista; la guardada en el análisis queda de respaldo para las
            // evaluaciones viejas que no la tienen.
            const edad = (c.edad ?? f.discursivo?.edad) as number | null;
            // Y el horizonte es el de su capacidad: con el discurso codificado,
            // el punto va en la franja de ese estrato y no en el plazo del
            // trabajo que le asignaron, que puede ser más bajo.
            const delDiscurso = estratoDeDiscurso(
              esModo(f.discursivo?.discurso_modo) ? f.discursivo.discurso_modo : null,
              Boolean(f.discursivo?.discurso_abstracto)
            );
            const dias = diasParaElDiagrama(delDiscurso ? estratoPorNumero(delDiscurso) : null);
            /* Y el plazo del trabajo que tiene asignado, cuando el discurso
               dice otra cosa: en el dibujo va como una marca aparte, porque la
               distancia entre los dos es lo que el puesto le deja sin usar. */
            const aplicado = delDiscurso ? (f.discursivo?.horizonte_dias ?? null) : null;
            /* Y el plazo del puesto que se busca, que es la raya a alcanzar. */
            const puesto = c.pedidos?.time_span_dias ?? null;
            return edad && dias ? { edad, dias, aplicado, puesto } : null;
          })(),
          escalones: Object.fromEntries(
            nivelesQueRigen(niveles).map((n) => [n.nombre, n.que])
          ),
          detalle: (() => {
            const suyo = nivelesQueRigen(niveles).find((n) => n.nombre === f.discursivo?.nivel);
            return suyo
              ? {
                  romano: suyo.romano,
                  procesamiento: suyo.procesamiento,
                  horizonte: suyo.horizonte,
                  actual: suyo.actual,
                  ejemplos: suyo.ejemplos
                    .split('\n')
                    .map((e) => e.trim())
                    .filter(Boolean),
                  proyeccion: suyo.proyeccion,
                }
              : null;
          })(),
        }
      : null,
    raven:
      f.raven?.raw !== null && f.raven?.raw !== undefined
        ? { raw: f.raven.raw, resultado: f.raven.resultado ?? '' }
        : null,
    // La misma condición que la sección: una técnica sin un solo resultado no
    // se puede declarar como usada.
    tecnicas: tecnicas(c.pedidos?.baterias?.codigo ?? null, hayBenziger),
    crudo: {
      sumario: (f.sumario?.crudo as { texto?: string } | null)?.texto ?? null,
      protocolo: f.manchas.map((m) => ({
        lamina: m.lamina ?? '—',
        n: m.n_respuesta,
        localizacion: [m.localizacion, m.n_localizacion].filter(Boolean).join(' '),
        determinantes: (m.determinantes ?? []).join('.'),
        fq: m.fq ?? '',
        par: Boolean(m.par),
        contenidos: (m.contenidos ?? []).join(', '),
        popular: Boolean(m.popular),
        z: m.z,
        ccee: (m.cc_ee ?? []).join(', ') + (m.agc ? (m.cc_ee?.length ? ', AgC' : 'AgC') : ''),
      })),
      // Las claves son el número de lámina y llegan como texto: se ordenan por
      // número, que si no la 10 sale entre la 1 y la 2.
      raven: Object.entries(f.sesionRaven?.respuestas ?? {})
        .map(([lamina, opcion]) => ({ lamina: Number(lamina), opcion }))
        .filter((r) => Number.isFinite(r.lamina))
        .sort((a, b) => a.lamina - b.lamina),
    },
    faltantes,
    avisos: [],
  };

  // Lo que choca, con lo mismo que lee el cliente: las bandas con la exigencia
  // de este informe y el potencial contado como lo cuenta la escalera.
  const romanoANumero = (r: string | null | undefined) =>
    r ? ESTRATOS_DEL_MODELO.slice(0, 5).findIndex((e) => e.romano === r) + 1 : 0;
  const hoy = inf.discursivo?.detalle?.romano;
  const delPuesto = inf.discursivo?.puesto?.romano;
  const conPuntaje = inf.competencias.filter((x) => x.puntaje !== null);
  inf.avisos = revisar({
    nivel: inf.nivel?.clave ?? null,
    bajas: conPuntaje.filter((x) => bandaDe(x.puntaje, inf.exigencia) === 'Bajo').map((x) => x.nombre),
    conPuntaje: conPuntaje.length,
    alcanza: hoy && delPuesto ? romanoANumero(hoy) - romanoANumero(delPuesto) : null,
    lecturas,
    cuadrante: preferentes[0]?.clave ?? null,
  });
  // Si el perfil adulto puede ser adaptado: es para quien firma, que lo
  // explora con la persona, y no una afirmación para el cliente.
  if (bz) {
    for (const texto of adaptacionDe(preferentes[0]?.clave ?? null, bz.filas, bz.alerta)) {
      inf.avisos.push({ tipo: 'perfil', texto });
    }
  }
  return inf;
}

export { bandaDe, porArea };
