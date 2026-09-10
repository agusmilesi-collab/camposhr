import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../../../Shell';
import { entrevistaDe } from '@/lib/entrevista';
import { quienSoy } from '@/lib/identidad';
import { select } from '@/lib/supabase';
import Capturador, { type YaEnLaFicha } from './Capturador';
import { CARGADAS } from '@/lib/rorschach-laminas';
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
export default async function CodificarRorschach({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { lamina?: string };
}) {
  const yo = await quienSoy();
  const e = await entrevistaDe(params.id);
  if (!e) notFound();

  // La lámina viene en la dirección para que recargar la mantenga, pero
  // cambiarla no vuelve al servidor: la pantalla la lleva como estado. Una que
  // no está cargada no tiene mapa que mostrar.
  const lamina = CARGADAS.includes(searchParams.lamina ?? '')
    ? (searchParams.lamina as string)
    : 'I';

  // El número de respuesta es correlativo de todo el protocolo, no de la
  // lámina, así que hay que mirar lo que ya está cargado antes de numerar. Sin
  // esto, capturar sobre una evaluación que ya tenía respuestas escribía otra
  // con el mismo número.
  // Se traen enteras y de todas las láminas: la pantalla las muestra arriba de
  // lo que se está capturando, así se ve lo que ya está sin abrir la ficha, y
  // cambiar de lámina no vuelve a preguntar.
  const yaEstan = await select<YaEnLaFicha>(
    'rorschach_respuestas',
    `select=n_respuesta,lamina,localizacion,n_localizacion,fq,contenidos,popular,z` +
      `&evaluacion_id=eq.${params.id}&order=n_respuesta`
  );
  const desde = Math.max(0, ...yaEstan.map((r) => r.n_respuesta ?? 0)) + 1;

  const cuentas = await cuentasDeLaBarra();

  return (
    <Shell titulo={`Rorschach · ${e.nombre}`} identidad={yo.nombre} cuentas={cuentas}>
      <Link className="os-volver-enlace" href={`/os/psicotecnicos/entrevista/${params.id}`}>
        ← Volver a la entrevista
      </Link>

      {/* El título nombra la lámina, así que lo dibuja el capturador: cambiar
          de lámina no vuelve al servidor. */}
      <Capturador
        evaluacionId={params.id}
        nombre={e.nombre}
        lamina={lamina}
        desde={desde}
        yaEstan={yaEstan}
      />
    </Shell>
  );
}
