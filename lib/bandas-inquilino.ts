import 'server-only';
import { invalidarCentro } from '@/lib/consultorios-escritura';
import { insert, select, upsert } from '@/lib/supabase';
import {
  contratos as leerContratos,
  aperturas as leerAperturas,
  listarEspacios,
  reservasEntre,
} from '@/lib/consultorios';
import {
  diaSemanaDe,
  finDeMes,
  hora,
  horasSemanalesTotales,
  puedeAlquilar,
  semanaTipo,
} from '@/lib/consultorios-calculo';
import { feriadosEntre } from '@/lib/feriados';
import { DIA_DE_RENOVAR } from '@/lib/renovaciones-tipos';
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

/**
 * Si esa persona puede renovar hoy: desde el 25, y solo con horas fijas para
 * el mes que viene. Las mismas dos condiciones con que Inicio muestra la
 * pregunta; acá las repite el servidor para lo que llegue armado a mano.
 */
export function puedeRenovar(
  contratos: Awaited<ReturnType<typeof leerContratos>>,
  inquilinoId: string,
  hoy: string,
  periodo: string
): boolean {
  return Number(hoy.slice(8, 10)) >= DIA_DE_RENOVAR && horasSemanalesTotales(contratos, inquilinoId, periodo) > 0;
}

/**
 * Lo que el inquilino marcó al renovar, contra lo que de verdad puede marcar.
 *
 * Feriados: los de ese mes que caen en un día en que tiene horas fijas. Horas
 * que no renueva: horas suyas, dentro de sus bandas de ese mes. Lo demás se
 * descarta sin avisar, que solo llega si alguien armó el pedido a mano. Lo
 * usan las dos rutas que guardan la respuesta: renovar y sumar horas.
 */
export async function cambiosValidos(
  inquilinoId: string,
  periodo: string,
  pedidos: { feriados?: unknown; deja?: unknown }
): Promise<{ feriados: string[]; deja: { contrato: string; hora: number }[]; sumo: boolean }> {
  const [feriados, contratos] = await Promise.all([feriadosEntre(periodo, finDeMes(periodo)), leerContratos()]);
  const suyas = contratos.filter(
    (c) => c.inquilino_id === inquilinoId && (c.vigente_hasta === null || c.vigente_hasta >= periodo)
  );
  const susDias = new Set(suyas.map((c) => c.dia_semana));
  const tildados: string[] = Array.isArray(pedidos.feriados) ? pedidos.feriados.map(String) : [];
  const validos = feriados
    .map((f) => f.fecha)
    .filter((f) => tildados.includes(f) && susDias.has(diaSemanaDe(f)));

  const pedidasDeja: { contrato: string; hora: number }[] = Array.isArray(pedidos.deja)
    ? (pedidos.deja as { contrato?: unknown; hora?: unknown }[]).map((d) => ({
        contrato: String(d?.contrato ?? ''),
        hora: Number(d?.hora),
      }))
    : [];
  const deja = pedidasDeja.filter((d, n) => {
    const c = suyas.find((x) => x.id === d.contrato);
    const repetida = pedidasDeja.findIndex((o) => o.contrato === d.contrato && o.hora === d.hora) !== n;
    return c && !repetida && Number.isInteger(d.hora) && d.hora >= hora(c.desde_hora) && d.hora < hora(c.hasta_hora);
  });
  return { feriados: validos, deja, sumo: suyas.some((c) => c.vigente_desde >= periodo) };
}

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
  pedidas: number[],
  /**
   * Lo que tenía marcado en la tarjeta al sumar (horas que no renueva,
   * feriados). Se guarda junto, porque sumar ya deja la respuesta en
   * "cambiar": sin esto, lo tachado y no enviado se perdía.
   */
  marcado: { feriados?: unknown; deja?: unknown } = {}
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

  // Sumar es renovar con cambios: la respuesta pasa a "cambiar", con lo que
  // tenía marcado en la tarjeta en ese momento.
  const r = await renovacionDe(inquilinoId, periodo);
  const cambios = await cambiosValidos(inquilinoId, periodo, {
    feriados: marcado.feriados ?? r?.feriados ?? [],
    deja: marcado.deja ?? r?.deja ?? [],
  });
  await upsert(
    'renovaciones',
    {
      inquilino_id: inquilinoId,
      periodo,
      respuesta: 'cambiar',
      nota: r?.nota ?? null,
      feriados: cambios.feriados,
      deja: cambios.deja,
      respondido_at: new Date().toISOString(),
      visto_at: null,
    },
    'inquilino_id,periodo',
    false
  );
  invalidarCentro();
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
  invalidarCentro();
  return { ok: true };
}
