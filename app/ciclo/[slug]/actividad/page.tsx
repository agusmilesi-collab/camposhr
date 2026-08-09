import { notFound } from 'next/navigation';
import { contarRespuestas } from '@/lib/supabase';
import { partirOpcion } from '@/lib/opciones';
import {
  actividadesDelCiclo,
  listarAportesDeVarias,
  rondasDelEnsayo,
  type Aporte,
  getActividadAbierta,
  getActividadPorClave,
  listarAportes,
  listarAsistentes,
  resolverCiclo,
  resumir,
  type Actividad,
  type Resumen,
} from '@/lib/ciclo';
import AutoRefresco from '@/app/cuestionario/[slug]/matriz/AutoRefresco';

/**
 * Lo que se proyecta.
 *
 * Se embebe dentro de la placa del deck con el mismo mecanismo que ya usa la
 * matriz del equipo en la charla 3: un marco que se carga al llegar a esa placa
 * y se refresca solo.
 *
 *   ?placa=1         fondo transparente, para verse dentro de la diapositiva
 *   ?clave=c5-match  fija una actividad; sin esto, muestra la que esté abierta
 *   ?vista=conteo    solo cuántos respondieron sobre cuántos hay inscriptos
 *   ?vista=consigna  la pregunta con sus opciones, sin ninguna respuesta
 *
 * La vista de conteo va en la placa de la consigna: dice cuándo respondió todo
 * el grupo, que es lo que la expositora necesita para saber si puede avanzar
 * sin dejar a nadie a mitad de camino. La respuesta en sí no se muestra ahí:
 * aparece recién en la placa siguiente, para que nadie copie del proyector.
 *
 * La pantalla abre la conversación, no la cierra: por eso se muestra el dato y
 * nunca una conclusión.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Actividad — Campos HR',
  robots: { index: false, follow: false },
};

export default async function Proyeccion({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { placa?: string; clave?: string; vista?: string };
}) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) notFound();
  const { empresa, corrida } = ciclo;

  const enPlaca = searchParams?.placa === '1';
  const soloConteo = searchParams?.vista === 'conteo';
  const soloConsigna = searchParams?.vista === 'consigna';
  const cierreDelEnsayo = searchParams?.vista === 'cierre';
  /*
   * El cierre del ensayo suma las tres rondas: son 33 conversaciones y lo que
   * importa es la foto de la sala entera, no la de una ronda. Va después del
   * ensayo y no durante: con los números a la vista mientras practican, los
   * últimos tríos juegan para el marcador.
   */
  if (cierreDelEnsayo) {
    const rondas = rondasDelEnsayo(await actividadesDelCiclo(corrida.ciclo_id));
    const aportes = await listarAportesDeVarias(
      corrida.id,
      rondas.map((r: { id: string }) => r.id)
    );
    return (
      <main className={enPlaca ? 'cp cp-placa' : 'cp'}>
        {enPlaca && <FondoTransparente />}
        <CierreDelEnsayo aportes={aportes} />
        <AutoRefresco segundos={15} oculto />
      </main>
    );
  }

  const actividad = searchParams?.clave
    ? await getActividadPorClave(corrida.ciclo_id, searchParams.clave)
    : await getActividadAbierta(corrida);

  if (!actividad) {
    return (
      <main className={enPlaca ? 'cp cp-placa' : 'cp'}>
        {enPlaca && <FondoTransparente />}
        <p className="cp-vacio">Se arma sola cuando el grupo responde.</p>
        <AutoRefresco segundos={5} oculto />
      </main>
    );
  }

  const aportes = await listarAportes(corrida.id, actividad.id);

  /**
   * La consigna proyectada: lo que hay que leer para poder responder desde el
   * teléfono, y nada de lo respondido. Las preguntas de la encuesta de la
   * charla 1 van así: lo que contesta cada uno alimenta el informe a Recursos
   * Humanos, y proyectarlo mientras responden condiciona al que todavía no
   * eligió.
   */
  if (soloConsigna) {
    const inscriptos = (await listarAsistentes(corrida.id)).length;
    return (
      <main className={`cp cp-consigna ${enPlaca ? 'cp-placa' : ''}`}>
        {enPlaca && <FondoTransparente />}
        {actividad.enunciado && <p className="cp-consigna-que">{actividad.enunciado}</p>}
        <ul className="cp-opciones">
          {actividad.opciones.map((o) => {
            const [titulo, aclara] = partirOpcion(o);
            return (
              <li key={o}>
                {titulo}
                {aclara && <em>({aclara})</em>}
              </li>
            );
          })}
        </ul>
        <p className="cp-pie">
          {aportes.length === 0
            ? 'Se responde desde el teléfono.'
            : `Respondieron ${aportes.length} de ${inscriptos}`}
        </p>
        <AutoRefresco segundos={5} oculto />
      </main>
    );
  }

  if (soloConteo) {
    const inscriptos = (await listarAsistentes(corrida.id)).length;
    // El cuestionario no deja aporte: sus respuestas viven en su propia tabla,
    // se responda adentro del encuentro o desde su enlace.
    const hechas =
      actividad.tipo === 'enlace' || actividad.tipo === 'cuestionario'
        ? await contarRespuestas(empresa.id, corrida.id)
        : aportes.length;
    const completo = inscriptos > 0 && hechas >= inscriptos;
    // El cruce no se responde: se reparte. Contar "respuestas" ahí le haría
    // creer a la expositora que falta gente por contestar algo.
    const esCruce = actividad.tipo === 'cruce';
    return (
      <main className={`cp cp-conteo ${enPlaca ? 'cp-placa' : ''}`}>
        {enPlaca && <FondoTransparente />}
        {/* Cuando llega al total cambia de color: la expositora lo ve de
            reojo desde el otro lado de la sala y sigue sin preguntar. */}
        <p className={`cp-cifra ${completo ? 'cp-cifra-lista' : ''}`}>
          <b>{hechas}</b>
          <span>/</span>
          <em>{inscriptos}</em>
        </p>
        <p className="cp-cifra-pie">
          {esCruce
            ? completo
              ? 'Todos tienen con quién'
              : 'tienen con quién'
            : completo
              ? 'Respondieron todos'
              : 'respondieron'}
        </p>
        <AutoRefresco segundos={3} oculto />
      </main>
    );
  }

  const resumen = resumir(actividad, aportes);

  return (
    <main className={enPlaca ? 'cp cp-placa' : 'cp'}>
      {enPlaca && <FondoTransparente />}
      {!enPlaca && <h1 className="cp-titulo">{actividad.titulo}</h1>}

      <Vista actividad={actividad} resumen={resumen} />

      <p className="cp-pie">{pie(resumen)}</p>

      <AutoRefresco segundos={5} oculto />
    </main>
  );
}

/** Cuánta gente entró en lo que se está proyectando. */
function pie(resumen: Resumen): string {
  if (resumen.tipo === 'cruce') {
    return resumen.total === 0
      ? 'Se reparte al abrir la consigna.'
      : `${resumen.total} ${resumen.total === 1 ? 'persona' : 'personas'}`;
  }
  if (resumen.total === 0) return 'Se arma sola a medida que responden.';
  return `${resumen.total} ${resumen.total === 1 ? 'respuesta' : 'respuestas'}`;
}

/** El fondo de la placa se ve a través del marco. */
function FondoTransparente() {
  return (
    <style dangerouslySetInnerHTML={{ __html: 'body{background:transparent}' }} />
  );
}

function Vista({ actividad, resumen }: { actividad: Actividad; resumen: Resumen }) {
  switch (resumen.tipo) {
    case 'palabra': {
      // El tamaño sale de la raíz cuadrada y no de la proporción directa: con
      // proporción directa, una palabra repetida cinco veces tapa la pantalla y
      // las demás quedan ilegibles.
      const tope = Math.max(1, ...resumen.nube.map((n) => n.veces));
      return (
        <div className="cp-nube">
          {resumen.nube.map((n) => (
            <span
              key={n.texto}
              className="cp-palabra"
              style={{ fontSize: `${1 + Math.sqrt(n.veces / tope) * 2.4}rem` }}
            >
              {n.texto}
              {n.veces > 1 && <sup className="cp-veces">{n.veces}</sup>}
            </span>
          ))}
        </div>
      );
    }

    case 'opcion':
    case 'marcas': {
      const tope = Math.max(1, ...resumen.conteo.map((c) => c.veces));
      return (
        <div className="cp-barras">
          {resumen.conteo.map((c) => (
            <div className="cp-barra" key={c.texto}>
              <div className="cp-barra-fila">
                <span className="cp-barra-texto">{c.texto}</span>
                <span className="cp-barra-valor">{c.veces}</span>
              </div>
              <div className="cp-barra-riel">
                <span style={{ width: `${(c.veces / tope) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'escala': {
      const tope = Math.max(1, ...resumen.distribucion.map((d) => d.veces));
      return (
        <div className="cp-escala">
          <p className="cp-promedio">
            <strong>{resumen.promedio.toFixed(1)}</strong>
            <span>promedio</span>
          </p>
          <div className="cp-columnas">
            {resumen.distribucion.map((d) => (
              <div className="cp-columna" key={d.valor}>
                <span
                  className="cp-columna-barra"
                  style={{ height: `${(d.veces / tope) * 100}%` }}
                />
                <span className="cp-columna-num">{d.valor}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'texto':
      return (
        <div className="cp-textos">
          {resumen.textos.map((t, i) => (
            <p className="cp-texto" key={i}>
              {t}
            </p>
          ))}
          {resumen.textos.length === 0 && (
            <p className="cp-vacio">Todavía no escribió nadie.</p>
          )}
        </div>
      );

    case 'plan': {
      // Cuándo eligió el grupo. Lo que escribió cada uno queda en su teléfono:
      // el compromiso se lee en voz alta, no se proyecta.
      const tope = Math.max(1, ...resumen.porDia.map((d) => d.veces));
      return (
        <div className="cp-barras">
          {resumen.porDia.map((d) => (
            <div className="cp-barra" key={d.dia}>
              <div className="cp-barra-fila">
                <span className="cp-barra-texto">{d.dia}</span>
                <span className="cp-barra-valor">{d.veces}</span>
              </div>
              <div className="cp-barra-riel">
                <span style={{ width: `${(d.veces / tope) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'cruce':
      // Los nombres no se proyectan: cada teléfono ya tiene el suyo, y la lista
      // completa en pantalla manda a todo el grupo a leer el proyector en vez
      // de buscarse entre ellos, que es lo que la consigna quiere que pase.
      return (
        <p className="cp-cifra">
          <b>{resumen.grupos}</b>
          <span className="cp-cifra-que">
            {resumen.grupos === 1 ? 'grupo armado' : 'grupos armados'}
          </span>
        </p>
      );
  }

  // Tipo desconocido: no debería llegar acá, pero la proyección no se cae.
  return <p className="cp-vacio">{actividad.titulo}</p>;
}

/**
 * Lo que hizo la sala en las tres rondas del ensayo.
 *
 * Cuatro números que caen solos: casi todos dicen el motivo, la mitad lo dice
 * como un juicio sobre la persona, pocos aguantan el silencio y casi nadie
 * cierra con una fecha. Esa caída es el remate del bloque, y el último número
 * es el mismo paso que dejó los treinta y dos compromisos de la charla 1 sin
 * agendar.
 */
function CierreDelEnsayo({ aportes }: { aportes: Aporte[] }) {
  let conversaciones = 0;
  let dijeronMotivo = 0;
  let motivoFueHecho = 0;
  let seQuedaronEscuchando = 0;
  let cerraronConFecha = 0;

  for (const a of aportes) {
    if (a.valor?.tipo !== 'ensayo') continue;
    // Una conversación por grupo y por ronda, y en cada una comunica uno solo.
    if (a.valor.rol === 'comunica') conversaciones += 1;
    if (a.valor.rol === 'recibe') {
      if (a.valor.porque) dijeronMotivo += 1;
      if (a.valor.cuando) cerraronConFecha += 1;
    }
    if (a.valor.rol === 'observa') {
      if (a.valor.motivo === 'hecho') motivoFueHecho += 1;
      if (a.valor.sostuvo === 'escucho') seQuedaronEscuchando += 1;
    }
  }

  const filas = [
    ['dijeron el motivo', dijeronMotivo],
    ['ese motivo fue un hecho y no un juicio', motivoFueHecho],
    ['se quedaron escuchando cuando el otro reaccionó', seQuedaronEscuchando],
    ['cerraron con día y hora', cerraronConFecha],
  ] as const;

  if (conversaciones === 0) {
    return <p className="cp-vacio">Se arma sola cuando terminan las rondas.</p>;
  }

  return (
    <div className="cp-cierre">
      <p className="cp-cierre-total">{conversaciones} conversaciones</p>
      <ul>
        {filas.map(([texto, cuantos]) => (
          <li key={texto}>
            <b>{cuantos}</b>
            <span>{texto}</span>
          </li>
        ))}
      </ul>
      <p className="cp-cierre-lectura">
        {lectura({
          conversaciones,
          dijeronMotivo,
          motivoFueHecho,
          seQuedaronEscuchando,
          cerraronConFecha,
        })}
      </p>
    </div>
  );
}

/**
 * La conclusión, elegida según cómo salieron los números.
 *
 * Cuatro números sueltos son datos. Lo que abre la conversación es la lectura,
 * y la lectura depende de dónde estuvo la caída: no es lo mismo una sala que
 * dijo el motivo como un juicio que una que no cerró con fecha.
 *
 * Se elige la primera que se cumple, en orden de qué duele más. Y todas
 * terminan abriendo, porque esta placa es el disparador de la puesta en común
 * y no su conclusión.
 */
function lectura(n: {
  conversaciones: number;
  dijeronMotivo: number;
  motivoFueHecho: number;
  seQuedaronEscuchando: number;
  cerraronConFecha: number;
}): string {
  const mitad = n.conversaciones / 2;

  if (n.cerraronConFecha < mitad) {
    return (
      'Casi todos dijeron lo difícil y casi nadie dijo qué pasa después. ' +
      'La conversación termina, la situación sigue. ¿Qué les pasó ahí?'
    );
  }
  if (n.motivoFueHecho < n.dijeronMotivo / 2) {
    return (
      'La mitad de los motivos fueron un juicio sobre la persona y no un ' +
      'hecho. Con un hecho se puede conversar. ¿Se dieron cuenta en el momento?'
    );
  }
  if (n.seQuedaronEscuchando < mitad) {
    return (
      'La mayoría se puso a hablar apenas el otro reaccionó. Es lo que sale ' +
      'solo cuando incomoda. ¿Qué se les hizo más largo, el silencio o la ' +
      'reacción?'
    );
  }
  return (
    'Los cuatro pasos aparecieron en la mayoría de las conversaciones. ' +
    '¿Cuál les costó más sostener?'
  );
}
