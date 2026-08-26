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
  return enBloques(salida.join('').trim());
}

/**
 * Un renglón, un bloque.
 *
 * En un campo editable la primera línea queda suelta, fuera de todo: el
 * navegador recién abre un bloque cuando se aprieta Enter. Y un salto de línea
 * adentro de un párrafo deja dos renglones en el mismo bloque. Las dos cosas
 * rompen lo mismo: "esto es un subtítulo" se aplica al bloque entero, así que
 * marcar dos palabras convertía en subtítulo todo lo que venía después hasta
 * donde ese bloque terminara.
 *
 * Acá cada tramo suelto pasa a ser un párrafo y cada `<br>` corta el renglón en
 * dos, reabriendo lo que estuviera abierto para no dejar el marcado cruzado.
 * Adentro de una lista el `<br>` se respeta: ahí el renglón es el `li`.
 */
function enBloques(html: string): string {
  if (!html) return '';
  const salida: string[] = [];
  /** Todo lo abierto, en orden, para poder cerrar y reabrir en un corte. */
  const abiertas: string[] = [];
  /** Lo que va quedando fuera de todo bloque, a la espera de su párrafo. */
  let suelto: string[] = [];

  /** Dónde escribir: adentro de un bloque ya hay renglón, afuera se junta. */
  const hayBloque = () => abiertas.some((e) => BLOQUES.has(e));
  const poner = (trozo: string) => (hayBloque() ? salida : suelto).push(trozo);

  /**
   * El tramo suelto se convierte en párrafo.
   *
   * Lo que estuviera abierto se cierra para armarlo y se vuelve a abrir después,
   * o el párrafo saldría con una negrita sin cerrar.
   */
  const cerrarSuelto = () => {
    const inlines = [...abiertas];
    for (let k = inlines.length - 1; k >= 0; k--) suelto.push(`</${inlines[k]}>`);
    const tramo = suelto.join('');
    suelto = [];
    if (tieneTexto(tramo)) salida.push(`<p>${tramo}</p>`);
    for (const e of inlines) suelto.push(`<${e}>`);
  };

  /** El bloque más cercano de los abiertos, que es el renglón de ahora. */
  const bloqueActual = () => {
    for (let i = abiertas.length - 1; i >= 0; i--) {
      if (BLOQUES.has(abiertas[i])) return i;
    }
    return -1;
  };

  /** Cierra lo último abierto, del lado donde estaba escrito. */
  const cerrarUna = () => {
    const etiqueta = abiertas[abiertas.length - 1];
    const donde = hayBloque() ? salida : suelto;
    abiertas.pop();
    donde.push(`</${etiqueta}>`);
  };

  const etiquetas = /<\/?([a-z0-9]+)>/gi;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = etiquetas.exec(html)) !== null) {
    poner(html.slice(i, m.index));
    const etiqueta = m[1].toLowerCase();
    const esCierre = m[0][1] === '/';

    if (etiqueta === 'br') {
      const donde = bloqueActual();
      const bloque = donde === -1 ? null : abiertas[donde];
      if (bloque === null) {
        cerrarSuelto();
      } else if (bloque === 'p' || bloque === 'h3' || bloque === 'h4') {
        // Se cierra hasta el bloque y se reabre igual: el renglón siguiente
        // conserva la negrita o la cursiva que venía puesta.
        const reabrir = abiertas.slice(donde);
        for (let k = abiertas.length - 1; k >= donde; k--) salida.push(`</${abiertas[k]}>`);
        for (const e of reabrir) salida.push(`<${e}>`);
      } else {
        // Adentro de una lista el renglón es el `li`, así que el salto queda.
        salida.push(m[0]);
      }
    } else if (esCierre) {
      const donde = abiertas.lastIndexOf(etiqueta);
      if (donde !== -1) while (abiertas.length > donde) cerrarUna();
    } else if (BLOQUES.has(etiqueta)) {
      // Un bloque empieza renglón propio: lo suelto que venía se cierra antes.
      if (!hayBloque()) cerrarSuelto();
      salida.push(m[0]);
      abiertas.push(etiqueta);
    } else {
      poner(m[0]);
      if (!SUELTAS.has(etiqueta)) abiertas.push(etiqueta);
    }

    i = m.index + m[0].length;
  }

  poner(html.slice(i));
  while (abiertas.length) cerrarUna();
  cerrarSuelto();

  return sinVacios(salida.join(''));
}

/**
 * Los bloques que quedaron sin nada escrito adentro.
 *
 * Cortar por un salto deja uno vacío cada vez que el salto estaba al final del
 * renglón, y eso se pinta como una línea en blanco que nadie escribió. Se
 * repite hasta que no queda ninguno, porque un bloque vacío puede estar
 * envuelto en otro.
 */
function sinVacios(html: string): string {
  const vacio = /<(p|h3|h4|li|ul|ol)>(?:\s|<(?:strong|em|u|br)>|<\/(?:strong|em|u)>)*<\/\1>/g;
  let antes = html;
  for (let i = 0; i < 5; i++) {
    const despues = antes.replace(vacio, '');
    if (despues === antes) break;
    antes = despues;
  }
  return antes;
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
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(
      (linea) =>
        `<p>${linea.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
    )
    .join('');
}
