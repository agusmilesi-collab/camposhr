import Shell from '../Shell';
import { NuevaOportunidad, Tablero } from './Embudo';
import { ABIERTOS, formatoImporte, listarCotizaciones } from '@/lib/cotizaciones';
import { quienSoy } from '@/lib/identidad';
import { listarClientes } from '@/lib/clientes';

export const dynamic = 'force-dynamic';

export default async function Cotizaciones() {
  const [yo, todas, clientes] = await Promise.all([
    quienSoy(),
    listarCotizaciones(),
    listarClientes(),
  ]);

  const abiertas = todas.filter((c) => ABIERTOS.includes(c.estado));
  const ganadas = todas.filter((c) => c.estado === 'Aprobada');
  const perdidas = todas.filter((c) => c.estado === 'Perdida');
  const suma = (xs: typeof todas) => xs.reduce((n, c) => n + c.importe, 0);

  // Cuántas de las que se resolvieron se ganaron. Sin nada resuelto no hay
  // porcentaje que mostrar, y un cero ahí se lee como que se pierde todo.
  const resueltas = ganadas.length + perdidas.length;
  const cierre = resueltas > 0 ? Math.round((ganadas.length / resueltas) * 100) : null;

  return (
    <Shell
      titulo="Cotizaciones"
      identidad={yo.nombre}
      nota={`${todas.length} oportunidades`}
      cuentas={{ '/os/cotizaciones': abiertas.length }}
    >
      <div className="os-encabezado">
        <h1>El embudo</h1>
        <p>
          Se mueve arrastrando la tarjeta a la columna. Lo que llega a Aprobada
          aparece en Costos como ingreso.
        </p>
      </div>

      <div className="os-cifras">
        <div className="os-cifra">
          <div className="os-cifra-rotulo">En juego</div>
          <div className="os-cifra-valor">{formatoImporte(suma(abiertas))}</div>
          <div className="os-cifra-pie">
            {abiertas.length} {abiertas.length === 1 ? 'oportunidad' : 'oportunidades'} sin
            resolver.
          </div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Ganado</div>
          <div className="os-cifra-valor">{formatoImporte(suma(ganadas))}</div>
          <div className="os-cifra-pie">{ganadas.length} aprobadas.</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Perdido</div>
          <div className="os-cifra-valor">{formatoImporte(suma(perdidas))}</div>
          <div className="os-cifra-pie">{perdidas.length} perdidas.</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Cierre</div>
          <div className="os-cifra-valor">{cierre === null ? '—' : `${cierre}%`}</div>
          <div className="os-cifra-pie">
            {resueltas === 0 ? 'Todavía no se resolvió ninguna.' : `Sobre ${resueltas} resueltas.`}
          </div>
        </div>
      </div>

      <div className="os-barra-acciones">
        <NuevaOportunidad clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      </div>

      <Tablero
        oportunidades={todas.map((c) => ({
          id: c.id,
          cliente: c.cliente,
          empresaId: c.empresaId,
          concepto: c.concepto,
          importe: c.importe,
          moneda: c.moneda,
          estado: c.estado,
          fecha: c.fecha,
          token: c.token,
          nota: c.nota,
          motivo: c.motivo,
          objecion: c.objecion,
        }))}
        clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
      />
    </Shell>
  );
}
