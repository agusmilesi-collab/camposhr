import { INFO, type Perfil } from '@/lib/perfiles';
import { EJES } from './MatrizBenziger';

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
        <strong>{EJES.arriba.titulo}</strong>
        <span>{EJES.arriba.bajada}</span>
      </div>

      <div className="mp-cuerpo">
        <div className="mp-eje mp-eje-lado">
          <strong>{EJES.izquierda.titulo}</strong>
          <span>{EJES.izquierda.bajada}</span>
        </div>

        <div className="mp-grilla">
        {ORDEN.map((p) => (
          <div className="mp-celda" key={p}>
            <h3>{INFO[p].nombre}</h3>
            <p>{INFO[p].descripcion}</p>
          </div>
          ))}
        </div>

        <div className="mp-eje mp-eje-lado mp-eje-der">
          <strong>{EJES.derecha.titulo}</strong>
          <span>{EJES.derecha.bajada}</span>
        </div>
      </div>

      <div className="mp-eje">
        <strong>{EJES.abajo.titulo}</strong>
        <span>{EJES.abajo.bajada}</span>
      </div>
    </div>
  );
}
