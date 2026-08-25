/**
 * La Tabla A del Rorschach: qué se ve en cada área y con qué calidad formal.
 *
 * Transcripta a mano del cuadernillo de localización y calidad formal que usan
 * las evaluadoras (fotos en `~/Desktop/Entrevistador`, lámina I en las páginas
 * 2 a 13). Este archivo NO se genera desde Airtable, a diferencia de
 * `lib/rorschach.ts`: el origen es el librito en papel, así que se edita a mano
 * y se verifica contra él.
 *
 * Cada entrada se escribe igual que en el libro, para poder auditarla renglón
 * contra renglón: primero la calidad formal, después la posición si la lleva, y
 * después la respuesta.
 *
 *   'o antenas'            → calidad o, lámina derecha
 *   'u< matorral'          → calidad u, lámina de costado
 *   'ov árbol'             → calidad o, lámina invertida
 *
 * La posición importa: la misma respuesta en la misma área cambia de calidad
 * según cómo esté la lámina. Como las láminas se administran en pantalla y no
 * se giran, `entradasDe()` deja fuera por defecto todo lo que solo vale girado.
 * El dato se guarda igual, para el día que se pueda girar.
 */

export type CalidadFormal = 'o' | 'u' | '-' | '+';
export type Posicion = 'v' | '<' | '>';

export type Entrada = {
  /** La respuesta, como figura en el libro. */
  respuesta: string;
  calidad: CalidadFormal;
  /** Cómo tiene que estar la lámina. Sin esto, derecha. */
  posicion?: Posicion;
};

/** Los cuatro puntajes de organización de una lámina. */
export type PuntajesZ = { ZW: number; ZA: number; ZD: number; ZS: number };

export type Lamina = {
  /** La respuesta popular, y en qué área se da. */
  popular: { area: string; respuestas: string[] };
  z: PuntajesZ;
  /** Las áreas, en el orden en que las presenta el libro. */
  areas: Record<string, string[]>;
};

/* ------------------------------------------------------------------ lámina I
 * Popular: W = murciélago o mariposa.
 * ZW = 1.0   ZA = 4.0   ZD = 6.0   ZS = 3.5
 */

const I_W = [
  '- abanico',
  '- abdomen',
  'u abeja',
  '- abrazadera, gato, sujetador',
  '- abrigo',
  'u abstracto',
  'o adorno',
  'o águila',
  '- alfombra, tapete',
  'u ameba',
  '- ancla',
  'o ángel',
  'o ángeles, dos con D4 como otro objeto',
  'u animal alado, sin especificar',
  'o animal marino, con D2 o Dd34 como aletas',
  '- animal sin alas',
  '- araña',
  '- árbol',
  '- árbol cítrico',
  'u ardilla volando',
  'u arte abstracto',
  'u arte chino',
  '- Australia',
  '- avión, vista frontal',
  'u avión, vista superior',
  'u avispa',
  '- babero',
  '- babuino',
  '- bacalao',
  'o bailarín o bailarina, en D4, con disfraz o capa',
  '- bala',
  'uv balaustrada, baranda',
  '- bandera',
  '- barba',
  '- barco',
  '- barco acorazado',
  'u barro, fango',
  '- blasón',
  '- bonito (pez)',
  '- bosque',
  'o brujas, dos o tres',
  '- caballete',
  'uv cabaña',
  'u cabo (geografía)',
  '- cacerola',
  '- cactus',
  '-v calabaza',
  'u calavera animal',
  '- calavera humana',
  '- campana',
  '- campanario, torre',
  'ov candelabro',
  'u cangrejo',
  'u cangrejo de río',
  'o cantantes de ópera, dos o tres',
  'u capote',
  'u capullo con insecto alado saliendo',
  'u cara de animal con cuernos',
  'o cara de animal sin especificar',
  'u cara de bicho',
  'u cara de bruja',
  '- cara de caballo',
  '- cara de cabra',
  'u cara de conejo con orejas caídas',
  'o cara de gato',
  '- cara de hormiga',
  'u cara de insecto sin especificar',
  'o cara de lobo',
  '- cara de mapache',
  'u cara de monstruo: gremlin, diablo, alienígena',
  'u cara de oso',
  '- cara de pájaro',
  'u cara de perro',
  '- cara de pez',
  'u cara de ratón',
  'u cara de robot',
  'o cara de tigre',
  '- cara de tortuga',
  '- cara de un insecto específico',
  'u cara de vaca',
  'o cara de zorro',
  '- cara humana',
  'u carbón, pedazo',
  '- carne',
  'uv carpa de circo',
  '- carruaje',
  'uv casa',
  'uv casa china',
  'ov casco',
  'uv castillo',
  'uv catamarán, vista frontal',
  '- cerebro',
  'u cerebro, corte seccional',
  '- cerebro visto desde arriba',
  'o chicas bailando o de pie en corro',
  '- cisterna',
  '- clavo (especia)',
  '- clítoris',
  '- coche',
  'uv cohete, nave espacial',
  'uv colina',
  '- colmena, enjambre',
  'u cometa (juguete)',
  '- comida',
  '- copo de nieve',
  'u coral',
  'ov corona',
  '- costilla(s)',
  'o cráneo, calavera (humano o animal)',
  '- cráter',
  '- cuello',
  'u cuenco, tazón (con asas)',
  '- cuerpo',
  '- cuerpo partido',
  'o cuervo',
  'uv cueva, vista frontal',
  'uv cúpula, bóveda',
  'u demonio con capa o alas',
  '- diapasón',
  '- diente de león',
  '- dirigible',
  'o disco (anatomía)',
  'u diseño',
  'u drácula',
  'u dragón (en general, con alas)',
  'uv edificio',
  '- elfos',
  '- embalaje',
  'o emblema',
  'u escarabajo con alas',
  'u escoria',
  'u escudo de armas',
  '- escudo de marca de automóvil',
  '- esperma',
  '- esponja',
  '- esqueleto sin especificar',
  'uv estadio cubierto',
  'o estatuas, dos o tres',
  '- estufa',
  '- explosión',
  '- felpudo',
  '- figura humana',
  'o figura humana alada o con capa',
  'o figuras humanas bailando, dos',
  '- figuras humanas dándose la espalda, dos',
  'u figuras humanas de cara a la línea central, dos',
  'o figuras humanas, tres, una en D4',
  'u fósil',
  '- fuego',
  'uv fuelle',
  'ov fuente',
  '- gamba',
  '- ganado (rebaño)',
  '- gato (animal)',
  'uv gorro de nieve',
  '- hebilla',
  '- helecho',
  '- helicóptero',
  '- hielo',
  '- hierbajos',
  'o hoja',
  '- hormiga',
  'u hueso',
  '- huevo',
  'o insecto aplastado',
  'o insecto con alas',
  '- insecto no especificado, sin alas',
  '- insecto sin alas',
  'o insignia',
  'u isla',
  '- jardín',
  'u jarrón, florero',
  '- jaula',
  '- lámpara',
  '- langosta',
  '- lavadora',
  '- lechuza',
  'u libélula',
  '- libro',
  '- madera, leña',
  'u mancha de tinta',
  '- manta',
  '- mapa de carreteras',
  '- mapa específico',
  'u mapa sin especificar',
  'o mariposa',
  'o máscara',
  '- medusa',
  'u Medusa',
  '- melón',
  'uv monstruo',
  'uv montaña',
  'u mosca',
  'u mosquito',
  'u mosquito zancudo',
  '- muelle',
  'o mujer con alas o con capa',
  'o murciélago',
  '- nariz',
  'uv nave espacial',
  '- nido',
  'u niebla, bruma',
  '- nota musical',
  'u nube(s)',
  '- ola',
  '- olla',
  '- oreja de mar',
  '- oso',
  '- oso hormiguero',
  'u paisaje',
  'o pájaro',
  'uv pájaro prehistórico',
  '- parquímetro',
  'u partícula, mota de polvo',
  '- pastel',
  'u pato',
  '- pecho (seno)',
  '- pecho (tórax)',
  'uv pelo peinado',
  'u pelusa, mechón',
  'o pelvis',
  'u piedra tallada',
  'u piel (peluda)',
  '- planta',
  'o polilla',
  '- prensa de imprimir',
  '- púa de guitarra',
  '- puente artificial',
  'u puente natural',
  '- puerta',
  'u pulga',
  '- pulmones',
  '- quilla de barco',
  'o radiografía de la pelvis',
  '- radiografía de los pulmones',
  '- radiografía del corazón',
  '- radiografía del estómago',
  'o radiografía del pecho',
  'o radiografía sin especificar',
  '- rana',
  '- red',
  '- reloj',
  '- reloj de sol',
  'u remero en bote',
  '- riñón, riñones',
  'u robot',
  'uv roca',
  '- semilla',
  '- señalador de libro',
  'ov sombrero de mujer',
  '- sonrisa',
  '- sueño (de soñar)',
  'uv taladradora',
  '- taladro, broca',
  '- tanque militar',
  'uv tienda de campaña',
  'u tierra, suciedad',
  '- timón',
  'u tinta',
  'ov tocado, peinado',
  '- tornado',
  '- tortuga',
  'o tótem con alas',
  'uv tren (en D4), cruzando un puente',
  'u urna',
  '- vaca',
  '- válvula',
  '- vegetación, follaje',
  '- velero',
  '- veleta',
  '- vértebra cervical',
  '- vestido',
  '- violín',
  '- yate',
];

const I_D1 = [
  'o antenas',
  '- árbol',
  '- arma de fuego',
  'u astas, cornamenta',
  'u bailarines(as)',
  '- banderas',
  '- bichos',
  'u cabezas de águilas',
  '- cabezas de animales',
  'u cabezas de insectos',
  'u cabezas de monstruos',
  'o cabezas de pájaros',
  'u cabezas de patos',
  'u cabezas de reptiles',
  '- cangrejos',
  '- clip',
  '- cohete',
  'o cuernos',
  'o dedos',
  'u diablos',
  '- diente',
  '- duendes',
  'u escultura abstracta',
  'u fantasmas',
  'o figuras humanas o antropomórficas',
  '- gamba, langostino',
  'o garras',
  '- hormigas',
  '- huesos',
  '- insectos',
  'o manos',
  'u marionetas, títeres',
  'u mariposas',
  'o mitones, manoplas',
  'u monstruos',
  '- olas',
  '- pájaros',
  '- pene',
  'o pinzas, tenazas',
  'u pulgar',
  '- raíces',
  'u rocas',
  '- simios',
  '- tenedor',
  'o tentáculos',
];

const I_D2 = [
  'o acróbata',
  'o ala(s)',
  '- anatomía',
  'o ángel',
  'o animal de dibujos animados',
  '- animal específico con orejas pequeñas, tal como gato, vaca, algunas razas de perros',
  'o animal específico con orejas grandes, tal como asno, elefante, algunas razas de perros',
  'u animal sin especificar',
  '- árbol',
  'u< árbol(es) y follaje',
  '- avión',
  'o bailarín(a)',
  'u bicho, con alas en Dd34',
  '- bicho sin alas',
  '-v botas',
  'o cabeza de pájaro',
  '- cara de animal, de pájaro, de cómics o de monstruo, con Dd34 como oreja',
  'o cara de animal, de pájaro, de cómics o de monstruo, con Dd34 como nariz',
  '- cara humana',
  '- cerdo',
  '- cielo',
  'u< conejo',
  'o demonio',
  '- dragón',
  '- escarabajo',
  'o figura antropomórfica',
  'o figura humana',
  '- gallina',
  'u gárgola',
  '- gato',
  'u hoja',
  'u humo',
  '- lobo',
  '- mapa específico',
  'u mapa sin especificar',
  '- murciélago',
  'u nube',
  'o paisaje',
  'u pájaro carpintero de perfil',
  'o pájaro, con las alas en Dd34',
  'o pegaso',
  '- pez',
  '- radiografía, específica o inespecífica',
  '- roedor',
  '- vaca',
];

const I_D3 = [
  '- adorno',
  '- árbol',
  '- arma de fuego',
  'ov bolo',
  'u caimán',
  'u< caimán reflejado',
  '- cara',
  'o estatua',
  'o figura humana, mitad inferior',
  '- insecto',
  'o jarrón',
  'u médula espinal',
  '- nariz',
  'u nave espacial',
  '- palmatoria',
  '- pene',
  'o piernas',
  'o poste totémico',
  'u robot',
  'o sarcófago de momia',
  '- serpiente',
  '- tallo cerebral',
  '- vagina',
  '- vela, cirio',
  'u violín',
];

const I_D4 = [
  '- abeja',
  '- anatomía',
  '- animal sin especificar',
  '- araña',
  'uv árbol',
  '- avispa',
  'u babuino',
  '- bala',
  'o bicho, con D1 como antenas o tentáculos',
  '- caimán',
  '- cangrejo',
  '- cara',
  '- cienpiés',
  '- clítoris',
  'uv cohete',
  'u corona ceremonial',
  'u criatura del espacio',
  'o escarabajo',
  '- espina dorsal',
  'o estatua',
  '- estructura ósea',
  'ov figura antropomórfica',
  'o figura humana entera',
  'o figura humana sin cabeza',
  'o figuras humanas, dos',
  '- gato',
  'o gorila',
  'u grillo',
  'u hombre',
  '- hormiga',
  'o insecto sin especificar, con antenas o tentáculos en D1',
  '- isla',
  'u jarrón',
  '- lámpara',
  '- langosta',
  'o monstruo',
  'u monumento',
  '- mosca',
  'o mujer',
  'u muñeco de caja sorpresa',
  '- nariz',
  'uv nave espacial',
  '- pájaro',
  '- pez',
  '- planta',
  '- puerta',
  '- rana',
  '- reptil',
  '- tortuga',
  'u viola',
  'o violonchelo',
];

const I_D7 = [
  'o águila',
  'u ala de avión o pájaro',
  'o alas',
  'o animal alado',
  '- animal sin alas',
  'u cabeza de pájaro, pato o caballo',
  'u cara de animal, con Dd34 como hocico o morro',
  'u cara de bruja',
  'u cara de dibujos animados, con Dd34 como nariz',
  '- cara humana',
  '- cráneo, calavera',
  '- cuerno',
  'o cuervo',
  'o escultura de pájaro',
  'o esfinge',
  '- hueso',
  'u insecto alado',
  '- insecto sin alas',
  '- mapa específico',
  'u mapa sin especificar',
  'u nido',
  'u nube',
  'u olla o cacerola, con Dd34 como las asas',
  'u orejas de animal',
  'o paisaje',
  'o pájaro',
  'u pato',
  '- planta',
  'u precipicio',
  'u punta de flecha',
  'u roca',
  '- sombrero',
  'u veleta',
];

const I_Dd21 = [
  '- anatomía',
  '- animal marino',
  'o bicho, con tentáculos en D1',
  'u cangrejo',
  '- corazón',
  'u escudo',
  '- estatua',
  '- medusa',
  'o nido',
  'u paisaje',
  '- vegetación, follaje',
];

const I_Dd22 = [
  '- árboles',
  '- cabezas de animales',
  'u cabezas humanas',
  'u cantos rodados',
  'o colinas',
  '- fantasmas',
  'u joroba de camello',
  'u labios vaginales',
  'o montañas',
  '- nalgas',
  'u ojos de bicho o de rana',
  'u pechos',
  '- pelotas',
  '- verrugas',
];

const I_Dd23 = [
  '- aviones',
  'u insectos',
  'o islas',
  '- moscas',
  '- notas musicales',
  'u pájaros',
  '- puntos',
  '- símbolos',
];

const I_Dd24 = [
  '- bicho',
  '- cabeza',
  'o campana',
  'u casco',
  'u emblema',
  'u falda',
  '- farol, linterna',
  '- figura humana entera',
  'u figura humana, mitad inferior',
  'u lámpara',
  '- monstruo',
  '- planta',
  '- radiografía',
  'u vestido',
  'o violonchelo',
];

const I_Dd25 = [
  '- animal',
  '- árboles',
  'u cara humana',
  'u cara humana abstracta',
  '- grupa de animal',
];

const I_DdS26 = [
  '- árboles',
  'o detalles de máscara',
  'o fantasmas',
  'u nieve',
  'o nubes',
  'o ojos',
  'o ventanas',
];

const I_Dd27 = [
  'u ascensor, con la línea central de la mancha',
  'u barco, con la línea central de la mancha',
  '- cabeza',
  '- cara',
  '- corazón',
  'u escudo',
  'o hebilla',
  'u nave espacial',
  '- peonza',
  '- úlcera',
];

const I_Dd28 = [
  'u árbol',
  'u cabeza antropomórfica con sombrero',
  '- cabeza de animal',
  'o cabeza de pájaro',
  '- cabeza humana',
  '- pájaro entero',
  '- poste',
  'u punta de flecha',
  'u sombrero',
  '- zapato',
];

const I_DdS29 = [
  'o agujeros',
  'u alas',
  'o fantasmas',
  'u montañas',
  'u naves espaciales',
  'u nieve',
  'o ojos abstractos',
  '- ojos humanos',
  'u pirámides',
  'u platillos volantes',
  'u tiendas de campaña',
  'u triángulos',
];

const I_DdS30 = [
  '- árboles',
  'o fantasmas',
  'u figura humana vestida o disfrazada',
  'u nieve',
  'o ojos',
  '- pulmones',
];

const I_Dd31 = [
  '- aguijón',
  'uv cabeza de conejo',
  '- cabeza sin especificar',
  'uv cima de montaña',
  '- cráneo, calavera',
  'u diente',
  '- martillo',
  '- nariz',
  'u pies',
  '- raíz',
  'uv volcán',
];

const I_DdS32 = [
  'u bahía',
  'u cañón (geografía)',
  '- jarrón',
  '- máscara',
  '- pájaro',
];

const I_Dd33 = [
  'ov árbol',
  '- cabeza de animal',
  'uv cabeza humana',
  '- campana',
  'uv champiñón',
  '- hueso',
  '- lámpara',
  '- pelota',
  'u rabo, cola',
  'uv rabo de caniche',
];

const I_Dd34 = [
  'o< abeto',
  'o aleta',
  'u< árbol sin especificar',
  '- cabeza',
  '- cara',
  'u< fantasma',
  'u< foca',
  'u hoja de cuchillo',
  '- insecto',
  'u< matorral',
  'o< montaña',
  'u nariz de dibujos animados',
  'u< paraguas cerrado',
  'o precipicio',
  'u punta de flecha',
  'u roca',
  'u sierra',
  'u< torre',
];

const I_Dd35 = [
  '- cara de animal',
  '- cara de pájaro',
  'uv cara humana',
  'u< perro',
];

export const LAMINAS: Record<string, Lamina> = {
  I: {
    popular: { area: 'W', respuestas: ['murciélago', 'mariposa'] },
    z: { ZW: 1.0, ZA: 4.0, ZD: 6.0, ZS: 3.5 },
    areas: {
      W: I_W,
      D1: I_D1,
      D2: I_D2,
      D3: I_D3,
      D4: I_D4,
      D7: I_D7,
      Dd21: I_Dd21,
      Dd22: I_Dd22,
      Dd23: I_Dd23,
      Dd24: I_Dd24,
      Dd25: I_Dd25,
      DdS26: I_DdS26,
      Dd27: I_Dd27,
      Dd28: I_Dd28,
      DdS29: I_DdS29,
      DdS30: I_DdS30,
      Dd31: I_Dd31,
      DdS32: I_DdS32,
      Dd33: I_Dd33,
      Dd34: I_Dd34,
      Dd35: I_Dd35,
    },
  },
};

/* ----------------------------------------------------------------- lectura */

const CALIDADES: CalidadFormal[] = ['o', 'u', '-', '+'];
const POSICIONES: Posicion[] = ['v', '<', '>'];

/**
 * Parte un renglón del libro en sus tres partes.
 *
 * El renglón viene como 'u< matorral': calidad, posición si la lleva, y la
 * respuesta. Se separa por el primer espacio, así las respuestas con espacios
 * quedan enteras.
 */
export function leerRenglon(renglon: string): Entrada {
  const corte = renglon.indexOf(' ');
  const marca = renglon.slice(0, corte);
  const respuesta = renglon.slice(corte + 1);

  const calidad = marca[0] as CalidadFormal;
  if (!CALIDADES.includes(calidad)) {
    throw new Error(`Calidad formal desconocida en "${renglon}"`);
  }

  const resto = marca.slice(1);
  if (!resto) return { respuesta, calidad };

  const posicion = resto as Posicion;
  if (!POSICIONES.includes(posicion)) {
    throw new Error(`Posición desconocida en "${renglon}"`);
  }
  return { respuesta, calidad, posicion };
}

/** Sin tildes y en minúscula, para poder buscar como se escribe rápido. */
export function plano(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export type Hallazgo = Entrada & { area: string };

/**
 * Todas las entradas de un área.
 *
 * Por defecto deja fuera las que solo valen con la lámina girada: en pantalla
 * no se gira, y ofrecerlas induce a codificar mal.
 */
export function entradasDe(lamina: string, area: string, conGiro = false): Hallazgo[] {
  const l = LAMINAS[lamina];
  if (!l) return [];
  const renglones = l.areas[area];
  if (!renglones) return [];
  return renglones
    .map((r) => ({ ...leerRenglon(r), area }))
    .filter((e) => conGiro || !e.posicion);
}

/** Las áreas de una lámina, en el orden del libro. */
export function areasDe(lamina: string): string[] {
  return Object.keys(LAMINAS[lamina]?.areas ?? {});
}

/**
 * Dónde se puede ver algo, en toda la lámina.
 *
 * Es la búsqueda que sirve cuando la persona describió la respuesta con
 * palabras y no señaló nada: devuelve en qué áreas existe y con qué calidad en
 * cada una, que es la decisión que hoy se toma hojeando el librito. Ordena por
 * las que empiezan con lo buscado y después por las que lo contienen.
 */
export function buscar(lamina: string, texto: string, conGiro = false): Hallazgo[] {
  const q = plano(texto.trim());
  if (q.length < 2) return [];

  const hallados: { h: Hallazgo; peso: number }[] = [];
  for (const area of areasDe(lamina)) {
    for (const e of entradasDe(lamina, area, conGiro)) {
      const r = plano(e.respuesta);
      if (r === q) hallados.push({ h: e, peso: 0 });
      else if (r.startsWith(q)) hallados.push({ h: e, peso: 1 });
      else if (r.includes(q)) hallados.push({ h: e, peso: 2 });
    }
  }
  return hallados.sort((a, b) => a.peso - b.peso).map((x) => x.h);
}

/** Si la respuesta es la popular de la lámina, dada en el área que corresponde. */
export function esPopular(lamina: string, area: string, respuesta: string): boolean {
  const p = LAMINAS[lamina]?.popular;
  if (!p || p.area !== area) return false;
  const r = plano(respuesta);
  return p.respuestas.some((x) => r === plano(x) || r.startsWith(plano(x)));
}

/**
 * La familia de localización de un área, sin la calidad evolutiva.
 *
 * El desplegable de la ficha guarda las dos cosas juntas ('Wo', 'DdSv/+'), y de
 * esas dos la herramienta solo sabe la primera: de dónde salió la respuesta.
 * Si la persona vio algo en Dd24, la codificación es alguna de las cuatro
 * variantes de Dd, y cuál de las cuatro lo decide la evaluadora.
 */
export function familiaDe(area: string): 'W' | 'D' | 'Dd' | 'WS' | 'DS' | 'DdS' {
  if (area === 'W') return 'W';
  if (area === 'WS') return 'WS';
  if (area.startsWith('DdS')) return 'DdS';
  if (area.startsWith('DS')) return 'DS';
  if (area.startsWith('Dd')) return 'Dd';
  return 'D';
}
