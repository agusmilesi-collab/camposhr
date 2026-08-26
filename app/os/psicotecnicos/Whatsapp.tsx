/**
 * El número con el ícono de WhatsApp, enlazado a la conversación.
 *
 * Los teléfonos de los candidatos se usan para escribirles por ahí y no para
 * llamarlos, así que el enlace ya iba a `wa.me`: el ícono dice a dónde lleva
 * antes de apretarlo, que es lo que un número subrayado no dice.
 *
 * El dibujo va en línea y no como archivo: es un trazo de un `path`, y traerlo
 * de `public/` sumaría una petición por cada teléfono de una lista.
 */

/** El número sin nada que no sea un dígito, que es como lo quiere `wa.me`. */
function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '');
}

export default function Whatsapp({
  telefono,
  className,
}: {
  telefono: string;
  className?: string;
}) {
  return (
    <a
      className={`os-whatsapp${className ? ` ${className}` : ''}`}
      href={`https://wa.me/${soloDigitos(telefono)}`}
      target="_blank"
      rel="noreferrer"
      title="Escribir por WhatsApp"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 5.82 2.42 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.49-.4-.42-.55-.43h-.47c-.16 0-.43.06-.65.31-.22.24-.85.83-.85 2.03s.87 2.35.99 2.51c.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.1-.22-.16-.47-.29Z"
        />
      </svg>
      <span>{telefono}</span>
    </a>
  );
}
