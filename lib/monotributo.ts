/**
 * Las escalas del monotributo, para saber cuánto falta para pasarse.
 *
 * Las dos evaluadoras facturan como monotributistas y cada una tiene su
 * categoría. Pasarse del tope no es una multa: es quedar fuera del régimen y
 * tener que inscribirse en el general, con IVA y ganancias, así que el número
 * que importa no es lo que se facturó este mes sino cuánto queda de acá al
 * tope.
 *
 * **Lo que ARCA mira son los últimos doce meses corridos, no el año
 * calendario.** La recategorización es semestral (enero y julio) y toma los
 * ingresos brutos de los doce meses anteriores a ese momento. Por
 * eso la pantalla muestra las tres cuentas: el mes y el año sirven para saber
 * cómo viene el trabajo, y los doce meses son los que deciden la categoría.
 *
 * **Los topes se actualizan dos veces al año.** ARCA los mueve en enero y en
 * julio con la inflación del semestre anterior, y cuando eso pasa hay que
 * cambiar la tabla de acá: son números escritos, no calculados. La fecha de
 * abajo dice hasta cuándo sirve lo que está cargado.
 */

/**
 * Desde cuándo rigen estos valores.
 *
 * Publicados por ARCA con el ajuste del 16,8% (inflación de enero a junio de
 * 2026) y vigentes desde el 1 de agosto de 2026. La próxima actualización es en
 * enero de 2027: hasta que se cargue, la pantalla avisa que los topes están
 * vencidos en vez de mostrar una cuenta contra números viejos.
 */
export const VIGENTE_DESDE = '2026-08-01';

/** Hasta cuándo sirve la tabla sin volver a cargarla. */
export const VIGENTE_HASTA = '2027-01-31';

/**
 * El tope de ingresos brutos anuales de cada categoría.
 *
 * **De la I a la K son solo para venta de cosas muebles.** Quien presta
 * servicios, que es el caso de las dos, no puede categorizarse más arriba de la
 * H: pasada esa, no hay categoría que lo aguante y lo que sigue es el régimen
 * general. Por eso están en la tabla (para poder decir cuánto falta si alguna
 * vez cambia la actividad) pero la pantalla ofrece solo hasta la H.
 */
export const CATEGORIAS: { letra: string; tope: number; servicios: boolean }[] = [
  { letra: 'A', tope: 12_009_410, servicios: true },
  { letra: 'B', tope: 17_595_182, servicios: true },
  { letra: 'C', tope: 24_670_494, servicios: true },
  { letra: 'D', tope: 30_628_651, servicios: true },
  { letra: 'E', tope: 36_028_231, servicios: true },
  { letra: 'F', tope: 45_151_659, servicios: true },
  { letra: 'G', tope: 53_995_798, servicios: true },
  { letra: 'H', tope: 81_924_660, servicios: true },
  { letra: 'I', tope: 91_699_761, servicios: false },
  { letra: 'J', tope: 105_012_519, servicios: false },
  { letra: 'K', tope: 126_610_830, servicios: false },
];

/** Las que puede tener quien presta servicios. */
export const CATEGORIAS_SERVICIOS = CATEGORIAS.filter((c) => c.servicios);

/** El tope de una categoría, o null si no está cargada o no existe. */
export function topeDe(categoria: string | null): number | null {
  if (!categoria) return null;
  return CATEGORIAS.find((c) => c.letra === categoria.trim().toUpperCase())?.tope ?? null;
}

/** En qué categoría cae ese monto de ingresos anuales. */
export function categoriaDe(monto: number): string | null {
  return CATEGORIAS_SERVICIOS.find((c) => monto <= c.tope)?.letra ?? null;
}

/**
 * Cómo viene una emisora contra su tope.
 *
 * `sobra` es lo que puede facturar sin pasarse; en negativo es lo que ya se
 * pasó. `usado` va de 0 a 1 y es lo que dibuja la barra.
 */
export type Margen = {
  categoria: string;
  tope: number;
  usado: number;
  sobra: number;
  /** Cuando lo facturado ya no entra en la categoría, en cuál entraría. */
  siguiente: string | null;
  /** Pasada la H no hay categoría: lo que sigue es el régimen general. */
  seVa: boolean;
};

export function margen(categoria: string | null, doceMeses: number): Margen | null {
  const tope = topeDe(categoria);
  if (tope === null || !categoria) return null;
  const sobra = tope - doceMeses;
  const siguiente = sobra < 0 ? categoriaDe(doceMeses) : null;
  return {
    categoria: categoria.trim().toUpperCase(),
    tope,
    usado: tope === 0 ? 0 : Math.min(doceMeses / tope, 1),
    sobra,
    siguiente,
    seVa: sobra < 0 && siguiente === null,
  };
}

/**
 * Los tres cortes de tiempo, en fechas.
 *
 * Los últimos doce meses se cuentan desde el mismo día del año pasado, que es
 * como los cuenta ARCA: no son los doce meses calendario cerrados.
 */
export function cortes(hoy: Date): { mes: string; anio: string; doce: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const doce = new Date(hoy);
  doce.setFullYear(doce.getFullYear() - 1);
  doce.setDate(doce.getDate() + 1);
  return {
    mes: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    anio: `${hoy.getFullYear()}-01-01`,
    doce: iso(doce),
  };
}
