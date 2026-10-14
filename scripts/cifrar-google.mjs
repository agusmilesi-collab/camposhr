// Cifra el permiso de Google de las conexiones guardadas antes del cifrado.
//
//   node scripts/cifrar-google.mjs
//
// Lee SUPABASE_URL, SUPABASE_SERVICE_KEY y GOOGLE_TOKEN_CLAVE de .env.local.
// Solo toca las filas que todavía están en texto plano, así que correrlo dos
// veces no hace nada la segunda. Mismo formato que lib/cifrado.ts.

import fs from 'node:fs';
import { createCipheriv, randomBytes } from 'node:crypto';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    })
);

const base = env.SUPABASE_URL.replace(/\/$/, '');
const h = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
const clave = Buffer.from(env.GOOGLE_TOKEN_CLAVE ?? '', 'base64');
if (clave.length !== 32) throw new Error('Falta GOOGLE_TOKEN_CLAVE en .env.local.');

function cifrar(texto) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave, iv);
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), datos]).toString('base64');
}

const filas = await (
  await fetch(`${base}/rest/v1/google_calendario?select=evaluadora_id,refresh_token`, { headers: h })
).json();

let cifradas = 0;
for (const f of filas) {
  if (!f.refresh_token || f.refresh_token.startsWith('v1:')) continue;
  const r = await fetch(`${base}/rest/v1/google_calendario?evaluadora_id=eq.${f.evaluadora_id}`, {
    method: 'PATCH',
    headers: { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ refresh_token: cifrar(f.refresh_token) }),
  });
  if (!r.ok) throw new Error(`No se pudo cifrar ${f.evaluadora_id}: ${r.status} ${await r.text()}`);
  cifradas++;
}
console.log(`${filas.length} conexiones, ${cifradas} cifradas ahora.`);
