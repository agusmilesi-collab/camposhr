import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../../Shell';
import { entrevistaDe, type EstadoRaven, type Entrevista } from '@/lib/entrevista';
import { quienSoy } from '@/lib/identidad';
import { diaDeLaSemana, fechaHora } from '@/lib/hora';
import { duracion } from '@/lib/raven';
import LinkRaven from '../../LinkRaven';
import Tomada from './Tomada';
import Enlace from './Enlace';
import Grafico from './Grafico';
import Papel from './Papel';
import LinkLaminas from './LinkLaminas';
import HojaBender from './HojaBender';
import RelojRaven from './RelojRaven';
import Bateria from '../../Bateria';

export const dynamic = 'force-dynamic';

/**
 * La hoja de la entrevista: con qué se le toma cada test.
 *
 * Es la pantalla que se abre con la persona enfrente. No guarda lo suyo ni lo
 * muestra: para eso está la ficha, que se lee después para codificar. Acá lo
 * único que hace falta es la herramienta de cada test a un clic, porque
 * buscarlas mientras alguien espera del otro lado es el momento más caro para
 * buscar nada.
 *
 * Qué tests aparecen lo dice la batería que se le vendió al cliente. El
 * Benziger se suma aparte cuando el pedido lo incluye: es opcional en las tres
 * baterías, así que no está en la lista de ninguna.
 *
 * Cada test dice cómo se administra, y son tres formas distintas: las manchas
 * se comparten en pantalla, el Raven se manda por enlace y lo hace la persona
 * sola, y el Bender y el gráfico son lápiz y papel. Lo que se marca acá es solo
 * lo de papel, que es lo que después no deja rastro en el sistema.
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
function Tarjeta({
  test,
  n,
  children,
}: {
  test: string;
  n: number;
  children?: React.ReactNode;
}) {
  return (
    <section className="os-panel os-herramienta">
      <h3 className="os-herramienta-texto">
        <span className="os-herramienta-numero" aria-hidden="true">
          {String(n).padStart(2, '0')}
        </span>
        {test}
      </h3>
      {children}
    </section>
  );
}

export default async function HojaDeEntrevista({ params }: { params: { id: string } }) {
  const yo = await quienSoy();
  const e: Entrevista | null = await entrevistaDe(params.id);
  if (!e) notFound();

  const cuando = e.cuando ? `${diaDeLaSemana(e.cuando)} ${fechaHora(e.cuando)}` : null;
  const raven = RAVEN[e.raven];
  // El Benziger no lo declara la batería: lo agrega el pedido.
  const tests = [...e.tests, ...(e.conBenziger ? ['Benziger'] : [])];

  return (
    <Shell titulo={`Entrevista · ${e.nombre}`} identidad={yo.nombre}>
      <Link className="os-volver-enlace" href="/os/psicotecnicos/entrevistas">
        ← Volver a las entrevistas
      </Link>

      <div className="os-encabezado">
        <h1>{e.nombre}</h1>
        <p>
          {e.empresa ?? 'Sin empresa'} · {e.puesto ?? 'Sin puesto'}
        </p>
      </div>

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
            {e.telefono ? (
              <a
                href={`https://wa.me/${e.telefono.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                title="Escribir por WhatsApp"
              >
                {e.telefono}
              </a>
            ) : (
              'Sin teléfono'
            )}
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

      {tests.map((t, i) => {
        const h = HERRAMIENTA[t];
        if (h) {
          return (
            <Tarjeta key={t} test={t} n={i + 1}>
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
              </Papel>
            </Tarjeta>
          );
        }

        if (t === 'Raven') {
          return (
            <Tarjeta key={t} test="Raven" n={i + 1}>
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
            </Tarjeta>
          );
        }

        if (t === 'Bender') {
          return (
            <Tarjeta key={t} test={t} n={i + 1}>
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
            </Tarjeta>
          );
        }

        if (t === 'Gráfico 2 personas') {
          return (
            <Tarjeta key={t} test={t} n={i + 1}>
              <Papel
                id={e.id}
                campoMarca="graficoAdministrado"
                campoNotas="graficoObservaciones"
                administrado={e.graficoAdministrado}
                observaciones={e.graficoObservaciones}
                debajo={<Grafico id={e.id} nombre={e.graficoNombre} />}
              />
            </Tarjeta>
          );
        }

        if (t === 'Benziger') {
          return (
            <Tarjeta key={t} test="Benziger" n={i + 1}>
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
            </Tarjeta>
          );
        }

        return <Tarjeta key={t} test={t} n={i + 1} />;
      })}


      <section className="os-panel os-entrevista-cierre">
        {/* Dónde está parada, para el caso de haber avanzado ya: desde acá el
            botón de cerrarla no existe, y sin decirlo la pantalla parece rota. */}
        <p>
          {e.estado === 'Por entrevistar'
            ? 'Al quedar tomado el último test, la evaluación pasa sola a Por analizar. El botón la cierra antes.'
            : `Esta evaluación ya está en ${e.estado}. Su etapa se corrige en la ficha.`}
        </p>
        <div className="os-entrevista-botones">
          <Link className="os-boton" href={`/os/psicotecnicos/ficha/${e.id}?desde=entrevistas`}>
            Abrir la ficha completa
          </Link>
          {e.estado === 'Por entrevistar' && <Tomada id={e.id} />}
        </div>
      </section>
    </Shell>
  );
}
