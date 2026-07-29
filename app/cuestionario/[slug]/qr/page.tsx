import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { getEmpresaPorSlug } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'QR del cuestionario — Campos HR',
  robots: { index: false, follow: false },
};

/** El cuestionario se responde desde el host público, no desde tools. */
const BASE_PUBLICA = 'https://camposhr.com';

export default async function QrEmpresa({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { v?: string };
}) {
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  const conGeneraciones = searchParams.v === 'g';
  const url = conGeneraciones
    ? `${BASE_PUBLICA}/c/${empresa.slug}/g`
    : `${BASE_PUBLICA}/c/${empresa.slug}`;
  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#16202b', light: '#ffffff' },
  });

  return (
    <main className="wrap">
      <section className="head no-print">
        <div className="head-top">
          <div className="eyebrow">Cuestionario de perfil</div>
          <a href="/cuestionario" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Empresas
          </a>
        </div>
        <h1>{empresa.nombre}</h1>
      </section>

      <section className="qr-bloque">
        <div className="qr-marco">
          <p className="qr-titulo">
            {conGeneraciones ? 'Cuestionario mixto' : 'Cuestionario de perfil'}
          </p>
          <p className="qr-empresa">{empresa.nombre}</p>
          <div className="qr-codigo" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="qr-url">{url.replace(/^https:\/\//, '')}</p>
        </div>

        <div className="qr-acciones no-print">
          <a className="btn" href={url} target="_blank" rel="noreferrer">
            Abrir cuestionario
          </a>
          <a className="btn-ghost" href={`/cuestionario/${empresa.slug}/matriz`}>
            Ver matriz
          </a>
        </div>
      </section>
    </main>
  );
}
