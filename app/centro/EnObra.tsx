/**
 * Una sección que todavía no existe.
 *
 * Están en la barra porque es lo que se viene, y verlas ahí es lo que hace que
 * alguien pregunte por ellas. Una pantalla que dice qué va a haber es mejor que
 * un 404, y mejor que esconder la sección hasta el día que esté: así se sabe
 * que el sistema va para ese lado.
 */
export default function EnObra({ titulo, que }: { titulo: string; que: string }) {
  return (
    <main className="centro-cuerpo">
      <h1 className="centro-titulo">{titulo}</h1>
      <div className="centro-panel">
        <p className="centro-nota" style={{ margin: 0 }}>
          {que} Todavía no está: lo estamos construyendo.
        </p>
      </div>
    </main>
  );
}
