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
 *    elige tocándola. La primera tarjeta es un puesto nuevo. Las ya entregadas
 *    quedan detrás de "Ver búsquedas anteriores": son la mayor parte de la
 *    lista al año de trabajar juntos y taparían las que están abiertas.
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
import type { Pregunta } from '@/lib/pedido-campos';

/** El valor que dice que es un puesto que todavía no existe. */
const NUEVA = 'nueva';

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
};

function vacia(id: number): Fila {
  return { id, nombre: '', telefono: '', mail: '', cv: null, desdeCv: false };
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

const dolares = (n: number) => `USD ${new Intl.NumberFormat('es-AR').format(n)}`;

export default function Pedido({
  token,
  empresa,
  busquedas,
  alcance,
  contactos,
  delPuesto,
  delJefe,
}: {
  token: string;
  empresa: string;
  busquedas: Busqueda[];
  alcance: Alcance;
  contactos: Contacto[];
  delPuesto: Pregunta[];
  delJefe: Pregunta[];
}) {
  const router = useRouter();
  /**
   * A qué búsqueda entra. Arranca en la única abierta, si hay una sola.
   *
   * Lo más común es sumarle candidatos a la búsqueda que está en curso, y con
   * una sola abierta la elección ya está tomada: pedirla igual es un clic que
   * no decide nada. Con dos o más no se elige por el cliente, porque errarle
   * manda al candidato a otro puesto.
   */
  const [busqueda, setBusqueda] = useState(() => {
    const enCurso = busquedas.filter((b) => b.estado !== 'Finalizado');
    return enCurso.length === 1 ? enCurso[0].id : NUEVA;
  });
  /**
   * Si se muestran las búsquedas ya entregadas.
   *
   * Van escondidas: lo normal es sumar candidatos a lo que está abierto o abrir
   * un puesto nuevo, y con un año de trabajo encima las entregadas son la mayor
   * parte de la lista y tapan las tres que importan. Sumarle candidatos a una
   * entregada la reabre, que es una decisión y no el camino de todos los días.
   */
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [contacto, setContacto] = useState(contactos[0]?.id ?? '');
  const [puesto, setPuesto] = useState('');
  const [bateria, setBateria] = useState(alcance.baterias[1]?.codigo ?? alcance.baterias[0]?.codigo ?? '');
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
  const soltar = useRef<HTMLInputElement>(null);

  const abiertas = busquedas.filter((b) => b.estado !== 'Finalizado');
  const entregadas = busquedas.filter((b) => b.estado === 'Finalizado');
  const elegida = busquedas.find((b) => b.id === busqueda) ?? null;
  const esNueva = busqueda === NUEVA;

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
    const gente = filas.filter((x) => x.nombre.trim());
    if (gente.length === 0) f.push('al menos un candidato');
    if (gente.some((x) => !x.telefono.trim() && !x.mail.trim()))
      f.push('un teléfono o un mail de cada candidato');
    return f;
  }, [esNueva, puesto, filas]);

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
    if (faltan.length > 0) {
      setError(`Falta ${faltan.join(', ')}.`);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.set('token', token);
      if (!esNueva) cuerpo.set('pedidoId', busqueda);
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
      if (contacto) cuerpo.set('contactoId', contacto);
      cuerpo.set('comentarios', comentarios.trim());

      filas
        .filter((f) => f.nombre.trim())
        .forEach((f, i) => {
          cuerpo.set(`nombre-${i}`, f.nombre.trim());
          cuerpo.set(`telefono-${i}`, f.telefono.trim());
          cuerpo.set(`mail-${i}`, f.mail.trim());
          if (f.cv) cuerpo.set(`cv-${i}`, f.cv);
        });

      const r = await fetch('/api/pedidos', { method: 'POST', body: cuerpo });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? 'No se pudo enviar el pedido.');
      setHecho(data.resumen as string);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el pedido.');
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <main className="pedir">
        <div className="pedir-listo">
          <h1>Pedido recibido</h1>
          <p>{hecho}</p>
          <p className="pedir-listo-n">
            Lo tomamos y coordinamos las entrevistas. Ya aparece en el listado de tu
            portal.
            {contactos.find((c) => c.id === contacto)?.email
              ? ` Te mandamos la confirmación a ${contactos.find((c) => c.id === contacto)?.email}.`
              : ''}
          </p>
          <div className="pedir-acciones">
            <a className="btn-primario" href={`/p/${token}`}>
              Volver al portal
            </a>
            <button
              type="button"
              className="btn-sec"
              onClick={() => {
                setHecho(null);
                setFilas([vacia(0)]);
                setProxima(1);
                setPuesto('');
                setDescripcion('');
                setComentarios('');
                setPerfil({});
              }}
            >
              Cargar otro
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pedir">
      <header className="pedir-top">
        <a className="pedir-volver" href={`/p/${token}`}>
          ← {empresa}
        </a>
        <h1>Pedir una evaluación</h1>
        <p className="pedir-bajada">
          Con el puesto y los candidatos alcanza. Lo demás ayuda a afinar la
          recomendación y se puede completar después.
        </p>
      </header>

      <form className="pedir-cuerpo" onSubmit={enviar}>
        <div className="pedir-campos">
          {contactos.length > 0 && (
            <section className="pedir-bloque">
              <h2>Quién lo pide</h2>
              <p className="pedir-ayuda">
                A esa persona le llega la confirmación y con ella coordinamos.
              </p>
              <select
                className="pedir-select"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
              >
                {contactos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cargo ? `${c.nombre} · ${c.cargo}` : c.nombre}
                  </option>
                ))}
              </select>
            </section>
          )}

          {/* Las búsquedas se muestran y no se recuerdan: nadie sabe de memoria
              qué tiene abierto. Cada una con su avance, para reconocerla. */}
          <section className="pedir-bloque">
            <h2>Para qué búsqueda</h2>
            <div className="pedir-tarjetas">
              <button
                type="button"
                className={`pedir-tarjeta${esNueva ? ' pedir-elegida' : ''}`}
                onClick={() => setBusqueda(NUEVA)}
              >
                <span className="pedir-tarjeta-t">Es un puesto nuevo</span>
                <span className="pedir-tarjeta-d">Lo definimos acá abajo</span>
              </button>

              {abiertas.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  className={`pedir-tarjeta${busqueda === b.id ? ' pedir-elegida' : ''}`}
                  onClick={() => setBusqueda(b.id)}
                >
                  <span className="pedir-tarjeta-t">{b.puesto}</span>
                  <span className="pedir-tarjeta-d">
                    {b.candidatos.length === 0
                      ? 'Sin candidatos todavía'
                      : `${b.candidatos.filter((c) => c.tieneInforme).length} de ${
                          b.candidatos.length
                        } entregados`}
                  </span>
                </button>
              ))}

              {/* Las entregadas salen solo si se piden, o si hay una elegida:
                  escondida la que está elegida, el formulario diría que se
                  está cargando para un puesto que no se ve en ningún lado. */}
              {(verAnteriores || entregadas.some((b) => b.id === busqueda)) &&
                entregadas.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    className={`pedir-tarjeta pedir-cerrada${
                      busqueda === b.id ? ' pedir-elegida' : ''
                    }`}
                    onClick={() => setBusqueda(b.id)}
                  >
                    <span className="pedir-tarjeta-t">{b.puesto}</span>
                    <span className="pedir-tarjeta-d">
                      Entregada · sumar candidatos la reabre
                    </span>
                  </button>
                ))}
            </div>

            {entregadas.length > 0 && !entregadas.some((b) => b.id === busqueda) && (
              <button
                type="button"
                className="pedir-anteriores"
                onClick={() => setVerAnteriores((v) => !v)}
              >
                {verAnteriores
                  ? 'Ocultar las búsquedas anteriores'
                  : `Ver búsquedas anteriores (${entregadas.length})`}
              </button>
            )}
            {elegida && (
              <p className="pedir-ayuda">
                Se evalúan con {elegida.bateria ?? 'la batería de esa búsqueda'}
                {elegida.conBenziger ? ' más la evaluación de perfil' : ''}, que es lo
                acordado para ese puesto.
              </p>
            )}
          </section>

          {esNueva && (
            <>
              <section className="pedir-bloque">
                <h2>El puesto</h2>
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

                {/* El perfil: nueve preguntas de tocar. Es lo que permite medir a
                    la persona contra el lugar donde va a entrar, y por eso se
                    explica en vez de aparecer como más campos. */}
                <button
                  type="button"
                  className="pedir-abrir"
                  onClick={() => setVerPerfil((v) => !v)}
                >
                  {verPerfil ? 'Cerrar' : 'Contanos del contexto'}
                  {perfilCargado > 0 && (
                    <span className="pedir-cuenta">{perfilCargado} de 9</span>
                  )}
                </button>
                <p className="pedir-ayuda">
                  Nueve preguntas de un toque. Con ellas la recomendación deja de
                  hablar solo de la persona y pasa a decir cómo le va a ir en este
                  puesto, con este jefe. Es opcional y se responde una vez por
                  búsqueda.
                </p>

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
                              {p.opciones.map((o) => (
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
                                  {o}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="pedir-bloque">
                <h2>Elegir evaluación</h2>
                <div className="pedir-baterias">
                  {alcance.baterias.map((b) => (
                    <button
                      type="button"
                      key={b.codigo}
                      className={`pedir-bateria${bateria === b.codigo ? ' pedir-elegida' : ''}`}
                      onClick={() => setBateria(b.codigo)}
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
                      Cómo piensa y cómo decide, y qué le cuesta sostener. Es lo que
                      permite decir cómo va a trabajar con su jefe y con su equipo, y no
                      solo si el puesto le queda.
                    </span>
                    {/* En dólares primero, que es como está fijado, y la
                        conversión de hoy al lado: el cliente tiene que saber
                        que hasta la factura el precio sigue dolarizado. */}
                    <span className="pedir-suma-precio">
                      {dolares(alcance.benzigerUsd)} por candidato
                      {benzigerPesos && (
                        <span className="pedir-suma-n">
                          Hoy son {pesos(benzigerPesos)}, al dólar tarjeta de{' '}
                          {cotizacion(alcance.dolar as number)}. Se factura en pesos, al
                          del día en que se emite.
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </section>

              {/* ── El alcance del puesto ────────────────────────────────
                  Solo en las baterías que llevan análisis de potencial. El
                  informe compara lo que la persona puede abordar hoy contra lo
                  que el puesto exige, y esa segunda mitad la sabe el cliente:
                  sin ella el informe dice en qué nivel está la persona y deja
                  la cuenta que importa sin hacer. */}
              {laBateria?.conPotencial && (
                <section className="pedir-bloque">
                  <h2>El alcance del puesto</h2>
                  <p className="pedir-ayuda">
                    {alcance.baterias.find((b) => b.conPotencial)?.codigo ?? 'Esta batería'}{' '}
                    incluye el análisis de potencial, que dice hasta qué complejidad de
                    trabajo puede llegar la persona. Para que el informe diga si eso
                    alcanza para este puesto, necesitamos saber qué exige el puesto.
                  </p>

                  <div className="pedir-pregunta">
                    <span className="pedir-pregunta-t">
                      ¿Cuál es la tarea de mayor alcance temporal de la que responde este
                      puesto, y cuándo se sabe si su resultado salió bien?
                    </span>
                    <p className="pedir-nota">{AVISO_HORIZONTE}</p>
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
                    <span className="pedir-pregunta-t">¿Qué exige el trabajo que hay que hacer?</span>
                    {PREGUNTAS.map((p) => (
                      <div className="pedir-si-no" key={p.estrato}>
                        <span className="pedir-si-no-t">
                          <strong>{p.corto}</strong>
                          <small>{p.simple}</small>
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
                </section>
              )}
            </>
          )}

          {/* Los CV se sueltan de a varios: es lo que el cliente ya tiene en la
              mano, y de cada uno sale un candidato con lo que el archivo traiga. */}
          <section className="pedir-bloque">
            <h2>Los candidatos</h2>

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
                Todos juntos. De cada uno sacamos el nombre y el contacto, y quedan
                para corregir.
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
                <div className="pedir-tres">
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
                  <input
                    className="pedir-input"
                    type="email"
                    placeholder="Mail"
                    value={f.mail}
                    maxLength={120}
                    onChange={(e) => cambiar(f.id, { mail: e.target.value })}
                  />
                </div>
              </div>
            ))}

            {filas.length < MAXIMO && (
              <button
                type="button"
                className="pedir-abrir"
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
        </div>

        {/* El resumen queda a la vista mientras se elige: el total con el precio
            escondido es una decisión que se posterga. */}
        <aside className="pedir-resumen">
          <div className="pedir-resumen-caja">
            <h2>Tu pedido</h2>
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

            {error && <p className="pedir-error">{error}</p>}
            {faltan.length > 0 && !error && (
              <p className="pedir-falta">Falta {faltan.join(', ')}.</p>
            )}

            <button
              type="submit"
              className="btn-primario pedir-enviar"
              disabled={enviando || faltan.length > 0}
            >
              {enviando ? 'Enviando…' : 'Enviar el pedido'}
            </button>
          </div>
        </aside>
      </form>
    </main>
  );
}
