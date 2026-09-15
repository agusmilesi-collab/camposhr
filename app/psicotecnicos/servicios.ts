/**
 * El contenido de las pestañas de coaching y de entrevistas.
 *
 * Sale del PDF de honorarios (agosto 2026) y está escrito acá, no en la base:
 * a diferencia de las baterías, estos servicios no pasan por el OS y no hay un
 * precio cargado en Configuración que leer. Cuando cambie un precio, se cambia
 * en este archivo.
 *
 * Cada pestaña sigue el mismo orden que la de psicotécnicos: las tarjetas con
 * precio, cómo se trabaja o qué se entrega, los pasos,
 * las condiciones y quiénes lo hacen.
 */

export type Tarjeta = {
  codigo: string;
  /** El color de la pastilla, el mismo en la tarjeta y en la tabla. */
  color: 1 | 2 | 3;
  duracion?: string;
  monto: number;
  unidad: string;
  titulo: string;
  cuando: string;
  detalles: { titulo: string; items: string[] }[];
  agregado?: { rotulo: 'Recomendado' | 'Opcional'; nombre: string; texto: string };
};

export type Servicio = {
  bajadaMarca: string;
  seccion: string;
  tarjetas: Tarjeta[];
  lectura: {
    titulo: string;
    intro: string;
    items: { paso: string; que: string; texto: string }[];
  };
  pasos: { titulo: string; texto: string };
  condiciones: string;
  equipo: string;
};

/** La devolución a la persona evaluada: se ofrece en psicotécnicos y en entrevistas. */
export const DEVOLUCION = 60000;

const CONDICIONES =
  'El presupuesto tiene una vigencia de 90 días. Se emite factura C y el total se paga en un plazo máximo de 14 días corridos; el pago diferido tiene un recargo del 4% mensual. Los precios se actualizan cada trimestre con el 100% de la variación acumulada del IPC Nivel General que publica el INDEC.';

export const COACHING: Servicio = {
  bajadaMarca: 'Coaching laboral',
  seccion: 'Coaching laboral con base en evaluación psicológica',
  tarjetas: [
    {
      codigo: 'Individual',
      color: 1,
      duracion: '45 min por sesión',
      monto: 60000,
      unidad: 'por sesión',
      titulo: 'Sesión individual',
      cuando:
        'La persona trabaja sola con la psicóloga sobre los casos concretos que enfrenta en su día a día: sus decisiones, su forma de actuar y cómo se comunica y se vincula con otros.',
      detalles: [
        {
          titulo: 'Formato',
          items: ['Sesión individual de 45 minutos.', 'Modalidad virtual.'],
        },
      ],
      agregado: {
        rotulo: 'Recomendado',
        nombre: 'Evaluación psicotécnica previa.',
        texto:
          'Cuando se cuenta con una evaluación psicotécnica, sus indicadores se usan como base para intervenir de manera más precisa y acortar tiempos.',
      },
    },
    {
      codigo: 'Con HR o superior',
      color: 2,
      monto: 95000,
      unidad: 'por sesión',
      titulo: 'Sesión con participación de HR o del superior',
      cuando:
        'Se suma a la sesión alguien de Recursos Humanos o el superior de la persona, según lo que necesite el proceso.',
      detalles: [
        {
          titulo: 'Formato',
          items: ['Hasta 2 personas además de la psicóloga.', 'Modalidad virtual.'],
        },
      ],
      agregado: {
        rotulo: 'Recomendado',
        nombre: 'Evaluación psicotécnica previa.',
        texto:
          'Cuando se cuenta con una evaluación psicotécnica, sus indicadores se usan como base para intervenir de manera más precisa y acortar tiempos.',
      },
    },
    {
      codigo: 'Grupal',
      color: 3,
      monto: 180000,
      unidad: 'por sesión',
      titulo: 'Sesión grupal',
      cuando:
        'Se trabaja con un grupo chico sobre las situaciones reales que comparten en el rol.',
      detalles: [
        {
          titulo: 'Formato',
          items: ['Hasta 4 personas.', 'Modalidad virtual.'],
        },
      ],
      agregado: {
        rotulo: 'Recomendado',
        nombre: 'Evaluación psicotécnica previa.',
        texto:
          'Cuando se cuenta con una evaluación psicotécnica, sus indicadores se usan como base para intervenir de manera más precisa y acortar tiempos.',
      },
    },
  ],
  lectura: {
    titulo: 'Metodología de trabajo',
    intro:
      'El objetivo es mejorar el desempeño en el rol con intervenciones concretas sobre la forma de trabajar, la toma de decisiones y la gestión de situaciones del día a día, incluidas la comunicación y el vínculo con otros.',
    items: [
      {
        paso: 'El material',
        que: 'Situaciones reales del rol.',
        texto: 'Se trabaja sobre los casos concretos que la persona enfrenta en su día a día.',
      },
      {
        paso: 'En cada sesión',
        que: 'Alternativas para aplicar entre encuentros.',
        texto:
          'Se analizan decisiones, formas de actuar y dinámicas de interacción, y se definen alternativas más efectivas para implementar antes del encuentro siguiente.',
      },
      {
        paso: 'A lo largo del proceso',
        que: 'Ajuste según el avance.',
        texto:
          'El proceso se ajusta al objetivo, al nivel de avance y a la capacidad de implementación de la persona, para generar cambios concretos en su forma de trabajar.',
      },
    ],
  },
  pasos: {
    titulo: 'Frecuencia y duración',
    texto:
      'La frecuencia inicial recomendada es semanal, para generar avances concretos en las primeras etapas, y después puede pasar a quincenal para acompañar la implementación en el día a día. La duración total y la cantidad de sesiones se definen según el objetivo, el nivel de avance de la persona y las expectativas acordadas con el consultante.',
  },
  condiciones: `Las sesiones se facturan una vez acordada la fecha de cada una. ${CONDICIONES}`,
  equipo: 'Profesionales a cargo',
};

export const ENTREVISTAS: Servicio = {
  bajadaMarca: 'Entrevistas y referencias',
  seccion: 'Entrevistas y referencias',
  tarjetas: [
    {
      codigo: 'Egreso',
      color: 1,
      monto: 95000,
      unidad: 'por entrevista',
      titulo: 'Entrevista de egreso',
      cuando:
        'Permite comprender las razones reales detrás de la salida de un colaborador y detectar oportunidades de mejora en la organización.',
      detalles: [
        {
          titulo: 'Aporta',
          items: [
            'Identificación de patrones de rotación.',
            'Detección de problemas en el liderazgo, en el rol o en el equipo.',
            'Información clave para ajustar decisiones futuras.',
          ],
        },
      ],
    },
    {
      codigo: 'Devolución',
      color: 2,
      monto: DEVOLUCION,
      unidad: 'por persona evaluada',
      titulo: 'Devolución a la persona evaluada',
      cuando:
        'La psicóloga le devuelve a la persona los resultados de su evaluación psicotécnica. Se suma a cualquiera de las tres baterías, y la inversión está a cargo de la empresa o del consultante.',
      detalles: [],
    },
    {
      codigo: 'Referencias',
      color: 3,
      monto: 130000,
      unidad: 'por candidato',
      titulo: 'Referencias laborales y validación de antecedentes',
      cuando:
        'Permite validar la información del candidato y obtener una mirada externa sobre su desempeño en experiencias laborales previas.',
      detalles: [
        {
          titulo: 'Aporta',
          items: [
            'Mayor seguridad en la decisión de contratación.',
            'Detección de posibles alertas.',
            'Confirmación de fortalezas y estilo de trabajo.',
          ],
        },
      ],
    },
  ],
  lectura: {
    titulo: 'Entregables',
    intro: 'La entrevista de egreso y las referencias cierran con un informe escrito para la empresa:',
    items: [
      {
        paso: 'Cuando alguien se va',
        que: 'Informe de egreso.',
        texto:
          'Integra los principales hallazgos y las conclusiones para la empresa. Transforma una salida en información útil para mejorar la gestión y reducir futuras rotaciones.',
      },
      {
        paso: 'Antes de contratar',
        que: 'Informe de referencias.',
        texto:
          'Integra las referencias laborales y la situación crediticia del candidato. Reduce el riesgo de la decisión final, con información que no surge en las entrevistas.',
      },
    ],
  },
  pasos: {
    titulo: 'Cómo se hace',
    texto:
      'En la entrevista de egreso hablamos a solas con quien se va, presencial o por videollamada, en un espacio de confianza, sobre los motivos de su salida y su experiencia en la organización. En las referencias contactamos a los empleadores anteriores del candidato, priorizando las experiencias más relevantes para el puesto, y en paralelo verificamos sus antecedentes crediticios.',
  },
  condiciones: CONDICIONES,
  equipo: 'Profesionales a cargo',
};
