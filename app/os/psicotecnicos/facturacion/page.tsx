import Shell from '../../Shell';
import { AFacturar, Emitidas } from './Facturacion';
import {
  formatoImporte,
  listarAFacturar,
  listarEmisoras,
  listarFacturas,
} from '@/lib/facturas';
import { totalDe } from '@/lib/facturas-tipos';
import { esMia, quienSoy } from '@/lib/identidad';
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
export default async function Facturacion() {
  const [yo, pendientes, facturas, emisoras, cuentas] = await Promise.all([
    quienSoy(),
    listarAFacturar(),
    listarFacturas(),
    listarEmisoras(),
    cuentasDeLaBarra(),
  ]);

  // Arriba, lo de quien mira. Agustín tiene alcance 'todo' y ve las dos colas.
  const mias = pendientes.filter((p) => esMia(p.evaluadora, yo));
  const vivas = facturas.filter((f) => f.estado !== 'anulada');
  const sinCobrar = vivas.filter((f) => f.cobradaAt === null);

  const aFacturar = mias.reduce((n, p) => n + totalDe(p), 0);
  const porCobrar = sinCobrar.reduce((n, f) => n + (f.importe ?? 0), 0);
  const cobrado = vivas
    .filter((f) => f.cobradaAt !== null)
    .reduce((n, f) => n + (f.importe ?? 0), 0);

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
          informe. Arriba está lo tuyo; abajo, lo que facturaron las dos.
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

      <AFacturar pendientes={mias} emisoras={emisoras} quien={yo.nombre} />
      <Emitidas facturas={facturas} />
    </Shell>
  );
}
