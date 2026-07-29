import { INFO, type Perfil } from '@/lib/perfiles';

/**
 * Matriz explicativa de la portada: los cuatro cuadrantes con su descripción.
 * A diferencia de MatrizBenziger (SVG, ubica personas), esta es HTML para que
 * el texto fluya y se lea bien en cualquier pantalla. No lleva personas.
 */

const ORDEN: Perfil[] = ['FI', 'FD', 'BI', 'BD'];

export default function MatrizPortada() {
  return (
    <div className="mp">
      <div className="mp-eje">
        <strong>Macro</strong>
        <span>Mundo de las ideas</span>
      </div>

      <div className="mp-grilla">
        {ORDEN.map((p) => (
          <div className="mp-celda" key={p}>
            <h3>{INFO[p].nombre}</h3>
            <p>{INFO[p].descripcion}</p>
          </div>
        ))}
      </div>

      <div className="mp-eje">
        <strong>Micro</strong>
        <span>Mundo del detalle</span>
      </div>
    </div>
  );
}
