/**
 * Las tres baterías que el cliente puede pedir.
 *
 * Copiadas de la tabla `Baterías` de Airtable (base Psicotécnicos): el código,
 * el nombre y a quién se recomienda salen de ahí. El precio no viaja al portal
 * a propósito: lo que el cliente elige es el alcance de la evaluación, y el
 * importe se acuerda por otro lado.
 *
 * La frase de "para quién" es una sola línea, porque va debajo de cada opción
 * en el formulario y ahí compite con el resto del cajón.
 */
export type Bateria = {
  codigo: string;
  nombre: string;
  paraQuien: string;
  proyectivo: string;
  minutos: number;
};

export const BATERIAS: Bateria[] = [
  {
    codigo: 'Batería 1',
    nombre: 'Básica',
    paraQuien: 'Puestos operativos y mandos medios.',
    proyectivo: 'Zulliger, Bender, gráfico, Raven y entrevista por competencias',
    minutos: 135,
  },
  {
    codigo: 'Batería 2',
    nombre: 'Estándar',
    paraQuien: 'Perfiles profesionales y mandos medios calificados.',
    proyectivo: 'Rorschach completo, Bender, gráfico, Raven y entrevista por competencias',
    minutos: 180,
  },
  {
    codigo: 'Batería 3',
    nombre: 'Ejecutiva',
    paraQuien: 'Jefaturas, gerencias y puestos de decisión.',
    proyectivo: 'Todo lo de la estándar más análisis discursivo (Elliot Jaques)',
    minutos: 210,
  },
];

export const CODIGOS_BATERIA = BATERIAS.map((b) => b.codigo);
