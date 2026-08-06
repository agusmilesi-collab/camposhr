'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * El teléfono del asistente.
 *
 * Muestra la actividad que está abierta en este momento y nada más. Sin menú y
 * sin lista: una lista de diez actividades a la vista es una invitación a
 * adelantarse, y "vayan a la 3" siempre termina con alguien en la 4.
 */

type TipoActividad = 'palabra' | 'opcion' | 'escala' | 'texto' | 'marcas' | 'enlace';

type ActividadPublica = {
  id: string;
  clave: string;
  tipo: TipoActividad;
  titulo: string;
  enunciado: string | null;
  opciones: string[];
};

type Valor =
  | { tipo: 'palabra'; palabra: string }
  | { tipo: 'opcion'; opcion: number }
  | { tipo: 'escala'; escala: number }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'marcas'; marcas: number[] };

type Estado = {
  actividad: ActividadPublica | null;
  respondida: boolean;
  mio: Valor | null;
  total: number;
};

export type Cara = {
  id: string;
  nombre: string;
  apellido: string;
  foto: string | null;
  /** Ya entró desde algún teléfono: su cara sale de la grilla. */
  entro: boolean;
};

/** Cada cuánto el teléfono pregunta si hay algo abierto. */
const SONDEO_MS = 4000;

export default function Asistente({
  slug,
  empresa,
  caras,
}: {
  slug: string;
  empresa: string;
  caras: Cara[];
}) {
  const [yo, setYo] = useState<{ id: string; nombre: string } | null>(null);
  const [listo, setListo] = useState(false);
  const [pantalla, setPantalla] = useState<'inicio' | 'registro' | 'elegir'>('inicio');
  const [estado, setEstado] = useState<Estado | null>(null);

  const guardado = `ciclo:${slug}`;

  // --- Sesión: la marca del navegador, y la grilla de caras como respaldo ---
  useEffect(() => {
    try {
      const id = localStorage.getItem(guardado);
      // Se valida contra la lista real: si la persona se borró de la base o la
      // marca quedó de otro ciclo, vuelve a la entrada en vez de romperse.
      const cara = id ? caras.find((c) => c.id === id) : null;
      if (cara) setYo({ id: cara.id, nombre: cara.nombre });
    } catch {
      // Navegador sin almacenamiento: entra por la grilla de caras.
    }
    setListo(true);
  }, [guardado, caras]);

  const entrar = useCallback(
    (id: string, nombre: string) => {
      try {
        localStorage.setItem(guardado, id);
      } catch {
        // Si no se puede guardar, funciona igual mientras no cierre la pestaña.
      }
      setYo({ id, nombre });
    },
    [guardado]
  );

  /**
   * Volver a la grilla, para el que tocó la cara del compañero.
   *
   * No borra nada de lo que haya respondido: lo que ya se guardó quedó a
   * nombre de quien figuraba, y se corrige desde el control. Acá lo único que
   * cambia es con quién sigue este teléfono.
   */
  const salir = useCallback(() => {
    try {
      localStorage.removeItem(guardado);
    } catch {
      // Sin almacenamiento la sesión ya vivía solo en memoria.
    }
    setEstado(null);
    setYo(null);
    setPantalla(caras.length > 0 ? 'elegir' : 'inicio');
  }, [guardado, caras.length]);

  // --- Sondeo de la actividad abierta ---
  useEffect(() => {
    if (!yo) return;
    let vivo = true;

    async function mirar() {
      try {
        const res = await fetch(
          `/api/ciclo/${slug}/estado?asistente=${encodeURIComponent(yo!.id)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const json = (await res.json()) as Estado;
        if (vivo) setEstado(json);
      } catch {
        // Sin conexión: se queda con lo último que vio y reintenta solo.
      }
    }

    mirar();
    const id = setInterval(mirar, SONDEO_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [yo, slug]);

  if (!listo) return null;

  // ------------------------------------------------------------- sin sesión
  if (!yo) {
    return (
      <div className="ci">
        <Encabezado empresa={empresa} />
        <main className="ci-main">
          {pantalla === 'inicio' && (
            <section className="cq-placa">
              <h1 className="ci-titulo">Hola</h1>
              <p className="cq-ayuda">
                Desde acá vas a responder algunas de las consignas del encuentro.
              </p>
              <div className="ci-acciones">
                <button className="cq-btn" onClick={() => setPantalla('registro')}>
                  Es mi primer encuentro
                </button>
                <button
                  className="cq-btn-ghost"
                  onClick={() => setPantalla('elegir')}
                  disabled={caras.length === 0}
                >
                  Ya vine antes
                </button>
              </div>
            </section>
          )}

          {pantalla === 'registro' && (
            <Registro
              slug={slug}
              onListo={entrar}
              onVolver={() => setPantalla('inicio')}
            />
          )}

          {pantalla === 'elegir' && (
            <Grilla
              caras={caras}
              onElegir={(c) => entrar(c.id, c.nombre)}
              onVolver={() => setPantalla('inicio')}
            />
          )}
        </main>
      </div>
    );
  }

  // ------------------------------------------------------------- en la sala
  return (
    <div className="ci">
      <Encabezado empresa={empresa} nombre={yo.nombre} onSalir={salir} />
      <main className="ci-main">
        {!estado?.actividad ? (
          <section className="cq-placa ci-espera">
            <p className="ci-espera-punto" aria-hidden="true" />
            <h1 className="ci-titulo">Guardá el teléfono</h1>
            <p className="cq-ayuda">
              Cuando haya algo para responder, aparece solo en esta pantalla.
            </p>
          </section>
        ) : (
          <Formulario
            key={estado.actividad.id}
            slug={slug}
            asistenteId={yo.id}
            actividad={estado.actividad}
            respondida={estado.respondida}
            mio={estado.mio}
            onGuardado={(valor) =>
              setEstado((e) => (e ? { ...e, respondida: true, mio: valor } : e))
            }
          />
        )}
      </main>
    </div>
  );
}

function Encabezado({
  empresa,
  nombre,
  onSalir,
}: {
  empresa: string;
  nombre?: string;
  onSalir?: () => void;
}) {
  return (
    <header className="cq-top">
      <div className="cq-top-inner">
        <span className="brand">
          Campos HR <span>· encuentro</span>
        </span>
        {/* La empresa siempre, y quién está respondiendo cuando ya entró: el
            teléfono queda abierto toda la charla y de un vistazo se ve que es
            el encuentro correcto y que la sesión es la propia. El nombre se
            toca para volver a la grilla: es donde mira el que entró con la
            cara equivocada. */}
        <span className="cq-empresa">
          {nombre && onSalir && (
            <button className="cq-nosoy" onClick={onSalir}>
              No soy {nombre}
            </button>
          )}
          <span className="cq-empresa-linea">
            {empresa}
            {nombre && <b>{nombre}</b>}
          </span>
        </span>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------ registro

function Registro({
  slug,
  onListo,
  onVolver,
}: {
  slug: string;
  onListo: (id: string, nombre: string) => void;
  onVolver: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const completo = nombre.trim().length >= 2 && apellido.trim().length >= 2;

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    try {
      const reducida = await reducirImagen(archivo);
      setFoto({ blob: reducida, url: URL.createObjectURL(reducida) });
    } catch {
      setError('No pudimos procesar la foto. Podés seguir sin ella.');
    }
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const datos = new FormData();
      datos.append('nombre', nombre.trim());
      datos.append('apellido', apellido.trim());
      if (foto) datos.append('foto', foto.blob, 'selfie.jpg');

      const res = await fetch(`/api/ciclo/${slug}/registro`, {
        method: 'POST',
        body: datos,
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      onListo(json.asistente.id, json.asistente.nombre);
    } catch {
      setError('No pudimos registrarte. Probá de nuevo en unos segundos.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="cq-placa">
      <h1 className="ci-titulo">¿Cómo te llamás?</h1>
      <p className="cq-ayuda">Se carga una sola vez, para los cinco encuentros.</p>

      <div className="cq-campos">
        <label className="cq-campo-doble">
          <span>Nombre</span>
          <input
            className="cq-input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
          />
        </label>
        <label className="cq-campo-doble">
          <span>Apellido</span>
          <input
            className="cq-input"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
          />
        </label>
      </div>

      <div className="cq-selfie">
        <div className="cq-selfie-preview">
          {foto ? <img src={foto.url} alt="Tu foto" /> : <span>Sin foto</span>}
        </div>
        <div className="cq-selfie-texto">
          <strong>Sacate una selfie</strong>
          <p>
            Es lo que te va a permitir entrar en el próximo encuentro sin cargar
            nada de nuevo.
          </p>
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            capture="user"
            onChange={elegirFoto}
            hidden
          />
          <button className="cq-btn-ghost" onClick={() => inputFoto.current?.click()}>
            {foto ? 'Sacar otra' : 'Sacarme la foto'}
          </button>
        </div>
      </div>

      {error && <p className="cq-error">{error}</p>}

      <div className="ci-acciones">
        <button className="cq-btn" disabled={!completo || enviando} onClick={enviar}>
          {enviando ? 'Un segundo…' : 'Entrar'}
        </button>
        <button className="cq-btn-ghost" onClick={onVolver}>
          Volver
        </button>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ grilla de caras

function Grilla({
  caras,
  onElegir,
  onVolver,
}: {
  caras: Cara[];
  onElegir: (c: Cara) => void;
  onVolver: () => void;
}) {
  // Los que ya entraron desde su teléfono salen de la lista: con treinta caras,
  // las que no corresponden son ruido para el que todavía busca la suya.
  const [todas, setTodas] = useState(false);
  const pendientes = caras.filter((c) => !c.entro);
  const visibles = todas || pendientes.length === 0 ? caras : pendientes;
  const escondidas = caras.length - visibles.length;

  return (
    <section className="cq-placa">
      <h1 className="ci-titulo">Tocá tu foto</h1>
      <p className="cq-ayuda">Así entrás sin volver a cargar tus datos.</p>

      <div className="ci-caras">
        {visibles.map((c) => (
          <button key={c.id} className="ci-cara" onClick={() => onElegir(c)}>
            <span className="ci-cara-foto">
              {c.foto ? (
                <img src={c.foto} alt="" />
              ) : (
                <span className="ci-cara-iniciales">
                  {(c.nombre[0] ?? '') + (c.apellido[0] ?? '')}
                </span>
              )}
            </span>
            {/* Apellido primero, que es por donde está ordenada la lista:
                con treinta caras se busca recorriendo la inicial. */}
            <span className="ci-cara-nombre">
              <b>{c.apellido}</b>
              {c.nombre}
            </span>
          </button>
        ))}
      </div>

      <div className="ci-acciones">
        {escondidas > 0 && (
          /* El que cambió de teléfono o entró por error con otra cara: su
             nombre ya figura como adentro y sin esto no tendría cómo volver. */
          <button className="cq-btn-ghost" onClick={() => setTodas(true)}>
            No veo mi foto
          </button>
        )}
        <button className="cq-btn-ghost" onClick={onVolver}>
          No estoy en la lista
        </button>
      </div>
    </section>
  );
}

// --------------------------------------------------------------- formularios

function Formulario({
  slug,
  asistenteId,
  actividad,
  respondida,
  mio,
  onGuardado,
}: {
  slug: string;
  asistenteId: string;
  actividad: ActividadPublica;
  respondida: boolean;
  mio: Valor | null;
  onGuardado: (valor: Valor) => void;
}) {
  const [palabra, setPalabra] = useState('');
  const [texto, setTexto] = useState('');
  const [marcas, setMarcas] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);

  const cerrado = respondida && !corrigiendo;

  async function enviar(valor: Valor) {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ciclo/${slug}/aporte`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actividadId: actividad.id, asistenteId, valor }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCorrigiendo(false);
      onGuardado(valor);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg && msg.length < 80 ? msg : 'No pudimos guardarlo. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (cerrado) {
    return (
      <section className="cq-placa ci-listo">
        <p className="ci-tilde" aria-hidden="true">
          ✓
        </p>
        <h1 className="ci-titulo">Listo</h1>
        <p className="cq-ayuda">{resumenPropio(mio, actividad)}</p>
        <div className="ci-acciones">
          <button className="cq-btn-ghost" onClick={() => setCorrigiendo(true)}>
            Cambiar mi respuesta
          </button>
        </div>
        <p className="ci-guardar">Ya podés guardar el teléfono.</p>
      </section>
    );
  }

  return (
    <section className="cq-placa">
      <h1 className="ci-titulo">{actividad.titulo}</h1>
      {actividad.enunciado && <p className="cq-ayuda">{actividad.enunciado}</p>}

      {actividad.tipo === 'enlace' && (
        <div className="ci-acciones">
          <a
            className="cq-btn ci-enlace"
            /* La actividad es la misma para todos los clientes, así que la
               dirección lleva {cliente} y se completa con el de esta corrida.
               Escrita con un cliente adentro, todos terminarían respondiendo
               el cuestionario del primero. */
            href={(actividad.opciones[0] ?? '#').replace('{cliente}', slug)}
            target="_blank"
            rel="noreferrer"
          >
            Abrir
          </a>
          <p className="ci-anonimo">
            Se abre en otra pestaña. Cuando termines, volvé acá.
          </p>
        </div>
      )}

      {actividad.tipo === 'palabra' && (
        <>
          <input
            className="cq-input ci-input-grande"
            value={palabra}
            onChange={(e) => setPalabra(e.target.value)}
            placeholder="Una palabra"
            autoFocus
            maxLength={24}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && palabra.trim().length >= 2) {
                enviar({ tipo: 'palabra', palabra: palabra.trim() });
              }
            }}
          />
          <div className="ci-acciones">
            <button
              className="cq-btn"
              disabled={palabra.trim().length < 2 || enviando}
              onClick={() => enviar({ tipo: 'palabra', palabra: palabra.trim() })}
            >
              Enviar
            </button>
          </div>
        </>
      )}

      {actividad.tipo === 'opcion' && (
        <div className="ci-opciones">
          {actividad.opciones.map((o, i) => (
            <button
              key={i}
              className="cq-opcion ci-opcion"
              disabled={enviando}
              onClick={() => enviar({ tipo: 'opcion', opcion: i })}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {actividad.tipo === 'escala' && (
        <div className="ci-escala">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className="ci-escala-boton"
              disabled={enviando}
              onClick={() => enviar({ tipo: 'escala', escala: n })}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {actividad.tipo === 'texto' && (
        <>
          <textarea
            className="cq-input ci-textarea"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            maxLength={400}
            autoFocus
          />
          <p className="ci-anonimo">
            Se proyecta sin tu nombre. Nadie va a saber cuál escribiste vos.
          </p>
          <div className="ci-acciones">
            <button
              className="cq-btn"
              disabled={texto.trim().length < 3 || enviando}
              onClick={() => enviar({ tipo: 'texto', texto: texto.trim() })}
            >
              Enviar
            </button>
          </div>
        </>
      )}

      {actividad.tipo === 'marcas' && (
        <>
          <div className="ci-opciones">
            {actividad.opciones.map((o, i) => (
              <button
                key={i}
                className={`cq-opcion ci-opcion ${marcas.includes(i) ? 'cq-opcion-on' : ''}`}
                onClick={() =>
                  setMarcas((m) =>
                    m.includes(i) ? m.filter((x) => x !== i) : [...m, i]
                  )
                }
              >
                {o}
              </button>
            ))}
          </div>
          <div className="ci-acciones">
            <button
              className="cq-btn"
              disabled={marcas.length === 0 || enviando}
              onClick={() => enviar({ tipo: 'marcas', marcas })}
            >
              Enviar
            </button>
          </div>
        </>
      )}

      {error && <p className="cq-error">{error}</p>}
    </section>
  );
}

/** Lo que la persona respondió, para que se reconozca sin tener que recordarlo. */
function resumenPropio(mio: Valor | null, actividad: ActividadPublica): string {
  if (!mio) return 'Tu respuesta quedó guardada.';
  switch (mio.tipo) {
    case 'palabra':
      return `Pusiste "${mio.palabra}".`;
    case 'opcion':
      return `Elegiste "${actividad.opciones[mio.opcion] ?? '—'}".`;
    case 'escala':
      return `Elegiste ${mio.escala}.`;
    case 'texto':
      return 'Tu respuesta quedó guardada, sin tu nombre.';
    case 'marcas':
      return `Marcaste ${mio.marcas.length} ${
        mio.marcas.length === 1 ? 'opción' : 'opciones'
      }.`;
    default:
      return 'Tu respuesta quedó guardada.';
  }
}

/**
 * Misma reducción que en el cuestionario: cuadrado de 640 px y JPEG, recortado
 * un poco más arriba del centro porque en una selfie la cara queda en la mitad
 * de arriba. Evita subir 5 MB desde el celular con el wifi de la sala.
 */
async function reducirImagen(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const lado = Math.min(bitmap.width, bitmap.height);
  const desdeX = (bitmap.width - lado) / 2;
  const desdeY = (bitmap.height - lado) * 0.22;

  const salida = Math.min(640, lado);
  const canvas = document.createElement('canvas');
  canvas.width = salida;
  canvas.height = salida;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sin canvas');
  ctx.drawImage(bitmap, desdeX, desdeY, lado, lado, 0, 0, salida, salida);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('sin blob'))),
      'image/jpeg',
      0.82
    );
  });
}
