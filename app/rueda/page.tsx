/**
 * Descarga de la rueda de emociones.
 *
 * Es el destino del código QR de la charla de emociones: el grupo la escanea al
 * cierre y se lleva la rueda al teléfono. Por eso la página es una sola pantalla
 * con la imagen y un botón, sin nada más que leer.
 *
 * Va en JPEG y no en PNG: la rueda se mira en el teléfono, la fototeca lo maneja
 * sin vueltas y pesa la mitad. El PNG solo aportaría en una impresión grande.
 */

import Guardar from './Guardar';

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
          src="/rueda/rueda-de-emociones.jpg"
          alt="Rueda de emociones"
        />

        <div className="rd-botones">
          <Guardar src="/rueda/rueda-de-emociones.jpg" />
        </div>

        <p className="rd-ayuda">
          Si el teléfono la guarda en Archivos y la querés en las fotos, mantené
          apretada la imagen de arriba y elegí <strong>Guardar en Fotos</strong>.
        </p>

        <p className="rd-pie">
          Sentir Mindfulness · Bienestar corporativo
        </p>
      </div>
    </main>
  );
}
