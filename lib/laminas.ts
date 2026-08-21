import 'server-only';

/**
 * Las láminas de los tests que se administran con lámina a la vista.
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
  rorschach: { nombre: 'Rorschach', laminas: 10, formato: 'png' },
  zulliger: { nombre: 'Zulliger', laminas: 3, formato: 'png' },
  // Las del Bender son dibujos nuestros y no un escaneo: son figuras
  // geométricas, así que se trazan en SVG con las proporciones medidas sobre
  // las tarjetas. Se ven nítidas en cualquier pantalla y pesan mil veces menos.
  bender: { nombre: 'Bender', laminas: 9, formato: 'svg' },
} as const;

export type TestConLaminas = keyof typeof TESTS;

export function esTestConLaminas(x: string): x is TestConLaminas {
  return Object.prototype.hasOwnProperty.call(TESTS, x);
}

/** Con qué se responde cada formato. */
export const TIPO = { png: 'image/png', svg: 'image/svg+xml' } as const;

/** La imagen de una lámina, con la marca que permite revalidarla. */
export async function leerLamina(
  test: TestConLaminas,
  n: number
): Promise<{ imagen: ArrayBuffer; tipo: string; etag: string | null } | null> {
  if (!Number.isInteger(n) || n < 1 || n > TESTS[test].laminas) return null;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Falta la configuración de Supabase.');

  const formato = TESTS[test].formato;
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/laminas/${test}/${n}.${formato}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('laminas:', test, n, res.status, await res.text());
    return null;
  }
  return { imagen: await res.arrayBuffer(), tipo: TIPO[formato], etag: res.headers.get('etag') };
}
