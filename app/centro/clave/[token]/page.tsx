import Clave from './Clave';

export const dynamic = 'force-dynamic';

/**
 * Poner la contraseña con el enlace de un solo uso.
 *
 * La pantalla no comprueba el enlace: lo hace la ruta al guardar. Decir de
 * antemano que un enlace es válido convierte esta dirección en un probador de
 * enlaces ajenos.
 */
export default function PonerClave({ params }: { params: { token: string } }) {
  return <Clave token={params.token} />;
}
