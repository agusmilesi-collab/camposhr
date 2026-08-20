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
import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';

export default function Benziger({
  id,
  cuadrantes,
  informe,
}: {
  id: string;
  cuadrantes: string[];
  /** El nombre del informe ya cargado, o null si todavía no hay ninguno. */
  informe: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [cuadrante, setCuadrante] = useState(cuadrantes[0] ?? '');
  const [archivo, setArchivo] = useState<File | null>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  /** Manda las dos cosas juntas: el guardado es uno solo. */
  async function guardar(quad: string, arch: File | null, aviso: string) {
    setError(null);
    setHecho(null);
    setGuardando(true);
    try {
      const cuerpo = new FormData();
      cuerpo.set('evaluacionId', id);
      if (quad) cuerpo.set('cuadrante', quad);
      if (arch) cuerpo.set('pdf', arch);

      const res = await fetch('/api/os/benziger', { method: 'POST', body: cuerpo });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo cargar.');
        return false;
      }
      setHecho(r.aviso ?? aviso);
      empezar(() => router.refresh());
      return true;
    } catch {
      setError('No se pudo cargar.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function subir() {
    const ok = await guardar(cuadrante, archivo, 'Informe leído y sumario calculado.');
    if (!ok) return;
    setArchivo(null);
    if (pdf.current) pdf.current.value = '';
  }

  async function elegir(p: Perfil) {
    const antes = cuadrante;
    const nuevo = cuadrante === p ? '' : p;
    setCuadrante(nuevo);
    // Sin archivo: acá solo cambia el cuadrante.
    if (!(await guardar(nuevo, null, 'Cuadrante guardado.'))) setCuadrante(antes);
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
          <button
            className="os-boton os-boton-firme"
            type="button"
            onClick={subir}
            disabled={guardando || !archivo}
          >
            {guardando ? 'Calculando…' : 'Calcular'}
          </button>
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
            <div className="os-benziger-archivo">
              <span className="os-benziger-nombre" title={archivo?.name ?? informe ?? ''}>
                {archivo?.name ?? informe}
              </span>
              {archivo ? (
                <span className="os-benziger-pendiente">sin cargar</span>
              ) : (
                <a href={`/api/os/benziger?id=${id}`} target="_blank" rel="noreferrer">
                  Ver
                </a>
              )}
              <button
                type="button"
                className="os-enlace-boton"
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
          ) : (
            <button type="button" className="os-boton" onClick={() => pdf.current?.click()}>
              Elegir el archivo
            </button>
          )}

          <p className="os-benziger-aviso">
            {error ? (
              <span className="os-form-error">{error}</span>
            ) : hecho ? (
              <span className="os-form-ok">{hecho}</span>
            ) : (
              'Al calcular se leen sus números y se arma la hoja de abajo.'
            )}
          </p>
        </div>
      </section>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Cuadrante preferente</h2>
        </div>
        <div className="os-panel-cuerpo os-benziger-eleccion">
          {/* Frontal arriba y Basal abajo, como el modelo. Tocar el que ya está
              elegido lo desmarca: sin eso no habría forma de volver atrás. */}
          <div className="os-benziger-cruz">
            {(['FI', 'FD', 'BI', 'BD'] as Perfil[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`os-benziger-cuadrante${cuadrante === p ? ' elegido' : ''}`}
                aria-pressed={cuadrante === p}
                title={INFO[p].nombre}
                disabled={guardando}
                onClick={() => elegir(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div>
            <p className="os-benziger-elegido">
              {cuadrante ? INFO[cuadrante as Perfil].nombre : 'Sin definir'}
            </p>
            <p className="os-benziger-aviso">
              Lo determina la evaluadora leyendo el informe: es una lectura, no un
              dato que el PDF traiga tabulado.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
