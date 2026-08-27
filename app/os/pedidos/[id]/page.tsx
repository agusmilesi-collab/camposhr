import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../Shell';
import { leerPedido } from '@/lib/pedidos';
import { quienSoy } from '@/lib/identidad';
import { baterias as listarBaterias } from '@/lib/altas';
import { dolarTarjeta } from '@/lib/baterias-precios';
import { BENZIGER_USD } from '@/lib/benziger';
import { ABIERTO, DEL_JEFE, DEL_PUESTO, FAMILIAS, SENIORITY } from '@/lib/pedido-campos';
import { COLOR_ETAPA } from '@/lib/psicotecnicos-tipos';
import { exigenciasGuardadas } from '@/lib/exigencias-datos';
import { Benziger, Borrar, Estado, Fecha, Largo, Lista, Pregunta, Texto } from './Editar';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

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
  const [yo, pedido, baterias, cambio, exigencias] = await Promise.all([
    quienSoy(),
    leerPedido(params.id),
    listarBaterias(),
    dolarTarjeta(),
    exigenciasGuardadas(),
  ]);
  if (!pedido) notFound();

  const porDefecto = exigencias.find((e) => e.predeterminada) ?? null;

  const pendientes = pedido.candidatos - pedido.entregados;
  const campos = pedido as unknown as Record<string, string | null>;

  /**
   * Cuántas preguntas del bloque quedan sin contestar.
   *
   * Se contestan con el cliente por teléfono, así que quedan a medias sin que
   * nadie se entere: nueve botoneras vacías se ven igual que nueve contestadas
   * si no se las mira una por una.
   */
  function sinContestar(preguntas: typeof DEL_PUESTO): string {
    const faltan = preguntas.filter((p) => !campos[p.campo]).length;
    if (faltan === 0) return 'contestado';
    return faltan === preguntas.length
      ? 'sin contestar'
      : `faltan ${faltan} de ${preguntas.length}`;
  }

  const cuentas = await cuentasDeLaBarra();

  return (
    <Shell titulo={`Pedido · ${pedido.puesto}`} identidad={yo.nombre} cuentas={cuentas}>
      {/* Se vuelve al cliente, que es donde vive ahora la lista de sus
          búsquedas. */}
      <Link className="os-volver-enlace" href={`/os/clientes/${pedido.empresaId}`}>
        ← Volver a {pedido.empresa}
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
        {/* Con qué vara se leen los puntajes de los informes de este pedido.
            Va acá y en ningún otro lado: el resto del sistema usa la default,
            y apartarse de ella es una decisión del puesto. Cambiarla no
            recalcula nada, cambia el nombre que le toca a cada puntaje. */}
        <Lista
          id={pedido.id}
          campo="exigencia_id"
          valor={pedido.exigenciaId}
          rotulo="Exigencia"
          vacio={`La default${porDefecto ? ` (${porDefecto.nombre})` : ''}`}
          opciones={exigencias
            .filter((e) => !e.predeterminada)
            .map((e) => ({
              valor: e.id,
              texto: `${e.nombre} · ${e.adecuado} / ${e.alto} / ${e.sobresaliente}`,
            }))}
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
          fila
        />
        <Largo
          id={pedido.id}
          campo="contexto"
          valor={pedido.contexto}
          rotulo="Contexto y cultura"
          ayuda="Cómo es la empresa por dentro: cómo se decide, cómo se habla, qué se tolera."
          fila
        />
      </Bloque>

      {/* Quiénes entraron por este pedido, con su etapa y un salto a la ficha.
          Lo que el pedido produce estaba solo como número: para ver a quién se
          le tomó había que ir al pipeline y buscar por empresa. */}
      <Bloque
        titulo="Los candidatos"
        nota={
          pedido.candidatos === 0
            ? 'todavía ninguno'
            : `${pedido.entregados} de ${pedido.candidatos} entregados`
        }
      >
        <div className="os-pedido-suelto">
          {pedido.gente.length === 0 ? (
            <p className="os-vacio">
              Nadie cargado todavía. Se agregan desde Sin asignar, eligiendo este pedido.
            </p>
          ) : (
            <ul className="os-pedido-gente">
              {pedido.gente.map((g) => (
                <li key={g.id}>
                  <Link className="os-tabla-nombre os-tabla-ficha" href={`/os/psicotecnicos/ficha/${g.id}`}>
                    {g.nombre}
                  </Link>
                  <span className={`os-sello-estado ${COLOR_ETAPA[g.estado] ?? 'os-gris'}`}>
                    {g.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Bloque>

      <Bloque titulo="Cómo es el puesto" nota={sinContestar(DEL_PUESTO)}>
        <div className="os-seguimiento os-pedido-suelto os-pedido-preguntas">
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

      <Bloque titulo="Cómo es el jefe" nota={sinContestar(DEL_JEFE)}>
        <div className="os-seguimiento os-pedido-suelto os-pedido-preguntas">
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

      {/* Cerrar y borrar juntos, con una línea entre medio: se parecen y hacen
          lo contrario. Cerrar guarda todo y lo saca del selector de alta;
          borrar no deja nada, y solo se ofrece si no hay nadie cargado. */}
      <Bloque titulo="Estado">
        <div className="os-pedido-suelto">
          <Estado
            id={pedido.id}
            estado={pedido.estado}
            abierto={ABIERTO}
            pendientes={pendientes}
          />
          <Borrar id={pedido.id} puesto={pedido.puesto} candidatos={pedido.candidatos} />
        </div>
      </Bloque>
    </Shell>
  );
}
