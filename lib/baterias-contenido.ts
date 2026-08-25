/**
 * Qué se le puede tomar a una persona y qué puede recibir el cliente.
 *
 * Es el vocabulario de las baterías: lo que se tilda en Configuración sale de
 * acá, y nada más que de acá. Escrito a mano, cada batería llevaba su propia
 * forma de nombrar lo mismo, y el nombre no es decorativo: la entrevista se
 * cierra sola cuando están administrados los tests de la batería
 * (`lib/entrevista-completa.ts`), y ahí se buscan por su nombre exacto.
 *
 * Sin `server-only`: lo lee la pantalla que los tilda.
 */

export type TestDeBateria = {
  nombre: string;
  /**
   * Si deja marca de administrado.
   *
   * Los que la dejan son los que cierran la entrevista sola. La entrevista por
   * competencias y el análisis discursivo no tienen dónde tildarse, así que una
   * batería hecha solo con ellos nunca se cierra sola. **Tiene que coincidir
   * con `MARCA` de `lib/entrevista-completa.ts`**, que es donde está la marca
   * que mira cada uno.
   */
  marca: boolean;
  /** Qué es, para quien arma la batería y no toma los tests. */
  que: string;
};

/** El test de manchas: va uno de los dos, nunca los dos. */
export const PROYECTIVOS = ['Rorschach', 'Zulliger'];

export const TESTS: TestDeBateria[] = [
  { nombre: 'Rorschach', marca: true, que: 'Manchas, diez láminas. Sostiene el sumario Exner completo.' },
  { nombre: 'Zulliger', marca: true, que: 'Manchas, tres láminas. Más corto, para baterías básicas.' },
  { nombre: 'Bender', marca: true, que: 'Copia de nueve figuras. Madurez visomotora.' },
  { nombre: 'Gráfico 2 personas', marca: true, que: 'Dibujo. Vínculo y esquema corporal.' },
  { nombre: 'Raven', marca: true, que: 'Matrices progresivas, 36 láminas. Habilidad cognitiva.' },
  {
    nombre: 'Entrevista por competencias',
    marca: false,
    que: 'La entrevista misma. No deja marca: no hay dónde tildarla.',
  },
  {
    nombre: 'Análisis discursivo (Elliot Jaques)',
    marca: false,
    que: 'Nivel de complejidad del discurso. No deja marca.',
  },
];

/** Lo que recibe el cliente. */
export const ENTREGABLES: { nombre: string; que: string }[] = [
  { nombre: 'Informe psicotécnico ejecutivo', que: 'El documento que se entrega.' },
  { nombre: 'Sumario estructural Exner', que: 'Los índices del protocolo. Pide Rorschach o Zulliger.' },
  { nombre: 'Mapa de competencias', que: 'Las nueve competencias con su puntaje.' },
  { nombre: 'Recomendaciones de incorporación', que: 'Qué hacer con la persona si entra.' },
];

/**
 * Si el contenido de una batería se puede sostener, y si no, por qué.
 *
 * Se comprueba del lado del servidor porque una batería mal armada no falla al
 * guardarse: falla meses después, en la ficha de alguien. Con los dos
 * proyectivos tildados, `proyectivoDeLaBateria` toma el primero del arreglo y
 * la evaluadora ve un test que nadie eligió.
 */
export function contenidoValido(
  tests: unknown,
  entregables: unknown
): { ok: true; tests: string[]; entregables: string[] } | { ok: false; motivo: string } {
  if (!Array.isArray(tests) || !Array.isArray(entregables)) {
    return { ok: false, motivo: 'Falta qué se toma y qué se entrega.' };
  }
  const nombres = TESTS.map((t) => t.nombre);
  const salidas = ENTREGABLES.map((e) => e.nombre);
  if (!tests.every((t) => typeof t === 'string' && nombres.includes(t))) {
    return { ok: false, motivo: 'Hay un test que no está en la lista.' };
  }
  if (!entregables.every((e) => typeof e === 'string' && salidas.includes(e))) {
    return { ok: false, motivo: 'Hay una entrega que no está en la lista.' };
  }
  const proyectivos = tests.filter((t) => PROYECTIVOS.includes(t as string));
  if (proyectivos.length > 1) {
    return {
      ok: false,
      motivo: 'Va un solo test de manchas: con los dos, la ficha muestra el que no se eligió.',
    };
  }
  if (entregables.includes('Sumario estructural Exner') && proyectivos.length === 0) {
    return {
      ok: false,
      motivo: 'El sumario estructural sale del test de manchas, así que hay que tomar uno.',
    };
  }
  // Se guarda en el orden del catálogo y no en el que se tildó: dos baterías
  // con lo mismo se leen igual en la cotización y en el portal del cliente.
  return {
    ok: true,
    tests: nombres.filter((n) => tests.includes(n)),
    entregables: salidas.filter((n) => entregables.includes(n)),
  };
}
