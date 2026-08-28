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
