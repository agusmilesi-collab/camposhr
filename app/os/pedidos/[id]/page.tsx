import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../Shell';
import { leerPedido } from '@/lib/pedidos';
import { quienSoy } from '@/lib/identidad';
import { baterias as listarBaterias } from '@/lib/altas';
import { dolarTarjeta } from '@/lib/baterias-precios';
import { BENZIGER_USD } from '@/lib/benziger';
import { ABIERTO, DEL_JEFE, DEL_PUESTO, FAMILIAS, SENIORITY } from '@/lib/pedido-campos';
import { Benziger, Estado, Fecha, Largo, Lista, Pregunta, Texto } from './Editar';

export const dynamic = 'force-dynamic';

/**
 * La ficha del pedido: qué se busca, para quién y contra qué se mide.
 *
 * Tres bloques, en el orden en que se completa un pedido: la búsqueda (lo que
 * se sabe apenas entra el mail), el encargo (lo que se acordó cobrar) y cómo
 * es el puesto (las nueve preguntas que se le hacen al cliente para poder
 * escribir un informe del puesto y no uno genérico).
 *
 * Los campos son los de la tabla Pedidos de Airtable. Falta la JD adjunta, que
 * allá es un archivo.
 */

function pesos(n: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);
}

function Bloque({
  titulo,
  nota,
  dos,
  children,
}: {
  titulo: string;
  nota?: string;
  dos?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="os-panel" style={{ marginTop: 18 }}>
      <div className="os-panel-top">
        <h2>{titulo}</h2>
        {nota && <span className="os-columna-monto">{nota}</span>}
      </div>
      <div className={`os-ficha-datos${dos ? ' os-ficha-datos-dos' : ''}`}>{children}</div>
    </section>
  );
}

export default async function FichaPedido({ params }: { params: { id: string } }) {
  const [yo, pedido, baterias, cambio] = await Promise.all([
    quienSoy(),
    leerPedido(params.id),
    listarBaterias(),
    dolarTarjeta(),
  ]);
  if (!pedido) notFound();

  const pendientes = pedido.candidatos - pedido.entregados;

  return (
    <Shell titulo={`Pedido · ${pedido.puesto}`} identidad={yo.nombre}>
      <Link className="os-volver-enlace" href="/os/pedidos">
        ← Volver a los pedidos
      </Link>

      <div className="os-encabezado">
        <h1>{pedido.puesto}</h1>
        <p>{pedido.empresa}</p>
      </div>

      <Bloque
        titulo="La búsqueda"
        nota={
          pedido.candidatos === 0
            ? 'sin candidatos'
            : `${pedido.entregados} de ${pedido.candidatos} entregados`
        }
        dos
      >
        <Texto id={pedido.id} campo="puesto" valor={pedido.puesto} rotulo="Puesto" />
        <Fecha
          id={pedido.id}
          campo="fecha_pedido"
          valor={pedido.fechaPedido}
          rotulo="Fecha del pedido"
        />
        <Lista
          id={pedido.id}
          campo="familia"
          valor={pedido.familia}
          rotulo="Familia"
          opciones={FAMILIAS.map((f) => ({ valor: f, texto: f }))}
        />
        <Lista
          id={pedido.id}
          campo="seniority"
          valor={pedido.seniority}
          rotulo="Nivel"
          opciones={SENIORITY.map((s) => ({ valor: s, texto: s }))}
        />
      </Bloque>

      <Bloque titulo="El encargo" dos>
        <Lista
          id={pedido.id}
          campo="bateria_id"
          valor={pedido.bateriaId}
          rotulo="Batería"
          vacio="A definir"
          opciones={baterias.map((b) => ({ valor: b.id, texto: `${b.codigo} · ${b.nombre}` }))}
        />
        <Benziger
          id={pedido.id}
          puesto={pedido.conBenziger}
          usd={BENZIGER_USD}
          enPesos={cambio ? pesos(BENZIGER_USD * cambio.valor) : null}
        />
        <Largo
          id={pedido.id}
          campo="notas"
          valor={pedido.notas}
          rotulo="Qué pidió el cliente"
          ayuda="Lo que dice el mail: contexto, urgencia, a quién reporta."
        />
        <Largo
          id={pedido.id}
          campo="contexto"
          valor={pedido.contexto}
          rotulo="Contexto y cultura"
          ayuda="Cómo es la empresa por dentro: cómo se decide, cómo se habla, qué se tolera."
        />
      </Bloque>

      <Bloque titulo="Cómo es el puesto">
        <div className="os-seguimiento os-pedido-suelto">
          {DEL_PUESTO.map((p) => (
            <Pregunta
              key={p.campo}
              id={pedido.id}
              campo={p.campo}
              rotulo={p.rotulo}
              valor={(pedido as unknown as Record<string, string | null>)[p.campo]}
              opciones={p.opciones}
            />
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Cómo es el jefe">
        <div className="os-seguimiento os-pedido-suelto">
          {DEL_JEFE.map((p) => (
            <Pregunta
              key={p.campo}
              id={pedido.id}
              campo={p.campo}
              rotulo={p.rotulo}
              valor={(pedido as unknown as Record<string, string | null>)[p.campo]}
              opciones={p.opciones}
            />
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Estado">
        <div className="os-pedido-suelto">
          <Estado
            id={pedido.id}
            estado={pedido.estado}
            abierto={ABIERTO}
            pendientes={pendientes}
          />
        </div>
      </Bloque>
    </Shell>
  );
}
