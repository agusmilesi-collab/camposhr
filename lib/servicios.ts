/**
 * Servicios que un cliente tiene además de las evaluaciones.
 *
 * El portal nació para seguir psicotécnicos, y hay clientes que además tienen
 * un trabajo de diseño organizacional con sus propios documentos. Esos
 * documentos se listan acá, arriba de los pedidos, porque son el trabajo de
 * fondo y las evaluaciones son una parte de él.
 *
 * La clave es el ID de la empresa en Airtable y no el token del portal: el
 * token es el secreto que da acceso, y esto se lee en el listado de accesos.
 *
 * **Dónde viven los documentos.** Como archivos de este repositorio, en
 * `documentos/<cliente>/`, y a propósito fuera de `public/`: lo que está en
 * `public/` lo sirve Next a cualquiera que tenga la dirección, sin pasar por
 * el token. La ruta `app/p/[token]/doc/[archivo]/route.ts` los lee del disco y
 * los entrega recién después de comprobar que el token pertenece a la empresa
 * dueña del documento.
 *
 * Documento nuevo = copiar el HTML a `documentos/<cliente>/`, sumar su entrada
 * acá y desplegar. Un documento declarado sin su archivo devuelve 404, así que
 * las dos cosas van juntas.
 */
export type Documento = {
  /** Texto del botón. Corto: son tres en una línea. */
  nombre: string;
  /** Qué abre, en una línea, para quien no sabe cuál quiere. */
  detalle: string;
  /** Parte final de la dirección: /p/<token>/doc/<slug>. */
  slug: string;
  /** Ruta del archivo dentro de `documentos/`. */
  archivo: string;
  /** La dirección ya armada, que necesita el token del portal. */
  href?: string;
};

export type Servicio = {
  titulo: string;
  documentos: Documento[];
};

const SERVICIOS: Record<string, Servicio[]> = {
  // Laruso SRL
  recW8hxy0qYGOEOt3: [
    {
      titulo: 'Diseño Organizacional',
      documentos: [
        {
          nombre: 'Casos',
          detalle: 'Los dos casos, con recomendación y plan de treinta días.',
          slug: 'casos',
          archivo: 'laruso/casos.html',
        },
        {
          nombre: 'Evaluaciones',
          detalle: 'El encaje de las once personas, con una ficha por cada una.',
          slug: 'evaluaciones',
          archivo: 'laruso/evaluaciones.html',
        },
        {
          nombre: 'Propuesta',
          detalle: 'Las tres correcciones de método y el trabajo que se propone.',
          slug: 'propuesta',
          archivo: 'laruso/propuesta.html',
        },
      ],
    },
  ],
};

/** Los servicios de esa empresa, con la dirección de cada documento resuelta
 *  contra el token del portal. */
export function serviciosDe(
  empresaId: string | null,
  token: string
): Servicio[] {
  if (!empresaId) return [];
  const servicios = SERVICIOS[empresaId];
  if (!servicios) return [];

  return servicios.map((sv) => ({
    ...sv,
    documentos: sv.documentos.map((d) => ({
      ...d,
      href: `/p/${token}/doc/${d.slug}`,
    })),
  }));
}

/**
 * El archivo que le corresponde a un slug, dentro de los documentos de esa
 * empresa y de ninguna otra.
 *
 * Acá está el control de acceso: la empresa sale del token y los slugs se
 * buscan sólo entre los suyos, así que el token de un cliente no alcanza para
 * abrir el documento de otro aunque adivine el slug.
 */
export function archivoDe(empresaId: string, slug: string): string | null {
  for (const sv of SERVICIOS[empresaId] ?? []) {
    const d = sv.documentos.find((x) => x.slug === slug);
    if (d) return d.archivo;
  }
  return null;
}
