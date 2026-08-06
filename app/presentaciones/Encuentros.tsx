import Alta from './Alta';

/**
 * Los encuentros en curso, al pie de Presentaciones.
 *
 * Una fila por cliente y la explicación una sola vez. Antes cada cliente traía
 * su propio bloque con las explicaciones repetidas: con dos clientes ya costaba
 * encontrar el botón, y lo que cambia entre uno y otro es el nombre.
 *
 * La proyección no tiene enlace acá: se ve dentro de la placa de cada
 * actividad, que es donde hace falta.
 *
 * Está acá y no en una pantalla aparte porque el día del encuentro se entra a
 * Presentaciones. Acordarse de otra dirección, con una clave adentro, es lo que
 * falla cuando hay treinta personas esperando.
 */

const BASE_PUBLICA = 'https://camposhr.com';

export type EnCurso = {
  slug: string;
  empresa: string;
  registrados: number;
  clave: string;
  abierta: boolean;
};

const QUE_HACE = [
  {
    nombre: 'Control',
    donde: 'En tu teléfono',
    ayuda:
      'Abrís la actividad cuando llega el momento y la cerrás cuando termina. ' +
      'Es lo único que se toca durante la charla: mientras hay algo abierto ves ' +
      'cuántos respondieron, y cerrar es la señal de que guarden el teléfono. ' +
      'El enlace lleva la clave adentro, así que no va al grupo.',
  },
  {
    nombre: 'Código',
    donde: 'Para proyectar',
    ayuda:
      'El mismo código que está en la primera placa. Se proyecta para el que ' +
      'llegó tarde o cerró la página, sin volver atrás en la presentación.',
  },
];

export default function Encuentros({
  enCurso,
  ciclos,
}: {
  enCurso: EnCurso[];
  ciclos: { id: string; nombre: string }[];
}) {
  return (
    <section className="enc">
      <div className="enc-cabeza">
        <div>
          <h3>Durante el encuentro</h3>
          <p>
            Las actividades que el grupo responde desde el teléfono. Lo que
            responden se proyecta dentro de la placa de cada actividad, sin
            abrir nada aparte. Las charlas son las mismas para todos los
            clientes: lo único que cambia es de dónde salen las respuestas.
          </p>
        </div>
      </div>

      {enCurso.length === 0 ? (
        <p className="enc-vacio">Todavía no hay ningún encuentro en curso.</p>
      ) : (
        <div className="enc-lista">
          {enCurso.map((e) => (
            <div className="enc-fila" key={e.slug}>
              <div className="enc-fila-quien">
                <b>{e.empresa}</b>
                <em>
                  {BASE_PUBLICA.replace(/^https:\/\//, '')}/ciclo/{e.slug}
                </em>
              </div>

              <span className="enc-fila-dato">
                {e.registrados} {e.registrados === 1 ? 'persona' : 'personas'}
              </span>

              <span className={`enc-fila-estado ${e.abierta ? 'abierta' : ''}`}>
                {e.abierta ? 'Actividad abierta' : 'En reposo'}
              </span>

              <a
                className="copiar"
                href={`${BASE_PUBLICA}/ciclo/${e.slug}/control?k=${encodeURIComponent(e.clave)}`}
                target="_blank"
                rel="noreferrer"
              >
                Control
              </a>
              <a
                className="copiar"
                href={`/ciclo/${e.slug}/qr`}
                target="_blank"
                rel="noreferrer"
              >
                Código
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="enc-guia">
        {QUE_HACE.map((q) => (
          <div className="enc-guia-item" key={q.nombre}>
            <b>{q.nombre}</b>
            <span className="enc-donde">{q.donde}</span>
            <p>{q.ayuda}</p>
          </div>
        ))}
      </div>

      <Alta ciclos={ciclos} />
    </section>
  );
}
