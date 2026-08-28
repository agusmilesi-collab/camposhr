import type { Informe } from '@/lib/informe';
import { bandaDe, bandasDe } from '@/lib/exigencia';
import { CUADRANTES } from '@/lib/informe-textos';
import {
  bandaDe as bandaDelPotencial,
  comoSeDice,
  enPalabras,
  escalonDe,
  estratoDeEscalon,
  horizonteEn,
} from '@/lib/potencial';
import Progreso from './Progreso';
import Hoja from './Hoja';

/**
 * El respaldo: los valores medidos, sin interpretar y sin colores.
 *
 * Es lo mismo en las dos presentaciones del informe, el documento que se
 * descarga y el sitio del portal, así que vive una sola vez. Son los números de
 * los que salió todo lo demás: los puntajes con los cortes que rigen ese
 * informe, el Raven, el Benziger, el potencial, la codificación del protocolo y
 * el sumario estructural entero.
 */
export default function Crudo({ inf }: { inf: Informe }) {
  return (
    <>
        <p>
          Lo que sigue son los números de esta evaluación. Cada uno está dicho con la
          escala en la que se mide y con lo que se considera esperable, así se puede
          leer sin volver a los capítulos anteriores.
        </p>

        {inf.competencias.length > 0 && (
          <>
            <h3 className="inf-subtitulo">Competencias</h3>
            <table className="inf-crudo">
              <thead>
                <tr>
                  <th>Competencia</th>
                  <th className="inf-crudo-num">Puntaje</th>
                  <th>Banda</th>
                  <th>Qué mide</th>
                </tr>
              </thead>
              <tbody>
                {inf.competencias.map((c) => (
                  <tr key={c.nombre}>
                    <td>{c.nombre}</td>
                    <td className="inf-crudo-num">
                      {c.puntaje === null ? '—' : `${c.puntaje} de 100`}
                    </td>
                    <td>{c.puntaje === null ? 'sin puntaje' : bandaDe(c.puntaje, inf.exigencia)}</td>
                    <td className="inf-crudo-mide">{c.mide}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Dónde corta cada banda en este informe. Se lee con la
                exigencia del pedido, así que el mismo 40 puede caer en dos
                bandas distintas en dos búsquedas: sin los cortes escritos, la
                columna de al lado no se puede verificar. */}
            <p className="inf-crudo-nota">
              {`Cortes de este informe: ${bandasDe(inf.exigencia)
                .slice()
                .reverse()
                .map(
                  (b) =>
                    `${b.nombre}, ${
                      b.desde === 0
                        ? `menos de ${inf.exigencia.adecuado}`
                        : `${b.desde} a ${b.hasta}`
                    }`
                )
                .join('; ')}.`}
            </p>
            {inf.protocoloCorto && (
              <p className="inf-crudo-nota">
                Las competencias sin puntaje salen del test de manchas y quedaron sin
                calcular: {inf.protocoloCorto}.
              </p>
            )}
          </>
        )}

        {inf.raven && (
          <>
            <h3 className="inf-subtitulo">Razonamiento abstracto</h3>
            <table className="inf-crudo">
              <tbody>
                <tr>
                  <th scope="row">Respuestas correctas</th>
                  <td className="inf-crudo-num">{inf.raven.raw} de 36</td>
                </tr>
                <tr>
                  <th scope="row">Resultado</th>
                  <td>{inf.raven.resultado || '—'}</td>
                </tr>
              </tbody>
            </table>
            <p className="inf-crudo-nota">
              Test de Matrices Progresivas de Raven, escala general, sin límite de
              ayuda y con tiempo tomado.
            </p>
          </>
        )}

        {inf.benziger && (inf.benziger.adulto || inf.benziger.joven) && (
          <>
            <h3 className="inf-subtitulo">Estilos de pensamiento</h3>
            <table className="inf-crudo">
              <thead>
                <tr>
                  <th>Cuadrante</th>
                  <th className="inf-crudo-num">Perfil adulto</th>
                  <th className="inf-crudo-num">Perfil adolescente</th>
                </tr>
              </thead>
              <tbody>
                {CUADRANTES.map((q) => (
                  <tr key={q.clave}>
                    <td>
                      {q.nombre}
                      {inf.benziger!.preferentes.some((pf) => pf.clave === q.clave) &&
                        ' (predominante)'}
                    </td>
                    <td className="inf-crudo-num">{inf.benziger!.adulto?.[q.clave] ?? '—'}</td>
                    <td className="inf-crudo-num">{inf.benziger!.joven?.[q.clave] ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="inf-crudo-nota">
              Valores del BTSA (Benziger Thinking Styles Assessment). El perfil
              adolescente se responde sobre menos ítems y en el gráfico se lleva a la
              escala del adulto para poder compararlos.
            </p>
          </>
        )}

        {inf.discursivo && (
          <>
            <h3 className="inf-subtitulo">Potencial</h3>
            <table className="inf-crudo">
              <tbody>
                {inf.discursivo.punto && (
                  <>
                    <tr>
                      <th scope="row">Edad en la entrevista</th>
                      <td className="inf-crudo-num">{inf.discursivo.punto.edad} años</td>
                    </tr>
                    <tr>
                      <th scope="row">Horizonte temporal</th>
                      <td className="inf-crudo-num">{enPalabras(inf.discursivo.punto.dias)}</td>
                    </tr>
                  </>
                )}
                {inf.discursivo.detalle && (
                  <>
                    <tr>
                      <th scope="row">Estrato de la persona</th>
                      <td>
                        {inf.discursivo.detalle.romano} · procesamiento{' '}
                        {inf.discursivo.detalle.procesamiento.toLowerCase()}
                      </td>
                    </tr>
                  </>
                )}
                {inf.discursivo.puesto && (
                  <>
                    <tr>
                      <th scope="row">Estrato del puesto</th>
                      <td>
                        {inf.discursivo.puesto.romano} · {inf.discursivo.puesto.nombre}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Diferencia</th>
                      <td>
                        {inf.discursivo.puesto.distancia === 0
                          ? 'ninguna: los dos estratos coinciden'
                          : `${Math.abs(inf.discursivo.puesto.distancia)} ${
                              Math.abs(inf.discursivo.puesto.distancia) === 1
                                ? 'estrato'
                                : 'estratos'
                            } ${inf.discursivo.puesto.distancia > 0 ? 'a favor de la persona' : 'a favor del puesto'}`}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

        {/* El diagrama del modelo, con esta persona marcada. Sale solo cuando están la edad y el horizonte;
            sin los dos no hay punto que dibujar. */}
        {inf.discursivo.punto && (
          <div className="inf-progreso-caja">
            <h3>Cuándo madura esa capacidad</h3>
            <p>
              El modelo ordena la capacidad de trabajo por el horizonte temporal: el
              lapso de la tarea más larga que la persona puede llevar adelante sin que
              le indiquen cómo. Ese horizonte crece con la edad y lo hace por caminos
              regulares, así que ubicarla por su edad y su horizonte de hoy muestra por
              cuál de esos caminos viene subiendo y hasta dónde llega.
            </p>
            <Progreso edad={inf.discursivo.punto.edad} dias={inf.discursivo.punto.dias} />
            <p className="inf-progreso-pie">
              {(() => {
                const { edad, dias } = inf.discursivo.punto;
                const banda = bandaDelPotencial(edad, dias);
                const hoy = estratoDeEscalon(escalonDe(dias));
                const a50 = estratoDeEscalon(horizonteEn(banda, 50));
                const a60 = estratoDeEscalon(horizonteEn(banda, 60));
                return (
                  `El punto marca ${edad} años y un horizonte temporal de ` +
                  `${enPalabras(dias)}, que cae en el estrato ${hoy.romano}. La banda ` +
                  `que lo contiene llega a ${comoSeDice(a50)} a los 50 años y a ` +
                  `${comoSeDice(a60)} a los 60.`
                );
              })()}
            </p>
            <p className="inf-progreso-pie">
              Las bandas son un redibujo del diagrama publicado por Elliott Jaques
              (1963, revisión 1990). Cerca de un límite, la banda es un criterio de
              lectura y no una medición: el diagrama ubica el ritmo de maduración
              probable, no dictamina una carrera.
            </p>
          </div>
        )}
          </>
        )}
        {inf.crudo.raven.length > 0 && (
          <>
            <h3 className="inf-subtitulo">Respuestas del Raven</h3>
            <p className="inf-crudo-nota">
              Qué opción eligió en cada una de las 36 láminas. Cuáles son las correctas
              no se publica: son las mismas 36 en todas las evaluaciones, y una clave
              que circula deja al test sin poder volver a usarse.
            </p>
            <table className="inf-crudo inf-crudo-items">
              <thead>
                <tr>
                  <th>Lámina</th>
                  <th className="inf-crudo-num">Opción</th>
                </tr>
              </thead>
              <tbody>
                {inf.crudo.raven.map((r) => (
                  <tr key={r.lamina}>
                    <td>{r.lamina}</td>
                    <td className="inf-crudo-num">{r.opcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {inf.crudo.protocolo.length > 0 && (
          <>
            <h3 className="inf-subtitulo">
              Codificación del protocolo{inf.proyectivo ? ` · ${inf.proyectivo}` : ''}
            </h3>
            <p className="inf-crudo-nota">
              Cómo quedó codificada cada respuesta. De esta tabla salen todos los
              índices del sumario. Lo que la persona dijo en cada lámina queda en el
              protocolo clínico, que no se entrega.
            </p>
            <table className="inf-crudo inf-crudo-protocolo">
              <thead>
                <tr>
                  <th>Lám.</th>
                  <th className="inf-crudo-num">N°</th>
                  <th>Loc. y DQ</th>
                  <th>Determinantes</th>
                  <th>FQ</th>
                  <th>(2)</th>
                  <th>Contenidos</th>
                  <th>P</th>
                  <th className="inf-crudo-num">Z</th>
                  <th>CC.EE.</th>
                </tr>
              </thead>
              <tbody>
                {inf.crudo.protocolo.map((r, i) => (
                  <tr key={i}>
                    <td>{r.lamina}</td>
                    <td className="inf-crudo-num">{r.n ?? '—'}</td>
                    <td>{r.localizacion || '—'}</td>
                    <td>{r.determinantes || '—'}</td>
                    <td>{r.fq || '—'}</td>
                    <td>{r.par ? '2' : ''}</td>
                    <td>{r.contenidos || '—'}</td>
                    <td>{r.popular ? 'P' : ''}</td>
                    <td className="inf-crudo-num">{r.z ?? ''}</td>
                    <td>{r.ccee || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {inf.crudo.sumario && (
          <>
            <h3 className="inf-subtitulo">Sumario estructural</h3>
            <p className="inf-crudo-nota">
              Los índices que salen de esa codificación, en el orden de la hoja de
              cálculos. Es el respaldo de lo que el informe afirma sobre este test.
            </p>
            <Hoja texto={inf.crudo.sumario} />
          </>
        )}
    </>
  );
}
