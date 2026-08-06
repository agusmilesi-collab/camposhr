import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { listarAsistentes, resolverCiclo } from '@/lib/ciclo';

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
  searchParams: { placa?: string };
}) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) notFound();
  const { empresa, corrida } = ciclo;

  const url = `${BASE_PUBLICA}/ciclo/${empresa.slug}`;
  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#16202b', light: '#ffffff' },
  });

  const asistentes = await listarAsistentes(corrida.id);

  // Dentro de una placa del deck: sin cabecera y sobre el fondo de la
  // diapositiva. Es la primera placa del encuentro, la que se proyecta
  // mientras la gente entra.
  //
  // Va la caja entera, no sólo el código: con el nombre de la empresa adentro,
  // el que escanea confirma que está entrando al encuentro que le toca.
  if (searchParams?.placa === '1') {
    return (
      <main className="qr-en-placa">
        <style dangerouslySetInnerHTML={{ __html: 'body{background:transparent}' }} />
        <div className="qr-marco">
          <p className="qr-titulo">Entrá al ciclo desde tu teléfono</p>
          <p className="qr-empresa">{empresa.nombre}</p>
          <div className="qr-codigo" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="qr-url">{url.replace(/^https:\/\//, '')}</p>
        </div>
      </main>
    );
  }

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
          <p className="qr-titulo">Entrá al ciclo desde tu teléfono</p>
          <p className="qr-empresa">{empresa.nombre}</p>
          <div className="qr-codigo" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="qr-url">{url.replace(/^https:\/\//, '')}</p>
        </div>
      </section>
    </main>
  );
}
