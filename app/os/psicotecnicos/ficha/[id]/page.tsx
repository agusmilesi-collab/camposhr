import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Shell from '../../../Shell';
import { desajusteDeProyectivo, fichaDe, proyectivoDe, type Ficha } from '@/lib/ficha';
import { quienSoy } from '@/lib/identidad';
import { COLOR_ETAPA, COLOR_RECOMENDACION } from '@/lib/psicotecnicos-tipos';
import { nombrePerfil } from '@/lib/perfiles';
import { RUTA } from '@/lib/psicotecnicos';
import { fechaCorta, fechaHora } from '@/lib/hora';
import { formatoImporte } from '@/lib/cotizaciones';
import { numeroDe } from '@/lib/facturas-tipos';
import Manchas from './Manchas';
import SumarioTexto from './SumarioTexto';
import Ingreso from './Ingreso';
import Conclusion from './Conclusion';
import Entregar from './Entregar';
import Benziger from './Benziger';
import Administrados from './Administrados';
import Etapa from './Etapa';
import Documento from '../../informe/_doc/Documento';
import { desdeFicha } from '@/lib/informe';
import Raven from './Raven';
import BenzigerHoja from './BenzigerHoja';
import { leerBenziger } from '@/lib/benziger-lectura';
import Bateria from '../../Bateria';

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
  { clave: 'informe', texto: 'Informe', cuantos: (f) => (f.cabecera.recomendacion ? 1 : 0) },
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

function Datos({ f, id }: { f: Ficha; id: string }) {
  const c = f.cabecera;
  const precio = f.precio;
  // El perfil puede ser de dos cuadrantes, con uno que manda o los dos parejos.
  const perfil = nombrePerfil(
    f.benziger?.cuadrante_preferente ?? [],
    f.benziger?.cuadrantes_parejos === true
  );

  return (
    <>
      {/* Dos columnas que se leen distinto: a la izquierda con quién hablar, a
          la derecha lo que se sacó de la evaluación. Van alternadas porque el
          bloque acomoda sus datos de a pares. */}
      <Bloque titulo="La persona" dos>
        <Dato rotulo="Empresa">{c.pedidos?.empresas?.nombre ?? <Falta texto="sin empresa" />}</Dato>
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
        <Dato rotulo="Puesto">{c.pedidos?.puesto ?? <Falta texto="sin puesto" />}</Dato>
        <Dato rotulo="Perfil Benziger">
          {perfil ? (
            <span className="os-sello-estado os-violeta">{perfil}</span>
          ) : (
            <Falta texto="sin definir" />
          )}
        </Dato>
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
        <Dato rotulo="Raven">
          {f.raven?.raw !== null && f.raven?.raw !== undefined ? (
            <>
              {f.raven.raw} de 36
              {f.raven.resultado && (
                <span className="os-dato-al-lado">{f.raven.resultado}</span>
              )}
            </>
          ) : (
            <Falta texto="sin puntaje" />
          )}
        </Dato>
        <Dato rotulo="Correo">
          {c.personas?.email ? (
            <a href={`mailto:${c.personas.email}`}>{c.personas.email}</a>
          ) : (
            <Falta />
          )}
        </Dato>
        {/* La evaluadora cierra el bloque: de todo lo que quedaba del otro
            lado, es lo único que responde "quién" y no "cuándo". */}
        <Dato rotulo="Evaluadora">{c.evaluadoras?.nombre ?? <Falta texto="sin asignar" />}</Dato>
      </Bloque>

      {/* La evaluación y la factura, una al lado de la otra: la primera es lo
          que pasó con el trabajo y la segunda lo que se cobra por él. Puestas
          una debajo de la otra, la factura quedaba a media pantalla de
          distancia de los datos que la explican. */}
      <div className="os-ficha-par">
        {/* El bloque acomoda sus datos de a pares, así que el orden de acá es
            el intercalado de las dos columnas: a la izquierda qué se le tomó y
            cuándo entró y salió el trabajo, a la derecha en qué anda y cómo se
            la vio. */}
        <Bloque titulo="La evaluación" dos>
          <Dato rotulo="Batería">
            <Bateria
              codigo={c.pedidos?.baterias?.codigo ?? null}
              conBenziger={c.pedidos?.con_benziger === true}
            />
          </Dato>
          <Dato rotulo="Estado">
            <Etapa id={id} etapa={c.estado} />
          </Dato>
          <Dato rotulo="Solicitud">{fechaHora(c.fecha_ingreso) ?? <Falta texto="sin fecha" />}</Dato>
          <Dato rotulo="Entrevista">
            {fechaHora(c.fecha_entrevista) ?? <Falta texto="sin agendar" />}
          </Dato>
          {/* Es la fecha en que se subió al portal: la sella el paso a Entregado,
              que es lo que hace ese botón. Se llamaba "Entrega" y no se sabía si
              era cuándo se prometió o cuándo salió. */}
          <Dato rotulo="Subido al portal">
            {fechaHora(c.fecha_entrega) ?? <Falta texto="todavía no" />}
          </Dato>
          <Dato rotulo="Modalidad">{c.modalidad ?? <Falta texto="sin definir" />}</Dato>
        </Bloque>

        {/* La plata se lee acá y se opera en Facturación: el comprobante junta
            varios candidatos de un cliente, así que la decisión de qué entra en
            cuál no se puede tomar desde la ficha de uno solo. */}
        <Bloque titulo="La factura">
          <Dato rotulo="Importe">
            {precio ? formatoImporte(precio) : <Falta texto="la batería no tiene precio" />}
          </Dato>
          <Dato rotulo="Facturado">
            {f.factura ? (
              <Link className="os-ficha-enlace" href="/os/psicotecnicos/facturacion">
                {numeroDe({ numero: f.factura.numero, puntoVenta: f.factura.punto_venta })}
                <span className="os-dato-al-lado">{fechaCorta(f.factura.fecha)}</span>
              </Link>
            ) : (
              // Un sello y no un "falta": no es un dato que alguien se olvidó
              // de cargar, es que todavía no se facturó. La respuesta a la
              // pregunta es no, y se lee de un vistazo con el punto.
              <span className="os-sello-estado os-rojo">No</span>
            )}
          </Dato>
          <Dato rotulo="Cobrado">
            {f.factura?.cobrada_at ? (
              <span className="os-sello-estado os-verde">{fechaCorta(f.factura.cobrada_at)}</span>
            ) : (
              <span className="os-sello-estado os-rojo">No</span>
            )}
          </Dato>
        </Bloque>
      </div>

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
        parejos={b?.cuadrantes_parejos === true}
        informe={b?.pdf_nombre ?? null}
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
          {/* Se cargan en la hoja de la entrevista y acá se leen. El dibujo se
              sube allá y se mira acá, que es donde se escribe el informe que
              habla de él. */}

        </div>
        <div className="os-panel-cuerpo">
          <Administrados
            id={id}
            bender={c.bender_administrado}
            benderNotas={c.bender_observaciones}
            benderHoja={c.bender_nombre}
            graficoDibujo={c.grafico_2_personas_nombre}
            grafico={c.grafico_2_personas_administrado}
            graficoNotas={c.grafico_2_personas_observaciones}
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
            origen={f.raven?.origen ?? null}
            tardo={f.raven?.duracion_segundos ?? null}
            sesion={f.sesionRaven}
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
/**
 * La pestaña del informe: el documento armado, tal como va a salir impreso.
 *
 * Se muestra acá y no solo en su página aparte porque es donde se lo revisa
 * mientras se termina de cargar: ver qué le falta y qué dice cada capítulo es
 * parte de cargar, no un paso posterior.
 *
 * Se arma con la ficha que esta página ya leyó, así que no cuesta ninguna
 * consulta más. Para imprimir está el botón, que abre la misma vista sin el
 * marco del OS: dentro de la ficha, el PDF saldría con la barra lateral y las
 * pestañas encima.
 */
/**
 * A dónde lleva "Ver portal".
 *
 * El portal vive en su propio subdominio, pero en desarrollo eso apuntaría a
 * producción y el botón no serviría para probar: ahí se queda en la misma
 * máquina, que es donde está el portal de prueba.
 */
function portalDe(token: string | null): string | null {
  if (!token) return null;
  const host = (headers().get('host') ?? '').toLowerCase();
  const local = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  return local ? `/p/${token}` : `https://clientes.camposhr.com/${token}`;
}

/**
 * Qué se le administró de lo que pide su batería.
 *
 * Se mira antes de generar el informe: un informe al que le falta una prueba
 * sale igual, con esa parte vacía, y esto es lo que avisa antes de que eso
 * pase. Sale de la batería del pedido, así que lista exactamente lo que se le
 * vendió al cliente.
 */
function TestsDeLaBateria({ f }: { f: Ficha }) {
  const c = f.cabecera;
  const proyectivo = proyectivoDe(f);
  const estados: { test: string; puesto: boolean }[] = [];

  for (const t of c.pedidos?.baterias?.tests ?? []) {
    if (t === 'Rorschach' || t === 'Zulliger') {
      estados.push({ test: proyectivo ?? t, puesto: c.proyectivo_administrado });
    } else if (t === 'Bender') {
      estados.push({ test: t, puesto: c.bender_administrado });
    } else if (t === 'Gráfico 2 personas') {
      estados.push({ test: t, puesto: c.grafico_2_personas_administrado });
    } else if (t === 'Raven') {
      estados.push({ test: t, puesto: f.raven?.raw !== null && f.raven?.raw !== undefined });
    }
    // La entrevista por competencias y el análisis discursivo no dejan marca:
    // no se listan para no mostrar un estado que nadie carga.
  }
  if (f.benziger) estados.push({ test: 'Benziger', puesto: Boolean(f.benziger.cuadrantes) });

  if (estados.length === 0) return null;
  return (
    <>
      {estados.map((e) => (
        <span key={e.test} className={`os-sello-estado ${e.puesto ? 'os-verde' : 'os-rojo'}`}>
          {e.test}
        </span>
      ))}
    </>
  );
}

function Informe({ f }: { f: Ficha }) {
  const c = f.cabecera;
  const informe = desdeFicha(f);
  const portal = portalDe(c.pedidos?.empresas?.token_portal ?? null);

  return (
    <>
      <section className="os-panel os-cierre os-informe-cierre">
        <div className="os-panel-top">
          <h2>Recomendación</h2>
        </div>
        <div className="os-panel-cuerpo">
          {/* La conclusión se carga acá y no en una pestaña aparte: es lo que
              marca el nivel de ajuste del informe que está abajo y lo que
              habilita subirlo, así que se elige viendo el documento. */}
          <Conclusion id={c.id} recomendacion={c.recomendacion} notas={c.recomendacion_notas}>
            <TestsDeLaBateria f={f} />
          </Conclusion>
        </div>
      </section>

      {/* Un solo panel con su cabecera y el documento adentro: la barra de
          acciones y la hoja son la misma cosa. En dos paneles apilados se leían
          como bloques sueltos, y el de arriba tenía un título y tres botones y
          nada más. */}
      <section className="os-panel">
      <div className="os-generar">
        <h2>El informe</h2>
        <div className="os-generar-acciones">
          <Link
            className="os-boton"
            href={`/os/psicotecnicos/informe/${c.id}?descargar=1`}
            target="_blank"
          >
            Descargar PDF
          </Link>
          {/* Entregar va con el resto de las acciones y no al pie: al final de
              un documento largo hay que bajar hasta el fondo para apretarlo, y
              es la acción que cierra la evaluación. */}
          {c.estado === 'Por analizar' && (
            <Entregar id={c.id} recomendacion={c.recomendacion} />
          )}
          {/* El portal del cliente, para ver ahí mismo cómo le queda. Sin
              token no hay portal: se carga en la ficha de la empresa. */}
          {portal ? (
            <Link className="os-boton" href={portal} target="_blank">
              Ver portal
            </Link>
          ) : (
            <span className="os-boton os-boton-apagado" title="Esta empresa todavía no tiene portal.">
              Ver portal
            </span>
          )}
        </div>
      </div>

      <div className="os-informe-marco">
        <Documento inf={informe} interno editar={c.id} />
      </div>
      </section>

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

  // Las pestañas que se fueron siguen apareciendo en direcciones guardadas:
  // caen donde ahora vive lo suyo. `sumario` en la codificación y
  // `recomendacion` en el informe, que es donde se carga la conclusión.
  const MUDADAS: Record<string, string> = { sumario: 'manchas', recomendacion: 'informe' };
  const pedida = MUDADAS[searchParams.ver ?? ''] ?? searchParams.ver;
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

      {/* El botón va en la línea de las pestañas y no arriba con el título: es
          otra vista de la misma persona, igual que las pestañas, y ahí queda a
          la altura de lo que hace. La hoja de la entrevista es para tenerla
          enfrente, con la herramienta de cada test a un clic; el camino de
          vuelta ya existía y este es el de ida. */}
      <div className="os-pestanas-fila">
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
        <Link className="os-boton os-boton-firme" href={`/os/psicotecnicos/entrevista/${params.id}`}>
          Ver entrevista
        </Link>
      </div>

      {ver === 'datos' && <Datos f={ficha} id={params.id} />}
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
          {/* El sumario calculado va arriba de la codificación: es lo que la
              evaluadora viene a leer cuando entra a esta pestaña, y abajo de
              una grilla de veinte respuestas obligaba a bajar hasta el fondo
              cada vez. Va sin panel alrededor: sus bloques ya son tarjetas con
              su borde.

              Mientras no esté calculado, el aviso queda al pie, al lado del
              botón que lo calcula: ahí sí lo que hay que mirar es la
              codificación. */}
          {ficha.sumario && <SumarioEstructural f={ficha} />}
          <Manchas evaluacionId={params.id} filas={ficha.manchas} />
          {!ficha.sumario && <SumarioEstructural f={ficha} />}
        </>
      )}
      {/* Sin panel alrededor: la vista trae sus propias tarjetas. */}
      {ver === 'benziger' && <BenzigerVista f={ficha} id={params.id} />}
      {ver === 'tests' && <Tests f={ficha} id={params.id} />}
      {/* Sin panel alrededor: trae sus propias tarjetas, igual que Benziger y
          Tests. Envuelto, los dos paneles de adentro quedaban sobre un tercer
          fondo blanco y el conjunto se leía como una sola mancha. */}
      {ver === 'informe' && <Informe f={ficha} />}
    </Shell>
  );
}
