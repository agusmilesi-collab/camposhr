/**
 * El texto con formato que se escribe en el OS: qué se guarda de él.
 *
 * La entrevista por competencias reemplaza un documento, así que se escribe con
 * negritas y listas. Eso obliga a guardar marcado, y guardar marcado que viene
 * del navegador obliga a decidir cuál se acepta: lo que llega es el `innerHTML`
 * de un campo editable, y ahí entra lo que el navegador arme, lo que alguien
 * pegue de otro documento y lo que se mande a mano contra la ruta.
 *
 * **Se acepta una lista blanca de etiquetas y ningún atributo.** Todo lo demás
 * se descarta, incluido el contenido de un `<script>` o un `<style>`, que no es
 * texto que alguien quiso escribir. Sin atributos no hay `onerror`, ni `href`,
 * ni `style`: no queda por dónde meter nada, ni siquiera cuando el marcado se
 * vuelva a pintar en el informe.
 *
 * **Las etiquetas quedan balanceadas.** Un `<strong>` sin cerrar dejaría en
 * negrita todo lo que venga después en la página que lo muestre, así que los
 * cierres sin apertura se tiran y lo que quede abierto se cierra al final.
 *
 * Sin `server-only`: lo usa el editor antes de mandar y la ruta antes de
 * guardar. La que manda es la ruta; la del editor es para no mandar algo que
 * va a volver distinto.
 */

/**
 * Lo que se puede escribir: dar formato, hacer listas, separar párrafos y
 * titular.
 *
 * Los títulos van en `h3` y `h4` y no en tamaños de letra sueltos: lo que se
 * elige es qué es cada renglón, no cuántos píxeles mide. Así el informe puede
 * pintarlos con su propia escala el día que lea esto, sin arrastrar el tamaño
 * de la pantalla donde se escribió.
 */
const PERMITIDAS = new Set([
  'p',
  'div',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h3',
  'h4',
]);

/** Las que no llevan cierre. */
const SUELTAS = new Set(['br']);

/**
 * Las que el navegador escribe de dos formas para lo mismo.
 *
 * El `div` entra acá y no en la lista negra: Chrome separa los renglones de un
 * campo editable con `div`, y descartarlo pegaba dos renglones en uno cada vez
 * que se guardaba.
 */
const NORMAL: Record<string, string> = { b: 'strong', i: 'em', div: 'p' };

/** Las que ocupan un renglón propio: no pueden vivir adentro de una negrita. */
const BLOQUES = new Set(['p', 'ul', 'ol', 'h3', 'h4']);

/** Lo que se descarta con contenido y todo: adentro no hay texto de nadie. */
const CON_CONTENIDO = new Set(['script', 'style', 'head', 'title', 'template']);

export function limpiarHtml(crudo: unknown): string {
  if (typeof crudo !== 'string' || !crudo) return '';

  const salida: string[] = [];
  const abiertas: string[] = [];
  /** Mientras haya algo acá, se está tirando el contenido de esa etiqueta. */
  let tirando: string | null = null;
  let i = 0;

  while (i < crudo.length) {
    const abre = crudo.indexOf('<', i);
    if (abre === -1) {
      if (!tirando) salida.push(crudo.slice(i));
      break;
    }
    if (!tirando) salida.push(crudo.slice(i, abre));

    const cierra = crudo.indexOf('>', abre);
    // Un `<` sin su `>` es texto: se escapa para que no abra nada.
    if (cierra === -1) {
      if (!tirando) salida.push(crudo.slice(abre).replace(/</g, '&lt;'));
      break;
    }

    const m = crudo.slice(abre + 1, cierra).match(/^(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/);
    const esCierre = m?.[1] === '/';
    const nombre = m ? (m[2].toLowerCase() as string) : null;

    if (nombre && CON_CONTENIDO.has(nombre)) {
      if (esCierre && tirando === nombre) tirando = null;
      else if (!esCierre) tirando = nombre;
    } else if (!tirando && nombre && PERMITIDAS.has(nombre)) {
      const etiqueta = NORMAL[nombre] ?? nombre;
      if (SUELTAS.has(etiqueta)) {
        salida.push(`<${etiqueta}>`);
      } else if (esCierre) {
        // Un cierre sin su apertura no cierra nada: se tira.
        const donde = abiertas.lastIndexOf(etiqueta);
        if (donde !== -1) {
          // Se cierra también lo que quedó abierto adentro, o el marcado sale
          // cruzado y el navegador lo reacomoda como quiera.
          while (abiertas.length > donde) salida.push(`</${abiertas.pop()}>`);
        }
      } else {
        // Un bloque no puede abrirse adentro de una negrita ni de otro
        // párrafo: lo que quedó abierto se cierra antes. Sin esto el marcado
        // sale anidado al revés y cada navegador lo reacomoda a su manera.
        if (BLOQUES.has(etiqueta)) {
          while (abiertas.length && !['ul', 'ol', 'li'].includes(abiertas[abiertas.length - 1])) {
            salida.push(`</${abiertas.pop()}>`);
          }
        }
        abiertas.push(etiqueta);
        salida.push(`<${etiqueta}>`);
      }
    }

    i = cierra + 1;
  }

  while (abiertas.length) salida.push(`</${abiertas.pop()}>`);

  // Un bloque que quedó sin nada adentro se tira: cerrar un párrafo para poder
  // abrir la lista que el navegador había metido adentro deja uno vacío, y eso
  // se pinta como un renglón en blanco que nadie escribió. Un párrafo con un
  // salto adentro sí se respeta, porque ese sí lo puso alguien.
  return enBloques(
    salida
      .join('')
      .replace(/<(p|h3|h4)><\/\1>/g, '')
      .trim()
  );
}

/**
 * Todo renglón adentro de un bloque.
 *
 * En un campo editable la primera línea queda suelta, fuera de todo: el
 * navegador recién abre un bloque cuando se aprieta Enter. Sobre texto suelto,
 * "esto es un subtítulo" no tiene dónde terminar y el navegador se lleva hasta
 * el final del campo, así que marcar dos palabras convertía en título todo lo
 * que venía después.
 *
 * Acá cada tramo suelto pasa a ser un párrafo, y un `<br>` de primer nivel
 * separa dos: es un renglón aparte, que es lo que quiso quien lo escribió.
 * Adentro de un bloque no se toca nada, y ahí el `<br>` sigue siendo un salto.
 */
function enBloques(html: string): string {
  if (!html) return '';
  const salida: string[] = [];
  let suelto: string[] = [];
  let dentro = 0;

  const cerrar = () => {
    const tramo = suelto.join('');
    if (tieneTexto(tramo)) salida.push(`<p>${tramo}</p>`);
    suelto = [];
  };

  const etiquetas = /<\/?([a-z0-9]+)>/gi;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = etiquetas.exec(html)) !== null) {
    (dentro > 0 ? salida : suelto).push(html.slice(i, m.index));
    const etiqueta = m[1].toLowerCase();
    const esCierre = m[0][1] === '/';
    if (BLOQUES.has(etiqueta)) {
      if (esCierre) {
        dentro--;
        salida.push(m[0]);
      } else {
        if (dentro === 0) cerrar();
        dentro++;
        salida.push(m[0]);
      }
    } else if (etiqueta === 'br' && dentro === 0) {
      cerrar();
    } else {
      (dentro > 0 ? salida : suelto).push(m[0]);
    }
    i = m.index + m[0].length;
  }
  (dentro > 0 ? salida : suelto).push(html.slice(i));
  cerrar();

  return salida.join('');
}

/**
 * Si eso tiene algo escrito.
 *
 * Un campo editable vacío no queda en cadena vacía: el navegador deja un
 * párrafo o un salto de línea suelto, y preguntar si hay caracteres diría que
 * sí sobre una entrevista en blanco.
 */
export function tieneTexto(html: string | null | undefined): boolean {
  if (!html) return false;
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim().length > 0;
}

/**
 * Lo guardado, listo para pintar.
 *
 * Lo que se escribió antes de que el campo tuviera formato es texto plano: cada
 * línea pasa a ser un párrafo, así una entrevista vieja se sigue leyendo con la
 * misma forma que tenía.
 */
export function comoHtml(guardado: string | null | undefined): string {
  if (!guardado) return '';
  if (/<(p|ul|ol|li|br|strong|em|u|h3|h4)\b/i.test(guardado)) return limpiarHtml(guardado);
  return guardado
    .split(/\n{2,}/)
    .map(
      (parrafo) =>
        `<p>${parrafo
          .split('\n')
          .map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
          .join('<br>')}</p>`
    )
    .join('');
}
