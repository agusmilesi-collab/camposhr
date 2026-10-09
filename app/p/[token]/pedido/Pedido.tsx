'use client';

/**
 * Pedir una evaluación: la pantalla que reemplaza al WhatsApp con el CV.
 *
 * Lo que se cuida acá es la fricción. El cliente venía de mandar un audio y un
 * archivo, sin decidir nada, así que cada campo que se agrega hay que
 * justificarlo. Las decisiones, en orden de cuánta fricción sacan:
 *
 * 1. **Sus búsquedas se muestran, no se recuerdan.** Nadie sabe de memoria qué
 *    tiene abierto: cada una se ve con su avance ("2 de 3 entregados") y se
 *    elige tocándola. La primera tarjeta es una búsqueda nueva, una que nunca
 *    evaluamos: la pregunta no es si el puesto existe en la empresa, es si de
 *    esa búsqueda ya hicimos algo. Todas están a la vista, las en curso arriba
 *    y las ya entregadas abajo con su rótulo: el cliente no sabe en qué estado
 *    está cada una, sabe qué puesto está cubriendo, y cada tarjeta dice el
 *    puesto, cuándo la pidió y a cuánta gente mandó.
 * 2. **Los CV se sueltan de a varios y llenan las filas.** Se arrastran los
 *    tres al mismo tiempo y de cada uno sale un candidato, con el mail y el
 *    teléfono que el archivo traiga. Es lo que ya tenía en la mano.
 * 3. **Solo tres cosas son obligatorias**: para qué búsqueda, el nombre de cada
 *    candidato y una forma de contactarlo. Todo lo demás se puede saltear.
 * 4. **El perfil del puesto se ofrece y se explica.** Son nueve preguntas de
 *    tocar, no de escribir, y es lo que permite medir a la persona contra el
 *    lugar donde va a entrar. Se carga una vez por búsqueda.
 * 5. **El total está siempre a la vista**, y cambia al elegir. Una decisión de
 *    compra con el precio escondido se posterga.
 */

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Busqueda } from '@/lib/airtable';
import { AVISO_HORIZONTE, PREGUNTAS, UNIDADES, type Unidad } from '@/lib/potencial';
import type { Alcance } from '@/lib/precio-portal';
import type { Contacto } from '@/lib/contactos-tipos';
import Notificaciones from './Notificaciones';
import type { Pregunta } from '@/lib/pedido-campos';
import Elegir from './Elegir';
import OrdenGracias from '@/app/_components/OrdenGracias';
import type { Orden } from '@/lib/orden-compra-tipos';

/** El color de la pastilla de cada batería, el mismo de la página de precios. */
function colorDeBateria(codigo: string): string {
  return `precios-pill-${codigo.match(/\d/)?.[0] ?? '1'}`;
}

/** Cuántos candidatos entran de una vez. */
const MAXIMO = 12;

type Fila = {
  id: number;
  nombre: string;
  telefono: string;
  mail: string;
  cv: File | null;
  /** De qué archivo salieron los datos, para poder decirlo. */
  desdeCv: boolean;
  /**
   * Para qué ciudad es el puesto, en los clientes que la piden. Vacía es la
   * ciudad de siempre (`CIUDAD_BASE`).
   */
  ciudad: string;
  /** Si eligió "Otra ciudad" y la escribe a mano. */
  otraCiudad: boolean;
};

/** La ciudad que el desplegable propone de entrada. */
const CIUDAD_BASE = 'Rosario';
/** El valor de "Otra ciudad" en el desplegable. */
const OTRA = '__otra';

function vacia(id: number): Fila {
  return {
    id,
    nombre: '',
    telefono: '',
    mail: '',
    cv: null,
    desdeCv: false,
    ciudad: '',
    otraCiudad: false,
  };
}

/** La ciudad que va con el candidato: la elegida, la escrita o la de siempre. */
function ciudadDe(f: Fila): string {
  return f.otraCiudad ? f.ciudad.trim() : f.ciudad || CIUDAD_BASE;
}

const pesos = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

/** La cotización sí lleva centavos: es el número contra el que se va a chequear. */
const cotizacion = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(n);

/** "18/9/26": la fecha del pedido, para que el cliente reconozca la búsqueda. */
function diaCorto(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  }).format(d);
}

const dolares = (n: number) => `USD ${new Intl.NumberFormat('es-AR').format(n)}`;

/** El "← Volver" arriba a la derecha, a la altura del título del bloque. */
function Atras({ alVolver }: { alVolver: () => void }) {
  return (
    <button type="button" className="pedir-volver-link" onClick={alVolver}>
      ← Volver
    </button>
  );
}

export default function Pedido({
  token,
  empresa,
  empresas = [],
  busquedas: todasLasBusquedas,
  alcance,
  contactos,
  delPuesto,
  delJefe,
  conCiudad = false,
  ciudades = [],
}: {
  token: string;
  empresa: string;
  /**
   * Las empresas del grupo, cuando el portal es de varias del mismo dueño
   * (Macro Agro, JHB, Campo Simple): lo primero que se contesta es para cuál
   * es el pedido, porque cada una factura lo suyo. Vacío en el resto.
   */
  empresas?: { id: string; nombre: string }[];
  busquedas: Busqueda[];
  alcance: Alcance;
  contactos: Contacto[];
  delPuesto: Pregunta[];
  delJefe: Pregunta[];
  /**
   * Si el cliente pide el mismo puesto para varias ciudades (Federada): cada
   * candidato lleva su ciudad, que se muestra al lado del puesto.
   */
  conCiudad?: boolean;
  /** Las ciudades que este cliente ya usó, para ofrecerlas en el desplegable. */
  ciudades?: string[];
}) {
  const router = useRouter();
  /**
   * A qué búsqueda entra: '' mientras el cliente no contestó si es nueva o una
   * que ya pedimos. La página arranca sin nada elegido, y lo de abajo aparece
   * recién cuando contesta: elegir por él lo haría cargar un puesto que no es.
   * Si elige "una que ya pedimos" y tiene una sola en curso, esa queda marcada.
   */
  const [busqueda, setBusqueda] = useState('');
  /** Si ya contestó la primera pregunta, y qué. */
  const [modo, setModo] = useState<'nueva' | 'existente' | null>(null);
  /**
   * Quién hace el pedido, de los contactos que cargó Campos HR con "pide
   * evaluaciones": el cliente no se da de alta solo. Obligatorio, porque a esa
   * persona le llega la confirmación. Con uno solo ya queda elegido.
   */
  const [contacto, setContacto] = useState(contactos.length === 1 ? contactos[0].id : '');
  const [puesto, setPuesto] = useState('');

  /* Por defecto, la Batería 2 con la evaluación de perfil: es la que más se
     pide. Se busca por su nombre y no por su lugar en la lista. */
  const [bateria, setBateria] = useState(
    alcance.baterias.find((b) => b.codigo === 'Batería 2')?.codigo ??
      alcance.baterias[0]?.codigo ??
      '',
  );
  const [benziger, setBenziger] = useState(true);
  const [descripcion, setDescripcion] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [perfil, setPerfil] = useState<Record<string, string>>({});
  const [verPerfil, setVerPerfil] = useState(false);
  /* El nivel de trabajo del puesto, solo en las baterías que llevan análisis de
     potencial: el plazo de la tarea más larga y las cinco preguntas. */
  const [spanCantidad, setSpanCantidad] = useState('');
  const [spanUnidad, setSpanUnidad] = useState<Unidad>('meses');
  const [complejidad, setComplejidad] = useState<Record<string, boolean>>({});
  const [filas, setFilas] = useState<Fila[]>([vacia(0)]);
  const [proxima, setProxima] = useState(1);
  const [leyendo, setLeyendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  /** La orden de compra de lo que se acaba de cargar, si se pudo generar. */
  const [orden, setOrden] = useState<Orden | null>(null);
  const soltar = useRef<HTMLInputElement>(null);
  /** El alcance del puesto, para llevar la vista hasta él al elegir una batería que lo pide. */
  const alcanceRef = useRef<HTMLDivElement>(null);
  /**
   * En qué paso está. Son tarjetas que se pasan en la misma pantalla, sin
   * recargar: primero para qué búsqueda, después qué evaluación (solo si el
   * puesto es nuevo, porque una búsqueda existente ya tiene la suya) y al
   * final los candidatos.
   */
  const [paso, setPaso] = useState<'busqueda' | 'evaluacion' | 'candidatos'>('busqueda');

  /** Para qué empresa del grupo es. Sin grupo no se pregunta. */
  const enGrupo = empresas.length > 1;
  const [paraCual, setParaCual] = useState('');
  const laEmpresa = empresas.find((e) => e.id === paraCual) ?? null;
  // Elegida la empresa, las búsquedas que se ofrecen son las suyas.
  const busquedas = enGrupo
    ? todasLasBusquedas.filter((b) => b.empresaId === paraCual)
    : todasLasBusquedas;

  const abiertas = busquedas.filter((b) => b.estado !== 'Finalizado');
  const entregadas = busquedas.filter((b) => b.estado === 'Finalizado');
  const elegida = modo === 'existente' ? (busquedas.find((b) => b.id === busqueda) ?? null) : null;
  const esNueva = modo === 'nueva';
  const esExistente = modo === 'existente';
  /* Mientras no contestó, se muestran los tres pasos: es el camino más largo
     y no promete uno más corto que después no se cumpla. */
  const pasos = (
    !esExistente
      ? [
          { clave: 'busqueda', texto: 'El puesto' },
          { clave: 'evaluacion', texto: 'La evaluación' },
          { clave: 'candidatos', texto: 'Los candidatos' },
        ]
      : [
          { clave: 'busqueda', texto: 'El puesto' },
          { clave: 'candidatos', texto: 'Los candidatos' },
        ]
  ) as { clave: typeof paso; texto: string }[];
  /* Si cambia la búsqueda y el paso deja de existir, vuelve al primero. */
  const actual = pasos.some((x) => x.clave === paso) ? paso : 'busqueda';
  const indice = pasos.findIndex((x) => x.clave === actual);
  const ultimo = indice === pasos.length - 1;
  /* El resumen va en el último paso, el de los candidatos: antes cada batería
     ya dice su precio por candidato, y el total recién se define con la
     cantidad de gente. */
  const conResumen = ultimo;

  /**
   * Volver un paso: en el primero deshace la respuesta a "¿Para qué búsqueda
   * es?", y en los otros vuelve al anterior.
   */
  function atras() {
    setError(null);
    if (indice === 0) setModo(null);
    else setPaso(pasos[indice - 1].clave);
  }

  /** Pasar al paso siguiente, si lo de este está completo. */
  function seguir() {
    if (actual === 'busqueda' && !modo) {
      setError('Elegí si ya evaluamos gente para este puesto.');
      return;
    }
    if (actual === 'busqueda' && esNueva && !puesto.trim()) {
      setError('Falta el puesto.');

      return;
    }
    if (actual === 'busqueda' && esExistente && !elegida) {
      setError('Elegí a qué puesto sumás candidatos.');
      return;
    }
    setError(null);
    setPaso(pasos[indice + 1].clave);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const cuantos = filas.filter((f) => f.nombre.trim()).length || 1;
  const laBateria = alcance.baterias.find((b) => b.codigo === (elegida?.bateria ?? bateria));
  const conBenziger = esNueva ? benziger : Boolean(elegida?.conBenziger);
  const benzigerPesos = alcance.dolar ? alcance.benzigerUsd * alcance.dolar : null;

  const porCandidato =
    (laBateria?.precio ?? 0) + (conBenziger && benzigerPesos ? benzigerPesos : 0);
  const total = porCandidato * cuantos;
  const perfilCargado = Object.values(perfil).filter(Boolean).length;

  /** Lo que hay que completar antes de poder mandar, dicho como falta. */
  const faltan = useMemo(() => {
    const f: string[] = [];
    if (esNueva && !puesto.trim()) f.push('el puesto');

    if (!contacto) f.push('quién hace el pedido');
    if (!modo) f.push('elegir el puesto');
    else if (esExistente && !elegida) f.push('elegir el puesto');
    const gente = filas.filter((x) => x.nombre.trim());
    if (gente.length === 0) f.push('al menos un candidato');
    if (gente.some((x) => !x.telefono.trim() && !x.mail.trim()))
      f.push('el teléfono de cada candidato');
    if (conCiudad && gente.some((x) => !ciudadDe(x))) f.push('la ciudad de cada candidato');
    return f;
  }, [modo, esNueva, esExistente, puesto, conCiudad, filas, elegida, contacto]);

  function cambiar(id: number, cambio: Partial<Fila>) {
    setFilas((f) => f.map((x) => (x.id === id ? { ...x, ...cambio } : x)));
  }

  /**
   * Lo que se puede leer de los CV.
   *
   * Los archivos van al servidor, que los abre con el mismo lector que usa el
   * Benziger y devuelve lo que encontró. En el navegador habría que servir el
   * worker de pdfjs y bajar un megabyte por visita.
   *
   * Lo leído queda en campos editables: el mail y el teléfono salen casi
   * siempre, el nombre acierta la mayoría de las veces.
   */
  async function leerCv(archivos: File[]): Promise<Partial<Fila>[]> {
    const cuerpo = new FormData();
    cuerpo.set('token', token);
    for (const a of archivos) cuerpo.append('cv', a);
    try {
      const r = await fetch('/api/portal/cv', { method: 'POST', body: cuerpo });
      if (!r.ok) throw new Error('sin lectura');
      const { leidos } = (await r.json()) as {
        leidos: { nombre: string; mail: string; telefono: string }[];
      };
      return archivos.map((cv, i) => ({
        cv,
        desdeCv: true,
        nombre: leidos[i]?.nombre ?? '',
        mail: leidos[i]?.mail ?? '',
        telefono: leidos[i]?.telefono ?? '',
      }));
    } catch {
      // Si la lectura falla, los archivos se adjuntan igual y los datos se
      // escriben: quedarse sin poder cargar sería peor que escribir tres campos.
      return archivos.map((cv) => ({ cv, desdeCv: false }));
    }
  }

  async function tomarArchivos(lista: FileList | null) {
    const archivos = [...(lista ?? [])].slice(0, MAXIMO);
    if (archivos.length === 0) return;
    setLeyendo(true);
    setError(null);
    try {
      const leidos = await leerCv(archivos);
      setFilas((f) => {
        // Las filas vacías se aprovechan antes de agregar otras nuevas.
        const libres = f.filter((x) => !x.nombre.trim() && !x.cv);
        const usadas = f.filter((x) => x.nombre.trim() || x.cv);
        let n = proxima;
        const nuevas = leidos.map((datos, i) => {
          const hueco = libres[i];
          if (hueco) return { ...hueco, ...datos } as Fila;
          return { ...vacia(n++), ...datos } as Fila;
        });
        setProxima(n);
        return [...usadas, ...nuevas].slice(0, MAXIMO);
      });
    } finally {
      setLeyendo(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    // Un Enter en un campo de un paso intermedio avanza, no manda el pedido.
    if (!ultimo) {
      seguir();
      return;
    }
    if (faltan.length > 0) {
      setError(`Falta ${faltan.join(', ')}.`);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.set('token', token);
      if (enGrupo) cuerpo.set('empresaId', paraCual);
      if (esExistente) cuerpo.set('pedidoId', busqueda);
      else {
        cuerpo.set('puesto', puesto.trim());
        cuerpo.set('bateria', bateria);
        cuerpo.set('benziger', benziger ? 'si' : '');
        cuerpo.set('descripcion', descripcion.trim());
        for (const [campo, valor] of Object.entries(perfil)) {
          if (valor) cuerpo.set(campo, valor);
        }
        // El nivel del puesto viaja tal como se contestó y el servidor saca el
        // estrato: la cuenta es la misma que hace el OS y vive en un solo lado.
        if (laBateria?.conPotencial) {
          if (spanCantidad.trim()) {
            cuerpo.set('spanCantidad', spanCantidad.trim());
            cuerpo.set('spanUnidad', spanUnidad);
          }
          for (const [estrato, si] of Object.entries(complejidad)) {
            cuerpo.set(`complejidad-${estrato}`, si ? 'si' : 'no');
          }
        }
      }
      cuerpo.set('contactoId', contacto);
      cuerpo.set('comentarios', comentarios.trim());

      filas
        .filter((f) => f.nombre.trim())
        .forEach((f, i) => {
          cuerpo.set(`nombre-${i}`, f.nombre.trim());
          cuerpo.set(`telefono-${i}`, f.telefono.trim());
          cuerpo.set(`mail-${i}`, f.mail.trim());
          if (f.cv) cuerpo.set(`cv-${i}`, f.cv);
          if (conCiudad) cuerpo.set(`ciudad-${i}`, ciudadDe(f));
        });

      const r = await fetch('/api/pedidos', { method: 'POST', body: cuerpo });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? 'No se pudo enviar el pedido.');
      setHecho(data.resumen as string);
      setOrden((data.orden as Orden | null) ?? null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el pedido.');
    } finally {
      setEnviando(false);
    }
  }

  /** Deja el formulario como recién abierto, para cargar otro. */
  const empezarDeNuevo = () => {
    setHecho(null);
    setFilas([vacia(0)]);
    setProxima(1);
    setPuesto('');
    setDescripcion('');
    setComentarios('');
    setPerfil({});
    setModo(null);
    setBusqueda('');
    setPaso('busqueda');
    setOrden(null);
  };

  // Con orden, la confirmación es la orden: el gracias, lo que se pidió, cuánto
  // sale y qué sigue. Sin ella (no se pudo generar) queda la de siempre.
  if (hecho && orden) {
    return (
      <OrdenGracias
        orden={orden}
        pdf={`/api/portal/orden/${orden.token}`}
        volver={`/p/${token}`}
      >
        <button type="button" className="og-boton og-boton-claro" onClick={empezarDeNuevo}>
          Cargar otro pedido
        </button>
      </OrdenGracias>
    );
  }

  if (hecho) {
    return (
      <main className="pedir">
        {/* La confirmación: qué entró y qué pasa ahora. No promete un mail de
            confirmación, porque todavía no se manda ninguno. */}
        <div className="pedir-listo">
          <span className="pedir-listo-ok" aria-hidden="true">
            ✓
          </span>
          <h1>Pedido recibido</h1>
          <p className="pedir-listo-resumen">{hecho}</p>
          <ol className="pedir-listo-pasos">
            <li>Asignamos una evaluadora.</li>
            <li>Contactamos a cada candidato para coordinar la entrevista.</li>
            <li>Cuando el informe está listo, aparece en tu portal.</li>
          </ol>
          <p className="pedir-listo-n">El pedido ya figura en tu portal.</p>
          <div className="pedir-acciones">
            <a className="btn-primario" href={`/p/${token}`}>
              Volver al portal
            </a>
            <button type="button" className="btn-sec" onClick={empezarDeNuevo}>
              Cargar otro pedido
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pedir">
      <header className="pedir-top">
        <h1>Pedir una evaluación</h1>
      </header>

      {/* Los pasos, con su número: el cliente ve en qué orden va y cuánto le
          falta. Se puede volver a uno anterior tocándolo. */}
      <ol className="pedir-stepper">
        {pasos.map((x, i) => (
          <li key={x.clave} className={i === indice ? 'actual' : i < indice ? 'hecho' : ''}>
            <button
              type="button"
              disabled={i > indice}
              onClick={() => {
                setError(null);
                setPaso(x.clave);
              }}
            >
              <span className="pedir-stepper-n">{i + 1}</span>
              {x.texto}
            </button>
          </li>
        ))}
      </ol>

      <form
        className={`pedir-cuerpo${conResumen ? '' : ' pedir-cuerpo-solo'}${
          actual === 'busqueda' ? ' pedir-cuerpo-parejo' : ''
        }`}
        onSubmit={enviar}
      >
        <div className="pedir-campos">
          {actual === 'busqueda' && (
            <>
              {/* Las búsquedas se muestran y no se recuerdan: nadie sabe de memoria
              qué tiene abierto. Cada una con su avance, para reconocerla. */}
              {/* Contestada la primera pregunta, se va: lo que sigue es lo que
                  corresponde a esa respuesta, con un "Volver" para cambiarla. */}
              {(!modo || esExistente) && (
                <section className="pedir-bloque">
                  {/* En un grupo de empresas, lo primero es para cuál es: cada
                      una factura sus candidatos. Con una sola no se pregunta. */}
                  {!modo && enGrupo && !laEmpresa && (
                    <>
                      <div className="pedir-titulo-fila">
                        <h2 className="pedir-pregunta-grande">¿Para qué empresa es?</h2>
                        <a className="pedir-volver-link" href={`/p/${token}`}>
                          ← Volver
                        </a>
                      </div>
                      {/* Todas en un renglón: son pocas y se eligen de un vistazo. */}
                      <div
                        className="pedir-tarjetas pedir-empresas"
                        style={{ '--pedir-empresas': empresas.length } as React.CSSProperties}
                      >
                        {empresas.map((e) => (
                          <button
                            type="button"
                            className="pedir-tarjeta"
                            key={e.id}
                            onClick={() => {
                              setParaCual(e.id);
                              setBusqueda('');
                              setError(null);
                            }}
                          >
                            <span className="pedir-tarjeta-t">{e.nombre}</span>
                            <span className="pedir-tarjeta-d">Se factura a su nombre</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {!modo && (!enGrupo || laEmpresa) && (
                    <>
                      {/* Antes de contestar, "Volver" lleva al portal: es el
                          mismo lugar del "Volver" de los demás pasos. En un
                          grupo vuelve a la pregunta de la empresa. */}
                      <div className="pedir-titulo-fila">
                        <h2 className="pedir-pregunta-grande">
                          ¿Para qué puesto es{laEmpresa ? `, en ${laEmpresa.nombre}` : ''}?
                        </h2>
                        {laEmpresa ? (
                          <Atras alVolver={() => setParaCual('')} />
                        ) : (
                          <a className="pedir-volver-link" href={`/p/${token}`}>
                            ← Volver
                          </a>
                        )}
                      </div>
                      {/* Todas a la vista, las en curso y las ya entregadas: el
                    cliente no sabe en qué estado está cada una, sabe qué puesto
                    está cubriendo. Por eso cada tarjeta dice el puesto, cuándo
                    la pidió y a cuánta gente mandó, que es lo que reconoce. */}
                      {/* Primero la decisión, que es de dos: una búsqueda nueva o
                    una que ya pedimos. Recién si es una que ya pedimos se
                    muestra la lista para elegir cuál. */}
                      <div className="pedir-tarjetas pedir-dos">
                        <button
                          type="button"
                          className={`pedir-tarjeta${esNueva ? ' pedir-elegida' : ''}`}
                          onClick={() => {
                            setModo('nueva');
                            setError(null);
                          }}
                        >
                          <span className="pedir-tarjeta-t">Primera evaluación para este puesto</span>
                          <span className="pedir-tarjeta-d">Lo cargás desde cero</span>
                        </button>
                        <button
                          type="button"
                          className={`pedir-tarjeta${esExistente ? ' pedir-elegida' : ''}`}
                          onClick={() => {
                            if (!esExistente)
                              setBusqueda(abiertas.length === 1 ? abiertas[0].id : '');
                            setModo('existente');
                            setError(null);
                          }}
                          disabled={busquedas.length === 0}
                        >
                          <span className="pedir-tarjeta-t">Ya evaluamos gente para este puesto</span>
                          <span className="pedir-tarjeta-d">
                            {busquedas.length === 0
                              ? 'Todavía no hay ninguna'
                              : 'Sumás candidatos a ese puesto'}
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                  {esExistente && (
                    <>
                      {/* La pregunta con el "Volver" a su derecha, en la misma línea. */}
                      <div className="pedir-titulo-fila pedir-cual">
                        <p className="pedir-pregunta-t">¿A qué puesto querés sumar candidatos?</p>
                        <Atras alVolver={atras} />
                      </div>
                      {/* Una sola lista, las activas primero y después las
                          inactivas. Cada tarjeta dice su estado con el punto y
                          la palabra: verde activa, gris inactiva. */}
                      <div className="pedir-tarjetas">
                        {[...abiertas, ...entregadas].map((b) => {
                          const activa = b.estado !== 'Finalizado';
                          return (
                            <button
                              type="button"
                              key={b.id}
                              className={`pedir-tarjeta${activa ? '' : ' pedir-inactiva'}${
                                busqueda === b.id ? ' pedir-elegida' : ''
                              }`}
                              /* Elegir el puesto ya contesta la pregunta: pasa
                                 solo a los candidatos, y si se equivocó tiene
                                 Volver. */
                              onClick={() => {
                                setBusqueda(b.id);
                                setError(null);
                                setPaso('candidatos');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                            >
                              <span className="pedir-tarjeta-t">{b.puesto}</span>
                              {/* La batería con su sigla y la fecha al lado: "B3 + bzg · 30/9/26". */}
                              <span className="pedir-tarjeta-d">
                                {[
                                  b.bateria
                                    ? `${b.bateria.replace(/^Bater[ií]a\s*/i, 'B')}${b.conBenziger ? ' + bzg' : ''}`
                                    : 'Batería a confirmar',
                                  b.fecha ? diaCorto(b.fecha) : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                              {/* El estado, último en la tarjeta. */}
                              <span className="pedir-estado">
                                <span className={`pedir-punto${activa ? ' activa' : ''}`} />
                                {activa ? 'Activo' : 'Inactivo'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {/* Qué pasa con la búsqueda elegida, en un solo texto: si está
                    entregada se reabre, y con qué se evalúa. */}
                  {esExistente && (entregadas.length > 0 || elegida) && (
                    <p className="pedir-ayuda pedir-ayuda-junta">
                      {entregadas.length > 0 &&
                        'Si sumás candidatos a un puesto inactivo, lo volvemos a abrir con la misma evaluación. '}
                      {elegida &&
                        `Se evalúan con ${elegida.bateria ?? 'la batería de ese puesto'}${
                          elegida.conBenziger ? ' más la evaluación de perfil' : ''
                        }, que es lo acordado para ese puesto.`}
                    </p>
                  )}
                </section>
              )}
            </>
          )}

          {esNueva && (
            <>
              {actual === 'busqueda' && (
                <section className="pedir-bloque">
                  <div className="pedir-titulo-fila">
                    <h2>El puesto</h2>
                    <Atras alVolver={atras} />
                  </div>
                  <input
                    className="pedir-input"
                    value={puesto}
                    maxLength={120}
                    placeholder="Jefe de Depósito"
                    onChange={(e) => setPuesto(e.target.value)}
                  />
                  <textarea
                    className="pedir-input pedir-area"
                    rows={3}
                    maxLength={4000}
                    value={descripcion}
                    placeholder="Qué hace, de quién depende, a cuántas personas conduce, qué decide."
                    onChange={(e) => setDescripcion(e.target.value)}
                  />

                  {/* El perfil del puesto en su propio recuadro, con título: el
                      texto y el botón se leen como una sola cosa, y las nueve
                      preguntas se abren adentro. */}
                  <div className="pedir-perfil-caja">
                    <h3 className="pedir-perfil-titulo">Perfil del puesto</h3>
                    <p className="pedir-ayuda">
                      Nueve preguntas de opción múltiple. Con ellas, la recomendación considera las
                      condiciones del puesto además del perfil de la persona.{' '}
                      <strong className="pedir-destacado">Es opcional y sugerido.</strong>
                    </p>
                    <button
                      type="button"
                      className="pedir-abrir"
                      onClick={() => setVerPerfil((v) => !v)}
                    >
                      {verPerfil ? 'Cerrar' : 'Completar el perfil del puesto'}
                      {perfilCargado > 0 && (
                        <span className="pedir-cuenta">{perfilCargado} de 9</span>
                      )}
                    </button>
                    {verPerfil && (
                      <div className="pedir-perfil">
                        {[
                          { titulo: 'Del puesto', preguntas: delPuesto },
                          { titulo: 'De quien lo conduce', preguntas: delJefe },
                        ].map((grupo) => (
                          <div key={grupo.titulo}>
                            <h3>{grupo.titulo}</h3>
                            {grupo.preguntas.map((p) => (
                              <div className="pedir-pregunta" key={p.campo}>
                                <span className="pedir-pregunta-t">{p.rotulo}</span>
                                <div className="pedir-opciones" role="group" aria-label={p.rotulo}>
                                  {/* Un control partido en tres y no tres botones
                                  sueltos: es una escala de menos a más con una
                                  sola respuesta, y así se ve. */}
                                  {p.opciones.map((o, i) => (
                                    <button
                                      type="button"
                                      key={o}
                                      aria-pressed={perfil[p.campo] === o}
                                      className={`pedir-opcion${
                                        perfil[p.campo] === o ? ' pedir-elegida' : ''
                                      }`}
                                      onClick={() =>
                                        setPerfil((v) => ({
                                          ...v,
                                          [p.campo]: v[p.campo] === o ? '' : o,
                                        }))
                                      }
                                    >
                                      <span className="pedir-opcion-n">{o}</span>
                                      {/* Qué significa esa opción: quien contesta no
                                      trabaja acá, y "problemas mixtos" se
                                      entiende distinto en cada empresa. */}
                                      {p.ayudas[i] && (
                                        <span className="pedir-opcion-q">{p.ayudas[i]}</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {actual === 'evaluacion' && (
                <>
                  <section className="pedir-bloque">
                    <div className="pedir-titulo-fila">
                      <h2>Elegir evaluación</h2>
                      <Atras alVolver={atras} />
                    </div>
                    <div className="pedir-baterias">
                      {alcance.baterias.map((b) => (
                        <button
                          type="button"
                          key={b.codigo}
                          className={`pedir-bateria${bateria === b.codigo ? ' pedir-elegida' : ''}`}
                          onClick={() => {
                            setBateria(b.codigo);
                            // Si la batería lleva potencial, el alcance se abre
                            // debajo y la vista va hasta él.
                            if (b.conPotencial)
                              setTimeout(
                                () =>
                                  alcanceRef.current?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start',
                                  }),
                                60,
                              );
                          }}
                        >
                          {/* El código arriba de todo, en pastilla y con su color
                          como en la página de precios: es el nombre con el que
                          se pide y con el que después figura en la factura, así
                          que es lo que ubica la tarjeta antes de leerla. */}
                          <span className="pedir-bateria-cod">
                            <span className={`precios-pill ${colorDeBateria(b.codigo)}`}>
                              {b.codigo}
                            </span>
                            {b.minutos && <span className="pedir-min">{b.minutos} min</span>}
                          </span>
                          <span className="pedir-bateria-para">{b.paraQuien}</span>
                          <span className="pedir-bateria-que">{b.queIncluye}</span>
                          <span className="pedir-bateria-precio">
                            {b.precio ? `${pesos(b.precio)} por candidato` : 'A convenir'}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* ── El alcance del puesto ────────────────────────────────
                    Solo en las baterías que llevan análisis de potencial. El
                    informe compara lo que la persona puede abordar hoy contra lo
                    que el puesto exige, y esa segunda mitad la sabe el cliente:
                    sin ella el informe dice en qué nivel está la persona y deja
                    la cuenta que importa sin hacer. */}
                    {laBateria?.conPotencial && (
                      <div className="pedir-alcance" ref={alcanceRef}>
                        <h3 className="pedir-alcance-t">El alcance del puesto</h3>
                        <p className="pedir-ayuda">
                          {alcance.baterias.find((b) => b.conPotencial)?.codigo ?? 'Esta batería'}{' '}
                          incluye el análisis de potencial, que dice hasta qué complejidad de
                          trabajo puede llegar la persona. Para que el informe diga si eso alcanza
                          para este puesto, necesitamos saber qué exige el puesto.
                        </p>

                        <div className="pedir-pregunta">
                          <span className="pedir-pregunta-t">
                            ¿Cuál es la tarea de mayor alcance temporal de la que responde este
                            puesto, y cuándo se sabe si su resultado salió bien?
                          </span>
                          <p className="pedir-nota">{AVISO_HORIZONTE}</p>
                          {/* En el método el plazo lo fija quien asigna la tarea, y
                          quien carga el pedido suele ser Recursos Humanos. */}
                          <p className="pedir-nota">
                            Si no sos el jefe directo del puesto, confirmá con él qué tarea le
                            asigna y para cuándo espera el resultado.
                          </p>
                          <div className="pedir-span">
                            <input
                              className="pedir-input pedir-span-num"
                              inputMode="decimal"
                              value={spanCantidad}
                              placeholder="0"
                              onChange={(e) =>
                                setSpanCantidad(e.target.value.replace(/[^\d,.]/g, '').slice(0, 5))
                              }
                            />
                            <select
                              className="pedir-input pedir-span-unidad"
                              value={spanUnidad}
                              onChange={(e) => setSpanUnidad(e.target.value as Unidad)}
                            >
                              {UNIDADES.map((u) => (
                                <option key={u.clave} value={u.clave}>
                                  {u.texto}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Las cinco, por sí o por no. Se contestan de arriba hacia
                        abajo y valen las que sí: la más alta contestada que sí es
                        la que manda. */}
                        <div className="pedir-pregunta">
                          <span className="pedir-pregunta-t">
                            ¿Qué exige el trabajo que va a hacer quien ocupe el puesto?
                          </span>
                          {PREGUNTAS.map((p) => (
                            <div className="pedir-si-no" key={p.estrato}>
                              <span className="pedir-si-no-t">
                                <strong>{p.corto}</strong>
                                <small>{p.simple}</small>
                                {/* Un puesto cualquiera que contesta que sí: quien no
                                conoce el modelo necesita contra qué comparar. */}
                                <small className="pedir-ejemplo">Por ejemplo: {p.ejemplo}</small>
                              </span>
                              <div className="pedir-opciones" role="group" aria-label={p.corto}>
                                {[
                                  { v: true, t: 'Sí' },
                                  { v: false, t: 'No' },
                                ].map((o) => (
                                  <button
                                    type="button"
                                    key={o.t}
                                    aria-pressed={complejidad[String(p.estrato)] === o.v}
                                    className={`pedir-opcion${
                                      complejidad[String(p.estrato)] === o.v ? ' pedir-elegida' : ''
                                    }`}
                                    onClick={() =>
                                      setComplejidad((c) => {
                                        const nueva = { ...c };
                                        if (nueva[String(p.estrato)] === o.v)
                                          delete nueva[String(p.estrato)];
                                        else nueva[String(p.estrato)] = o.v;
                                        return nueva;
                                      })
                                    }
                                  >
                                    {o.t}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className={`pedir-suma${benziger ? ' pedir-elegida' : ''}`}
                      aria-pressed={benziger}
                      onClick={() => setBenziger((v) => !v)}
                    >
                      <span className="pedir-suma-tilde" aria-hidden="true">
                        {benziger ? '✓' : ''}
                      </span>
                      <span className="pedir-suma-cuerpo">
                        {/* Con el nombre del instrumento: es el que figura en el
                        capítulo del informe y por el que el cliente lo pide. */}
                        <span className="pedir-suma-t">
                          Sumar evaluación de perfil de pensamiento
                          <span className="pedir-suma-instrumento">
                            BZG Thinking Styles Assessment (BTSA)
                          </span>
                        </span>
                        <span className="pedir-suma-d">
                          Cómo piensa y cómo decide, y qué le cuesta sostener. Es lo que permite
                          decir cómo va a trabajar con su jefe y con su equipo, y no solo si el
                          puesto le queda.
                        </span>
                        {/* En dólares primero, que es como está fijado, y la
                        conversión de hoy al lado: el cliente tiene que saber
                        que hasta la factura el precio sigue dolarizado. */}
                        <span className="pedir-suma-precio">
                          {dolares(alcance.benzigerUsd)} por candidato
                          {benzigerPesos && (
                            <span className="pedir-suma-n">
                              Hoy son {pesos(benzigerPesos)}, al dólar tarjeta de{' '}
                              {cotizacion(alcance.dolar as number)}. Se factura en pesos, al del día
                              en que se emite.
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </section>
                </>
              )}
            </>
          )}

          {actual === 'candidatos' && (
            <>
              {/* Los CV se sueltan de a varios: es lo que el cliente ya tiene en la
              mano, y de cada uno sale un candidato con lo que el archivo traiga. */}
              <section className="pedir-bloque">
                <div className="pedir-titulo-fila">
                  <h2>Los candidatos</h2>
                  <Atras alVolver={atras} />
                </div>

                <div
                  className="pedir-soltar"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    tomarArchivos(e.dataTransfer.files);
                  }}
                  onClick={() => soltar.current?.click()}
                >
                  <input
                    ref={soltar}
                    type="file"
                    multiple
                    accept=".pdf,application/pdf"
                    hidden
                    onChange={(e) => tomarArchivos(e.target.files)}
                  />
                  <span className="pedir-soltar-t">
                    {leyendo ? 'Leyendo los CV…' : 'Soltá acá los CV'}
                  </span>
                  <span className="pedir-soltar-d">
                    Todos juntos. De cada uno sacamos el nombre y el contacto, y quedan para
                    corregir.
                  </span>
                </div>

                {filas.map((f, n) => (
                  <div className="pedir-fila" key={f.id}>
                    <div className="pedir-fila-top">
                      <span className="pedir-n">{n + 1}</span>
                      {f.cv && <span className="pedir-cv">{f.cv.name}</span>}
                      {filas.length > 1 && (
                        <button
                          type="button"
                          className="pedir-sacar"
                          onClick={() => setFilas((x) => x.filter((y) => y.id !== f.id))}
                        >
                          Sacar
                        </button>
                      )}
                    </div>
                    <div className={`pedir-tres pedir-sin-mail${conCiudad ? ' con-ciudad' : ''}`}>
                      <input
                        className="pedir-input"
                        placeholder="Nombre y apellido"
                        value={f.nombre}
                        maxLength={120}
                        onChange={(e) => cambiar(f.id, { nombre: e.target.value })}
                      />
                      <input
                        className="pedir-input"
                        placeholder="Teléfono"
                        value={f.telefono}
                        maxLength={40}
                        onChange={(e) => cambiar(f.id, { telefono: e.target.value })}
                      />
                      {/* Sin campo de mail: era un paso más para el cliente y
                          al candidato se lo cita por teléfono. Si el CV trae
                          el mail, viaja igual. */}
                      {/* El mismo puesto se pide para varias ciudades: cada
                          candidato dice para cuál. */}
                      {/* La ciudad del puesto, no la de la persona: un
                          desplegable que arranca en la de siempre y ofrece
                          las que el cliente ya usó, o una nueva a mano. */}
                      {conCiudad && (
                        <label className="pedir-locacion">
                          <span className="pedir-locacion-t">Locación / Sucursal</span>
                          <Elegir
                          valor={f.otraCiudad ? OTRA : f.ciudad || CIUDAD_BASE}
                          opciones={[
                            ...[CIUDAD_BASE, ...ciudades.filter((c) => c !== CIUDAD_BASE)].map(
                              (c) => ({ valor: c, texto: c })
                            ),
                            { valor: OTRA, texto: 'Otra locación' },
                          ]}
                          alElegir={(v) =>
                            cambiar(
                              f.id,
                              v === OTRA
                                ? { otraCiudad: true, ciudad: '' }
                                : { otraCiudad: false, ciudad: v }
                            )
                          }
                          vacio="Elegí la locación"
                          etiqueta="Locación o sucursal del puesto"
                          />
                        </label>
                      )}
                      {conCiudad && f.otraCiudad && (
                        <input
                          className="pedir-input"
                          placeholder="Escribí la locación o sucursal"
                          value={f.ciudad}
                          maxLength={60}
                          autoFocus
                          onChange={(e) => cambiar(f.id, { ciudad: e.target.value })}
                        />
                      )}
                    </div>
                  </div>
                ))}

                {filas.length < MAXIMO && (
                  <button
                    type="button"
                    className="pedir-abrir pedir-abrir--firme"
                    onClick={() => {
                      setFilas((f) => [...f, vacia(proxima)]);
                      setProxima((n) => n + 1);
                    }}
                  >
                    + Agregar otro candidato
                  </button>
                )}
              </section>

              <section className="pedir-bloque">
                <h2>Algo más que quieras avisarnos</h2>
                <textarea
                  className="pedir-input pedir-area"
                  rows={3}
                  maxLength={2000}
                  value={comentarios}
                  placeholder="Urgencias, disponibilidad de los candidatos, lo que sea."
                  onChange={(e) => setComentarios(e.target.value)}
                />
              </section>
            </>
          )}
        </div>
        {/* Atrás y siguiente, al pie de la tarjeta: en el último paso el
            botón es el de mandar, que está en el resumen. */}
        <div className="pedir-navegar">
          {/* Sin botón donde la respuesta es tocar una tarjeta: antes de elegir
              si es un puesto nuevo, y al elegir a qué puesto se suman
              candidatos, que ya avanza solo. */}
          {!ultimo && !(actual === 'busqueda' && (!modo || esExistente)) && (
            <button type="button" className="btn-primario" onClick={seguir}>
              Próximo paso
            </button>
          )}
          {!ultimo && error && <p className="pedir-error">{error}</p>}
        </div>

        {/* El resumen, solo cuando ya dice algo (ver `conResumen`). */}
        {conResumen && (
          <>
            {/* El resumen queda a la vista mientras se elige: el total con el precio
            escondido es una decisión que se posterga. */}
            <aside className="pedir-resumen">
              <div className="pedir-resumen-caja">
                <h2>Tu pedido</h2>
                {/* Para qué empresa del grupo es: a su nombre sale todo. */}
                {laEmpresa && (
                  <div className="pedir-linea">
                    <span>{laEmpresa.nombre}</span>
                  </div>
                )}
                <div className="pedir-linea">
                  <span>{esNueva ? puesto.trim() || 'Puesto nuevo' : elegida?.puesto}</span>
                </div>
                <div className="pedir-linea">
                  <span>{laBateria?.codigo ?? 'Sin batería'}</span>
                  <span>{laBateria?.precio ? pesos(laBateria.precio) : '—'}</span>
                </div>
                {conBenziger && (
                  <div className="pedir-linea">
                    <span>Cuestionario de perfil</span>
                    <span>
                      {dolares(alcance.benzigerUsd)}
                      {benzigerPesos && (
                        <span className="pedir-linea-pesos">{pesos(benzigerPesos)}</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="pedir-linea pedir-linea-cuenta">
                  <span>
                    {cuantos} {cuantos === 1 ? 'candidato' : 'candidatos'}
                  </span>
                  <span>× {cuantos}</span>
                </div>
                <div className="pedir-total">
                  <span>Total</span>
                  <span>{total > 0 ? pesos(total) : 'A convenir'}</span>
                </div>

                {/* Qué parte del total está dolarizada: hasta que se emite la
                factura, esos dólares valen lo que valga el dólar ese día. */}
                {conBenziger && (
                  <div className="pedir-linea pedir-linea-usd">
                    <span>De ese total, en dólares</span>
                    <span>{dolares(alcance.benzigerUsd * cuantos)}</span>
                  </div>
                )}

                <p className="pedir-resumen-n">
                  Precios de hoy, sin IVA.
                  {conBenziger && alcance.dolar
                    ? ` La evaluación de perfil está fijada en dólares y se factura en pesos, al dólar tarjeta del día en que se emite la factura. Hoy está ${cotizacion(alcance.dolar)}.`
                    : ''}
                </p>

                {/* Quién lo envía, al final y junto al botón: es el momento de
                    firmar el pedido, y el cliente arranca directo por la
                    búsqueda. Solo las personas que cargó Campos HR. */}
                <div className="pedir-firma">
                  <span className="pedir-firma-t">Enviar como</span>
                  <Elegir
                    valor={contacto}
                    vacio={contactos.length === 0 ? 'No hay personas cargadas' : 'Elegí tu nombre'}
                    etiqueta="Quién envía el pedido"
                    opciones={contactos.map((c) => ({ valor: c.id, texto: c.nombre }))}
                    alElegir={(v) => {
                      setContacto(v);
                      setError(null);
                    }}
                  />
                  {/* Con el nombre elegido, la persona decide qué avisos quiere
                      recibir por correo. */}
                  {contacto && <Notificaciones token={token} contactos={contactos} elegido={contacto} />}
                  {contactos.length === 0 && (
                    <p className="pedir-error">
                      Todavía no tenés personas habilitadas para pedir evaluaciones. Escribinos y te
                      damos de alta.
                    </p>
                  )}
                </div>

                {error && <p className="pedir-error">{error}</p>}
                {/* Lo que falta se dice recién en el último paso: antes todavía no
                toca cargarlo. */}
                {ultimo && faltan.length > 0 && !error && (
                  <p className="pedir-falta">Falta {faltan.join(', ')}.</p>
                )}

                {/* El botón de mandar aparece en el paso de los candidatos: antes no
                    hay qué mandar. */}
                {ultimo && (
                  <button
                    type="submit"
                    className="btn-primario pedir-enviar"
                    disabled={enviando || faltan.length > 0}
                  >
                    {enviando ? 'Enviando…' : 'Enviar el pedido'}
                  </button>
                )}
              </div>
            </aside>
          </>
        )}
      </form>
    </main>
  );
}
