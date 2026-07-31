/**
 * Carga personas ficticias en Pla S.A. para ver cómo se comporta la matriz.
 * Cada fila queda marcada con `extra.ficticia`, que es por donde se borran.
 *
 * Uso: npx tsx sembrar-pla.ts
 */
import { readFileSync } from 'node:fs';
import { calcular, PERFILES, type Perfil, type Puntajes } from './lib/perfiles';
import { PLACAS } from './lib/cuestionario';

const EMPRESA = 'd92c687e-6e28-469d-b569-b1d1664474ad'; // Pla S.A.
const CUANTAS = 35;

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY ?? env.SUPABASE_KEY;

const GENTE: [string, string][] = [
  ['Aguirre', 'Matías'], ['Almirón', 'Sofía'], ['Barreto', 'Nicolás'],
  ['Benítez', 'Carolina'], ['Cabrera', 'Federico'], ['Cardozo', 'Valentina'],
  ['Castro', 'Emiliano'], ['Coronel', 'Julieta'], ['Domínguez', 'Leandro'],
  ['Escobar', 'Micaela'], ['Ferreyra', 'Gonzalo'], ['Figueroa', 'Rocío'],
  ['Gauna', 'Sebastián'], ['Godoy', 'Antonella'], ['Gutiérrez', 'Maximiliano'],
  ['Ibarra', 'Guadalupe'], ['Ledesma', 'Facundo'], ['Luna', 'Camila'],
  ['Maidana', 'Joaquín'], ['Medina', 'Agustina'], ['Molina', 'Tomás'],
  ['Ojeda', 'Brenda'], ['Olivera', 'Ezequiel'], ['Paz', 'Milagros'],
  ['Peralta', 'Ramiro'], ['Quiroga', 'Lucía'], ['Ramírez', 'Bautista'],
  ['Rivero', 'Delfina'], ['Sosa', 'Lautaro'], ['Suárez', 'Abril'],
  ['Toledo', 'Ignacio'], ['Vera', 'Martina'], ['Villalba', 'Franco'],
  ['Zárate', 'Renata'], ['Acosta', 'Santino'],
];

/** Aleatorio con semilla: la misma corrida da siempre las mismas personas. */
function dado(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const ceros = (): Puntajes => ({ FI: 0, FD: 0, BI: 0, BD: 0 });

async function main() {
  const filas = GENTE.slice(0, CUANTAS).map(([apellido, nombre], i) => {
    const r = dado(i * 7919 + 13);
    // Una inclinación dominante y algo de ruido, para que la nube tenga
    // gente en los cuatro cuadrantes y también repartida.
    const fuerte = PERFILES[i % 4];
    const likert = ceros();
    const checklist = ceros();
    const respuestas: unknown[] = [];

    for (const placa of PLACAS) {
      const p = placa.perfil as Perfil;
      const suyo = p === fuerte;
      if (placa.tipo === 'descriptiva') {
        const valor = suyo ? 4 + Math.round(r()) : Math.round(r() * 4);
        likert[p] += valor;
        respuestas.push({ tipo: 'descriptiva', valor });
      } else {
        const cuantas = suyo
          ? 9 + Math.floor(r() * 6)
          : Math.floor(r() * 9);
        const seleccion: number[] = [];
        while (seleccion.length < cuantas) {
          const k = Math.floor(r() * 15);
          if (!seleccion.includes(k)) seleccion.push(k);
        }
        checklist[p] += seleccion.length;
        respuestas.push({ tipo: 'frases', seleccion });
      }
    }

    const res = calcular(likert, checklist);
    return {
      empresa_id: EMPRESA,
      variante: 'perfil',
      lider_id: null,
      lider_nombre: null,
      apellido,
      nombre,
      likert,
      checklist,
      totales: res.totales,
      detalle: { respuestas, autopercepcion: null },
      perfiles: res.perfiles,
      resultado: res.tipo,
      eje_x: res.ejeX,
      eje_y: res.ejeY,
      extra: { ficticia: true },
      generacion: null,
      foto_path: null,
    };
  });

  const res = await fetch(`${URL}/rest/v1/respuestas`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(filas),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const guardadas = (await res.json()) as { id: string }[];

  const cuenta = new Map<string, number>();
  for (const f of filas) {
    const p = f.perfiles[0];
    cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
  }
  console.log(`Cargadas ${guardadas.length} personas ficticias en Pla S.A.`);
  console.log('Por cuadrante:', Object.fromEntries(cuenta));
}

main();
