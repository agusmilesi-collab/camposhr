/**
 * Servicios que un cliente tiene además de las evaluaciones.
 *
 * El portal nació para seguir psicotécnicos, y hay clientes que además tienen
 * un trabajo de diseño organizacional con sus propios documentos. Esos
 * documentos se listan acá, arriba de los pedidos, porque son el trabajo de
 * fondo y las evaluaciones son una parte de él.
 *
 * La clave es el ID de la empresa en Airtable y no el token del portal: el token
 * es el secreto que da acceso y este repositorio es público.
 *
 * **Los documentos todavía no tienen dónde vivir.** Hoy se sirven desde
 * `public/doc/`, que está fuera del control de versiones justamente porque son
 * documentos de un cliente real y el repositorio es público. Antes de publicar
 * esta sección hay que decidir de dónde se sirven: enlace secreto al estilo de
 * las cotizaciones, almacenamiento privado, o adjunto en Airtable.
 */
export type Documento = {
  /** Texto del botón. Corto: son tres en una línea. */
  nombre: string;
  /** Qué abre, en una línea, para quien no sabe cuál de los tres quiere. */
  detalle: string;
  href: string;
};

export type Servicio = {
  titulo: string;
  bajada: string;
  documentos: Documento[];
};

const SERVICIOS: Record<string, Servicio[]> = {
  // Laruso SRL
  recW8hxy0qYGOEOt3: [
    {
      titulo: 'Diseño Organizacional',
      bajada:
        'Los documentos del trabajo de estructura. Se actualizan a medida que avanzan las decisiones.',
      documentos: [
        {
          nombre: 'Casos',
          detalle: 'Los dos casos, con recomendación y plan de treinta días.',
          href: '/doc/laruso-casos.html',
        },
        {
          nombre: 'Psicotécnicos',
          detalle: 'El encaje de las once personas, con una ficha por cada una.',
          href: '/doc/laruso-evaluaciones.html',
        },
        {
          nombre: 'Rediseño',
          detalle: 'El organigrama objetivo y las decisiones de estructura.',
          href: '/doc/laruso-rediseno.html',
        },
      ],
    },
  ],
};

export function serviciosDe(empresaId: string | null): Servicio[] {
  if (!empresaId) return [];
  return SERVICIOS[empresaId] ?? [];
}
