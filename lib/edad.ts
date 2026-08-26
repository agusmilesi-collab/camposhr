/**
 * La edad de la persona el día de la entrevista.
 *
 * **Se congela y no se recalcula.** El informe dice qué edad tenía cuando se
 * la evaluó, no cuántos años tiene hoy: un informe de hace dos años que se
 * vuelve a abrir hablaría de una persona que ya no es la que se evaluó, y las
 * lecturas del protocolo se leyeron contra la edad de ese día.
 *
 * Por eso se guarda el número en la evaluación, además de la fecha de
 * nacimiento en la persona: la fecha es de ella y no cambia; la edad es de esa
 * evaluación.
 *
 * Sin `server-only`: la pantalla donde se carga la muestra mientras se escribe.
 */

/** Los años cumplidos a una fecha. Null si alguna de las dos no sirve. */
export function edadA(nacimiento: string | null, cuando: string | null): number | null {
  if (!nacimiento) return null;
  const n = new Date(nacimiento);
  // Sin fecha de entrevista se cuenta contra hoy, que es el día en que se está
  // cargando: es cuando la evaluadora la tiene enfrente y se la pregunta.
  const d = cuando ? new Date(cuando) : new Date();
  if (Number.isNaN(n.getTime()) || Number.isNaN(d.getTime())) return null;

  let años = d.getFullYear() - n.getFullYear();
  // Todavía no cumplió este año: el mes o el día que faltan valen un año menos.
  const mes = d.getMonth() - n.getMonth();
  if (mes < 0 || (mes === 0 && d.getDate() < n.getDate())) años -= 1;

  // Fuera de rango es un error de tipeo, casi siempre el año: se devuelve null
  // en vez de un número que después sale impreso en el informe.
  return años >= 0 && años < 120 ? años : null;
}

/** Cómo se dice. "38 años", y en singular cuando corresponde. */
export function enAños(edad: number | null): string | null {
  if (edad === null) return null;
  return `${edad} ${edad === 1 ? 'año' : 'años'}`;
}
