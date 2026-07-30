'use client';

import { useRouter } from 'next/navigation';

/** Selector de medición: por defecto se mira la última. */
export default function Tandas({
  base,
  tandas,
  actual,
}: {
  base: string;
  tandas: string[];
  actual: string | null;
}) {
  const router = useRouter();
  if (tandas.length < 2) return null;

  return (
    <div className="tandas no-print">
      <span className="tandas-rotulo">Medición</span>
      {tandas.map((t) => (
        <button
          key={t}
          type="button"
          className={t === actual ? 'tanda tanda-on' : 'tanda'}
          onClick={() => router.push(`${base}?tanda=${t}`)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
