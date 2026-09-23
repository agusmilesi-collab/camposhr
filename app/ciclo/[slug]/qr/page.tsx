import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { listarAsistentes, resolverCiclo } from '@/lib/ciclo';
import PasaAlDeck from '../../_placa/PasaAlDeck';

/**
 * El código de entrada al ciclo, para proyectar.
 *
 * El mismo código ya viene en la primera placa del deck. Esta pantalla es para
 * el rezagado: el que llegó tarde, el que cerró la página o el que cambió de
 * teléfono, sin tener que volver a la placa 1 y perder el hilo de la charla.
 *
 * Un solo código para todo el grupo: la identidad la resuelve el registro.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Código de entrada — Campos HR',
  robots: { index: false, follow: false },
};

/** El asistente entra desde el host público, no desde tools. */
const BASE_PUBLICA = 'https://camposhr.com';

export default async function QrDelCiclo({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { placa?: string; destino?: string };
}) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) notFound();
  const { empresa, corrida } = ciclo;

  /*
   * A dónde lleva el código.
   *
   * Sin nada, al encuentro: es el de la primera placa, el que abre el registro.
   * Con `?destino=resumen`, al repaso que se lleva cada uno, que es el de la
   * última. Son dos códigos distintos en dos momentos distintos, y el mismo
   * marco los dibuja.
   */
  const alResumen = searchParams?.destino === 'resumen';
  /*
   * A la encuesta se llega por el mismo camino que al encuentro, porque la
   * encuesta es la consigna que está abierta. Lo único que cambia es el
   * rótulo: en el cierre, "entrá al ciclo" no le dice a nadie qué tiene que
   * hacer con el código.
   */
  const aLaEncuesta = searchParams?.destino === 'encuesta';
  const url = alResumen
    ? `${BASE_PUBLICA}/ciclo/${empresa.slug}/resumen`
    : `${BASE_PUBLICA}/ciclo/${empresa.slug}`;
  const titulo = alResumen
    ? 'Llevate lo que escribiste'
    : aLaEncuesta
      ? 'Encuesta y tu resumen'
      : 'Entrá al ciclo desde tu teléfono';
  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#16202b', light: '#ffffff' },
  });

  /*
   * El código solo, para el rincón de una portada.
   *
   * A partir de la segunda charla el código no abre el encuentro: está para el
   * que cerró el navegador y perdió la pantalla del ciclo. Ahí no hace falta
   * repetir el nombre de la empresa ni la dirección, porque la placa ya los
   * dice con la tipografía del deck, y a este tamaño esas dos líneas dejarían
   * el código demasiado chico para escanearlo desde una silla del fondo.
   */
  if (searchParams?.placa === 'rincon') {
    return (
      <main className="qr-en-rincon">
        <style
          dangerouslySetInnerHTML={{
            __html: 'html,body{background:transparent;overflow:hidden}',
          }}
        />
        <div className="qr-codigo" dangerouslySetInnerHTML={{ __html: svg }} />
      </main>
    );
  }

  // Dentro de una placa del deck: sin cabecera y sobre el fondo de la
  // diapositiva. Es la primera placa del encuentro, la que se proyecta
  // mientras la gente entra.
  //
  // Sólo el rótulo y el código. El nombre de la empresa y la dirección
  // escrita salían acá y no hacían falta: la placa ya dice de qué encuentro se
  // trata, y nadie tipea una dirección teniendo el código delante.
  if (searchParams?.placa === '1') {
    return (
      <main className="qr-en-placa">
        <PasaAlDeck />
        <style
          dangerouslySetInnerHTML={{
            __html: 'html,body{background:transparent;overflow:hidden}',
          }}
        />
        <div className="qr-marco">
          <p className="qr-titulo">{titulo}</p>
          <div className="qr-codigo" dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </main>
    );
  }

  // Sólo la pantalla completa cuenta cuántos se registraron. Las dos versiones
  // de arriba viven adentro de una placa proyectada, y preguntarlo ahí era una
  // consulta contra la base en el momento en que la sala entera se registra.
  const asistentes = await listarAsistentes(corrida.id);

  return (
    <main className="wrap">
      <section className="head no-print">
        <div className="head-top">
          <div className="eyebrow">Ciclo de encuentros</div>
          <a href="/presentaciones" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Presentaciones
          </a>
        </div>
        <h1>{empresa.nombre}</h1>
        <p className="head-nota">
          {asistentes.length === 0
            ? 'Todavía no se registró nadie.'
            : `${asistentes.length} ${
                asistentes.length === 1 ? 'persona registrada' : 'personas registradas'
              }. Quien ya entró una vez no vuelve a cargar nada.`}
        </p>
      </section>

      <section className="qr-bloque">
        <div className="qr-marco">
          <p className="qr-titulo">{titulo}</p>
          <p className="qr-empresa">{empresa.nombre}</p>
          <div className="qr-codigo" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="qr-url">{url.replace(/^https:\/\//, '')}</p>
        </div>
      </section>
    </main>
  );
}
