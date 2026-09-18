import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { select, upsert } from '@/lib/supabase';
import { charlaPorToken } from '@/lib/presentaciones';

/**
 * El guion del expositor: un texto por presentación.
 *
 * Es un documento libre y no una nota por placa. La correspondencia placa por
 * placa obligaba a mantener el deck y la base en sincronía, y el guion se
 * escribe y se lee de corrido.
 *
 * Las notas que viajan adentro del deck (`data-notas`, la ventana de notas que
 * se abre con N) siguen donde estaban y no las toca nadie desde acá: son el
 * apunte de cada placa, esto es el guion entero.
 *
 * La primera vez el campo no aparece vacío: se arma un borrador con las notas
 * del archivo, numeradas por placa. Escribir sobre algo es más rápido que
 * escribir desde cero, y esas notas son lo que hoy se dice.
 */

type FilaGuion = { texto: string };

/** Le saca las etiquetas a un pedazo de HTML y lo deja en una línea. */
function texto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Devuelve el valor de un atributo con comillas dobles, ya desescapado. */
function atributo(etiqueta: string, nombre: string): string {
  const m = etiqueta.match(new RegExp(`${nombre}="([^"]*)"`));
  if (!m) return '';
  return m[1]
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * El borrador que sale del deck: una entrada por placa, con el nombre que le
 * puso el comentario del fuente y la nota que trae adentro.
 */
async function borradorDelArchivo(archivo: string): Promise<string> {
  const ruta = path.join(process.cwd(), 'public', 'pres', archivo);
  const html = await fs.readFile(ruta, 'utf8');

  const partes: string[] = [];
  const re = /<section class="placa[^"]*"[^>]*>/g;
  let m: RegExpExecArray | null;
  let numero = 0;

  while ((m = re.exec(html))) {
    numero += 1;
    const antes = html.slice(Math.max(0, m.index - 220), m.index);
    const comentario = [...antes.matchAll(/<!--\s*(.*?)\s*-->/g)].pop();
    const nombre = comentario ? comentario[1] : `Placa ${numero}`;
    const nota = atributo(m[0], 'data-notas');
    partes.push(`${nombre}\n${nota || '(sin notas)'}`);
  }

  return partes.join('\n\n');
}

/** El guion vigente, y si ya fue escrito o todavía es el borrador del deck. */
export async function guionDe(
  token: string
): Promise<{ titulo: string; texto: string; propio: boolean } | null> {
  const charla = charlaPorToken(token);
  if (!charla?.archivo) return null;

  const filas = await select<FilaGuion>(
    'guiones',
    `select=texto&token=eq.${encodeURIComponent(token)}&limit=1`
  );
  const guardado = filas[0]?.texto ?? '';

  if (guardado.trim() !== '') {
    return { titulo: charla.titulo, texto: guardado, propio: true };
  }

  return {
    titulo: charla.titulo,
    texto: await borradorDelArchivo(charla.archivo),
    propio: false,
  };
}

/** Guarda el guion. */
export async function guardarGuion(token: string, texto: string): Promise<void> {
  await upsert('guiones', { token, texto, updated_at: new Date().toISOString() }, 'token');
}
