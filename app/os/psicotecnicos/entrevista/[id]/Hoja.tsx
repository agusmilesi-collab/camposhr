import Link from 'next/link';
import { entrevistaDe, type Entrevista } from '@/lib/entrevista';
import Tomada from './Tomada';
import { TEST as TEST_DISCURSIVO } from '@/lib/discursivo';
import { TEST_COMPETENCIAS } from '@/lib/entrevista-competencias';
import Enlace from './Enlace';
import Grafico from './Grafico';
import Papel from './Papel';
import LinkLaminas from './LinkLaminas';
import HojaBender from './HojaBender';
import Cuando from './Cuando';
import Marca from './Marca';
import Raven from './Raven';
import RavenPuntaje from '../../ficha/[id]/Raven';
import { SELLO_RAVEN } from '@/lib/raven-estado';
import Bateria from '../../Bateria';
import Whatsapp from '../../Whatsapp';
import { enlaceDelCv } from '@/lib/cv';
import { ajuste } from '@/lib/ajustes';
import { RANGOS, rangosValidos } from '@/lib/raven';
import Orden from './Orden';
import Competencias from './Competencias';
import Nacimiento from './Nacimiento';
import BenzigerInforme from '../../ficha/[id]/Benziger';
import Discursivo from '../../ficha/[id]/Discursivo';

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
  // El CV se firma al dibujar la hoja: es lo primero que se mira antes de
  // hablar con la persona, y buscarlo en otra pantalla es abrir otra pantalla.
  /* Los cortes del Raven salen de Configuración: la tarjeta lee el puntaje con
     los que rigen hoy, igual que el informe. */
  const [e, cv, guardados] = await Promise.all([
    entrevistaDe(id),
    enlaceDelCv(id),
    ajuste('raven_rangos'),
  ]);
  const rangos = rangosValidos(guardados) ?? RANGOS;
  if (!e) return null;

  // El Benziger no lo declara la batería: lo agrega el pedido.
  const todos = [...e.tests, ...(e.conBenziger ? ['Benziger'] : [])];

  /*
   * El análisis discursivo no tiene tarjeta propia: va adentro de la entrevista
   * por competencias.
   *
   * Es el único test que no se administra aparte: son tres preguntas que se
   * hacen hablando, en la misma conversación que la entrevista, y en su propia
   * tarjeta quedaban plegadas al final de la lista. Adentro de la entrevista,
   * que es la que arranca desplegada, están a la vista desde que se abre la
   * hoja y no hay forma de olvidarse de preguntarlas.
   */
  const conDiscursivo = todos.includes(TEST_DISCURSIVO);
  const tests = todos.filter((t) => t !== TEST_DISCURSIVO);

  /**
   * Con qué se toma cada test.
   *
   * Devuelve solo el contenido: el marco de la tarjeta, con su número y su
   * agarre, lo dibuja `Orden`, que es quien sabe en qué posición quedó.
   */
  /**
   * En qué anda cada test, para el renglón del título.
   *
   * Va ahí y no en la columna de los botones: es lo primero que se mira al
   * bajar por la lista mientras se administra, y a media pantalla del nombre
   * había que ir y volver para saber de cuál era.
   */
  const estadoDe = (t: string): React.ReactNode => {
    if (HERRAMIENTA[t]) {
      return <Marca id={e.id} campo="proyectivoAdministrado" administrado={e.proyectivoAdministrado} />;
    }
    if (t === 'Bender') {
      return <Marca id={e.id} campo="benderAdministrado" administrado={e.benderAdministrado} />;
    }
    if (t === 'Gráfico 2 personas') {
      return (
        <Marca
          id={e.id}
          campo="graficoAdministrado"
          administrado={e.graficoAdministrado}
        />
      );
    }
    if (t === 'Benziger') {
      return <Marca id={e.id} campo="benzigerAdministrado" administrado={e.benzigerAdministrado} />;
    }
    if (t === 'Raven') {
      /* El sello del Raven lo pone el servidor y se actualiza solo: el bloque
         de abajo sondea mientras la persona responde y pide la pantalla de
         nuevo cuando el estado cambia.

         Con el puntaje ya cargado el sello dice "Administrado" y no "Sin
         mandar": el Raven se puede tomar en papel, y ahí no hay enlace que
         mandar pero el test está tomado igual, que es lo que la lista plegada
         tiene que decir. */
      if (e.ravenMedida?.raw !== null && e.ravenMedida?.raw !== undefined) {
        return <span className="os-sello-estado os-test-estado os-verde">Administrado</span>;
      }
      const r = SELLO_RAVEN[e.raven];
      return (
        <span className={`os-sello-estado os-test-estado ${r.color}`} title={r.detalle}>
          {r.texto}
        </span>
      );
    }
    if (t === TEST_COMPETENCIAS) {
      /* Cuando la batería lleva el análisis discursivo, la tarjeta contiene los
         dos: se administra entera recién cuando además está contestado el
         potencial, y decir "Administrado" antes escondería lo que falta. */
      const tomado =
        Boolean(e.competencias) && (!conDiscursivo || Boolean(e.discursivo || e.relato));
      return (
        <span className={`os-sello-estado os-test-estado ${tomado ? 'os-verde' : 'os-gris'}`}>
          {tomado ? 'Administrado' : 'No administrado'}
        </span>
      );
    }
    return null;
  };

  const contenidoDe = (t: string): React.ReactNode => {
        const h = HERRAMIENTA[t];
        if (h) {
          return (
            <>
              {/* Sin campo de observaciones: lo que se ve en las manchas entra
                  en la codificación, que es donde después se lee. */}
              <Papel
                id={e.id}
              >
                {/* Numerados: son los tres pasos del test en el orden en que
                    se hacen, y el número los dice sin tener que deducirlos del
                    lugar que ocupan. */}
                <a
                  className="os-boton os-boton-firme"
                  href={h.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="os-boton-paso">1</span>
                  {h.boton}
                </a>
                <LinkLaminas href={h.href} numero={2} />
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
                    <span className="os-boton-paso">3</span>
                    Codificar
                  </a>
                )}
              </Papel>
            </>
          );
        }

        if (t === 'Raven') {
          // Todo el bloque es de cliente: mientras la persona responde, la
          // pantalla se entera sola de que abrió, corre el reloj y muestra el
          // puntaje cuando entrega, sin que haya que recargar.
          return (
            /* El puntaje con su lectura, y el reloj y el enlace en la misma
               línea: mandar el enlace y leer lo que dio son dos momentos del
               mismo test, y estaban en dos pantallas. */
            <RavenPuntaje
              id={e.id}
              raw={e.ravenMedida?.raw ?? null}
              percentil={e.ravenMedida?.percentil ?? null}
              desvios={e.ravenMedida?.desvios ?? null}
              resultado={e.ravenMedida?.resultado ?? null}
              origen={e.ravenMedida?.origen ?? null}
              tardo={e.ravenDuracion}
              sesion={e.ravenSesion}
              rangos={rangos}
              derecha={
                <Raven
                  id={e.id}
                  estado={e.raven}
                  iniciado={e.ravenIniciado}
                  duracionSegundos={e.ravenDuracion}
                  medida={e.ravenMedida}
                />
              }
            />
          );
        }

        if (t === 'Bender') {
          return (
            <>
              <Papel
                id={e.id}
                campoNotas="benderObservaciones"
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
                campoNotas="graficoObservaciones"
                observaciones={e.graficoObservaciones}
                debajo={<Grafico id={e.id} nombre={e.graficoNombre} />}
              />
            </>
          );
        }

        if (t === 'Benziger') {
          return (
            <>
              {/* Se responde en la plataforma de la licencia y el PDF se baja
                  de ahí, así que se sube acá mismo en vez de mandar a otra
                  pantalla. El cuadrante lo elige la evaluadora después,
                  leyéndolo, y para eso está la pestaña. */}
              <Papel id={e.id} />
              <BenzigerInforme
                id={e.id}
                cuadrantes={[]}
                informe={e.benzigerInforme}
                soloInforme
              />
            </>
          );
        }

        if (t === TEST_COMPETENCIAS) {
          // Se toma hablando y no deja más rastro que lo que se escribe, así
          // que el campo es el test: va acá y no en la ficha, que se abre
          // después con la entrevista terminada.
          return (
            <>
              {/* La primera pregunta, arriba del campo donde se escribe el
                  resto: la fecha de nacimiento, con la edad que sale de ella. */}
              <Nacimiento id={e.id} nacimiento={e.nacimiento} entrevista={e.cuando} />
              <Competencias id={e.id} texto={e.competencias} />

              {/* Y las tres preguntas del potencial, en la misma conversación. */}
              {conDiscursivo && (
                <div className="os-competencias-potencial">
                  <h4 className="os-competencias-titulo">Potencial de desarrollo</h4>
                  <Discursivo
                    id={e.id}
                    modo="entrevista"
                    nivel={e.discursivo}
                    edad={null}
                    edadEvaluacion={null}
                    dias={e.horizonteDias}
                    complejidad={e.complejidad}
                    relato={e.relato}
                  />
                </div>
              )}
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
          {/* Editable acá: una entrevista se reprograma, y hasta ahora eso
              obligaba a volver al tablero a buscar la tarjeta. */}
          <Cuando id={e.id} cuando={e.cuando} />
        </div>
        <div>
          <span className="os-dato-rotulo">Modalidad</span>
          <span className="os-dato-valor">{e.modalidad ?? 'Sin definir'}</span>
        </div>
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
        {/* El CV, al lado del correo: es lo primero que se lee antes de la
            entrevista, para saber con quién se va a hablar. El enlace se firma
            por cinco minutos, que es lo que tarda en abrirse. */}
        <div>
          <span className="os-dato-rotulo">CV</span>
          <span className="os-dato-valor">
            {cv ? (
              <a href={cv} target="_blank" rel="noreferrer">
                Abrir el CV
              </a>
            ) : (
              'Sin cargar'
            )}
          </span>
        </div>

        {/* La videollamada va última y en su propio renglón: es la única que
            lleva un campo para escribir, y en el medio de los datos partía las
            dos filas de tres. Aparece solo si la entrevista es online, y si
            quedó un enlace cargado de cuando lo era se sigue mostrando:
            esconder un dato que alguien puso es la forma de perderlo. */}
        {(e.modalidad === 'Online' || e.enlace) && (
          <div className="os-entrevista-videollamada">
            <span className="os-dato-rotulo">Videollamada</span>
            <Enlace id={e.id} enlace={e.enlace} />
          </div>
        )}
      </section>

      {tests.length === 0 && (
        <section className="os-panel">
          <p className="os-vacio">
            El pedido no tiene batería cargada, así que no se sabe qué tests le
            corresponden. Se elige en la ficha del pedido.
          </p>
        </section>
      )}

      {/* El título va adentro de la lista: al lado lleva el botón que abre y
          cierra todas las tarjetas, y ese botón necesita el estado que vive
          ahí. */}
      <Orden
        id={e.id}
        tests={tests}
        estados={tests.map(estadoDe)}
        tarjetas={tests.map(contenidoDe)}
        abierto={TEST_COMPETENCIAS}
      />


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
