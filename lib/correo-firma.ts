/**
 * Cómo firma el sistema los correos.
 *
 * - **Lo que tiene una evaluadora a cargo** lo firma ella, con su foto, su
 *   nombre y su WhatsApp: el cliente y el candidato la conocen a ella.
 * - **Lo del Centro** lo firma Lucila, que es quien lo lleva.
 * - **Lo que todavía no es de nadie** (la orden de compra que entra por el
 *   portal, antes del reparto) lo firma el equipo.
 *
 * Los avisos al propio equipo (pedido nuevo, error del portal, el mes del
 * Centro) no llevan firma: es el sistema avisándoles a ellas.
 */

import 'server-only';
import { escapar } from '@/lib/correo';

/**
 * El ícono de WhatsApp del correo (`public/correo/whatsapp.png`). Va siempre
 * contra el sitio publicado: un correo no puede cargar una imagen de
 * localhost, y Gmail no dibuja SVG ni imágenes incrustadas.
 */
export const ICONO_WHATSAPP = 'https://camposhr.com/correo/whatsapp.png';

const PARRAFO = 'font-size:15px;line-height:1.5;margin:0 0 12px;';

export type Firma = { html: string; texto: string[] };

/**
 * La firma de una persona del equipo: su foto, su nombre y su WhatsApp.
 *
 * La foto es la del equipo en el sitio (`public/equipo/<nombre>.png`) y va
 * contra el sitio publicado. Sin teléfono cargado, sale sin la línea de
 * WhatsApp.
 */
export function firmaDe(nombre: string, telefono: string | null): Firma {
  const archivo = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
  const foto = `https://camposhr.com/equipo/${archivo}.png`;
  const tel = telefono?.trim() || null;
  const whatsapp = tel
    ? `<br><a href="https://wa.me/${tel.replace(/\D/g, '')}" style="color:#7a756b;font-size:13px;text-decoration:none;white-space:nowrap;">` +
      `<img src="${ICONO_WHATSAPP}" width="15" height="15" alt="WhatsApp" style="vertical-align:-2px;border:0;"> ${escapar(tel)}</a>`
    : '';
  const html =
    `    <p style="${PARRAFO}margin:24px 0 12px;">Saludos,</p>\n` +
    `    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>\n` +
    `      <td style="padding:0 12px 0 0;vertical-align:middle;"><img src="${foto}" width="48" height="48" alt="${escapar(nombre)}" style="display:block;border:0;border-radius:50%;"></td>\n` +
    `      <td style="vertical-align:middle;font-size:15px;line-height:1.4;"><strong>${escapar(nombre)}</strong>${whatsapp}</td>\n` +
    `    </tr></table>`;
  return { html, texto: ['Saludos,', nombre, ...(tel ? [`WhatsApp: ${tel}`] : []), ''] };
}

/** La firma de lo que no tiene evaluadora a cargo. */
export function firmaDelEquipo(): Firma {
  return {
    html:
      `    <p style="${PARRAFO}margin:24px 0 4px;">Saludos,</p>\n` +
      `    <p style="${PARRAFO}margin:0;"><strong>Equipo Campos HR</strong></p>`,
    texto: ['Saludos,', 'Equipo Campos HR', ''],
  };
}

/** La de una evaluadora si se sabe quién es; si no, la del equipo. */
export function firmaDeQuien(e: { nombre: string | null; telefono: string | null } | null | undefined): Firma {
  const nombre = e?.nombre?.trim();
  return nombre ? firmaDe(nombre, e?.telefono ?? null) : firmaDelEquipo();
}
