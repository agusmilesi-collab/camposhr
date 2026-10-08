import Link from 'next/link';
import Shell from '../../Shell';
import { ordenPorEvaluacion } from '@/lib/orden-compra';
import { AFacturar, Anuladas, Emitidas } from './Facturacion';
import {
  fiscalesDe,
  siguientesNumeros,
  listarAFacturar,
  listarEmisoras,
  listarFacturas,
  notasDeCredito,
} from '@/lib/facturas';
import { esDePsicotecnicos } from '@/lib/facturas-tipos';
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
  const [yo, miembros, pendientes, facturas, notas, emisoras, cuentas] = await Promise.all([
    quienSoy(),
    equipo(),
    listarAFacturar(),
    listarFacturas(),
    notasDeCredito(),
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
  /**
   * Cada evaluadora ve solo lo suyo: su cola, y lo que ella emitió, cobró o
   * anuló. La pestaña de la otra no existe para ella. Quien ve todo (Agustín)
   * sigue viendo las dos colas y la caja entera.
   *
   * Se compara por el nombre de pila, que es como se nombra a cada una en las
   * colas y en la emisora de cada factura.
   */
  const soloDe = yo.alcance !== 'todo' && yo.evaluadora ? yo.evaluadora.split(' ')[0] : null;
  const esSuya = (emisora: string) => soloDe === null || emisora.split(' ')[0] === soloDe;
  const todasLasColas = evaluadoras.map((m) => ({
    clave: (m.evaluadora ?? m.nombre).split(' ')[0].toLowerCase(),
    nombre: (m.evaluadora ?? m.nombre).split(' ')[0],
    filas: pendientes.filter((p) => (p.evaluadora ?? '').includes(m.evaluadora ?? '\u0000')),
  }));
  const colas = todasLasColas.filter((c) => soloDe === null || c.nombre === soloDe);
  /**
   * Las de psicotécnicos: las que cubren evaluaciones, más las que llegaron sin
   * renglones y hay que completar.
   *
   * Las de servicios se emiten y se cobran en Costos, que es donde vive ese
   * trabajo. Se reconocen por los renglones y no por una marca: un comprobante
   * de psicotécnicos siempre lleva sus candidatos adentro.
   */
  const vivas = facturas.filter(
    (f) => f.estado !== 'anulada' && esDePsicotecnicos(f) && esSuya(f.emisora)
  );
  const sinCobrar = vivas.filter((f) => f.cobradaAt === null);

  // Lo que va sin factura se nombra por su orden de compra, que es el papel
  // que sí tiene. Pueden ser varias: una por cada carga de candidatos.
  const sinFactura = vivas.filter((f) => f.sinComprobante);
  const ordenDe = await ordenPorEvaluacion(
    sinFactura.flatMap((f) => f.renglones.map((r) => r.evaluacionId ?? ''))
  );
  const ordenes: Record<string, string> = {};
  for (const f of sinFactura) {
    const numeros = [...new Set(f.renglones.map((r) => ordenDe.get(r.evaluacionId ?? '')).filter(Boolean))].sort();
    if (numeros.length > 0) ordenes[f.id] = `OC ${numeros.map((n) => `#${n}`).join(', ')}`;
  }

  const cobradas = vivas.filter((f) => f.cobradaAt !== null);
  // Las que se anularon con nota de crédito. Sus renglones ya soltaron a las
  // personas, así que no se reconocen como "de psicotécnicos": se toman por
  // tener nota.
  const anuladas = facturas.filter(
    (f) => f.estado === 'anulada' && notas[f.id] && esSuya(f.emisora)
  );

  const fiscales = await fiscalesDe(pendientes.map((p) => p.empresaId));
  const siguientes = siguientesNumeros(facturas);

  const PESTANAS = [
    ...colas.map((c) => ({ clave: c.clave, texto: `${c.nombre} a facturar`, cuenta: c.filas.length })),
    { clave: 'sin-cobrar', texto: 'Sin cobrar', cuenta: sinCobrar.length },
    { clave: 'cobrado', texto: 'Cobrado', cuenta: cobradas.length },
    // Solo cuando hay alguna: es la excepción y no una parte del circuito.
    ...(anuladas.length > 0
      ? [{ clave: 'anuladas', texto: 'Anuladas', cuenta: anuladas.length }]
      : []),
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

  return (
    <Shell
      titulo="Facturación"
      identidad={yo.nombre}
      nota={`${mias.length} para facturar`}
      cuentas={cuentas}
    >
      <div className="os-encabezado">
        <h1>Facturación</h1>
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
          siguientes={siguientes}
          fiscales={fiscales}
          quien={yo.nombre}
          conRotulo={false}
        />
      )}
      {ver === 'sin-cobrar' && <Emitidas facturas={vivas} ordenes={ordenes} solo="sin-cobrar" sinEmisora={soloDe !== null} />}
      {ver === 'cobrado' && <Emitidas facturas={vivas} ordenes={ordenes} solo="cobrado" sinEmisora={soloDe !== null} />}
      {ver === 'anuladas' && <Anuladas facturas={anuladas} notas={notas} sinEmisora={soloDe !== null} />}
    </Shell>
  );
}
