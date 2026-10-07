/**
 * A quién le llega cada correo del sistema.
 *
 * Lo decide la ficha del cliente, contacto por contacto: cada uno tilda qué
 * recibe (orden de compra, entrevista agendada, informe listo, factura con su
 * recibo) y si recibe solo lo de los candidatos que pidió él o también lo que
 * piden los demás de su empresa.
 *
 * Con eso salen los casos que hay: quien pide y se entera de todo lo suyo;
 * compras, que no pide nada y recibe todas las facturas; recursos humanos, que
 * pide y se entera sin recibir facturas; y una gerencia en copia de todo.
 *
 * **El correo va a quien pidió, y el resto va en copia.** Si quien pidió no
 * recibe ese aviso, o no tiene correo, va a los que sí.
 */

import 'server-only';
import { select } from '@/lib/supabase';
import { direcciones } from '@/lib/correo';

export type Aviso = 'orden' | 'entrevista' | 'informe' | 'factura';

const COLUMNA: Record<Aviso, string> = {
  orden: 'recibe_orden',
  entrevista: 'recibe_entrevista',
  informe: 'recibe_informe',
  // La factura y el recibo de pago van juntos: quien paga recibe los dos.
  factura: 'facturacion',
};

export type Destinos = {
  para: string[];
  copia: string[];
  /** El nombre de pila de a quién va, si va a uno solo. */
  nombre: string | null;
};

type Fila = { id: string; nombre: string; email: string | null; recibe_todo: boolean } & Record<
  string,
  unknown
>;

export async function destinosDe(
  aviso: Aviso,
  empresaId: string | null,
  /** Quiénes pidieron los candidatos de los que habla el correo. */
  solicitanteIds: (string | null | undefined)[]
): Promise<Destinos> {
  if (!empresaId) return { para: [], copia: [], nombre: null };
  const col = COLUMNA[aviso];
  const contactos = await select<Fila>(
    'contactos',
    `select=id,nombre,email,recibe_todo,${col}&empresa_id=eq.${empresaId}&activo=is.true&${col}=is.true&order=nombre.asc`
  );
  const conCorreo = contactos.filter((c) => direcciones([c.email]).length > 0);
  const pidieron = new Set(solicitanteIds.filter(Boolean));
  const suyos = conCorreo.filter((c) => pidieron.has(c.id));
  const enCopia = conCorreo.filter((c) => !pidieron.has(c.id) && c.recibe_todo);

  const primeros = suyos.length > 0 ? suyos : enCopia;
  const para = direcciones(primeros.map((c) => c.email));
  return {
    para,
    copia: suyos.length > 0 ? direcciones(enCopia.map((c) => c.email)).filter((x) => !para.includes(x)) : [],
    nombre: primeros.length === 1 ? primeros[0].nombre.trim().split(/\s+/)[0] : null,
  };
}

/** El molde de todos los correos: la marca, una tarjeta blanca y el pie. */
export function hoja(adentro: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f0e6;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Helvetica,Arial,sans-serif;color:#16202b;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;margin-bottom:24px;">Campos HR</div>
  <div style="background:#ffffff;padding:28px 28px 24px;">
${adentro}
  </div>
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a756b;margin:20px 0 0;">www.camposhr.com</p>
</div>
</body></html>`;
}

export const PARRAFO = 'font-size:15px;line-height:1.5;margin:0 0 12px;';
export const BOTON =
  'display:inline-block;background:#16202b;color:#ffffff;text-decoration:none;font-size:14px;padding:12px 20px;';
