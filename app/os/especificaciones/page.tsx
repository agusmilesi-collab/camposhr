import { redirect } from 'next/navigation';

/**
 * Acá estuvo el índice de los specs hasta el 13/10/2026. Era un texto fijo de
 * cuando el OS arrancaba y había quedado viejo; los documentos siguen en la
 * carpeta `CAMPOS OS` del repositorio. La dirección puede estar guardada.
 */
export default function Especificaciones() {
  redirect('/os');
}
