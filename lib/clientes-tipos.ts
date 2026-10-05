/** Las opciones que necesita el formulario de alta, sin nada del servidor. */

/**
 * Las condiciones frente al IVA que puede tener un cliente.
 *
 * `valor` es lo que se guarda en la base y no cambia: hay clientes cargados
 * con esos textos. `leyenda` es lo que se le muestra a quien carga y lo que
 * sale impreso en la factura: la RG 1415 (Anexo II, A, II) fija una leyenda
 * para cada caso, y no todas empiezan con "IVA". `arca` es el identificador de
 * esa condición en el web service de facturación (`CondicionIVAReceptorId`),
 * que ARCA exige en cada factura.
 *
 * El orden es el del desplegable: primero las de todos los días.
 */
export const CONDICIONES = [
  { valor: 'Responsable Inscripto', leyenda: 'IVA Responsable Inscripto', arca: 1 },
  { valor: 'Monotributo', leyenda: 'Responsable Monotributo', arca: 6 },
  { valor: 'Exento', leyenda: 'IVA Exento', arca: 4 },
  { valor: 'Consumidor Final', leyenda: 'A Consumidor Final', arca: 5 },
  { valor: 'Monotributista Social', leyenda: 'Monotributista Social', arca: 13 },
  {
    valor: 'Monotributo Trabajador Independiente Promovido',
    leyenda: 'Monotributo Trabajador Independiente Promovido',
    arca: 16,
  },
  { valor: 'No Alcanzado', leyenda: 'IVA No Alcanzado', arca: 15 },
  { valor: 'Sujeto No Categorizado', leyenda: 'Sujeto No Categorizado', arca: 7 },
] as const;

/** Los valores que se guardan, para quien solo necesita la lista. */
export const CONDICIONES_IVA: string[] = CONDICIONES.map((c) => c.valor);

/** La leyenda con la que esa condición sale en la factura y en las pantallas. */
export function leyendaIva(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return CONDICIONES.find((c) => c.valor === valor)?.leyenda ?? valor;
}

/** El identificador de ARCA de esa condición, o null si no es una de la lista. */
export function condicionArca(valor: string | null | undefined): number | null {
  return CONDICIONES.find((c) => c.valor === valor)?.arca ?? null;
}

/**
 * Qué le falta a un cliente para poder facturarle.
 *
 * Son los datos que la RG 1415 exige del comprador en todo comprobante: quién
 * es, dónde está, su CUIT y su condición frente al IVA. Al consumidor final no
 * se le pide CUIT. Devuelve la lista de lo que falta, dicha como para
 * mostrarla; vacía significa que se le puede facturar.
 *
 * La usan el formulario, para avisar antes, y la ruta, que es la que de verdad
 * no deja pasar.
 */
export function faltaParaFacturarle(c: {
  razonSocial: string | null | undefined;
  cuit: string | null | undefined;
  condicionIva: string | null | undefined;
  domicilio: string | null | undefined;
}): string[] {
  const falta: string[] = [];
  if (!c.razonSocial?.trim()) falta.push('la razón social');
  if (!condicionArca(c.condicionIva)) falta.push('la condición frente al IVA');
  if (c.condicionIva !== 'Consumidor Final' && (c.cuit ?? '').replace(/\D/g, '').length !== 11) {
    falta.push('el CUIT');
  }
  if (!c.domicilio?.trim()) falta.push('el domicilio');
  return falta;
}

/**
 * Qué le falta a una emisora para que su factura salga completa: los datos
 * suyos que la misma norma exige impresos.
 */
export function faltaParaEmitir(e: {
  cuit: string | null | undefined;
  domicilio: string | null | undefined;
  inicioActividades: string | null | undefined;
  ingresosBrutos: string | null | undefined;
}): string[] {
  const falta: string[] = [];
  if ((e.cuit ?? '').replace(/\D/g, '').length !== 11) falta.push('el CUIT');
  if (!e.domicilio?.trim()) falta.push('el domicilio comercial');
  if (!e.inicioActividades) falta.push('la fecha de inicio de actividades');
  if (!e.ingresosBrutos?.trim()) falta.push('la condición de Ingresos Brutos');
  return falta;
}

/** "a, b y c": una lista dicha como se dice. */
export function enumerar(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}
