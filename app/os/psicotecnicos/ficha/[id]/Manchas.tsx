'use client';

/**
 * La codificación Rorschach, fila por fila.
 *
 * Es la pantalla donde la evaluadora carga el protocolo, con los mismos campos,
 * los mismos desplegables y los mismos colores que la tabla "Tests Proyectivos"
 * de Airtable, que es lo que viene usando. Las opciones salen de
 * `lib/rorschach.ts`, generado desde el esquema de esa tabla.
 *
 * Cada celda guarda sola al cambiar, como el resto del pipeline: un botón de
 * guardar suelto es un protocolo a medio cargar cuando alguien cierra la
 * pestaña. Lo que se ve en pantalla se actualiza antes de que conteste el
 * servidor, y si el guardado falla la fila vuelve a su valor y aparece el
 * motivo.
 */

import { useRouter } from 'next/navigation';
import { Fragment, useRef, useState, useTransition } from 'react';
import './manchas.css';
import PalabrasFq from './PalabrasFq';
import {
  CC_EE,
  CONTENIDOS,
  DETERMINANTES,
  FQ,
  LAMINA,
  LOCALIZACION,
  tonoDe,
  type Opcion,
} from '@/lib/rorschach';
import type { Mancha } from '@/lib/ficha';
import { areasDe, Z } from '@/lib/rorschach-tabla-a';
import { CAMPOS_HR, conRepresentacionHumana } from '@/lib/representacion-humana';
import { zAutomatico } from '@/lib/rorschach-z';
import Calcular from './Calcular';
import Codigo from './Codigo';
import { Multiple, Simple, Tilde } from './Celdas';

/** Una etiqueta con el color que le toca a ese código. */
function Chip({ valor, opciones }: { valor: string; opciones: Opcion[] }) {
  return (
    <span className="os-chip" style={{ background: tonoDe(opciones, valor) }}>
      {valor}
    </span>
  );
}

/*
 * Las opciones de Nº loc. y de Pje Z, para elegir con el mouse.
 *
 * Las psicólogas los escribían a mano y pidieron que se abran como el resto de
 * las celdas (16/10/2026). Los dos salen de la Tabla A de la lámina: el número
 * de las áreas que tiene y los cuatro valores de Z que da.
 */
const TONO_NUMERO = 'grayLight2';
const opcion = (v: string): Opcion => ({ v, c: TONO_NUMERO });
const porNumero = (a: string, b: string) => Number(a) - Number(b);

/**
 * Los números de área que admite una localización en esa lámina.
 *
 * W y WS son siempre el 1. D y DS comparten la numeración de las áreas comunes
 * (DS5 en la II, pero también "5 + 3"), y lo mismo Dd y DdS, que suman el 99 de
 * las áreas que la tabla no tiene. El Zulliger no tiene Tabla A cargada: ahí
 * van del 1 al 9 para D y del 21 al 40 para Dd, que cubren lo cargado hasta
 * hoy.
 */
function numerosDeLoc(lamina: string | null, localizacion: string | null): Opcion[] {
  const familia = (localizacion ?? '').replace(/[o+v/]+$/, '').replace('S', '');
  if (familia === 'W') return [opcion('1')];
  const areas = lamina ? areasDe(lamina) : [];
  const zulliger = !areas.length;
  const de = (dd: boolean) => {
    if (zulliger) {
      const [desde, hasta] = dd ? [21, 40] : [1, 9];
      return Array.from({ length: hasta - desde + 1 }, (_, i) => String(desde + i));
    }
    return areas
      .filter((a) => a !== 'W' && a.startsWith('Dd') === dd)
      .map((a) => a.replace(/^\D+/, ''));
  };
  const lista =
    familia === 'D' ? de(false) : familia === 'Dd' ? [...de(true), '99'] : [...de(false), ...de(true), '99'];
  return [...new Set(lista)].sort(porNumero).map(opcion);
}

/** Los valores de Z de la lámina; sin lámina, los de todas. */
function valoresZ(lamina: string | null): Opcion[] {
  const fuente = lamina && Z[lamina] ? [Z[lamina]] : Object.values(Z);
  const valores = fuente.flatMap((z) => [z.ZW, z.ZA, z.ZD, z.ZS]).map(String);
  return [...new Set(valores)].sort(porNumero).map(opcion);
}
const TODOS_Z = valoresZ(null);

/** "1 + 3", "1+3 " y "1+3" son la misma combinación de áreas. */
const partesDeLoc = (v: string | null) =>
  (v ?? '').split('+').map((x) => x.trim()).filter(Boolean);

export default function Manchas({
  evaluacionId,
  filas,
  bateria,
}: {
  evaluacionId: string;
  filas: Mancha[];
  /**
   * El test de manchas que declara la batería que se le vendió al cliente.
   *
   * Es lo que decide con qué láminas se arranca un protocolo vacío. Sin esto se
   * ofrecían las trece y la primera respuesta salía con la lámina I, así que un
   * Zulliger empezaba codificado como Rorschach.
   */
  bateria: 'Rorschach' | 'Zulliger' | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [locales, setLocales] = useState<Mancha[]>(filas);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Lo que llega del servidor manda salvo mientras hay algo sin confirmar: sin
  // esto, cada refresco pisaría lo que se acaba de tipear.
  const [sucio, setSucio] = useState(false);
  /** Las filas con el texto de la toma a la vista, por id. */
  const [abiertas, setAbiertas] = useState<string[]>([]);
  const vista = sucio ? locales : filas;

  /*
   * Las láminas de un solo test.
   *
   * Un protocolo es de Rorschach o de Zulliger, no de los dos: las diez del
   * Sistema Comprehensivo y las tres de Zdunic se codifican distinto y el
   * sumario se calcula con normas distintas. Con las trece a la vista, un
   * protocolo mezclado se arma con un solo clic mal dado y recién se nota al
   * calcular.
   *
   * Manda la primera respuesta que tenga lámina cargada, que es lo que
   * efectivamente se le tomó. Con el protocolo vacío manda la batería, que es
   * lo que se le va a tomar. Sin ninguna de las dos se ofrecen las trece.
   */
  const primera = vista.find((f) => f.lamina)?.lamina ?? null;
  const esZulliger =
    primera !== null ? primera.startsWith('Z') : bateria ? bateria === 'Zulliger' : null;
  const laminas =
    esZulliger === null
      ? LAMINA
      : LAMINA.filter((o) => o.v.startsWith('Z') === esZulliger);

  /*
   * Hasta cuatro respuestas por lámina, al cargar.
   *
   * Es el tope con el que se administra: pasadas cuatro, al candidato se le
   * pasa a la lámina siguiente. Sin esto, tocar "Agregar respuesta" de más
   * dejaba siete filas de la misma lámina y el protocolo salía con un reparto
   * que nadie tomó.
   *
   * **Rige para la fila que se agrega, no para las que ya están.** Hay once
   * protocolos cargados con cinco respuestas en una lámina y son válidos: se
   * siguen viendo, se siguen editando y el selector de cada fila deja elegir
   * la lámina que haga falta.
   */
  const TOPE_POR_LAMINA = 4;
  const cuantasEn = (lamina: string | null) =>
    lamina === null ? 0 : vista.filter((f) => f.lamina === lamina).length;

  /**
   * La lámina más avanzada entre las primeras `hasta` filas, por su posición.
   *
   * Es hasta dónde llegó el protocolo, y no la lámina de la última fila: una
   * fila cargada fuera de orden (una IV después de las V) hacía que todo lo
   * que seguía se ofreciera desde la IV, y la VI quedaba escondida en
   * "Mostrar todas" (Lorena, 19/10/2026).
   */
  const alcanzadaHasta = (hasta: number): number =>
    Math.max(-1, ...vista.slice(0, hasta).map((f) => laminas.findIndex((o) => o.v === f.lamina)));

  /* La lámina donde cae la próxima respuesta: la más avanzada mientras tenga
     lugar, y si no la primera que siga con lugar. Null cuando ya no queda
     ninguna, que es cuando el protocolo está completo. */
  const laminaSiguiente = (() => {
    const desde = Math.max(0, alcanzadaHasta(vista.length));
    for (let i = desde; i < laminas.length; i++) {
      if (cuantasEn(laminas[i].v) < TOPE_POR_LAMINA) return laminas[i].v;
    }
    return null;
  })();

  /*
   * Calcular el sumario aparece recién con la última lámina codificada.
   *
   * El protocolo se toma entero y después se codifica: un sumario calculado a
   * mitad de camino sale con todas las proporciones corridas y parece bueno,
   * porque nada avisa que faltan láminas. Se espera a la X en Rorschach y a la
   * Z3 en Zulliger, que son las últimas de cada test.
   */
  const ultima = esZulliger === null ? null : esZulliger ? 'Z3' : 'X';
  const protocoloEntero = ultima !== null && vista.some((f) => f.lamina === ultima);

  /**
   * Qué láminas se le ofrecen a una fila.
   *
   * El protocolo se toma en orden: se dan las respuestas de la lámina I, se
   * pasa a la II y no se vuelve. Así que en cada fila lo único que puede pasar
   * es repetir la lámina a la que se llegó o pasar a la siguiente, y
   * ofrecer las diez es ofrecer ocho maneras de equivocarse.
   *
   * La lámina que la fila ya tiene entra siempre, para que una respuesta vieja
   * fuera de orden se siga viendo. Y el resto queda a un toque, en "Mostrar
   * todas": las excepciones existen y no se las puede dejar sin salida.
   */
  function laminasDe(i: number): Opcion[] {
    const propia = vista[i].lamina ?? null;
    /* Se ofrecen la más avanzada de las filas de arriba y la siguiente. La
       anterior no: el protocolo no vuelve atrás, y ofrecerla dejó a Lorena una
       IV después de tres V con un solo toque mal dado (19/10/2026). Volver
       atrás queda en "Mostrar todas", que es lo que es: una excepción. */
    const alcanzada = alcanzadaHasta(i);
    const donde = alcanzada >= 0 ? alcanzada : Math.max(0, laminas.findIndex((o) => o.v === propia));
    const ofrecidas = [laminas[donde], laminas[donde + 1]].filter(
      Boolean
    ) as Opcion[];
    // La propia también, aunque esté fuera de orden: si no, la fila no se ve.
    if (propia && !ofrecidas.some((o) => o.v === propia)) {
      const p = laminas.find((o) => o.v === propia);
      if (p) ofrecidas.push(p);
    }
    return ofrecidas.length ? ofrecidas : laminas;
  }

  /** Si el Z de la fila falta y el sistema no lo puede poner: lo elige ella. */
  const zAMano = (f: Mancha) =>
    !esZulliger &&
    f.z === null &&
    Boolean(f.localizacion) &&
    zAutomatico(f.lamina, f.localizacion, f.n_localizacion, f.areas) === undefined;

  async function pedir(init: RequestInit & { url?: string }): Promise<any> {
    setError(null);
    setOcupado(true);
    try {
      const res = await fetch(init.url ?? '/api/os/manchas', {
        ...init,
        headers: { 'Content-Type': 'application/json' },
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return null;
      }
      return r;
    } catch {
      setError('No se pudo guardar.');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Las altas que todavía no volvieron del servidor, por su id provisorio.
   *
   * La fila aparece en pantalla antes de existir en la base, así que puede
   * recibir un cambio o un borrado mientras el alta viaja. Acá se espera a que
   * llegue su id de verdad, que es lo único que le falta.
   */
  const enVuelo = useRef(new Map<string, Promise<string | null>>());

  async function idReal(id: string): Promise<string | null> {
    const p = enVuelo.current.get(id);
    return p ? await p : id;
  }

  async function cambiar(id: string, campos: Record<string, unknown>) {
    const antes = vista;
    /* GHR y PHR se recalculan acá para que la celda cambie en el acto; el
       servidor hace la misma cuenta al guardar, que es la que vale. */
    const fila = vista.find((f) => f.id === id);
    if (fila && CAMPOS_HR.some((c) => c in campos)) {
      campos = { ...campos, cc_ee: conRepresentacionHumana({ ...fila, ...(campos as object) }) };
    }
    /* El Z también lo pone el sistema, con la lámina, la localización y su
       número, o con las áreas marcadas en la encuesta (`zAutomatico`). Cuando no lo puede saber, como en un Dd99 con
       DQ+, deja el que haya y lo elige ella. */
    if (fila && ['lamina', 'localizacion', 'n_localizacion'].some((c) => c in campos)) {
      const junta = { ...fila, ...(campos as Partial<Mancha>) };
      // N° loc. corregido a mano: las áreas de la encuesta dejan de valer (la
      // ruta las borra), así que la cuenta va sin ellas.
      const areas = 'n_localizacion' in campos ? null : junta.areas;
      const z = zAutomatico(junta.lamina, junta.localizacion, junta.n_localizacion, areas);
      if (z !== undefined && z !== fila.z) campos = { ...campos, z };
    }
    setSucio(true);
    setLocales(vista.map((f) => (f.id === id ? { ...f, ...(campos as object) } : f)));

    const suyo = await idReal(id);
    if (!suyo) {
      setLocales(antes);
      setError('Esa respuesta no llegó a guardarse. Volvé a agregarla.');
      return;
    }
    const r = await pedir({ method: 'POST', body: JSON.stringify({ id: suyo, campos }) });
    if (!r) {
      setLocales(antes);
      return;
    }
    empezar(() => {
      router.refresh();
      setSucio(false);
    });
  }

  /**
   * Una respuesta más, en el acto.
   *
   * La fila se dibuja antes de mandar nada: se cargan veinte o treinta seguidas
   * y esperar el alta y el redibujo del servidor entre una y otra son dos
   * segundos por respuesta mirando un botón apagado. El alta viaja por atrás y,
   * cuando vuelve, la fila cambia su id provisorio por el de verdad.
   */
  function agregar() {
    const siguiente = Math.max(0, ...vista.map((f) => f.n_respuesta ?? 0)) + 1;
    /* La lámina de la última respuesta, o la que sigue si esa ya llegó a su
       tope: una respuesta nueva casi siempre es de la misma lámina que la
       anterior, y arrancar en blanco obliga a elegirla veintidós veces. */
    const lamina = laminaSiguiente;
    if (lamina === null) return;
    const provisorio = `nueva-${siguiente}-${vista.length}`;
    const fila = {
      id: provisorio,
      test: esZulliger ? 'Zulliger' : 'Rorschach',
      lamina,
      n_respuesta: siguiente,
      localizacion: null,
      n_localizacion: null,
      determinantes: [],
      fq: null,
      par: false,
      contenidos: [],
      popular: false,
      z: null,
      cc_ee: [],
      agc: false,
      sl: false,
      verbalizacion: null,
      posicion: null,
      observacion: null,
      caracteristica: null,
    } satisfies Mancha;

    setSucio(true);
    setLocales([...vista, fila]);

    const alta = pedir({
      method: 'PUT',
      body: JSON.stringify({ evaluacionId, campos: { n_respuesta: siguiente, lamina } }),
    }).then((r) => {
      const id = r?.fila?.id ?? null;
      if (!id) {
        setLocales((antes) => antes.filter((f) => f.id !== provisorio));
        return null;
      }
      setLocales((antes) => antes.map((f) => (f.id === provisorio ? { ...f, id } : f)));
      empezar(() => {
        router.refresh();
        setSucio(false);
      });
      return id;
    });
    enVuelo.current.set(provisorio, alta);
  }

  async function borrar(id: string) {
    const antes = vista;
    setSucio(true);
    setLocales(vista.filter((f) => f.id !== id));

    const suyo = await idReal(id);
    if (!suyo) return;
    const r = await pedir({ method: 'DELETE', url: `/api/os/manchas?id=${suyo}` });
    if (!r) {
      setLocales(antes);
      return;
    }
    empezar(() => {
      router.refresh();
      setSucio(false);
    });
  }

  return (
    <>
      {error && <p className="os-form-error">{error}</p>}

      {/* La grilla y su pie miden lo mismo: así el botón que cierra el
          protocolo cae debajo de la columna de la cruz de borrar. */}
      <div className="os-manchas">
      <div className="os-tabla-marco">
        <table className="os-tabla os-tabla-manchas">
          <thead>
            <tr>
              <th>Lámina</th>
              <th>Nº rta</th>
              <th>Loc.+DQ</th>
              <th>Nº loc.</th>
              <th>Determinantes</th>
              <th>FQ</th>
              <th>Par</th>
              <th>Contenidos</th>
              <th>P</th>
              {/* La dimensión Z no existe en Zulliger, y el síndrome del
                  ladrón es propio de la hoja de Zdunic: cada test muestra su
                  columna y no la del otro. */}
              <th>{esZulliger ? 'SL' : 'Pje Z'}</th>
              <th>CC.EE</th>
              <th>AgC</th>
              <th className="os-tabla-accion" />
            </tr>
          </thead>
          <tbody>
            {vista.map((f, i) => (
              <Fragment key={f.id}>
              <tr>
                <td>
                  <span className="os-mancha-lamina">
                  {/* Lo que dijo la persona y lo que contestó en la encuesta se
                      abren debajo de la fila: son de donde sale la
                      codificación, pero leídos todo el tiempo ensanchan la
                      grilla y la parten en renglones de distinto alto. */}
                  <button
                    type="button"
                    className={`os-mancha-desplegar${abiertas.includes(f.id) ? ' abierta' : ''}`}
                    onClick={() =>
                      setAbiertas((a) =>
                        a.includes(f.id) ? a.filter((x) => x !== f.id) : [...a, f.id]
                      )
                    }
                    aria-expanded={abiertas.includes(f.id)}
                    aria-label={`Ver lo que dijo en la respuesta ${f.n_respuesta ?? ''}`}
                    title="Respuesta y encuesta"
                  >
                    ▸
                  </button>
                  {/* En "Mostrar todas" van las trece y no las del test que se
                      dedujo: si el protocolo arrancó con la lámina del test
                      equivocado, este es el único lugar desde donde se
                      corrige. */}
                  <Simple
                    valor={f.lamina}
                    opciones={laminasDe(i)}
                    todas={LAMINA}
                    onCambio={(v) => cambiar(f.id, { lamina: v })}
                    etiqueta="Lámina"
                    buscable={false}
                    porFila={3}
                    sinVacio
                    nuevaFilaAntesDe="Z1"
                  />
                  </span>
                </td>
                <td>
                  {/* El número no se escribe: lo pone el sistema, correlativo
                      de todo el protocolo, al capturar la respuesta en la
                      encuesta o al agregar una fila acá. Editable, dos filas
                      podían terminar con el mismo número y el sumario cuenta
                      respuestas. */}
                  <span className="os-manchas-n">{f.n_respuesta ?? '—'}</span>
                </td>
                <td>
                  <Simple
                    valor={f.localizacion}
                    opciones={LOCALIZACION}
                    /* Una respuesta que toma la mancha entera está en el área 1
                       de esa lámina, siempre: no hay dos maneras de tomarla
                       entera. Lo pone el sistema al elegir la localización, así
                       la evaluadora no escribe el mismo 1 veinte veces por
                       protocolo. Lo puede corregir a mano igual. */
                    onCambio={(v) =>
                      cambiar(f.id, {
                        localizacion: v,
                        ...(v?.startsWith('W') && !f.n_localizacion ? { n_localizacion: '1' } : {}),
                      })
                    }
                    etiqueta="Localización y DQ"
                  />
                </td>
                <td>
                  {/* Varias áreas a la vez se eligen una por una y se guardan
                      como "1+3", que es como se venían escribiendo. */}
                  <Multiple
                    valores={partesDeLoc(f.n_localizacion)}
                    opciones={numerosDeLoc(f.lamina, f.localizacion)}
                    onCambio={(v) =>
                      cambiar(f.id, { n_localizacion: v.length ? [...v].sort(porNumero).join('+') : null })
                    }
                    etiqueta="Número de localización"
                  />
                </td>
                <td>
                  <Multiple
                    valores={f.determinantes ?? []}
                    opciones={DETERMINANTES}
                    onCambio={(v) => cambiar(f.id, { determinantes: v })}
                    etiqueta="Determinantes"
                  />
                </td>
                <td>
                  <Simple
                    valor={f.fq}
                    opciones={FQ}
                    onCambio={(v) => cambiar(f.id, { fq: v })}
                    etiqueta="Calidad formal"
                    pie={(elegir) => (
                      <PalabrasFq
                        lamina={f.lamina}
                        localizacion={f.localizacion}
                        nLocalizacion={f.n_localizacion}
                        areas={f.areas}
                        elegir={elegir}
                      />
                    )}
                  />
                </td>
                <td>
                  <Tilde puesto={Boolean(f.par)} onCambio={(v) => cambiar(f.id, { par: v })} />
                </td>
                <td>
                  <Multiple
                    valores={f.contenidos ?? []}
                    opciones={CONTENIDOS}
                    onCambio={(v) => cambiar(f.id, { contenidos: v })}
                    etiqueta="Contenidos"
                  />
                </td>
                <td>
                  <Tilde puesto={Boolean(f.popular)} onCambio={(v) => cambiar(f.id, { popular: v })} />
                </td>
                {/* Cuando el sistema no puede poner el Z (un Dd99 con DQ+: sin el
                    área no sabe si los objetos están juntos o separados), la
                    celda se pinta hasta que ella lo elija. Pedido de Agustín,
                    19/10/2026. Es un estilo en línea y no una clase porque el
                    fondo es el mismo ámbar del resto del OS. */}
                <td
                  style={
                    zAMano(f)
                      ? { background: 'color-mix(in srgb, var(--os-ambar) 22%, transparent)' }
                      : undefined
                  }
                  title={
                    zAMano(f)
                      ? 'El Z de esta respuesta no sale solo: elegilo a mano.'
                      : undefined
                  }
                >
                  {esZulliger ? (
                    <Tilde puesto={Boolean(f.sl)} onCambio={(v) => cambiar(f.id, { sl: v })} />
                  ) : (
                    <Simple
                      valor={f.z === null ? null : String(f.z)}
                      opciones={valoresZ(f.lamina)}
                      todas={TODOS_Z}
                      onCambio={(v) => cambiar(f.id, { z: v })}
                      etiqueta="Puntaje Z"
                      buscable={false}
                    />
                  )}
                </td>
                <td>
                  <Multiple
                    valores={f.cc_ee ?? []}
                    opciones={CC_EE}
                    onCambio={(v) => cambiar(f.id, { cc_ee: v })}
                    etiqueta="Códigos especiales"
                  />
                </td>
                <td>
                  <Tilde puesto={Boolean(f.agc)} onCambio={(v) => cambiar(f.id, { agc: v })} />
                </td>
                <td className="os-tabla-accion">
                  <button
                    type="button"
                    className="os-boton os-boton-borrar"
                    disabled={ocupado}
                    onClick={() => borrar(f.id)}
                    title="Borrar la respuesta"
                    aria-label="Borrar la respuesta"
                  >
                    ×
                  </button>
                </td>
              </tr>
              {abiertas.includes(f.id) && (
                <tr className="os-mancha-detalle">
                  <td colSpan={13}>
                    {/* Dos columnas iguales: arriba lo que dijo y la encuesta,
                        abajo los objetos (uno por línea) y la observación. */}
                    <dl>
                      <div>
                        <dt>Respuesta</dt>
                        <dd title={f.verbalizacion ?? undefined}>{f.verbalizacion || '—'}</dd>
                      </div>
                      <div>
                        <dt>Encuesta</dt>
                        <dd title={f.caracteristica ?? undefined}>{f.caracteristica || '—'}</dd>
                      </div>
                      {/* Separada en objetos: la fila lleva la localización
                          general, y acá va dónde cayó cada uno. */}
                      {f.objetos && f.objetos.length > 0 && (
                        <div>
                          <dt>Objetos</dt>
                          <dd className="os-mancha-objetos">
                            <ul>
                              {f.objetos.map((o, i) => (
                                <li key={i}>
                                  <span className="os-mancha-objeto-texto">{o.texto}</span>
                                  {/* Con los mismos colores que las columnas de
                                      la tabla: área, FQ y contenidos. */}
                                  {o.areas.map((a) => (
                                    <Chip key={a} valor={a} opciones={[]} />
                                  ))}
                                  {o.fq ? (
                                    <Chip valor={o.fq} opciones={FQ} />
                                  ) : (
                                    <span className="os-chip os-mancha-objeto-vacio" title="Sin FQ">—</span>
                                  )}
                                  {o.contenidos.map((c) => (
                                    <Chip key={c} valor={c} opciones={CONTENIDOS} />
                                  ))}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      )}
                      {f.observacion && f.observacion !== f.verbalizacion && (
                        <div>
                          <dt>Observación</dt>
                          <dd title={f.observacion}>{f.observacion}</dd>
                        </div>
                      )}
                    </dl>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cargar una respuesta más y cerrar el protocolo son los dos finales
          posibles de esta grilla: van en el mismo renglón, uno en cada punta.

          Calcular va del lado de la primera columna y agregar del lado de la
          última, que es donde termina de escribirse cada fila: la mano viene
          de ahí. */}
      <div className="os-barra-acciones os-manchas-pie">
        <div className="os-manchas-pie-izq">
          {protocoloEntero && <Calcular evaluacionId={evaluacionId} />}
          {/* Las tablas de calidad formal, para consultar mientras se
              codifica: en otra pestaña, así no se pierde la grilla. Solo en
              el Rorschach, que es el que tiene las tablas. */}
          {esZulliger !== true && (
            <a
              className="os-boton"
              href="/os/herramientas/calidad-formal"
              target="_blank"
              rel="noreferrer"
            >
              Tabla de calidad formal
            </a>
          )}
        </div>
        {/* Pintado, porque es el que se toca veinticinco veces por protocolo;
            calcular el sumario se toca una sola vez, al final.

            Sin apagarse mientras guarda: la fila ya está en pantalla y se
            pueden cargar dos seguidas sin esperar a la primera. */}
        <button
          className="os-boton os-boton-azul os-manchas-agregar"
          onClick={agregar}
          disabled={laminaSiguiente === null}
          title={
            laminaSiguiente === null
              ? `Las láminas llegaron a ${TOPE_POR_LAMINA} respuestas. Para una más, cambiá la lámina en la fila.`
              : `La próxima respuesta entra en la lámina ${laminaSiguiente}.`
          }
        >
          Agregar respuesta
        </button>
      </div>
      </div>
    </>
  );
}
