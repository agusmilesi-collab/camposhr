import 'server-only';
import { revalidateTag } from 'next/cache';
import { insert, select, upsert } from '@/lib/supabase';
import {
  contratos as leerContratos,
  aperturas as leerAperturas,
  listarEspacios,
  reservasEntre,
} from '@/lib/consultorios';
import { finDeMes, hora, puedeAlquilar, semanaTipo } from '@/lib/consultorios-calculo';
import { mesesAbiertosDesde } from '@/lib/apertura-mes';
import { renovacionDe } from '@/lib/renovaciones';

/**
 * Las horas fijas que el inquilino suma solo al renovar.
 *
 * Hasta el 10/11/2026 sumar horas era escribirle a Lucila, que miraba qué
 * estaba libre y cargaba la banda. Pero lo libre está a la vista: el inquilino
 * elige entre las horas que están libres todas las semanas del mes que viene,
 * y la banda queda creada desde el 1. Así quien elige después ya la ve tomada,
 * y la apertura del mes le genera las reservas como a cualquier otra.
 *
 * "Libre" es lo mismo que muestra la disponibilidad para alquilar
 * (`semanaTipo`): ninguna banda la cubre ese mes y no está reservada dos veces
 * o más. Las horas que otro marcó que no renueva siguen ocupadas hasta que se
 * abre el mes, que es cuando se liberan de verdad.
 */

export type Libre = { espacioId: string; sala: string; dia: number; horas: number[] };

/** Las horas libres de cada sala y día del mes que viene, para esa persona. */
export async function libresParaSumar(inquilinoId: string, periodo: string): Promise<Libre[]> {
  const [espacios, aperturas, contratos, reservas] = await Promise.all([
    listarEspacios(),
    leerAperturas(),
    leerContratos(),
    reservasEntre(periodo, finDeMes(periodo)),
  ]);
  const salas = espacios.filter((e) => e.tipo === 'consultorio' && puedeAlquilar(e, inquilinoId));
  const { horas, dias, celdas } = semanaTipo(salas, aperturas, contratos, reservas, periodo);
  // Ni dos salas a la misma hora para la misma persona.
  const propias = contratos.filter(
    (c) => c.inquilino_id === inquilinoId && c.vigente_desde <= finDeMes(periodo) && (c.vigente_hasta === null || c.vigente_hasta >= periodo)
  );
  const suya = (d: number, h: number) =>
    propias.some((c) => c.dia_semana === d && h >= hora(c.desde_hora) && h < hora(c.hasta_hora));

  return salas.flatMap((s) =>
    dias.map((d) => ({
      espacioId: s.id,
      sala: s.nombre,
      dia: d,
      horas: horas.filter((h) => celdas[`${s.id}|${d}|${h}`] === 'libre' && !suya(d, h)),
    }))
  ).filter((l) => l.horas.length > 0);
}

/** Suma una banda (o varias, si las horas no son seguidas) desde el 1. */
export async function sumarBanda(
  inquilinoId: string,
  periodo: string,
  espacioId: string,
  dia: number,
  pedidas: number[]
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if ((await mesesAbiertosDesde(periodo)).includes(periodo)) {
    return { ok: false, motivo: 'Ese mes ya está abierto. Para sumar horas, escribile a Lucila.' };
  }
  const libre = (await libresParaSumar(inquilinoId, periodo)).find((l) => l.espacioId === espacioId && l.dia === dia);
  const horas = [...new Set(pedidas)].sort((a, b) => a - b);
  if (horas.length === 0) return { ok: false, motivo: 'Elegí al menos una hora.' };
  if (!libre || horas.some((h) => !libre.horas.includes(h))) {
    return { ok: false, motivo: 'Alguna de esas horas ya no está libre. Volvé a elegir.' };
  }

  // Las horas seguidas van en una sola banda.
  const tramos: { desde: number; hasta: number }[] = [];
  for (const h of horas) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.hasta === h) ultimo.hasta = h + 1;
    else tramos.push({ desde: h, hasta: h + 1 });
  }
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00:00`;
  for (const t of tramos) {
    await insert('contratos', {
      inquilino_id: inquilinoId,
      espacio_id: espacioId,
      dia_semana: dia,
      desde_hora: hh(t.desde),
      hasta_hora: hh(t.hasta),
      vigente_desde: periodo,
    });
  }

  // Sumar es renovar con cambios: si no había contestado, o había dicho que
  // sí o que no, la respuesta pasa a "cambiar" y se conserva lo demás.
  const r = await renovacionDe(inquilinoId, periodo);
  if (r?.respuesta !== 'cambiar') {
    await upsert(
      'renovaciones',
      {
        inquilino_id: inquilinoId,
        periodo,
        respuesta: 'cambiar',
        nota: r?.nota ?? null,
        feriados: r?.respuesta === 'no' ? [] : (r?.feriados ?? []),
        deja: r?.respuesta === 'no' ? [] : (r?.deja ?? []),
        respondido_at: new Date().toISOString(),
        visto_at: null,
      },
      'inquilino_id,periodo',
      false
    );
  }
  revalidateTag('consultorios', { expire: 0 });
  return { ok: true };
}

/** Quita una banda que sumó para el mes que viene, mientras no se abrió. */
export async function quitarBanda(
  inquilinoId: string,
  periodo: string,
  contratoId: string
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if ((await mesesAbiertosDesde(periodo)).includes(periodo)) {
    return { ok: false, motivo: 'Ese mes ya está abierto. Para cambiar algo, escribile a Lucila.' };
  }
  const c = (
    await select<{ id: string; inquilino_id: string; vigente_desde: string }>(
      'contratos',
      `select=id,inquilino_id,vigente_desde&id=eq.${contratoId}&limit=1`
    )
  )[0];
  if (!c || c.inquilino_id !== inquilinoId || c.vigente_desde < periodo) {
    return { ok: false, motivo: 'Esa banda no se puede quitar desde acá.' };
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY as string;
  await fetch(`${url}/rest/v1/contratos?id=eq.${c.id}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  revalidateTag('consultorios', { expire: 0 });
  return { ok: true };
}
