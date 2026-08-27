import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../../../Shell';
import { entrevistaDe } from '@/lib/entrevista';
import { quienSoy } from '@/lib/identidad';
import { select } from '@/lib/supabase';
import Capturador from './Capturador';
import './capturador.css';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

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

  // El número de respuesta es correlativo de todo el protocolo, no de la
  // lámina, así que hay que mirar lo que ya está cargado antes de numerar. Sin
  // esto, capturar sobre una evaluación que ya tenía respuestas escribía otra
  // con el mismo número.
  const yaEstan = await select<{ n_respuesta: number | null; lamina: string | null }>(
    'rorschach_respuestas',
    `select=n_respuesta,lamina&evaluacion_id=eq.${params.id}`
  );
  const desde = Math.max(0, ...yaEstan.map((r) => r.n_respuesta ?? 0)) + 1;
  const repetidas = yaEstan.filter((r) => r.lamina === 'I').length;

  const cuentas = await cuentasDeLaBarra();

  return (
    <Shell titulo={`Rorschach · ${e.nombre}`} identidad={yo.nombre} cuentas={cuentas}>
      <Link className="os-volver-enlace" href={`/os/psicotecnicos/entrevista/${params.id}`}>
        ← Volver a la entrevista
      </Link>

      <div className="os-encabezado">
        <h1>Rorschach · Lámina I</h1>
        <p>
          {e.nombre} · se codifica en la encuesta, cuando ella dice dónde vio cada cosa
        </p>
      </div>

      <Capturador
        evaluacionId={params.id}
        nombre={e.nombre}
        desde={desde}
        repetidas={repetidas}
      />
    </Shell>
  );
}
