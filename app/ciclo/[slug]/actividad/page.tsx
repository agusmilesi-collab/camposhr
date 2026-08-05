import { notFound } from 'next/navigation';
import { getEmpresaPorSlug } from '@/lib/supabase';
import {
  getActividadAbierta,
  getActividadPorClave,
  listarAportes,
  resumir,
  type Actividad,
  type Resumen,
} from '@/lib/ciclo';
import AutoRefresco from '@/app/cuestionario/[slug]/matriz/AutoRefresco';

/**
 * Lo que se proyecta.
 *
 * Se embebe dentro de la placa del deck con el mismo mecanismo que ya usa la
 * matriz del equipo en la charla 3: un marco que se carga al llegar a esa placa
 * y se refresca solo.
 *
 *   ?placa=1        fondo transparente, para verse dentro de la diapositiva
 *   ?clave=c5-match  fija una actividad; sin esto, muestra la que esté abierta
 *
 * La pantalla abre la conversación, no la cierra: por eso se muestra el dato y
 * nunca una conclusión.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Actividad — Campos HR',
  robots: { index: false, follow: false },
};

export default async function Proyeccion({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { placa?: string; clave?: string };
}) {
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  const enPlaca = searchParams?.placa === '1';
  const actividad = searchParams?.clave
    ? await getActividadPorClave(empresa.id, searchParams.clave)
    : await getActividadAbierta(empresa.id);

  if (!actividad) {
    return (
      <main className={enPlaca ? 'cp cp-placa' : 'cp'}>
        {enPlaca && <FondoTransparente />}
        <p className="cp-vacio">Se arma sola cuando el grupo responde.</p>
        <AutoRefresco segundos={5} oculto />
      </main>
    );
  }

  const aportes = await listarAportes(actividad.id);
  const resumen = resumir(actividad, aportes);

  return (
    <main className={enPlaca ? 'cp cp-placa' : 'cp'}>
      {enPlaca && <FondoTransparente />}
      {!enPlaca && <h1 className="cp-titulo">{actividad.titulo}</h1>}

      <Vista actividad={actividad} resumen={resumen} />

      <p className="cp-pie">
        {resumen.total === 0
          ? 'Se arma sola a medida que responden.'
          : `${resumen.total} ${resumen.total === 1 ? 'respuesta' : 'respuestas'}`}
      </p>

      <AutoRefresco segundos={5} oculto />
    </main>
  );
}

/** El fondo de la placa se ve a través del marco. */
function FondoTransparente() {
  return (
    <style dangerouslySetInnerHTML={{ __html: 'body{background:transparent}' }} />
  );
}

function Vista({ actividad, resumen }: { actividad: Actividad; resumen: Resumen }) {
  switch (resumen.tipo) {
    case 'palabra': {
      // El tamaño sale de la raíz cuadrada y no de la proporción directa: con
      // proporción directa, una palabra repetida cinco veces tapa la pantalla y
      // las demás quedan ilegibles.
      const tope = Math.max(1, ...resumen.nube.map((n) => n.veces));
      return (
        <div className="cp-nube">
          {resumen.nube.map((n) => (
            <span
              key={n.texto}
              className="cp-palabra"
              style={{ fontSize: `${1 + Math.sqrt(n.veces / tope) * 2.4}rem` }}
            >
              {n.texto}
              {n.veces > 1 && <sup className="cp-veces">{n.veces}</sup>}
            </span>
          ))}
        </div>
      );
    }

    case 'opcion':
    case 'marcas': {
      const tope = Math.max(1, ...resumen.conteo.map((c) => c.veces));
      return (
        <div className="cp-barras">
          {resumen.conteo.map((c) => (
            <div className="cp-barra" key={c.texto}>
              <div className="cp-barra-fila">
                <span className="cp-barra-texto">{c.texto}</span>
                <span className="cp-barra-valor">{c.veces}</span>
              </div>
              <div className="cp-barra-riel">
                <span style={{ width: `${(c.veces / tope) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'escala': {
      const tope = Math.max(1, ...resumen.distribucion.map((d) => d.veces));
      return (
        <div className="cp-escala">
          <p className="cp-promedio">
            <strong>{resumen.promedio.toFixed(1)}</strong>
            <span>promedio</span>
          </p>
          <div className="cp-columnas">
            {resumen.distribucion.map((d) => (
              <div className="cp-columna" key={d.valor}>
                <span
                  className="cp-columna-barra"
                  style={{ height: `${(d.veces / tope) * 100}%` }}
                />
                <span className="cp-columna-num">{d.valor}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'texto':
      return (
        <div className="cp-textos">
          {resumen.textos.map((t, i) => (
            <p className="cp-texto" key={i}>
              {t}
            </p>
          ))}
          {resumen.textos.length === 0 && (
            <p className="cp-vacio">Todavía no escribió nadie.</p>
          )}
        </div>
      );
  }

  // Tipo desconocido: no debería llegar acá, pero la proyección no se cae.
  return <p className="cp-vacio">{actividad.titulo}</p>;
}
