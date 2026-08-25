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
   * Si cierra la entrevista al quedar administrado.
   *
   * La entrevista por competencias no tiene dónde tildarse, y el nivel del
   * análisis discursivo se ubica después, al analizar, así que esperarlo dejaría
   * la entrevista abierta con la persona ya saludando. Una batería hecha solo
   * con esos dos nunca se cierra sola. **Tiene que coincidir con `MARCA` de
   * `lib/entrevista-completa.ts`**, que es donde está la marca que mira cada
   * uno.
   */
  marca: boolean;
  /** Qué es, para quien arma la batería y no toma los tests. */
  que: string;
};

/** El test de manchas: va uno de los dos, nunca los dos. */
export const PROYECTIVOS = ['Rorschach', 'Zulliger'];

/** El que sostiene el informe de potencial. */
export const ANALISIS_DISCURSIVO = 'Análisis discursivo (Elliot Jaques)';

export const TESTS: TestDeBateria[] = [
  { nombre: 'Rorschach', marca: true, que: 'Manchas, diez láminas. Sostiene el sumario Exner completo.' },
  { nombre: 'Zulliger', marca: true, que: 'Manchas, tres láminas. Más corto, para baterías básicas.' },
  { nombre: 'Bender', marca: true, que: 'Copia de nueve figuras. Madurez visomotora.' },
  { nombre: 'Gráfico 2 personas', marca: true, que: 'Dibujo. Vínculo y esquema corporal.' },
  { nombre: 'Raven', marca: true, que: 'Matrices progresivas, 36 láminas. Habilidad cognitiva.' },
  {
    nombre: 'Entrevista por competencias',
    marca: false,
    que: 'La entrevista misma. No hay dónde tildarla, así que no cierra la entrevista.',
  },
  {
    nombre: ANALISIS_DISCURSIVO,
    marca: false,
    que: 'Nivel de complejidad del discurso, sobre cinco minutos de habla. El escalón se ubica al analizar, así que no cierra la entrevista.',
  },
];

/**
 * Lo que recibe el cliente.
 *
 * Son las secciones del informe, con el nombre que llevan ahí. El documento
 * entero no está en la lista porque es el continente: lo que se elige es qué
 * trae adentro.
 *
 * El sumario estructural no se entrega y por eso no está: son los índices
 * crudos del protocolo, que se leen en la ficha y no se publican. El perfil
 * Benziger tampoco, porque no lo decide la batería sino el pedido
 * (`pedidos.con_benziger`), igual que su administración.
 */
export const ENTREGABLES: { nombre: string; que: string }[] = [
  {
    nombre: 'Recomendación de incorporación',
    que: 'Si conviene incorporarlo: ajuste alto, con aspectos a desarrollar, con alertas o bajo.',
  },
  {
    nombre: 'Mapa de competencias',
    que: 'Las nueve competencias con su puntaje, y el análisis cualitativo de cada una.',
  },
  {
    nombre: 'Recomendaciones para su líder',
    que: 'Qué hacer con la persona si entra, punto por punto.',
  },
  {
    nombre: 'Informe de potencial',
    que: 'Hasta dónde puede crecer. Sale del análisis discursivo, así que pide tomarlo.',
  },
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
  if (entregables.includes('Informe de potencial') && !tests.includes(ANALISIS_DISCURSIVO)) {
    return {
      ok: false,
      motivo: `El informe de potencial sale del ${ANALISIS_DISCURSIVO}, así que hay que tomarlo.`,
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
