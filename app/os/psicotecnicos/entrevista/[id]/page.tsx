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

/**
 * Un ícono por test, para reconocerlo antes de leer.
 *
 * Trazo fino y 24 de caja, como los de la barra lateral. Las manchas llevan la
 * suya partida al medio, el Bender sus figuras para copiar, el gráfico dos
 * personas, el Raven la matriz con la pieza que falta, y la entrevista una
 * conversación.
 */
const ICONO: Record<string, React.ReactNode> = {
  manchas: (
    <>
      <path d="M12 3.5c2.6 0 3.4 2.2 4.6 3.6 1.2 1.4 3 2 3 4.2 0 2.6-2.2 3.5-3.4 5.1-.9 1.2-1.2 3.1-4.2 3.1" />
      <path d="M12 3.5c-2.6 0-3.4 2.2-4.6 3.6-1.2 1.4-3 2-3 4.2 0 2.6 2.2 3.5 3.4 5.1.9 1.2 1.2 3.1 4.2 3.1" />
      <path d="M12 3.5v16" strokeDasharray="2 2" />
    </>
  ),
  bender: (
    <>
      <circle cx="8" cy="8" r="3.2" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
      <path d="M4 20h5" />
    </>
  ),
  grafico: (
    <>
      <circle cx="8.5" cy="7" r="2.6" />
      <path d="M4.5 20v-3a4 4 0 0 1 8 0v3" />
      <circle cx="17" cy="8.5" r="2.2" />
      <path d="M14 20v-2.5a3.2 3.2 0 0 1 6.4 0V20" />
    </>
  ),
  raven: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" />
      <path d="M14.8 14.8h5.7v5.7h-5.7z" fill="currentColor" opacity="0.18" stroke="none" />
    </>
  ),
  entrevista: (
    <>
      <path d="M20 13.5a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5H6a2.5 2.5 0 0 1-2.5-2.5v-6A2.5 2.5 0 0 1 6 5h11.5A2.5 2.5 0 0 1 20 7.5z" />
    </>
  ),
  informe: (
    <>
      <path d="M6.5 3.5h7l4.5 4.5v12a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M13.5 3.5V8H18" />
      <path d="M9 13h6M9 16.5h4" />
    </>
  ),
};

function Icono({ nombre }: { nombre: string }) {
  return (
    <svg
      className="os-herramienta-icono"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONO[nombre] ?? ICONO.informe}
    </svg>
  );
}

/** Con qué se toma cada test, por su nombre en la batería. */
const HERRAMIENTA: Record<string, { href: string; boton: string }> = {
  Rorschach: { href: '/os/laminas/rorschach', boton: 'Abrir las láminas' },
  Zulliger: { href: '/os/laminas/zulliger', boton: 'Abrir las láminas' },
};

/** Qué ícono le toca a cada test. */
const QUE_ICONO: Record<string, string> = {
  Rorschach: 'manchas',
  Zulliger: 'manchas',
  Bender: 'bender',
  'Gráfico 2 personas': 'grafico',
  Raven: 'raven',
  'Entrevista por competencias': 'entrevista',
  'Análisis discursivo (Elliot Jaques)': 'entrevista',
  Benziger: 'informe',
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

function Tarjeta({ test, children }: { test: string; children?: React.ReactNode }) {
  return (
    <section className="os-panel os-herramienta">
      <h3 className="os-herramienta-texto">
        <Icono nombre={QUE_ICONO[test] ?? 'informe'} />
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
          <span className="os-dato-valor">{e.bateria ?? 'A definir'}</span>
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

      {tests.map((t) => {
        const h = HERRAMIENTA[t];
        if (h) {
          return (
            <Tarjeta key={t} test={t}>
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
            <Tarjeta key={t} test="Raven">
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
            <Tarjeta key={t} test={t}>
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
            <Tarjeta key={t} test={t}>
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
            <Tarjeta key={t} test="Benziger">
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

        return <Tarjeta key={t} test={t} />;
      })}


      <section className="os-panel os-entrevista-cierre">
        <p>
          Al quedar tomado el último test, la evaluación pasa sola a Por
          analizar. El botón la cierra antes.
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
