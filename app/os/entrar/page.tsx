import { redirect } from 'next/navigation';
import { hayPuerta } from '@/lib/os-sesion';

export const metadata = { title: 'Campos OS', robots: { index: false, follow: false } };

/**
 * La pantalla de entrada. Es lo único del OS que se sirve sin sesión.
 *
 * Sin `OS_CLAVE` cargada no hay nada que pedir, así que manda derecho adentro.
 */
export default function Entrar({
  searchParams,
}: {
  searchParams: { error?: string; destino?: string };
}) {
  const destino = searchParams.destino?.startsWith('/os') ? searchParams.destino : '/os';
  if (!hayPuerta()) redirect(destino);

  return (
    <div className="os os-entrar">
      <form className="os-entrar-caja" method="post" action="/api/os/entrar">
        <div className="os-sello" aria-hidden="true">CH</div>
        <div className="os-marca-nombre">Campos <em>OS</em></div>
        <p className="os-entrar-nota">
          Adentro hay datos de candidatos. Se entra con la clave del equipo.
        </p>
        <input type="hidden" name="destino" value={destino} />
        <input
          className="os-entrar-campo"
          type="password"
          name="clave"
          placeholder="Clave"
          autoComplete="current-password"
          autoFocus
          required
        />
        {searchParams.error && <p className="os-entrar-error">La clave no es esa.</p>}
        <button className="os-entrar-boton" type="submit">
          Entrar
        </button>
      </form>
    </div>
  );
}
