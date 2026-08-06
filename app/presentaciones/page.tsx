import { listarPresentaciones, formatoFecha } from '@/lib/presentaciones';
import { listarAsistentes, listarCiclos, listarCorridas } from '@/lib/ciclo';
import Encuentros, { type EnCurso } from './Encuentros';
import TablaCharlas from './TablaCharlas';

export const dynamic = 'force-dynamic';

const BASE = 'https://tools.camposhr.com/pres';

/**
 * Qué material corresponde a qué ciclo de la base.
 *
 * El índice de presentaciones nombra al material y la base nombra al producto,
 * y no tienen por qué escribirse igual. Los clientes no se declaran acá: salen
 * de las corridas activas, así dar de alta uno nuevo lo hace aparecer solo.
 */
const MATERIAL_DEL_CICLO: Record<string, string> = {
  'Liderazgos Humanos · plan B': 'Liderazgos Humanos',
};

export default async function Presentaciones() {
  const todas = listarPresentaciones();

  // Un bloque por ciclo, en el orden en que aparecen en el índice.
  const ciclos = todas.reduce<{ nombre: string; filas: typeof todas }[]>((acc, p) => {
    const grupo = acc.find((g) => g.nombre === p.ciclo);
    if (grupo) grupo.filas.push(p);
    else acc.push({ nombre: p.ciclo, filas: [p] });
    return acc;
  }, []);

  // Los encuentros en curso, agrupados por el material que les corresponde.
  // Los asistentes se cuentan acá, así el día del encuentro se ve de un vistazo
  // cuánta gente entró sin abrir otra pantalla.
  const [corridas, ciclosBase] = await Promise.all([listarCorridas(), listarCiclos()]);
  const enVivo = new Map<string, EnCurso[]>();

  for (const [material, nombreCiclo] of Object.entries(MATERIAL_DEL_CICLO)) {
    if (!ciclos.some((c) => c.nombre === material)) continue;
    const filas: EnCurso[] = [];
    for (const corrida of corridas.filter((c) => c.ciclos?.nombre === nombreCiclo)) {
      const asistentes = await listarAsistentes(corrida.id);
      filas.push({
        slug: corrida.empresas.slug,
        empresa: corrida.empresas.nombre,
        registrados: asistentes.length,
        clave: corrida.clave_control,
        abierta: Boolean(corrida.actividad_abierta_id),
      });
    }
    enVivo.set(material, filas);
  }

  return (
    <main className="wrap wrap-ancho">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Material de los encuentros</div>
          <a href="/" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Herramientas
          </a>
        </div>
        <h1>Presentaciones</h1>
        <p className="head-nota">
          Cada presentación es un archivo que funciona sin internet: las
          tipografías y las imágenes viajan adentro. Para dar un encuentro,
          descargala antes y abrila desde la máquina. Se avanza con las flechas,
          la tecla F la pone en pantalla completa y la N abre las notas del
          orador en una ventana aparte, para la pantalla de la notebook.
        </p>
      </section>

      {ciclos.map((ciclo) => (
        <section className="presentaciones" key={ciclo.nombre}>
          <h2 className="pres-ciclo">{ciclo.nombre}</h2>
          <TablaCharlas
            clientes={(enVivo.get(ciclo.nombre) ?? []).map((e) => ({
              slug: e.slug,
              empresa: e.empresa,
            }))}
            charlas={ciclo.filas.map((p) => ({
              token: p.token,
              archivo: p.archivo,
              titulo: p.titulo,
              subtitulo: p.subtitulo,
              orden: p.orden,
              placas: p.placas,
              fechaTexto: formatoFecha(p.fecha),
              cliente: p.cliente,
            }))}
          />

          {enVivo.has(ciclo.nombre) && (
            <Encuentros
              enCurso={enVivo.get(ciclo.nombre)!}
              ciclos={ciclosBase.map((c) => ({ id: c.id, nombre: c.nombre }))}
            />
          )}
        </section>
      ))}
    </main>
  );
}
