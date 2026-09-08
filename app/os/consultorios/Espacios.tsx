'use client';

/**
 * Las salas: qué es cada una, cuánto sale y cuándo abre.
 *
 * **Es una tabla de comparación y se edita donde se lee.** Las salas en
 * columnas y lo que las distingue en filas: la pregunta de esta pantalla es en
 * qué se diferencian, y con una ficha por sala había que recordar el precio de
 * la primera para compararlo con el de la cuarta.
 *
 * **Cada sala tiene su escala.** Hasta el 8/9/2026 el precio venía de una
 * categoría compartida (A para los consultorios 1, 3 y 4; B para el 2), que
 * ahorraba repetir seis números pero convertía la tabla en algo que no se podía
 * editar donde se lee: tocar el precio del 1 cambiaba también el del 3 sin
 * decirlo. Dos salas que valen lo mismo tienen los mismos números, y el aumento
 * por porcentaje sigue alcanzándolas a todas de una vez, que era lo único que
 * la categoría ahorraba de verdad.
 *
 * **Un valor editado a mano cambia la escala vigente**, así que rige desde la
 * próxima reserva. Las ya hechas conservan el importe que congelaron. Para un
 * aumento general está el porcentaje de abajo, que crea una escala nueva con su
 * fecha y deja la anterior intacta.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Apertura, Espacio, Tarifa } from '@/lib/consultorios-calculo';
import { mandar } from './acciones';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Los tramos de la escala, en horas por semana. */
const TRAMOS = [1, 4, 8, 12, 16, 20];

/**
 * Cómo se nombra cada tramo.
 *
 * "8 hs por semana" no dice qué paga quien tiene diez, y esa es justo la
 * pregunta: hay que saber de antemano que el precio es el del último renglón
 * alcanzado. "8 a 11 horas" lo dice solo, y entonces la escala se lee sin que
 * nadie la explique. El último no tiene techo y el primero empieza en 1.
 */
function rotulo(i: number): string {
  const desde = TRAMOS[i];
  if (i === TRAMOS.length - 1) return `${desde} o más`;
  const hasta = TRAMOS[i + 1] - 1;
  return desde === hasta ? `${desde}` : `${desde} a ${hasta}`;
}

/** A cinco pesos: con importes de cuatro cifras, los centavos que deja un
 *  porcentaje no se cobran ni se dicen por teléfono. */
function redondear(n: number): number {
  return Math.round(n / 5) * 5;
}

function dia(fecha: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${fecha}T12:00:00-03:00`));
}

/**
 * El horario que rige hoy, para que Configuración abra con lo que hay puesto.
 *
 * Estaba escrito 08:00 a 20:00 en el código, así que después de mover el cierre
 * a las 21 en la tabla de arriba el bloque de abajo seguía diciendo 20:00, y
 * tocar "Aplicar" sin mirar devolvía las cinco salas al horario viejo.
 *
 * Si las salas no coinciden gana el horario que más se repite: es el que se
 * está por cambiar para todas.
 */
function horarioQueRige(aperturas: Apertura[]): { desde: string; hasta: string } {
  const cuenta = new Map<string, number>();
  for (const a of aperturas) {
    const clave = `${a.desde_hora.slice(0, 5)}|${a.hasta_hora.slice(0, 5)}`;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  const gana = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const [desde, hasta] = gana ? gana.split('|') : ['08:00', '20:00'];
  return { desde, hasta };
}

export default function Espacios({
  espacios,
  aperturas,
  escalas,
  hoy,
}: {
  espacios: Espacio[];
  aperturas: Apertura[];
  escalas: Tarifa[];
  hoy: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<Record<string, string>>({});
  const [pct, setPct] = useState('');
  const [desde, setDesde] = useState('');
  const [borrador, setBorrador] = useState<Tarifa[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const rige = horarioQueRige(aperturas);
  const [horarioTodas, setHorarioTodas] = useState(rige);

  // Guardar vuelve a dibujar del lado del servidor, y eso no reinicia el estado
  // de un componente de cliente: sin esto, cambiar el cierre de una sala en la
  // tabla de arriba dejaba acá el horario anterior. Se compara por valor,
  // porque cada dibujo trae un objeto nuevo.
  const [visto, setVisto] = useState(rige);
  if (visto.desde !== rige.desde || visto.hasta !== rige.hasta) {
    setVisto(rige);
    setHorarioTodas(rige);
  }

  /** Los días que hoy abre alguna sala. Es lo que muestra el bloque de todas. */
  const diasQueAbren = [...new Set(aperturas.map((a) => a.dia_semana))].sort();
  const [diasTodas, setDiasTodas] = useState(diasQueAbren);
  const [diasVistos, setDiasVistos] = useState(diasQueAbren.join(','));
  if (diasVistos !== diasQueAbren.join(',')) {
    setDiasVistos(diasQueAbren.join(','));
    setDiasTodas(diasQueAbren);
  }

  const fechas = [...new Set(escalas.map((t) => t.desde))].sort().reverse();
  const vigenteDesde = fechas.find((f) => f <= hoy) ?? null;
  const proximas = fechas.filter((f) => f > hoy);
  const vigente = escalas.filter((t) => t.desde === vigenteDesde);

  const precioDe = (espacioId: string, horas: number) =>
    vigente.find((t) => t.espacio_id === espacioId && t.horas_semana_desde === horas) ?? null;

  const aperturaDe = (espacioId: string) => aperturas.filter((a) => a.espacio_id === espacioId);

  async function agregar(espacioId: string, orden: number) {
    const texto = (nuevo[espacioId] ?? '').trim();
    if (texto.length === 0) return;
    const r = await mandar({ accion: 'incluye-agregar', espacioId, texto, orden });
    if (!r.ok) return setError(r.motivo ?? 'No se pudo agregar.');
    setNuevo((n) => ({ ...n, [espacioId]: '' }));
    setError(null);
    router.refresh();
  }

  async function quitar(id: string) {
    const r = await mandar({ accion: 'incluye-quitar', id });
    if (!r.ok) return setError(r.motivo ?? 'No se pudo quitar.');
    setError(null);
    router.refresh();
  }

  async function activar(id: string, activo: boolean) {
    const r = await mandar({ accion: 'espacio-activo', id, activo });
    if (!r.ok) return setError(r.motivo ?? 'No se pudo cambiar.');
    setError(null);
    router.refresh();
  }

  /** Un precio suelto, editado en su celda. Cambia la escala vigente, así que
   *  vale desde la próxima reserva. */
  async function guardarPrecio(espacioId: string, horas: number, valor: string) {
    const limpio = valor.replace(/[^\d]/g, '');
    if (limpio === '') return;
    const precio = Number(limpio);
    const antes = precioDe(espacioId, horas);
    if (!Number.isFinite(precio) || precio <= 0) return setError('El precio tiene que ser un número.');
    if (antes && antes.precio_hora === precio) return;
    const r = await mandar({
      accion: 'precio-uno',
      espacioId,
      horas,
      precio,
      desde: vigenteDesde ?? hoy,
    });
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar el precio.');
    setError(null);
    router.refresh();
  }

  /**
   * El horario de una sala, o de todas si no se nombra ninguna.
   *
   * Los cinco días van iguales: el Centro no abre distinto un martes que un
   * jueves, y el día que pase se agrega como tercer dato en vez de multiplicar
   * la tabla por cinco desde ahora.
   */
  /**
   * El horario y, si se pasan, qué días abre.
   *
   * Sin la lista de días se conservan los que la sala ya tenía: mover la hora
   * de cierre no puede reabrir un sábado que estaba cerrado.
   */
  async function guardarHorario(
    espacioId: string | null,
    d: string,
    h: string,
    dias?: number[]
  ) {
    if (h <= d) return setError('La hora de cierre va después de la de apertura.');
    if (dias && dias.length === 0) return setError('El Centro tiene que abrir algún día.');
    const r = await mandar({ accion: 'horario', espacioId, desdeHora: d, hastaHora: h, dias });
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar el horario.');
    setError(null);
    router.refresh();
  }

  /** Prende o apaga un día en una sala, respetando su horario. */
  function alternarDia(espacioId: string, d: number) {
    const propias = aperturaDe(espacioId);
    const puestos = propias.map((a) => a.dia_semana);
    const dias = puestos.includes(d) ? puestos.filter((x) => x !== d) : [...puestos, d].sort();
    const a = propias[0];
    guardarHorario(espacioId, a?.desde_hora.slice(0, 5) ?? '08:00', a?.hasta_hora.slice(0, 5) ?? '21:00', dias);
  }

  function calcular() {
    const p = Number(pct);
    if (!Number.isFinite(p)) return setError('El aumento tiene que ser un número.');
    if (!desde) return setError('Falta desde cuándo rige la escala nueva.');
    setError(null);
    setBorrador(
      vigente.map((t) => ({ ...t, precio_hora: redondear(t.precio_hora * (1 + p / 100)) }))
    );
  }

  async function guardarEscala() {
    if (!borrador) return;
    setGuardando(true);
    const r = await mandar({
      accion: 'escala-nueva',
      desde,
      filas: borrador.map((t) => ({
        espacioId: t.espacio_id,
        horas: t.horas_semana_desde,
        precio: t.precio_hora,
      })),
    });
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    setBorrador(null);
    setPct('');
    setDesde('');
    setError(null);
    router.refresh();
  }

  return (
    <>
      {error && <p className="os-form-error">{error}</p>}

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>
            Las salas{' '}
            <span className="os-panel-cuenta">
              · {espacios.filter((e) => e.activo).length} en alquiler
            </span>
          </h2>
          <span className="os-columna-monto">
            {vigenteDesde ? `Precios desde el ${dia(vigenteDesde)}` : 'Sin precios cargados'}
          </span>
        </div>

        <div className="os-comparar-marco">
          <table className="os-tabla os-comparar">
            <colgroup>
              <col className="os-comparar-rotulos" />
              {espacios.map((e) => (
                <col key={e.id} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th />
                {espacios.map((e) => (
                  <th key={e.id} className={e.activo ? undefined : 'os-sala-baja'}>
                    {e.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Abre</th>
                {espacios.map((e) => {
                  const propias = aperturaDe(e.id);
                  const a = propias[0];
                  return (
                    <td key={e.id} className="os-comparar-horario">
                      {/* Los días se tildan en su propia celda: un texto
                          ("Lun a Sáb") dice cómo está y no deja cambiarlo, y la
                          excepción de una sola sala es justamente por qué
                          existe la columna. */}
                      <span className="os-dias">
                        {DIAS.map((rotulo, d) => (
                          <button
                            key={d}
                            type="button"
                            className={`os-dia${propias.some((a) => a.dia_semana === d) ? ' abre' : ''}`}
                            onClick={() => alternarDia(e.id, d)}
                            aria-pressed={propias.some((a) => a.dia_semana === d)}
                            title={`${rotulo} · ${e.nombre}`}
                          >
                            {rotulo.slice(0, 1)}
                          </button>
                        ))}
                      </span>
                      <span className="os-comparar-horas">
                        <input
                          className="os-campo os-campo-suave"
                          type="time"
                          step={3600}
                          defaultValue={a?.desde_hora.slice(0, 5) ?? '08:00'}
                          onBlur={(ev) =>
                            guardarHorario(e.id, ev.target.value, a?.hasta_hora.slice(0, 5) ?? '20:00')
                          }
                          aria-label={`Hora de apertura de ${e.nombre}`}
                        />
                        <input
                          className="os-campo os-campo-suave"
                          type="time"
                          step={3600}
                          defaultValue={a?.hasta_hora.slice(0, 5) ?? '20:00'}
                          onBlur={(ev) =>
                            guardarHorario(e.id, a?.desde_hora.slice(0, 5) ?? '08:00', ev.target.value)
                          }
                          aria-label={`Hora de cierre de ${e.nombre}`}
                        />
                      </span>
                    </td>
                  );
                })}
              </tr>

              <tr>
                <th>Qué incluye</th>
                {espacios.map((e) => (
                  <td key={e.id} className="os-comparar-incluye">
                    {e.incluye.map((i) => (
                      <span className="os-chip" key={i.id} style={{ background: 'var(--os-hover)' }}>
                        {i.texto}
                        <button
                          type="button"
                          className="os-chip-quitar"
                          onClick={() => quitar(i.id)}
                          aria-label={`Quitar ${i.texto}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <form
                      autoComplete="off"
                      onSubmit={(ev) => {
                        ev.preventDefault();
                        agregar(e.id, e.incluye.length + 1);
                      }}
                    >
                      <input
                        className="os-campo os-campo-suave"
                        autoComplete="off"
                        placeholder="Sumar…"
                        value={nuevo[e.id] ?? ''}
                        onChange={(ev) => setNuevo((n) => ({ ...n, [e.id]: ev.target.value }))}
                        aria-label={`Sumar equipamiento a ${e.nombre}`}
                      />
                    </form>
                  </td>
                ))}
              </tr>

              {/* Un renglón por tramo, editable en su celda: es la escala entera
                  de las cinco salas a la vez, que es lo que se compara al
                  decidir un precio.

                  Qué son esos números va en un renglón propio y no repetido en
                  cada uno: arriba están "Abre" y "Qué incluye", así que un "8 a
                  11" suelto no diría de qué habla, y ponerle "por semana" a los
                  seis desbordaba la columna. */}
              <tr className="os-comparar-seccion">
                <th>Horas semanales</th>
                {espacios.map((e) => (
                  <th key={e.id}>Precio de la hora</th>
                ))}
              </tr>
              {TRAMOS.map((h, i) => (
                <tr key={h}>
                  <th>{rotulo(i)}</th>
                  {espacios.map((e) => {
                    const t = precioDe(e.id, h);
                    return (
                      <td key={e.id} className="os-comparar-precio">
                        <input
                          className="os-campo os-campo-suave"
                          inputMode="numeric"
                          defaultValue={t ? String(t.precio_hora) : ''}
                          placeholder="—"
                          onBlur={(ev) => guardarPrecio(e.id, h, ev.target.value)}
                          aria-label={`Precio de ${e.nombre}, ${h} horas por semana`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr>
                <th>En alquiler</th>
                {espacios.map((e) => (
                  <td key={e.id}>
                    {/* El estado y la acción en el mismo control: "Dar de baja"
                        decía qué pasa al tocarlo, no cómo está la sala, y para
                        saber cuáles se alquilan había que leer las cinco. */}
                    <button
                      type="button"
                      className={`os-activa${e.activo ? ' si' : ''}`}
                      onClick={() => activar(e.id, !e.activo)}
                      aria-pressed={e.activo}
                      title={
                        e.activo
                          ? 'En alquiler. Tocar para sacarla.'
                          : 'Fuera de alquiler: no se puede reservar. Tocar para volver a ofrecerla.'
                      }
                    >
                      <span className="os-activa-luz" aria-hidden="true" />
                      {e.activo ? 'Sí' : 'No'}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Escrito para alguien que nunca alquiló acá: la escala se entiende
            con un ejemplo y no con la palabra "tramo". */}
        <p className="os-panel-nota">
          Cuantas más horas por semana se alquilan, más barata sale cada hora.
          Cada renglón dice desde cuántas horas rige su precio y hasta cuántas:
          con 10 horas por semana se paga el precio del renglón de 8 a 11, y
          recién a las 12 se pasa al siguiente. Si tomar más horas sale igual o
          menos que las que se pidieron, el sistema lo avisa antes de reservar.
        </p>
      </div>

      <div className="os-panel">
        <div className="os-panel-top">
          <h2>Configuración</h2>
          <span className="os-columna-monto">Lo que vale para las {espacios.length} salas</span>
        </div>

        {/* Dos columnas: el horario y el precio son las dos cosas que se mueven
            juntas para todo el Centro, y una debajo de la otra la segunda
            quedaba escondida al final del panel. */}
        <div className="os-config-dos">
          <section>
            <h3>Horario</h3>
            <div className="os-incluye-alta">
              <label className="os-etiqueta-campo">
                Abren
                <input
                  className="os-campo os-campo-suave"
                  type="time"
                  step={3600}
                  value={horarioTodas.desde}
                  onChange={(e) => setHorarioTodas((h) => ({ ...h, desde: e.target.value }))}
                />
              </label>
              <label className="os-etiqueta-campo">
                Cierran
                <input
                  className="os-campo os-campo-suave"
                  type="time"
                  step={3600}
                  value={horarioTodas.hasta}
                  onChange={(e) => setHorarioTodas((h) => ({ ...h, hasta: e.target.value }))}
                />
              </label>
              <label className="os-etiqueta-campo">
                Días
                <span className="os-dias">
                  {DIAS.map((rotulo, d) => (
                    <button
                      key={d}
                      type="button"
                      className={`os-dia${diasTodas.includes(d) ? ' abre' : ''}`}
                      onClick={() =>
                        setDiasTodas((v) =>
                          v.includes(d) ? v.filter((x) => x !== d) : [...v, d].sort()
                        )
                      }
                      aria-pressed={diasTodas.includes(d)}
                      title={rotulo}
                    >
                      {rotulo.slice(0, 1)}
                    </button>
                  ))}
                </span>
              </label>
              <button
                className="os-boton"
                type="button"
                onClick={() => guardarHorario(null, horarioTodas.desde, horarioTodas.hasta, diasTodas)}
              >
                Aplicar
              </button>
            </div>
          </section>

          <section>
            <h3>Precios</h3>
            <div className="os-incluye-alta">
              <label className="os-etiqueta-campo">
                Aumento
                <input
                  className="os-campo os-campo-suave os-campo-corto"
                  inputMode="decimal"
                  placeholder="12,5"
                  value={pct}
                  onChange={(e) => setPct(e.target.value.replace(',', '.'))}
                />
              </label>
              <label className="os-etiqueta-campo">
                Rige desde
                <input
                  className="os-campo os-campo-suave"
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </label>
              <button
                className="os-boton"
                type="button"
                onClick={calcular}
                disabled={vigente.length === 0}
              >
                Calcular
              </button>
            </div>
          </section>
        </div>

        {borrador && (
          <>
            <div className="os-comparar-marco">
              <table className="os-tabla os-comparar">
                <colgroup>
                  <col className="os-comparar-rotulos" />
                  {espacios.map((e) => (
                    <col key={e.id} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th>Horas semanales</th>
                    {espacios.map((e) => (
                      <th key={e.id}>{e.nombre}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRAMOS.map((h, i) => (
                    <tr key={h}>
                      <th>{rotulo(i)}</th>
                      {espacios.map((e) => {
                        const fila = borrador.find(
                          (t) => t.espacio_id === e.id && t.horas_semana_desde === h
                        );
                        return (
                          <td key={e.id} className="os-comparar-precio">
                            {fila ? (
                              <input
                                className="os-campo os-campo-suave"
                                inputMode="numeric"
                                value={fila.precio_hora}
                                onChange={(ev) =>
                                  setBorrador((b) =>
                                    (b ?? []).map((t) =>
                                      t === fila
                                        ? { ...t, precio_hora: Number(ev.target.value) || 0 }
                                        : t
                                    )
                                  )
                                }
                              />
                            ) : (
                              <span className="os-comparar-nada">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="os-incluye-alta">
              <button
                className="os-boton os-boton-firme"
                type="button"
                onClick={guardarEscala}
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : `Guardar la escala del ${dia(desde)}`}
              </button>
              <button className="os-enlace-suave" type="button" onClick={() => setBorrador(null)}>
                Descartar
              </button>
            </div>
          </>
        )}

        {proximas.length > 0 && (
          <p className="os-panel-nota">
            Hay una escala cargada que empieza el {dia(proximas[proximas.length - 1])}.
          </p>
        )}

        {fechas.length > 1 && (
          <p className="os-panel-nota">
            Escalas cargadas: {fechas.map((f) => dia(f)).join(' · ')}.
          </p>
        )}
      </div>
    </>
  );
}
