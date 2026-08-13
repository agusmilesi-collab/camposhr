'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import Cuestionario from '@/app/c/[slug]/Cuestionario';
import { DIAS, partirOpcion, tramo } from '@/lib/opciones';
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
  | 'cruce'
  | 'ensayo'
  | 'frases';

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

/** El puesto de esta persona en una ronda del ensayo de la charla 4. */
type Ensayo = {
  ronda: number;
  grupo: number;
  rol: 'comunica' | 'recibe' | 'observa';
  caso: { titulo: string; ficha: [string, string][]; situacion: string | null };
  /** Sólo llega al que recibe la noticia: los otros dos no tienen que verla. */
  reaccion: { nombre: string; instruccion: string; guion: string[] } | null;
  con: {
    nombre: string;
    apellido: string;
    foto: string | null;
    rol: 'comunica' | 'recibe' | 'observa';
  }[];
  anotado: {
    sostuvo: 'escucho' | 'explico' | null;
    motivo: 'hecho' | 'juicio' | 'ninguno' | null;
    porque: boolean | null;
    cuando: boolean | null;
  };
};

/** El equipo de esta persona en el ejercicio de las frases de la charla 5. */
type Frases = {
  color: string;
  mitad: 'a' | 'b';
  nombreDeMitad: string;
  nombreDeEnfrente: string;
  /** Una por frase: la dirección cambia a mitad de camino, así que cada mitad
   *  hace dos hacia el hecho y dos hacia la interpretación. */
  frases: {
    direccion: 'objetivo' | 'subjetivo';
    consigna: { de: string; a: string; como: string };
    parte: string;
    partioEnfrente: string;
  }[];
  escribe: boolean;
  con: { nombre: string; apellido: string; foto: string | null; escribe: boolean }[];
  enfrente: { nombre: string; apellido: string; foto: string | null; escribe: boolean }[];
  mias: string[] | null;
  suyas: string[] | null;
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
  ensayo: Ensayo | null;
  frases: Frases | null;
  /** En qué momento de la actividad está la sala. Lo mueve el panel. */
  fase: number;
  /** Lo que escribió al abrir la charla, cuando la consigna pregunta por eso. */
  antes?: string | null;
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

/**
 * Consignas que se muestran, no se proyectan.
 *
 * En el juego del Match cada uno escribe con qué completa la frase y después
 * lo levanta para que lo vean los demás, todos al mismo tiempo. El ejercicio
 * es ver la respuesta del otro y descubrir que ante la misma frase cada uno
 * puso lo suyo: una nube proyectada ya viene agrupada y contada, y ahí se
 * pierde de quién es cada palabra, que es lo único que el juego mira.
 *
 * Por eso el teléfono deja de ser un formulario y pasa a ser el cartel: negro,
 * la palabra en blanco y del tamaño que entre.
 */
const SE_MUESTRAN = /^c5-match-\d+$/;

/**
 * Consignas de texto que no se proyectan.
 *
 * El resto de los textos libres del ciclo se leen en la pantalla grande sin
 * nombre, y la pantalla lo avisa antes de que escriban. El comentario del
 * cierre va sólo a Lorena y a Lucila, así que decir ahí que se proyecta sería
 * falso y además cambiaría lo que la persona escribe.
 */
const NO_SE_PROYECTAN = new Set(['c5-gracias']);

/**
 * La última consigna de todo el ciclo.
 *
 * Al terminarla no queda nada más que responder en ninguna de las cinco
 * charlas, así que la pantalla se despide en lugar de ofrecer corregir.
 */
const FIN_DEL_CICLO = 'c5-gracias';

/**
 * El aviso al pie del campo de texto, cuando la consigna necesita el suyo.
 *
 * La apertura de la charla 5 pide nombrar una tensión del propio equipo, que es
 * lo más incómodo que se escribe en todo el ciclo. Sin decir qué pasa con eso,
 * la mitad de la sala escribe algo genérico; y el permiso de inventar una
 * situación saca del paso al que no quiere escribir la suya.
 */
const AVISO_TEXTO: Record<string, string> = {
  'c5-tension':
    'Es confidencial: no aparece tu nombre ni se comparte con nadie. Si te ' +
    'sentís más cómodo podés inventar una situación, aunque si es real quizás ' +
    'te ayude. La vamos a volver a trabajar más adelante.',
  'c5-compromiso':
    'Es confidencial: no se proyecta, no aparece en ningún lado y no se ' +
    'comparte con nadie. Son cuatro, cortas.',
  'c5-siento': 'Confidencial, igual que la anterior.',
  'c5-necesito': 'Confidencial, igual que la anterior.',
  'c5-pedido':
    'Confidencial, igual que las anteriores. Con las cuatro juntas ya tenés ' +
    'la conversación armada.',
};

/**
 * Consignas que confirman y no dejan volver.
 *
 * Las del arranque de la charla 5, las tres del conflicto y las dos del cierre:
 * ninguna se proyecta ni se comenta en la sala. Ofrecer corregir invita a mirar
 * el teléfono en vez de la charla, y lo que se corrige ahí no es un error de
 * tipeo: es la respuesta pensada dos veces.
 */
const SIN_CORREGIR = new Set([
  'c5-solo',
  'c5-heredado',
  'c5-quedarse',
  'c5-decision',
  'c5-etapa',
  'c5-antiguedad',
  'c5-freno',
  'c5-compromiso',
  'c5-siento',
  'c5-necesito',
  'c5-pedido',
]);

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
      /*
       * Una pestaña puede fijar su propia identidad con `?como=<id>`.
       *
       * Es para probar: las tres pantallas del ensayo se miran a la vez en la
       * misma computadora, una por pestaña. La marca va en `sessionStorage`,
       * que es de esa pestaña y no del navegador, así que no le cambia la
       * sesión a las otras ni a quien esté usando el teléfono de verdad.
       *
       * No abre nada nuevo: la grilla de caras ya deja entrar como cualquiera.
       */
      const dePestana = sessionStorage.getItem(guardado);
      const pedido = new URLSearchParams(window.location.search).get('como');
      const id = pedido ?? dePestana ?? localStorage.getItem(guardado);
      // Se valida contra la lista real: si la persona se borró de la base o la
      // marca quedó de otro ciclo, vuelve a la entrada en vez de romperse.
      const cara = id ? caras.find((c) => c.id === id) : null;
      if (cara) {
        if (pedido || dePestana) sessionStorage.setItem(guardado, cara.id);
        setYo({ id: cara.id, nombre: cara.nombre, apellido: cara.apellido });
      }
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
      sessionStorage.removeItem(guardado);
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

  /* La encuesta del final es lo último que se contesta en todo el ciclo, así
     que cuando termina no queda nada atrás a lo que volver: la pantalla se
     despide en vez de ofrecer corregir la última respuesta. En cualquier otro
     grupo el botón sigue, porque la charla continúa y alguien se puede haber
     equivocado de opción. */
  if (!pendiente && todas[todas.length - 1]?.clave === FIN_DEL_CICLO) {
    return (
      <section className="cq-placa ci-listo">
        <p className="ci-tilde" aria-hidden="true">
          ✓
        </p>
        <h1 className="ci-titulo">Gracias</h1>
        <p className="cq-ayuda">
          Por los cinco encuentros y por tu atención plena.
        </p>
        <p className="ci-firma">Lorena y Lucila</p>
        <p className="ci-guardar">Ya podés guardar el teléfono.</p>
      </section>
    );
  }

  const numero = todas.indexOf(actual) + 1;

  return (
    <>
      {todas.length > 1 && (
        <p className="ci-paso">
          {numero} de {todas.length}
        </p>
      )}
      {/* Lo que escribió al abrir la charla, arriba de las tres preguntas que
          son sobre eso mismo. Entre una placa y la otra pasa más de una hora. */}
      {estado.antes && (
        <div className="ci-antes">
          <p className="ci-antes-que">Tu tensión</p>
          <blockquote className="ci-mio">{estado.antes}</blockquote>
        </div>
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
        ensayo={estado.ensayo}
        frases={estado.frases}
        fase={estado.fase}
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
  ensayo,
  frases,
  fase,
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
  ensayo: Ensayo | null;
  frases: Frases | null;
  fase: number;
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
  /** Si ya tocó el botón que baja el evento al calendario. */
  const [agendado, setAgendado] = useState(false);

  const cerrado = respondida && !corrigiendo;

  /** El enlace que baja el evento al calendario, con el compromiso ya guardado. */
  const enlaceAgenda = `/api/ciclo/${slug}/agenda?actividad=${actividad.id}&asistente=${asistenteId}`;

  /** Devuelve si quedó guardado, que es lo que el compromiso necesita saber
      para seguir de largo hasta el calendario sin pedir otro toque. */
  async function enviar(valor: Valor): Promise<boolean> {
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
          // Si cambió el compromiso, el evento que bajó antes ya no dice lo
          // mismo: la pantalla vuelve a pedir que lo agende.
          setAgendado(false);
          setEnviando(false);
          onGuardado(valor);
          return true;
        }
        // Lo que responde el servidor con criterio (cerrada, valor inválido)
        // no mejora reintentando: sólo se reintenta cuando se cayó.
        const texto = await res.text();
        if (res.status < 500) {
          setError(texto && texto.length < 80 ? texto : ultimo);
          setEnviando(false);
          return false;
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
    return false;
  }

  /* Va antes del bloque de "ya respondiste": el cruce deja su fila en aportes
     igual que una respuesta, y sin esto la pantalla diría "Listo" en vez de
     decir a quién buscar. */
  if (actividad.tipo === 'ensayo') {
    return (
      <Ensayando
        slug={slug}
        actividadId={actividad.id}
        asistenteId={asistenteId}
        ensayo={ensayo}
      />
    );
  }

  if (actividad.tipo === 'cruce') {
    return <Cruzado actividad={actividad} cruce={cruce} />;
  }

  /* El ejercicio de las frases tampoco se responde de a uno: el equipo lo armó
     el servidor y de cada mitad escribe una sola persona. */
  if (actividad.tipo === 'frases') {
    return (
      <Ejercicio
        slug={slug}
        actividadId={actividad.id}
        asistenteId={asistenteId}
        frases={frases}
        fase={fase}
      />
    );
  }

  /* El compromiso tiene pantalla propia, y va antes del bloque de "ya
     respondiste". El 7 de agosto de 2026 los 32 compromisos quedaron escritos y
     ninguno agendado: el tilde, la palabra "Listo" y "Ya podés guardar el
     teléfono" cerraban el recorrido antes de que nadie tocara el calendario.

     Ahora el botón de guardar dispara el calendario en el mismo toque y se
     llega acá con el evento ya bajado. Quedan las dos caras igual: la de
     "Agendado", que es la que se ve al guardar, y la de "Falta un paso", que
     aparece cuando se vuelve a entrar en otra sesión y el navegador ya no
     recuerda si el evento se guardó. Ante la duda pide repetirlo, que es barato
     y no puede terminar en un compromiso sin alarma. */
  if (cerrado && mio?.tipo === 'plan') {
    return (
      <section className="cq-placa ci-listo">
        {agendado ? (
          <>
            <p className="ci-tilde" aria-hidden="true">
              ✓
            </p>
            <h1 className="ci-titulo">Agendado</h1>
          </>
        ) : (
          <>
            <p className="ci-paso">Falta un paso</p>
            <h1 className="ci-titulo">Ponelo en el calendario</h1>
          </>
        )}
        <blockquote className="ci-mio">
          {nombrarDias(mio.dias)} {mio.hora}, antes de {mio.texto}
        </blockquote>
        {agendado ? (
          <>
            <p className="cq-ayuda">
              Si el calendario no lo guardó, tocá de nuevo el botón.
            </p>
            <div className="ci-acciones">
              <a className="cq-btn-ghost ci-enlace" href={enlaceAgenda}>
                Agendar de nuevo
              </a>
              <button
                className="cq-btn-ghost"
                onClick={() => setCorrigiendo(true)}
              >
                Cambiar mi respuesta
              </button>
            </div>
            <p className="ci-guardar">Ya podés guardar el teléfono.</p>
          </>
        ) : (
          <>
            <div className="ci-acciones">
              <a
                className="cq-btn ci-enlace"
                href={enlaceAgenda}
                onClick={() => setAgendado(true)}
              >
                Agendar en mi calendario
              </a>
              <p className="ci-anonimo">
                Se abre el calendario del teléfono con la alarma puesta el día y
                la hora que elegiste.
              </p>
            </div>
            <div className="ci-acciones">
              <button
                className="cq-btn-ghost"
                onClick={() => setCorrigiendo(true)}
              >
                Cambiar mi respuesta
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  /* El Match: la respuesta se muestra, así que la pantalla pasa a ser el
     cartel apenas la escribe. Va antes del bloque de "ya respondiste", que
     confirma y esconde lo escrito, que es justo lo contrario de lo que este
     ejercicio necesita. */
  if (cerrado && mio?.tipo === 'palabra' && SE_MUESTRAN.test(actividad.clave)) {
    return (
      <Cartel palabra={mio.palabra} onCambiar={() => setCorrigiendo(true)} />
    );
  }

  if (cerrado && SIN_CORREGIR.has(actividad.clave)) {
    return (
      <section className="cq-placa ci-listo">
        <p className="ci-tilde" aria-hidden="true">
          ✓
        </p>
        <h1 className="ci-titulo">Listo</h1>
        <p className="ci-guardar">Ya podés guardar el teléfono.</p>
      </section>
    );
  }

  if (cerrado) {
    return (
      <section className="cq-placa ci-listo">
        <p className="ci-tilde" aria-hidden="true">
          ✓
        </p>
        <h1 className="ci-titulo">Listo</h1>
        {mio?.tipo === 'texto' && SE_LEEN_EN_VOZ_ALTA.has(actividad.clave) ? (
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
              {/* En el Match el mismo toque guarda y da vuelta la pantalla:
                  el botón nombra lo que va a pasar, que es mostrarla. */}
              {SE_MUESTRAN.test(actividad.clave) ? 'Mostrar' : 'Enviar'}
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
              className={`ci-escala-boton ${tramo(n)}`}
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
            {/* Un solo toque. El calendario necesita el compromiso ya escrito
                en la base, porque el evento lo arma el servidor con lo que la
                persona guardó, así que la navegación va después del envío y no
                en paralelo. El toque del botón sigue contando como gesto del
                usuario mientras el envío no se demore, y si no llegó a
                dispararse la pantalla de después deja el botón para repetirlo. */}
            <button
              className="cq-btn"
              disabled={
                dias.length === 0 || !hora || texto.trim().length < 3 || enviando
              }
              onClick={async () => {
                const guardado = await enviar({
                  tipo: 'plan',
                  dias,
                  hora,
                  texto: texto.trim(),
                });
                if (!guardado) return;
                setAgendado(true);
                window.location.href = enlaceAgenda;
              }}
            >
              {enviando ? 'Un segundo…' : 'Guardar y agendar'}
            </button>
            <p className="ci-anonimo">
              Se abre el calendario del teléfono con la alarma puesta el día y la
              hora que elegiste.
            </p>
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
            {AVISO_TEXTO[actividad.clave] ??
              (NO_SE_PROYECTAN.has(actividad.clave)
                ? 'Lo leen Lorena y Lucila. No se proyecta.'
                : 'Se proyecta sin tu nombre. Nadie va a saber cuál escribiste vos.')}
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

// ----------------------------------------------------------------- ejercicio

/**
 * El ejercicio de las frases de la charla 5.
 *
 * Tiene dos momentos y la pantalla pasa sola del primero al segundo. Mientras
 * las dos mitades escriben, cada una ve sólo lo suyo. Cuando las dos
 * guardaron, aparece la lectura cruzada, que es donde el ejercicio se entiende:
 * al lado de lo que escribió cada mitad está la frase de la que partió la otra,
 * y esa frase es la respuesta.
 *
 * En cada mitad escribe una sola persona. Los otros dos ven las mismas frases
 * en su teléfono para poder discutirlas, y no un formulario: si cada uno
 * completa el suyo, nadie habla con nadie y el ejercicio se convierte en tres
 * tareas individuales hechas al lado.
 */
function Ejercicio({
  slug,
  actividadId,
  asistenteId,
  frases,
  fase,
}: {
  slug: string;
  actividadId: string;
  asistenteId: string;
  frases: Frases | null;
  fase: number;
}) {
  const [borrador, setBorrador] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Lo enviado desde este teléfono, para no esperar al sondeo. */
  const [recien, setRecien] = useState<string[] | null>(null);
  /**
   * Si volvió al formulario para corregir.
   *
   * Hace falta un estado propio: lo que se guardó sigue llegando en cada
   * sondeo, así que limpiar lo recién enviado devolvía la pantalla de "listo"
   * en menos de un segundo y el botón no hacía nada visible.
   */
  const [corrigiendo, setCorrigiendo] = useState(false);

  if (!frases) {
    return (
      <section className="cq-placa ci-espera">
        <p className="ci-espera-punto" aria-hidden="true" />
        <h1 className="ci-titulo">Un segundo</h1>
        <p className="cq-ayuda">
          Estamos armando los equipos. El tuyo aparece solo en esta pantalla.
        </p>
      </section>
    );
  }

  /*
   * Primero el color, a pantalla completa y para levantar.
   *
   * Juntar seis grupos de seis en una sala de treinta y dos es el momento que
   * más tiempo come, y con la consigna ya en pantalla cada uno la lee mientras
   * camina y nadie mira a quién tiene al lado. Acá no hay nada más que el
   * color, así que el teléfono sirve para encontrarse y no para leer.
   *
   * El pase lo manda quien dicta cuando ve la sala armada.
   */
  if (fase < 1) {
    return <Color color={frases.color} cuantos={1 + frases.con.length + frases.enfrente.length} />;
  }

  const mias = recien ?? frases.mias;
  const listas = Boolean(mias) && Boolean(frases.suyas);

  async function enviar() {
    setEnviando(true);
    setError(null);
    // Mismo criterio que el resto de las escrituras del ciclo.
    const ESPERAS = [0, 1200, 3000];
    for (const espera of ESPERAS) {
      if (espera) await new Promise((r) => setTimeout(r, espera));
      try {
        const res = await fetch(`/api/ciclo/${slug}/aporte`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            actividadId,
            asistenteId,
            valor: { respuestas: borrador },
          }),
        });
        if (res.ok) {
          setRecien(borrador);
          setCorrigiendo(false);
          setEnviando(false);
          return;
        }
        if (res.status < 500) {
          setError(await res.text());
          setEnviando(false);
          return;
        }
      } catch {
        /* sin señal: lo intenta de nuevo */
      }
    }
    setError('No pudimos guardarlo. Probá de nuevo.');
    setEnviando(false);
  }

  const quienEscribe = frases.escribe
    ? null
    : frases.con.find((p) => p.escribe) ?? null;

  return (
    <section className="cq-placa ci-frases">
      <p className="ci-frases-equipo">
        Equipo <b>{frases.color}</b> · {frases.nombreDeMitad}
      </p>

      {listas && !corrigiendo ? (
        /* Las dos mitades escribieron: la lectura cruzada. */
        <>
          <h1 className="ci-titulo">Compartan con el otro grupo</h1>
          {/*
            Tres frases cortas y una idea por frase. Antes eran dos párrafos
            que explicaban también por qué arranca uno u otro, que es una razón
            de diseño y no algo que la mesa necesite para hacer el ejercicio.
          */}
          {/* Todo en un párrafo: la caja aparte partía en dos una sola idea
              y sumaba un borde más a una pantalla que ya tiene una caja por
              turno. */}
          <p className="cq-ayuda">
            Ellos ya tenían las respuestas de lo que ustedes tuvieron que
            completar. Y ustedes tienen las respuestas de lo que tuvieron que
            completar ellos. <b>Ahora se van a corregir entre ustedes.</b> Vayan
            de a una frase. La pantalla dice quién empieza.
          </p>

          <div className="ci-frases-cruce">
            {frases.frases.map((f, i) => {
              const nombresEnfrente = lista(
                frases.enfrente.map((p) => p.nombre)
              );
              /*
               * En cada frase arranca la mitad que fue hacia el hecho, porque
               * es la única que tiene una respuesta contra la cual comparar, y
               * la tiene enfrente. La otra dirección no se corrige: hay muchas
               * interpretaciones posibles del mismo hecho, así que lo evaluable
               * es si lo que agregaron se puede verificar.
               *
               * Como la dirección se invierte a mitad del ejercicio, quién
               * arranca cambia de frase en frase. Por eso lo dice cada una.
               */
              const vamosAlHecho = f.direccion === 'objetivo';

              /* Cada pantalla muestra sólo lo suyo: si la respuesta estuviera
                 acá, no habría nada que preguntarle a nadie. */
              const nuestro = vamosAlHecho ? (
                <>
                  <p className="ci-frases-num">
                    <span className="ci-frases-letra">{i * 2 + 1}</span>
                    <b>Empezamos nosotros</b>
                  </p>
                  <div className="ci-frases-turno ci-frases-nuestro-turno">
                    <h3>Leé en voz alta</h3>
                    <p className="ci-frases-linea">
                      <span>Nos tocó convertir en objetiva la frase:</span>{' '}
                      {f.parte}
                    </p>
                    <p className="ci-frases-linea">
                      <span>Y nuestra respuesta fue:</span>{' '}
                      <b className="ci-frases-mia">{mias?.[i] || '(en blanco)'}</b>
                    </p>
                    <p className="ci-frases-puntos" aria-hidden="true">
                      · · ·
                    </p>
                    <p className="ci-frases-cierre">
                      Ahora {frases.enfrente.length === 1 ? 'preguntale' : 'preguntales'}{' '}
                      a {nombresEnfrente}:{' '}
                      <b>¿qué decía la frase objetiva de ustedes?</b>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="ci-frases-num">
                    <span className="ci-frases-letra">{i * 2 + 2}</span>
                    <b>Seguimos nosotros</b>
                  </p>
                  <div className="ci-frases-turno ci-frases-nuestro-turno">
                    <h3>Leé en voz alta</h3>
                    <p className="ci-frases-linea">
                      <span>Nos tocó convertir en subjetiva la frase:</span>{' '}
                      {f.parte}
                    </p>
                    <p className="ci-frases-linea">
                      <span>Y nuestra respuesta fue:</span>{' '}
                      <b className="ci-frases-mia">{mias?.[i] || '(en blanco)'}</b>
                    </p>
                  </div>
                </>
              );

              const deEnfrente = vamosAlHecho ? (
                <>
                  <p className="ci-frases-num">
                    <span className="ci-frases-letra">{i * 2 + 2}</span>
                    <b>Siguen ellos</b>
                  </p>
                  <div className="ci-frases-turno">
                    <p className="ci-frases-pregunta">
                      A ellos les tocó agregarle una interpretación al hecho
                      (De objetiva a subjetiva) y{' '}
                      <b>no hay una sola respuesta correcta</b>.
                    </p>
                    <p className="ci-frases-cierre">
                      Luego de su respuesta preguntales si <b>otra persona, con
                      el mismo hecho, podría haber dicho otra cosa</b>.
                    </p>
                    <ul className="ci-frases-veredicto">
                      <li>
                        <span>
                          <b>Sí, podría haber dicho otra cosa.</b>{' '}
                          Entonces la respuesta es correcta.
                        </span>
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="ci-frases-num">
                    <span className="ci-frases-letra">{i * 2 + 1}</span>
                    <b>Empiezan ellos</b>
                  </p>
                  <div className="ci-frases-turno">
                    <p className="ci-frases-pregunta">
                      Escuchá lo que dicen ellos y cuando les pregunten{' '}
                      <b>¿qué decía la frase objetiva de ustedes?</b>, responden con:
                    </p>
                    <p className="ci-frases-dato">{f.parte}</p>
                    <p className="ci-frases-cierre">
                      Evaluá: <b>¿convirtieron la oración en objetiva?</b>
                    </p>
                    {/* La traducción que hicieron ellos, de dónde partieron
                        y adónde llegaron. Sin el punto de partida, lo que
                        escribieron no se puede evaluar. */}
                    <div className="ci-frases-cotejo">
                      <div>
                        <span>De</span>
                        <b>{f.partioEnfrente}</b>
                      </div>
                      <span className="ci-frases-flecha" aria-hidden="true">
                        →
                      </span>
                      <div>
                        <span>A</span>
                        <b>{frases.suyas?.[i] || '(en blanco)'}</b>
                      </div>
                    </div>
                  </div>
                </>
              );

              return (
                <article key={i}>
                  {vamosAlHecho ? (
                    <>
                      {nuestro}
                      {deEnfrente}
                    </>
                  ) : (
                    <>
                      {deEnfrente}
                      {nuestro}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : mias && !corrigiendo ? (
        /* Esta mitad ya escribió y espera a la de enfrente. */
        <>
          <p className="ci-tilde" aria-hidden="true">
            ✓
          </p>
          <h1 className="ci-titulo">Listo</h1>
          <p className="cq-ayuda">
            Falta que termine la otra mitad de tu equipo. Cuando terminen,
            aparece acá lo que escribieron.
          </p>
          {frases.escribe && (
            <div className="ci-acciones">
              <button
                className="cq-btn-ghost"
                onClick={() => {
                  setBorrador(mias ?? []);
                  setCorrigiendo(true);
                }}
              >
                Corregir lo que escribimos
              </button>
            </div>
          )}
        </>
      ) : (
        /* Todavía escribiendo. */
        <>
          {/*
            Primero armar la mesa y recién después la consigna. La sala tiene
            que hacer dos movimientos en orden y sin que nadie los diga en voz
            alta: juntarse por color, y ya juntos partirse en dos. Con los seis
            nombres mezclados desde el arranque, la mitad busca a la persona
            equivocada y el ejercicio empieza cinco minutos tarde.
          */}
          {/*
            Un solo movimiento, no dos. Juntarse por color ya pasó: fue la
            pantalla anterior, y quien llega acá lo tiene hecho. Repetirlo
            manda a media sala a rearmar un grupo que ya está armado.
          */}
          <div className="ci-frases-armado">
            <p>
              <b>Ya reunido el equipo {frases.color}, sepárense en dos
              subgrupos.</b>{' '}
              Vos vas al {frases.nombreDeMitad}
              {frases.con.length > 0 ? ', con estas caras:' : ', solo.'}
            </p>
            {frases.con.length > 0 && (
              <span className="ci-frases-caras">
                {frases.con.map((p) => (
                  <span key={`${p.apellido}-${p.nombre}`}>
                    {p.foto ? (
                      <img src={p.foto} alt="" />
                    ) : (
                      <i>{(p.nombre[0] ?? '') + (p.apellido[0] ?? '')}</i>
                    )}
                    <b>{p.nombre}</b>
                  </span>
                ))}
              </span>
            )}
          </div>

          <h1 className="ci-titulo">Ejercicio</h1>
          <p className="cq-ayuda">
            Hay <b>2 frases que deben pasar de objetivo a subjetivo</b> y{' '}
            <b>2 frases que deben pasar de subjetivo a objetivo</b>.
          </p>

          {frases.escribe ? (
            <>
              <p className="ci-frases-rol">
                Escribís vos, por los tres. Pónganse de acuerdo primero.
              </p>
              {/*
                Las frases van agrupadas por dirección y no de a una: las dos
                primeras van para un lado y las dos siguientes para el otro, y
                repetir la consigna cuatro veces esconde justamente el cambio.
                El título de cada bloque es el corte.
              */}
              {frases.frases.map((f, i) => {
                const abre = i === 0 || f.direccion !== frases.frases[i - 1].direccion;
                return (
                  <div key={i}>
                    {abre && (
                      <div className={`ci-frases-bloque ci-hacia-${f.direccion}`}>
                        <h2>{f.consigna.a}</h2>
                        <p>{f.consigna.como}</p>
                      </div>
                    )}
                    <label className="ci-frases-campo">
                      <span>{f.parte}</span>
                      <textarea
                        className="cq-input ci-textarea"
                        rows={2}
                        maxLength={400}
                        value={borrador[i] ?? ''}
                        onChange={(e) =>
                          setBorrador((b) => {
                            const otro = [...b];
                            otro[i] = e.target.value;
                            return otro;
                          })
                        }
                      />
                    </label>
                  </div>
                );
              })}
              <div className="ci-acciones">
                <button
                  className="cq-btn"
                  disabled={enviando || !borrador.some((t) => t?.trim())}
                  onClick={enviar}
                >
                  {enviando ? 'Un segundo…' : 'Listo, ya está'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="ci-frases-rol">
                {quienEscribe
                  ? `Escribe ${quienEscribe.nombre}. Díganle qué poner.`
                  : 'Escribe otra persona de tu mitad. Díganle qué poner.'}
              </p>
              {/* También agrupadas, para que quien dicta la respuesta vea el
                  cambio de dirección igual que quien escribe. */}
              {frases.frases.map((f, i) => {
                const abre = i === 0 || f.direccion !== frases.frases[i - 1].direccion;
                return (
                  <div key={i}>
                    {abre && (
                      <div className={`ci-frases-bloque ci-hacia-${f.direccion}`}>
                        <h2>{f.consigna.a}</h2>
                        <p>{f.consigna.como}</p>
                      </div>
                    )}
                    <p className="ci-frases-suelta">{f.parte}</p>
                  </div>
                );
              })}
            </>
          )}

          {error && <p className="cq-error">{error}</p>}
        </>
      )}
    </section>
  );
}

/**
 * El color del equipo, a pantalla completa.
 *
 * Mismo criterio que el cartel del Match: lo único que hay en la pantalla es
 * lo que hay que mostrarle a la sala. Acá el trabajo es encontrarse, así que
 * el color va del tamaño que se lee desde el otro lado del salón y el resto
 * es una línea.
 */
function Color({ color, cuantos }: { color: string; cuantos: number }) {
  return (
    <section className={`ci-color ci-color-${color.toLowerCase()}`}>
      <p className="ci-color-arriba">Tu equipo es el</p>
      <h1 className="ci-color-nombre">{color}</h1>
      <p className="ci-color-abajo">
        Levantá el teléfono y buscá a los otros {cuantos - 1}.
      </p>
    </section>
  );
}

// -------------------------------------------------------------------- cartel

/**
 * La palabra del Match, para levantar y que la lea la sala.
 *
 * Tapa la pantalla entera, encabezado incluido: lo que se levanta tiene que
 * leerse de un vistazo desde otra mesa, y una barra con el nombre de la
 * empresa arriba le come el alto a la palabra y le saca contraste.
 *
 * La palabra corre siempre a lo largo del lado largo del teléfono, que es
 * donde entra al doble de tamaño. Con la pantalla en vertical va girada, así
 * que la persona gira el aparato y la lee derecha; si tiene la rotación
 * suelta, la pantalla pasa a apaisada sola y entonces va sin girar. En los dos
 * casos termina igual: horizontal para quien la mira.
 *
 * El cuerpo se mide, no se estima. Con un tamaño fijo "sal" desperdicia media
 * pantalla y "responsabilidad" se sale por los costados, y en las dos puntas
 * el cartel deja de cumplir su trabajo. Contar caracteres tampoco alcanza,
 * porque "mm" ocupa el doble que "il": se dibuja la palabra a un cuerpo
 * conocido, se mide lo que ocupó y se escala. Una sola medición, sin bucle.
 */
function Cartel({
  palabra,
  onCambiar,
}: {
  palabra: string;
  onCambiar: () => void;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [cuerpo, setCuerpo] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function ajustar() {
      if (!el) return;
      el.style.fontSize = `${MEDIDA}px`;
      const ancho = el.scrollWidth;
      if (!ancho) return;
      // La palabra va a lo largo del lado largo, esté la pantalla como esté:
      // en vertical porque la gira el CSS, y en apaisada porque ya lo está.
      const largo = Math.max(window.innerWidth, window.innerHeight);
      const corto = Math.min(window.innerWidth, window.innerHeight);
      setCuerpo(
        Math.min(
          (largo * 0.92 * MEDIDA) / ancho,
          // Tope de alto, para que una palabra de dos letras no se coma la
          // pantalla entera y se corte por arriba y por abajo. Casi la mitad
          // del lado corto: es el que manda en casi todas las palabras del
          // juego, así que bajarlo las achica a todas.
          corto * 0.46
        )
      );
    }
    ajustar();
    // Girar el teléfono cambia cuál es el lado largo, y es lo que hace la
    // mitad de la sala apenas ve que la palabra entra más grande de costado.
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [palabra]);

  return (
    <div className="ci-cartel">
      <p
        ref={ref}
        className="ci-cartel-palabra"
        /* Hasta que está medida no se muestra: sin esto se ve un salto desde
           el cuerpo de medición al definitivo. */
        style={{
          fontSize: `${cuerpo ?? MEDIDA}px`,
          visibility: cuerpo ? 'visible' : 'hidden',
        }}
      >
        {palabra}
      </p>
      <button className="ci-cartel-volver" onClick={onCambiar}>
        Cambiar mi palabra
      </button>
    </div>
  );
}

/** Nombres separados por coma, y el último con «y». Se lee en voz alta. */
function lista(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** El cuerpo con el que se mide antes de escalar. Cualquiera sirve. */
const MEDIDA = 100;

// --------------------------------------------------------------------- cruce

/**
 * A quién buscar para consultarle una decisión.
 *
 * Acá no se responde nada: el reparto lo hizo el servidor cruzando los
 * cuadrantes del cuestionario. La pantalla tiene un solo trabajo, que es que la
 * persona encuentre a la otra entre treinta paradas, y por eso la cara pesa más
 * que el texto.
 */
/** Cómo se nombra cada rol en la pantalla de quien lo tiene. */
const ROL_TITULO = {
  comunica: 'Vos comunicás la mala noticia',
  recibe: 'Vos recibís la mala noticia',
  observa: 'Vos observás la conversación',
} as const;

/**
 * Los cuatro pasos, para quien tiene que darla.
 *
 * Sin el ejemplo: el ejemplo está en la placa proyectada y nombra la
 * suspensión, que es uno de los tres casos. Acá cada uno tiene el suyo, así
 * que el recordatorio dice el paso y no la frase.
 */
const PASOS = [
  ['Encuadrá', 'Lugar privado y un aviso corto antes de empezar.'],
  ['Decilo claro', 'El motivo y la decisión juntos, en las primeras dos frases.'],
  [
    'En silencio, sostené',
    'Callate mientras descarga. Cuando pare, decile una vez: “la decisión ya ' +
      'está tomada”.',
  ],
  ['Cerrá con una fecha', 'Qué pasa ahora, con día y hora.'],
] as const;

/** Y cómo se nombra el de los otros dos, para ubicarlos en el trío. */
const ROL_AJENO = {
  comunica: 'comunica',
  recibe: 'recibe',
  observa: 'observa',
} as const;

/**
 * Una ronda del ensayo de la charla 4.
 *
 * Cada uno ve sólo lo suyo. La reacción que le toca a quien recibe la noticia
 * no viaja a los otros dos teléfonos: si el que comunica supiera de antemano
 * que el otro va a llorar, se prepararía, y el ensayo dejaría de parecerse a lo
 * que pasa en la oficina.
 */
function Ensayando({
  slug,
  actividadId,
  asistenteId,
  ensayo,
}: {
  slug: string;
  actividadId: string;
  asistenteId: string;
  ensayo: Ensayo | null;
}) {
  /** Lo que se acaba de tocar, mientras el envío está en camino. */
  const [recien, setRecien] = useState<Record<string, string | boolean>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ensayo) {
    return (
      <section className="cq-placa ci-espera">
        <p className="ci-espera-punto" aria-hidden="true" />
        <h1 className="ci-titulo">Un segundo</h1>
        <p className="cq-ayuda">
          Estamos armando los tríos. Tu lugar aparece solo en esta pantalla.
        </p>
      </section>
    );
  }

  const anotado: Record<string, string | boolean | null> = {
    ...ensayo.anotado,
    ...recien,
  };

  async function anotar(campo: string, valor: string | boolean) {
    setEnviando(campo);
    setError(null);
    // Mismo criterio que el resto de las escrituras: si la base está ocupada
    // se reintenta, porque un solo intento deja a esa persona parada mientras
    // la charla sigue.
    const ESPERAS = [0, 1200, 3000];
    for (const espera of ESPERAS) {
      if (espera) await new Promise((r) => setTimeout(r, espera));
      try {
        const res = await fetch(`/api/ciclo/${slug}/aporte`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            actividadId,
            asistenteId,
            valor: { [campo]: valor },
          }),
        });
        if (res.ok) {
          setRecien((previo) => ({ ...previo, [campo]: valor }));
          setEnviando(null);
          return;
        }
        // Lo que el servidor rechaza con criterio no se reintenta.
        if (res.status !== 500) {
          setError(await res.text());
          setEnviando(null);
          return;
        }
      } catch {
        /* sin señal: lo intenta de nuevo */
      }
    }
    setError('No pudimos guardarlo. Probá de nuevo.');
    setEnviando(null);
  }

  /** Una pregunta con dos respuestas, que queda contestada al primer toque. */
  function Pregunta({
    campo,
    texto,
    opciones,
  }: {
    campo: string;
    texto: string;
    opciones: { valor: string | boolean; etiqueta: string }[];
  }) {
    const elegido = anotado[campo];
    return (
      <div className="ci-ensayo-pregunta">
        <h3>{texto}</h3>
        {elegido !== null && elegido !== undefined ? (
          <p className="ci-ensayo-contestado">
            Anotaste:{' '}
            <b>{opciones.find((o) => o.valor === elegido)?.etiqueta}</b>
          </p>
        ) : (
          <div className="ci-acciones">
            {opciones.map((o) => (
              <button
                key={String(o.valor)}
                className="cq-btn"
                disabled={enviando !== null}
                onClick={() => anotar(campo, o.valor)}
              >
                {o.etiqueta}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="cq-placa ci-ensayo">
      <p className="ci-ensayo-ronda">
        Ronda {ensayo.ronda + 1} de 3 · Grupo {ensayo.grupo}
      </p>
      <h1 className="ci-titulo">{ROL_TITULO[ensayo.rol]}</h1>

      <div className="ci-ensayo-gente">
        {ensayo.con.map((p) => (
          <article className="ci-ensayo-par" key={`${p.apellido}-${p.nombre}`}>
            <span className="ci-cruce-foto">
              {p.foto ? (
                <img src={p.foto} alt="" />
              ) : (
                <span className="ci-cara-iniciales">
                  {(p.nombre[0] ?? '') + (p.apellido[0] ?? '')}
                </span>
              )}
            </span>
            <div className="ci-ensayo-quien">
              <b>
                {p.nombre} {p.apellido}
              </b>
              <span className="ci-ensayo-rol">{ROL_AJENO[p.rol]}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="ci-ensayo-caso">
        <h2>{ensayo.caso.titulo}</h2>
        {/* Quien comunica y quien observa ven la ficha con los datos. Quien
            recibe ve sólo quién es y que lo llamaron: la decisión la escucha
            en la conversación, como en la oficina. */}
        {ensayo.caso.situacion ? (
          <p>{ensayo.caso.situacion}</p>
        ) : (
          <dl className="ci-ensayo-ficha">
            {ensayo.caso.ficha.map(([que, dato]) => (
              <div key={que}>
                <dt>{que}</dt>
                <dd>{dato}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {ensayo.rol === 'comunica' && (
        <div className="ci-ensayo-pasos">
          <h2>Los cuatro pasos</h2>
          <ol>
            {PASOS.map(([nombre, como]) => (
              <li key={nombre}>
                <b>{nombre}.</b> {como}
              </li>
            ))}
          </ol>
          {/* El ensayo mental antes de entrar. Es parte del primer paso de
              SPIKES y en la charla no está en ningún lado: quien va a dar la
              noticia entra en frío y de ahí sale la mitad de lo que después
              se le complica. */}
          <p className="ci-ensayo-pensar">
            Si querés, tomate unos segundos antes de empezar para pensar cómo
            lo vas a decir.
          </p>
        </div>
      )}

      {ensayo.reaccion && (
        <div className="ci-ensayo-reaccion">
          <h2>{ensayo.reaccion.nombre}</h2>
          <p>{ensayo.reaccion.instruccion}</p>
          <ul className="ci-ensayo-guion">
            {ensayo.reaccion.guion.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
          <p className="ci-ensayo-secreto">
            Esto lo ves solo vos. No se lo muestres a quien te va a comunicar.
          </p>
        </div>
      )}

      {ensayo.rol === 'observa' && (
        <div className="ci-ensayo-observa">
          <p className="ci-ensayo-cuando">
            Contestá cuando la conversación haya terminado, no mientras hablan.
          </p>
          <Pregunta
            campo="sostuvo"
            texto="Cuando el otro reaccionó, ¿qué hizo el que comunicó?"
            opciones={[
              { valor: 'escucho', etiqueta: 'Se quedó escuchando' },
              { valor: 'explico', etiqueta: 'Siguió hablando' },
            ]}
          />
          <Pregunta
            campo="motivo"
            texto="El motivo que dio, ¿fue un hecho o un juicio sobre la persona?"
            opciones={[
              { valor: 'hecho', etiqueta: 'Un hecho' },
              { valor: 'juicio', etiqueta: 'Un juicio' },
              { valor: 'ninguno', etiqueta: 'No dijo el motivo' },
            ]}
          />
          {error && <p className="cq-error">{error}</p>}
        </div>
      )}

      {ensayo.rol === 'recibe' && (
        <div className="ci-ensayo-observa">
          <p className="ci-ensayo-cuando">
            Contestá cuando la conversación haya terminado, no mientras hablan.
          </p>
          <Pregunta
            campo="porque"
            texto="¿Te dijo el motivo, o sea qué pasó para que tomaran esta decisión?"
            opciones={[
              { valor: true, etiqueta: 'Sí' },
              { valor: false, etiqueta: 'No' },
            ]}
          />
          <Pregunta
            campo="cuando"
            texto="¿Te dijo el día y la hora en que vuelven a hablar del tema?"
            opciones={[
              { valor: true, etiqueta: 'Sí' },
              { valor: false, etiqueta: 'No' },
            ]}
          />
          {error && <p className="cq-error">{error}</p>}
        </div>
      )}

    </section>
  );
}

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
