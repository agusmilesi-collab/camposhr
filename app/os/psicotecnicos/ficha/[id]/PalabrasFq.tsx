'use client';

import { useState } from 'react';
import type { Hallazgo } from '@/lib/rorschach-tabla-a';

/**
 * Las palabras de la Tabla A del área de una respuesta, al pie del selector de
 * FQ de la ficha.
 *
 * La calidad formal sale de buscar lo que dijo la persona en la tabla del
 * área, que es lo que la encuesta hace sola. En la ficha había que ir a
 * buscarlo al librito: acá se abre la lista del área, se filtra escribiendo y
 * tocar una palabra pone su calidad.
 *
 * La tabla pesa 140 KB y la ficha se abre todo el tiempo sin tocar esto, así
 * que se carga recién al apretar el botón.
 */
export default function PalabrasFq({
  lamina,
  localizacion,
  nLocalizacion,
  areas,
  elegir,
}: {
  lamina: string | null;
  localizacion: string | null;
  nLocalizacion: string | null;
  areas?: string[] | null;
  elegir: (fq: string) => void;
}) {
  const [palabras, setPalabras] = useState<Hallazgo[] | null>(null);
  const [donde, setDonde] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [plano, setPlano] = useState<((t: string) => string) | null>(null);

  if (!lamina) return null;

  async function abrir() {
    const tabla = await import('@/lib/rorschach-tabla-a');
    const conocidas = tabla.areasDe(lamina as string);
    // Las áreas marcadas en la encuesta, o las que dice el N° loc.: "2+7" con
    // la familia de la localización ("D+" → D2 y D7).
    let elegidas = (areas ?? []).filter((a) => conocidas.includes(a));
    if (!elegidas.length) {
      const familia = (localizacion ?? '').replace(/(v\/\+|o|v|\+)$/, '');
      const numeros = (nLocalizacion ?? '').split('+').map((x) => x.trim()).filter(Boolean);
      elegidas = numeros.flatMap((n) => {
        const a = [`${familia}${n}`, `D${n}`, `Dd${n}`, `DdS${n}`, `DS${n}`].find((x) =>
          conocidas.includes(x)
        );
        return a ? [a] : [];
      });
      if (!elegidas.length && familia.startsWith('W')) elegidas = conocidas.filter((a) => a.startsWith('W'));
    }
    // Sin área que se pueda leer, la lámina entera: igual sirve buscar.
    const lista = (elegidas.length ? elegidas : conocidas).flatMap((a) => tabla.entradasDe(lamina as string, a));
    setDonde(elegidas);
    setPlano(() => tabla.plano);
    setPalabras(lista);
  }

  if (!palabras) {
    return (
      <button type="button" className="os-codigos-todas" onClick={() => void abrir()}>
        Ver palabras de la Tabla A
      </button>
    );
  }

  const q = plano ? plano(busca.trim()) : busca.trim().toLowerCase();
  const visibles = q && plano ? palabras.filter((p) => plano(p.respuesta).includes(q)) : palabras;

  return (
    <span className="os-palabras-fq">
      <span className="os-palabras-fq-titulo">
        {donde.length ? `Palabras de ${donde.join(' + ')}` : `Palabras de la lámina ${lamina}`}
      </span>
      <input
        className="os-codigos-buscar"
        value={busca}
        placeholder="Buscar lo que dijo"
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar en la Tabla A"
        autoFocus
      />
      <span className="os-palabras-fq-lista">
        {visibles.map((p, i) => (
          <button
            key={`${p.area}-${p.respuesta}-${i}`}
            type="button"
            className="os-palabras-fq-item"
            onClick={() => elegir(p.calidad === 'o' ? 'O' : p.calidad === 'u' ? 'U' : p.calidad)}
            title={`Poner FQ ${p.calidad}`}
          >
            <span className="os-palabras-fq-calidad">{p.calidad}</span>
            <span className="os-palabras-fq-texto">{p.respuesta}</span>
            {donde.length !== 1 && <span className="os-palabras-fq-area">{p.area}</span>}
          </button>
        ))}
        {visibles.length === 0 && <span className="os-codigos-nada">No está en la tabla</span>}
      </span>
    </span>
  );
}
