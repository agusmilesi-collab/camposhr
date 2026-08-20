import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';
import {
  BENZIGER_USD,
  baterias as leerBaterias,
  dolarTarjeta,
  precioA,
  proximo,
} from '@/lib/baterias-precios';
import Precio from './Precio';

export const dynamic = 'force-dynamic';

/**
 * Las baterías: qué incluye cada una, cuánto dura y cuánto sale.
 *
 * Es la tabla de precios del servicio de selección. Está en Sistema y no en
 * Comercial porque no es una venta sino la definición del producto: lo que se
 * cotiza sale de acá, y cada evaluación queda enganchada a la batería con la
 * que se hizo.
 *
 * Los datos son los de la tabla Baterías de Airtable, migrados el 20/8/2026.
 *
 * El precio lo puede actualizar cualquiera de las tres, y las actualizaciones
 * valen para adelante: cada evaluación conserva el que regía cuando entró. Ver
 * `supabase/precios-de-baterias.sql`.
 */

function duracion(min: number | null): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default async function Baterias() {
  const [yo, baterias, cambio] = await Promise.all([
    quienSoy(),
    leerBaterias(),
    dolarTarjeta(),
  ]);

  const pesos = (n: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <Shell titulo="Baterías" identidad={yo.nombre} nota={`${baterias.length} baterías`}>
      <div className="os-encabezado">
        <h1>Baterías</h1>
      </div>

      {baterias.length === 0 && (
        <div className="os-panel">
          <p className="os-vacio">No se pudieron leer las baterías.</p>
        </div>
      )}

      <div className="os-baterias">
        {baterias.map((b) => (
          <section className="os-panel" key={b.id}>
            <div className="os-panel-top">
              <h2>{b.codigo}</h2>
            </div>

            <div className="os-bateria-cuerpo">
              <p className="os-bateria-nombre">{b.nombre ?? b.codigo}</p>
              {b.descripcion && <p className="os-fila-detalle">{b.descripcion}</p>}

              <Precio
                bateriaId={b.id}
                vigente={precioA(b.precios)}
                proximo={proximo(b.precios)}
                historia={b.precios}
                dolar={cambio?.valor ?? null}
                fechaDolar={cambio?.fecha ?? null}
                benzigerUsd={BENZIGER_USD}
              />

              <div className="os-bateria-dato">
                <span className="os-dato-rotulo">Duración</span>
                <span>{duracion(b.duracion_min)}</span>
              </div>

              <div className="os-bateria-dato">
                <span className="os-dato-rotulo">Incluye</span>
                {b.tests.length === 0 ? (
                  <span className="os-dato-falta">sin definir</span>
                ) : (
                  <ul className="os-lista">
                    {b.tests.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                    <li className="os-lista-opcional">
                      Benziger, opcional · USD {BENZIGER_USD}
                      {cambio ? ` · ${pesos(BENZIGER_USD * cambio.valor)}` : ''}
                    </li>
                  </ul>
                )}
              </div>

              <div className="os-bateria-dato">
                <span className="os-dato-rotulo">Entrega</span>
                {b.outputs.length === 0 ? (
                  <span className="os-dato-falta">sin definir</span>
                ) : (
                  <ul className="os-lista">
                    {b.outputs.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
