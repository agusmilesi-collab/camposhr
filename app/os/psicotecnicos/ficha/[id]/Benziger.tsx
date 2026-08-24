'use client';

/**
 * La carga del Benziger: su informe y su cuadrante, en dos tarjetas.
 *
 * El informe en PDF es el que devuelve la licencia y es la fuente de todo lo
 * demás: al subirlo se lee solo y de ahí sale el resto del perfil. El
 * cuadrante lo elige la evaluadora leyéndolo, porque es una lectura y no un
 * dato que venga tabulado.
 *
 * Son dos tarjetas y no una porque se hacen en momentos distintos: el informe
 * se sube apenas llega y el cuadrante se decide después de leerlo.
 *
 * El archivo se sube con un botón, porque primero se elige y después se
 * confirma. Ese botón dice "Calcular" y no "Subir" porque es lo que hace: al
 * subirlo se lee el informe y se arma la hoja, igual que el de la grilla de
 * manchas. El cuadrante guarda al tocarlo: ahí el clic ya es la decisión.
 *
 * El selector de archivo del navegador dice "Ningún archivo seleccionado" aun
 * cuando ya hay un informe subido, que es exactamente lo contrario de lo que
 * pasa. Por eso va escondido y en su lugar se muestra el nombre del archivo.
 *
 * El cuadrante se elige en una cruz y no en una lista desplegable: es la misma
 * disposición del modelo y la misma que tienen las cruces de la hoja, así que
 * elegir y leer se hacen mirando el mismo dibujo.
 */

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { INFO, PERFILES, nombrePerfil, type Perfil } from '@/lib/perfiles';

export default function Benziger({
  id,
  cuadrantes,
  parejos: parejosGuardados = false,
  informe,
}: {
  id: string;
  /** Uno o dos códigos. El primero es el preferente. */
  cuadrantes: string[];
  /** Si el segundo pesa lo mismo que el primero. */
  parejos?: boolean;
  /** El nombre del informe ya leído, o null si todavía no hay ninguno. */
  informe: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  // Hasta dos: el primero que se toca es el preferente y el segundo el que lo
  // acompaña. `parejos` dice si ese segundo pesa lo mismo.
  const [elegidos, setElegidos] = useState<Perfil[]>(
    cuadrantes.filter((c): c is Perfil => PERFILES.includes(c as Perfil)).slice(0, 2)
  );
  const [parejos, setParejos] = useState(parejosGuardados);
  const [archivo, setArchivo] = useState<File | null>(null);
  const pdf = useRef<HTMLInputElement>(null);
  // Dos estados y no uno: son dos tarjetas con su propio botón, y compartir
  // el "guardando" hacía que elegir un cuadrante pusiera a Calcular en
  // "Calculando…" sin que hubiera nada que calcular.
  const [subiendo, setSubiendo] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [errorCuadrante, setErrorCuadrante] = useState<string | null>(null);

  /** Manda las dos cosas juntas: el guardado es uno solo. */
  async function guardar(quads: Perfil[], pares: boolean, arch: File | null) {
    try {
      const cuerpo = new FormData();
      cuerpo.set('evaluacionId', id);
      // Uno por cuadrante y en orden: del otro lado se leen con getAll.
      for (const q of quads) cuerpo.append('cuadrante', q);
      cuerpo.set('parejos', pares ? '1' : '0');
      if (arch) cuerpo.set('pdf', arch);

      const res = await fetch('/api/os/benziger', { method: 'POST', body: cuerpo });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) return { ok: false as const, motivo: r.motivo ?? 'No se pudo cargar.' };
      empezar(() => router.refresh());
      return { ok: true as const };
    } catch {
      return { ok: false as const, motivo: 'No se pudo cargar.' };
    }
  }

  async function subir() {
    setError(null);
    setHecho(null);
    setSubiendo(true);
    const r = await guardar(elegidos, parejos, archivo).finally(() => setSubiendo(false));
    if (!r.ok) {
      setError(r.motivo);
      return;
    }
    setHecho('Informe leído y sumario calculado.');
    setArchivo(null);
    if (pdf.current) pdf.current.value = '';
  }

  /**
   * Toca un cuadrante: el primero es el preferente, el segundo lo acompaña.
   * Tocar uno ya elegido lo saca. Con dos puestos, el que se toque después
   * ocupa el lugar del segundo, así corregirlo no obliga a desmarcar antes.
   */
  function elegir(p: Perfil) {
    const nuevos = elegidos.includes(p)
      ? elegidos.filter((q) => q !== p)
      : elegidos.length < 2
        ? [...elegidos, p]
        : [elegidos[0], p];
    return aplicar(nuevos, nuevos.length === 2 ? parejos : false);
  }

  async function aplicar(nuevos: Perfil[], pares: boolean) {
    const antes = elegidos;
    const antesPares = parejos;
    setElegidos(nuevos);
    setParejos(pares);
    setErrorCuadrante(null);
    setEligiendo(true);
    // Sin archivo: acá solo cambia el cuadrante. Que salió bien se ve en el
    // estado del título, que pasa a nombrarlo, así que no hace falta decirlo
    // además con un texto que además crecería la tarjeta de al lado.
    const r = await guardar(nuevos, pares, null).finally(() => setEligiendo(false));
    if (!r.ok) {
      setElegidos(antes);
      setParejos(antesPares);
      setErrorCuadrante(r.motivo);
    }
  }

  return (
    // Con el mismo tope de ancho que la hoja: las dos filas se leen como una
    // sola grilla y no como dos anchos distintos.
    <div
      className="os-hoja-fila os-bz-hoja"
      style={{ '--os-hoja-columnas': 2 } as React.CSSProperties}
    >
      <section className="os-panel">
        <div className="os-panel-top">
          <h2>El informe</h2>
          {/* El estado va con el título: es de todo el informe, no del paso. */}
          {(archivo || informe) && (
            <span className={`os-sello-estado ${archivo ? 'os-ambar' : 'os-verde'}`}>
              {archivo ? 'Sin calcular' : 'Leído'}
            </span>
          )}
        </div>
        <div className="os-panel-cuerpo">
          <input
            ref={pdf}
            className="os-oculto"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setHecho(null);
            }}
          />

          {archivo || informe ? (
            <div className="os-benziger-carga">
              {/* El archivo y el paso siguiente, uno al lado del otro: elegir
                  y calcular es el camino, y todo lo demás va abajo. */}
              <div className="os-benziger-fila">
                <div className="os-benziger-archivo">
                  <span className="os-benziger-nombre" title={archivo?.name ?? informe ?? ''}>
                    {archivo?.name ?? informe}
                  </span>
                </div>
                <button
                  className="os-boton os-boton-firme"
                  type="button"
                  onClick={subir}
                  disabled={subiendo || !archivo}
                >
                  {subiendo ? 'Calculando…' : 'Calcular'}
                </button>
              </div>
              <div className="os-benziger-acciones">
                <button
                  type="button"
                  className="os-boton"
                  onClick={() => {
                    if (archivo) {
                      // Vuelve al que estaba guardado, que sigue siendo el bueno.
                      setArchivo(null);
                      if (pdf.current) pdf.current.value = '';
                    } else {
                      pdf.current?.click();
                    }
                  }}
                >
                  {archivo ? 'Quitar' : 'Reemplazar'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="os-boton" onClick={() => pdf.current?.click()}>
              Elegir el archivo
            </button>
          )}

          {/* El aviso aparece solo cuando hay algo que avisar. */}
          {(error || hecho) && (
            <p className="os-benziger-aviso">
              {error ? (
                <span className="os-form-error">{error}</span>
              ) : (
                <span className="os-form-ok">{hecho}</span>
              )}
            </p>
          )}
        </div>
      </section>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Cuadrante preferente</h2>
          <span className={`os-sello-estado ${elegidos.length ? 'os-verde' : 'os-ambar'}`}>
            {nombrePerfil(elegidos, parejos) ?? 'Sin definir'}
          </span>
        </div>
        <div className="os-panel-cuerpo os-benziger-eleccion">
          {/* Frontal arriba y Basal abajo, como el modelo. Tocar el que ya está
              elegido lo desmarca: sin eso no habría forma de volver atrás. */}
          <div className="os-benziger-cruz">
            {(['FI', 'FD', 'BI', 'BD'] as Perfil[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`os-benziger-cuadrante${elegidos.includes(p) ? ' elegido' : ''}`}
                aria-pressed={elegidos.includes(p)}
                title={INFO[p].nombre}
                disabled={eligiendo}
                onClick={() => elegir(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="os-benziger-lectura">
            {/* Con dos elegidos falta decir cómo se relacionan: el segundo puede
                acompañar al primero o pesar lo mismo. */}
            {/* Un solo botón que alterna, como el de contacto en la lista de
                entrevistas: los dos estados son la misma pregunta contestada de
                las dos formas posibles, así que se dicen con el punto y el
                texto, y se cambian tocando. */}
            {elegidos.length === 2 && (
              <button
                type="button"
                className={`os-boton os-boton-marcado os-sello-estado os-benziger-relacion ${
                  parejos ? 'os-violeta' : 'os-azul'
                }`}
                disabled={eligiendo}
                aria-pressed={parejos}
                title={
                  parejos
                    ? 'Los dos pesan lo mismo. Tocar para que mande el primero.'
                    : `Manda ${elegidos[0]}. Tocar para que pesen lo mismo.`
                }
                onClick={() => aplicar(elegidos, !parejos)}
              >
                {parejos ? 'Los dos por igual' : `${elegidos[1]} secundario`}
              </button>
            )}

            <p className="os-benziger-aviso">
              {errorCuadrante ? (
                <span className="os-form-error">{errorCuadrante}</span>
              ) : (
                'Lo determina la evaluadora leyendo el informe: es una lectura, no un dato que el PDF traiga tabulado.'
              )}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
