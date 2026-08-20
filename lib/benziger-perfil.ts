/**
 * El perfil Benziger: qué dicen los números del informe.
 *
 * Los datos salen del PDF que devuelve la licencia y se guardan tal como
 * vienen, sin sumar ni recalcular nada: el informe ya trae los totales y
 * rehacerlos acá sería inventar una segunda fuente que puede no coincidir.
 *
 * Lo que sí se calcula es la lectura: cuál es el cuadrante más alto y cuál el
 * más bajo, si están en diagonal, y qué estilo da el nivel de alerta. Eso es
 * interpretación reproducible, no un dato del PDF.
 */

import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';

/** Los cuatro valores de una fila del informe, en el orden de la hoja. */
export type Cuatro = { FI: number | null; BI: number | null; BD: number | null; FD: number | null };

/**
 * El cuadrante opuesto en diagonal.
 *
 * Frontal Izquierdo con Basal Derecho, Frontal Derecho con Basal Izquierdo.
 * Que el más alto y el más bajo caigan en diagonal es lo que marca una
 * tendencia natural; si no caen, el perfil se resuelve con lo cualitativo.
 */
const OPUESTO: Record<Perfil, Perfil> = { FI: 'BD', BD: 'FI', FD: 'BI', BI: 'FD' };

export type Cruz = {
  titulo: string;
  valores: Cuatro;
  altos: Perfil[];
  bajos: Perfil[];
  /** Qué se puede decir del cruce. */
  lectura: 'diagonal' | 'sin-diagonal' | 'empate' | 'incompleta';
  texto: string;
};

/** Lee una fila de cuatro valores: quién manda, quién queda último y si hay diagonal. */
export function leerCruz(titulo: string, valores: Cuatro): Cruz {
  const vals = PERFILES.map((p) => valores[p]);
  if (vals.some((x) => x === null || x === undefined)) {
    return {
      titulo,
      valores,
      altos: [],
      bajos: [],
      lectura: 'incompleta',
      texto: 'Faltan valores para leer este cruce.',
    };
  }

  const numeros = vals as number[];
  const max = Math.max(...numeros);
  const min = Math.min(...numeros);
  const altos = PERFILES.filter((p) => valores[p] === max);
  const bajos = PERFILES.filter((p) => valores[p] === min);

  if (altos.length > 1 || bajos.length > 1) {
    return { titulo, valores, altos, bajos, lectura: 'empate', texto: 'Empate: se resuelve con lo cualitativo.' };
  }
  if (OPUESTO[altos[0]] === bajos[0]) {
    return {
      titulo,
      valores,
      altos,
      bajos,
      lectura: 'diagonal',
      texto: `${INFO[altos[0]].nombre} arriba y ${INFO[bajos[0]].nombre} abajo, en diagonal: tendencia natural.`,
    };
  }
  return {
    titulo,
    valores,
    altos,
    bajos,
    lectura: 'sin-diagonal',
    texto: `${INFO[altos[0]].nombre} arriba y ${INFO[bajos[0]].nombre} abajo, sin diagonal: se resuelve con lo cualitativo.`,
  };
}

/**
 * El tiempo libre solo cuenta con una respuesta.
 *
 * Si la persona no pasa su tiempo libre haciendo lo que quiere, esa columna no
 * habla de su preferencia sino de sus obligaciones, y meterla en la lectura
 * ensucia el perfil.
 */
export const TIEMPO_LIBRE_VALE = 'Haciendo lo que yo quiero';

export function cuentaElTiempoLibre(q4: string | null): boolean {
  return (q4 ?? '').toLowerCase().includes(TIEMPO_LIBRE_VALE.toLowerCase());
}

/** Qué estilo da el nivel de alerta, en la escala de 0 a 12 del test. */
export type Estilo = 'Introvertido' | 'Equilibrado' | 'Extravertido';

export function estiloDeAlerta(nivel: number | null): Estilo | null {
  if (nivel === null || nivel === undefined) return null;
  if (nivel >= 8) return 'Extravertido';
  if (nivel >= 5) return 'Equilibrado';
  return 'Introvertido';
}

/** Los veinte acontecimientos de la hoja de estrés, en su orden. */
export const EVENTOS: { clave: string; texto: string }[] = [
  { clave: 'ev01', texto: 'Muerte de un familiar cercano' },
  { clave: 'ev02', texto: 'Muerte de un amigo cercano' },
  { clave: 'ev03', texto: 'Enfermedad incapacitante propia' },
  { clave: 'ev04', texto: 'Hospitalización' },
  { clave: 'ev05', texto: 'Pariente cercano con enfermedad grave' },
  { clave: 'ev06', texto: 'Más responsabilidades o puesto nuevo' },
  { clave: 'ev07', texto: 'Ingreso a una empresa nueva' },
  { clave: 'ev08', texto: 'Aumento de viajes por trabajo' },
  { clave: 'ev09', texto: 'Despido o suspensión' },
  { clave: 'ev10', texto: 'Dificultades económicas' },
  { clave: 'ev11', texto: 'Compra de vivienda' },
  { clave: 'ev12', texto: 'Mudanza dentro de la misma ciudad' },
  { clave: 'ev13', texto: 'Mudanza a otra ciudad' },
  { clave: 'ev14', texto: 'Préstamo nuevo' },
  { clave: 'ev15', texto: 'Matrimonio o unión' },
  { clave: 'ev16', texto: 'Divorcio o fin de una relación' },
  { clave: 'ev17', texto: 'Nacimiento de un hijo' },
  { clave: 'ev18', texto: 'Conflictos de pareja' },
  { clave: 'ev19', texto: 'Problemas legales' },
  { clave: 'ev20', texto: 'Accidente de tránsito o laboral' },
];

/** Lo que le pasó a la persona: solo los acontecimientos con frecuencia. */
export function eventosOcurridos(
  estres: Record<string, unknown>
): { texto: string; veces: number }[] {
  return EVENTOS.map((e) => ({ texto: e.texto, veces: Number(estres[e.clave] ?? 0) })).filter(
    (e) => e.veces > 0
  );
}
