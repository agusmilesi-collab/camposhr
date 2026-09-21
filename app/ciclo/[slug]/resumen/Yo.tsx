'use client';

import { useEffect, useState } from 'react';

/**
 * Lo que escribió esta persona, traído con la marca que su teléfono ya tiene.
 *
 * El código de la última placa es uno solo para toda la sala, así que la
 * dirección no puede traer el nombre de nadie. Quién es lo sabe el propio
 * teléfono, que guardó su identidad al registrarse: acá se lee esa marca y se
 * pide lo suyo.
 *
 * Si alguien abre el código desde otro teléfono, no aparece nada propio y el
 * resto del repaso se lee igual. Es la única consecuencia y es preferible a
 * pedirle que vuelva a identificarse con la sala levantándose.
 */

type Loprio = {
  nombre: string;
  reconocimiento: { que_hizo: string; cuando: string; para_que: string } | null;
  conversacion: Record<string, string> | null;
};

export default function Yo({ slug, inicial }: { slug: string; inicial: string | null }) {
  const [mio, setMio] = useState<Loprio | null>(null);
  const [buscando, setBuscando] = useState(true);

  useEffect(() => {
    let id = inicial;
    if (!id) {
      try {
        const guardado = localStorage.getItem(`ciclo:${slug}`);
        if (guardado) id = JSON.parse(guardado)?.id ?? null;
      } catch {
        // Navegador sin almacenamiento: se lee el repaso sin la parte propia.
      }
    }
    if (!id) {
      setBuscando(false);
      return;
    }
    fetch(`/api/ciclo/${slug}/resumen?asistente=${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMio(d?.mio ?? null))
      .catch(() => setMio(null))
      .finally(() => setBuscando(false));
  }, [slug, inicial]);

  if (buscando) return null;

  if (!mio) {
    return (
      <section className="rs-bloque rs-mio-vacio">
        <p>
          Abrí este código desde el mismo teléfono con el que respondiste y acá
          vas a ver lo que escribiste.
        </p>
      </section>
    );
  }

  const c = mio.conversacion;

  return (
    <section className="rs-bloque rs-mio">
      <h2>Lo que escribiste, {mio.nombre}</h2>

      {c && (
        <div className="rs-mia">
          <p className="rs-mia-que">Tu conversación</p>
          <p className="rs-mia-frase">
            {[c.que_hizo, c.que_dia && `· ${c.que_dia}`, c.cuantas_veces && `· ${c.cuantas_veces} veces`]
              .filter(Boolean)
              .join(' ')}
          </p>
          {c.que_pedis && (
            <p className="rs-mia-dato">
              <b>Le vas a pedir:</b> {c.que_pedis}
              {c.para_cuando ? ` · para ${c.para_cuando}` : ''}
            </p>
          )}
          {c.cuando_se_lo_decis && (
            <p className="rs-mia-fecha">Se lo decís el {c.cuando_se_lo_decis}</p>
          )}
        </div>
      )}

      {mio.reconocimiento && (
        <div className="rs-mia">
          <p className="rs-mia-que">Tu reconocimiento</p>
          <p className="rs-mia-frase">
            {mio.reconocimiento.que_hizo} {mio.reconocimiento.cuando}
          </p>
          {mio.reconocimiento.para_que && (
            <p className="rs-mia-dato">{mio.reconocimiento.para_que}</p>
          )}
        </div>
      )}
    </section>
  );
}
