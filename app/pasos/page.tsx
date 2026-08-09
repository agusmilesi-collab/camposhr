/**
 * Los cuatro pasos para dar una mala noticia.
 *
 * Es el destino del código QR de la charla de malas noticias: el grupo lo
 * escanea al cierre y se lleva los pasos al teléfono. Mismo criterio que la
 * rueda de emociones: una sola pantalla, sin nada más que leer, pensada para
 * mirarla diez minutos antes de una conversación difícil y no para estudiarla.
 *
 * El porqué de cada paso va abajo del paso y en gris. Es lo que da criterio
 * cuando la conversación no encaja con la instrucción literal, que es lo que
 * pasa siempre.
 */

export const metadata = {
  title: 'Cuatro pasos para una conversación difícil — Campos HR',
  description:
    'Los cuatro pasos para comunicar una mala noticia, para tenerlos a mano.',
};

const PASOS = [
  {
    nombre: 'Encuadrá',
    que: 'Buscá un lugar privado y sin apuro, y avisale antes: “necesito hablarte de algo difícil”.',
    porque: 'El aviso le da un momento para acomodarse. Sin eso, las primeras frases no las registra.',
  },
  {
    nombre: 'Decilo claro',
    que: 'Decí el motivo y la decisión juntos, en las primeras dos frases.',
    porque: 'Ya se dio cuenta de que algo pasa, y mientras das vueltas imagina algo peor.',
  },
  {
    nombre: 'En silencio, sostené',
    que: 'Callate mientras descarga, aunque llore o levante la voz. Cuando pare, decile una vez: “la decisión ya está tomada”.',
    porque: 'Con la emoción alta no entra información. Nada de lo que digas ahí lo va a escuchar.',
  },
  {
    nombre: 'Cerrá con una fecha',
    que: 'Terminá diciendo qué pasa ahora, con día y hora.',
    porque: 'Un plan concreto es lo que baja la incertidumbre de qué va a pasar ahora.',
  },
];

export default function Pasos() {
  return (
    <main className="ps">
      <div className="ps-caja">
        <div className="eyebrow">Ciclo Liderazgos Humanos</div>
        <h1>Mañana tengo una conversación difícil</h1>
        <p className="ps-nota">
          Cuatro pasos para comunicar una mala noticia. Miralos diez minutos
          antes de entrar.
        </p>

        <ol className="ps-lista">
          {PASOS.map((p, i) => (
            <li key={p.nombre}>
              <span className="ps-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h2>{p.nombre}</h2>
                <p>{p.que}</p>
                <p className="ps-porque">{p.porque}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="ps-antes">
          <b>Antes de entrar:</b> escribí en tres líneas los hechos concretos,
          sin adjetivos. El motivo tiene que ser algo que la otra persona pueda
          verificar. “Faltaste tres veces” se puede verificar; “sos un
          irresponsable” no.
        </p>

        <p className="ps-despues">
          <b>Después de darla:</b> date un minuto. Un café, una caminata, tres
          respiraciones. No sigas como si nada.
        </p>

        <p className="ps-fuente">
          Adaptado del protocolo SPIKES (Baile y otros, 2000), usado en medicina
          para comunicar diagnósticos graves.
        </p>
      </div>
    </main>
  );
}
