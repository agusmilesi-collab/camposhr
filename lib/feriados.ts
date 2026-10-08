import 'server-only';

/**
 * Los feriados que cierran el Centro.
 *
 * Los nacionales salen de la API pública de argentinadatos.com, que publica la
 * lista oficial por año (la de argentina.gob.ar se arma en el navegador y no
 * tiene un archivo para leer). Se consulta una vez por día; si no contesta, el
 * calendario se ve igual, sin feriados.
 *
 * Los locales no están en ninguna API: son los de Rosario, escritos acá. Se
 * repiten todos los años en la misma fecha.
 */

export type Feriado = { fecha: string; nombre: string };

/** Mes y día, y cómo se llama. */
const LOCALES: { dia: string; nombre: string }[] = [
  { dia: '10-07', nombre: 'Día de la Virgen del Rosario' },
];

async function nacionales(anio: number): Promise<Feriado[]> {
  try {
    const r = await fetch(`https://api.argentinadatos.com/v1/feriados/${anio}`, {
      next: { revalidate: 86_400 },
    });
    if (!r.ok) return [];
    const filas: { fecha: string; nombre: string }[] = await r.json();
    return Array.isArray(filas)
      ? filas.filter(
          (f) => typeof f.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && typeof f.nombre === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

/** Los feriados entre dos fechas, las dos incluidas, del más cercano al más lejano. */
export async function feriadosEntre(desde: string, hasta: string): Promise<Feriado[]> {
  const anios: number[] = [];
  for (let a = Number(desde.slice(0, 4)); a <= Number(hasta.slice(0, 4)); a++) anios.push(a);
  const delPais = (await Promise.all(anios.map(nacionales))).flat();
  const deAca = anios.flatMap((a) => LOCALES.map((l) => ({ fecha: `${a}-${l.dia}`, nombre: l.nombre })));
  const porFecha = new Map<string, Feriado>();
  // El local primero: si coincide con uno nacional, queda el nombre nacional.
  for (const f of [...deAca, ...delPais]) porFecha.set(f.fecha, { fecha: f.fecha, nombre: f.nombre });
  return [...porFecha.values()]
    .filter((f) => f.fecha >= desde && f.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
