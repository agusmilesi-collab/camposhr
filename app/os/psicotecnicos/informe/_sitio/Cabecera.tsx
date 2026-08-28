import type { Informe } from '@/lib/informe';

/**
 * Quién es, para qué puesto y quién lo pidió.
 *
 * Abre el informe en las dos pantallas: en el portal, arriba de todo; en la
 * ficha, arriba de las secciones. La evaluadora tiene que ver lo mismo que ve
 * el cliente, y estos cinco datos son los que fechan el informe y lo atan a una
 * búsqueda.
 */
export default function Cabecera({ inf }: { inf: Informe }) {
  return (
    <header className="sitio-cabecera">
      <p className="sitio-marca">
        <span>Campos HR</span> Evaluaciones psicotécnicas
      </p>
      <h1>{inf.nombre}</h1>
      <div className="sitio-datos">
        {inf.puesto && (
          <p>
            <span>Rol aspirado</span>
            {inf.puesto}
          </p>
        )}
        {inf.empresa && (
          <p>
            <span>Empresa</span>
            {inf.empresa}
          </p>
        )}
        {inf.solicitante && (
          <p>
            <span>Solicitado por</span>
            {inf.solicitante}
          </p>
        )}
        {inf.edad !== null && (
          <p>
            <span>Edad</span>
            {inf.edad} {inf.edad === 1 ? 'año' : 'años'}
          </p>
        )}
        <p>
          <span>Evaluación</span>
          {inf.cuando}
        </p>
      </div>
    </header>
  );
}
