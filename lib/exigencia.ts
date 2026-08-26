/**
 * La exigencia del sistema: dónde corta cada banda del puntaje.
 *
 * El puntaje de una competencia va de 0 a 100 y el informe lo nombra Bajo,
 * Adecuado, Alto o Sobresaliente. Dónde corta cada una es una decisión de
 * negocio y no una propiedad del test: el mismo 62 es Adecuado para un puesto
 * operativo y puede ser Bajo para una gerencia.
 *
 * Por eso son perfiles guardados y no una constante. Hay uno predeterminado y
 * el pedido, o un candidato en particular, puede llevar otro. **Lo que cambia
 * es cómo se nombra el puntaje, nunca el puntaje**: mover la exigencia no
 * recalcula ninguna competencia, cambia el rótulo que le toca.
 *
 * Sin `server-only`: la pantalla que las mueve la necesita.
 */

export type Exigencia = {
  id: string;
  nombre: string;
  /** Desde dónde empieza cada banda. Bajo es todo lo que queda debajo de `adecuado`. */
  sobresaliente: number;
  alto: number;
  adecuado: number;
  predeterminada: boolean;
  notas: string | null;
};

export type Banda = 'Sobresaliente' | 'Alto' | 'Adecuado' | 'Bajo';

/**
 * La que rige cuando no hay ninguna guardada.
 *
 * Es la que venía en el código: los dos cortes de arriba son de la psicóloga y
 * el de abajo corta donde corta Hogan, el estándar de evaluación laboral, con
 * bajo hasta el 35 y alto desde el 65.
 */
export const DE_FABRICA: Exigencia = {
  id: 'fabrica',
  nombre: 'Estándar',
  sobresaliente: 80,
  alto: 65,
  adecuado: 35,
  predeterminada: true,
  notas: null,
};

/** Las cuatro bandas de una exigencia, de la más alta a la más baja. */
export function bandasDe(e: Exigencia): { nombre: Banda; desde: number; hasta: number }[] {
  return [
    { nombre: 'Sobresaliente' as const, desde: e.sobresaliente, hasta: 100 },
    { nombre: 'Alto' as const, desde: e.alto, hasta: e.sobresaliente - 1 },
    { nombre: 'Adecuado' as const, desde: e.adecuado, hasta: e.alto - 1 },
    { nombre: 'Bajo' as const, desde: 0, hasta: e.adecuado - 1 },
  ];
}

/** Cómo se nombra un puntaje con esta exigencia. Null cuando no hay puntaje. */
export function bandaDe(puntaje: number | null, e: Exigencia = DE_FABRICA): Banda | null {
  if (puntaje === null) return null;
  if (puntaje >= e.sobresaliente) return 'Sobresaliente';
  if (puntaje >= e.alto) return 'Alto';
  if (puntaje >= e.adecuado) return 'Adecuado';
  return 'Bajo';
}

/** Hasta dónde puede llegar el nombre de un perfil. */
export const LARGO_NOMBRE = 60;

/**
 * Si los tres cortes sirven.
 *
 * Tienen que estar en orden y separados: dos cortes pegados dejan una banda de
 * un punto, que en la práctica es una banda que no le toca a nadie y una escala
 * que miente sobre lo que distingue.
 */
export function cortesValidos(c: {
  sobresaliente: number;
  alto: number;
  adecuado: number;
}): string | null {
  const enteros = [c.adecuado, c.alto, c.sobresaliente];
  if (!enteros.every((n) => Number.isInteger(n) && n >= 1 && n <= 100)) {
    return 'Los tres cortes tienen que ser números enteros de 1 a 100.';
  }
  if (!(c.adecuado < c.alto && c.alto < c.sobresaliente)) {
    return 'Los cortes tienen que ir en orden: Adecuado por debajo de Alto, y Alto por debajo de Sobresaliente.';
  }
  if (c.alto - c.adecuado < 5 || c.sobresaliente - c.alto < 5) {
    return 'Entre un corte y el siguiente tienen que quedar al menos cinco puntos, para que la banda del medio distinga algo.';
  }
  return null;
}

/**
 * El color de cada banda.
 *
 * Bajo va partido en dos: la mitad de abajo en rojo y la de arriba en naranja.
 * No son dos bandas, es una sola que se informa junta, pero un 5 y un 30 no se
 * leen igual y el color lo dice sin nombrarlo.
 */
const COLOR: Record<Banda | 'MuyBajo', [number, number, number]> = {
  Sobresaliente: [58, 122, 74],
  Alto: [110, 163, 118],
  Adecuado: [67, 100, 143],
  Bajo: [193, 89, 26],
  MuyBajo: [140, 59, 59],
};

/**
 * El color que le toca a un puntaje con esta exigencia.
 *
 * Sale de la banda y no de un número fijo, así que sigue a los cortes: con una
 * exigencia más baja, el 30 pasa a ser Adecuado y se pinta de azul. Con los
 * tramos escritos a mano ese 30 salía naranja al lado de la palabra Adecuado.
 */
export function colorDe(puntaje: number, e: Exigencia = DE_FABRICA): [number, number, number] {
  const banda = bandaDe(puntaje, e);
  if (banda !== 'Bajo') return COLOR[banda ?? 'Bajo'];
  return puntaje < e.adecuado / 2 ? COLOR.MuyBajo : COLOR.Bajo;
}

/** Los cortes del degradado de la barra, en porcentaje de la escala. */
export function tramosDe(e: Exigencia): { desde: number; rgb: [number, number, number] }[] {
  return [
    { desde: 0, rgb: COLOR.MuyBajo },
    { desde: e.adecuado / 2, rgb: COLOR.Bajo },
    { desde: e.adecuado, rgb: COLOR.Adecuado },
    { desde: e.alto, rgb: COLOR.Alto },
    { desde: e.sobresaliente, rgb: COLOR.Sobresaliente },
  ];
}
