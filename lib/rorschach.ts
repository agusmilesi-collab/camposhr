/**
 * El vocabulario de la codificación Rorschach, copiado de Airtable.
 *
 * Las opciones y los colores salen de la tabla "Tests Proyectivos"
 * (`tblhq78e1RSmvztC5`), leídos de su esquema: son los mismos que ven las
 * evaluadoras hoy, con el mismo nombre y el mismo color. Este archivo se
 * genera desde ese esquema, así que no se edita a mano; si en Airtable cambia
 * una opción, se vuelve a generar.
 *
 * El color viaja como nombre de la paleta de Airtable y `TONO` lo traduce a un
 * valor concreto. Guardar el nombre y no el color deja la equivalencia en un
 * solo lugar el día que el OS tenga paleta propia.
 */

export type Opcion = { v: string; c: string };

/** La paleta pastel de Airtable, en los tonos que usa esta tabla. */
export const TONO: Record<string, string> = {
  blueLight2: '#cfdfff',
  cyanLight2: '#d0f0fd',
  tealLight2: '#c2f5e9',
  greenLight2: '#d1f7c4',
  yellowLight2: '#ffeab6',
  orangeLight2: '#fee2d5',
  redLight2: '#ffdce5',
  pinkLight2: '#ffdaf6',
  purpleLight2: '#ede2fe',
  grayLight2: '#eaeaea',
  blueLight1: '#9cc7ff',
  cyanLight1: '#77d1f3',
  tealLight1: '#72ddc3',
  greenLight1: '#93e088',
  yellowLight1: '#ffd66e',
};

/** El color de una opción, para pintarla igual que en Airtable. */
export function tonoDe(opciones: Opcion[], valor: string): string {
  return TONO[opciones.find((o) => o.v === valor)?.c ?? ''] ?? TONO.grayLight2;
}

export const LAMINA: Opcion[] = [
  { v: 'I', c: 'blueLight2' },
  { v: 'II', c: 'blueLight2' },
  { v: 'III', c: 'blueLight2' },
  { v: 'IV', c: 'blueLight2' },
  { v: 'V', c: 'blueLight2' },
  { v: 'VI', c: 'blueLight2' },
  { v: 'VII', c: 'blueLight2' },
  { v: 'VIII', c: 'blueLight2' },
  { v: 'IX', c: 'blueLight2' },
  { v: 'X', c: 'blueLight2' },
  { v: 'Z1', c: 'purpleLight2' },
  { v: 'Z2', c: 'purpleLight2' },
  { v: 'Z3', c: 'purpleLight2' },
];

export const LOCALIZACION: Opcion[] = [
  { v: 'Wo', c: 'blueLight2' },
  { v: 'W+', c: 'cyanLight2' },
  { v: 'Do', c: 'greenLight2' },
  { v: 'WSo', c: 'yellowLight2' },
  { v: 'WS+', c: 'orangeLight2' },
  { v: 'DdSo', c: 'redLight2' },
  { v: 'D+', c: 'pinkLight2' },
  { v: 'Wv', c: 'blueLight2' },
  { v: 'Wv/+', c: 'cyanLight2' },
  { v: 'Dv', c: 'tealLight2' },
  { v: 'Dd', c: 'greenLight2' },
  { v: 'Ddo', c: 'yellowLight2' },
  { v: 'Dd+', c: 'orangeLight2' },
  { v: 'Ddv', c: 'redLight2' },
  { v: 'Ddv/+', c: 'pinkLight2' },
  { v: 'DSo', c: 'purpleLight2' },
  { v: 'DS+', c: 'grayLight2' },
  { v: 'DSv', c: 'blueLight2' },
  { v: 'DdSv', c: 'cyanLight2' },
  { v: 'WSv', c: 'tealLight2' },
  { v: 'DdS+', c: 'blueLight1' },
  { v: 'DdSv/+', c: 'cyanLight1' },
  { v: 'WSv/+', c: 'tealLight1' },
  { v: 'Dv/+', c: 'greenLight1' },
  { v: 'DSv/+', c: 'yellowLight1' },
];

export const DETERMINANTES: Opcion[] = [
  { v: 'F', c: 'blueLight2' },
  { v: 'rF', c: 'cyanLight2' },
  { v: 'Ma', c: 'tealLight2' },
  { v: 'CF', c: 'greenLight2' },
  { v: 'mp', c: 'yellowLight2' },
  { v: 'FMa', c: 'orangeLight2' },
  { v: 'TF', c: 'redLight2' },
  { v: 'FD', c: 'pinkLight2' },
  { v: "FC'", c: 'purpleLight2' },
  { v: 'ma', c: 'grayLight2' },
  { v: 'VF', c: 'blueLight2' },
  { v: 'V', c: 'cyanLight2' },
  { v: 'Mp', c: 'tealLight2' },
  { v: 'FMp', c: 'greenLight2' },
  { v: "C'F", c: 'yellowLight2' },
  { v: 'FC', c: 'redLight2' },
  { v: 'C', c: 'pinkLight2' },
  { v: 'Cn', c: 'purpleLight2' },
  { v: "C'", c: 'grayLight2' },
  { v: 'FT', c: 'blueLight2' },
  { v: 'T', c: 'cyanLight2' },
  { v: 'FV', c: 'tealLight2' },
  { v: 'FY', c: 'greenLight2' },
  { v: 'YF', c: 'yellowLight2' },
  { v: 'Y', c: 'orangeLight2' },
  { v: 'Fr', c: 'redLight2' },
];

export const FQ: Opcion[] = [
  { v: 'O', c: 'blueLight2' },
  { v: '-', c: 'cyanLight2' },
  { v: 'U', c: 'tealLight2' },
  { v: '+', c: 'blueLight2' },
  { v: 'none', c: 'cyanLight2' },
];

export const CONTENIDOS: Opcion[] = [
  { v: 'A', c: 'blueLight2' },
  { v: 'H', c: 'cyanLight2' },
  { v: 'Cg', c: 'tealLight2' },
  { v: 'Art', c: 'greenLight2' },
  { v: 'Bt', c: 'yellowLight2' },
  { v: 'Hh', c: 'orangeLight2' },
  { v: 'Ad', c: 'redLight2' },
  { v: '(Ad)', c: 'pinkLight2' },
  { v: 'Na', c: 'purpleLight2' },
  { v: 'Cs', c: 'grayLight2' },
  { v: 'An', c: 'blueLight2' },
  { v: '(Hd)', c: 'cyanLight2' },
  { v: 'Fd', c: 'tealLight2' },
  { v: '(H)', c: 'blueLight2' },
  { v: 'Hd', c: 'cyanLight2' },
  { v: 'Hx', c: 'tealLight2' },
  { v: '(A)', c: 'greenLight2' },
  { v: 'Ay', c: 'yellowLight2' },
  { v: 'Bl', c: 'orangeLight2' },
  { v: 'Cl', c: 'redLight2' },
  { v: 'Ex', c: 'pinkLight2' },
  { v: 'Fi', c: 'purpleLight2' },
  { v: 'Ge', c: 'grayLight2' },
  { v: 'Ls', c: 'blueLight2' },
  { v: 'Sc', c: 'cyanLight2' },
  { v: 'Sx', c: 'tealLight2' },
  { v: 'Vo', c: 'greenLight2' },
  { v: 'Xy', c: 'yellowLight2' },
  { v: 'Id', c: 'orangeLight2' },
];

export const CC_EE: Opcion[] = [
  { v: 'GHR', c: 'blueLight2' },
  { v: 'AG', c: 'cyanLight2' },
  { v: 'INCOM', c: 'tealLight2' },
  { v: 'COP', c: 'greenLight2' },
  { v: 'PSV', c: 'yellowLight2' },
  { v: 'AB', c: 'orangeLight2' },
  { v: 'PER', c: 'redLight2' },
  { v: 'PHR', c: 'pinkLight2' },
  { v: 'DV', c: 'blueLight2' },
  { v: 'DR', c: 'cyanLight2' },
  { v: 'FABCOM', c: 'tealLight2' },
  { v: 'ALOG', c: 'greenLight2' },
  { v: 'CONTAM', c: 'yellowLight2' },
  { v: 'DV2', c: 'orangeLight2' },
  { v: 'DR2', c: 'redLight2' },
  { v: 'INCOM2', c: 'pinkLight2' },
  { v: 'FABCOM2', c: 'purpleLight2' },
  { v: 'MOR', c: 'grayLight2' },
  { v: 'CFB', c: 'blueLight2' },
  { v: 'CP', c: 'cyanLight2' },
];

