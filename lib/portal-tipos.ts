/** Lo que el portal de clientes muestra: la empresa, sus búsquedas y sus candidatos. */

export type Candidato = {
  id: string;
  nombre: string;
  estado: string;
  evaluadora: string | null;
  fechaEntrevista: string | null;
  fechaEntrega: string | null;
  modalidad: string | null;
  /** Conclusión del informe: Apto, Apto con observaciones, Apto con alertas,
   *  No apto. Solo se muestra en los candidatos ya entregados. */
  recomendacion: string | null;
  /** Hay un PDF de informe cargado y el candidato está entregado. */
  tieneInforme: boolean;
  /** Estado de cobro de esa evaluación. Son dos preguntas encadenadas: si no
   *  está facturada, lo pagado no aplica. `null` = todavía sin cargar. */
  facturado: boolean | null;
  pagado: boolean | null;
  /** Quién de la empresa lo cargó, cuando no es quien abrió el pedido. */
  cargadoPor?: string | null;
  /** El día en que se dio de baja del proceso, si se dio. */
  baja?: string | null;
  /** Para qué ciudad se lo evalúa, en los clientes que la piden. */
  ciudad?: string | null;
};

export type Busqueda = {
  id: string;
  puesto: string;
  estado: string;
  area: string | null;
  seniority: string | null;
  fecha: string | null;
  candidatos: Candidato[];
  /**
   * Con qué se evalúa a quien entre a esta búsqueda.
   *
   * Es del pedido y no del candidato: los tres que entran para el mismo puesto
   * se miden con lo mismo, o sus informes no se pueden comparar.
   */
  bateria: string | null;
  conBenziger: boolean;
  /** Cómo se llama el descriptivo de puesto que ya tiene cargado, si tiene. */
  descriptivo?: string | null;
  /**
   * Quién de la empresa pidió la búsqueda (`pedidos.solicitante_id`). Null en
   * los pedidos sin solicitante.
   */
  solicitante?: string | null;
  /**
   * De qué empresa es, cuando el portal es de un grupo de empresas
   * (`lib/grupo.ts`): las mismas personas piden para varias, y cada búsqueda
   * dice para cuál es. Sin grupo no viene.
   */
  empresaId?: string;
  empresaNombre?: string;
};

export type DatosCliente = {
  empresa: string;
  /**
   * Las empresas del grupo, con la que lo encabeza primera. Viene solo cuando
   * el portal es de un grupo: es lo que se ofrece en "¿Para qué empresa es?".
   */
  empresas?: { id: string; nombre: string }[];
  /** Id de la empresa. Lo usa lib/servicios.ts para saber qué documentos
   *  tiene este cliente además de las evaluaciones. */
  empresaId: string | null;
  busquedas: Busqueda[];
  /**
   * Si el portal deja abrir los informes.
   *
   * Se prende y se apaga desde la ficha del cliente en el OS. Apagado, la tabla
   * de entregados sale sin la columna del informe y las rutas que lo sirven
   * contestan que no existe: esconder el botón y dejar la dirección abierta no
   * sería esconder nada.
   */
  informesVisibles: boolean;
};
