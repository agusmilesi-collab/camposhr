'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AYUDA_ESCALA,
  AYUDA_FRASES,
  CONSIGNA_FRASES,
  PLACAS,
  PORTADA,
} from '@/lib/cuestionario';
import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';
import { PLACAS_GENERACIONES } from '@/lib/generaciones';
import MatrizBenziger from '@/app/_components/MatrizBenziger';
import MatrizPortada from '@/app/_components/MatrizPortada';

type ResultadoServidor = {
  totales: Record<Perfil, number>;
  perfiles: Perfil[];
  tipo: 'definido' | 'doble' | 'mixto';
  ejeX: number;
  ejeY: number;
};

const LETRAS = 'ABCDEFGHIJKLMNO'.split('');

export default function Cuestionario({
  slug,
  empresa,
  variante = 'perfil',
  lideres = [],
}: {
  slug: string;
  empresa: string;
  /** 'generaciones' suma placas y exige elegir líder. */
  variante?: 'perfil' | 'generaciones';
  lideres?: { id: string; nombre: string }[];
}) {
  // 0 portada · 1 identidad · 2..9 placas · 10 autopercepción · 11 resultado
  const [paso, setPaso] = useState(0);
  const [apellido, setApellido] = useState('');
  const [nombre, setNombre] = useState('');
  const [liderId, setLiderId] = useState('');
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [escalas, setEscalas] = useState<Record<number, number>>({});
  const [marcadas, setMarcadas] = useState<Record<number, number[]>>({});
  const [generacionales, setGeneracionales] = useState<Record<number, number>>({});
  const [autopercepcion, setAutopercepcion] = useState<Perfil | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoServidor | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  // Mapa de pasos: 0 portada · 1 identidad · 2..9 placas de perfil ·
  // 10 autopercepción · 11..14 generaciones (solo en esa variante) · resultado.
  const placasGen = variante === 'generaciones' ? PLACAS_GENERACIONES : [];
  const PASO_AUTOPERCEPCION = 2 + PLACAS.length;
  const INICIO_GEN = PASO_AUTOPERCEPCION + 1;
  const TOTAL_PASOS = INICIO_GEN + placasGen.length;
  const avance = Math.min(paso, TOTAL_PASOS) / TOTAL_PASOS;

  const placaActual = paso >= 2 && paso < 2 + PLACAS.length ? PLACAS[paso - 2] : null;
  const indicePlaca = paso - 2;

  const indiceGen = paso - INICIO_GEN;
  const placaGen =
    indiceGen >= 0 && indiceGen < placasGen.length ? placasGen[indiceGen] : null;
  const ultimaGen = indiceGen === placasGen.length - 1;

  const pideLider = lideres.length > 0;
  const identidadCompleta =
    apellido.trim().length >= 2 &&
    nombre.trim().length >= 2 &&
    (!pideLider || liderId !== '');

  const perfilesResultado = useMemo(() => {
    if (!resultado) return [];
    return resultado.perfiles;
  }, [resultado]);

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    try {
      const reducida = await reducirImagen(archivo);
      setFoto({ blob: reducida, url: URL.createObjectURL(reducida) });
    } catch {
      setError('No pudimos procesar la foto. Podés continuar sin ella.');
    }
  }

  function responderEscala(valor: number) {
    setEscalas((prev) => ({ ...prev, [indicePlaca]: valor }));
    setTimeout(() => setPaso((p) => p + 1), 160);
  }

  function responderGeneracion(opcion: number) {
    setGeneracionales((prev) => ({ ...prev, [indiceGen]: opcion }));
    if (!ultimaGen) setTimeout(() => setPaso((p) => p + 1), 160);
  }

  function alternarFrase(i: number) {
    setMarcadas((prev) => {
      const actuales = prev[indicePlaca] ?? [];
      const nuevas = actuales.includes(i)
        ? actuales.filter((x) => x !== i)
        : [...actuales, i];
      return { ...prev, [indicePlaca]: nuevas };
    });
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const respuestas = PLACAS.map((placa, i) =>
        placa.tipo === 'descriptiva'
          ? { tipo: 'descriptiva' as const, valor: escalas[i] ?? 0 }
          : { tipo: 'frases' as const, seleccion: marcadas[i] ?? [] }
      );

      const datos = new FormData();
      datos.append(
        'datos',
        JSON.stringify({
          apellido: apellido.trim(),
          nombre: nombre.trim(),
          respuestas,
          autopercepcion,
          variante,
          liderId: liderId || null,
          generaciones: placasGen.map((_, i) =>
            generacionales[i] === undefined ? null : generacionales[i]
          ),
        })
      );
      if (foto) datos.append('foto', foto.blob, 'selfie.jpg');

      const res = await fetch(`/api/cuestionario/${slug}`, {
        method: 'POST',
        body: datos,
      });
      if (!res.ok) throw new Error(await res.text());

      const json = await res.json();
      setResultado(json.resultado);
      setPaso(TOTAL_PASOS);
    } catch {
      setError('No pudimos guardar tus respuestas. Probá de nuevo en unos segundos.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="cq">
      <header className="cq-top">
        <div className="cq-top-inner">
          <span className="brand">
            Campos HR <span>· cuestionario</span>
          </span>
          <span className="cq-empresa">{empresa}</span>
        </div>
        {paso > 0 && paso <= TOTAL_PASOS && (
          <div className="cq-progreso" aria-hidden="true">
            <span style={{ width: `${avance * 100}%` }} />
          </div>
        )}
      </header>

      <main className="cq-main">
        {/* ---------------------------------------------------- portada */}
        {paso === 0 && (
          <section className="cq-placa cq-portada">
            <div className="cq-portada-matriz">
              <MatrizPortada />
            </div>
            <div className="cq-portada-texto">
              <h1>{PORTADA.titulo}</h1>
              <p>{PORTADA.texto}</p>
              <button className="cq-btn" onClick={() => setPaso(1)}>
                {PORTADA.boton}
              </button>
              <p className="cq-duracion">{PORTADA.duracion}</p>
            </div>
          </section>
        )}

        {/* --------------------------------------------------- identidad */}
        {paso === 1 && (
          <section className="cq-placa">
            <p className="cq-numero">1</p>
            <h2 className="cq-pregunta">¿Cómo te llamás?</h2>
            <p className="cq-ayuda">
              Tu nombre se muestra junto a tu foto en la matriz del equipo.
            </p>

            <div className="cq-campos">
              <label className="cq-campo-doble">
                <span>Apellido</span>
                <input
                  className="cq-input"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && identidadCompleta) setPaso(2);
                  }}
                />
              </label>
              <label className="cq-campo-doble">
                <span>Nombre</span>
                <input
                  className="cq-input"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && identidadCompleta) setPaso(2);
                  }}
                />
              </label>
            </div>

            {pideLider && (
              <div className="cq-campo">
                <label htmlFor="lider">¿A qué líder reportás?</label>
                <select
                  id="lider"
                  className="cq-select"
                  value={liderId}
                  onChange={(e) => setLiderId(e.target.value)}
                >
                  <option value="">Elegí de la lista…</option>
                  {lideres.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="cq-selfie">
              <div className="cq-selfie-preview">
                {foto ? (
                  <img src={foto.url} alt="Tu foto" />
                ) : (
                  <span>Sin foto</span>
                )}
              </div>
              <div className="cq-selfie-texto">
                <strong>Sacate una selfie</strong>
                <p>
                  Es opcional. Sirve para reconocerte en la matriz del equipo; si no
                  la sacás, aparecés con tus iniciales.
                </p>
                <input
                  ref={inputFoto}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={elegirFoto}
                  hidden
                />
                <button
                  className="cq-btn-ghost"
                  onClick={() => inputFoto.current?.click()}
                >
                  {foto ? 'Sacar otra' : 'Sacarme la foto'}
                </button>
              </div>
            </div>

            <div className="cq-acciones">
              <button
                className="cq-btn"
                disabled={!identidadCompleta}
                onClick={() => setPaso(2)}
              >
                Empezar
              </button>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------ placas */}
        {placaActual?.tipo === 'descriptiva' && (
          <section className="cq-placa">
            <p className="cq-numero">{paso}</p>
            <p className="cq-parrafo">{placaActual.texto}</p>
            <p className="cq-ayuda">{AYUDA_ESCALA}</p>

            <div className="cq-escala">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={
                    escalas[indicePlaca] === n ? 'cq-nota cq-nota-on' : 'cq-nota'
                  }
                  onClick={() => responderEscala(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="cq-escala-ref">
              <span>0 · no en absoluto</span>
              <span>5 · completamente</span>
            </p>

            <div className="cq-acciones">
              <button className="cq-btn-ghost" onClick={() => setPaso(paso - 1)}>
                Atrás
              </button>
            </div>
          </section>
        )}

        {placaActual?.tipo === 'frases' && (
          <section className="cq-placa">
            <p className="cq-numero">{paso}</p>
            <h2 className="cq-pregunta">{CONSIGNA_FRASES}</h2>
            <p className="cq-ayuda">{AYUDA_FRASES}</p>

            <ul className="cq-frases">
              {placaActual.frases.map((frase, i) => {
                const activa = (marcadas[indicePlaca] ?? []).includes(i);
                return (
                  <li key={i}>
                    <button
                      className={activa ? 'cq-frase cq-frase-on' : 'cq-frase'}
                      onClick={() => alternarFrase(i)}
                      aria-pressed={activa}
                    >
                      <span className="cq-letra">{LETRAS[i]}</span>
                      <span className="cq-frase-texto">{frase}</span>
                      <span className="cq-tilde" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="cq-acciones">
              <button className="cq-btn-ghost" onClick={() => setPaso(paso - 1)}>
                Atrás
              </button>
              <button className="cq-btn" onClick={() => setPaso(paso + 1)}>
                Continuar
                <em className="cq-marcadas">
                  {(marcadas[indicePlaca] ?? []).length} marcadas
                </em>
              </button>
            </div>
          </section>
        )}

        {/* ----------------------------------------------- autopercepción */}
        {paso === PASO_AUTOPERCEPCION && (
          <section className="cq-placa">
            <p className="cq-numero">{paso}</p>
            <h2 className="cq-pregunta">¿Cuál creés que sos?</h2>
            <p className="cq-ayuda">
              Antes de ver el resultado, jugátela. Es opcional y no cambia tu puntaje.
            </p>

            <div className="cq-opciones">
              {PERFILES.map((p) => (
                <button
                  key={p}
                  className={
                    autopercepcion === p ? 'cq-opcion cq-opcion-on' : 'cq-opcion'
                  }
                  onClick={() => setAutopercepcion(autopercepcion === p ? null : p)}
                >
                  <strong>{INFO[p].nombre}</strong>
                  <span>{INFO[p].descripcion}</span>
                </button>
              ))}
            </div>

            {error && <p className="cq-error">{error}</p>}

            <div className="cq-acciones">
              <button
                className="cq-btn-ghost"
                onClick={() => setPaso(paso - 1)}
                disabled={enviando}
              >
                Atrás
              </button>
              {placasGen.length > 0 ? (
                <button className="cq-btn" onClick={() => setPaso(paso + 1)}>
                  Continuar
                </button>
              ) : (
                <button className="cq-btn" onClick={enviar} disabled={enviando}>
                  {enviando ? 'Guardando…' : 'Ver resultado'}
                </button>
              )}
            </div>
          </section>
        )}

        {/* ---------------------------------------------- generaciones */}
        {placaGen && (
          <section className="cq-placa">
            <p className="cq-numero">{paso}</p>
            <h2 className="cq-pregunta">{placaGen.pregunta}</h2>
            <p className="cq-ayuda">{placaGen.ayuda}</p>

            <ul className="cq-frases">
              {placaGen.opciones.map((opcion, i) => {
                const activa = generacionales[indiceGen] === i;
                return (
                  <li key={i}>
                    <button
                      className={activa ? 'cq-frase cq-frase-on' : 'cq-frase'}
                      onClick={() => responderGeneracion(i)}
                      aria-pressed={activa}
                    >
                      <span className="cq-letra">{LETRAS[i]}</span>
                      <span className="cq-frase-texto">{opcion.texto}</span>
                      <span className="cq-tilde" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {error && <p className="cq-error">{error}</p>}

            <div className="cq-acciones">
              <button
                className="cq-btn-ghost"
                onClick={() => setPaso(paso - 1)}
                disabled={enviando}
              >
                Atrás
              </button>
              {ultimaGen && (
                <button className="cq-btn" onClick={enviar} disabled={enviando}>
                  {enviando ? 'Guardando…' : 'Ver resultado'}
                </button>
              )}
            </div>
          </section>
        )}

        {/* --------------------------------------------------- resultado */}
        {paso === TOTAL_PASOS && resultado && (
          <section className="cq-placa cq-resultado">
            <p className="cq-eyebrow">Tu resultado</p>
            <h2 className="cq-titulo-resultado">
              {perfilesResultado.map((p) => INFO[p].nombre).join(' y ')}
            </h2>
            <p className="cq-ayuda">
              {resultado.tipo === 'doble' &&
                'Dos cuadrantes te describen con la misma fuerza: tenés un perfil combinado.'}
              {resultado.tipo === 'definido' &&
                'Un cuadrante se destaca con claridad por sobre los demás.'}
              {resultado.tipo === 'mixto' &&
                'Ningún cuadrante se despega del resto: tenés un perfil repartido, encabezado por este.'}
            </p>

            <div className="cq-desc">
              {perfilesResultado.map((p) => (
                <p key={p}>{INFO[p].descripcion}</p>
              ))}
            </div>

            <div className="cq-puntajes">
              {PERFILES.map((p) => (
                <div className="cq-puntaje" key={p}>
                  <span className="cq-puntaje-nombre">{INFO[p].nombre}</span>
                  <span className="cq-barra">
                    <span style={{ width: `${(resultado.totales[p] / 20) * 100}%` }} />
                  </span>
                  <span className="cq-puntaje-valor">{resultado.totales[p]}</span>
                </div>
              ))}
            </div>

            <div className="cq-resultado-matriz">
              <MatrizBenziger
                puntos={[
                  {
                    id: 'yo',
                    nombre: nombre.trim(),
                    x: resultado.ejeX,
                    y: resultado.ejeY,
                    foto: foto?.url ?? null,
                    destacado: true,
                  },
                ]}
              />
            </div>

            {autopercepcion && (
              <p className="cq-acierto">
                {perfilesResultado.includes(autopercepcion)
                  ? `Le acertaste: habías elegido ${INFO[autopercepcion].nombre}.`
                  : `Habías elegido ${INFO[autopercepcion].nombre}.`}
              </p>
            )}

            <p className="cq-cierre">
              Listo. Ya quedaste en la matriz del equipo, podés cerrar esta página.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * Achica la selfie antes de subirla: lado mayor 640px, JPEG.
 * Evita subir 5 MB desde el celular en una sala con wifi flojo.
 */
async function reducirImagen(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const lado = 640;
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sin canvas');
  ctx.drawImage(bitmap, 0, 0, ancho, alto);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('sin blob'))),
      'image/jpeg',
      0.82
    );
  });
}
