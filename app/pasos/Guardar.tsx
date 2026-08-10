'use client';

import { useState } from 'react';

/**
 * Los cuatro pasos, como una imagen que queda en el teléfono.
 *
 * La página se lee bien mientras está abierta, pero lo que se necesita es
 * mirarla diez minutos antes de una conversación difícil, dos semanas después
 * del encuentro, cuando el enlace ya se perdió entre los mensajes. En la
 * galería sí aparece.
 *
 * Se dibuja acá y no se descarga de ningún lado: una vez abierta la página, el
 * botón funciona aunque la sala se quede sin internet.
 *
 * El camino es el menú de compartir del teléfono, que es el que ofrece
 * "Guardar en Fotos" tanto en iPhone como en Android. Donde no existe, cae en
 * una descarga común, que es lo que pasa en una computadora.
 */

export type Paso = { nombre: string; que: string; porque: string };

/** El ancho de la imagen. Alto de sobra: al final se recorta a lo dibujado. */
const ANCHO = 1080;
/** Se dibuja al doble para que no se vea borrosa en una pantalla de teléfono. */
const ESCALA = 2;

const COLOR = {
  papel: '#f6f5f2',
  tinta: '#16202b',
  suave: '#46505c',
  gris: '#7b7770',
  ambar: '#a97722',
  linea: '#e5e2db',
};

export default function Guardar({
  pasos,
  titulo,
}: {
  pasos: Paso[];
  titulo: string;
}) {
  const [estado, setEstado] = useState<'listo' | 'armando' | 'error'>('listo');

  async function guardar() {
    setEstado('armando');
    try {
      /*
       * Las fuentes tienen que estar cargadas antes de medir: si no, el canvas
       * dibuja con la de reemplazo, mide con esa y los renglones quedan
       * cortados donde no va.
       */
      if (document.fonts?.ready) await document.fonts.ready;

      const blob = await dibujar(pasos, titulo);
      if (!blob) throw new Error('sin imagen');

      const archivo = new File([blob], 'cuatro-pasos.png', {
        type: 'image/png',
      });

      // El menú del teléfono es el único camino que llega a la galería. En una
      // computadora no existe y se descarga, que ahí es lo que se espera.
      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
      };
      if (nav.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title });
        setEstado('listo');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cuatro-pasos.png';
      a.click();
      URL.revokeObjectURL(url);
      setEstado('listo');
    } catch (e) {
      // Cancelar el menú de compartir tira un error igual que una falla real,
      // y no es un error: la persona decidió que no.
      if ((e as Error)?.name === 'AbortError') {
        setEstado('listo');
        return;
      }
      setEstado('error');
    }
  }

  return (
    <div className="ps-guardar">
      <button
        type="button"
        className="ps-btn"
        onClick={guardar}
        disabled={estado === 'armando'}
      >
        {estado === 'armando' ? 'Armando la imagen…' : 'Guardarlo en el teléfono'}
      </button>
      <p className="ps-guardar-nota">
        {estado === 'error'
          ? 'No se pudo armar la imagen. Sacale una captura de pantalla y queda igual.'
          : 'Queda como una imagen en tus fotos, para mirarla antes de entrar.'}
      </p>
    </div>
  );
}

/** El título de la imagen, también en el menú de compartir. */
const title = 'Cuatro pasos para una conversación difícil';

/**
 * Dibuja la imagen y la devuelve.
 *
 * En dos vueltas: la primera mide cuánto ocupa todo con el canvas a un alto
 * cualquiera, y la segunda dibuja de verdad sobre un canvas del alto exacto.
 * Medir antes evita el margen inferior de más o el texto cortado, que es lo
 * que pasa cuando el alto se estima.
 */
async function dibujar(pasos: Paso[], titulo: string): Promise<Blob | null> {
  const alto = pintar(pasos, titulo, null);
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO * ESCALA;
  lienzo.height = alto * ESCALA;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;
  ctx.scale(ESCALA, ESCALA);
  pintar(pasos, titulo, ctx);
  return new Promise((r) => lienzo.toBlob(r, 'image/png'));
}

const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";

/**
 * Escribe el texto en varios renglones y devuelve dónde quedó el cursor.
 *
 * Con `ctx` en null no dibuja nada y sólo mide, que es como se calcula el alto
 * de la imagen antes de crearla. Las dos vueltas recorren exactamente el mismo
 * código, así que no pueden dar distinto.
 */
function renglones(
  ctx: CanvasRenderingContext2D | null,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  interlinea: number,
  medidor: CanvasRenderingContext2D
): number {
  const palabras = texto.split(' ');
  let linea = '';
  let alto = y;
  for (const palabra of palabras) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (medidor.measureText(prueba).width > ancho && linea) {
      ctx?.fillText(linea, x, alto);
      alto += interlinea;
      linea = palabra;
    } else {
      linea = prueba;
    }
  }
  if (linea) {
    ctx?.fillText(linea, x, alto);
    alto += interlinea;
  }
  return alto;
}

/**
 * Pinta todo y devuelve el alto que ocupó.
 *
 * Un solo recorrido para medir y para dibujar. Si fueran dos funciones
 * distintas, cualquier cambio en una sin la otra deja la imagen con un borde
 * de más o con el pie cortado.
 */
function pintar(
  pasos: Paso[],
  titulo: string,
  ctx: CanvasRenderingContext2D | null
): number {
  /* Para medir hace falta un contexto siempre, tenga o no dónde dibujar. */
  const medidor =
    ctx ?? document.createElement('canvas').getContext('2d')!;

  const M = 72;
  const ANCHO_TEXTO = ANCHO - M * 2;
  let y = 0;

  /*
   * El orden de pintado va al revés de como se lee: primero el texto, después
   * las tarjetas debajo de él y al final el papel debajo de todo. Es lo que
   * permite dibujar una tarjeta cuyo alto recién se conoce después de haber
   * escrito lo que lleva adentro.
   */
  if (ctx) ctx.textBaseline = 'alphabetic';

  // Encabezado
  y += 96;
  medidor.font = `500 26px ${SANS}`;
  if (ctx) {
    ctx.font = medidor.font;
    ctx.fillStyle = COLOR.ambar;
    ctx.fillText('CICLO LIDERAZGOS HUMANOS', M, y);
  }

  y += 62;
  medidor.font = `400 62px ${SERIF}`;
  if (ctx) {
    ctx.font = medidor.font;
    ctx.fillStyle = COLOR.tinta;
  }
  y = renglones(ctx, titulo, M, y, ANCHO_TEXTO, 70, medidor);

  y += 20;
  medidor.font = `400 27px ${SANS}`;
  if (ctx) {
    ctx.font = medidor.font;
    ctx.fillStyle = COLOR.gris;
  }
  y = renglones(
    ctx,
    'Cuatro pasos para comunicar una mala noticia. Miralos diez minutos antes de entrar.',
    M,
    y,
    ANCHO_TEXTO,
    38,
    medidor
  );

  y += 30;

  // Los cuatro pasos, cada uno en su tarjeta
  pasos.forEach((p, i) => {
    const arriba = y;
    const P = 34;
    const xt = M + P;
    const anchoInterno = ANCHO_TEXTO - P * 2;
    let yt = arriba + P + 34;

    medidor.font = `400 30px ${SERIF}`;
    if (ctx) {
      ctx.font = medidor.font;
      ctx.fillStyle = COLOR.ambar;
      ctx.fillText(String(i + 1).padStart(2, '0'), xt, yt);
    }

    yt += 46;
    medidor.font = `400 42px ${SERIF}`;
    if (ctx) {
      ctx.font = medidor.font;
      ctx.fillStyle = COLOR.tinta;
      ctx.fillText(p.nombre, xt, yt);
    }

    yt += 46;
    medidor.font = `400 29px ${SANS}`;
    if (ctx) {
      ctx.font = medidor.font;
      ctx.fillStyle = COLOR.suave;
    }
    yt = renglones(ctx, p.que, xt, yt, anchoInterno, 42, medidor);

    // El porqué va separado por una línea, igual que en la pantalla: son dos
    // cosas distintas, qué hacer y por qué, y de un vistazo tienen que
    // distinguirse sin leerlas.
    yt += 16;
    if (ctx) {
      ctx.strokeStyle = COLOR.linea;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xt, yt);
      ctx.lineTo(xt + anchoInterno, yt);
      ctx.stroke();
    }
    yt += 38;

    medidor.font = `400 26px ${SANS}`;
    if (ctx) {
      ctx.font = medidor.font;
      ctx.fillStyle = COLOR.gris;
    }
    yt = renglones(ctx, p.porque, xt, yt, anchoInterno, 38, medidor);

    const abajo = yt - 38 + 16 + P;

    // Recién acá se sabe cuánto mide la tarjeta, porque depende de cuántos
    // renglones ocupó su texto. Va debajo de lo ya escrito.
    if (ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = COLOR.linea;
      ctx.lineWidth = 1.5;
      redondeado(ctx, M, arriba, ANCHO_TEXTO, abajo - arriba, 20);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    y = abajo + 22;
  });

  // Lo de antes y lo de después, que es lo que convierte los pasos en algo
  // que se puede hacer y no sólo leer.
  y += 22;
  for (const [rotulo, texto] of [
    [
      'Antes de entrar:',
      'escribí en tres líneas los hechos concretos, sin adjetivos. El motivo tiene que ser algo que la otra persona pueda verificar.',
    ],
    [
      'Después de darla:',
      'hacé la Respiración de 1 minuto. No sigas como si nada.',
    ],
  ]) {
    medidor.font = `600 28px ${SANS}`;
    const anchoRotulo = medidor.measureText(rotulo + ' ').width;
    if (ctx) {
      ctx.font = medidor.font;
      ctx.fillStyle = COLOR.tinta;
      ctx.fillText(rotulo, M, y);
    }
    medidor.font = `400 28px ${SANS}`;
    if (ctx) {
      ctx.font = medidor.font;
      ctx.fillStyle = COLOR.suave;
    }
    // La primera línea arranca al lado del rótulo y las que siguen desde el
    // margen, igual que un párrafo con la entrada en negrita.
    const primera = primerRenglon(
      medidor,
      texto,
      ANCHO_TEXTO - anchoRotulo
    );
    ctx?.fillText(primera, M + anchoRotulo, y);
    y += 40;
    const resto = texto.slice(primera.length).trim();
    if (resto) y = renglones(ctx, resto, M, y, ANCHO_TEXTO, 40, medidor);
    y += 14;
  }

  y += 24;
  medidor.font = `400 23px ${SANS}`;
  if (ctx) {
    ctx.font = medidor.font;
    ctx.fillStyle = COLOR.gris;
  }
  y = renglones(
    ctx,
    'Adaptado del protocolo SPIKES (Baile y otros, 2000), usado en medicina para comunicar diagnósticos graves.',
    M,
    y,
    ANCHO_TEXTO,
    34,
    medidor
  );

  y += 26;
  medidor.font = `500 24px ${SANS}`;
  if (ctx) {
    ctx.font = medidor.font;
    ctx.fillStyle = COLOR.ambar;
    ctx.fillText('camposhr.com/pasos', M, y);
  }

  const alto = y + 62;

  // El papel, debajo de todo lo demás.
  if (ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = COLOR.papel;
    ctx.fillRect(0, 0, ANCHO, alto);
    ctx.restore();
  }

  return alto;
}

/** Lo que entra en el primer renglón, para el párrafo con rótulo. */
function primerRenglon(
  medidor: CanvasRenderingContext2D,
  texto: string,
  ancho: number
): string {
  const palabras = texto.split(' ');
  let linea = '';
  for (const palabra of palabras) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (medidor.measureText(prueba).width > ancho && linea) break;
    linea = prueba;
  }
  return linea;
}

/** Rectángulo con las esquinas redondeadas, para las tarjetas. */
function redondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  radio: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
  ctx.arcTo(x, y + alto, x, y, radio);
  ctx.arcTo(x, y, x + ancho, y, radio);
  ctx.closePath();
}
