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
import { direcciones, enviarCorreo, escapar, type Envio } from '@/lib/correo';
import { select } from '@/lib/supabase';
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
  const que = `Todavía no contestaste si renovás tus horas en ${a.mes}. Entrá a Inicio y tocá "Sí", o "Editar horas" para marcar las que no renovás o sumar horas fijas. Si no renovás el mes, avisale a Lucila por WhatsApp.`;
  const silencio =
    'Si no contestás, renovás las mismas horas: el último día del mes, a las 10, se generan las reservas y el cargo del mes que viene.';
  const enlace = 'https://centro.camposhr.com/centro/inicio';
  return enviarCorreo({
    de: 'centro',
    para: [a.correo],
    asunto: `¿Renovás tus horas en ${a.mes}?`,
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

/**
 * A quién le avisa el sistema lo del Centro: a Lucila, que lo lleva, con copia
 * a Agustín (`CORREO_ERRORES`). La dirección de ella sale de `evaluadoras`: el
 * repositorio es público y las direcciones van en la base.
 */
async function destinosDelEquipo(): Promise<{ para: string[]; copia: string[] }> {
  const filas = await select<{ email: string | null }>(
    'evaluadoras',
    'select=email&nombre=ilike.Lucila*&limit=1'
  ).catch(() => []);
  const copia = direcciones([process.env.CORREO_ERRORES]);
  const para = direcciones(filas.map((f) => f.email));
  return para.length > 0 ? { para, copia } : { para: copia, copia: [] };
}

const pesosCorreo = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const MES_QUE_VIENE = 'https://os.camposhr.com/os/consultorios?ver=mes';

/**
 * El aviso de que el mes se abrió: cuántas reservas y cuánto hay para cobrar.
 * Si el último día del mes a las 10 no llegó, algo falló. No tira.
 */
export async function avisarMesAbierto(a: {
  periodo: string;
  mes: string;
  reservas: number;
  importe: number;
  quien: string;
  choques: number;
}): Promise<void> {
  try {
    const { para, copia } = await destinosDelEquipo();
    const frase = `${a.mes.charAt(0).toUpperCase() + a.mes.slice(1)} ya está abierto: ${a.reservas} reservas por ${pesosCorreo(a.importe)}.`;
    const como = a.quien === 'Apertura automática' ? 'Lo abrió el sistema solo.' : `Lo abrió ${a.quien}.`;
    const choque =
      a.choques > 0
        ? `Hay ${a.choques} ${a.choques === 1 ? 'hora fija que no se pudo reservar' : 'horas fijas que no se pudieron reservar'} porque otra persona ya tenía esa sala: miralas en "Mes que viene".`
        : '';
    await enviarCorreo({
      de: 'centro',
      para,
      copia,
      asunto: `${a.mes.charAt(0).toUpperCase() + a.mes.slice(1)} abierto: ${a.reservas} reservas`,
      clave: `centro-mes-abierto-${a.periodo}`,
      texto: [frase, como, choque, '', `Ver el mes: ${MES_QUE_VIENE}`].filter((x) => x !== null).join('\n'),
      html: hoja(
        `    <p style="${PARRAFO}"><b>${escapar(frase)}</b></p>\n` +
          `    <p style="${PARRAFO}">${escapar(como)}</p>\n` +
          (choque ? `    <p style="${PARRAFO}color:#8c3b3b;">${escapar(choque)}</p>\n` : '') +
          `    <p style="${PARRAFO}margin:18px 0 0;"><a href="${MES_QUE_VIENE}" style="${BOTON}">Ver el mes</a></p>\n`
      ),
    });
  } catch (e) {
    console.error('[aviso de mes abierto]', e);
  }
}

/** El aviso de que la apertura automática falló, para abrirlo a mano. No tira. */
export async function avisarFallaDeApertura(a: { periodo: string; mes: string; error: string }): Promise<void> {
  try {
    const { para, copia } = await destinosDelEquipo();
    const frase = `${a.mes.charAt(0).toUpperCase() + a.mes.slice(1)} no se pudo abrir solo.`;
    const que = 'Entrá a Consultorios, pestaña "Mes que viene", y tocá "Abrir ahora".';
    await enviarCorreo({
      de: 'centro',
      para,
      copia,
      asunto: `${a.mes.charAt(0).toUpperCase() + a.mes.slice(1)} no se abrió: abrilo a mano`,
      clave: `centro-mes-falla-${a.periodo}-${new Date().toISOString().slice(0, 10)}`,
      texto: [frase, que, '', `Detalle: ${a.error}`, '', MES_QUE_VIENE].join('\n'),
      html: hoja(
        `    <p style="${PARRAFO}color:#8c3b3b;"><b>${escapar(frase)}</b></p>\n` +
          `    <p style="${PARRAFO}">${escapar(que)}</p>\n` +
          `    <p style="${PARRAFO}margin:18px 0 18px;"><a href="${MES_QUE_VIENE}" style="${BOTON}">Abrir el mes</a></p>\n` +
          `    <p style="font-size:12px;line-height:1.5;color:#7b7770;margin:0;">Detalle: ${escapar(a.error)}</p>\n`
      ),
    });
  } catch (e) {
    console.error('[aviso de falla de apertura]', e);
  }
}
