/**
 * El envío de los cambios de configuración a la ruta única.
 *
 * Está aparte porque las tres pestañas mandan igual y solo cambia el cuerpo:
 * repetir el fetch en cada una era repetir también el manejo del error.
 */

export async function mandar(
  datos: Record<string, unknown>
): Promise<{
  ok: boolean;
  motivo?: string;
  id?: string;
  enlace?: string;
  /** Cuántas fechas entraron y cuáles ya estaban ocupadas, al repetir. */
  creadas?: number;
  chocaron?: string[];
}> {
  const res = await fetch('/api/os/consultorios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  return res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta del servidor.' }));
}

export function pesos(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}
