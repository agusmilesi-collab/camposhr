import 'server-only';

/**
 * Las láminas de los tests de manchas, servidas por el OS.
 *
 * Viven en el bucket privado y no en `public/`: son material con derechos, y
 * una lámina que circula deja de servir para quien ya la vio. Antes estaban en
 * el hub de herramientas, que las entregaba a cualquiera que supiera la
 * dirección.
 *
 * El OS las proxea en lugar de firmar una URL: así el navegador las pide con la
 * cookie de sesión y no queda dando vueltas un enlace que sigue abierto después
 * de cerrar la pantalla.
 */

const BUCKET = 'psicotecnicos';

export const TESTS = {
  rorschach: { nombre: 'Rorschach', laminas: 10 },
  zulliger: { nombre: 'Zulliger', laminas: 3 },
} as const;

export type TestDeManchas = keyof typeof TESTS;

export function esTestDeManchas(x: string): x is TestDeManchas {
  return Object.prototype.hasOwnProperty.call(TESTS, x);
}

/** El PNG de una lámina, con la marca que permite revalidarla. */
export async function leerLamina(
  test: TestDeManchas,
  n: number
): Promise<{ png: ArrayBuffer; etag: string | null } | null> {
  if (!Number.isInteger(n) || n < 1 || n > TESTS[test].laminas) return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');

  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/laminas/${test}/${n}.png`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('laminas:', test, n, res.status, await res.text());
    return null;
  }
  return { png: await res.arrayBuffer(), etag: res.headers.get('etag') };
}
