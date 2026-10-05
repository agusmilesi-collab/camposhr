/**
 * El cliente de ARCA de cada emisora.
 *
 * Cada evaluadora factura con su CUIT y su certificado, así que hay un cliente
 * por CUIT. El certificado y la clave privada no están en la base ni en el
 * repositorio: van en variables de entorno, en base64 para que el salto de
 * línea del PEM no dependa de cómo las guarde cada plataforma.
 *
 *     ARCA_CERT_<cuit>            certificado de homologación
 *     ARCA_KEY_<cuit>             su clave privada
 *     ARCA_CERT_PROD_<cuit>       certificado de producción
 *     ARCA_KEY_PROD_<cuit>        su clave privada
 *
 * Son dos pares porque son dos certificados: el de homologación lo firma una
 * autoridad de prueba y producción no lo acepta.
 */

import 'server-only';
import { Arca } from '@arcasdk/core';
import { TicketsEnSupabase, type Ambiente } from '@/lib/arca/tickets';

export type { Ambiente } from '@/lib/arca/tickets';

const dePem = (b64: string) => Buffer.from(b64, 'base64').toString('utf8');

/** Si esta emisora tiene cargado el certificado de ese ambiente. */
export function tieneCertificado(cuit: string, ambiente: Ambiente): boolean {
  const sufijo = ambiente === 'produccion' ? `PROD_${cuit}` : cuit;
  return Boolean(process.env[`ARCA_CERT_${sufijo}`] && process.env[`ARCA_KEY_${sufijo}`]);
}

export function arcaDe(cuit: string, ambiente: Ambiente): Arca {
  const sufijo = ambiente === 'produccion' ? `PROD_${cuit}` : cuit;
  const cert = process.env[`ARCA_CERT_${sufijo}`];
  const key = process.env[`ARCA_KEY_${sufijo}`];
  if (!cert || !key) {
    throw new Error(`Falta el certificado de ${ambiente} del CUIT ${cuit}.`);
  }
  return new Arca({
    cuit: Number(cuit),
    cert: dePem(cert),
    key: dePem(key),
    production: ambiente === 'produccion',
    ticketStorage: new TicketsEnSupabase(cuit, ambiente),
  });
}
