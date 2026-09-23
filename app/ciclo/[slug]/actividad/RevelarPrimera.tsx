'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Llegar a la placa de la más votada es lo que la revela. El deck carga este
 * marco recién cuando se llega a la placa, así que al aparecer se avisa y
 * desde ahí la votación queda cerrada y quien la escribió puede reclamar.
 */
export default function RevelarPrimera({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/ciclo/${slug}/revelar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ primera: true }),
    })
      .then(() => router.refresh())
      .catch(() => {});
  }, [slug, router]);

  return null;
}
