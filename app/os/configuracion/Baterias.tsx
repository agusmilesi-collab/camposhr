import {
  BENZIGER_USD,
  baterias as leerBaterias,
  dolarTarjeta,
  precioA,
  proximo,
} from '@/lib/baterias-precios';
import Precio from './Precio';
import Bateria from './Bateria';

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
 *
 * **Cada tarjeta va en tres secciones: precio, descripción y alcance.** Son las
 * tres preguntas que se le hacen a una batería (cuánto sale, qué es, qué cubre)
 * y separadas se comparan de a una entre las tres columnas.
 */


export default async function Baterias() {
  const [baterias, cambio] = await Promise.all([leerBaterias(), dolarTarjeta()]);

  const pesos = (n: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <>
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
              <section className="os-bateria-seccion">
                <span className="os-bateria-seccion-titulo">Precio</span>
                <Precio
                  bateriaId={b.id}
                  vigente={precioA(b.precios)}
                  proximo={proximo(b.precios)}
                  historia={b.precios}
                  dolar={cambio?.valor ?? null}
                  fechaDolar={cambio?.fecha ?? null}
                  benzigerUsd={BENZIGER_USD}
                />
              </section>

              <Bateria
                bateriaId={b.id}
                puesta={{
                  nombre: b.nombre ?? '',
                  descripcion: b.descripcion ?? '',
                  paraQuien: b.para_quien ?? '',
                  duracion: b.duracion_min,
                  tests: b.tests,
                  outputs: b.outputs,
                }}
                benziger={`Benziger, opcional · USD ${BENZIGER_USD}${
                  cambio ? ` · ${pesos(BENZIGER_USD * cambio.valor)}` : ''
                } · lo agrega el pedido, no la batería`}
              />
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
