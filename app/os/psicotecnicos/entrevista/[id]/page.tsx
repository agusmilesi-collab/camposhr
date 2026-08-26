import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../../Shell';
import { entrevistaDe } from '@/lib/entrevista';
import { quienSoy } from '@/lib/identidad';
import Hoja from './Hoja';

export const dynamic = 'force-dynamic';

/**
 * La hoja de la entrevista, en pantalla propia.
 *
 * Es la que se abre desde la lista de entrevistas, para tomarla con la persona
 * enfrente y sin nada alrededor. La misma hoja es la segunda pestaña de la
 * ficha (`?ver=entrevista`), que es donde se entra cuando ya se está trabajando
 * sobre ese candidato: el contenido lo dibuja `Hoja` en los dos lados.
 */
export default async function PantallaDeEntrevista({ params }: { params: { id: string } }) {
  const [yo, e] = await Promise.all([quienSoy(), entrevistaDe(params.id)]);
  if (!e) notFound();

  return (
    <Shell titulo={`Entrevista · ${e.nombre}`} identidad={yo.nombre}>
      <Link className="os-volver-enlace" href="/os/psicotecnicos/entrevistas">
        ← Volver a las entrevistas
      </Link>

      <div className="os-encabezado">
        <h1>{e.nombre}</h1>
        <p>
          {e.empresa ?? 'Sin empresa'} · {e.puesto ?? 'Sin puesto'}
        </p>
      </div>

      <Hoja id={params.id} suelta />
    </Shell>
  );
}
