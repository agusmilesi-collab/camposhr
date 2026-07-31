/**
 * Contenido del Cuestionario de Perfil (Benziger adaptado).
 *
 * Transcripción literal de las placas del cuestionario original. Para editar
 * un texto se toca solamente este archivo: la lógica de puntaje vive en
 * lib/perfiles.ts y no depende de la redacción.
 *
 * Los "modos" del texto original se corresponden con los perfiles así:
 *   Modo 1     -> BI (Basal Izquierdo)
 *   Modo 2     -> BD (Basal Derecho)
 *   Modo 3     -> FD (Frontal Derecho)
 *   Cuadrante 4-> FI (Frontal Izquierdo)
 */

import type { Perfil } from './perfiles';

export const AYUDA_ESCALA =
  'En una escala de 0 (no en absoluto) a 5 (completamente), ¿cuán cómodo se siente con este párrafo como descripción de su persona?';

export const CONSIGNA_FRASES =
  'A continuación lea las 15 frases colocando un tilde junto a aquellas que sean muy descriptivas de su persona. Deje en blanco todas aquellas frases que no se aplican a usted o que lo describen sólo en forma limitada.';

export const AYUDA_FRASES =
  'Identifique lo que le gusta hacer y lo que hace con mayor facilidad y sin esfuerzo.';

export type PlacaDescriptiva = {
  tipo: 'descriptiva';
  perfil: Perfil;
  texto: string;
};

export type PlacaFrases = {
  tipo: 'frases';
  perfil: Perfil;
  frases: string[];
};

export type Placa = PlacaDescriptiva | PlacaFrases;

/**
 * Las 8 placas puntuables, en el orden del cuestionario original:
 * descripción y frases de cada modo, uno después del otro.
 */
export const PLACAS: Placa[] = [
  {
    tipo: 'descriptiva',
    perfil: 'BI',
    texto:
      'El pensamiento del modo 1 es ordenado y se basa en procedimientos. Los verdaderos pensadores del modo 1 encuentran satisfacción al seguir rutinas y procedimientos establecidos. Maestros en prestar atención a los detalles. Leales, cumplidores y confiables, se los valora por la consistencia de su trabajo y por la minuciosidad. Son naturalmente conservadores, aprecian los valores tradicionales y prefieren abordar las tareas y resolver los problemas paso a paso.',
  },
  {
    tipo: 'frases',
    perfil: 'BI',
    frases: [
      'Me destaco en mantener las cosas organizadas.',
      'Me gusta trabajar en los detalles.',
      'Soy muy productivo, confiable y auto disciplinado.',
      'Disfruto de tareas tales como: clasificar, archivar, planificar y confeccionar rótulos.',
      'Creo que las reglas son importantes y deben cumplirse.',
      'Para trabajar prefiero guiarme por instrucciones y procedimientos específicos.',
      'Me considero conservador y tradicional.',
      'Tanto en el trabajo como en casa me gusta tener un lugar específico para cada cosa.',
      'Utilizo un método paso a paso para resolver los problemas y abordar las tareas.',
      'Me disgustan enérgicamente la ambigüedad y la falta de previsión.',
      'Completo mis tareas de manera puntual y ordenada.',
      'Prefiero relacionarme con personas que controlen sus emociones y se comporten adecuadamente.',
      'Siempre leo las instrucciones completamente antes de comenzar un proyecto.',
      'Disfruto de tener rutinas regulares y seguirlas.',
      'Prefiero programar mi vida personal y profesional y me molesta cuando tengo que desviarme de ese programa.',
    ],
  },
  {
    tipo: 'descriptiva',
    perfil: 'BD',
    texto:
      'El pensamiento del Modo 2 trabaja con el sentido y con lo que las cosas representan para las personas, y se basa en los sentimientos. Percibe las sutilezas y toma el estado de ánimo, las emociones y señales no verbales de los demás. Los pensadores del Modo 2 bien definidos suelen ser muy expresivos, y de manera instintiva transmiten alivio y alientan a los demás y se conectan con ellos por medio de palabras y gestos. Son compasivos por naturaleza y creen que es sumamente importante la forma en que se sienta una persona y transmiten esta inquietud de compasión y de armonía interpersonal y de las relaciones tanto a su vida personal como a la profesional. Dada su habilidad de empatía y de relacionarse de manera positiva, los pensadores del Modo 2 también se destacan por motivar a los demás a "unirse" compartiendo su emoción, entusiasmo y apoyo.',
  },
  {
    tipo: 'frases',
    perfil: 'BD',
    frases: [
      'Presto especial atención al lenguaje corporal y a la comunicación no verbal y tengo la capacidad de comprenderlo.',
      'Creo que los sentimientos son más verdaderos y más importantes que los pensamientos.',
      'Disfruto de "conectarme" verbalmente con los demás, de escuchar sus problemas y compartir sus sentimientos.',
      'Me considero una persona sumamente espiritual.',
      'Me relaciono con los demás con empatía y me resulta fácil sentir lo que ellos sienten.',
      'Me destaco en generar entusiasmo y en motivar positivamente a los demás.',
      'Con frecuencia toco a las personas espontáneamente de manera alentadora.',
      'Automáticamente observo el rostro de la persona con la que hablo.',
      'Me encanta cantar, bailar y escuchar música.',
      'Creo que el desarrollo y el crecimiento personal son sumamente importantes.',
      'Defino el éxito según la calidad de la experiencia.',
      'Considero que mis relaciones son la parte más importante de mi vida.',
      'Me siento incómodo ante situaciones de conflicto.',
      'Considero que la cooperación y la armonía son los valores humanos más importantes.',
      'Siempre deseo saber cómo se siente la gente y cómo se relaciona.',
    ],
  },
  {
    tipo: 'descriptiva',
    perfil: 'FD',
    texto:
      'El pensamiento del Modo 3 es visual, espacial y no verbal. Es metafórico y conceptual, se expresa como fotos o "películas" internas que al pensador del Modo 3 le encanta ver, lo que los convierte naturalmente en maestros de la integración, la innovación y la imaginación. Se aburren fácilmente y buscan constantemente la estimulación de nuevos conceptos, nuevas aventuras e información. Se los identifica fácilmente por su "sistema de archivo" visual que almacena el material en pilas por toda la casa u oficina; y por su extraño y a veces "especial" sentido del humor. Como "altruistas conceptuales", se interesan por la humanidad y su evolución, aunque quizá no sean adeptos a relacionarse uno a uno.',
  },
  {
    tipo: 'frases',
    perfil: 'FD',
    frases: [
      'Me concentro más en el "cuadro general" que en los detalles "quisquillosos", como la ortografía o llevar el saldo de mi cuenta corriente.',
      'Habitualmente se me ocurren ideas innovadoras y soluciones creativas.',
      'Se me reconoce como una persona muy expresiva y con mucha energía.',
      'Claramente me disgustan las tareas o actividades rutinarias y me aburro enseguida de ellas.',
      'Me destaco en sintetizar ideas o temas distintos en "un todo" nuevo.',
      'Prefiero trabajar en forma simultánea, procesando muchas ideas y tareas al mismo tiempo.',
      'Considero que la novedad, la originalidad y la evolución son los valores más importantes.',
      'Encuentro fácilmente la información en las pilas que armé para organizar mi casa u oficina.',
      'Utilizo metáforas y analogías visuales para explicar mi pensamiento a los demás.',
      'Me entusiasmo con las ideas novedosas o "extrañas" de los demás.',
      'A la hora de resolver problemas, confío en los presentimientos y en mi intuición.',
      'Tengo un sentido del humor que me ha llevado a tener problemas por no comportarme adecuadamente.',
      'Algunas de mis mejores ideas surgen mientras "no estoy haciendo nada en particular".',
      'He desarrollado muy bien mis habilidades relacionadas con el espacio y puedo "ver" fácilmente cómo reorganizar una habitación, volver a hacer una valija u ordenar el baúl del automóvil de modo tal que todo quepa bien.',
      'Tengo talento artístico.',
    ],
  },
  {
    tipo: 'descriptiva',
    perfil: 'FI',
    texto:
      'El pensamiento del Cuadrante 4 es lógico y matemático, y se destaca en el análisis crítico, la resolución de problemas de diagnóstico y en el uso de máquinas y herramientas. Los pensadores del Cuadrante 4 tienen metas bien definidas y la capacidad de calcular las estrategias más eficientes y costo-efectivas para cualquier situación. Esto los lleva a posiciones de liderazgo en las que pueden controlar las decisiones clave y manipular las circunstancias para alinearlas con los resultados deseados. Dada su habilidad de ser críticos y precisos, no es sorprendente que prefieran trabajos técnicos, mecánicos o financieros.',
  },
  {
    tipo: 'frases',
    perfil: 'FI',
    frases: [
      'Prefiero trabajar en temas técnicos o financieros.',
      'Me gusta el pensamiento crítico y analítico.',
      'Tengo buenas habilidades para resolver problemas técnicos y de diagnóstico.',
      'Me destaco en el estudio de las ciencias, finanzas, matemáticas y lógica.',
      'Me doy cuenta de que disfruto y recargo las energías en debates y disputas verbales.',
      'Me destaco en entender el funcionamiento de las máquinas y disfruto al usar herramientas y construir o reparar cosas.',
      'Prefiero tener la responsabilidad final a la hora de tomar decisiones y determinar prioridades.',
      'Considero que pensar es significativamente más importante que sentir.',
      'Me destaco en realizar inversiones y en administrar y potenciar los recursos clave como el tiempo y el dinero.',
      'Me considero básicamente un pensador lógico.',
      'Me destaco en delegar y dar órdenes.',
      'Suelo organizar el material en puntos claves y en principios operativos.',
      'Evalúo mi éxito en función de los resultados reales que produzco y por el resultado final.',
      'Me considero un líder poderoso, decidido y efectivo.',
      'Valoro la efectividad y la racionalidad por encima de todo lo demás.',
    ],
  },
];

/** Texto de la portada. */
export const PORTADA = {
  titulo: '¿Cómo trabajás?',
  texto:
    'Hay cuatro formas de trabajar y de procesar información. Este cuestionario identifica cuál te resulta más natural, la que te demanda menos esfuerzo. Lo que mide es preferencia: qué forma de trabajar reconocés como propia. No evalúa capacidad ni desempeño. Sirve para ubicarte en tareas donde rindas sin desgastarte, y para que quien te conduce sepa cómo hacerlo.',
  boton: 'Comenzar',
  duracion: 'Dura entre 8 y 10 minutos',
};

/** Ejes de la matriz, tal como se muestran en la placa original. */
export const EJES = {
  arriba: { titulo: 'Macro', bajada: 'Mundo de las ideas' },
  abajo: { titulo: 'Micro', bajada: 'Mundo del detalle' },
};
