import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../../Shell';
import { desajusteDeProyectivo, fichaDe, proyectivoDe, type Ficha } from '@/lib/ficha';
import { quienSoy } from '@/lib/identidad';
import { COLOR_ETAPA, COLOR_RECOMENDACION } from '@/lib/psicotecnicos-tipos';
import { RUTA } from '@/lib/psicotecnicos';
import { fechaHora } from '@/lib/hora';
import { formatoImporte } from '@/lib/cotizaciones';
import Manchas from './Manchas';
import SumarioTexto from './SumarioTexto';
import Ingreso from './Ingreso';
import Factura from './Factura';
import Conclusion from './Conclusion';
import Entregar from './Entregar';
import Benziger from './Benziger';
import Administrados from './Administrados';
import Raven from './Raven';
import BenzigerHoja from './BenzigerHoja';
import { leerBenziger } from '@/lib/benziger-lectura';

export const dynamic = 'force-dynamic';

/**
 * La ficha del candidato: todo lo suyo en un lugar.
 *
 * Las pestañas viajan en la dirección (`?ver=manchas`) y no en el navegador,
 * así una ficha abierta en una pestaña concreta se puede compartir y recargar
 * sin volver al principio.
 *
 * Cada pestaña dice cuántas filas tiene al lado del nombre: sirve para saber
 * qué hay cargado sin entrar a mirar una por una.
 */

type Pestana = { clave: string; texto: string; cuantos: (f: Ficha) => number };

/**
 * Las pestañas de la ficha.
 *
 * La de manchas lleva el nombre del test que se le administró, Rorschach o
 * Zulliger: son dos pruebas distintas, con distintas láminas y distintas
 * normas, y la evaluadora trabaja sabiendo cuál tiene delante. La dirección
 * sigue siendo `?ver=manchas` en las dos, así que los enlaces guardados no se
 * rompen.
 *
 * El sumario vive en esa misma pestaña, debajo de la codificación de la que
 * sale: se codifica, se calcula y se lee sin cambiar de pantalla, igual que el
 * Benziger.
 */
const PESTANAS: Pestana[] = [
  { clave: 'datos', texto: 'Datos', cuantos: () => 0 },
  { clave: 'manchas', texto: 'Manchas', cuantos: (f) => f.manchas.length },
  { clave: 'benziger', texto: 'Benziger', cuantos: (f) => (f.benziger ? 1 : 0) },
  { clave: 'tests', texto: 'Tests', cuantos: (f) => f.cualitativos.length + (f.raven ? 1 : 0) },
  {
    clave: 'recomendacion',
    texto: 'Recomendación',
    cuantos: (f) => (f.cabecera.recomendacion ? 1 : 0),
  },
  { clave: 'informe', texto: 'Informe', cuantos: (f) => f.competencias.length },
];

function Dato({
  rotulo,
  ancho,
  children,
}: {
  rotulo: string;
  /** Para un valor que trae sus propias filas adentro. */
  ancho?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`os-ficha-dato${ancho ? ' os-ficha-dato-ancho' : ''}`}>
      <div className="os-ficha-rotulo">{rotulo}</div>
      <div className="os-ficha-valor">{children}</div>
    </div>
  );
}

function Falta({ texto = 'sin cargar' }: { texto?: string }) {
  return <span className="os-dato-falta">{texto}</span>;
}

/** Lo que todavía no se migró de Airtable. Explica por qué está vacío. */
function SinDatos({ que }: { que: string }) {
  return (
    <p className="os-vacio">
      No hay {que} cargado para esta persona. La tabla existe y la pantalla la lee;
      lo que falta es migrar el dato, que todavía vive en Airtable.
    </p>
  );
}

/**
 * Los datos, en tres tablas.
 *
 * Rótulo a la izquierda y valor a la derecha, como el resto del OS: una
 * columna de rótulos alineada se recorre de arriba abajo buscando el que
 * interesa, y en grilla hay que barrer la pantalla entera.
 *
 * El contacto ("sin contactar" o "esperando respuesta") no está: se opera desde
 * Por citar y acá no dice nada que haga falta.
 */
function Bloque({
  titulo,
  dos,
  children,
}: {
  titulo: string;
  /** En dos columnas: para el bloque largo, que si no es una tira. */
  dos?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="os-panel">
      <div className="os-panel-top">
        <h2>{titulo}</h2>
      </div>
      <div className={`os-ficha-datos${dos ? ' os-ficha-datos-dos' : ''}`}>{children}</div>
    </section>
  );
}

function Datos({ f }: { f: Ficha }) {
  const c = f.cabecera;
  const precio = f.precio;

  return (
    <>
      <Bloque titulo="La persona">
        <Dato rotulo="Empresa">{c.pedidos?.empresas?.nombre ?? <Falta texto="sin empresa" />}</Dato>
        <Dato rotulo="Puesto">{c.pedidos?.puesto ?? <Falta texto="sin puesto" />}</Dato>
        <Dato rotulo="Teléfono">
          {c.personas?.telefono ? (
            <a
              href={`https://wa.me/${c.personas.telefono.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noreferrer"
            >
              {c.personas.telefono}
            </a>
          ) : (
            <Falta />
          )}
        </Dato>
        <Dato rotulo="Correo">
          {c.personas?.email ? (
            <a href={`mailto:${c.personas.email}`}>{c.personas.email}</a>
          ) : (
            <Falta />
          )}
        </Dato>
      </Bloque>

      <Bloque titulo="La evaluación" dos>
        <Dato rotulo="Solicitud">{fechaHora(c.fecha_ingreso) ?? <Falta texto="sin fecha" />}</Dato>
        <Dato rotulo="Estado">
          <span className={`os-sello-estado ${COLOR_ETAPA[c.estado] ?? 'os-gris'}`}>
            {c.estado}
          </span>
        </Dato>
        <Dato rotulo="Evaluadora">{c.evaluadoras?.nombre ?? <Falta texto="sin asignar" />}</Dato>
        <Dato rotulo="Batería">{c.pedidos?.baterias?.codigo ?? <Falta texto="a definir" />}</Dato>
        <Dato rotulo="Entrevista">
          {fechaHora(c.fecha_entrevista) ?? <Falta texto="sin agendar" />}
        </Dato>
        <Dato rotulo="Modalidad">{c.modalidad ?? <Falta texto="sin definir" />}</Dato>
        <Dato rotulo="Entrega">{fechaHora(c.fecha_entrega) ?? <Falta texto="sin entregar" />}</Dato>
        <Dato rotulo="Recomendación">
          {c.recomendacion ? (
            <span
              className={`os-sello-estado ${COLOR_RECOMENDACION[c.recomendacion] ?? 'os-gris'}`}
            >
              {c.recomendacion}
            </span>
          ) : (
            <Falta texto="sin cerrar" />
          )}
        </Dato>
        <Dato rotulo="Precio">
          {precio ? formatoImporte(precio) : <Falta texto="la batería no tiene precio" />}
        </Dato>
        <Dato rotulo="Facturado">
          <Factura id={c.id} facturado={c.facturado} numero={c.numero_factura} />
        </Dato>
        <Dato rotulo="Cobrado">{c.pagado ? 'Sí' : <Falta texto="todavía no" />}</Dato>
      </Bloque>

      <Bloque titulo="El ingreso">
        <Dato rotulo="Seguimiento" ancho>
          <Ingreso
            id={c.id}
            ingreso={c.ingreso}
            fecha={c.fecha_ingreso_empresa}
            seguimientoAl={c.seguimiento_al}
            resultado={c.seguimiento_resultado}
            notas={c.seguimiento_notas}
          />
        </Dato>
      </Bloque>

    </>
  );
}

/**
 * El sumario, debajo de la codificación de la que sale.
 *
 * El botón que lo calcula vive en el pie de la grilla, junto a "Agregar
 * respuesta": son los dos finales posibles de esa tabla, cargar una respuesta
 * más o cerrar el protocolo.
 */
function SumarioEstructural({ f }: { f: Ficha }) {
  const s = f.sumario;
  if (!s) {
    return (
      <p className="os-vacio">
        {f.manchas.length > 0
          ? 'Todavía no se calculó el sumario. Se arma con el motor Exner sobre la codificación de arriba.'
          : 'El sumario se arma con el motor Exner sobre la codificación, que todavía está vacía.'}
      </p>
    );
  }

  // El texto lo arma el propio motor, con el orden y las abreviaturas de la
  // hoja de sumario: se muestra tal cual en vez de rearmarlo acá.
  const texto = (s.crudo as { texto?: string } | null)?.texto;

  return texto ? <SumarioTexto texto={texto} /> : null;
}

/**
 * Con qué cierra la evaluación, y la entrega.
 *
 * Tiene pestaña propia porque es una decisión, no un dato más de la ficha: se
 * toma después de leer el sumario y el informe, que están al lado, y es lo
 * único que el cliente recibe como respuesta.
 */
function Recomendacion({ f }: { f: Ficha }) {
  const c = f.cabecera;
  return (
    <section className="os-panel os-cierre">
      <div className="os-panel-top">
        <h2>Con qué cierra</h2>
      </div>
      <div className="os-panel-cuerpo">
        <Conclusion
          id={c.id}
          recomendacion={c.recomendacion}
          notas={c.recomendacion_notas}
        />
      </div>
    </section>
  );
}

/**
 * El Benziger: su carga y lo que ya se leyó del informe.
 *
 * La carga está siempre, aunque no haya nada todavía: es la puerta por donde
 * entra el informe, y sin ella la pestaña no serviría para nada hasta que
 * alguien cargara el dato desde otro lado.
 */
function BenzigerVista({ f, id }: { f: Ficha; id: string }) {
  const b = f.benziger;
  return (
    <>
      <Benziger
        id={id}
        cuadrantes={b?.cuadrante_preferente ?? []}
        informe={b?.pdf_path ? (b.pdf_nombre ?? 'Informe cargado') : null}
      />

      {b?.cuadrantes && Object.keys(b.cuadrantes).length > 0 && (
        <BenzigerHoja
          l={leerBenziger(b.cuadrantes, b.adjetivos ?? {}, b.abiertas ?? {}, b.estres ?? {})}
        />
      )}
    </>
  );
}

/**
 * Los tests que no son de manchas.
 *
 * Arriba lo que se administró, que se marca acá y no en Datos: es parte del
 * trabajo de esta pestaña. Después el Raven con su puntaje, y por último los
 * cualitativos.
 */
function Tests({ f, id }: { f: Ficha; id: string }) {
  const c = f.cabecera;
  return (
    <>
      <section className="os-panel os-cierre">
        <div className="os-panel-top">
          <h2>Administrados</h2>
        </div>
        <div className="os-panel-cuerpo">
          <Administrados
            id={id}
            bender={c.bender_administrado}
            grafico={c.grafico_2_personas_administrado}
          />
        </div>
      </section>

      <section className="os-panel os-cierre">
        <div className="os-panel-top">
          <h2>Raven</h2>
        </div>
        <div className="os-panel-cuerpo">
          <Raven
            id={id}
            raw={f.raven?.raw ?? null}
            percentil={f.raven?.percentil ?? null}
            desvios={f.raven?.desvios ?? null}
            resultado={f.raven?.resultado ?? null}
          />
        </div>
      </section>
      {f.cualitativos.map((t) => (
        <section key={t.id} className="os-panel">
          <h2 className="os-ficha-titulo">{t.test ?? 'Test'}</h2>
          <div className="os-ficha-datos">
            <Dato rotulo="Observaciones">{t.observaciones ?? <Falta />}</Dato>
            <Dato rotulo="Interpretación">{t.interpretacion ?? <Falta />}</Dato>
            <Dato rotulo="Hallazgos">{t.hallazgos ?? <Falta />}</Dato>
          </div>
        </section>
      ))}
    </>
  );
}

/**
 * El informe de competencias y, al pie, la entrega.
 *
 * Entregar cierra esta pantalla porque el informe es lo que se entrega: el
 * botón queda al final de lo que el cliente va a recibir, no en otra pestaña.
 */
function Informe({ f }: { f: Ficha }) {
  const c = f.cabecera;
  const entrega = c.estado === 'Por analizar' && (
    <Entregar id={c.id} recomendacion={c.recomendacion} />
  );

  if (f.competencias.length === 0) {
    return (
      <>
        <SinDatos que="informe de competencias" />
        {entrega}
      </>
    );
  }

  return (
    <>
      <div className="os-ficha-competencias">
        {f.competencias.map((x) => (
          <article key={x.id} className="os-ficha-competencia">
            <div className="os-ficha-competencia-top">
              <span className="os-fila-titulo">{x.competencia}</span>
              <span className="os-ficha-numero">{x.puntaje ?? '—'}</span>
            </div>
            {x.justificacion && <p className="os-fila-detalle">{x.justificacion}</p>}
            {x.texto && <p className="os-fila-detalle">{x.texto}</p>}
          </article>
        ))}
      </div>
      {entrega}
    </>
  );
}

export default async function FichaPagina({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ver?: string; desde?: string };
}) {
  const [yo, ficha] = await Promise.all([quienSoy(), fichaDe(params.id)]);
  if (!ficha) notFound();

  // `sumario` ya no es una pestaña, pero las direcciones guardadas siguen
  // llevando ahí: caen donde ahora vive, que es la codificación.
  const pedida = searchParams.ver === 'sumario' ? 'manchas' : searchParams.ver;
  const ver = PESTANAS.some((p) => p.clave === pedida) ? (pedida as string) : 'datos';

  const c = ficha.cabecera;
  const nombre = c.personas?.nombre ?? 'Sin nombre';
  // De dónde se vino, para poder volver a la misma cola.
  const volverA = searchParams.desde ?? RUTA[c.estado] ?? RUTA['Sin asignar'];
  const proyectivo = proyectivoDe(ficha);
  const desajuste = desajusteDeProyectivo(ficha);

  return (
    <Shell titulo={`Psicotécnicos · ${nombre}`} identidad={yo.nombre} ancho>
      <Link className="os-volver-enlace" href={`/os/psicotecnicos/${volverA}`}>
        ← Volver a la lista
      </Link>

      <div className="os-encabezado">
        <h1>{nombre}</h1>
        <p>
          {c.pedidos?.empresas?.nombre ?? 'Sin empresa'} · {c.pedidos?.puesto ?? 'Sin puesto'}
        </p>
      </div>

      <nav className="os-pestanas">
        {PESTANAS.map((p) => {
          const n = p.cuantos(ficha);
          const texto = p.clave === 'manchas' ? (proyectivo ?? p.texto) : p.texto;
          return (
            <Link
              key={p.clave}
              href={`/os/psicotecnicos/ficha/${params.id}?ver=${p.clave}&desde=${volverA}`}
              className={`os-pestana${ver === p.clave ? ' activa' : ''}`}
              aria-current={ver === p.clave ? 'page' : undefined}
            >
              {texto}
              {n > 0 && <span className="os-pestana-cuenta">{n}</span>}
            </Link>
          );
        })}
      </nav>

      {ver === 'datos' && <Datos f={ficha} />}
      {ver === 'manchas' && (
        <>
          {desajuste && (
            <div className="os-aviso">
              La batería dice {desajuste.bateria} y lo cargado es un{' '}
              {desajuste.cargado}. Uno de los dos está mal: o el protocolo se
              codificó en la ficha equivocada, o el pedido entró con otra
              batería.
            </div>
          )}
          <Manchas evaluacionId={params.id} filas={ficha.manchas} />
          {/* El sumario sale de esta misma codificación, así que va debajo y
              sin panel alrededor: sus bloques ya son tarjetas con su borde. */}
          <SumarioEstructural f={ficha} />
        </>
      )}
      {/* Sin panel alrededor: la vista trae sus propias tarjetas. */}
      {ver === 'benziger' && <BenzigerVista f={ficha} id={params.id} />}
      {ver === 'tests' && <Tests f={ficha} id={params.id} />}
      {ver === 'recomendacion' && <Recomendacion f={ficha} />}
      {ver === 'informe' && (
        <section className="os-panel">
          <Informe f={ficha} />
        </section>
      )}
    </Shell>
  );
}
