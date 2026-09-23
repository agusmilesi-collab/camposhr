import { notFound } from 'next/navigation';
import { contarRespuestas } from '@/lib/supabase';
import { partirOpcion, tramo } from '@/lib/opciones';
import {
  actividadesDelCiclo,
  listarAportesDeVarias,
  rondasDelEnsayo,
  type Aporte,
  aportesDeLaSala,
  delTaller,
  asistentesDeLaSala,
  resolverCiclo,
  resumir,
  type Actividad,
  type Resumen,
} from '@/lib/ciclo';
import AutoRefresco from '@/app/cuestionario/[slug]/matriz/AutoRefresco';
import Revelar from './Revelar';
import RevelarPrimera from './RevelarPrimera';
import AbrirReclamo from './AbrirReclamo';
import { firmarSelfies } from '@/lib/supabase';
import { recordar } from '@/lib/memoria';
import { aportesDePrueba } from '@/lib/palabras-prueba';
import Nube from './Nube';
import Rotan from './Rotan';

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
  searchParams: {
    placa?: string;
    clave?: string;
    vista?: string;
    prueba?: string;
    repite?: string;
    /** En la vista que rota: de qué tramo son las respuestas que se muestran. */
    de?: string;
    largo?: string;
    forma?: string;
  };
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

  /*
   * El antes y el después de la traducción, que es la única medición que se
   * proyecta en el día.
   *
   * El "antes" es lo que la sala creyó de lo suyo cuando todavía no sabía nada:
   * cuántos apostaron que habían escrito un hecho. El "después" no es otra
   * opinión: es cuántos completaron los seis campos, y el que puso un día y un
   * número escribió un hecho por construcción.
   *
   * Los dos números salen de lo que ya está guardado, así que la placa no pide
   * ninguna consigna nueva ni un minuto más de sala.
   */
  if (searchParams?.vista === 'antes-despues') {
    const catalogo = await actividadesDelCiclo(corrida.ciclo_id);
    const apuesta = catalogo.find((a) => a.clave === 'cd-es-hecho');
    const traduccion = catalogo.find((a) => a.clave === 'cd-traduccion');

    const [deApuesta, deTraduccion] = await Promise.all([
      apuesta ? aportesDeLaSala(corrida.id, apuesta.id) : Promise.resolve([]),
      traduccion ? aportesDeLaSala(corrida.id, traduccion.id) : Promise.resolve([]),
    ]);

    const creyeron = deApuesta.filter(
      (a) => a.valor?.tipo === 'opcion' && a.valor.opcion === 0
    ).length;
    const resumenTraduccion =
      traduccion && resumir(traduccion, deTraduccion);
    const lograron =
      resumenTraduccion?.tipo === 'campos' ? resumenTraduccion.completos : 0;

    return (
      <main className={enPlaca ? 'cp cp-placa' : 'cp'}>
        {enPlaca && <FondoTransparente />}
        <div className="cp-antes-despues">
          <div className="cp-ad-lado">
            <span className="cp-ad-cuando">Al empezar</span>
            <b className="cp-ad-num">{creyeron}</b>
            <p className="cp-ad-que">
              creyeron que lo que habían escrito era un hecho
            </p>
            <em className="cp-ad-de">de {deApuesta.length} que respondieron</em>
          </div>
          <div className="cp-ad-lado">
            <span className="cp-ad-cuando">Al terminar</span>
            <b className="cp-ad-num">{lograron}</b>
            <p className="cp-ad-que">
              lo dejaron escrito con un día y una cantidad
            </p>
            <em className="cp-ad-de">de {deTraduccion.length} que lo tradujeron</em>
          </div>
        </div>
        <AutoRefresco segundos={10} oculto />
      </main>
    );
  }

  /*
   * Las respuestas de los que llevan años, pasando de a una.
   *
   * Va mientras la sala reparte las monedas. Sin esto, setenta personas
   * escriben algo que nadie lee y que recién aparece en el informe cinco días
   * después: pasándolas anónimas durante la votación, el material se usa el
   * mismo día y el que recién empieza lee consejo real mientras vota.
   *
   *   ?vista=rotan&clave=cd-pregunta&de=Más de un año
   */
  if (searchParams?.vista === 'rotan') {
    const origen = searchParams?.clave
      ? await deMemoria(corrida.ciclo_id, searchParams.clave)
      : null;
    if (!origen) {
      return (
        <main className={enPlaca ? 'cp cp-placa' : 'cp'}>
          {enPlaca && <FondoTransparente />}
          <p className="cp-vacio">Falta decir qué consigna se muestra.</p>
        </main>
      );
    }

    const [aportes, sala] = await Promise.all([
      aportesDeLaSala(corrida.id, origen.id),
      asistentesDeLaSala(corrida.id),
    ]);
    const porId = new Map(sala.map((a) => [a.id, a]));
    const quienes = searchParams?.de ?? null;

    const textos = aportes
      .filter((a) => a.valor?.tipo === 'texto' && a.valor.texto.trim() !== '')
      .filter((a) => {
        if (!quienes) return true;
        return porId.get(a.asistente_id)?.datos?.rol === quienes;
      })
      .map((a) => (a.valor?.tipo === 'texto' ? a.valor.texto : ''));

    return (
      <main className={enPlaca ? 'cp cp-placa cp-lleno' : 'cp cp-lleno'}>
        {enPlaca && <FondoTransparente />}
        <Rotan textos={textos} />
        <AutoRefresco segundos={20} oculto />
      </main>
    );
  }

  const actividad = searchParams?.clave
    ? await deMemoria(corrida.ciclo_id, searchParams.clave)
    : await abiertaDeMemoria(corrida.ciclo_id, corrida.actividad_abierta_id);

  if (!actividad) {
    return (
      <main className={enPlaca ? 'cp cp-placa' : 'cp'}>
        {enPlaca && <FondoTransparente />}
        <p className="cp-vacio">Se arma sola cuando el grupo responde.</p>
        <AutoRefresco segundos={5} oculto />
      </main>
    );
  }

  /*
   * `?prueba=33` llena la pantalla con respuestas inventadas para ver cómo se
   * acomoda antes de tener el grupo. Sólo corre en desarrollo y no escribe
   * nada, igual que la matriz de prueba de la charla 3.
   * `&repite=4` hace que las primeras se repitan, para comparar con el caso de
   * todas distintas, que es el que fuerza el cuerpo más grande.
   */
  const pedidas = Number(searchParams?.prueba);
  const aportes =
    process.env.NODE_ENV !== 'production' && Number.isFinite(pedidas)
      ? aportesDePrueba(
          actividad.id,
          Math.trunc(pedidas),
          Math.trunc(Number(searchParams?.repite)) || 0
        )
      : await aportesDeLaSala(corrida.id, actividad.id);

  /**
   * La consigna proyectada: lo que hay que leer para poder responder desde el
   * teléfono, y nada de lo respondido. Las preguntas de la encuesta de la
   * charla 1 van así: lo que contesta cada uno alimenta el informe a Recursos
   * Humanos, y proyectarlo mientras responden condiciona al que todavía no
   * eligió.
   */
  if (soloConsigna) {
    const inscriptos = delTaller(await asistentesDeLaSala(corrida.id)).length;
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
    const inscriptos = delTaller(await asistentesDeLaSala(corrida.id)).length;
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
        {/* Seis y no tres: es el número que ella mira de reojo para saber si
            puede avanzar, y corre justo cuando la sala entera está
            escribiendo. */}
        <AutoRefresco segundos={6} oculto />
      </main>
    );
  }

  const resumen = resumir(actividad, aportes);

  /*
   * El ranking de monedas necesita el texto de cada pregunta, que vive en los
   * aportes de la actividad votada y no en este resumen. Se resuelve acá, del
   * lado del servidor, y viaja ya armado: la pantalla que se proyecta no tiene
   * que saber de dónde sale nada.
   */
  let votadas: {
    texto: string;
    monedas: number;
    votantes: number;
    quien: string | null;
    foto: string | null;
  }[] = [];
  if (resumen.tipo === 'monedas' && actividad.config.desde) {
    const origen = await deMemoria(corrida.ciclo_id, actividad.config.desde);
    if (origen) {
      const [preguntas, sala] = await Promise.all([
        aportesDeLaSala(corrida.id, origen.id),
        asistentesDeLaSala(corrida.id),
      ]);
      const quienes = new Map(sala.map((a) => [a.id, a]));
      const porId = new Map(preguntas.map((a) => [a.id, a]));

      votadas = resumen.ranking
        .map((r) => {
          const aporte = porId.get(r.aporteId);
          const texto = aporte?.valor?.tipo === 'texto' ? aporte.valor.texto : '';
          // El nombre solo si lo reclamó: el resto queda anónimo, que es la
          // condición con la que escribieron.
          const duena =
            aporte?.valor?.tipo === 'texto' && aporte.valor.reclamado
              ? quienes.get(aporte.asistente_id)
              : null;
          return {
            texto,
            monedas: r.monedas,
            votantes: r.votantes,
            quien: duena ? `${duena.nombre} ${duena.apellido}` : null,
            fotoPath: duena?.foto_path ?? null,
          };
        })
        .filter((r) => r.texto !== '')
        .map(({ fotoPath, ...r }) => ({ ...r, foto: fotoPath }));
      // La foto se firma solo para quien reclamó, que es a lo sumo uno.
      const conFoto = votadas.map((v) => v.foto).filter((f): f is string => Boolean(f));
      if (conFoto.length) {
        // Firmada una vez por hora: la pantalla se redibuja cada cinco
        // segundos, y con una dirección nueva en cada vuelta la foto parpadea.
        const firmadas = await recordar(`selfie:${conFoto.join(',')}`, 3600, () =>
          firmarSelfies(conFoto)
        );
        votadas = votadas.map((v) => ({ ...v, foto: v.foto ? firmadas.get(v.foto) ?? null : null }));
      } else {
        votadas = votadas.map((v) => ({ ...v, foto: null }));
      }
    }
  }

  /*
   * La nube necesita el alto del marco para poder medirse: adentro de la placa
   * el bloque se adapta a su contenido, y contra eso no hay nada que medir. Los
   * demás resúmenes se siguen acomodando solos.
   */
  const lleno = resumen.tipo === 'palabra' ? ' cp-lleno' : '';

  // Solo en local: `&largo=1` pone todas las preguntas del largo máximo
  // que acepta el teléfono (400), para ver cómo se acomoda la placa.
  if (process.env.NODE_ENV !== 'production' && searchParams?.largo && votadas.length) {
    const larga =
      'Cuando tengo que marcarle algo a alguien de mi equipo que además es amigo mío desde antes de que yo fuera su jefe, ' +
      'y sé que lo que le voy a decir le va a doler porque está pasando un momento complicado en su casa, ¿cómo separo la ' +
      'relación personal de lo que le tengo que pedir como líder sin que sienta que lo traicioné o que cambié con él por el cargo?';
    votadas = votadas.map((v) => ({ ...v, texto: larga.slice(0, 400) }));
  }

  /*
   * La más votada, sola en su placa: la pregunta y quien la escribió. Llegar
   * acá es lo que la revela, y quien la escribió sigue anónimo hasta que
   * reclama el pozo desde el teléfono; ahí aparecen su nombre y su foto.
   */
  if (resumen.tipo === 'monedas' && searchParams?.vista === 'primera') {
    const primera = votadas[0];
    return (
      <main className={enPlaca ? 'cp cp-placa' : 'cp'}>
        {enPlaca && <FondoTransparente />}
        {enPlaca && <RevelarPrimera slug={empresa.slug} />}
        {!primera ? (
          <p className="cp-vacio">Todavía no hay preguntas votadas.</p>
        ) : (
          <div className="cp-primera">
            <div
              className={
                'cp-primera-card cp-primera-pregunta' + (primera.texto.length > 160 ? ' larga' : '')
              }
            >
              <span className="cp-ranking-puesto">1</span>
              <p>{primera.texto}</p>
              <span className="cp-ranking-pozo">
                <b>
                  {primera.monedas}
                  <img className="cp-coin" src="/jd-coin.png" alt="" />
                </b>
                <em>
                  {primera.votantes === 1 ? '1 persona' : `${primera.votantes} personas`}
                </em>
              </span>
            </div>
            <div className={'cp-primera-card cp-primera-autor' + (primera.quien ? ' reclamada' : '')}>
              {primera.quien ? (
                <span className="cp-primera-cara">
                  {primera.foto ? <img src={primera.foto} alt="" /> : <span>?</span>}
                </span>
              ) : (
                // Mientras nadie lo reclama, lo que se ve es el pozo.
                <img className="cp-primera-pozo" src="/jd-pozo.png" alt="" />
              )}
              <span className="cp-primera-rotulo">Quién la escribió</span>
              {/* Sin género: la sala todavía no sabe quién es. */}
              <strong>{primera.quien ?? 'Todavía no se sabe'}</strong>
              {!primera.quien &&
                (corrida.actividad_abierta_id === actividad.id ? (
                  <em>Teléfonos abiertos: el pozo espera a quien la escribió</em>
                ) : enPlaca ? (
                  <AbrirReclamo slug={empresa.slug} actividadId={actividad.id} />
                ) : (
                  <em>Aparece si reclama el pozo</em>
                ))}
            </div>
          </div>
        )}
        <AutoRefresco segundos={5} oculto />
      </main>
    );
  }

  return (
    <main className={(enPlaca ? 'cp cp-placa' : 'cp') + lleno}>
      {enPlaca && <FondoTransparente />}
      {!enPlaca && <h1 className="cp-titulo">{actividad.titulo}</h1>}

      <Vista
        actividad={actividad}
        resumen={resumen}
        votadas={votadas}
        revelado={corrida.revelado ?? 0}
        slug={empresa.slug}
        columnas={searchParams?.forma !== 'lista'}
      />

      {/* En el ranking la cuenta de respuestas no dice nada: lo que se mira es
          el pozo de cada pregunta. */}
      {resumen.tipo !== 'monedas' && <p className="cp-pie">{pie(resumen)}</p>}

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

function Vista({
  actividad,
  resumen,
  votadas = [],
  revelado = 0,
  slug,
  columnas = false,
}: {
  /** La 2ª y la 3ª lado a lado, en cards. `&forma=lista` las pone una debajo de la otra. */
  columnas?: boolean;
  actividad: Actividad;
  resumen: Resumen;
  /** Cuántas del ranking se revelaron: 0 la tercera, 1 hasta la segunda, 2 las tres. */
  revelado?: number;
  slug: string;
  /** El ranking con el texto de cada pregunta, ya resuelto por el servidor. */
  votadas?: {
    texto: string;
    monedas: number;
    votantes: number;
    quien: string | null;
  }[];
}) {
  switch (resumen.tipo) {
    case 'palabra':
      /*
       * El cuerpo no se puede decidir acá: depende de cuántas palabras son y
       * de cuánto mide el marco, y el marco lo conoce el navegador. Se mide
       * del lado del cliente, en `Nube`.
       */
      return <Nube palabras={resumen.nube} />;

    /*
     * El reparto, ordenado. Las tres primeras son las que se leen en voz alta,
     * así que se marcan: el resto queda a la vista para que se vea que la sala
     * eligió entre todas y no entre tres.
     *
     * El pozo va al lado de cada una. Es lo que hace que el senior escuche que
     * 52 de 80 querían esa respuesta antes de abrir la boca.
     */
    case 'monedas': {
      if (votadas.length === 0) {
        return <p className="cp-vacio">Se arma sola a medida que reparten.</p>;
      }
      /*
       * Se revelan de a una, primero la tercera y después la segunda, y la que
       * ya salió queda a la vista: la placa va sumando, no reemplazando. Cada
       * una se contesta en voz alta antes de pasar a la siguiente. La primera,
       * que es la que tiene premio, llega sola en la placa que sigue.
       *
       * Solo las tres que se contestan. Las demás no se publican: la placa
       * siguiente las reparte de a una y proyectarlas acá deja a la vista
       * cuáles quedaron últimas.
       */
      // La 1ª va sola en la placa siguiente: acá quedan la 2ª y la 3ª. Con
      // menos preguntas votadas se muestra lo que haya después de la primera.
      const resto = votadas.slice(1, 3).map((v, k) => ({ v, i: k + 1 }));
      if (resto.length === 0) {
        return <p className="cp-vacio">La más votada va en la placa siguiente.</p>;
      }
      const visibles = resto.filter(({ i }) => i === resto.length || revelado >= 1);
      const falta = resto.length === 2 && revelado < 1 ? 1 : 0;
      if (columnas) {
        return (
          <>
            {/* La 2ª a la izquierda y la 3ª a la derecha. Mientras la 2ª no
                salió, su lugar queda marcado vacío: la sala ve que falta una. */}
            <div className="cp-duo">
              {[1, 2].map((puesto) => {
                const fila = visibles.find(({ i }) => i === puesto);
                if (!fila) {
                  return resto.some(({ i }) => i === puesto) ? (
                    <div className="cp-duo-card cp-duo-vacia" key={puesto}>
                      <span className="cp-ranking-puesto">{puesto + 1}</span>
                    </div>
                  ) : null;
                }
                const { v } = fila;
                return (
                  <div className={'cp-duo-card' + (v.texto.length > 160 ? ' larga' : '')} key={puesto}>
                    <span className="cp-ranking-puesto">{puesto + 1}</span>
                    <p>{v.texto}</p>
                    <span className="cp-ranking-pozo">
                      <b>
                        {v.monedas}
                        <img className="cp-coin" src="/jd-coin.png" alt="" />
                      </b>
                      <em>{v.votantes === 1 ? '1 persona' : `${v.votantes} personas`}</em>
                    </span>
                  </div>
                );
              })}
            </div>
            {falta >= 1 && <Revelar slug={slug} revelado={revelado} etiqueta="Mostrar la 2ª" />}
          </>
        );
      }
      return (
        <>
          <ol className="cp-ranking">
            {visibles.map(({ v, i }) => (
              <li className={'cp-ranking-fila' + (v.texto.length > 160 ? ' larga' : '')} key={v.texto}>
                <span className="cp-ranking-puesto">{i + 1}</span>
                <div className="cp-ranking-que">
                  <p>{v.texto}</p>
                  {/* Quien la reclamó sale del anonimato por elección suya, y
                      entonces la pantalla dice de quién es. */}
                  {v.quien && <span className="cp-ranking-quien">{v.quien}</span>}
                </div>
                <span className="cp-ranking-pozo">
                  <b>
                    {v.monedas}
                    <img className="cp-coin" src="/jd-coin.png" alt="" />
                  </b>
                  <em>{v.votantes === 1 ? '1 persona' : `${v.votantes} personas`}</em>
                </span>
              </li>
            ))}
          </ol>
          {falta >= 1 && (
            <Revelar
              slug={slug}
              revelado={revelado}
              etiqueta="Mostrar la 2ª"
            />
          )}
        </>
      );
    }

    /*
     * La traducción no proyecta ningún texto: muestra cuántos completaron cada
     * dato. Eso conserva la prueba sobre la propia sala sin exponer a nadie, y
     * es además lo que la expositora mira para saber si puede seguir.
     */
    case 'campos': {
      const tope = Math.max(1, resumen.total);
      return (
        <div className="cp-barras">
          {resumen.porCampo.map((c) => (
            <div className="cp-barra" key={c.clave}>
              <div className="cp-barra-fila">
                <span className="cp-barra-texto">{c.etiqueta}</span>
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
          <div className="cp-duo">
            {resumen.distribucion.map((d) => (
              <div className={`cp-columna ${tramo(d.valor)}`} key={d.valor}>
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
  let lesQuedoClaro = 0;
  let motivoFueHecho = 0;
  let seQuedaronEscuchando = 0;
  let cerraronConFecha = 0;

  for (const a of aportes) {
    if (a.valor?.tipo !== 'ensayo') continue;
    // Una conversación por grupo y por ronda, y en cada una comunica uno solo.
    if (a.valor.rol === 'comunica') conversaciones += 1;
    if (a.valor.rol === 'recibe') {
      if (a.valor.porque) lesQuedoClaro += 1;
      if (a.valor.cuando) cerraronConFecha += 1;
    }
    if (a.valor.rol === 'observa') {
      if (a.valor.motivo === 'hecho') motivoFueHecho += 1;
      if (a.valor.sostuvo === 'escucho') seQuedaronEscuchando += 1;
    }
  }

  const filas = [
    ['al otro le quedó claro por qué', lesQuedoClaro],
    ['el motivo que dieron fue un hecho', motivoFueHecho],
    ['se quedaron escuchando cuando el otro reaccionó', seQuedaronEscuchando],
    ['el otro sabe qué pasa ahora y cuándo', cerraronConFecha],
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
          lesQuedoClaro,
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
  lesQuedoClaro: number;
  motivoFueHecho: number;
  seQuedaronEscuchando: number;
  cerraronConFecha: number;
}): string {
  const mitad = n.conversaciones / 2;

  if (n.cerraronConFecha < mitad) {
    return (
      'Casi todos dijeron lo difícil y casi nadie se fue sabiendo qué pasa ' +
      'después. La conversación termina, la situación sigue. ¿Qué les pasó ahí?'
    );
  }
  if (n.motivoFueHecho < n.lesQuedoClaro / 2) {
    return (
      'La mitad de los motivos fueron un juicio sobre la persona. Con un ' +
      'hecho se puede conversar. ¿Se dieron cuenta en el momento?'
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

/*
 * Lo que se proyecta se refresca solo cada cinco a veinte segundos, y lo pide
 * además cada pantalla que tenga el deck abierto. Las actividades salen del
 * catálogo que ya tienen en memoria los teléfonos, y las respuestas de la misma
 * lectura compartida que usan ellos (ocho segundos): el ranking o la nube
 * pueden llegar con unos segundos de atraso, que proyectado no se nota, y cada
 * refresco deja de costar dos o tres consultas a la base.
 */
async function deMemoria(cicloId: string, clave: string | undefined) {
  if (!clave) return null;
  return (await actividadesDelCiclo(cicloId)).find((a) => a.clave === clave) ?? null;
}

async function abiertaDeMemoria(cicloId: string, id: string | null) {
  if (!id) return null;
  return (await actividadesDelCiclo(cicloId)).find((a) => a.id === id) ?? null;
}
