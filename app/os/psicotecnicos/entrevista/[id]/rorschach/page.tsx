import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../../../Shell';
import { entrevistaDe } from '@/lib/entrevista';
import { quienSoy } from '@/lib/identidad';
import Capturador from './Capturador';
import './capturador.css';

export const dynamic = 'force-dynamic';

/**
 * La pantalla con la que se codifica el Rorschach durante la encuesta.
 *
 * Va del lado de la evaluadora y no se comparte: tiene las áreas dibujadas
 * encima de la lámina, y ver dónde caen las áreas antes de responder cambiaría
 * lo que la persona ve. Lo que se le muestra a ella es `/os/laminas/rorschach`,
 * que es la lámina sola.
 */
export default async function CodificarRorschach({ params }: { params: { id: string } }) {
  const yo = await quienSoy();
  const e = await entrevistaDe(params.id);
  if (!e) notFound();

  return (
    <Shell titulo={`Rorschach · ${e.nombre}`} identidad={yo.nombre}>
      <Link className="os-volver-enlace" href={`/os/psicotecnicos/entrevista/${params.id}`}>
        ← Volver a la entrevista
      </Link>

      <div className="os-encabezado">
        <h1>Rorschach · Lámina I</h1>
        <p>
          {e.nombre} · se codifica en la encuesta, cuando ella dice dónde vio cada cosa
        </p>
      </div>

      <Capturador evaluacionId={params.id} nombre={e.nombre} />
    </Shell>
  );
}
