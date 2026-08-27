import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';

export const metadata = { title: 'Especificaciones — Campos OS' };

/**
 * El índice de los specs. Los archivos viven en `CAMPOS OS/` dentro del
 * repositorio, fuera de `public/`: esta pantalla los resume y dice dónde
 * abrirlos, no los sirve.
 */
const SPECS = [
  {
    archivo: 'SPECS-arquitectura.md',
    cubre: 'El marco: unificación, frontera entre código y datos, identidad de cliente, audiencias, capa de servicios.',
    estado: 'Completo',
    color: 'os-verde',
  },
  {
    archivo: 'SPECS-generador-informes.md',
    cubre: 'El botón que genera el informe desde los datos cargados.',
    estado: 'Dos decisiones abiertas',
    color: 'os-ambar',
  },
  {
    archivo: 'SPECS-sesion-decision.md',
    cubre: 'La pantalla que la psicóloga comparte con el cliente para decidir.',
    estado: 'Cuatro cosas a resolver',
    color: 'os-ambar',
  },
  {
    archivo: 'SPECS-organigrama.md',
    cubre: 'La herramienta de estructura del servicio de mapeo.',
    estado: 'Las cuatro capas a resolver',
    color: 'os-ambar',
  },
];

const ORDEN = [
  ['1', 'Unificar el repositorio', 'Privado, con código, método, generadores y motores adentro. Los datos de personas afuera desde el primer día.'],
  ['2', 'El generador de informes de selección', 'Lee de Airtable a través de la capa de servicios, así que no espera a la migración.'],
  ['3', 'El esquema en Supabase y la migración de psicotécnicos', 'Con seguridad por fila y registro de accesos.'],
  ['4', 'Identidad de cliente y contrataciones', 'Sacar el cableado de lib/servicios.ts.'],
  ['5', 'La home por cliente', 'Sobre esa tabla, con el bloque de decisiones pendientes.'],
];

const DECISIONES = [
  [
    'Los dos juegos de seis dimensiones',
    'El de fichas-de-talento.html mide el perfil de la persona sola; el de la sesión de decisión mide capacidad contra demanda del puesto. Si conviven, un mismo candidato tiene dos lecturas distintas.',
  ],
  [
    'Si la sesión de decisión reemplaza al informe o convive con él',
    'Su spec dice que reemplaza al PDF, y su propia capa 4 describe exactamente el informe actual.',
  ],
  [
    'Las capas del organigrama',
    'Cuatro capas conviven y Airtable guarda una sola. El camino elegido es una tabla Líneas.',
  ],
];

export default async function Especificaciones() {
  const yo = await quienSoy();
  const cuentas = await cuentasDeLaBarra();

  return (
    <Shell identidad={yo.nombre} titulo="Especificaciones" cuentas={cuentas} nota={`${SPECS.length} specs`}>
      <div className="os-encabezado">
        <h1>Qué se construye y en qué orden</h1>
        <p>
          Los specs viven en la carpeta <code>CAMPOS OS</code> del repositorio.
          Esta pantalla es el índice: qué cubre cada uno, en qué orden se
          construye y qué falta decidir antes de escribir código.
        </p>
      </div>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Los specs</h2>
        </div>
        {SPECS.map((s) => (
          <div className="os-fila" key={s.archivo}>
            <div className="os-fila-cuerpo">
              <div className="os-fila-titulo">{s.archivo}</div>
              <div className="os-fila-detalle">{s.cubre}</div>
            </div>
            <div className="os-fila-lado">
              <span className={`os-sello-estado ${s.color}`}>{s.estado}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Orden de construcción</h2>
        </div>
        {ORDEN.map(([n, titulo, detalle]) => (
          <div className="os-fila" key={n}>
            <div className="os-avatar" aria-hidden="true">{n}</div>
            <div className="os-fila-cuerpo">
              <div className="os-fila-titulo">{titulo}</div>
              <div className="os-fila-detalle">{detalle}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Lo que hay que decidir antes de construir</h2>
        </div>
        {DECISIONES.map(([titulo, detalle]) => (
          <div className="os-fila" key={titulo}>
            <div className="os-fila-cuerpo">
              <div className="os-fila-titulo">{titulo}</div>
              <div className="os-fila-detalle">{detalle}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>La regla que sostiene todo lo demás</h2>
        </div>
        <p className="os-panel-nota">
          El código va al repositorio. Los datos de personas van a Supabase. Un
          repositorio de git no tiene borrado real, quien clona se lleva la base
          entera y no queda constancia de quién leyó qué.
        </p>
      </section>
    </Shell>
  );
}
