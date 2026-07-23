/**
 * Mapa token -> empresa.
 *
 * Vive en la variable de entorno PORTAL_TOKENS (JSON), no en el código,
 * para poder dar de alta o revocar un cliente sin volver a deployar.
 *
 * Formato:
 *   {"A9y4Ysrl...":"recly4kI5GKAPPhkV"}
 */
export function empresaIdDeToken(token: string): string | null {
  const raw = process.env.PORTAL_TOKENS;
  if (!raw) return null;

  let mapa: Record<string, string>;
  try {
    mapa = JSON.parse(raw);
  } catch {
    return null;
  }

  const id = mapa[token];
  return typeof id === 'string' && id.startsWith('rec') ? id : null;
}
