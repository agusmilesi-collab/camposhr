/**
 * El tablero del encuentro: todo lo que se abre el día que se dicta.
 *
 * Vive acá y no en una pantalla aparte porque el día del encuentro se entra a
 * Presentaciones. Tener que acordarse de otra dirección, con una clave adentro,
 * es exactamente lo que falla cuando hay treinta personas esperando.
 *
 * Cada botón lleva al lado qué hace y en qué pantalla conviene abrirlo. La
 * expositora lo lee una vez, no lo tiene que memorizar.
 */

const BASE_PUBLICA = 'https://camposhr.com';

export type Herramienta = {
  nombre: string;
  url: string;
  ayuda: string;
  /** Dónde conviene abrirlo: el teléfono de la expositora o la proyección. */
  donde: string;
  /** El enlace lleva la clave del control: no se comparte con el grupo. */
  reservado?: boolean;
};

export default function PanelEncuentro({
  empresa,
  slug,
  registrados,
  clave,
}: {
  empresa: string;
  slug: string;
  registrados: number;
  clave: string | null;
}) {
  const herramientas: Herramienta[] = [
    {
      nombre: 'Control del encuentro',
      url: clave
        ? `${BASE_PUBLICA}/ciclo/${slug}/control?k=${encodeURIComponent(clave)}`
        : `${BASE_PUBLICA}/ciclo/${slug}/control`,
      donde: 'En tu teléfono',
      ayuda:
        'Abrís la actividad cuando llega el momento y la cerrás cuando termina. ' +
        'Es lo único que se toca durante la charla. Mientras hay algo abierto ves ' +
        'cuántos respondieron, y cerrar es la señal de que guarden el teléfono.',
      reservado: true,
    },
    {
      nombre: 'Proyección',
      url: `${BASE_PUBLICA}/ciclo/${slug}/actividad`,
      donde: 'En la pantalla de la sala',
      ayuda:
        'Lo que respondió el grupo, actualizándose solo. Ya viene embebido en la ' +
        'placa de cada actividad, así que abrirlo suelto sirve para probarlo antes ' +
        'o para una segunda pantalla.',
    },
    {
      nombre: 'Código de entrada',
      url: `/ciclo/${slug}/qr`,
      donde: 'Para proyectar',
      ayuda:
        'El mismo código que está en la primera placa. Se proyecta para el que ' +
        'llegó tarde o cerró la página, sin volver atrás en la presentación.',
    },
  ];

  return (
    <section className="enc">
      <div className="enc-cabeza">
        <div>
          {/* Con varios clientes corriendo el mismo ciclo, los tableros van uno
              abajo del otro: el nombre tiene que estar en el título. */}
          <h3>
            Durante el encuentro <span className="enc-cliente">{empresa}</span>
          </h3>
          <p>
            Las actividades que el grupo responde desde el teléfono. El deck no
            necesita conexión: esto va aparte.
          </p>
        </div>
        <span className="enc-conteo">
          <b>{registrados}</b>
          {registrados === 1 ? 'persona registrada' : 'personas registradas'}
        </span>
      </div>

      <div className="enc-lista">
        {herramientas.map((h) => (
          <div className="enc-item" key={h.nombre}>
            <a
              className="btn enc-btn"
              href={h.url}
              target="_blank"
              rel="noreferrer"
            >
              {h.nombre}
            </a>
            <div className="enc-texto">
              <span className="enc-donde">{h.donde}</span>
              <p>{h.ayuda}</p>
              {h.reservado && (
                <p className="enc-aviso">
                  Este enlace lleva la clave adentro. No va al grupo: con ella se
                  abren y cierran las actividades.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!clave && (
        <p className="enc-aviso enc-aviso-suelto">
          Falta definir CICLO_CONTROL_CLAVE en el entorno. Sin esa variable el
          control queda abierto para cualquiera que sepa la dirección, y los
          asistentes la conocen porque la escanearon para entrar.
        </p>
      )}

      <p className="enc-pie">
        En {empresa} el asistente entra a{' '}
        <code>
          {BASE_PUBLICA.replace(/^https:\/\//, '')}/ciclo/{slug}
        </code>{' '}
        y ve la actividad que esté abierta. Nada más: sin menú y sin lista, para
        que nadie se adelante.
      </p>
    </section>
  );
}
