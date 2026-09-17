import Link from 'next/link';
import Shell from '../../Shell';
import { AFacturar, Emitidas } from './Facturacion';
import {
  formatoImporte,
  listarAFacturar,
  listarEmisoras,
  listarFacturas,
} from '@/lib/facturas';
import { esDePsicotecnicos, totalDe } from '@/lib/facturas-tipos';
import { equipo, esMia, quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '../datos';

export const dynamic = 'force-dynamic';

/**
 * Facturación de psicotécnicos: lo que hay que facturar y lo ya facturado.
 *
 * Está en Psicotécnicos y no en Comercial porque lo que se factura es una
 * evaluación: la cola sale del pipeline y se arma con los mismos nombres y
 * puestos que se vienen mirando toda la semana.
 *
 * **Arriba cada una ve lo suyo y abajo las dos ven todo.** Lo que está para
 * facturar es trabajo pendiente de alguien, y mezclarlo obliga a buscar lo
 * propio entre lo ajeno. Lo ya facturado es la caja del estudio, y ahí las dos
 * necesitan ver el conjunto: quién cobró qué, a qué cliente y cuándo.
 *
 * Una evaluación entra en esta cola sola, en cuanto la entrevista se tomó. No
 * hay que marcar nada, y por eso no depende de que el informe esté escrito: se
 * factura el trabajo hecho.
 */
export default async function Facturacion({
  searchParams,
}: {
  searchParams?: { ver?: string };
}) {
  const [yo, miembros, pendientes, facturas, emisoras, cuentas] = await Promise.all([
    quienSoy(),
    equipo(),
    listarAFacturar(),
    listarFacturas(),
    listarEmisoras(),
    cuentasDeLaBarra(),
  ]);

  // Lo de quien mira, para la cifra de arriba: Agustín ve las dos colas.
  const mias = pendientes.filter((p) => esMia(p.evaluadora, yo));

  /**
   * Una pestaña por evaluadora, y dos compartidas.
   *
   * Lo que está para facturar es de alguien y se mira de a una: en una sola
   * lista había que buscar lo propio entre lo ajeno, y con la cola de las dos
   * arriba nadie sabía dónde terminaba la suya. Lo emitido, en cambio, es la
   * caja del estudio y lo miran las dos, partido por si entró la plata.
   */
  const evaluadoras = miembros.filter((m) => m.evaluadora);
  const colas = evaluadoras.map((m) => ({
    clave: (m.evaluadora ?? m.nombre).split(' ')[0].toLowerCase(),
    nombre: (m.evaluadora ?? m.nombre).split(' ')[0],
    filas: pendientes.filter((p) => (p.evaluadora ?? '').includes(m.evaluadora ?? '\u0000')),
  }));
  /**
   * Las de psicotécnicos: las que cubren evaluaciones, más las que llegaron sin
   * renglones y hay que completar.
   *
   * Las de servicios se emiten y se cobran en Costos, que es donde vive ese
   * trabajo. Se reconocen por los renglones y no por una marca: un comprobante
   * de psicotécnicos siempre lleva sus candidatos adentro.
   */
  const vivas = facturas.filter((f) => f.estado !== 'anulada' && esDePsicotecnicos(f));
  const sinCobrar = vivas.filter((f) => f.cobradaAt === null);

  const cobradas = vivas.filter((f) => f.cobradaAt !== null);

  const PESTANAS = [
    ...colas.map((c) => ({ clave: c.clave, texto: `${c.nombre} a facturar`, cuenta: c.filas.length })),
    { clave: 'sin-cobrar', texto: 'Sin cobrar', cuenta: sinCobrar.length },
    { clave: 'cobrado', texto: 'Cobrado', cuenta: cobradas.length },
  ];

  /**
   * La pestaña que se abre primero es la propia: cada una entra a esta pantalla
   * a facturar lo suyo. Agustín, que ve todo, entra por la primera.
   */
  const porDefecto =
    colas.find((c) => yo.evaluadora?.startsWith(c.nombre))?.clave ?? PESTANAS[0].clave;
  const ver = PESTANAS.some((p) => p.clave === searchParams?.ver)
    ? (searchParams?.ver as string)
    : porDefecto;
  const cola = colas.find((c) => c.clave === ver);

  const aFacturar = mias.reduce((n, p) => n + totalDe(p), 0);
  const porCobrar = sinCobrar.reduce((n, f) => n + (f.importe ?? 0), 0);
  const cobrado = cobradas.reduce((n, f) => n + (f.importe ?? 0), 0);

  return (
    <Shell
      titulo="Facturación"
      identidad={yo.nombre}
      nota={`${mias.length} para facturar`}
      cuentas={cuentas}
    >
      <div className="os-encabezado">
        <h1>Facturación</h1>
        <p>
          Una evaluación entra en la cola en cuanto se tomó la entrevista, sin esperar al
          informe. Cada una factura lo suyo; lo emitido lo miran las dos.
        </p>
      </div>

      <div className="os-cifras">
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Para facturar</div>
          <div className="os-cifra-valor">{formatoImporte(aFacturar)}</div>
          <div className="os-cifra-pie">
            {mias.length} {mias.length === 1 ? 'evaluación' : 'evaluaciones'}
            {yo.alcance === 'todo' ? ' de las dos.' : ' tuyas.'}
          </div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Por cobrar</div>
          <div className="os-cifra-valor">{formatoImporte(porCobrar)}</div>
          <div className="os-cifra-pie">{sinCobrar.length} facturas sin marcar cobro.</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Cobrado</div>
          <div className="os-cifra-valor">{formatoImporte(cobrado)}</div>
          <div className="os-cifra-pie">De las dos, desde siempre.</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Emitidas</div>
          <div className="os-cifra-valor">{vivas.length}</div>
          <div className="os-cifra-pie">Sin contar las anuladas.</div>
        </div>
      </div>

      <nav className="os-pestanas">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/os/psicotecnicos/facturacion?ver=${p.clave}`}
            className={`os-pestana${ver === p.clave ? ' activa' : ''}`}
            aria-current={ver === p.clave ? 'page' : undefined}
          >
            {p.texto}
            <span className="os-pestana-cuenta">{p.cuenta}</span>
          </Link>
        ))}
      </nav>

      {cola && (
        <AFacturar
          pendientes={cola.filas}
          emisoras={emisoras}
          quien={yo.nombre}
          conRotulo={false}
        />
      )}
      {ver === 'sin-cobrar' && <Emitidas facturas={vivas} solo="sin-cobrar" />}
      {ver === 'cobrado' && <Emitidas facturas={vivas} solo="cobrado" />}
    </Shell>
  );
}
