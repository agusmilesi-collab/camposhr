import { IgualarTarjetas } from './IgualarTarjetas';
import { Equipo, IconoWhatsapp, pesos } from './piezas';
import type { Servicio as Datos, Tarjeta } from './servicios';

/** Lo que se ve con la tarjeta cerrada: código, precio, título y bajada. */
function Cabeza({ t }: { t: Tarjeta }) {
  return (
    <>
      <p className="precios-pill-fila">
        <span className={`precios-pill precios-pill-${t.color}`}>{t.codigo}</span>
        {t.duracion ? <span className="precios-cod">{t.duracion}</span> : null}
        <span className="precios-monto">
          {pesos(t.monto)}
          <em>{t.unidad}</em>
        </span>
      </p>
      <h3 className="precios-item-titulo">{t.titulo}</h3>
      <p className="precios-cuando">{t.cuando}</p>
    </>
  );
}

/**
 * El cuerpo de las pestañas de coaching y de entrevistas, con el mismo
 * esqueleto y las mismas clases que la de psicotécnicos: tarjetas,
 * lista con letras, proceso en párrafo, condiciones y equipo.
 */
export function Servicio({ datos }: { datos: Datos }) {
  const { tarjetas } = datos;
  return (
    <>
      <section className="precios-bloque">
        <h2 className="precios-titulo precios-titulo-menor">{datos.seccion}</h2>
        <div className="precios-lista">
          <IgualarTarjetas />
          {tarjetas.map((t) => (
            <article className="precios-item" key={t.codigo}>
              {t.detalles.length === 0 && !t.agregado ? (
                // Sin detalle no hay nada que abrir: la tarjeta va sin botón.
                <div className="precios-plegada">
                  <Cabeza t={t} />
                </div>
              ) : (
                <details className="precios-desplegable">
                  <summary className="precios-plegada">
                    <Cabeza t={t} />
                    <span className="precios-ver" aria-hidden="true">
                      <span className="precios-ver-abrir">Ver detalle</span>
                      <span className="precios-ver-cerrar">Ocultar detalle</span>
                    </span>
                  </summary>

                  {t.detalles.length > 0 && (
                    <div className="precios-item-detalles">
                      {t.detalles.map((d) => (
                        <div className="precios-detalle" key={d.titulo}>
                          <span className="precios-detalle-titulo">{d.titulo}</span>
                          <ol className="precios-medidas">
                            {d.items.map((item, i) => (
                              <li key={item}>
                                <span className="precios-num">{i + 1}</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  )}

                  {t.agregado && (
                    <div
                      className={`precios-opcional${
                        t.agregado.rotulo === 'Recomendado' ? ' precios-sugerido' : ''
                      }`}
                    >
                      <span className="precios-detalle-titulo">{t.agregado.rotulo}</span>
                      <p>
                        <strong className="precios-opcional-nombre">{t.agregado.nombre}</strong>{' '}
                        {t.agregado.texto}
                      </p>
                    </div>
                  )}
                </details>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="precios-bloque">
        <h2 className="precios-titulo">{datos.lectura.titulo}</h2>
        <p className="precios-parrafo">{datos.lectura.intro}</p>
        <ul className="precios-entrega">
          {datos.lectura.items.map((x, i) => (
            <li key={x.que}>
              <span className="precios-num">{'ABCDEFG'[i]}</span>
              <span>
                <span className="precios-entrega-paso">{x.paso}</span>
                <strong>{x.que}</strong> {x.texto}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="precios-bloque">
        <h2 className="precios-titulo">{datos.pasos.titulo}</h2>
        <p className="precios-parrafo">{datos.pasos.texto}</p>
        <p className="precios-parrafo">
          Para empezar, escribinos un WhatsApp al{' '}
          <a className="precios-wa" href="https://wa.me/5493416402533">
            <IconoWhatsapp />
            +54 9 341 640 2533
          </a>
          .
        </p>
        <p className="precios-nota">{datos.condiciones}</p>
      </section>

      <Equipo titulo={datos.equipo} />
    </>
  );
}
