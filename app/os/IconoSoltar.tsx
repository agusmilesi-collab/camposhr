/**
 * El dibujo de la caja donde se sueltan archivos: una nube con la flecha
 * subiendo.
 *
 * Dice de un vistazo que ahí se puede tirar algo, antes de leer el texto. Va en
 * línea y no como archivo porque son dos trazos, y traerlo de `public/` sumaría
 * una petición por cada caja de la pantalla: lo mismo que ya se hace con el
 * ícono de WhatsApp.
 *
 * Sin relleno y con el color heredado: la caja lo apaga o lo enciende junto con
 * su texto, según esté en reposo o recibiendo un archivo.
 */
export default function IconoSoltar() {
  return (
    <svg
      className="os-icono-soltar"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* La nube, abierta abajo para que la flecha la atraviese. */}
      <path d="M7.5 18.5a4 4 0 0 1-.4-7.98 5.5 5.5 0 0 1 10.6-1.2 3.75 3.75 0 0 1 .8 7.4" />
      {/* Lo que sube. */}
      <path d="M12 20.5v-9" />
      <path d="M9 14.5 12 11.5l3 3" />
    </svg>
  );
}
