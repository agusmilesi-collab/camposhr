'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Cuestionario from '@/app/c/[slug]/Cuestionario';
import { DIAS, partirOpcion } from '@/lib/opciones';
import { APORTA, ENTRE, type Perfil } from '@/lib/perfiles';

/**
 * El teléfono del asistente.
 *
 * Muestra la actividad que está abierta en este momento y nada más. Sin menú y
 * sin lista: una lista de diez actividades a la vista es una invitación a
 * adelantarse, y "vayan a la 3" siempre termina con alguien en la 4.
 */

type TipoActividad =
  | 'palabra'
  | 'opcion'
  | 'escala'
  | 'texto'
  | 'marcas'
  | 'enlace'
  | 'cuestionario'
  | 'plan'
  | 'cruce';

/** Quién está respondiendo desde este teléfono. */
type Yo = { id: string; nombre: string; apellido: string };

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
  | { tipo: 'marcas'; marcas: number[] }
  | { tipo: 'plan'; dias: number[]; hora: string; texto: string };

/** Con quién le toca juntarse, en la consigna de consultar una decisión. */
type Cruce = {
  miPerfil: { corto: string; nombre: string } | null;
  con: {
    nombre: string;
    apellido: string;
    foto: string | null;
    perfil: { corto: string; nombre: string; descripcion: string } | null;
    motivo: 'diagonal' | 'distinto' | 'mismo' | 'sin-perfil';
  }[];
};

/** Una de las que se abrieron juntas, con lo que esta persona ya respondió. */
type EnFila = ActividadPublica & { respondida: boolean; mio: Valor | null };

type Estado = {
  actividad: ActividadPublica | null;
  respondida: boolean;
  mio: Valor | null;
  total: number;
  /** Las que se abren de una sola vez y se responden seguidas. */
  grupo: EnFila[] | null;
  cruce: Cruce | null;
};

export type Cara = {
  id: string;
  nombre: string;
  apellido: string;
  foto: string | null;
  /** Ya entró desde algún teléfono: su cara sale de la grilla. */
  entro: boolean;
};

/**
 * Cada cuánto el teléfono pregunta si hay algo abierto.
 *
 * Son treinta teléfonos preguntando a la vez, así que cada segundo que se le
 * saca al intervalo se multiplica por treinta contra la base. Doce segundos es
 * lo que tarda la expositora en terminar de decir la consigna: para la persona
 * la pantalla igual aparece sola.
 */
const SONDEO_MS = 12000;

/**
 * Consignas que la persona lee en voz alta después de responder.
 *
 * Sólo en estas el teléfono deja lo escrito a la vista. En el resto la
 * pantalla confirma y nada más: lo que se responde ahí se proyecta anónimo y
 * dejarlo puesto invita a compararse con el de al lado.
 */
const SE_LEEN_EN_VOZ_ALTA = new Set(['c1-momento']);

export default function Asistente({
  slug,
  empresa,
  caras,
}: {
  slug: string;
  empresa: string;
  caras: Cara[];
}) {
  const [yo, setYo] = useState<Yo | null>(null);
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
      if (cara) setYo({ id: cara.id, nombre: cara.nombre, apellido: cara.apellido });
    } catch {
      // Navegador sin almacenamiento: entra por la grilla de caras.
    }
    setListo(true);
  }, [guardado, caras]);

  const entrar = useCallback(
    (id: string, nombre: string, apellido: string) => {
      try {
        localStorage.setItem(guardado, id);
      } catch {
        // Si no se puede guardar, funciona igual mientras no cierre la pestaña.
      }
      setYo({ id, nombre, apellido });
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
    let primero = true;

    async function mirar() {
      try {
        // La marca de que entró se escribe sólo en el primer sondeo: después
        // ya está escrita y repetirla es una escritura por teléfono cada vez.
        const res = await fetch(
          `/api/ciclo/${slug}/estado?asistente=${encodeURIComponent(yo!.id)}` +
            (primero ? '&entrando=1' : ''),
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const json = (await res.json()) as Estado;
        primero = false;
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
              onElegir={(c) => entrar(c.id, c.nombre, c.apellido)}
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
          <Fila
            key={estado.actividad.id}
            slug={slug}
            empresa={empresa}
            yo={yo}
            estado={estado}
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
        {/* La marca con el encuentro y quién está respondiendo, todo del mismo
            lado: la salida queda sola a la derecha y se toca sin apuntar. */}
        <span className="cq-quien">
          <span className="brand">
            Campos HR <span>· encuentro</span>
          </span>
          <span className="cq-empresa">
            {empresa}
            {nombre && <b>{nombre}</b>}
          </span>
        </span>
        {nombre && onSalir && (
          <button className="cq-nosoy" onClick={onSalir}>
            No soy {nombre}
          </button>
        )}
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
  onListo: (id: string, nombre: string, apellido: string) => void;
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
      onListo(json.asistente.id, json.asistente.nombre, json.asistente.apellido);
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

/**
 * Las actividades que se abrieron juntas, una atrás de la otra.
 *
 * La expositora abre una sola vez y cada uno avanza a su ritmo. Con cinco
 * consignas seguidas, habilitarlas de a una obligaría a estar mirando el
 * teléfono en vez de dictar, y el grupo esperaría a que todos terminen cada
 * pregunta antes de pasar a la siguiente.
 *
 * Cada consigna guarda su respuesta por separado, así que las placas y los
 * contadores siguen contando de a una.
 */
function Fila({
  slug,
  empresa,
  yo,
  estado,
}: {
  slug: string;
  empresa: string;
  yo: Yo;
  estado: Estado;
}) {
  const sueltas: EnFila[] = estado.actividad
    ? [
        {
          ...estado.actividad,
          respondida: estado.respondida,
          mio: estado.mio,
        },
      ]
    : [];
  const todas = estado.grupo?.length ? estado.grupo : sueltas;

  /** Lo que va respondiendo en esta pantalla, sin esperar al sondeo. */
  const [respondidas, setRespondidas] = useState<Record<string, Valor>>({});
  const listo = (a: EnFila) => Boolean(respondidas[a.id]) || a.respondida;

  // Retoma donde quedó: el que llega tarde o recarga la página no vuelve a
  // empezar por la primera.
  const pendiente = todas.find((a) => !listo(a));
  const actual = pendiente ?? todas[todas.length - 1];
  if (!actual) return null;

  const numero = todas.indexOf(actual) + 1;

  return (
    <>
      {todas.length > 1 && (
        <p className="ci-paso">
          {numero} de {todas.length}
        </p>
      )}
      <Formulario
        key={actual.id}
        slug={slug}
        empresa={empresa}
        yo={yo}
        asistenteId={yo.id}
        actividad={actual}
        respondida={listo(actual)}
        mio={respondidas[actual.id] ?? actual.mio}
        cruce={estado.cruce}
        onGuardado={(valor) =>
          setRespondidas((r) => ({ ...r, [actual.id]: valor }))
        }
      />
    </>
  );
}

function Formulario({
  slug,
  empresa,
  yo,
  asistenteId,
  actividad,
  respondida,
  mio,
  cruce,
  onGuardado,
}: {
  slug: string;
  empresa: string;
  yo: Yo;
  asistenteId: string;
  actividad: ActividadPublica;
  respondida: boolean;
  mio: Valor | null;
  cruce: Cruce | null;
  onGuardado: (valor: Valor) => void;
}) {
  const [palabra, setPalabra] = useState('');
  const [texto, setTexto] = useState('');
  const [marcas, setMarcas] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  /** La que se acaba de tocar, mientras el envío está en camino. */
  const [tocada, setTocada] = useState<number | null>(null);
  const [dias, setDias] = useState<number[]>([]);
  const [hora, setHora] = useState('');

  const cerrado = respondida && !corrigiendo;

  async function enviar(valor: Valor) {
    setEnviando(true);
    setError(null);
    // Treinta teléfonos respondiendo en el mismo minuto hacen que alguno se
    // tope con la base ocupada. Con un solo intento eso deja a esa persona
    // parada en la consigna mientras la charla sigue, así que reintenta.
    const ESPERAS = [0, 1200, 3000];
    let ultimo = 'No pudimos guardarlo. Probá de nuevo.';
    for (const espera of ESPERAS) {
      if (espera) await new Promise((r) => setTimeout(r, espera));
      try {
        const res = await fetch(`/api/ciclo/${slug}/aporte`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ actividadId: actividad.id, asistenteId, valor }),
        });
        if (res.ok) {
          setCorrigiendo(false);
          setEnviando(false);
          onGuardado(valor);
          return;
        }
        // Lo que responde el servidor con criterio (cerrada, valor inválido)
        // no mejora reintentando: sólo se reintenta cuando se cayó.
        const texto = await res.text();
        if (res.status < 500) {
          setError(texto && texto.length < 80 ? texto : ultimo);
          setEnviando(false);
          return;
        }
        ultimo = 'La conexión está lenta. Estamos reintentando.';
        setError(ultimo);
      } catch {
        ultimo = 'La conexión está lenta. Estamos reintentando.';
        setError(ultimo);
      }
    }
    setError('No pudimos guardarlo. Tocá de nuevo la opción.');
    setEnviando(false);
  }

  /* Va antes del bloque de "ya respondiste": el cruce deja su fila en aportes
     igual que una respuesta, y sin esto la pantalla diría "Listo" en vez de
     decir a quién buscar. */
  if (actividad.tipo === 'cruce') {
    return <Cruzado actividad={actividad} cruce={cruce} />;
  }

  if (cerrado) {
    return (
      <section className="cq-placa ci-listo">
        <p className="ci-tilde" aria-hidden="true">
          ✓
        </p>
        <h1 className="ci-titulo">Listo</h1>
        {mio?.tipo === 'plan' ? (
          /* El compromiso queda escrito y con el botón que lo agenda: el papel
             se pierde y la buena intención también, y el calendario aparece
             solo el día y la hora que la persona eligió. */
          <>
            <blockquote className="ci-mio">
              {nombrarDias(mio.dias)} {mio.hora}, antes de {mio.texto}
            </blockquote>
            <div className="ci-acciones">
              <a
                className="cq-btn ci-enlace"
                href={`/api/ciclo/${slug}/agenda?actividad=${actividad.id}&asistente=${asistenteId}`}
              >
                Agendar en mi calendario
              </a>
              <p className="ci-anonimo">
                Se abre el calendario del teléfono con la alarma puesta.
              </p>
            </div>
          </>
        ) : mio?.tipo === 'texto' && SE_LEEN_EN_VOZ_ALTA.has(actividad.clave) ? (
          /* Lo escrito queda entero en pantalla mientras la consigna siga
             abierta: esta se lee en voz alta y de memoria se pierde la
             redacción exacta, que es lo que se trabaja. */
          <>
            <blockquote className="ci-mio">{mio.texto}</blockquote>
            <p className="cq-ayuda">Se proyecta sin tu nombre.</p>
          </>
        ) : (
          <p className="cq-ayuda">{resumenPropio(mio, actividad)}</p>
        )}
        <div className="ci-acciones">
          <button className="cq-btn-ghost" onClick={() => setCorrigiendo(true)}>
            Cambiar mi respuesta
          </button>
        </div>
        <p className="ci-guardar">Ya podés guardar el teléfono.</p>
      </section>
    );
  }

  if (actividad.tipo === 'cuestionario') {
    /* Adentro del encuentro, no en otra pestaña: la persona ya cargó su nombre
       y su foto al entrar, y mandarla afuera la obligaba a empezar de nuevo
       por la identidad. Va sin el título de la actividad porque el propio
       cuestionario abre con su portada. */
    return (
      <div className="ci-cuestionario">
        <Cuestionario slug={slug} empresa={empresa} yo={yo} />
      </div>
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
          {actividad.opciones.map((o, i) => {
            // "Título · qué quiere decir": la aclaración va con la opción y se
            // muestra debajo, más chica. Una opción que hay que interpretar se
            // responde distinto en cada cabeza y el dato deja de comparar.
            const [titulo, aclara] = partirOpcion(o);
            return (
              <button
                key={i}
                className={`cq-opcion ci-opcion ${
                  tocada === i ? 'ci-opcion-on' : ''
                }`}
                disabled={enviando}
                onClick={() => {
                  // Queda marcada hasta que aparece la consigna siguiente: sin
                  // eso, tocar apaga los cinco botones y no se sabe cuál entró.
                  setTocada(i);
                  enviar({ tipo: 'opcion', opcion: i });
                }}
              >
                {titulo}
                {aclara && <em>({aclara})</em>}
              </button>
            );
          })}
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

      {actividad.tipo === 'plan' && (
        <>
          <div className="ci-dias">
            {DIAS.map((nombre, i) => (
              <button
                key={nombre}
                className={`cq-opcion ci-dia ${
                  dias.includes(i + 1) ? 'ci-dia-on' : ''
                }`}
                onClick={() =>
                  setDias((antes) =>
                    antes.includes(i + 1)
                      ? antes.filter((d) => d !== i + 1)
                      : [...antes, i + 1].sort((a, b) => a - b)
                  )
                }
              >
                {nombre}
              </button>
            ))}
          </div>
          <p className="ci-anonimo">
            Podés elegir más de un día. La pausa se sostiene mejor repetida.
          </p>

          <label className="ci-campo">
            <span>A qué hora</span>
            <input
              className="cq-input ci-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </label>

          <label className="ci-campo">
            <span>Antes de qué</span>
            <input
              className="cq-input"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={120}
              placeholder="la reunión de arranque de turno"
            />
          </label>

          <div className="ci-acciones">
            <button
              className="cq-btn"
              disabled={
                dias.length === 0 || !hora || texto.trim().length < 3 || enviando
              }
              onClick={() =>
                enviar({ tipo: 'plan', dias, hora, texto: texto.trim() })
              }
            >
              Guardar
            </button>
          </div>
        </>
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

// --------------------------------------------------------------------- cruce

/**
 * A quién buscar para consultarle una decisión.
 *
 * Acá no se responde nada: el reparto lo hizo el servidor cruzando los
 * cuadrantes del cuestionario. La pantalla tiene un solo trabajo, que es que la
 * persona encuentre a la otra entre treinta paradas, y por eso la cara pesa más
 * que el texto.
 */
function Cruzado({
  actividad,
  cruce,
}: {
  actividad: ActividadPublica;
  cruce: Cruce | null;
}) {
  if (!cruce || cruce.con.length === 0) {
    return (
      <section className="cq-placa ci-espera">
        <p className="ci-espera-punto" aria-hidden="true" />
        <h1 className="ci-titulo">Un segundo</h1>
        <p className="cq-ayuda">
          Estamos buscando con quién te toca. Aparece solo en esta pantalla.
        </p>
      </section>
    );
  }

  const nombres = cruce.con.map((p) => p.nombre);
  const titulo =
    nombres.length === 1
      ? `Buscá a ${nombres[0]}`
      : `Buscá a ${nombres.slice(0, -1).join(', ')} y a ${nombres[nombres.length - 1]}`;

  return (
    <section className="cq-placa ci-cruce">
      {cruce.miPerfil && (
        <p className="ci-cruce-yo">
          Sos <b>{cruce.miPerfil.nombre}</b>
        </p>
      )}
      <h1 className="ci-titulo">{titulo}</h1>

      <div className="ci-cruce-gente">
        {cruce.con.map((p) => (
          <article className="ci-cruce-par" key={`${p.apellido}-${p.nombre}`}>
            <span className="ci-cruce-foto">
              {p.foto ? (
                <img src={p.foto} alt="" />
              ) : (
                <span className="ci-cara-iniciales">
                  {(p.nombre[0] ?? '') + (p.apellido[0] ?? '')}
                </span>
              )}
            </span>
            <div className="ci-cruce-quien">
              <b>
                {p.nombre} {p.apellido}
              </b>
              {p.perfil && <span className="ci-cruce-perfil">{p.perfil.nombre}</span>}
              <p className="ci-cruce-porque">
                {porQue(p.motivo, p.perfil, cruce.miPerfil)}
              </p>
            </div>
          </article>
        ))}
      </div>

      <p className="ci-cruce-consigna">
        {actividad.enunciado ?? 'Consultale una decisión que tenés que tomar.'}
      </p>
    </section>
  );
}

/**
 * Por qué le tocó esa persona.
 *
 * Cada caso dice lo que pasó y nada más. Anunciar un contraste que el reparto
 * no consiguió es peor que no decir nada: la persona lo comprueba en treinta
 * segundos de conversación.
 */
function porQue(
  motivo: Cruce['con'][number]['motivo'],
  perfil: { corto: string } | null,
  mio: { corto: string } | null
): string {
  if (motivo === 'mismo') {
    return 'Quedaron en el mismo cuadrante: no había nadie de otro sin pareja. Miren en qué se diferencian igual.';
  }
  if (motivo === 'sin-perfil' || !perfil) {
    return 'Todavía no está su resultado del cuestionario.';
  }

  // Con los dos cuadrantes se dice en concreto en qué se complementan. Sin el
  // propio, alcanza con lo que aporta el suyo.
  //
  // Que el opuesto hace sin esfuerzo lo que a uno le cuesta ya lo dijo la
  // charla entera: repetirlo acá gasta la pantalla sin agregar nada.
  const entre = mio ? ENTRE[mio.corto as Perfil][perfil.corto as Perfil] : '';
  if (entre) return entre;

  return `Te puede aportar ${APORTA[perfil.corto as Perfil]}.`;
}

/** "Lunes", "Lunes y miércoles", "Lunes, miércoles y viernes". */
function nombrarDias(dias: number[]): string {
  const nombres = dias.map((d) => DIAS[d - 1]).filter(Boolean);
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
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
    case 'plan':
      return `Quedó para ${nombrarDias(mio.dias).toLowerCase()} a las ${mio.hora}.`;
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
