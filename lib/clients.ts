/**
 * Mapa token -> empresa.
 *
 * Vive en la variable de entorno PORTAL_TOKENS (JSON), no en el código,
 * para poder dar de alta o revocar un cliente sin volver a deployar.
 *
 * Formato:
 *   {"A9y4Ysrl...":"recly4kI5GKAPPhkV"}
 */
function mapaTokens(): Record<string, string> {
  const raw = process.env.PORTAL_TOKENS;
  if (!raw) return {};
  try {
    const mapa = JSON.parse(raw);
    return mapa && typeof mapa === 'object' ? mapa : {};
  } catch {
    return {};
  }
}

export function empresaIdDeToken(token: string): string | null {
  const id = mapaTokens()[token];
  return typeof id === 'string' && id.startsWith('rec') ? id : null;
}

/** Lista todos los clientes con acceso al portal: token + id de empresa. */
export function listarClientes(): { token: string; empresaId: string }[] {
  return Object.entries(mapaTokens())
    .filter(([, id]) => typeof id === 'string' && id.startsWith('rec'))
    .map(([token, empresaId]) => ({ token, empresaId }));
}
