import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { NORMAS_VERSION } from '@/lib/centro-acceso';
import Barra from '../Barra';
import { NORMAS, NORMAS_FECHA } from './contenido';

export const dynamic = 'force-dynamic';

/**
 * Las normas de convivencia, completas.
 *
 * Se leen con o sin sesión: se aceptan en la pantalla de elegir la contraseña,
 * antes de entrar, y esa pantalla enlaza acá. Con sesión aparece la barra;
 * sin sesión, el texto solo.
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
        <article className="centro-hoja">
          <header className="centro-hoja-membrete">
            <div className="centro-hoja-marca">Centro Integral Santiago</div>
            <div className="centro-hoja-direccion">Santiago 1269, Rosario</div>
          </header>
          <h1 className="centro-hoja-titulo">Compromiso y normas de convivencia</h1>
          <p className="centro-hoja-version">
            Última actualización: {NORMAS_FECHA} · versión {NORMAS_VERSION}
          </p>

          {/* Numeración decimal, como en un reglamento: el bloque es el
              artículo (1, 2, 3) y cada norma lleva su número adentro (1.1,
              1.2). Así un punto se cita solo: "la 3.4". */}
          {NORMAS.map((b, k) => (
            <section key={b.id} id={b.id} className="centro-hoja-articulo">
              <header className="centro-hoja-articulo-top">
                <span className="centro-hoja-numero">{k + 1}</span>
                <h2>{b.titulo}</h2>
              </header>
              <ol className="centro-normas-lista">
                {b.items.map((t, i) => (
                  <li key={i} id={`${k + 1}.${i + 1}`}>
                    <span className="centro-normas-numero">
                      {k + 1}.{i + 1}
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <p className="centro-hoja-cierre">
            Al elegir tu contraseña en el sistema dejás constancia de que leíste estos puntos y te
            comprometés a respetarlos. Queda registrado con la versión y la fecha, en lugar de la
            firma en papel.
          </p>
        </article>
      </main>
    </>
  );
}
