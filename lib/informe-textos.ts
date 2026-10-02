/**
 * Lo que el informe dice siempre igual.
 *
 * Sale del esqueleto que escribió la evaluadora y del informe que hoy se
 * entrega. Vive acá y no adentro de la plantilla para que cambiar una frase sea
 * cambiar una frase, sin tocar el armado ni el diseño.
 */

/** Los cuatro niveles de ajuste, en el orden en que se imprimen. */
export type NivelAjuste = {
  clave: 'alto' | 'desarrollar' | 'alertas' | 'bajo';
  titulo: string;
  texto: string;
  /**
   * El color con el que se pinta la tarjeta cuando es la elegida.
   *
   * Cuatro colores para cuatro niveles, y en el orden en que se leen: verde lo
   * que anda, azul lo que anda con acompañamiento, ámbar lo que hay que seguir
   * de cerca, rojo lo que no. El de desarrollar era ámbar y se confundía con el
   * de alertas, que es el nivel siguiente: dos avisos del mismo color no dicen
   * cuál es más grave.
   */
  color: 'verde' | 'azul' | 'ambar' | 'rojo';
};

export const NIVELES: NivelAjuste[] = [
  {
    clave: 'alto',
    titulo: 'Ajuste alto',
    texto:
      'Se desempeñaría de manera adecuada en el rol de acuerdo al ajuste entre el puesto y la evaluación psicotécnica, aparentemente sin grandes dificultades para su desempeño. De todos modos dependerá de la gestión de su líder directo y de la cultura organizacional a la que se incorpora para terminar de definir un ajuste sólido.',
    color: 'verde',
  },
  {
    clave: 'desarrollar',
    titulo: 'Ajuste con aspectos a desarrollar',
    texto:
      'Puede desempeñarse adecuadamente en el rol, aunque presenta algunos aspectos a desarrollar que, con acompañamiento, aparentemente no deberían impactar de manera significativa en su desempeño.',
    color: 'azul',
  },
  {
    clave: 'alertas',
    titulo: 'Ajuste con alertas',
    texto:
      'Podría desempeñarse en el rol, aunque presenta aspectos que podrían impactar su rendimiento, especialmente en contextos de presión o alta exigencia, requiriendo seguimiento cercano teniendo en cuenta las recomendaciones detalladas en el informe.',
    color: 'ambar',
  },
  {
    clave: 'bajo',
    titulo: 'Ajuste bajo',
    texto:
      'Presenta un nivel de adecuación bajo a las exigencias del rol, lo que podría dificultar su desempeño y requerir un nivel de acompañamiento elevado para sostenerlo.',
    color: 'rojo',
  },
];

/**
 * Con qué valor se guarda cada nivel: con su propio nombre.
 *
 * Hasta el 2/10/2026 la base guardaba "Apto", "Apto con observaciones", "Apto
 * con alertas" y "No apto" mientras la pantalla y el informe decían "Ajuste
 * alto", "Ajuste con aspectos a desarrollar", "Ajuste con alertas" y "Ajuste
 * bajo". Un dato que se guarda con un nombre y se muestra con otro obliga a
 * traducir en cada lectura, y cualquiera que mire la tabla ve algo distinto de
 * lo que firmó la psicóloga.
 */
export const CONCLUSIONES: { valor: string; nivel: NivelAjuste }[] = NIVELES.map((nivel) => ({
  valor: nivel.titulo,
  nivel,
}));

/**
 * Los nombres con los que se guardaba antes.
 *
 * Las evaluaciones de la base se migraron, pero las que todavía se leen de
 * Airtable siguen trayendo los viejos, y los dos juegos de "Encaja" vivieron un
 * tiempo en el sistema. Se entienden al leer; no se escriben más.
 */
const NOMBRES_VIEJOS: Record<string, number> = {
  Apto: 0,
  'Encaja con el puesto': 0,
  'Apto con observaciones': 1,
  'Encaja, con desarrollo': 1,
  'Apto con alertas': 2,
  'No apto': 3,
  'Encaja si cambia el puesto': 3,
};

/** Cómo se llama en pantalla lo que está guardado. */
export function nivelDeConclusion(valor: string | null): NivelAjuste | null {
  if (!valor) return null;
  const propio = CONCLUSIONES.find((c) => c.valor === valor)?.nivel;
  if (propio) return propio;
  const viejo = NOMBRES_VIEJOS[valor];
  return viejo === undefined ? null : NIVELES[viejo];
}

/** El pie del semáforo. */
export const NOTA_AJUSTE =
  'El nivel de ajuste considera las competencias evaluadas y el estilo de trabajo en relación al rol, pudiendo verse influido por el contexto organizacional, el estilo de liderazgo y la dinámica del equipo.';

/**
 * Los cuatro cuadrantes del Benziger.
 *
 * `resumen` es lo que va en la esquina del gráfico del cerebro, y `caracteristicas`
 * lo que se despliega cuando el cuadrante resulta el preferente.
 */
export type Cuadrante = {
  clave: 'FI' | 'FD' | 'BI' | 'BD';
  nombre: string;
  resumen: string;
  caracteristicas: string[];
};

export const CUADRANTES: Cuadrante[] = [
  {
    clave: 'FI',
    nombre: 'Frontal izquierdo',
    resumen: 'Analista, decisiones. Metas y dirección.',
    caracteristicas: [
      'Se destaca en el análisis crítico, la resolución de problemas de diagnóstico y el establecimiento de prioridades.',
      'Capacidad de calcular las estrategias más eficientes en costo y efectividad.',
      'Tiene preferencia por la toma de decisiones lógicas y carentes de emoción.',
      'Su capacidad para comparar realidades dispares y analizar situaciones complejas le permite administrar con responsabilidad.',
      'Prefiere la palabra escrita sobre la hablada, y los datos que apoyan su punto de vista.',
      'Necesita entender por qué el tema es importante y vale la pena discutirlo.',
    ],
  },
  {
    clave: 'FD',
    nombre: 'Frontal derecho',
    resumen: 'Creatividad e innovación. Solucionar problemas. Arriesgar.',
    caracteristicas: [
      'Prefiere la conversación activa e informal por encima de la reunión formal o estática.',
      'Necesita entender por qué se le pide participar en la discusión o qué consejo se espera que brinde.',
      'Se une de lleno cuando el tema es de su interés.',
      'En el trabajo se centra en una agenda que le sea significativa, abierta a las posibilidades, la innovación y la acción sin límites.',
      'Disfruta de trabajar con autonomía e independencia, y le desagradan las tareas repetitivas o de extensión larga.',
      'Toma riesgos. Aprende inventando y experimentando. Pensamiento innovador, visionario y creativo.',
    ],
  },
  {
    clave: 'BI',
    nombre: 'Basal izquierdo',
    resumen: 'Organización, productividad. Monitoreo y control.',
    caracteristicas: [
      'El pensamiento del modo basal izquierdo es ordenado, leal, cumplidor y confiable.',
      'Se basa en procedimientos, y se distingue por la habilidad de repetir una acción de manera consistente y precisa a lo largo del tiempo.',
      'Tiene gran habilidad para prestar atención a los detalles.',
      'Aprecia los valores tradicionales y prefiere abordar las tareas y resolver los problemas paso a paso.',
      'Construye, mantiene y garantiza cimientos sólidos y ordenados.',
    ],
  },
  {
    clave: 'BD',
    nombre: 'Basal derecho',
    resumen: 'Buena voluntad. Armonizador, líder. Empatía.',
    caracteristicas: [
      'El pensamiento del modo basal derecho es espiritual y simbólico, y se basa en los sentimientos.',
      'Percibe las sutilezas, las emociones y las señales no verbales de los demás. Transmite alivio, alienta y se conecta con las personas por medio de palabras y gestos.',
      'Líder natural de las relaciones pacíficas: trata de acortar la brecha entre las personas para aportar la paz y la armonía necesarias.',
      'Prefiere la palabra hablada sobre la escrita, y el uso de un lenguaje descriptivo o práctico.',
      'Necesita entender quién es la otra persona y qué relación existe entre ellos.',
      'Adopta un enfoque personal para el trabajo, seleccionando cuidadosamente con quién pasar su tiempo.',
      'Le interesa la opinión de la otra persona, su experiencia y lo que sabe, y le gusta comprender lo que tienen en común.',
    ],
  },
];

/**
 * Qué se le administró, por batería.
 *
 * El Benziger es opcional en las tres y se suma al final, que es donde está en
 * el informe que se entrega hoy.
 */
const COMUNES = [
  'Entrevista por competencias.',
  'Test de Bender.',
  'Test gráfico (dibujo de dos personas trabajando).',
  'Test de lógica: Raven, serie avanzada II.',
];

export function tecnicas(bateria: string | null, conBenziger: boolean): string[] {
  const manchas = bateria === 'Batería 1' ? 'Test de Zulliger.' : 'Test de Rorschach.';
  const lista = [...COMUNES, manchas];
  if (bateria === 'Batería 3') lista.push('Análisis discursivo según E. Jaques.');
  if (conBenziger) lista.push('Cuestionario Benziger (licencia original).');
  return lista;
}

/** El pie de todos los informes. */
export const CONFIDENCIALIDAD =
  'Los resultados contenidos en este informe son confidenciales. El contenido se obtuvo dentro de un contexto de evaluación llevado adelante por una psicóloga habilitada, siendo la única persona autorizada para dar feedback. La información se infiere al objetivo específico determinado con el cliente y puede contar con validez de hasta un año calendario a partir de la fecha de evaluación.';

/**
 * Quién firma. La matrícula es parte de la firma y no un dato de contacto.
 *
 * El correo es opcional: la firma vale por el título y la matrícula, que son lo
 * que habilita a firmar el informe, y sin correo cargado el renglón no sale en
 * vez de salir vacío.
 */
export const FIRMAS: Record<
  string,
  { titulo: string; matricula: string; correo?: string; trazo?: string }
> = {
  'Lorena Campos': {
    titulo: 'Lic. en Psicología',
    matricula: '5217',
    correo: 'lorecamposhr@gmail.com',
    // La firma manuscrita, en el bucket privado: este repositorio es público y
    // una firma en `public/` se baja limpia desde cualquier lado.
    trazo: 'firmas/lorena-campos.png',
  },
  'Lucila Campos': {
    titulo: 'Lic. en Psicología',
    matricula: '6338',
    correo: 'lulicamposhr@gmail.com',
    trazo: 'firmas/lucila-campos.png',
  },
};
