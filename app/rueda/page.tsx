/**
 * Descarga de la rueda de emociones.
 *
 * Es el destino del código QR de la charla de emociones: el grupo la escanea al
 * cierre y se lleva la rueda al teléfono. Por eso la página es una sola pantalla
 * con la imagen y dos botones, sin nada más que leer.
 *
 * Se ofrecen los dos formatos porque se usan para cosas distintas: el JPG para
 * mandarlo por mensaje y el PNG para imprimirlo, que es como queda a la vista en
 * el escritorio.
 */

export const metadata = {
  title: 'Rueda de emociones — Sentir Mindfulness',
  description:
    'Descargá la rueda de emociones para tenerla a mano en el escritorio.',
};

export default function Rueda() {
  return (
    <main className="rd">
      <div className="rd-caja">
        <div className="eyebrow">Ciclo Liderazgos Humanos</div>
        <h1>Rueda de emociones</h1>
        <p className="rd-nota">
          Se lee de adentro hacia afuera: empezá por la emoción grande y andá
          afinando hasta la palabra que te cierra.
        </p>

        <img
          className="rd-img"
          src="/rueda/rueda-de-emociones.png"
          alt="Rueda de emociones"
        />

        <div className="rd-botones">
          <a
            className="rd-btn"
            href="/rueda/rueda-de-emociones.png"
            download="rueda-de-emociones.png"
          >
            Descargar PNG
          </a>
          <a
            className="rd-btn rd-btn-suave"
            href="/rueda/rueda-de-emociones.jpg"
            download="rueda-de-emociones.jpg"
          >
            Descargar JPG
          </a>
        </div>

        <p className="rd-pie">
          Sentir Mindfulness · Bienestar corporativo
        </p>
      </div>
    </main>
  );
}
