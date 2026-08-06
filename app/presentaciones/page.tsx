import { listarPresentaciones, formatoFecha } from '@/lib/presentaciones';
import { listarAsistentes, listarCorridas } from '@/lib/ciclo';
import PanelEncuentro from './PanelEncuentro';

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

  // Un tablero por cliente que esté corriendo el ciclo. Los asistentes se
  // cuentan acá, así el día del encuentro se ve de un vistazo cuánta gente
  // entró sin abrir otra pantalla.
  const corridas = await listarCorridas();
  const enVivo = new Map<
    string,
    { slug: string; empresa: string; registrados: number; clave: string }[]
  >();

  for (const [material, nombreCiclo] of Object.entries(MATERIAL_DEL_CICLO)) {
    if (!ciclos.some((c) => c.nombre === material)) continue;
    const suyas = corridas.filter((c) => c.ciclos?.nombre === nombreCiclo);
    const tableros = [];
    for (const corrida of suyas) {
      const asistentes = await listarAsistentes(corrida.id);
      tableros.push({
        slug: corrida.empresas.slug,
        empresa: corrida.empresas.nombre,
        registrados: asistentes.length,
        clave: corrida.clave_control,
      });
    }
    if (tableros.length) enVivo.set(material, tableros);
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
          <div className="card pres-tabla">
            <div className="pres-row pres-th">
              <span>Fecha</span>
              <span>Cliente</span>
              <span>Charla</span>
              <span className="pres-num">Placas</span>
              <span />
              <span />
            </div>

            {ciclo.filas.map((p) => (
              <div className="pres-row" key={`${p.ciclo}-${p.orden}`}>
                <span className="cot-fecha">{formatoFecha(p.fecha)}</span>
                <span>
                  {p.cliente ? (
                    <em className="chip chip-cliente">{p.cliente}</em>
                  ) : (
                    <em className="pres-todos">Cualquier cliente</em>
                  )}
                </span>
                <span className="pres-charla">
                  <b>
                    {p.orden}. {p.titulo}
                  </b>
                  <em>{p.subtitulo}</em>
                </span>
                <span className="pres-num">{p.placas}</span>

                {p.token ? (
                  <>
                    <span className="pres-accion">
                      <a
                        className="copiar pres-ver"
                        href={
                          enVivo.has(ciclo.nombre)
                            ? `${BASE}/${p.token}?c=${enVivo.get(ciclo.nombre)![0].slug}`
                            : `${BASE}/${p.token}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver presentación
                      </a>
                    </span>
                    <span className="pres-accion">
                      <a className="copiar" href={`/pres/${p.archivo}`} download>
                        Descargar
                      </a>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="pres-accion">
                      <em className="pres-pendiente">Sin publicar</em>
                    </span>
                    <span />
                  </>
                )}
              </div>
            ))}
          </div>

          {(enVivo.get(ciclo.nombre) ?? []).map((t) => (
            <PanelEncuentro
              key={t.slug}
              slug={t.slug}
              empresa={t.empresa}
              registrados={t.registrados}
              clave={t.clave}
            />
          ))}
        </section>
      ))}
    </main>
  );
}
