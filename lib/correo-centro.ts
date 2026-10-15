/**
 * Los correos que el Centro Integral Santiago le manda a un inquilino.
 *
 * Por ahora uno solo: el enlace para elegir o restablecer la contraseña. Hasta
 * el 15/10/2026 ese enlace lo generaban Lorena o Lucila desde el OS y lo
 * mandaban por WhatsApp; con Resend configurado, el inquilino se lo pide solo
 * desde la pantalla de entrar.
 *
 * Con la marca del Centro y no la de Campos HR: el inquilino alquila un
 * consultorio en Santiago 1269 y no tiene por qué saber qué es Campos HR.
 */

import 'server-only';
import { enviarCorreo, escapar, type Envio } from '@/lib/correo';
import { HORAS_DEL_ENLACE } from '@/lib/centro-acceso';

const PARRAFO = 'font-size:15px;line-height:1.5;margin:0 0 12px;';
const BOTON =
  'display:inline-block;background:#16202b;color:#ffffff;text-decoration:none;font-size:14px;padding:12px 20px;';

function hoja(adentro: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f2f0ec;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Helvetica,Arial,sans-serif;color:#16202b;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;margin-bottom:2px;">Centro Integral Santiago</div>
  <div style="font-size:12px;color:#7b7770;margin-bottom:24px;">Santiago 1269, Rosario</div>
  <div style="background:#ffffff;padding:28px 28px 24px;">
${adentro}
  </div>
  <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7b7770;margin:20px 0 0;">centro.camposhr.com</p>
</div>
</body></html>`;
}

/** El enlace de un solo uso para poner la contraseña, al correo del inquilino. */
export async function enviarEnlaceDeClave(a: {
  correo: string;
  nombre: string;
  enlace: string;
  /** El token: hace que el mismo enlace no salga dos veces si se pide dos veces seguidas. */
  token: string;
}): Promise<Envio> {
  const nombre = a.nombre.trim().split(/\s+/)[0] || a.nombre;
  const saludo = `Hola, ${nombre}.`;
  const que = `Con este enlace elegís tu contraseña para entrar a los consultorios del Centro. Vale ${HORAS_DEL_ENLACE} horas y se usa una sola vez.`;
  const despues = 'Si no pediste este correo, no hace falta que hagas nada: tu contraseña sigue igual.';
  return enviarCorreo({
    de: 'centro',
    para: [a.correo],
    asunto: 'Tu contraseña para los consultorios del Centro',
    clave: `centro-clave-${a.token}`,
    texto: [saludo, '', que, '', a.enlace, '', despues, '', 'Centro Integral Santiago · Santiago 1269, Rosario'].join('\n'),
    html: hoja(
      `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
        `    <p style="${PARRAFO}">${escapar(que)}</p>\n` +
        `    <p style="${PARRAFO}margin:18px 0 22px;"><a href="${escapar(a.enlace)}" style="${BOTON}">Elegir mi contraseña</a></p>\n` +
        `    <p style="font-size:13px;line-height:1.5;color:#7b7770;margin:0;">${escapar(despues)}</p>\n`
    ),
  });
}

/**
 * El recordatorio de renovar: a quien tiene horas fijas y no contestó qué hace
 * el mes que viene. Lo manda el cron del día 28 (`/api/cron/recordar-renovacion`).
 */
export async function enviarRecordatorioRenovacion(a: {
  correo: string;
  nombre: string;
  /** El mes que viene, como se lee: "noviembre de 2026". */
  mes: string;
  /** El periodo del mes que viene (AAAA-MM-01): hace que el mismo aviso no salga dos veces. */
  periodo: string;
  inquilinoId: string;
}): Promise<Envio> {
  const nombre = a.nombre.trim().split(/\s+/)[0] || a.nombre;
  const saludo = `Hola, ${nombre}.`;
  const que = `Todavía no nos dijiste si seguís con las mismas horas en ${a.mes}. Entrá a Inicio y contestá: seguir igual, cambiar las horas o avisar que no seguís.`;
  const silencio =
    'Si no contestás, seguís con las mismas horas: el día 1 se generan las reservas y el cargo del mes.';
  const enlace = 'https://centro.camposhr.com/centro/inicio';
  return enviarCorreo({
    de: 'centro',
    para: [a.correo],
    asunto: `¿Seguís con tus horas en ${a.mes}?`,
    clave: `centro-renovar-${a.periodo}-${a.inquilinoId}`,
    texto: [saludo, '', que, '', enlace, '', silencio, '', 'Centro Integral Santiago · Santiago 1269, Rosario'].join('\n'),
    html: hoja(
      `    <p style="${PARRAFO}">${escapar(saludo)}</p>\n` +
        `    <p style="${PARRAFO}">${escapar(que)}</p>\n` +
        `    <p style="${PARRAFO}margin:18px 0 22px;"><a href="${enlace}" style="${BOTON}">Contestar en Inicio</a></p>\n` +
        `    <p style="font-size:13px;line-height:1.5;color:#7b7770;margin:0;">${escapar(silencio)}</p>\n`
    ),
  });
}
