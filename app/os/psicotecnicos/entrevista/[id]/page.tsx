import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * La hoja de la entrevista vive en la ficha y en ningún otro lado.
 *
 * Era una pantalla aparte y ahora es la segunda pestaña: tener las dos dejaba
 * dos lugares donde hacer el mismo trabajo, y quien entraba por una no veía lo
 * que se había cargado desde la otra hasta recargar. Esta dirección queda
 * redirigiendo, porque está en el historial de las evaluadoras y en enlaces
 * mandados por chat.
 *
 * La pantalla de codificación (`/rorschach`) sigue colgando de acá: esa sí se
 * abre suelta, para tener las láminas de un lado y la grilla del otro.
 */
export default function EntrevistaVieja({ params }: { params: { id: string } }) {
  redirect(`/os/psicotecnicos/ficha/${params.id}?ver=entrevista`);
}
