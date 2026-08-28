/**
 * Lee el informe Benziger y saca sus números.
 *
 * El informe lo genera la licencia y es siempre el mismo formulario: cinco
 * páginas con las mismas tablas en los mismos lugares. Por eso se lee con
 * reglas y no con un modelo: el resultado es el mismo siempre, sale gratis y
 * no puede inventar un número que no está.
 *
 * Se lee por posición y no por orden de aparición. En la página de totales hay
 * tres tablas mezcladas y el texto sale intercalado; con las coordenadas cada
 * número cae en su fila y su columna sin ambigüedad.
 *
 * Nada de lo que sale de acá se recalcula: el informe ya trae los totales, y
 * sumarlos por nuestra cuenta sería una segunda fuente que puede no coincidir.
 */

import 'server-only';
import { lectorDePdf } from '@/lib/pdf-lector';

/** Una pieza de texto del PDF, con dónde está. */
type Pieza = { texto: string; x: number; y: number };

async function piezasDe(bytes: Uint8Array, pagina: number): Promise<Pieza[]> {
  const getDocument = await lectorDePdf();
  // Una copia con su propio búfer: el lector le pasa los bytes a su hilo
  // interno y no puede transferir el que llega del formulario.
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  const doc = await getDocument({ data: copia, isEvalSupported: false }).promise;
  const p = await doc.getPage(pagina);
  const { items } = await p.getTextContent();
  const alto = p.getViewport({ scale: 1 }).height;

  return (items as { str?: string; transform?: number[] }[])
    .filter((i) => typeof i.str === 'string' && i.str.trim() && i.transform)
    .map((i) => ({
      texto: (i.str as string).trim(),
      x: Math.round((i.transform as number[])[4]),
      // De abajo hacia arriba a de arriba hacia abajo: se razona como se lee.
      y: Math.round(alto - (i.transform as number[])[5]),
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Lo que está en ese renglón, con la tolerancia de media línea. */
function renglon(piezas: Pieza[], y: number, margen = 6): Pieza[] {
  return piezas.filter((p) => Math.abs(p.y - y) <= margen).sort((a, b) => a.x - b.x);
}

/** El renglón donde aparece un rótulo. */
function dondeDice(piezas: Pieza[], texto: string): Pieza | null {
  return piezas.find((p) => p.texto === texto) ?? null;
}

function aNumero(t: string | undefined): number | null {
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Dónde cae cada columna de la tabla de totales.
 *
 * Sale de la propia cabecera FI BI BD FD y no de una medida fija: si la
 * licencia mueve la tabla, las columnas se siguen encontrando solas.
 */
function columnasDeTotales(piezas: Pieza[]): Record<string, number> | null {
  const fi = piezas.find((p) => p.texto === 'FI');
  if (!fi) return null;
  const cabecera = renglon(piezas, fi.y);
  const x = (t: string) => cabecera.find((p) => p.texto === t)?.x;
  const [xfi, xbi, xbd, xfd] = ['FI', 'BI', 'BD', 'FD'].map(x);
  if (xfi === undefined || xbi === undefined || xbd === undefined || xfd === undefined) return null;
  return { fi: xfi, bi: xbi, bd: xbd, fd: xfd };
}

/** Los cuatro números de una fila, cada uno debajo de su columna. */
function cuatroDe(piezas: Pieza[], y: number, cols: Record<string, number>): (number | null)[] {
  const fila = renglon(piezas, y);
  return ['fi', 'bi', 'bd', 'fd'].map((c) => {
    const celda = fila.find((p) => Math.abs(p.x - cols[c]) <= 14 && /^-?\d+([.,]\d+)?$/.test(p.texto));
    return aNumero(celda?.texto);
  });
}

export type Extraido = {
  cuadrantes: Record<string, unknown>;
  adjetivos: Record<string, unknown>;
  abiertas: Record<string, unknown>;
  estres: Record<string, unknown>;
};

/** Los veinte acontecimientos, con el texto con que los nombra el informe. */
const ACONTECIMIENTOS: [string, string][] = [
  ['ev01', 'Muerte de un miembro cercano'],
  ['ev02', 'Muerte de un amigo cercano'],
  ['ev03', 'enfermedad incapacitante'],
  ['ev04', 'hospitalización'],
  ['ev05', 'pariente cercano con enfermedad grave'],
  ['ev06', 'responsabilidades laborales'],
  ['ev07', 'nueva empresa'],
  ['ev08', 'cantidad de viajes'],
  ['ev09', 'despedido o suspendido'],
  ['ev10', 'dificultades económicas'],
  ['ev11', 'Compra de vivienda'],
  ['ev12', 'Mudanza dentro de la misma ciudad'],
  ['ev13', 'Mudanza a otra ciudad'],
  ['ev14', 'nuevo préstamo'],
  ['ev15', 'Matrimonio o unión'],
  ['ev16', 'Divorcio o terminación'],
  ['ev17', 'Nacimiento de un hijo'],
  ['ev18', 'conflictos de pareja'],
  ['ev19', 'problemas legales'],
  ['ev20', 'accidente'],
];

/** El texto que sigue a una pregunta abierta, hasta la pregunta siguiente. */
function respuestaA(piezas: Pieza[], pregunta: string, siguiente: string | null): string {
  const inicio = piezas.find((p) => p.texto.startsWith(pregunta));
  if (!inicio) return '';
  const fin = siguiente ? piezas.find((p) => p.texto.startsWith(siguiente)) : null;
  return piezas
    .filter(
      (p) =>
        p.y > inicio.y + 4 &&
        (fin ? p.y < fin.y - 4 : p.y < inicio.y + 200) &&
        !p.texto.startsWith('©')
    )
    .map((p) => p.texto)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extraerBenziger(bytes: Uint8Array): Promise<Extraido> {
  const p3 = await piezasDe(bytes, 3);
  const p4 = await piezasDe(bytes, 4);
  const p5 = await piezasDe(bytes, 5);

  // --- Página 3: la tabla de totales ---
  // Las cinco filas cuelgan de los rótulos de la izquierda, que son fijos.
  const filas: [string, string][] = [
    ['trabajo', 'Trabajo como Adulto'],
    ['tiempolibre', 'Tiempo Libre Adulto'],
    ['autopercepcion', 'Autopercepción Adulto'],
    ['total_adulto', 'Total Adulto'],
    ['total_joven', 'Total Joven'],
  ];
  const cuadrantes: Record<string, unknown> = {};
  const cols = columnasDeTotales(p3);
  if (cols) {
    for (const [clave, rotulo] of filas) {
      const ancla = dondeDice(p3, rotulo);
      if (!ancla) continue;
      const [fi, bi, bd, fd] = cuatroDe(p3, ancla.y, cols);
      cuadrantes[`${clave}_fi`] = fi;
      cuadrantes[`${clave}_bi`] = bi;
      cuadrantes[`${clave}_bd`] = bd;
      cuadrantes[`${clave}_fd`] = fd;
    }
  }

  // El nivel de alerta va en dos renglones rotulados Adulto y Joven.
  for (const [clave, rotulo] of [
    ['nivel_alerta_adulto', 'Adulto'],
    ['nivel_alerta_joven', 'Joven'],
  ] as [string, string][]) {
    const ancla = dondeDice(p3, rotulo);
    if (!ancla) continue;
    const n = renglon(p3, ancla.y).find((x) => x.x > ancla.x && /^\d+$/.test(x.texto));
    cuadrantes[clave] = aNumero(n?.texto);
  }

  // --- Página 3: estado emocional, autoimagen y estrés ---
  const adjetivos: Record<string, unknown> = {};
  // Las tres columnas salen de su cabecera POS DET NEG y no de una medida
  // fija: los números se imprimen unos píxeles a la derecha del rótulo, y así
  // se siguen encontrando si la licencia mueve la tabla.
  const columnas: [string, number][] = [];
  for (const c of ['pos', 'det', 'neg']) {
    const x = dondeDice(p3, c.toUpperCase())?.x;
    if (x !== undefined) columnas.push([c, x]);
  }
  // Las cuatro filas de arriba suman la de TOTAL. Las dos primeras son las
  // preguntas 54 y 55, que el informe rotula "Ser" y "Otros": sin ellas el
  // total no cierra, y quedarse solo con 56 y 57 hacía parecer un error de
  // lectura lo que era un dato sin leer.
  for (const [fila, rotulo] of [
    ['q54_ser', '54'],
    ['q55_otros', '55'],
    ['q56', '56'],
    ['q57', '57'],
    ['tot', 'TOT'],
  ] as [string, string][]) {
    // El rótulo de esta tabla está en la primera columna, a la izquierda.
    const ancla = p3.find((p) => p.texto === rotulo && p.x < 130);
    if (!ancla) continue;
    for (const [col, x] of columnas) {
      const celda = renglon(p3, ancla.y).find(
        (p) => Math.abs(p.x - x) <= 14 && /^-?\d+$/.test(p.texto)
      );
      adjetivos[fila === 'tot' ? `tot_${col}` : `${fila}_${col}`] = aNumero(celda?.texto);
    }
  }

  // Los ponderados: el 56 y el 57 de más abajo, cada uno con su palabra al lado.
  const ponderados = p3.filter((p) => (p.texto === '56' || p.texto === '57') && p.x < 240);
  for (const anc of ponderados) {
    const palabra = renglon(p3, anc.y).find((p) => p.x > anc.x && /^[A-Za-zÁÉÍÓÚáéíóúñ]/.test(p.texto));
    if (palabra && !palabra.texto.startsWith('Puntos')) {
      adjetivos[`q${anc.texto}_ponderado`] = palabra.texto;
    }
  }

  const puntos = dondeDice(p3, 'Puntos Estrés');
  const estres: Record<string, unknown> = {
    puntos_estres: puntos
      ? aNumero(renglon(p3, puntos.y).find((p) => p.x > puntos.x)?.texto)
      : null,
  };

  // Las dos listas de adjetivos, cada una debajo de su rótulo.
  for (const [clave, rotulo, hasta] of [
    ['q56_adjetivos', 'Q56 (Últimos 3 años)', 'Q57 (Últimos 3 meses)'],
    ['q57_adjetivos', 'Q57 (Últimos 3 meses)', 'TOTALES'],
  ] as [string, string, string][]) {
    const ancla = dondeDice(p3, rotulo);
    if (!ancla) continue;
    // El texto está centrado contra su rótulo: una línea arriba y otra abajo.
    adjetivos[clave] = p3
      .filter((p) => p.x > 200 && p.y > ancla.y - 12 && p.y < ancla.y + 14)
      .map((p) => p.texto)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const imagen = dondeDice(p3, 'Imagen');
  const adjetivo = dondeDice(p3, 'Adjetivo');
  if (imagen && cols) {
    // Las dos casillas no vienen en un orden fijo: cada una se imprime debajo
    // de la columna del cuadrante que le tocó, las mismas columnas de la tabla
    // de totales. La letra dice cuál es y la posición dice el cuadrante, así
    // que quedarse con la de más a la izquierda no leía una elección sino un
    // orden.
    for (const p of renglon(p3, imagen.y).filter((p) => p.x > imagen.x)) {
      if (p.texto !== 'M' && p.texto !== 'N') continue;
      const cuadrante = (['fi', 'bi', 'bd', 'fd'] as const).find(
        (c) => Math.abs(p.x - cols[c]) <= 14
      );
      if (cuadrante) adjetivos[`imagen_${p.texto.toLowerCase()}`] = cuadrante.toUpperCase();
    }
  }
  if (adjetivo) {
    // El adjetivo viene con su definición entre paréntesis y sigue en el
    // renglón de abajo, así que se toma hasta el rótulo siguiente.
    const siguiente = dondeDice(p3, 'Nivel de Alerta');
    adjetivos.adjetivo_elegido = p3
      .filter(
        (p) =>
          p.x > adjetivo.x &&
          p.y > adjetivo.y - 6 &&
          (siguiente ? p.y < siguiente.y - 6 : p.y < adjetivo.y + 30)
      )
      .map((p) => p.texto)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // --- Página 4: las preguntas abiertas ---
  const abiertas: Record<string, unknown> = {
    q21_disfruta: respuestaA(p4, 'Q21:', 'Q22:'),
    q22_no_disfruta: respuestaA(p4, 'Q22:', 'Q48:'),
    q4_tiempo_libre: respuestaA(p4, 'Q48:', 'Q61:'),
    q61_hace_bien_no_gusta: respuestaA(p4, 'Q61:', null),
  };

  // --- Página 5: los acontecimientos, en el orden de la hoja ---
  const frecuencias = p5
    .filter((p) => /^\d+$/.test(p.texto) && p.x > 400 && p.texto !== '05')
    .map((p) => Number(p.texto));
  ACONTECIMIENTOS.forEach(([clave], i) => {
    estres[clave] = frecuencias[i] ?? null;
  });

  // El informe deja en blanco la casilla de Puntos Estrés cuando el total da
  // cero, en vez de imprimir el cero. Si los veinte acontecimientos vinieron en
  // cero, ese blanco es un cero y no un dato que falta.
  if (
    estres.puntos_estres === null &&
    frecuencias.length === ACONTECIMIENTOS.length &&
    frecuencias.every((n) => n === 0)
  ) {
    estres.puntos_estres = 0;
  }

  return { cuadrantes, adjetivos, abiertas, estres };
}

/**
 * Qué no se pudo leer.
 *
 * El lector va bloque por bloque y sigue de largo cuando no encuentra un
 * rótulo, así que un informe con otra forma se guardaba con la mitad de los
 * campos vacíos y sin avisar. Esta lista es lo que convierte ese silencio en
 * un rechazo: quien sube el archivo se entera en el momento.
 *
 * Las preguntas abiertas quedan afuera a propósito, porque una respuesta en
 * blanco es una respuesta posible.
 */
export function faltantesDe(e: Extraido): string[] {
  const faltan: string[] = [];
  const hay = (grupo: Record<string, unknown>, clave: string) => {
    const v = grupo[clave];
    return v !== null && v !== undefined && v !== '';
  };

  for (const fila of [
    'trabajo',
    'tiempolibre',
    'autopercepcion',
    'total_adulto',
    'total_joven',
  ]) {
    for (const q of ['fi', 'bi', 'bd', 'fd']) {
      if (!hay(e.cuadrantes, `${fila}_${q}`)) faltan.push(`cuadrantes.${fila}_${q}`);
    }
  }
  for (const c of ['nivel_alerta_adulto', 'nivel_alerta_joven']) {
    if (!hay(e.cuadrantes, c)) faltan.push(`cuadrantes.${c}`);
  }

  for (const fila of ['q56', 'q57', 'tot']) {
    for (const col of ['pos', 'det', 'neg']) {
      if (!hay(e.adjetivos, `${fila}_${col}`)) faltan.push(`adjetivos.${fila}_${col}`);
    }
  }
  // Las preguntas 54 y 55 traen un solo número, no los tres: alcanza con que
  // la fila se haya encontrado. Que ese número esté en la columna correcta lo
  // controla el descuadre, porque si no lo está el total deja de cerrar.
  for (const fila of ['q54_ser', 'q55_otros']) {
    if (!['pos', 'det', 'neg'].some((col) => hay(e.adjetivos, `${fila}_${col}`))) {
      faltan.push(`adjetivos.${fila}`);
    }
  }
  for (const c of [
    'q56_ponderado',
    'q57_ponderado',
    'q56_adjetivos',
    'q57_adjetivos',
    'adjetivo_elegido',
    'imagen_m',
    'imagen_n',
  ]) {
    if (!hay(e.adjetivos, c)) faltan.push(`adjetivos.${c}`);
  }

  if (!hay(e.estres, 'puntos_estres')) faltan.push('estres.puntos_estres');
  for (const [clave] of ACONTECIMIENTOS) {
    if (!hay(e.estres, clave)) faltan.push(`estres.${clave}`);
  }

  return faltan;
}

/**
 * Lo que el informe dice de más y tiene que coincidir.
 *
 * Dos cuentas que el propio informe trae hechas y se leen de lugares
 * distintos: si no cierran, algo se leyó mal aunque ningún campo esté vacío.
 * Un número equivocado no se nota, y este es el único modo de que se note.
 */
export function descuadresDe(e: Extraido): string[] {
  const n = (grupo: Record<string, unknown>, k: string) =>
    typeof grupo[k] === 'number' ? (grupo[k] as number) : null;
  const problemas: string[] = [];

  // Los tres bloques del adulto tienen que dar el total del adulto.
  for (const q of ['fi', 'bi', 'bd', 'fd']) {
    const partes = ['trabajo', 'tiempolibre', 'autopercepcion'].map((f) =>
      n(e.cuadrantes, `${f}_${q}`)
    );
    const total = n(e.cuadrantes, `total_adulto_${q}`);
    if (partes.every((p) => p !== null) && total !== null) {
      const suma = partes.reduce((a, b) => (a as number) + (b as number), 0) as number;
      if (suma !== total) {
        problemas.push(`total_adulto_${q}: las filas dan ${suma} y el informe dice ${total}`);
      }
    }
  }

  // Las cuatro filas de estado emocional tienen que dar su fila TOT. Las 54 y
  // 55 aportan a una sola columna, así que en las otras dos cuentan como cero:
  // si en algún informe cayeran en otra columna, esta cuenta deja de cerrar y
  // es justamente lo que hay que enterarse.
  for (const col of ['pos', 'det', 'neg']) {
    const partes = [n(e.adjetivos, `q56_${col}`), n(e.adjetivos, `q57_${col}`)];
    const sueltas = ['q54_ser', 'q55_otros'].map((f) => n(e.adjetivos, `${f}_${col}`) ?? 0);
    const total = n(e.adjetivos, `tot_${col}`);
    if (partes.every((p) => p !== null) && total !== null) {
      const suma = [...(partes as number[]), ...sueltas].reduce((a, b) => a + b, 0);
      if (suma !== total) {
        problemas.push(`tot_${col}: las filas dan ${suma} y el informe dice ${total}`);
      }
    }
  }

  // Los puntos de estrés de la página 3 son la suma de los acontecimientos de
  // la página 5: dos lecturas independientes del mismo número.
  const puntos = n(e.estres, 'puntos_estres');
  const eventos = ACONTECIMIENTOS.map(([c]) => n(e.estres, c));
  if (puntos !== null && eventos.every((v) => v !== null)) {
    const suma = eventos.reduce((a, b) => (a as number) + (b as number), 0) as number;
    if (suma !== puntos) {
      problemas.push(`puntos_estres: los acontecimientos dan ${suma} y el informe dice ${puntos}`);
    }
  }

  return problemas;
}
