/**
 * Corre el lector de CV contra una carpeta de PDF y muestra qué sacó de cada
 * uno.
 *
 *     node scripts/probar-cv.mjs ~/Documents/camposhr-privado/cv-prueba
 *
 * Es el mismo control que el lector del Benziger: el motor es de reglas, no
 * adivina, y cada CV raro que aparece se arregla con una regla nueva. Sin una
 * forma de correrlo contra los que ya andaban, arreglar uno rompe otro sin que
 * nadie se entere.
 *
 * **Los CV no van al repositorio.** Son datos de personas y esto es público:
 * viven en `~/Documents/camposhr-privado`, al lado del resto de lo que no se
 * versiona. La carpeta se pasa por argumento.
 *
 * Va contra el servidor de desarrollo (`npm run dev`) para probar el camino
 * entero, el mismo que usa la tarjeta de alta.
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const carpeta = process.argv[2];
const url = process.env.OS_URL ?? 'http://localhost:3000';

if (!carpeta) {
  console.error('Falta la carpeta con los CV.');
  console.error('  node scripts/probar-cv.mjs ~/Documents/camposhr-privado/cv-prueba');
  process.exit(1);
}

const archivos = (await readdir(carpeta))
  .filter((n) => n.toLowerCase().endsWith('.pdf'))
  .sort();

if (archivos.length === 0) {
  console.error(`No hay PDF en ${carpeta}.`);
  process.exit(1);
}

const falta = (x) => (x ? x : '—');
let completos = 0;
const flojos = [];

for (const nombre of archivos) {
  const bytes = await readFile(join(carpeta, nombre));
  const cuerpo = new FormData();
  cuerpo.append('cv', new Blob([bytes], { type: 'application/pdf' }), nombre);

  const res = await fetch(`${url}/api/os/cv`, { method: 'POST', body: cuerpo }).catch(
    () => null
  );
  if (!res?.ok) {
    console.error(`${nombre}: no respondió ${url}. ¿Está levantado el dev?`);
    process.exit(1);
  }
  const { leidos } = await res.json();
  const l = leidos[0];

  const cuantos = [l.nombre, l.telefono, l.mail].filter(Boolean).length;
  if (cuantos === 3) completos++;
  else flojos.push(`${basename(nombre)}: falta ${[
    !l.nombre && 'nombre',
    !l.telefono && 'teléfono',
    !l.mail && 'correo',
  ]
    .filter(Boolean)
    .join(', ')}`);

  console.log(
    `${cuantos === 3 ? '✓' : '·'} ${basename(nombre, '.pdf')}\n` +
      `    nombre    ${falta(l.nombre)}\n` +
      `    teléfono  ${falta(l.telefono)}\n` +
      `    correo    ${falta(l.mail)}`
  );
}

console.log(`\n${completos} de ${archivos.length} con los tres datos.`);
if (flojos.length > 0) {
  console.log('\nLo que faltó:');
  for (const f of flojos) console.log(`  ${f}`);
  console.log(
    '\nUn dato que el CV no trae no es un error del lector: abrí el PDF y fijate\n' +
      'si está adentro antes de tocar una regla.'
  );
}
