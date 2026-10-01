'use client';

/**
 * La primera hoja del informe, el resumen ejecutivo, como una carilla A4.
 *
 * Es la hoja que tiene siempre la misma estructura para todos los candidatos:
 * los datos, el nivel de ajuste, el resumen, la fundamentación, la firma y la
 * confidencialidad. El resto del informe va seguido debajo, sin carillas.
 *
 * Mide lo que ocupa el contenido y avisa si se pasa de la hoja: el resumen y
 * la fundamentación tienen largo variable, y un one pager de dos hojas deja
 * de serlo. Se ve mientras se escribe, que es cuando se puede acortar.
 */

import { useEffect, useRef, useState } from 'react';

export default function OnePager({ children }: { children: React.ReactNode }) {
  const hoja = useRef<HTMLDivElement>(null);
  const [sobra, setSobra] = useState(false);

  useEffect(() => {
    const el = hoja.current;
    if (!el) return;
    const medir = () => setSobra(el.scrollHeight > el.clientHeight + 2);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    Array.from(el.children).forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="os-onepager">
      <div ref={hoja} className={`os-onepager-hoja${sobra ? ' se-pasa' : ''}`}>
        {children}
      </div>
      {sobra && (
        <p className="os-onepager-aviso">
          La primera hoja se pasa de una carilla: acortá la fundamentación para que entre.
        </p>
      )}
    </div>
  );
}
