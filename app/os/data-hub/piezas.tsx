import type { Reparto } from '@/lib/data-hub';

/** Las piezas que comparten las pestañas del data hub. */

export function Barras({ datos, vacio }: { datos: Reparto; vacio: string }) {
  if (datos.length === 0) return <p className="os-vacio">{vacio}</p>;
  const tope = Math.max(...datos.map((d) => d.n));
  return (
    <ul className="os-hub-barras">
      {datos.map((d) => (
        <li key={d.nombre}>
          <span className="os-hub-barra-nombre" title={d.nombre}>
            {d.nombre}
          </span>
          <span className="os-hub-barra">
            <span style={{ width: `${(d.n / tope) * 100}%` }} />
          </span>
          <span className="os-hub-barra-n">{d.n}</span>
        </li>
      ))}
    </ul>
  );
}

export function Panel({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="os-panel">
      <div className="os-panel-top">
        <h2>{titulo}</h2>
        {nota && <span className="os-columna-monto">{nota}</span>}
      </div>
      <div className="os-panel-cuerpo">{children}</div>
    </section>
  );
}

/** Un eje del tablero, con su título y lo que agrupa. */
export function Eje({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: React.ReactNode;
}) {
  return (
    <section className="os-hub-eje">
      <div className="os-hub-eje-top">
        <h2>{titulo}</h2>
        <p>{bajada}</p>
      </div>
      {children}
    </section>
  );
}
