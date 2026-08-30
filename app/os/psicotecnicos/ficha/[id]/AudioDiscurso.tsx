'use client';

/**
 * La grabación de los cinco minutos: se sube acá y se escucha acá.
 *
 * Es el material del que sale el estrato de la persona. En la hoja de la
 * entrevista se arrastra el archivo apenas termina de grabarse, y en la pestaña
 * Potencial se escucha para elegir el modo, sin salir de la pantalla donde se
 * elige.
 *
 * **Un wav grande se achica antes de subirlo.** Cinco minutos de voz en mp3 o
 * m4a pesan dos o tres megas, pero en wav sin comprimir pasan de cincuenta. Se
 * baja a un canal y a 16 kHz, que es de sobra para escuchar cómo alguien arma
 * una frase, y queda en menos de diez.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** A partir de acá vale la pena achicar un wav. */
const GRANDE = 8 * 1024 * 1024;
const DESTINO = 16000;

/**
 * Con qué se graba desde la pantalla.
 *
 * Opus a 32 kbps: cinco minutos de voz pesan poco más de un mega y se escuchan
 * perfectos, que es todo lo que hace falta para leer cómo alguien arma una
 * frase. Safari no graba webm, así que cae en mp4 con aac.
 */
const FORMATOS_GRABAR = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const BITS = 32000;
/** Un tope por si alguien la deja grabando: media hora y corta sola. */
const TOPE_SEGUNDOS = 30 * 60;

function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pesa(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** El buffer de audio, escrito como wav de un canal y 16 bits. */
function comoWav(buffer: AudioBuffer): Blob {
  const muestras = buffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + muestras.length * 2);
  const v = new DataView(bytes);
  const texto = (donde: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(donde + i, s.charCodeAt(i));
  };
  texto(0, 'RIFF');
  v.setUint32(4, 36 + muestras.length * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, muestras.length * 2, true);
  for (let i = 0; i < muestras.length; i++) {
    const m = Math.max(-1, Math.min(1, muestras[i]));
    v.setInt16(44 + i * 2, m < 0 ? m * 0x8000 : m * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

/** Un wav grande, a un canal y 16 kHz. Lo demás pasa como vino. */
async function achicar(archivo: File): Promise<File> {
  const esWav = /\.wav$/i.test(archivo.name) || archivo.type === 'audio/wav';
  if (!esWav || archivo.size <= GRANDE) return archivo;
  try {
    const ctx = new AudioContext();
    const crudo = await ctx.decodeAudioData(await archivo.arrayBuffer());
    await ctx.close();
    const off = new OfflineAudioContext(1, Math.round(crudo.duration * DESTINO), DESTINO);
    const fuente = off.createBufferSource();
    fuente.buffer = crudo;
    fuente.connect(off.destination);
    fuente.start();
    const mono = await off.startRendering();
    const nombre = archivo.name.replace(/\.wav$/i, '') + '.wav';
    return new File([comoWav(mono)], nombre, { type: 'audio/wav' });
  } catch {
    // Si el navegador no lo puede decodificar, se sube como vino y que lo
    // rechace el tamaño, que es un aviso más claro que un error de audio.
    return archivo;
  }
}

export default function AudioDiscurso({
  id,
  persona,
  nombre,
  bytes,
  enlace,
  puedeCambiar = true,
  puedeGrabar = false,
}: {
  id: string;
  /** De quién es, para nombrar el archivo que se graba. */
  persona?: string | null;
  /** El nombre del archivo que ya está subido, si hay. */
  nombre: string | null;
  bytes: number | null;
  /** El enlace firmado para escucharlo, si hay. */
  enlace: string | null;
  /** Si desde acá se puede subir, cambiar o sacar la grabación. */
  puedeCambiar?: boolean;
  /**
   * Si desde acá se puede grabar con el micrófono.
   *
   * Solo en la hoja de la entrevista: es donde la persona está sentada
   * hablando. Codificando, lo que hace falta es escucharla.
   */
  puedeGrabar?: boolean;
}) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const grabadora = useRef<MediaRecorder | null>(null);

  /* El cronómetro corre mientras graba, y corta sola en el tope. */
  useEffect(() => {
    if (!grabando) return;
    const t = setInterval(() => {
      setSegundos((s) => {
        if (s + 1 >= TOPE_SEGUNDOS) grabadora.current?.stop();
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [grabando]);

  /** El nombre con el que se guarda lo que se graba. */
  function comoSeLlama(ext: string): string {
    const palabras = (persona ?? '').trim().split(/\s+/).filter(Boolean);
    const apellido = palabras.length ? palabras[palabras.length - 1].toLowerCase() : '';
    return `${apellido ? `${apellido} ` : ''}discurso.${ext}`;
  }

  /**
   * Arranca a grabar sobre un stream ya armado.
   *
   * Es común a las dos formas de grabar: con el micrófono, cuando la persona
   * está sentada enfrente, y con el sonido de una pestaña, cuando la entrevista
   * es por videollamada. Lo que cambia es de dónde sale el sonido; lo que se
   * hace con él es lo mismo.
   */
  function arrancar(stream: MediaStream, cerrar: () => void) {
    const tipo = FORMATOS_GRABAR.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, {
      ...(tipo ? { mimeType: tipo } : {}),
      audioBitsPerSecond: BITS,
    });
    const trozos: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.push(e.data);
    };
    rec.onstop = async () => {
      cerrar();
      setGrabando(false);
      const tipoFinal = rec.mimeType || tipo || 'audio/webm';
      const ext = tipoFinal.includes('mp4') ? 'm4a' : 'webm';
      const blob = new Blob(trozos, { type: tipoFinal.split(';')[0] });
      if (blob.size < 1000) {
        setError('La grabación quedó vacía. Revisá que el micrófono esté habilitado.');
        return;
      }
      await subir(new File([blob], comoSeLlama(ext), { type: blob.type }));
    };
    grabadora.current = rec;
    setSegundos(0);
    setGrabando(true);
    rec.start(1000);
  }

  /**
   * Graba con el micrófono de la máquina.
   *
   * Es el camino corto: la evaluadora está sentada con la persona, aprieta y al
   * terminar el archivo ya queda subido. Lo que sale pesa poco más de un mega,
   * así que no hace falta achicar nada después.
   */
  async function grabar() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      arrancar(stream, () => stream.getTracks().forEach((t) => t.stop()));
    } catch {
      setError(
        'No se pudo usar el micrófono. Hay que darle permiso al navegador, y la página tiene que estar en https.'
      );
    }
  }

  /**
   * Graba una videollamada: el sonido de una pestaña más el micrófono.
   *
   * El micrófono capta lo que se dice de este lado y nunca lo que suena en la
   * computadora. Para una entrevista por Zoom o Meet, el navegador puede
   * entregar el sonido de una pestaña compartida: se pide, se mezcla con el
   * micrófono en un solo canal y eso es lo que se graba.
   *
   * Chrome solo ofrece el audio de una pestaña cuando también se pide video, y
   * solo si quien comparte marca "compartir audio de la pestaña". El video se
   * descarta enseguida: lo que se guarda es una grabación de sonido.
   */
  async function grabarLlamada() {
    setError(null);
    try {
      const pantalla = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      if (pantalla.getAudioTracks().length === 0) {
        pantalla.getTracks().forEach((t) => t.stop());
        setError(
          'Esa pestaña se compartió sin sonido. Al elegirla hay que marcar "Compartir audio de la pestaña".'
        );
        return;
      }
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);

      /* Las dos fuentes en un solo canal: la pestaña trae a la persona y el
         micrófono a quien entrevista. */
      const ctx = new AudioContext();
      const mezcla = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(new MediaStream(pantalla.getAudioTracks())).connect(mezcla);
      if (mic) ctx.createMediaStreamSource(mic).connect(mezcla);

      const cerrar = () => {
        pantalla.getTracks().forEach((t) => t.stop());
        mic?.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => null);
      };
      // Si deja de compartir desde la barra de Chrome, la grabación termina.
      pantalla.getVideoTracks()[0]?.addEventListener('ended', () => grabadora.current?.stop());
      arrancar(mezcla.stream, cerrar);
    } catch {
      setError('No se pudo compartir el sonido de la pestaña.');
    }
  }

  function detener() {
    grabadora.current?.stop();
  }

  async function subir(archivo: File) {
    setError(null);
    setSubiendo(true);
    try {
      const listo = await achicar(archivo);
      const form = new FormData();
      form.append('evaluacionId', id);
      form.append('archivo', listo);
      const res = await fetch('/api/os/discurso-audio', { method: 'POST', body: form });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo subir.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir.');
    } finally {
      setSubiendo(false);
    }
  }

  async function sacar() {
    setError(null);
    setSubiendo(true);
    try {
      const res = await fetch(`/api/os/discurso-audio?id=${id}`, { method: 'DELETE' });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo borrar.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.');
    } finally {
      setSubiendo(false);
    }
  }

  if (enlace) {
    return (
      <div className="os-audio">
        <audio className="os-audio-player" controls preload="none" src={enlace} />
        <p className="os-audio-pie">
          {nombre ?? 'Grabación'}
          {bytes ? ` · ${pesa(bytes)}` : ''}
          {puedeCambiar && (
            <>
              {' · '}
              {puedeGrabar && (
                <>
                  <button
                    type="button"
                    className="os-enlace-pelado"
                    onClick={grabando ? detener : grabar}
                  >
                    {grabando ? `detener (${reloj(segundos)})` : 'grabar otra'}
                  </button>
                  {' · '}
                </>
              )}
              <button type="button" className="os-enlace-pelado" onClick={() => campo.current?.click()}>
                subir otra
              </button>
              {' · '}
              <button type="button" className="os-enlace-pelado" onClick={sacar} disabled={subiendo}>
                sacarla
              </button>
            </>
          )}
        </p>
        {puedeCambiar && (
          <input
            ref={campo}
            className="os-oculto"
            type="file"
            accept="audio/*,.m4a,.mp3,.aac,.ogg,.opus,.webm,.wav"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) subir(f);
            }}
          />
        )}
        {error && <p className="os-form-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="os-audio">
      {/* El reproductor está siempre, aunque todavía no haya nada que oír: es
          el lugar de la grabación, y apareciendo recién cuando se sube la
          pantalla se reacomodaba entera. Sin archivo, el navegador lo dibuja
          apagado. */}
      <audio className="os-audio-player" controls preload="none" />

      {/* Grabar desde acá es el camino corto: la evaluadora está sentada con la
          persona y al terminar el archivo ya queda subido. Arrastrar sirve para
          cuando grabó con el teléfono. */}
      {puedeGrabar && (
      <div className="os-grabador">
        {/* Los dos caminos, dichos por lo que son: la persona enfrente o la
            persona del otro lado de una llamada. */}
        <button
          type="button"
          className={`os-boton os-boton-grabar${grabando ? ' os-grabando' : ''}`}
          onClick={grabando ? detener : grabar}
          disabled={subiendo}
        >
          {grabando ? `Detener · ${reloj(segundos)}` : 'Grabar presencial'}
        </button>
        {!grabando && (
          <button
            type="button"
            className="os-boton os-boton-grabar"
            onClick={grabarLlamada}
            disabled={subiendo}
          >
            Grabar videollamada
          </button>
        )}
        {grabando && <small>Grabando. Al detener se sube sola.</small>}
      </div>
      )}

      {puedeCambiar && (
      <div
        className={`os-caja-audio${encima ? ' encima' : ''}${subiendo ? ' ocupada' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          const f = e.dataTransfer.files?.[0];
          if (f) subir(f);
        }}
        onClick={() => campo.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') campo.current?.click();
        }}
      >
        <strong>
          {subiendo
            ? 'Subiendo…'
            : puedeGrabar
              ? 'O arrastrá acá la grabación'
              : 'Arrastrá acá la grabación'}
        </strong>
        <small>
          O hacé clic para elegirla. Sirven m4a, mp3, aac, ogg, opus, webm y wav, hasta 25 MB.
          Un wav grande se achica antes de subirlo.
        </small>
      </div>
      )}
      <input
        ref={campo}
        className="os-oculto"
        type="file"
        accept="audio/*,.m4a,.mp3,.aac,.ogg,.opus,.webm,.wav"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) subir(f);
        }}
      />
      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
