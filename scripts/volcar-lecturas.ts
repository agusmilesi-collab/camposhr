/**
 * Vuelca las lecturas que el motor arma para cada protocolo cargado.
 *
 *   node --experimental-strip-types scripts/volcar-lecturas.ts > /tmp/antes.txt
 *
 * Es el control que pide tocar `leer()`: se vuelca antes y después del cambio y
 * se comparan los dos archivos. Lo que cambia tiene que ser lo que se quiso
 * cambiar y nada más, porque cada línea de acá sale en el informe de una
 * persona.
 *
 * No escribe nada: lee los sumarios guardados y corre el motor con los cortes y
 * los textos de fábrica, que es lo único comparable entre dos corridas.
 */
import { readFileSync } from 'node:fs';
import { leer } from '../lib/redacciones.ts';

const env: Record<string, string> = {};
for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
  const i = linea.indexOf('=');
  if (i > 0 && !linea.trim().startsWith('#')) {
    env[linea.slice(0, i).trim()] = linea.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const pedir = async (ruta: string) => {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  if (!r.ok) {
    console.error(await r.text());
    process.exit(1);
  }
  return r.json();
};

const filas = (await pedir(
  'sumario_exner?select=evaluacion_id,crudo&order=evaluacion_id'
)) as { evaluacion_id: string; crudo: any }[];

// El rango del Raven se pasa vacío a propósito: decide una sola lectura (Zf
// bajo se omite cuando el Raven dio bajo) y lo que se compara son dos corridas
// entre sí, así que vale con que sea el mismo en las dos.
let total = 0;
for (const f of filas.map((x) => ({ id: x.evaluacion_id, crudo: x.crudo }))) {
  const test = f.crudo?.meta?.test ?? 'Rorschach';
  const lecturas = leer(f.crudo, '', {}, {}, { test });
  total += lecturas.length;
  for (const l of lecturas) {
    console.log(`${f.id}\t${l.clave}\t${l.valor}`);
  }
}
console.error(`${filas.length} protocolos · ${total} lecturas`);
