import curvasDelPapel from './curvas-jaques.json';

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
 * **Son un redibujo de la lámina publicada.** Cada límite entre dos bandas
 * arranca a los veinte años en un escalón de la escalera y sube hasta cruzar, a
 * los setenta, el techo de un estrato: el límite entre la primera banda y la
 * segunda pasa por los tres meses (techo del estrato I), el siguiente por el año
 * (techo del II), el siguiente por los dos años, y así. Las bandas de arriba
 * siguen subiendo a los sesenta y cinco mientras las de abajo ya se aplanaron
 * alrededor de los cincuenta.
 *
 * La curva de cada límite es una logística de cuatro constantes ajustadas sobre
 * la lámina (ver {@link limiteDeBanda}).
 * **Cerca de un límite, la banda es un criterio y no una medición**: el diagrama
 * ubica, no dictamina, y así hay que leerlo cuando el punto cae sobre una raya.
 *
 * Sin `server-only`: lo usan la ficha, donde se cargan los dos datos, y el
 * informe, donde se dibuja.
 */

/** Desde y hasta qué edad se dibuja, como en la lámina. */
export const EDAD_MIN = 20;
export const EDAD_MAX = 70;

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
  // El piso del cuadro. No hay celda debajo del día: la más baja es IB, que va
  // de un día a una semana.
  { dias: 1, texto: '1 día', celda: '' },
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
  { dias: 25550, texto: '70 años', celda: 'VIIIB' },
  { dias: 31025, texto: '85 años', celda: 'VIIIM' },
  { dias: 36500, texto: '100 años', celda: 'VIIIA' },
] as const;

/** El escalón más alto del diagrama: el techo de la franja VIIA. */
export const ALTO = ESCALERA.length - 1;

/**
 * El piso del cuadro.
 *
 * Una celda por debajo de "1 día", que la lámina dibuja sin etiqueta de tiempo
 * ni de sub-estrato. Ninguna de nuestras curvas la cruza (la más baja está en
 * 0,74 a los veinte años), pero el cuadro se cierra ahí y no en el día.
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
  {
    romano: 'VIII',
    desde: 21,
    hasta: 24,
    nombre: 'Estratégico corporativo',
    mide: false,
    grupo: 'Estratégico corporativo',
  },
] as const;

export type Estrato = (typeof ESTRATOS)[number];

/**
 * El alto de una celda del eje, y de ahí la escala vertical del cuadro.
 *
 * **Las celdas no miden todas lo mismo.** Las de los estratos I y II, más la
 * celda sin nombre de abajo, se dibujan al 70% de las de arriba: medidas sobre
 * la lámina dan 66 píxeles contra 92. Dibujarlas todas iguales estira la mitad
 * de abajo del cuadro y las curvas dejan de pasar por donde pasan en el papel.
 */
export const CELDA_BAJA = 0.7;

/** Hasta qué escalón valen las celdas bajas: el año, techo del estrato II. */
export const HASTA_CELDA_BAJA = 6;

/** Dónde queda el codo de la escala, en unidades de celda alta. */
const CODO = (HASTA_CELDA_BAJA - PISO) * CELDA_BAJA;

/**
 * A qué altura sobre el piso cae un escalón, en unidades de celda alta.
 *
 * Es la escala vertical del diagrama: `alturaDelEscalon(ALTO)` da el alto total
 * del cuadro, con el que se normaliza.
 */
export function alturaDelEscalon(b: number): number {
  if (b <= HASTA_CELDA_BAJA) return (b - PISO) * CELDA_BAJA;
  return CODO + (b - HASTA_CELDA_BAJA);
}

/** La vuelta: de una altura del papel al escalón que le toca. */
export function escalonDeAltura(alt: number): number {
  return alt <= CODO ? alt / CELDA_BAJA + PISO : HASTA_CELDA_BAJA + (alt - CODO);
}

/**
 * Las once curvas de la lámina, de abajo hacia arriba, punto por punto.
 *
 * Son once y no diez: la lámina dibuja los once límites que separan los diez
 * modos, y el de más abajo es el piso del modo I. Ese piso nace a los veintiocho
 * años y no a los veinte, porque antes viene por debajo del cuadro, toca la
 * línea del día a los cincuenta y seis y desde ahí baja: es la única que
 * desciende.
 *
 * **El modo I incluye lo que queda debajo de esa curva.** No hay un modo por
 * debajo del I, así que su franja llega hasta el piso del cuadro y su nombre en
 * el margen derecho se escribe sobre todo ese alto.
 *
 * **Son puntos leídos del papel y no una fórmula.** Se probó ajustar una
 * exponencial por curva y no tiene la forma de estas: fijando el arranque se
 * iba el final, y al revés. Así que cada curva son siete nodos y entre ellos
 * pasa una curva suave ({@link curvaSuave}). Siete alcanzan para que el trazo
 * siga al del papel sin tramos largos donde no se lo pueda corregir, y son
 * pocos como para leerlos de un vistazo en `curvas-jaques.json`.
 *
 * **Los puntos están medidos sobre el Gráfico de Progreso del Potencial** con
 * sus curvas repasadas a mano: se digitalizó el dibujo, se calibró la
 * cuadrícula línea por línea para descontar la perspectiva de la foto y se
 * separaron las curvas por color. Los dos extremos de cada una están clavados a
 * esta tabla, leída del papel y confirmada a ojo:
 *
 * | curva | nace a los 20 en | llega a |
 * |-------|------------------|---------|
 * | 1     | el borde de abajo, y recién a los 28 | toca el día a los 56 y baja: a los 70 queda apenas debajo |
 * | 2     | el borde de abajo | 3 meses a los 70 |
 * | 3     | 1 día             | 1 año |
 * | 4     | 1 mes             | 2 años |
 * | 5     | 6 meses           | 5 años |
 * | 6     | entre 9 meses y 1 año | 10 años, apenas debajo |
 * | 7     | apenas debajo de 16 meses | entre 17 y 20 años |
 * | 8     | apenas arriba de 20 meses | 40 años, apenas arriba |
 * | 9     | apenas arriba de 2 años | 70 años, a mitad de celda |
 * | 10    | apenas debajo de 4 años | los 100 años a los 65: se va por arriba |
 * | 11    | apenas arriba de 5 años | los 100 años a los 54: se va por arriba |
 *
 * **Las tres de arriba terminan por debajo del techo de su estrato.** El modelo
 * dice que el modo VI llega a los veinte años de horizonte, el VII a los
 * cincuenta y el VIII a los cien; en el papel esas tres curvas terminan en
 * diecisiete años y medio, cuarenta y setenta. Se probó llevarlas a su techo y
 * no se puede: la novena hay que subirla un escalón y medio y la curva entera se
 * despega del trazo, hasta una celda y media a los sesenta y cinco. Así que
 * mandan los puntos del papel, que es lo que el instrumento usa para ubicar a
 * alguien; la diferencia con el modelo queda para leerla, no para corregirla.
 *
 * Las seis de abajo sí terminan clavadas en el techo de un estrato, y eso es lo
 * que da por buena la lectura: la escala no se corrió.
 *
 * Jaques no publica una fórmula de estas curvas: las dedujo de la progresión
 * real de los ingresos de casi doscientas personas seguidas entre dieciocho y
 * veinticinco años, y las publica como dibujo. Por eso acá son puntos.
 *
 * **Lo que se guarda de cada curva es su perfil de pendientes.** Se mide cuánto
 * sube el trazo en cada tramo de dos años, se suaviza ese perfil para sacarle el
 * ruido del marcador y se reconstruye la curva sumando. Así conserva su forma:
 * hay curvas que en el medio suben un poco más que al principio, y forzarlas a
 * que la pendiente sólo baje las deja rectas.
 *
 * Los dos primeros años del trazo y el último quedan afuera de la medición
 * porque ahí el marcador deja su punta y corre la lectura; esos tramos se
 * completan siguiendo la tendencia de los vecinos.
 *
 * Cada entrada es `[edad, escalón]`, y viven en `curvas-jaques.json`. **Son
 * fijos**: se calcaron una vez contra el papel y con eso queda todo el sistema,
 * el diagrama de la ficha, el del informe y la banda que se le asigna a cada
 * persona. Si alguna vez hubiera que corregir una, se editan los números del
 * archivo y se corre el control que está en `RETOMAR-lamina-jaques.md`.
 */
const CURVAS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> =
  curvasDelPapel.curvas as unknown as ReadonlyArray<ReadonlyArray<readonly [number, number]>>;

/** Cuántos modos dibuja la lámina: uno por cada franja entre dos curvas. */
export const CUANTAS_BANDAS = CURVAS.length - 1;

/**
 * Las pendientes de nodo de la curva que pasa por esos puntos.
 *
 * Se eligen de manera que la **curvatura** no salte de un tramo al siguiente,
 * que es lo que hace que el trazo se vea redondo: con la pendiente puesta a ojo
 * (el promedio de las dos secantes) la tangente sigue, pero el radio cambia de
 * golpe en cada nodo y el ojo lee un codo. Salen de resolver, para toda la
 * curva a la vez, el sistema que iguala la segunda derivada a los dos lados de
 * cada nodo; en los extremos se la deja en cero, que es la condición de una
 * regla flexible sin sujetar.
 *
 * **Donde la curva cambia de dirección la pendiente se clava en cero.** Ahí el
 * cambio de curvatura es el dibujo y no un defecto: es el pico. Sin eso el
 * máximo se corre de lugar y se pasa de largo, y la primera curva tiene que
 * tocar el día a los cincuenta y seis exactos. Cada cambio de dirección parte
 * la curva, y el sistema se resuelve por separado a cada lado.
 *
 * Es también lo que impide que dos curvas se toquen: entre dos picos la curva
 * no se pasa del nodo más alto, así que ninguna invade la banda de al lado.
 */
function pendientesDeNodo(X: readonly number[], Y: readonly number[]): number[] {
  const n = X.length;
  const h: number[] = [];
  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    h.push(X[k + 1] - X[k]);
    d.push((Y[k + 1] - Y[k]) / h[k]);
  }
  if (n === 2) return [d[0], d[0]];

  const m: (number | null)[] = new Array(n).fill(null);
  const cortes: number[] = [0];
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) {
      m[k] = 0;
      cortes.push(k);
    }
  }
  cortes.push(n - 1);

  for (let c = 0; c < cortes.length - 1; c++) {
    const desde = cortes[c];
    const hasta = cortes[c + 1];
    const libres: number[] = [];
    for (let k = desde; k <= hasta; k++) if (m[k] === null) libres.push(k);
    if (libres.length === 0) continue;

    const N = libres.length;
    const A: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
    const r: number[] = new Array(N).fill(0);
    const fila = new Map(libres.map((k, i) => [k, i]));
    libres.forEach((k, i) => {
      const pon = (j: number, v: number) => {
        const col = fila.get(j);
        if (col === undefined) r[i] -= v * (m[j] as number);
        else A[i][col] += v;
      };
      if (k === 0) {
        pon(0, 2 / h[0]);
        pon(1, 1 / h[0]);
        r[i] += (3 * d[0]) / h[0];
      } else if (k === n - 1) {
        pon(n - 2, 1 / h[n - 2]);
        pon(n - 1, 2 / h[n - 2]);
        r[i] += (3 * d[n - 2]) / h[n - 2];
      } else {
        pon(k - 1, 1 / h[k - 1]);
        pon(k, 2 * (1 / h[k - 1] + 1 / h[k]));
        pon(k + 1, 1 / h[k]);
        r[i] += 3 * (d[k - 1] / h[k - 1] + d[k] / h[k]);
      }
    });

    /* Gauss con pivoteo: el sistema tiene a lo sumo siete incógnitas. */
    for (let i = 0; i < N; i++) {
      let piv = i;
      for (let q = i + 1; q < N; q++) if (Math.abs(A[q][i]) > Math.abs(A[piv][i])) piv = q;
      [A[i], A[piv]] = [A[piv], A[i]];
      [r[i], r[piv]] = [r[piv], r[i]];
      for (let q = i + 1; q < N; q++) {
        const w = A[q][i] / A[i][i];
        if (!w) continue;
        for (let s = i; s < N; s++) A[q][s] -= w * A[i][s];
        r[q] -= w * r[i];
      }
    }
    const sol: number[] = new Array(N);
    for (let i = N - 1; i >= 0; i--) {
      let acum = r[i];
      for (let q = i + 1; q < N; q++) acum -= A[i][q] * sol[q];
      sol[i] = acum / A[i][i];
    }
    libres.forEach((k, i) => {
      m[k] = sol[i];
    });
  }

  return m as number[];
}

/**
 * Una curva suave que pasa por los puntos dados, sin inventar picos.
 *
 * Entre dos nodos va una cúbica; las pendientes de los nodos salen de
 * {@link pendientesDeNodo}, que las elige para que la curvatura no salte.
 *
 * Trabaja en la altura del papel, donde las curvas son suaves de verdad, y
 * devuelve escalones. Fuera del tramo sigue derecho con la pendiente del
 * extremo: hace falta para que la curva 1 tenga un valor antes de los 28 (por
 * debajo del cuadro) y las dos de arriba después de irse (por encima).
 */
export function curvaSuave(puntos: ReadonlyArray<readonly [number, number]>, edad: number): number {
  const n = puntos.length;
  if (n === 0) return 0;
  if (n === 1) return puntos[0][1];
  const X = puntos.map((p) => p[0]);
  const Y = puntos.map((p) => alturaDelEscalon(p[1]));
  const m = pendientesDeNodo(X, Y);

  if (edad <= X[0]) return escalonDeAltura(Y[0] + m[0] * (edad - X[0]));
  if (edad >= X[n - 1]) return escalonDeAltura(Y[n - 1] + m[n - 1] * (edad - X[n - 1]));

  let k = 0;
  while (k < n - 2 && X[k + 1] <= edad) k++;
  const h = X[k + 1] - X[k];
  const t = (edad - X[k]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const alt =
    (2 * t3 - 3 * t2 + 1) * Y[k] +
    (t3 - 2 * t2 + t) * h * m[k] +
    (-2 * t3 + 3 * t2) * Y[k + 1] +
    (t3 - t2) * h * m[k + 1];
  return escalonDeAltura(alt);
}

/** Un tramo de curva, en edad y altura de papel, con sus dos puntos de tiro. */
export type TramoDeCurva = {
  edad: number;
  alto: number;
  tiroEdad1: number;
  tiroAlto1: number;
  tiroEdad2: number;
  tiroAlto2: number;
  edadFin: number;
  altoFin: number;
};

/**
 * La curva `i` partida en los tramos que la dibujan, entre dos edades.
 *
 * Cada tramo es la misma cúbica que evalúa {@link curvaSuave}, escrita como una
 * curva de Bézier: se dibuja con un solo comando `C` de SVG y sale idéntica,
 * sin la escalerita que deja muestrear la curva año a año. Seis tramos por
 * curva en lugar de doscientos puntos, y el trazo es la curva y no una
 * poligonal que se le parece.
 *
 * Va en altura de papel y no en escalones porque en altura la cúbica es exacta;
 * los escalones tienen el codo del año y ahí la cuenta deja de ser un polinomio.
 * Los pedazos que quedan fuera de los nodos (la curva 1 antes de los veintiocho,
 * las dos de arriba después de irse por el techo) salen derechos, con la
 * pendiente del extremo, igual que en {@link curvaSuave}.
 */
export function tramosDeLamina(i: number, desde = EDAD_MIN, hasta = EDAD_MAX): TramoDeCurva[] {
  const puntos = CURVAS[i - 1];
  if (!puntos || puntos.length < 2) return [];
  const X = puntos.map((p) => p[0]);
  const Y = puntos.map((p) => alturaDelEscalon(p[1]));
  const n = X.length;
  const m = pendientesDeNodo(X, Y);

  const tramo = (
    x0: number,
    y0: number,
    m0: number,
    x1: number,
    y1: number,
    m1: number,
  ): TramoDeCurva => {
    const h = (x1 - x0) / 3;
    return {
      edad: x0,
      alto: y0,
      tiroEdad1: x0 + h,
      tiroAlto1: y0 + m0 * h,
      tiroEdad2: x1 - h,
      tiroAlto2: y1 - m1 * h,
      edadFin: x1,
      altoFin: y1,
    };
  };

  const salida: TramoDeCurva[] = [];
  if (desde < X[0]) {
    const y0 = Y[0] + m[0] * (desde - X[0]);
    salida.push(tramo(desde, y0, m[0], X[0], Y[0], m[0]));
  }
  for (let k = 0; k < n - 1; k++) {
    if (X[k + 1] <= desde || X[k] >= hasta) continue;
    salida.push(tramo(X[k], Y[k], m[k], X[k + 1], Y[k + 1], m[k + 1]));
  }
  if (hasta > X[n - 1]) {
    const y1 = Y[n - 1] + m[n - 1] * (hasta - X[n - 1]);
    salida.push(tramo(X[n - 1], Y[n - 1], m[n - 1], hasta, y1, m[n - 1]));
  }
  return salida;
}

/** Dónde está una de las once curvas a cierta edad, en escalones. */
export function curvaDeLamina(i: number, edad: number): number {
  const c = CURVAS[i - 1];
  return c ? curvaSuave(c, edad) : 0;
}

/**
 * El límite superior de la banda `n`, en escalones.
 *
 * La banda del modo `n` va de la curva `n` a la `n+1`: el modo I es la franja
 * entre el día y los tres meses a los setenta, el II entre los tres meses y el
 * año, y así.
 */
export function limiteDeBanda(n: number, edad: number): number {
  return curvaDeLamina(n + 1, edad);
}

/** El piso de la banda `n`, que es la curva de abajo. */
export function pisoDeBanda(n: number, edad: number): number {
  return curvaDeLamina(n, edad);
}

/**
 * En qué modo cae alguien de esta edad con esta capacidad, con decimales.
 *
 * Por bisección sobre {@link limiteDeBanda}: el modo no se despeja a mano
 * porque cada curva tiene los suyos. Con decimal porque sirve para leer qué tan
 * adentro de su banda está la persona; para asignar la banda está {@link bandaDe}.
 */
export function modoDe(edad: number, escalon: number): number {
  if (escalon <= limiteDeBanda(1, edad)) {
    return escalon <= PISO ? 0 : escalon / Math.max(0.001, limiteDeBanda(1, edad));
  }
  for (let n = 1; n < CUANTAS_BANDAS; n++) {
    const abajo = limiteDeBanda(n, edad);
    const arriba = limiteDeBanda(n + 1, edad);
    if (escalon <= arriba) return n + (escalon - abajo) / (arriba - abajo);
  }
  return CUANTAS_BANDAS;
}

/**
 * A qué edad un modo termina de crecer.
 *
 * Se toma el noventa por ciento del recorrido de su curva de arriba entre los
 * veinte y los setenta: de ahí en adelante lo que queda por subir no llega a un
 * tercio de celda.
 */
export function edadEnQueMadura(modo: number): number {
  const i = modo + 1;
  const a0 = alturaDelEscalon(curvaDeLamina(i, EDAD_MIN));
  const a1 = alturaDelEscalon(curvaDeLamina(i, EDAD_MAX));
  const meta = a0 + 0.9 * (a1 - a0);
  for (let e = EDAD_MIN; e <= EDAD_MAX; e += 0.25) {
    if (alturaDelEscalon(curvaDeLamina(i, e)) >= meta) return e;
  }
  return EDAD_MAX;
}

/**
 * A qué edad la curva `i` de la lámina pasa por un escalón, si pasa dentro del
 * cuadro.
 *
 * Sirve para saber dónde una curva se va por arriba: las dos más altas cruzan
 * los cien años antes de los setenta, la undécima a los 54 y la décima a los 65.
 * Arriba de esa raya la lámina las sigue dibujando un poco más, y ahí es donde
 * entra el nombre del modo más alto.
 */
export function edadEnQueLlega(i: number, escalon: number): number | null {
  let previo = curvaDeLamina(i, EDAD_MIN);
  for (let e = EDAD_MIN + 0.1; e <= EDAD_MAX; e += 0.1) {
    const actual = curvaDeLamina(i, e);
    if (previo < escalon && actual >= escalon) {
      return e - 0.1 + (0.1 * (escalon - previo)) / (actual - previo);
    }
    previo = actual;
  }
  return null;
}

/**
 * Cuántos estratos por debajo de lo que puede está el trabajo que hoy le dan.
 *
 * Cero cuando el trabajo le queda a la medida o le exige más. Es una resta de
 * estratos enteros y no de escalones: dentro del mismo estrato, que el plazo
 * caiga una celda más abajo es ruido de medición y no un puesto que le queda
 * chico.
 *
 * Se calcula y no se tilda a mano: los dos números ya están cargados, uno del
 * discurso y otro de la entrevista, y pedir además una opinión sobre ellos
 * abría la puerta a que el informe dijera lo contrario de lo que muestran.
 */
export function brechaDeAplicacion(
  estratoDeLaPersona: number | null,
  diasAsignados: number | null | undefined
): number {
  if (!estratoDeLaPersona || !diasAsignados || diasAsignados <= 0) return 0;
  const suyo = ESTRATOS.findIndex(
    (e) => e.romano === estratoDeEscalon(escalonDe(diasAsignados)).romano
  );
  return Math.max(0, estratoDeLaPersona - (suyo + 1));
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
  for (let n = 1; n <= CUANTAS_BANDAS; n++) {
    if (e <= limiteDeBanda(n, edad)) return n;
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
 * Dónde cae un puesto dentro de su estrato.
 *
 * Cada estrato se subdivide en tres celdas, que son las que la lámina rotula en
 * su columna: IIB abajo, IIM en el medio y IIA arriba. Es la granularidad del
 * propio modelo, y estar en A es estar a punto de pasar al estrato siguiente.
 *
 * **Gradúa el puesto y no a la persona.** Jaques gradúa midiendo el plazo de la
 * tarea más larga del rol: el número cae en un rango y ese rango es el grado,
 * sin que nadie interprete nada (*Requisite Organization*, "To Classify
 * Roles"). Para la capacidad de una persona no da método de graduación, y el
 * análisis del discurso tiene cuatro modos, o sea la resolución de un estrato
 * entero: pedirle que distinga tres celdas adentro es pedirle algo que no mide.
 */
export const CELDAS = [
  { clave: 'A', nombre: 'A · alto', dice: 'En el borde de arriba, a punto de pasar al siguiente.' },
  { clave: 'M', nombre: 'M · medio', dice: 'En el medio de su estrato, sostenido.' },
  { clave: 'B', nombre: 'B · bajo', dice: 'Recién entrando en ese estrato.' },
] as const;

export type CeldaDelEstrato = (typeof CELDAS)[number]['clave'];

/**
 * En qué celda de su estrato cae un plazo, que es cómo Jaques gradúa un puesto.
 *
 * Los tres tercios de cada estrato son tres escalones de la escalera, y el
 * escalón en el que cae el plazo dice cuál: el de abajo es B, el del medio M y
 * el de arriba A. Un plazo justo sobre el techo del estrato es del estrato de
 * abajo y por lo tanto A, que es como se lee la lámina.
 */
export function celdaDeSpan(dias: number | null | undefined): CeldaDelEstrato | null {
  if (!dias || !Number.isFinite(dias) || dias <= 0) return null;
  const e = escalonDe(dias);
  const estrato = estratoDeEscalon(e);
  /* Cuánto falta para el techo del estrato, en escalones: menos de uno es la
     celda de arriba, menos de dos la del medio, y el resto la de abajo. */
  const alTecho = estrato.hasta - e;
  if (alTecho <= 1) return 'A';
  if (alTecho <= 2) return 'M';
  return 'B';
}

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
 * corresponde es el de su capacidad. Esa capacidad se lee en el discurso, así
 * que lo que hay es un estrato y no un número de días: el punto va en el medio
 * de su franja, que es donde no queda apoyado sobre ninguna de las dos rayas
 * que la limitan.
 *
 * **Sin discurso codificado no hay punto**, y el diagrama no se dibuja.
 */
export function diasParaElDiagrama(porDiscurso: Estrato | null): number | null {
  /* Sin el discurso codificado no hay punto. El plazo del trabajo asignado mide
     hasta dónde la dejaron llegar y no lo que puede: dibujarlo igual ponía en
     la lámina, con la misma marca, un dato que dice otra cosa. */
  if (!porDiscurso) return null;
  /* En el medio del estrato, que es toda la precisión que da el discurso: son
     cuatro modos para cuatro estratos, y decir en qué tercio del estrato cae la
     persona sería inventar una resolución que el método no tiene.

     El plazo del trabajo no entra acá: lo que se está diciendo es la capacidad,
     y eso se leyó en el discurso. */
  return diasDeEscalon(Math.max(0, porDiscurso.hasta - 1.5));
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
