import Link from 'next/link';
import { entrevistaDe, type EstadoRaven, type Entrevista } from '@/lib/entrevista';
import { diaDeLaSemana, fechaHora } from '@/lib/hora';
import { duracion } from '@/lib/raven';
import LinkRaven from '../../LinkRaven';
import Tomada from './Tomada';
import { TEST as TEST_DISCURSIVO } from '@/lib/discursivo';
import { TEST_COMPETENCIAS } from '@/lib/entrevista-competencias';
import Enlace from './Enlace';
import Grafico from './Grafico';
import Papel from './Papel';
import LinkLaminas from './LinkLaminas';
import HojaBender from './HojaBender';
import RelojRaven from './RelojRaven';
import SondeoRaven from './SondeoRaven';
import Bateria from '../../Bateria';
import Whatsapp from '../../Whatsapp';
import Orden from './Orden';
import Competencias from './Competencias';

/**
 * La hoja de la entrevista: con qué se le toma cada test.
 *
 * Es la pantalla que se abre con la persona enfrente. Lo que hace falta acá es
 * la herramienta de cada test a un clic, porque buscarlas mientras alguien
 * espera del otro lado es el momento más caro para buscar nada. Lo que la
 * persona produjo se lee después en la ficha, que es donde se codifica.
 *
 * Lo que sí se escribe acá es lo que solo existe en el momento: las
 * observaciones de los tests de papel y la entrevista por competencias, que no
 * deja más rastro que su redacción.
 *
 * Qué tests aparecen lo dice la batería que se le vendió al cliente. El
 * Benziger se suma aparte cuando el pedido lo incluye: es opcional en las tres
 * baterías, así que no está en la lista de ninguna.
 *
 * Cada test dice cómo se administra, y son cuatro formas distintas: las manchas
 * se comparten en pantalla, el Raven se manda por enlace y lo hace la persona
 * sola, el Bender y el gráfico son lápiz y papel, y la entrevista por
 * competencias se toma hablando y se escribe. Lo que se carga acá es lo que
 * después no deja rastro en ningún otro lado.
 */

/** Con qué se toma cada test, por su nombre en la batería. */
const HERRAMIENTA: Record<string, { href: string; boton: string }> = {
  Rorschach: { href: '/os/laminas/rorschach', boton: 'Abrir las láminas' },
  Zulliger: { href: '/os/laminas/zulliger', boton: 'Abrir las láminas' },
};

const RAVEN: Record<EstadoRaven, { texto: string; detalle: string; color: string }> = {
  'sin enlace': {
    texto: 'Sin mandar',
    detalle: 'Todavía no se le generó el enlace.',
    color: 'os-gris',
  },
  'sin abrir': {
    texto: 'Sin abrir',
    detalle: 'Ya se le mandó el enlace y todavía no lo abrió.',
    color: 'os-ambar',
  },
  empezado: { texto: 'En curso', detalle: 'Lo está respondiendo.', color: 'os-ambar' },
  terminado: { texto: 'Terminado', detalle: 'Lo terminó y el puntaje está en la ficha.', color: 'os-verde' },
};

/**
 * Un test de la batería, con el número que le toca en la entrevista.
 *
 * El número reemplaza al ícono: seis dibujitos distintos decoraban la lista
 * pero no decían nada que el nombre del test no dijera, y lo que hace falta
 * mientras se toma es saber por dónde se va. El orden es el de la batería, que
 * es el orden en que se administra.
 */
/**
 * La hoja entera de la entrevista.
 *
 * Vive en la segunda pestaña de la ficha y en ningún otro lado: era una
 * pantalla aparte, y tener las dos dejaba dos lugares donde hacer el mismo
 * trabajo, con lo cargado en una sin aparecer en la otra hasta recargar.
 */
export default async function HojaDeEntrevista({ id }: { id: string }) {
  const e: Entrevista | null = await entrevistaDe(id);
  if (!e) return null;

  const cuando = e.cuando ? `${diaDeLaSemana(e.cuando)} ${fechaHora(e.cuando)}` : null;
  const raven = RAVEN[e.raven];
  // El Benziger no lo declara la batería: lo agrega el pedido.
  const tests = [...e.tests, ...(e.conBenziger ? ['Benziger'] : [])];

  /**
   * Con qué se toma cada test.
   *
   * Devuelve solo el contenido: el marco de la tarjeta, con su número y su
   * agarre, lo dibuja `Orden`, que es quien sabe en qué posición quedó.
   */
  const contenidoDe = (t: string): React.ReactNode => {
        const h = HERRAMIENTA[t];
        if (h) {
          return (
            <>
              {/* Sin campo de observaciones: lo que se ve en las manchas entra
                  en la codificación, que es donde después se lee. */}
              <Papel
                id={e.id}
                campoMarca="proyectivoAdministrado"
                administrado={e.proyectivoAdministrado}
              >
                <a
                  className="os-boton os-boton-firme"
                  href={h.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {h.boton}
                </a>
                <LinkLaminas href={h.href} />
                {/* Las tres cosas que se hacen con las manchas, en la misma
                    fila: abrirlas, pasar la dirección y codificar. Codificar
                    colgaba de un renglón propio y era un botón solo ocupando
                    una fila entera. Solo Rorschach por ahora; el Zulliger usa
                    la misma pantalla cuando tenga su tabla. */}
                {t === 'Rorschach' && (
                  <a
                    className="os-boton os-herramienta-codificar"
                    href={`/os/psicotecnicos/entrevista/${e.id}/rorschach`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Codificar lámina I
                  </a>
                )}
              </Papel>
            </>
          );
        }

        if (t === 'Raven') {
          return (
            <>
              {/* Mientras la persona responde, la pantalla se entera sola de
                  que abrió el test y de que lo terminó. */}
              <SondeoRaven id={e.id} estado={e.raven} />
              <div className="os-herramienta-accion">
                <span className={`os-sello-estado ${raven.color}`} title={raven.detalle}>
                  {raven.texto}
                </span>
                {/* El orden de las columnas es el mismo en todos los tests:
                    estado, lo que se mira, y la acción. Acá lo que se mira es
                    cuánto le queda, que es el dato que se consulta mientras
                    está respondiendo. */}
                {e.raven === 'sin abrir' || e.raven === 'empezado' ? (
                  <RelojRaven iniciado={e.ravenIniciado} />
                ) : e.ravenDuracion !== null ? (
                  <span className="os-raven-reloj" title="Lo que tardó en responderlo">
                    Tardó {duracion(e.ravenDuracion)}
                  </span>
                ) : (
                  <span />
                )}
                <LinkRaven evaluacionId={e.id} />
              </div>
            </>
          );
        }

        if (t === 'Bender') {
          return (
            <>
              <Papel
                id={e.id}
                campoMarca="benderAdministrado"
                campoNotas="benderObservaciones"
                administrado={e.benderAdministrado}
                observaciones={e.benderObservaciones}
                debajo={<HojaBender id={e.id} hoja={e.benderHoja} />}
              >
                <a
                  className="os-boton os-boton-firme"
                  href="/os/laminas/bender"
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir las láminas
                </a>
                <LinkLaminas href="/os/laminas/bender" />
              </Papel>
            </>
          );
        }

        if (t === 'Gráfico 2 personas') {
          return (
            <>
              <Papel
                id={e.id}
                campoMarca="graficoAdministrado"
                campoNotas="graficoObservaciones"
                administrado={e.graficoAdministrado}
                observaciones={e.graficoObservaciones}
                debajo={<Grafico id={e.id} nombre={e.graficoNombre} />}
              />
            </>
          );
        }

        if (t === 'Benziger') {
          return (
            <>
              {/* Se responde en la plataforma de la licencia y el informe se
                  carga después, en la ficha; acá queda la marca de si ya se le
                  tomó, que es lo que la entrevista tiene que saber. */}
              <Papel
                id={e.id}
                campoMarca="benzigerAdministrado"
                administrado={e.benzigerAdministrado}
              >
                <Link className="os-boton" href={`/os/psicotecnicos/ficha/${e.id}?ver=benziger`}>
                  Cargar el informe
                </Link>
              </Papel>
            </>
          );
        }

        if (t === TEST_COMPETENCIAS) {
          // Se toma hablando y no deja más rastro que lo que se escribe, así
          // que el campo es el test: va acá y no en la ficha, que se abre
          // después con la entrevista terminada.
          return <Competencias id={e.id} texto={e.competencias} />;
        }

        if (t === TEST_DISCURSIVO) {
          return (
            <>
              {/* Se toma hablando, sobre unos cinco minutos de discurso, así
                  que acá no hay lámina ni enlace que abrir: lo que hace falta
                  es dónde dejar en qué nivel quedó, que se carga en la ficha. */}
              <div className="os-herramienta-accion">
                <span className={`os-sello-estado ${e.discursivo ? 'os-verde' : 'os-gris'}`}>
                  {e.discursivo ?? 'sin ubicar'}
                </span>
                <span />
                <Link className="os-boton" href={`/os/psicotecnicos/ficha/${e.id}?ver=tests`}>
                  Ubicar en la pirámide
                </Link>
              </div>
            </>
          );
        }

        return null;
  };

  return (
    <>
      <section className="os-panel os-entrevista-datos">
        <div>
          <span className="os-dato-rotulo">Cuándo</span>
          <span className="os-dato-valor">{cuando ?? 'Sin fecha'}</span>
        </div>
        <div>
          <span className="os-dato-rotulo">Modalidad</span>
          <span className="os-dato-valor">{e.modalidad ?? 'Sin definir'}</span>
        </div>
        {/* La videollamada solo aparece si la entrevista es online. Y si quedó
            un enlace cargado de cuando lo era, se sigue mostrando: esconder un
            dato que alguien puso es la forma de perderlo. */}
        {(e.modalidad === 'Online' || e.enlace) && (
          <div className="os-entrevista-videollamada">
            <span className="os-dato-rotulo">Videollamada</span>
            <Enlace id={e.id} enlace={e.enlace} />
          </div>
        )}
        <div>
          <span className="os-dato-rotulo">Batería</span>
          <span className="os-dato-valor">
            <Bateria codigo={e.bateria} conBenziger={e.conBenziger} />
          </span>
        </div>
        <div>
          <span className="os-dato-rotulo">Teléfono</span>
          <span className="os-dato-valor">
            {e.telefono ? <Whatsapp telefono={e.telefono} /> : 'Sin teléfono'}
          </span>
        </div>
        <div className="os-entrevista-correo">
          <span className="os-dato-rotulo">Correo</span>
          <span className="os-dato-valor">
            {e.email ? <a href={`mailto:${e.email}`}>{e.email}</a> : 'Sin correo'}
          </span>
        </div>
      </section>

      <h2 className="os-subtitulo">Lo que se le toma</h2>

      {tests.length === 0 && (
        <section className="os-panel">
          <p className="os-vacio">
            El pedido no tiene batería cargada, así que no se sabe qué tests le
            corresponden. Se elige en la ficha del pedido.
          </p>
        </section>
      )}

      <Orden id={e.id} tests={tests} tarjetas={tests.map(contenidoDe)} />


      <section className="os-panel os-entrevista-cierre">
        {/* Dónde está parada, para el caso de haber avanzado ya: desde acá el
            botón de cerrarla no existe, y sin decirlo la pantalla parece rota. */}
        <p>
          {e.estado === 'Por entrevistar'
            ? 'Al quedar tomado el último test, la evaluación pasa sola a Por analizar. El botón la cierra antes.'
            : `Esta evaluación ya está en ${e.estado}. Su etapa se corrige en la ficha.`}
        </p>
        <div className="os-entrevista-botones">
          {e.estado === 'Por entrevistar' && <Tomada id={e.id} />}
        </div>
      </section>
    </>
  );
}
