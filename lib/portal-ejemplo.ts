/**
 * El portal que se muestra desde la página de psicotécnicos.
 *
 * Es una empresa de muestra cargada en Supabase como cualquier otra
 * (`supabase/portal-ejemplo*.sql`): tres candidatos fijos, dos en curso y uno
 * entregado con su informe completo. Lo que se ve del otro lado es el portal de
 * verdad, con datos que no son de nadie.
 *
 * No es el portal de prueba del equipo (`lib/portal-demo.ts`, en Airtable): ese
 * recibe lo que se carga probando y cambia de un día para el otro.
 *
 * El token vive acá y no en cada pantalla porque lo usan las dos puntas: la
 * página comercial, que lleva hasta él, y el portal, que ofrece volver.
 */
export const TOKEN_PORTAL_EJEMPLO = 'v_Ej3mPl0Portal7Kq2Zt8Rw5Nc1Yb';

export const PAGINA_PSICOTECNICOS = 'https://www.camposhr.com/psicotecnicos';

export function esPortalEjemplo(token: string): boolean {
  return token === TOKEN_PORTAL_EJEMPLO;
}

/**
 * La empresa de la muestra, como se llama en la base.
 *
 * **Lo suyo no entra al OS.** Sus tres candidatos aparecían en el tablero de
 * las evaluadoras, con una entrevista agendada que nadie va a tomar: el trabajo
 * del día se lee ahí, y una ficha inventada en el medio hace dudar del resto.
 * Existe para que un cliente vea el portal, no para que el equipo la trabaje.
 *
 * Se filtra por nombre y no por identificador porque es lo que traen las
 * consultas de las listas, que ya piden el nombre de la empresa para mostrarlo.
 */
export const EMPRESA_EJEMPLO = 'Vega Materiales (ejemplo)';

export function esEmpresaEjemplo(nombre: string | null | undefined): boolean {
  return nombre === EMPRESA_EJEMPLO;
}
