/**
 * Qué hay cargado en el ejercicio de las frases, equipo por equipo.
 *
 * Sirve para elegir con qué equipo probar sin pisar lo que alguien ya escribió:
 * dice quién escribe en cada mitad y cuántas respuestas tiene guardadas.
 *
 *   node scripts/estado-frases.mjs pla-sa
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function entorno() {
  const texto = readFileSync(resolve(raiz, '.env.local'), 'utf8');
  const vars = {};
  for (const linea of texto.split('\n')) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return vars;
}

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = entorno();
const cabeceras = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};
const pedir = async (ruta) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: cabeceras });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
};

const COLORES = ['Rojo', 'Azul', 'Verde', 'Amarillo', 'Violeta', 'Naranja', 'Celeste', 'Marrón'];
const slug = process.argv[2] ?? 'pla-sa';

const [empresa] = await pedir(`empresas?select=id&slug=eq.${slug}&limit=1`);
const [corrida] = await pedir(
  `corridas?select=id,ciclo_id,fase&empresa_id=eq.${empresa.id}&activa=is.true&limit=1`
);
const gente = await pedir(
  `asistentes?select=id,nombre,apellido&corrida_id=eq.${corrida.id}`
);
const porId = new Map(gente.map((a) => [a.id, `${a.nombre} ${a.apellido}`]));

const actividades = await pedir(
  `actividades?select=id,tipo,clave,titulo&ciclo_id=eq.${corrida.ciclo_id}&tipo=eq.frases`
);

for (const act of actividades) {
  const aportes = await pedir(`aportes?select=asistente_id,valor&actividad_id=eq.${act.id}&corrida_id=eq.${corrida.id}`);
  const puestos = aportes.filter((a) => a.valor?.tipo === 'frases');
  console.log(`\n${act.clave} · fase ${corrida.fase} · ${puestos.length} puestos`);

  const equipos = new Map();
  for (const p of puestos) equipos.set(p.valor.color, [...(equipos.get(p.valor.color) ?? []), p]);

  for (const [color, miembros] of [...equipos.entries()].sort((a, b) => a[0] - b[0])) {
    const cargadasDe = (m) =>
      (m.valor.respuestas ?? []).filter((t) => t && t.length > 0).length;
    const total = miembros.reduce((n, m) => n + cargadasDe(m), 0);
    console.log(`\n  ${COLORES[color]} (${miembros.length}) ${total ? '· CON RESPUESTAS' : '· limpio'}`);
    for (const mitad of ['a', 'b']) {
      const dela = miembros.filter((m) => m.valor.mitad === mitad);
      const escribe = dela.find((m) => m.valor.escribe);
      console.log(
        `    Team ${mitad.toUpperCase()}: ${dela.map((m) => porId.get(m.asistente_id)).join(', ')}`
      );
      console.log(
        `      escribe ${escribe ? porId.get(escribe.asistente_id) : '(nadie)'}` +
          ` · ${escribe ? cargadasDe(escribe) : 0}/4 respuestas` +
          (escribe && cargadasDe(escribe) ? ` ${JSON.stringify(escribe.valor.respuestas)}` : '')
      );
    }
  }
}

// Los enlaces de quienes escriben, para abrir dos teléfonos y probar.
console.log('\n--- enlaces de quienes escriben ---');
for (const act of actividades) {
  const aportes = await pedir(
    `aportes?select=asistente_id,valor&actividad_id=eq.${act.id}&corrida_id=eq.${corrida.id}`
  );
  for (const p of aportes.filter((a) => a.valor?.tipo === 'frases' && a.valor.escribe)) {
    console.log(
      `${COLORES[p.valor.color]} Team ${p.valor.mitad.toUpperCase()} · ${porId.get(p.asistente_id)}` +
        ` · https://camposhr.com/ciclo/${slug}?como=${p.asistente_id}`
    );
  }
}
