import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../../Shell';
import { fichaDe, type Ficha } from '@/lib/ficha';
import { quienSoy } from '@/lib/identidad';
import { COLOR_ETAPA, COLOR_RECOMENDACION } from '@/lib/psicotecnicos-tipos';
import { RUTA } from '@/lib/psicotecnicos';
import { fechaHora } from '@/lib/hora';
import { formatoImporte } from '@/lib/cotizaciones';
import Manchas from './Manchas';
import Calcular from './Calcular';
import SumarioTexto from './SumarioTexto';
import Ingreso from './Ingreso';
import Factura from './Factura';

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

const PESTANAS: Pestana[] = [
  { clave: 'datos', texto: 'Datos', cuantos: () => 0 },
  { clave: 'manchas', texto: 'Manchas', cuantos: (f) => f.manchas.length },
  { clave: 'sumario', texto: 'Sumario estructural', cuantos: (f) => (f.sumario ? 1 : 0) },
  { clave: 'benziger', texto: 'Benziger', cuantos: (f) => (f.benziger ? 1 : 0) },
  { clave: 'tests', texto: 'Tests', cuantos: (f) => f.cualitativos.length + (f.raven ? 1 : 0) },
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
        <Dato rotulo="Administrado">
          {[
            c.bender_administrado ? 'Bender' : null,
            c.grafico_2_personas_administrado ? 'Gráfico 2 personas' : null,
          ]
            .filter(Boolean)
            .join(' · ') || <Falta texto="nada marcado" />}
        </Dato>
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

/** Los índices del sumario, con el nombre que usa Exner. */
const INDICES: [string, string][] = [
  ['r', 'R'], ['lambda', 'Lambda'], ['ea', 'EA'], ['es', 'es'], ['d', 'D'],
  ['adj_d', 'AdjD'], ['eb', 'EB'], ['estilo', 'Estilo'], ['wsumc', 'WSumC'],
  ['afr', 'Afr'], ['xa_pct', 'XA%'], ['x_mas_pct', 'X+%'], ['xu_pct', 'Xu%'],
  ['x_menos_pct', 'X-%'], ['zd', 'Zd'], ['ego', 'Ego'], ['scon', 'SCON'],
  ['depi', 'DEPI'], ['cdi', 'CDI'], ['pti', 'PTI'],
];

function SumarioEstructural({ f, id }: { f: Ficha; id: string }) {
  const s = f.sumario;
  if (!s) {
    return (
      <>
        <p className="os-vacio">
          Todavía no se calculó el sumario de esta persona. Se arma con el motor Exner
          a partir de la codificación cargada en Manchas.
        </p>
        {f.manchas.length > 0 && <Calcular evaluacionId={id} />}
      </>
    );
  }

  // El texto lo arma el propio motor, con el orden y las abreviaturas de la
  // hoja de sumario: se muestra tal cual en vez de rearmarlo acá.
  const texto = (s.crudo as { texto?: string } | null)?.texto;

  return (
    <>
      {texto && <SumarioTexto texto={texto} />}

      <div className="os-ficha-indices">
        {INDICES.map(([clave, rotulo]) => (
          <div key={clave} className="os-ficha-indice">
            <div className="os-ficha-rotulo">{rotulo}</div>
            <div className="os-ficha-numero">{String(s[clave] ?? '—')}</div>
          </div>
        ))}
      </div>

      <div className="os-barra-acciones">
        <Calcular evaluacionId={id} />
        <span className="os-columna-monto">
          Recalcular pisa el sumario anterior.
        </span>
      </div>
    </>
  );
}

function BenzigerVista({ f }: { f: Ficha }) {
  const b = f.benziger;
  if (!b) return <SinDatos que="Benziger" />;
  return (
    <div className="os-ficha-datos">
      <Dato rotulo="Cuadrante">{b.cuadrante_preferente?.join(' · ') || <Falta />}</Dato>
      <Dato rotulo="Resumen">{b.resumen ?? <Falta />}</Dato>
    </div>
  );
}

function Tests({ f }: { f: Ficha }) {
  if (!f.raven && f.cualitativos.length === 0) return <SinDatos que="ningún test" />;
  return (
    <>
      {f.raven && (
        <section className="os-panel">
          <h2 className="os-ficha-titulo">Raven</h2>
          <div className="os-ficha-datos">
            <Dato rotulo="Puntaje">{f.raven.raw ?? <Falta />}</Dato>
            <Dato rotulo="Percentil">{f.raven.percentil ?? <Falta />}</Dato>
            <Dato rotulo="Desvíos">{f.raven.desvios ?? <Falta />}</Dato>
            <Dato rotulo="Resultado">{f.raven.resultado ?? <Falta />}</Dato>
          </div>
        </section>
      )}
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

function Informe({ f }: { f: Ficha }) {
  if (f.competencias.length === 0) return <SinDatos que="informe de competencias" />;
  return (
    <div className="os-ficha-competencias">
      {f.competencias.map((c) => (
        <article key={c.id} className="os-ficha-competencia">
          <div className="os-ficha-competencia-top">
            <span className="os-fila-titulo">{c.competencia}</span>
            <span className="os-ficha-numero">{c.puntaje ?? '—'}</span>
          </div>
          {c.justificacion && <p className="os-fila-detalle">{c.justificacion}</p>}
          {c.texto && <p className="os-fila-detalle">{c.texto}</p>}
        </article>
      ))}
    </div>
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

  const ver = PESTANAS.some((p) => p.clave === searchParams.ver)
    ? (searchParams.ver as string)
    : 'datos';

  const c = ficha.cabecera;
  const nombre = c.personas?.nombre ?? 'Sin nombre';
  // De dónde se vino, para poder volver a la misma cola.
  const volverA = searchParams.desde ?? RUTA[c.estado] ?? RUTA['Sin asignar'];

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
          return (
            <Link
              key={p.clave}
              href={`/os/psicotecnicos/ficha/${params.id}?ver=${p.clave}&desde=${volverA}`}
              className={`os-pestana${ver === p.clave ? ' activa' : ''}`}
              aria-current={ver === p.clave ? 'page' : undefined}
            >
              {p.texto}
              {n > 0 && <span className="os-pestana-cuenta">{n}</span>}
            </Link>
          );
        })}
      </nav>

      {ver === 'datos' && <Datos f={ficha} />}
      {ver === 'manchas' && (
        <>
          <Manchas evaluacionId={params.id} filas={ficha.manchas} />
          {ficha.manchas.length > 0 && <Calcular evaluacionId={params.id} />}
        </>
      )}
      {ver === 'sumario' && (
        <section className="os-panel">
          <SumarioEstructural f={ficha} id={params.id} />
        </section>
      )}
      {ver === 'benziger' && (
        <section className="os-panel">
          <BenzigerVista f={ficha} />
        </section>
      )}
      {ver === 'tests' && <Tests f={ficha} />}
      {ver === 'informe' && (
        <section className="os-panel">
          <Informe f={ficha} />
        </section>
      )}
    </Shell>
  );
}
