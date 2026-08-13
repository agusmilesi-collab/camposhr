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
 * **Dónde viven los documentos.** Como adjuntos de la empresa en Airtable, en el
 * campo "Documentos del portal", y no como archivos de este repositorio, que es
 * público y donde cualquiera podría leer lo que dice el documento sobre las
 * personas del cliente. El portal los busca por nombre de archivo y resuelve la
 * dirección al momento del clic (ver `app/p/[token]/doc/[archivo]/route.ts`).
 *
 * Un documento declarado acá y sin subir a Airtable no rompe nada: la tarjeta se
 * muestra sin enlace y avisando, hasta que el archivo esté.
 */
export type Documento = {
  /** Texto del botón. Corto: son tres en una línea. */
  nombre: string;
  /** Qué abre, en una línea, para quien no sabe cuál de los tres quiere. */
  detalle: string;
  /** Parte final de la dirección: /p/<token>/doc/<slug>. */
  slug: string;
  /** Nombre exacto del adjunto en Airtable. */
  archivo: string;
  /** Lo resuelve `serviciosDe` mirando si el adjunto está cargado: sin archivo
   *  la tarjeta se muestra sin enlace, en vez de llevar al cliente a un 404. */
  disponible?: boolean;
  /** La dirección ya armada, que necesita el token del portal. */
  href?: string;
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
        'Los documentos del trabajo de estructura y el alcance del tramo que sigue. Se actualizan a medida que avanzan las decisiones.',
      documentos: [
        {
          nombre: 'Casos',
          detalle: 'Los dos casos, con recomendación y plan de treinta días.',
          slug: 'casos',
          archivo: 'Laruso - Casos.html',
        },
        {
          nombre: 'Evaluaciones',
          detalle: 'El encaje de las once personas, con una ficha por cada una.',
          slug: 'evaluaciones',
          archivo: 'Laruso - Evaluaciones.html',
        },
        {
          nombre: 'Propuesta',
          detalle: 'Las tres correcciones de método y el trabajo que se propone.',
          slug: 'propuesta',
          archivo: 'Laruso - Propuesta.html',
        },
        {
          nombre: 'Rediseño',
          detalle: 'El organigrama objetivo y las decisiones de estructura.',
          slug: 'rediseno',
          archivo: 'Laruso - Rediseño.html',
        },
      ],
    },
  ],
};

/**
 * Los servicios de esa empresa, con cada documento resuelto contra los adjuntos
 * que la empresa tiene cargados.
 *
 * El día que un documento se sube a Airtable, su enlace se enciende solo, y
 * mientras tanto ningún cliente se encuentra con un enlace roto.
 */
export function serviciosDe(
  empresaId: string | null,
  token: string,
  adjuntos: string[]
): Servicio[] {
  if (!empresaId) return [];
  const servicios = SERVICIOS[empresaId];
  if (!servicios) return [];

  return servicios.map((sv) => ({
    ...sv,
    documentos: sv.documentos.map((d) => ({
      ...d,
      disponible: adjuntos.includes(d.archivo),
      href: `/p/${token}/doc/${d.slug}`,
    })),
  }));
}

/** El nombre de archivo que le corresponde a un slug, mirando todos los
 *  clientes: la ruta ya valida que ese cliente lo tenga cargado. */
export function archivoDe(slug: string): string | null {
  for (const servicios of Object.values(SERVICIOS)) {
    for (const sv of servicios) {
      const d = sv.documentos.find((x) => x.slug === slug);
      if (d) return d.archivo;
    }
  }
  return null;
}
