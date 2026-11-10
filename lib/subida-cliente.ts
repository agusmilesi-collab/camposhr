/**
 * Sube archivos del navegador directo al bucket, con las direcciones que firma
 * el servidor (`lib/entrantes.ts`). Por Vercel no pasa nada de más de 4,5 MB,
 * así que el archivo no viaja en el formulario: viaja dónde quedó.
 *
 * Lo usa el OS (`/api/os/subida`). Devuelve, por archivo, la ruta o el motivo.
 */

export type Subido = { ok: true; ruta: string } | { ok: false; motivo: string };

export async function subirAlBucket(firmar: string, archivos: File[]): Promise<Subido[]> {
  const sinSubir = (motivo: string): Subido[] => archivos.map(() => ({ ok: false, motivo }));
  let firmas: ({ ok: true; ruta: string; url: string; tipo: string } | { ok: false; error: string })[];
  try {
    const r = await fetch(firmar, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivos: archivos.map((a) => ({ nombre: a.name, tamano: a.size })) }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.firmas) return sinSubir(d?.error ?? `No se pudo preparar la subida (${r.status}).`);
    firmas = d.firmas;
  } catch {
    return sinSubir('No se pudo preparar la subida: se cortó la conexión.');
  }

  return Promise.all(
    archivos.map(async (a, i): Promise<Subido> => {
      const f = firmas[i];
      if (!f) return { ok: false, motivo: `No se pudo subir ${a.name}.` };
      if (!f.ok) return { ok: false, motivo: f.error };
      try {
        const s = await fetch(f.url, { method: 'PUT', headers: { 'Content-Type': f.tipo }, body: a });
        if (!s.ok) return { ok: false, motivo: `No se pudo subir ${a.name} (${s.status}).` };
        return { ok: true, ruta: f.ruta };
      } catch {
        return { ok: false, motivo: `No se pudo subir ${a.name}: se cortó la conexión.` };
      }
    })
  );
}

/**
 * Cambia el CV del formulario por su ruta en el bucket: lo sube si todavía no
 * subió (`yaSubido` es el que se subió al soltarlo, para no subirlo dos veces)
 * y deja `cvRuta` y `cvNombre` en lugar del archivo. Devuelve el motivo si no
 * se pudo, o null.
 */
export async function cvPorRuta(
  datos: FormData,
  firmar: string,
  yaSubido?: { archivo: File; ruta: string } | null
): Promise<string | null> {
  const f = datos.get('cv');
  datos.delete('cv');
  if (!(f instanceof File) || f.size === 0) return null;
  let ruta = yaSubido?.archivo === f ? yaSubido.ruta : null;
  if (!ruta) {
    const [s] = await subirAlBucket(firmar, [f]);
    if (!s.ok) return s.motivo;
    ruta = s.ruta;
  }
  datos.set('cvRuta', ruta);
  datos.set('cvNombre', f.name);
  return null;
}
