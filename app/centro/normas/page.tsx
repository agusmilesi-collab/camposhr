import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import Barra from '../Barra';
import HojaNormas from './Hoja';
import Aceptar from './Aceptar';
import { NORMAS_VERSION } from '@/lib/centro-acceso';

export const dynamic = 'force-dynamic';

/**
 * Las normas de convivencia, completas.
 *
 * Se leen con o sin sesión: se aceptan en la pantalla de elegir la contraseña,
 * que las trae debajo del formulario. Con sesión aparece la barra; sin
 * sesión, la hoja sola.
 */
export default async function Normas() {
  const yo = await inquilinoDeLaSesion();

  return (
    <>
      {yo && <Barra nombre={yo.nombre} donde="/centro/normas" />}
      {/* Una hoja de papel, como el informe de los psicotécnicos: el documento
          que antes se firmaba, leído en pantalla. Sin tarjetas: un reglamento
          es una sola pieza, con sus artículos numerados. */}
      <main
        className="centro-cuerpo centro-cuerpo-hoja"
        style={yo ? undefined : { gridColumn: '1 / -1', margin: '0 auto' }}
      >
        {/* Con sesión y sin la versión vigente aceptada, el botón va al pie
            de la hoja: hay que haber llegado al final para apretarlo. */}
        <HojaNormas
          pie={
            yo && yo.normas_version !== NORMAS_VERSION ? (
              <Aceptar actualizadas={yo.normas_aceptadas_at !== null} />
            ) : undefined
          }
        />
      </main>
    </>
  );
}
