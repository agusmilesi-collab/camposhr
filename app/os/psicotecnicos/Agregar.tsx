'use client';

/**
 * Cargar un candidato sin salir del tablero.
 *
 * Es la tarjeta que cierra la columna de "Sin asignar". Está pensada para el
 * caso real: llega un mail con tres candidatos para el mismo pedido y hay que
 * meterlos ya.
 *
 * Las decisiones que la hacen rápida, en orden de cuánto ahorran:
 *
 * 1. **El pedido va primero**, como en el formulario del portal: lo primero
 *    que se define es para qué búsqueda entra, y recién después quién es.
 * 2. **No cierra al guardar.** Guarda, se limpia y vuelve el foco al nombre.
 *    Cargar cinco candidatos es escribir cinco nombres, no abrir el formulario
 *    cinco veces.
 * 3. **El pedido queda elegido** entre una carga y la siguiente, incluso el
 *    que se acaba de abrir, porque los candidatos vienen de a tandas del mismo
 *    pedido.
 * 4. **El CV llena la fila solo.** Es el mismo lector que usa el cliente en su
 *    portal (`lib/cv-lectura.ts`): se suelta el archivo encima o se elige, y
 *    salen el nombre, el
 *    teléfono y el correo, para corregir lo que haga falta en vez de
 *    transcribir lo que ya está adentro. Va a la vista y no detrás del clic de
 *    "más datos", porque escondido nadie lo usa y entonces no ahorra nada. El
 *    archivo se sube con el alta, como siempre.
 * 5. **Tres campos a la vista**, que son los que la fila necesita para
 *    existir: pedido, nombre y un contacto. El correo y la evaluadora están
 *    detrás de un clic, cerrados por defecto.
 * 6. **Enter guarda, Escape cierra.** Sin llevar la mano al mouse.
 * 7. **Va en la columna, no en una ventana encima.** Lo que se está cargando
 *    se ve contra la lista a la que se va a sumar.
 *
 * Cuando el pedido todavía no existe, "+ Pedido nuevo" abre el cajón de la
 * derecha con sus ocho campos, y al guardarlo la tarjeta lo deja elegido. Los
 * dos trabajos tienen tamaños distintos y cada uno ocupa el lugar que necesita:
 * tres campos en la columna, ocho en el cajón.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import PedidoNuevo from './PedidoNuevo';

export type PedidoOpcion = { id: string; puesto: string; empresa: string };
export type Opcion = { id: string; nombre: string };
export type BateriaOpcion = { id: string; codigo: string; nombre: string };

/** El valor del selector de pedido que abre el cajón. */
const NUEVO = 'nuevo';

/**
 * El valor que lleva a reabrir un pedido.
 *
 * Los entregados enteros no se eligen desde acá: reabrir uno es una decisión
 * sobre el trabajo con ese cliente y se toma en su ficha, donde están sus
 * cerrados con lo que se le entregó a cada uno.
 */
const REABRIR = 'reabrir';

export default function Agregar({
  pedidos,
  empresas,
  baterias,
  evaluadoras,
}: {
  /**
   * Los pedidos abiertos, y solo esos.
   *
   * Un pedido entregado entero no se elige desde acá: reabrirlo es una decisión
   * sobre el trabajo con ese cliente y se toma en su ficha, en Clientes.
   */
  pedidos: PedidoOpcion[];
  empresas: Opcion[];
  baterias: BateriaOpcion[];
  evaluadoras: Opcion[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [masDatos, setMasDatos] = useState(false);
  const [cajon, setCajon] = useState(false);
  // Los pedidos que se abrieron desde el cajón. El servidor todavía no los
  // devolvió cuando se carga el primer candidato, y sin esto el selector
  // quedaría apuntando a un pedido que no está en la lista.
  const [nuevos, setNuevos] = useState<PedidoOpcion[]>([]);
  const [pedido, setPedido] = useState(pedidos[0]?.id ?? '');
  /**
   * El candidato entra sin evaluadora, que es donde está la tarjeta.
   *
   * Antes se proponía a sí misma quien estuviera cargando, y el candidato
   * saltaba a su columna apenas se guardaba: se agregaba en "Sin asignar" y
   * aparecía en otro lado. Repartir es lo que se hace en esta pantalla,
   * arrastrando. Quien quiera quedárselo lo elige en "Correo y
   * CV".
   */
  const [evaluadora, setEvaluadora] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  /** El correo que salió del CV, esperando a que exista su campo. */
  const [mailLeido, setMailLeido] = useState('');
  const [encima, setEncima] = useState(false);
  /** El nombre del archivo elegido, para poder decir cuál quedó puesto. */
  const [archivo, setArchivo] = useState('');
  /** Qué no se pudo sacar del CV, para que nadie espere un campo que no viene. */
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const nombre = useRef<HTMLInputElement>(null);
  const telefono = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const cv = useRef<HTMLInputElement>(null);

  const opciones = [...pedidos, ...nuevos.filter((n) => !pedidos.some((p) => p.id === n.id))];

  useEffect(() => {
    if (abierto) nombre.current?.focus();
  }, [abierto]);

  /**
   * El correo del CV se escribe cuando su campo ya está en la pantalla.
   *
   * Escrito en el mismo momento en que se pide abrir "más datos", el campo
   * todavía no existe y el dato se perdía sin que nada fallara.
   */
  useEffect(() => {
    if (!mailLeido || !masDatos) return;
    if (email.current && !email.current.value) email.current.value = mailLeido;
    setMailLeido('');
  }, [mailLeido, masDatos]);

  function cerrar() {
    setAbierto(false);
    setArchivo('');
    setAviso(null);
    setError(null);
    setHecho(null);
    setMasDatos(false);
  }

  /** El pedido recién abierto queda elegido: los candidatos son de ese. */
  function tomarPedido(nuevo: PedidoOpcion) {
    setNuevos((v) => [...v, nuevo]);
    setPedido(nuevo.id);
    setCajon(false);
    setError(null);
    setHecho(`${nuevo.puesto} quedó abierto.`);
    nombre.current?.focus();
    empezar(() => router.refresh());
  }

  /**
   * Lee el CV recién elegido y llena lo que esté vacío.
   *
   * Solo lo vacío: si alguien ya escribió el nombre, lo que sacó el lector no
   * puede pisárselo. Lo que encuentra se puede corregir en el mismo campo,
   * porque esto acierta casi siempre y no siempre.
   *
   * Un archivo que no se puede leer no interrumpe nada: vuelve vacío y la fila
   * se carga a mano, como antes.
   */
  /**
   * El archivo que llega arrastrado se mete en el input.
   *
   * Es lo que hace que soltar y elegir sean el mismo camino: el `<input file>`
   * es el que viaja en el formulario cuando se guarda, así que un archivo que
   * solo se hubiera leído se habría perdido al mandar el alta.
   */
  function tomarArchivo(a: File) {
    if (cv.current) {
      const lista = new DataTransfer();
      lista.items.add(a);
      cv.current.files = lista.files;
    }
    setArchivo(a.name);
    leerCv(a);
  }

  async function leerCv(archivo: File) {
    setError(null);
    setAviso(null);
    setLeyendo(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append('cv', archivo);
      const res = await fetch('/api/os/cv', { method: 'POST', body: cuerpo });
      const r = await res.json().catch(() => null);
      const leido = r?.leidos?.[0];
      if (!res.ok || !leido) {
        setAviso('No se pudo leer el CV. Cargá los datos a mano.');
        return;
      }

      /**
       * Lo que no salió se dice.
       *
       * No hay dos CV iguales: hay nombres en una tipografía por palabra,
       * teléfonos que son de una referencia y archivos que son un escaneo sin
       * texto adentro. Cuando el lector no encuentra algo, callarse deja a
       * quien carga mirando un campo vacío sin saber si tiene que esperar o
       * escribir.
       */
      const falta = [
        !leido.nombre && 'el nombre',
        !leido.telefono && 'el teléfono',
        !leido.mail && 'el correo',
      ].filter(Boolean) as string[];
      setAviso(
        falta.length === 3
          ? 'Del CV no salió ningún dato. Cargalos a mano.'
          : falta.length > 0
            ? `Del CV no salió ${falta.join(' ni ')}.`
            : null
      );

      if (nombre.current && !nombre.current.value && leido.nombre) {
        nombre.current.value = leido.nombre;
      }
      if (telefono.current && !telefono.current.value && leido.telefono) {
        telefono.current.value = leido.telefono;
      }
      // El correo vive detrás de "más datos": si el CV lo trae, se abre, porque
      // un dato cargado que no se ve es un dato que nadie va a corregir. El
      // valor queda esperando, porque el campo recién existe después del
      // dibujo.
      if (leido.mail) {
        setMailLeido(leido.mail);
        setMasDatos(true);
      }
    } catch {
      // No es un error del alta, así que se dice como lo que es: el archivo
      // igual se sube y los campos se completan a mano.
      setAviso('No se pudo leer el CV. Cargá los datos a mano.');
    } finally {
      setLeyendo(false);
    }
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const telefono = String(datos.get('telefono') ?? '').trim();
    const email = String(datos.get('email') ?? '').trim();

    setError(null);
    setHecho(null);

    if (!pedido) {
      setError('Abrí primero el pedido al que entra.');
      return;
    }
    if (!telefono && !email) {
      setError('Hace falta el teléfono o el correo para poder citarla.');
      return;
    }

    setEnviando(true);
    try {
      datos.set('tipo', 'candidato');
      datos.set('pedidoId', pedido);
      datos.set('evaluadoraId', evaluadora);
      const res = await fetch('/api/os/altas', { method: 'POST', body: datos });
      const r = await res.json().catch(() => ({ error: 'Sin respuesta.' }));
      if (!res.ok) {
        setError(r.error ?? 'No se pudo guardar.');
        return;
      }
      // Se limpia y queda listo para el siguiente, con el pedido puesto.
      form.reset();
      setArchivo('');
      setAviso(null);
      setHecho(`${String(datos.get('nombre') ?? '').trim()} quedó cargada.`);
      nombre.current?.focus();
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="os-agregar-card" onClick={() => setAbierto(true)}>
        <span className="os-agregar-mas" aria-hidden="true">
          +
        </span>
        Agregar candidato
      </button>
    );
  }

  return (
    <>
      <form
        className="os-agregar-abierto"
        onSubmit={guardar}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cerrar();
        }}
      >
        <select
          className="os-campo"
          value={pedido}
          onChange={(e) => {
            // El cajón se abre y el selector no se mueve: si se cancela, sigue
            // elegido el pedido que estaba.
            if (e.target.value === NUEVO) setCajon(true);
            else if (e.target.value === REABRIR) router.push('/os/clientes');
            else setPedido(e.target.value);
          }}
          aria-label="Para qué pedido"
        >
          {opciones.length === 0 && <option value="">Ningún pedido abierto</option>}
          {opciones.map((p) => (
            <option key={p.id} value={p.id}>
              {p.empresa} · {p.puesto}
            </option>
          ))}
          <option value={NUEVO}>+ Pedido nuevo</option>
          <option value={REABRIR}>↗ Reabrir un pedido entregado</option>
        </select>

        {/* El CV primero: se suelta o se elige, y los tres campos de abajo se
            llenan solos. Las dos formas terminan en el mismo input, que es el
            que viaja con el alta. */}
        <label
          className={`os-agregar-cv${encima ? ' encima' : ''}${leyendo ? ' leyendo' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault();
            setEncima(false);
            const a = e.dataTransfer.files?.[0];
            if (a) tomarArchivo(a);
          }}
        >
          <input
            ref={cv}
            className="os-agregar-archivo"
            name="cv"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            onChange={(e) => {
              const a = e.target.files?.[0];
              if (a) tomarArchivo(a);
            }}
          />
          <span className="os-agregar-cv-texto">
            {leyendo ? 'Leyendo el CV…' : archivo || 'Soltá el CV acá o elegí el archivo'}
          </span>
        </label>

        <input
          ref={nombre}
          className="os-campo"
          name="nombre"
          required
          maxLength={120}
          placeholder="Nombre y apellido"
          aria-label="Nombre y apellido"
        />

        <input
          ref={telefono}
          className="os-campo"
          name="telefono"
          placeholder="Teléfono"
          aria-label="Teléfono"
        />

        {masDatos && (
          <>
            <input
              ref={email}
              className="os-campo"
              name="email"
              placeholder="Correo"
              aria-label="Correo"
            />
            <select
              className="os-campo"
              value={evaluadora}
              onChange={(e) => setEvaluadora(e.target.value)}
              aria-label="Evaluadora"
            >
              <option value="">Sin asignar</option>
              {evaluadoras.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </>
        )}

        {!masDatos && (
          <button type="button" className="os-agregar-mas-datos" onClick={() => setMasDatos(true)}>
            Correo y evaluadora
          </button>
        )}

        {aviso && <p className="os-agregar-aviso">{aviso}</p>}
        {error && <p className="os-form-error">{error}</p>}
        {hecho && <p className="os-form-ok">{hecho}</p>}

        <div className="os-agregar-pie">
          <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Agregar'}
          </button>
          <button type="button" className="os-boton" onClick={cerrar}>
            Listo
          </button>
        </div>
      </form>

      {cajon && (
        <PedidoNuevo
          empresas={empresas}
          baterias={baterias}
          onCreado={tomarPedido}
          onCerrar={() => setCajon(false)}
        />
      )}
    </>
  );
}
