import Link from 'next/link';
import { notFound } from 'next/navigation';
import { charlasDelCiclo, formatoFecha } from '@/lib/presentaciones';
import { encuentrosEnCurso } from '@/lib/presentaciones-encuentros';
import Encuentros from '../Encuentros';
import TablaCharlas from '../TablaCharlas';

export const dynamic = 'force-dynamic';

/**
 * Las charlas de un ciclo, con sus clientes en curso.
 *
 * El índice lista el ciclo como una sola cosa, que es como se dicta, y acá
 * adentro están sus charlas en el orden en que se dan. Abajo, los clientes que
 * lo están recorriendo: el día del encuentro se abren y se cierran las
 * actividades desde esta misma pantalla.
 */
export default async function Ciclo({ params }: { params: { ciclo: string } }) {
  const datos = charlasDelCiclo(params.ciclo);
  if (!datos) notFound();

  const { porMaterial, ciclosBase } = await encuentrosEnCurso();
  const enCurso = porMaterial.get(datos.ciclo) ?? [];

  return (
    <main className="wrap wrap-ancho">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Ciclo de encuentros</div>
          <Link href="/presentaciones" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Presentaciones
          </Link>
        </div>
        <h1>{datos.ciclo}</h1>
      </section>

      <section className="presentaciones">
        <TablaCharlas
          clientes={enCurso.map((e) => ({ slug: e.slug, empresa: e.empresa }))}
          charlas={datos.charlas.map((p) => ({
            token: p.token,
            archivo: p.archivo,
            titulo: p.titulo,
            subtitulo: p.subtitulo,
            orden: p.orden,
            placas: p.placas,
            fechaTexto: formatoFecha(p.fecha),
            cliente: p.cliente,
          }))}
        />

        {enCurso.length > 0 && <Encuentros enCurso={enCurso} ciclos={ciclosBase} />}
      </section>
    </main>
  );
}
