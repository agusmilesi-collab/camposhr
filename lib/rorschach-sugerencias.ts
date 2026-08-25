/**
 * Lo que el sistema puede proponer, y lo que no.
 *
 * De los trece campos de una respuesta, la Tabla A resuelve cinco (lámina,
 * número de respuesta, número de localización, calidad formal y popular), da la
 * mitad de dos (la familia de la localización, sin la calidad evolutiva; y los
 * puntajes Z de la lámina, sin saber cuál aplica) y no sabe nada de los cinco
 * restantes: determinantes, par, códigos especiales, AgC y SL, que salen de lo
 * que la persona dijo y de la encuesta.
 *
 * Este archivo tiene esa frontera escrita. `PENDIENTES` es la lista de lo que
 * queda a mano en toda respuesta capturada, y es lo que la pantalla muestra
 * para que no se olvide ninguno.
 */

import { LOCALIZACION } from './rorschach';
import { familiaDe, plano, type CalidadFormal } from './rorschach-tabla-a';

/** Los campos que la herramienta nunca puede completar. */
export const PENDIENTES = [
  { campo: 'determinantes', rotulo: 'Determinantes', obligatorio: true },
  { campo: 'localizacion', rotulo: 'Loc. + DQ', obligatorio: true },
  { campo: 'contenidos', rotulo: 'Contenidos', obligatorio: true },
  { campo: 'par', rotulo: 'Par (2)', obligatorio: false },
  { campo: 'z', rotulo: 'Z', obligatorio: false },
  { campo: 'cc_ee', rotulo: 'CC.EE', obligatorio: false },
  { campo: 'agc', rotulo: 'AgC', obligatorio: false },
  { campo: 'sl', rotulo: 'SL', obligatorio: false },
] as const;

/**
 * Las localizaciones compatibles con un área.
 *
 * El desplegable de la ficha guarda la localización y la calidad evolutiva
 * juntas ('Wo', 'DdSv/+'). De las dos, el área solo dice la primera, así que
 * en vez de elegir una se ofrecen las que pueden ser: si la respuesta salió de
 * Dd24, es alguna de las cuatro variantes de Dd, y cuál lo decide la evaluadora
 * mirando si la respuesta es sintetizada o vaga.
 */
export function localizacionesDe(area: string): string[] {
  const familia = familiaDe(area);
  return LOCALIZACION.map((o) => o.v).filter((v) => {
    // El orden importa: 'v/+' tiene que probarse antes que '+', o 'Wv/+'
    // quedaría en 'Wv/' y no coincidiría con ninguna familia.
    const sinDQ = v.replace(/(v\/\+|o|v|\+)$/, '');
    return sinDQ === familia;
  });
}

/** La calidad formal, como la escribe la tabla de la ficha. */
export function fqDeLaFicha(calidad: CalidadFormal): string {
  return calidad === 'o' ? 'O' : calidad === 'u' ? 'U' : calidad;
}

/**
 * Qué contenido suele ser una respuesta.
 *
 * Es una ayuda, no una codificación: el contenido depende de lo que la persona
 * dijo entero y no de una palabra suelta, así que lo que sale de acá entra
 * marcado como propuesto y la evaluadora lo confirma. Se busca de lo más
 * específico a lo más general, porque "cara de pájaro" es Ad y no A.
 */
const REGLAS: [RegExp, string[]][] = [
  [/^(cara|cabeza|orejas?|hocico|garras?|pinzas?|patas?|alas?|pico|cuernos?|astas|rabo|cola|aleta)s? (de |del )?(animal|p[áa]jaro|perro|gato|lobo|oso|tigre|zorro|vaca|conejo|rat[óo]n|insecto|bicho|caballo|cabra|cerdo|pez|tortuga|mapache|hormiga|[áa]guila|pato|reptil)/, ['Ad']],
  [/^(cara|cabeza|manos?|dedos?|piernas?|pies|nariz|boca|ojos?|labios|pelo|barba|pecho|nalgas|pulgar)/, ['Hd']],
  [/(monstruo|demonio|diablo|bruja|fantasma|[áa]ngel|dr[áa]cula|elfo|duende|gremlin|alien[íi]gena|medusa|pegaso|g[áa]rgola|dibujos animados|antropom[óo]rfic)/, ['(H)']],
  [/(figuras? humanas?|hombre|mujer|chicas|bailarin|acr[óo]bata|cantantes|remero|persona|gente|brujas)/, ['H']],
  [/(radiograf[íi]a)/, ['Xy']],
  [/(anatom[íi]a|pulmones|pelvis|costilla|v[ée]rtebra|cerebro|coraz[óo]n|ri[ñn][óo]n|esqueleto|hueso|calavera|cr[áa]neo|m[ée]dula|espina|est[óo]mago|disco|[úu]lcera|diente|columna)/, ['An']],
  [/(sangre)/, ['Bl']],
  [/(paisaje|isla|monta[ñn]a|colina|roca|cueva|precipicio|ca[ñn][óo]n|bah[íi]a|volc[áa]n|cima|acantilado|desierto|cr[áa]ter)/, ['Ls']],
  [/(mapa|australia|cabo \(geo)/, ['Ge']],
  [/(nube|niebla|bruma|nieve|hielo|tornado|cielo|ola|agua|tierra|lluvia)/, ['Cl']],
  [/(fuego|explosi[óo]n|humo)/, ['Fi']],
  [/([áa]rbol|planta|flor|hoja|helecho|bosque|vegetaci[óo]n|follaje|arbusto|matorral|abeto|champi[ñn][óo]n|ra[íi]z|semilla|cactus|hierbajos|coral|di[ée]nte de le[óo]n)/, ['Bt']],
  [/(sombrero|vestido|capa|abrigo|falda|casco|botas|zapato|capote|gorro|corbata|babero|tocado|disfraz|corona)/, ['Cg']],
  [/(l[áa]mpara|jarr[óa]n|florero|cuenco|taz[óo]n|olla|cacerola|alfombra|manta|felpudo|jaula|urna|candelabro|silla|mesa|estufa|lavadora|puerta|campana|farol|linterna)/, ['Hh']],
  [/(nave espacial|cohete|avi[óo]n|robot|platillo|helic[óo]ptero|tren|coche|barco|submarino|taladr|ascensor|prensa|par(qu[íi]metro)|antena)/, ['Sc']],
  [/(escultura|estatua|adorno|dibujo|pintura|dise[ñn]o|arte|emblema|insignia|escudo|blas[óo]n|t[óo]tem|m[áa]scara|hebilla|joya|abanico|candelabro)/, ['Art']],
  [/(t[óo]tem|sarc[óo]fago|momia|arte chino|casa china|buda)/, ['Ay']],
  [/(pene|vagina|cl[íi]toris|senos?|pechos?|nalgas|labios vaginales|esperma|sexo)/, ['Sx']],
  [/(comida|pastel|mel[óo]n|carne|calabaza|huevo|gamba|langostino|bonito|bacalao)/, ['Fd']],
  [/(sangre|explosi[óo]n|bomba)/, ['Ex']],
  [/(murci[ée]lago|mariposa|insecto|bicho|araña|escarabajo|abeja|avispa|hormiga|mosca|mosquito|libélula|polilla|langosta|cangrejo|pulga|grillo|cienpi[ée]s|ameba|gorila|babuino|p[áa]jaro|[áa]guila|cuervo|lechuza|pato|gallina|pez|rana|tortuga|serpiente|caim[áa]n|dragón|perro|gato|oso|lobo|conejo|vaca|cerdo|rat[óo]n|ardilla|foca|simio|roedor|animal|pulpo|medusa)/, ['A']],
];

export function contenidoSugerido(respuesta: string): string[] {
  const r = plano(respuesta);
  for (const [regla, contenidos] of REGLAS) {
    if (regla.test(r)) return contenidos;
  }
  return [];
}
