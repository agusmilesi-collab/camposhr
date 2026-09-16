/**
 * Markdown a HTML, lo justo para la base de conocimiento.
 *
 * Sin librería: lo que usan estos documentos son encabezados, párrafos, listas,
 * tablas, negrita, itálica, código y enlaces. Una dependencia de Markdown trae
 * el resto del lenguaje, y con él la decisión de qué permitir y qué no.
 *
 * **Escapa todo antes de convertir.** Lo que llega es texto escrito por
 * nosotros, pero sale a una pantalla web: si mañana alguien pega HTML adentro de
 * un tema, tiene que verse como texto y no ejecutarse.
 */

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Lo que va adentro de un renglón: negrita, itálica, código y enlaces. */
function enLinea(s: string): string {
  return escapar(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, texto, url) =>
      /^(https?:|\/)/.test(url) ? `<a href="${url}">${texto}</a>` : texto
    );
}

/** Una fila de tabla, ya partida por sus barras. */
function celdas(linea: string): string[] {
  return linea
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

const esSeparador = (l: string) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-');

export function markdown(texto: string): string {
  const lineas = texto.replace(/\r/g, '').split('\n');
  const salida: string[] = [];
  let i = 0;

  while (i < lineas.length) {
    const l = lineas[i];

    if (!l.trim()) {
      i += 1;
      continue;
    }

    // Encabezados
    const enc = l.match(/^(#{1,4})\s+(.*)$/);
    if (enc) {
      const n = enc[1].length;
      salida.push(`<h${n}>${enLinea(enc[2])}</h${n}>`);
      i += 1;
      continue;
    }

    // Tabla: una fila con barras seguida de la línea de guiones.
    if (l.includes('|') && esSeparador(lineas[i + 1] ?? '')) {
      const cabeza = celdas(l);
      i += 2;
      const filas: string[][] = [];
      while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim()) {
        filas.push(celdas(lineas[i]));
        i += 1;
      }
      salida.push(
        `<table><thead><tr>${cabeza
          .map((c) => `<th>${enLinea(c)}</th>`)
          .join('')}</tr></thead><tbody>${filas
          .map((f) => `<tr>${f.map((c) => `<td>${enLinea(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`
      );
      continue;
    }

    // Listas, con o sin número. Los renglones que siguen sangrados son del
    // mismo ítem: así una idea larga no se parte en dos viñetas.
    const lista = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (lista) {
      const ordenada = /\d/.test(lista[2]);
      const items: string[] = [];
      while (i < lineas.length) {
        const m = lineas[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (m) {
          items.push(m[3]);
          i += 1;
        } else if (/^\s+\S/.test(lineas[i]) && items.length) {
          items[items.length - 1] += ` ${lineas[i].trim()}`;
          i += 1;
        } else break;
      }
      salida.push(
        `<${ordenada ? 'ol' : 'ul'}>${items
          .map((t) => `<li>${enLinea(t)}</li>`)
          .join('')}</${ordenada ? 'ol' : 'ul'}>`
      );
      continue;
    }

    // Cita
    if (l.startsWith('>')) {
      const partes: string[] = [];
      while (i < lineas.length && lineas[i].startsWith('>')) {
        partes.push(lineas[i].replace(/^>\s?/, ''));
        i += 1;
      }
      salida.push(`<blockquote>${enLinea(partes.join(' '))}</blockquote>`);
      continue;
    }

    // Párrafo: sigue hasta el renglón en blanco.
    const partes: string[] = [];
    while (
      i < lineas.length &&
      lineas[i].trim() &&
      !/^(#{1,4}\s|>|\s*([-*]|\d+\.)\s)/.test(lineas[i]) &&
      !(lineas[i].includes('|') && esSeparador(lineas[i + 1] ?? ''))
    ) {
      partes.push(lineas[i].trim());
      i += 1;
    }
    if (partes.length) salida.push(`<p>${enLinea(partes.join(' '))}</p>`);
  }

  return salida.join('\n');
}
