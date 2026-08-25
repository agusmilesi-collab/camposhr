/**
 * La entrevista por competencias: lo único que queda de ella es lo que se
 * escribe.
 *
 * Está en las tres baterías. A diferencia del resto, no deja un puntaje ni una
 * codificación: se hace con la persona enfrente y lo que aporta al informe es
 * la redacción de la evaluadora. Hasta el 25/8/2026 esa redacción vivía en un
 * Google Docs por candidato, fuera del sistema, y había que ir a buscarla para
 * escribir el informe.
 *
 * Sin `server-only`: el nombre del test lo lee también la pantalla.
 */

/** Como se llama en la columna `tests` de la tabla `baterias`. */
export const TEST_COMPETENCIAS = 'Entrevista por competencias';

/** Si a esta persona le corresponde, según lo que dice su batería. */
export function llevaEntrevistaPorCompetencias(
  tests: string[] | null | undefined
): boolean {
  return Boolean(tests?.includes(TEST_COMPETENCIAS));
}
