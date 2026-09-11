/**
 * La Tabla A del Rorschach: qué se ve en cada área y con qué calidad formal.
 *
 * Transcripta a mano del cuadernillo de localización y calidad formal que usan
 * las evaluadoras (fotos en `~/Desktop/Entrevistador`, lámina I en las páginas
 * 2 a 13, lámina II en las 14 a 22 y lámina III en las 23 a 34). Este archivo NO
 * se genera desde Airtable,
 * a diferencia de
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
  /** Las áreas, en el orden en que las presenta el libro. */
  areas: Record<string, string[]>;
};

/**
 * Cuánto vale cada clase de Z en cada lámina.
 *
 * Salen del encabezado de la lámina en el cuadernillo y valen para las diez.
 * Viven fuera de `LAMINAS` porque la transcripción de áreas y respuestas va
 * lámina por lámina, y hoy está hecha la I: con los puntajes adentro de esa
 * tabla, el capturador no podía anotar una Z en las otras nueve hasta terminar
 * de copiar el libro entero, que son varios miles de renglones.
 *
 * Los cuatro de la lámina I son los mismos que estaban transcriptos con ella.
 * Los otros nueve se cargaron el 8/9/2026 y hay que verificarlos contra el
 * cuadernillo antes de tomarlos por buenos: de acá sale la Zsum, y la Zsum
 * entra en Zd, que es lo que dice si la persona explora de más o de menos.
 *
 * El Zulliger no está: sus tres láminas tienen su propia tabla y todavía no se
 * cargó, así que ahí el capturador avisa que faltan los valores en vez de
 * puntuar con los del Rorschach.
 */
export const Z: Record<string, PuntajesZ> = {
  I: { ZW: 1.0, ZA: 4.0, ZD: 6.0, ZS: 3.5 },
  II: { ZW: 4.5, ZA: 3.0, ZD: 5.5, ZS: 4.5 },
  III: { ZW: 5.5, ZA: 3.0, ZD: 4.0, ZS: 4.5 },
  IV: { ZW: 2.0, ZA: 4.0, ZD: 3.5, ZS: 5.0 },
  V: { ZW: 1.0, ZA: 2.5, ZD: 5.0, ZS: 4.0 },
  VI: { ZW: 2.5, ZA: 2.5, ZD: 6.0, ZS: 6.5 },
  VII: { ZW: 2.5, ZA: 1.0, ZD: 3.0, ZS: 4.0 },
  VIII: { ZW: 4.5, ZA: 3.0, ZD: 3.0, ZS: 4.0 },
  IX: { ZW: 5.5, ZA: 2.5, ZD: 4.5, ZS: 5.0 },
  X: { ZW: 5.5, ZA: 4.0, ZD: 4.5, ZS: 6.0 },
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

/* ----------------------------------------------------------------- lámina II
 * Popular: D1 = oso, perro, elefante o cordero.
 * ZW = 4.5   ZA = 3.0   ZD = 5.5   ZS = 4.5
 */

const II_W = [
  'o adorno',
  '- anatomía específica',
  'u anatomía sin especificar',
  'u animales sin especificar',
  'uv antorchas con humo',
  'u arte abstracto',
  'uv Ave Fénix',
  'o bailarines/as',
  '- bicho aplastado',
  'uv bicho con alas',
  '- boca',
  '- cara humana o animal',
  '- carne',
  'u cometa (juguete)',
  '- corazón',
  '-v corona de adorno navideño',
  '- cuerpo',
  'u cueva',
  'o diablos',
  '- disco (anatomía)',
  'u diseño abstracto',
  'u emblema',
  'o estatuas humanas o animales',
  '- estómago',
  'ov explosión',
  'o figuras humanas o antropomórficas',
  '- flor',
  'o fuego y humo',
  'u gallinas',
  '- garganta',
  'u gorilas',
  'u insecto con alas',
  '- insecto sin alas',
  '- insignia',
  '- intestinos',
  'u lámpara ornamental',
  '- mapa',
  'ov mariposa',
  'u máscara',
  'u monstruo',
  '- mosca',
  '- murciélago',
  '- nave espacial',
  'u orificio de bala',
  'o osos',
  '- pájaro',
  'u pájaros, dos',
  'u patos',
  'u pavos',
  'uv pelvis',
  'u perros, con D3 como sangre o un objeto separado',
  'o personajes de dibujos animados, humanos o animales',
  'u pingüinos, dos',
  '- planta',
  'uv polilla',
  '- pulmones',
  '- radiografía',
  '- recto',
  '- riñones',
  'u sujetalibros, dos',
  '- tornado',
  '- vagina',
  'u volcán en erupción',
];

const II_D1 = [
  'uv abrigo',
  '- ala',
  '- ameba',
  'u animal disecado',
  'u animal sin especificar',
  '- árbol',
  'u babuino',
  'u< búfalo',
  '- cerdo',
  'o< conejo',
  '- corazón',
  'o cordero',
  'ov demonio',
  'o elefante',
  '- esponja',
  'ov figura humana',
  '- figura humana',
  '- gallina sin cabeza',
  'o< gato',
  'uv gorila',
  'o< hamster',
  '- hipopótamo',
  '- hoja',
  'u humo',
  'u insecto',
  'u jabalí',
  '- mapa',
  '- máquina',
  'ov monstruo',
  'ov montaña(s)',
  '- monumento',
  'u nube',
  'o oso',
  'u paisaje',
  '- pájaro',
  '- payaso',
  'uv perro',
  'o perro',
  '- pez',
  'u roca',
  '- sombrero',
  'u tigre',
  '- tortuga',
  'o vaca',
];

const II_D2 = [
  '- anatomía',
  'u ángel',
  '- animales sin especificar',
  'o antorcha',
  'u bicho con alas',
  '- bicho sin alas',
  '- bota',
  'u cabeza antropomórfica',
  '- cabeza de animal',
  'u cabeza de pájaro',
  '- cabeza humana',
  'uv calcetín',
  'u caracol',
  'u carne',
  '- célula sanguínea',
  'uv colibrí',
  'u conejo',
  'u cuadro hecho con pintura de dedos',
  'u diablo',
  '- diente',
  '- farol, linterna',
  'o foca',
  'o fuego',
  'u gallina',
  'u gallo',
  'o gorra',
  '- huella dactilar',
  'uv huella de pie',
  '- jarrón',
  'u lava',
  '- lengua',
  'o llama',
  'u mancha o marca de lápiz de labios',
  '- mano',
  '- manopla',
  'uv mapa de América del Sur',
  'uv mapa de Italia',
  'o marioneta',
  'o mariposa vista de lado',
  'o máscara animal, de pájaro, de dibujos animados, antropomórfica',
  'o monstruo de dibujos animados',
  'u morsa',
  'u> pájaro',
  'o pájaro',
  '- pene',
  '- pierna',
  'uv pistolera',
  'u pulgar',
  '- rata',
  '- riñón',
  'o sangre',
  'o sombrero',
  '- termita',
  '- vela, cirio',
  '- zapato',
];

const II_D3 = [
  'u abanico',
  'u anémona',
  '- ano',
  'ov antorcha',
  'uv auriculares, cascos',
  'o bicho con alas',
  '- bicho sin alas',
  'uv cabeza de animal astado',
  '- cabeza de animal sin cuernos',
  '- cabeza de pájaro',
  '- cabeza humana',
  'o cangrejo',
  '- cangrejo de río',
  '- cara de animal',
  'uv cara de diablo o monstruo',
  '- cara humana',
  'u caracol',
  'u carne',
  '- cinta del pelo',
  'u coral',
  '- corazón',
  'u embrión',
  '- escarabajo',
  'ov explosión',
  'uv flor',
  'o fuego',
  'u gaita',
  '- hormiga',
  'u insecto',
  '- langosta',
  'u manta raya',
  'o mariposa',
  '- máscara',
  'u medusa',
  'u menstruación',
  'u monstruo',
  '- mosca',
  'u nave espacial',
  '- pez',
  'o pintura',
  '- pinza',
  'u planta',
  'u polilla',
  '- pulmón',
  '- riñón',
  'o sangre',
  'ov sol',
  '- útero',
  'o vagina',
  'o volcán',
];

const II_D4 = [
  'o aguja de campanario',
  'u alicates',
  '- árbol inespecífico',
  'u árbol, tipo abeto',
  'u arma',
  'o bala',
  '- bate de béisbol',
  '- botella',
  '- cabeza',
  '- campana',
  'o cápsula espacial',
  '- cara',
  'u casco',
  'u castillo',
  'o cohete',
  '- cola',
  '- crucifijo',
  '- crucifixión',
  '- cuchillo',
  'u cúpula',
  'o flecha',
  '- jarón',
  'u manos rezando',
  'o misil',
  '- montaña',
  'u monumento',
  '- nariz',
  'o nave espacial',
  'u pene',
  'u pirámide',
  '- puerta',
  'u punta de bolígrafo',
  'o punta de flecha',
  'u punta de lanza',
  'u robot',
  '- serpiente',
  'u sombrero',
  'uv taladro',
  'o templo',
  'u tijeras',
  'o torre',
  'u vela, cirio',
];

const II_DS5 = [
  'o adorno',
  'u aguja de campanario',
  'o agujero',
  'u arco de entrada',
  'o avión',
  '- barco',
  '- boca',
  'u campana',
  'o candelabro',
  'u casco',
  'o castillo, pudiendo incluir D4',
  'u cesta',
  'o cohete',
  'u colgante, pendiente',
  'u cometa (juguete)',
  'u copa',
  'u copo de nieve',
  '- corazón',
  'u corona',
  'u cuenco',
  'o cueva',
  'u cúpula',
  'u diamante',
  '- estómago',
  'u fuente',
  'o iglesia',
  'u isla',
  'o jarrón',
  'o lago',
  'o lámpara',
  'o luz',
  '- mariposa',
  '- máscara',
  'o misil',
  '- murciélago',
  'o nave espacial',
  '- pájaro',
  'o peonza',
  'u pozo',
  'uv raya de mar',
  'u silueta humana, de bailarín/a o de patinador/a con vestimenta',
  'u sombrero femenino',
  'u taladro',
  'u templo',
  'o túnel',
  'u vagina',
  'u vaso',
  '- vestido',
];

const II_D6 = [
  '- alfombra',
  '- anatomía',
  'o animales, dos que cumplen el criterio de "o" en D1',
  'u animales, dos sin especificar',
  'u columna vertebral, corte en sección (puede incluir DS5)',
  '- estómago',
  'ov figuras humanas, dos',
  '- figuras humanas, dos',
  'u insecto con alas',
  '- insecto sin alas',
  'u isla',
  '- mapa específico',
  'u mapa inespecífico',
  'u mariposa',
  'u montaña',
  '- murciélago',
  'u nave espacial (suele hacer referencia a DS5)',
  'u nube(s)',
  'u paisaje (suele incluir DS5 como lago)',
  '- pájaro',
  'ov pelvis',
  'u polilla',
  '- pulmones',
  'ov radiografía de pelvis',
  '- radiografía específica, no de pelvis',
  '- radiografía sin especificar',
  'u tubo de desagüe (con DS5)',
  '- vértebra',
];

const II_Dd21 = [
  'o cabeza de animal',
  '- cabeza de pájaro',
  '- cabeza de pez',
  '- cabeza humana',
  '- foca',
  '- matorral',
  'o montaña',
  '- nido',
  '- oreja',
  '- pájaro',
  '- pico',
  '- radiografía',
  '- rana',
];

const II_Dd22 = [
  '- árbol',
  'ov arbusto',
  '- cabeza de animal',
  'uv cabeza humana',
  'uv conejo',
  '- gallina',
  'uv roca',
];

const II_Dd23 = [
  '- árbol',
  'uv arbusto',
  '- cabeza',
  'uv montaña',
  '- rana',
  'uv roca',
];

const II_Dd24 = [
  'u ano',
  'u bala',
  'u bolo',
  '- cara',
  'uv cascada',
  'u cohete',
  '- diente',
  'u fantasma',
  'u figura antropomórfica',
  '- figura humana',
  'u pene',
  'u tótem',
  'o vagina',
  'u vela, cirio',
];

const II_Dd25 = [
  'u aguja',
  'o antenas',
  'o astas, cornamenta',
  'u carámbanos',
  '- cola, rabo',
  '- colmillo',
  'o cuernos',
  'u lanza',
  'u palo',
  'u pincho, púa',
  'u tentáculos',
];

const II_Dd26 = [
  'o fuego',
  'u gusano',
  '- morsa',
  'u oruga',
  'u puesta de sol',
  'o sangre',
];

const II_Dd27 = [
  '- clavo',
  '- cola, rabo',
  'u garra',
  '- pared',
  'u puente',
];

const II_Dd28 = [
  '- cabeza',
  'u esmalte, barniz',
  'u madera manchada',
  'u mancha de sangre',
  '- radiografía',
  '- tortuga',
];

const II_DdS29 = [
  'u cerámica',
  'uv copa',
  'u cueva',
  'u cúpula',
  'u taza',
  'u túnel',
];

const II_DdS30 = [
  '- almeja',
  '- cabeza',
  'u ensenada',
  '- ojos',
  '- ostra',
];

const II_Dd31 = [
  '- árboles',
  'u cabeza antropomórfica',
  '- cabeza de animal',
  'u cabeza humana',
  'u caras',
  'u escultura de piedra',
  '- garra',
  'u< montañas',
  'uv orejas de animal',
  'u pico',
];

/* ---------------------------------------------------------------- lámina III
 * Popular: D1 o D9 = figura humana.
 * ZW = 5.5   ZA = 3.0   ZD = 4.0   ZS = 4.5
 *
 * La mayoría de las W con un solo objeto se codifican "-": la lámina está
 * fragmentada. Lo que el libro anota al pie de W y no entra como respuesta.
 */

const III_W = [
  '- anatomía',
  '- animal',
  'o animales en D1, en una escena con otros objetos, tal como en un circo',
  '- araña',
  'u arte abstracto',
  '- bicho',
  '- caja torácica',
  'u candelabro',
  '- cangrejo',
  '- cara',
  'u cuenco con asas y dibujo',
  'u emblema',
  '- esqueleto',
  '- figura humana',
  'o figuras humanas o antropomórficas en D1, en una escena con otros objetos',
  '- flor',
  '- fuego fatuo',
  '- gato',
  '- gorila',
  '- hormiga',
  '- insecto',
  'u insignia',
  'uv islas',
  'uv jarrón con asas y dibujo',
  '- mapa específico',
  'u mapa inespecífico',
  '- mariposa',
  '- medusa',
  'uv monstruo',
  '- mosca',
  'uv paisaje',
  'o pájaros en D1, en una escena con otros objetos, tal como una jaula',
  '- radiografía',
  '- rana',
  'u rana disecada',
  '- soga',
];

const III_D1 = [
  '- animal',
  'u animales, dos sin especificar',
  '- araña',
  '- árboles',
  'uv arco',
  'o avestruz, dos',
  '- bicho',
  '- cráneo o calavera',
  'uv entrada de cueva',
  '- esqueleto',
  'o estructura ósea',
  'o estructura pélvica',
  '- figura humana',
  'uv figuras humanas con D5 como brazos',
  '- figuras humanas, dos con D7 o Dd31 formando parte de la figura humana',
  'o figuras humanas, dos con D7 como un objeto separado',
  'uv gremlin',
  '- hormiga',
  '- insecto',
  'u jarrón',
  '- langosta',
  '- mapa específico',
  'u mapa sin especificar',
  'o monos, con D7 como un objeto separado',
  'uv monstruo, extraterrestre o robot',
  'uv montaña, de ordinario nevada',
  'o muñecos, dos',
  'o ovejas o corderos, dos',
  'ov paisaje',
  '- pájaro',
  'o pájaros, dos',
  '- perro',
  'o perros, dos con D7 como un objeto separado',
  'u quilla de barco, con D5 como soportes',
  'o radiografía de pelvis',
  'u radiografía sin especificar',
  'u rana disecada',
  '- túnel',
];

const III_D2 = [
  'u ameba',
  '- ancla',
  'o animal de cola larga',
  '- animal sin cola larga',
  'u anzuelo',
  'uv árbol',
  '- arteria',
  '- bayas, frutos',
  '- bicho',
  'u caballito de mar',
  'u cabeza antropomórfica',
  '- cabeza de animal',
  '- cabeza de pájaro',
  '- cabeza humana',
  'u candelabro',
  '- capullo',
  '- caracol',
  '- carne',
  'o carne colgada',
  '- cerebro',
  '- conejo',
  'u coral',
  '- corazón',
  'o cordón umbilical con placenta',
  'u cuerda, liana',
  'o decoración inespecífica',
  'o diablo',
  '- dragón',
  'o embrión',
  'u esófago',
  'u estatua abstracta',
  'u estatua animal',
  'o estatua humana',
  'u estómago',
  'u farol, linterna',
  'u feto',
  'o figura antropomórfica',
  'o figura humana',
  'ov flamenco',
  'uv flor',
  'o fuego',
  'o gallina colgada',
  'u gancho',
  '- garrote',
  'u germen',
  '- gotas de lluvia',
  'u guitarra',
  '- hueso',
  '- insecto',
  '- intestino',
  'u isla',
  '- jarrón',
  'ov loro',
  'ov marioneta',
  'o mono',
  '- mosca',
  'o neurona',
  'u nota musical',
  'o olla colgada',
  'o pájaro',
  '- palo, bastón',
  '- pato',
  '- perro',
  '- pez',
  'uv pipa',
  'uv planta',
  '- pulmón',
  'u riñón',
  'u robot',
  'o sangre',
  '- serpiente',
  'o símbolo abstracto',
  'o sombrero de payaso o de disfraz',
];

const III_D3 = [
  'u ala',
  'u ala delta',
  '- antenas',
  'u aparato de ejercicios',
  '- árboles',
  '- astas, cornamenta',
  'u avispa',
  '- boca',
  '- cangrejo',
  '- casco',
  '- cerebro',
  'o cinta',
  'u columna vertebral (sección transversal)',
  'u cometa (juguete)',
  '- corazón',
  'o decoración sin especificar',
  'u dique entre colinas',
  'u emblema abstracto',
  '- esqueleto',
  '- esternón',
  'o estructura pélvica',
  '- faja',
  '- figura(s) humana(s)',
  'u fósil',
  'o fuego',
  'u fuelle',
  '- gafas',
  'u gafas de sol',
  'u hueso',
  '- hueso de la suerte',
  'u insecto alado',
  '- insecto sin alas',
  '- intestino',
  'u isla',
  '- labios',
  'o lazo (moño)',
  '- libélula',
  'o mariposa',
  '- máscara',
  '- mosca',
  'u mosquito',
  '- murciélago',
  '- naranjas',
  '- nariz',
  '- orificios nasales',
  '- pájaro',
  '- pechos',
  'u pesa para deporte',
  'o polilla',
  'u protector nasal',
  'o pulmones',
  'u respaldo de silla de oficina',
  'u riñón',
  'o sangre',
  '- semilla',
  'u sujetador',
  '- testículos',
  'u tirachinas, honda',
  'u visera',
];

const III_D5 = [
  '- árbol',
  '- arma de fuego',
  'u bala',
  '- bicho',
  '- bolígrafo, rotulador',
  'u bomba',
  'u brazo',
  'u cohete',
  '- cuerno',
  'u flecha',
  'u garra',
  'u garrote, palo',
  '- hueso',
  'u isla',
  'u lanza',
  '- liana, vid',
  '- mano',
  '- mapa',
  'u misil',
  'u nave espacial',
  '- pájaro',
  'u palo, bastón',
  'o pata de animal',
  'u pata de insecto, generalmente araña',
  'o pata de pájaro',
  'u península',
  'o pez',
  'o pierna',
  'u rama',
  '- serpiente',
  'o tiburón',
  'u torpedo',
  'u tronco',
];

const III_D7 = [
  '- anatomía',
  '- animal',
  'ov árboles (DdS24 un lago)',
  '- cabeza',
  'u cabeza de monstruo',
  '- cactus',
  'o caldero',
  'o cangrejo',
  '- cara',
  'u carbón (pedazo)',
  'o cesta',
  'o chimenea, hogar',
  '- corazón',
  '- costillas',
  '- escarabajo',
  '- estómago',
  '- gafas',
  '- hebilla',
  'uv hongos',
  'o huesos',
  'u humo',
  'u isla',
  '- mariposa',
  'u máscara de calabaza',
  'u mesa',
  'o nido',
  '- patos',
  'o pelvis',
  'u puerta, verja',
  '- pulmones',
  'o radiografía de pelvis',
  '- radiografía específica (no de pelvis)',
  'u radiografía sin especificar',
  '- riñón',
  'o roca(s)',
  'u sombras',
  'u tambor',
  '-v tornado',
  '- vagina',
  'u vértebras',
];

const III_D8 = [
  'uv antorcha',
  '- calabaza',
  'u cangrejo',
  'u cara de extraterrestre o monstruo',
  'uv cesta',
  'uv copa de vino',
  'o costillas',
  '- dragón',
  'o huesos',
  'uv jarrón',
  'u lago (entre montañas)',
  'u lámpara',
  'u monstruo',
  'u parte de esqueleto especificada, excepto costillas',
  'o parte de esqueleto sin especificar',
  '- pecho (tórax)',
  'u piedra',
  '- radiografía',
  'u reloj de arena',
  '- río',
  '- tallo cerebral',
  '- vagina',
];

const III_D9 = [
  '- anatomía',
  'u animal sin especificar',
  '- araña',
  '- árbol',
  '- bicho',
  'o bruja',
  '- conejo',
  'o cordero',
  'u demonio',
  'u esqueleto',
  'u estatua',
  'u fantasma',
  'o figura humana',
  'u gallina',
  '- hormiga',
  '- insecto',
  '- King Kong',
  'u loro',
  'o marioneta',
  'o mono',
  'u monstruo',
  'uv montaña',
  'o muñeco/a',
  'u muñeco de caja sorpresa',
  'u nube',
  'o oveja',
  'uv paisaje',
  'o pájaro',
  'u pato',
  'o perro',
  'o personaje de dibujos animados',
  '- radiografía',
  '- raíz',
  '- vegetación, follaje',
];

const III_Dd21 = [
  'uv árbol',
  '- bomba',
  '- cabeza de animal',
  'o cabeza de pájaro',
  'o cabeza de pez',
  '- cabeza humana',
  'ov montaña',
  'u paisaje',
  'u pájaro',
  'u península',
  '- perro',
  'u precipicio',
];

const III_Dd22 = [
  '- animal',
  'u estatua',
  'u figura humana, mitad superior',
  '- hueso',
  'u nube',
  'uv paisaje',
  'o pájaro',
  '- roedor',
];

const III_DdS23 = [
  'u agua',
  '- cabeza',
  'u fantasma',
  'u nube',
  'u pájaro',
];

const III_DdS24 = [
  '- cabeza',
  'u cuenco',
  'uv estatua',
  'uv hongo, seta',
  'u jarrón',
  'u lago',
  'uv lámpara',
  'u nieve',
];

const III_Dd25 = [
  '- cabeza',
  '- cara',
  'u cola, rabo',
  'u cordón umbilical',
  'u cuerda',
  'u esófago',
  'u gusano',
  '- herramienta',
  '- lanza',
  'u palo, bastón',
  'u raíz',
  'u soga',
  'u tubo',
];

const III_Dd26 = [
  'u aleta',
  '- cabeza',
  'o pene',
  'u pico de pato',
  '- pierna, pata',
  'u tocón',
];

const III_Dd27 = [
  'o cabeza de animal',
  'o cabeza de pájaro',
  'u cabeza de pez',
  '- cabeza humana',
  '- cráneo, calavera',
  '- edificio',
  'uv montaña',
  'u nariz',
  'o pecho (seno)',
];

const III_Dd28 = [
  '- cabeza',
  '- cara',
  'u corsé',
  '- diente',
  'u dique',
  'u puertas batientes',
  'u red',
];

const III_Dd29 = [
  '- avión',
  '- cabeza',
  '- corazón',
  '- feto',
  '- figura humana',
  '- flecha',
  '- insecto',
  'u mariposa',
  'u pájaro',
  'u pecho (seno)',
  'u personaje de dibujos animados',
  'u punta de flecha',
  '- riñón',
  'u< tarjeta de felicitación',
  '- tienda de campaña',
];

const III_Dd30 = [
  'u brazo',
  '- cabeza',
  'u carámbano',
  '- garrote, palo',
  '- mano',
  '- misil',
  '- pie',
  'u tronco',
];

const III_Dd31 = [
  '- abanico',
  '- anatomía',
  'u animal',
  'ov árboles',
  '- cabeza de animal',
  'ov cabeza humana',
  'u calabaza',
  'ov calavera',
  '- cara',
  'o cesta',
  'ov cráneo',
  '- embrión',
  'u globo',
  'u guante de boxeo',
  'u huesos',
  'u humo',
  '- lámpara',
  'u manoplas, mitones',
  '- montañas',
  'u nube',
  '- ojos',
  'o olla',
  '- orejeras',
  'o parte de esqueleto',
  'o pelota',
  'o piedras',
  'u plumero',
  '- pulmones',
  '- sombrero',
  'u timbales',
  '- tortuga',
  '- útero',
  '- zapatos',
];

const III_Dd32 = [
  'u almeja',
  '- animal',
  '- cabeza de animal',
  'o cabeza de pájaro',
  'o cabeza humana',
  'u coco',
  'u estatua',
  '- huevo',
  'u máscara',
  '- ojo',
  'u ostra',
  '- pelota',
  '- pez',
  'u roca',
];

const III_Dd33 = [
  '- cabeza de animal',
  'u cabeza de pájaro',
  '- cabeza humana',
  'u dedo',
  'u garra',
  '- lanza',
  'u mano',
  'o pezuña',
  'u pie',
  '- punta de estilográfica o bolígrafo',
  '- tenedor',
  'o zapato',
];

const III_Dd34 = [
  '- animal',
  'o figura humana, parte superior',
  '- insecto',
  'ov montañas',
  'ov paisaje',
  'o pájaro',
  '- parte de esqueleto',
  '- pez',
  '- radiografía',
];

const III_Dd35 = [
  '- árboles',
  'u arco',
  '- cangrejo',
  'u cuenco',
  'u huesos',
  'u islas',
  'u jarrón',
  'u montañas, vista aérea',
  'ov paisaje',
  'o pájaros, dos',
  'o pelvis',
  'o radiografía de pelvis',
  '- radiografía específica, excepto de pelvis',
  'u radiografía sin especificar',
  '- rana',
];

export const LAMINAS: Record<string, Lamina> = {
  I: {
    popular: { area: 'W', respuestas: ['murciélago', 'mariposa'] },
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
  II: {
    popular: { area: 'D1', respuestas: ['oso', 'perro', 'elefante', 'cordero'] },
    areas: {
      W: II_W,
      D1: II_D1,
      D2: II_D2,
      D3: II_D3,
      D4: II_D4,
      DS5: II_DS5,
      D6: II_D6,
      Dd21: II_Dd21,
      Dd22: II_Dd22,
      Dd23: II_Dd23,
      Dd24: II_Dd24,
      Dd25: II_Dd25,
      Dd26: II_Dd26,
      Dd27: II_Dd27,
      Dd28: II_Dd28,
      DdS29: II_DdS29,
      DdS30: II_DdS30,
      Dd31: II_Dd31,
    },
  },
  III: {
    popular: { area: 'D1', respuestas: ['figura humana'] },
    areas: {
      W: III_W,
      D1: III_D1,
      D2: III_D2,
      D3: III_D3,
      D5: III_D5,
      D7: III_D7,
      D8: III_D8,
      D9: III_D9,
      Dd21: III_Dd21,
      Dd22: III_Dd22,
      DdS23: III_DdS23,
      DdS24: III_DdS24,
      Dd25: III_Dd25,
      Dd26: III_Dd26,
      Dd27: III_Dd27,
      Dd28: III_Dd28,
      Dd29: III_Dd29,
      Dd30: III_Dd30,
      Dd31: III_Dd31,
      Dd32: III_Dd32,
      Dd33: III_Dd33,
      Dd34: III_Dd34,
      Dd35: III_Dd35,
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
/**
 * Si alguna palabra de la respuesta empieza con lo escrito.
 *
 * Buscar en cualquier parte de la palabra traía cosas que nadie escribió:
 * "sal" devolvía "espina dorsal" por el final de "dorsal". Se busca por
 * principio de palabra, así "sal" trae "saliendo" y "dor" trae "dorsal".
 */
export function empiezaAlgunaPalabra(respuesta: string, q: string): boolean {
  return respuesta.split(/[^a-z0-9]+/).some((palabra) => palabra.startsWith(q));
}

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
 * las que empiezan con lo buscado y después por las que lo tienen al principio
 * de alguna de sus palabras.
 */
export function buscar(lamina: string, texto: string, conGiro = false): Hallazgo[] {
  const q = plano(texto.trim());
  // Desde la primera letra: quien codifica escribe la inicial de lo que la
  // persona dijo y espera ver lo que empieza así. Con dos letras de mínimo, la
  // lista aparecía recién después de la segunda y parecía que no había nada.
  if (q.length < 1) return [];

  const hallados: { h: Hallazgo; peso: number }[] = [];
  for (const area of areasDe(lamina)) {
    for (const e of entradasDe(lamina, area, conGiro)) {
      const r = plano(e.respuesta);
      if (r === q) hallados.push({ h: e, peso: 0 });
      else if (r.startsWith(q)) hallados.push({ h: e, peso: 1 });
      // Una palabra del medio entra recién con dos letras escritas: con una,
      // "c" traía "bicho" y "violonchelo" mezclados con "campana" y "casco", y
      // lo que se busca al escribir una inicial es lo que empieza así.
      else if (q.length > 1 && empiezaAlgunaPalabra(r, q)) hallados.push({ h: e, peso: 2 });
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
