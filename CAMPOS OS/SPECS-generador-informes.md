# Generador de informes · especificación

Que la psicóloga cargue la prueba, apriete un botón y salga el informe. Es el tercero de los tres
objetivos del sistema, y el único que se puede construir sin migrar nada.

Este archivo alcanza para arrancar sin más contexto. Sale de la charla del 14/8/2026. El marco está
en `SPECS-arquitectura.md`.

---

## 1. La distinción que hace viable todo

**Un informe de selección se puede generar entero salvo el veredicto. Uno de mapeo no.**

Un mapeo cruza entrevistas, observación de la psicóloga y estructura de la empresa. Esa lectura es
humana y no hay forma de derivarla de los datos. Los once informes individuales de Laruso lo
muestran: su redacción vive escrita a mano en `fichas_a.py` y `fichas_b.py`.

Una selección es una persona, tres pruebas y un puesto. Ahí no hay nada que cruzar que no esté en los
datos.

**El veredicto queda humano a propósito.** R4 del método dice que ningún puntaje decide solo y que lo
firma la psicóloga que administró la prueba. Automatizarlo sería violar el método y no ganar tiempo.

---

## 2. Lo que ya existe y se reusa

### El cálculo, que es el activo real

| Archivo | Líneas | Qué hace | Sabe de Laruso |
|---|---|---|---|
| `dimensiones.py` | 220 | Convierte cada índice a la escala 0–99 y arma las seis dimensiones | No |
| `redacciones.py` | 577 | Aplica el diccionario del método sobre el sumario y devuelve qué dice cada índice y qué se recomienda | No |

Están en `Campos HR/clients/laruso/_gen/`. Son agnósticos del caso y se portan tal cual.

`redacciones.py` produce entre trece y veintidós lecturas por persona, con siete a dieciséis
recomendaciones, sin que nadie escriba una línea. Sale del diccionario
`method/instrumentos/Redacciones códigos Rorschach.docx.md`, así que la recomendación la escribe el
instrumento y el motor la selecciona.

### El sistema visual

El molde completo está en `gen_informes.py`: catorce capítulos, la constante `CSS`, la hoja de
impresión A4 con control de viudas y huérfanas, y el anexo. Validado contra once personas reales.

El molde de selección tampoco arranca de cero: `bruno-alsina.html` vive en
`camposhr-site/public/informes-prueba/` y es el informe de selección de referencia.

### Los datos, ya calculados

El motor Exner deja `Sumario JSON` escrito en el registro de `Individuo`, más las columnas `Sx`
desglosadas (Lambda, EA, es, D, AdjD, XA%, X+%, Xu%, X−%, Zd, Ego, y las constelaciones). El
generador no calcula nada del Rorschach: lo consume.

El Benziger vive en su tabla con los cuatro totales de la escala adulta, el nivel de alerta y los
adjetivos. El Raven está en `Individuo` como puntaje directo y rango.

---

## 3. Lo que hay que escribir

**El molde del informe de selección.** Los capítulos cambian respecto del de mapeo. Ver la tabla de
la sección 5.

**Las reglas del mapa de riesgo.** Hoy los cinco renglones están escritos a mano persona por persona
en `informes_datos.py`. Hay que convertirlos en condiciones sobre D, AdjD, GHR:PHR, Zd, Lambda y
EA/es. Es el trabajo de fondo y es el mismo en cualquier camino.

**Las seis competencias.** El informe de referencia las muestra con porcentaje. La tabla `Informe` de
Airtable existe y está vacía para todos los clientes, así que hoy no hay de dónde leerlas. Se
calculan con la fórmula de las seis dimensiones, que ya existe.

---

## 4. Los dos caminos, y por qué no hay que elegir

### Provisorio: todo adentro de Airtable

La psicóloga tilda un campo "Generar informe" en la ficha del individuo. Una automatización con
`recordMatchesConditions` dispara un script que lee `Sumario JSON`, el Benziger y el Raven, genera el
HTML y lo sube como adjunto al campo `Informe PDF`.

**No hay interfaz que construir.** Lorena y Lucila ya tienen su interfaz cada una, con cinco
pantallas: Por citar, Por entrevistar, Por analizar, Entregados y Resumen. Un campo nuevo en la tabla
aparece solo en esas pantallas, y el botón queda en Por analizar, que es donde están cuando terminan
de codificar.

La subida del adjunto usa `content.airtable.com/v0/<base>/<record>/<campo>/uploadAttachment`, que es
el mismo endpoint con el que se subieron los once informes de Laruso.

**Tres límites a tener presentes:**

- Las automatizaciones cortan a los treinta segundos. Generar un HTML de cincuenta kilobytes tarda
  menos de uno, así que no molesta, y conviene saberlo antes de sumarle cosas.
- El `fetch` necesita un token escrito dentro del script. Conviene un PAT propio, con permiso solo
  sobre esta base y solo de escritura de registros.
- Airtable no renderiza HTML en sus campos. Por eso el informe va como adjunto: guardado en un campo
  largo se ve con las etiquetas a la vista. Si se quiere algo legible adentro de Airtable, se genera
  además una versión en markdown, con el mismo criterio que ya usa `formatearSumario` del motor
  Exner.

### Definitivo: en tools

Un campo de tipo Button en Airtable con una fórmula que arma la dirección
`tools.camposhr.com/informe/<id>`. La página lee, genera y muestra el informe listo para imprimir o
guardar. Sin límite de tiempo, con el código versionado, y el día que psicotécnicos migre a Postgres
se cambia de dónde lee sin que la psicóloga se entere.

Tampoco necesita portal nuevo: el hub de `tools.camposhr.com` ya existe con sus tarjetas, el sitio ya
lee Airtable con la lista blanca de campos y ya tiene el patrón de servir un informe validando quién
lo pide.

### La decisión que evita elegir

**El cálculo y las redacciones se escriben como un módulo JS propio, que no sabe de dónde vienen los
datos ni a dónde va el resultado.** El script de Airtable lo pega adentro y lo llama; la página de
tools lo importa. El mismo código en los dos lugares.

Portar `dimensiones.py` y `redacciones.py` a JavaScript no es trabajo que se tire: el destino es
Next.js, que es JavaScript. Portarlas ahora adelanta la migración en lugar de desperdiciarla.

Airtable solo ejecuta JavaScript en sus scripts, así que no hay opción de correr Python adentro. El
motor Exner, que son 900 líneas de JS en una automatización, es la prueba de que el patrón funciona.

---

## 5. El molde del informe de selección

Contra el informe individual de mapeo, que tiene catorce capítulos:

| En el de mapeo | En el de selección | De dónde sale |
|---|---|---|
| Encaje con el puesto que ocupa hoy | Recomendación en cuatro niveles | **La psicóloga.** Es el veredicto |
| La lectura en treinta segundos | A favor / a mirar | Calculado, con el índice que respalda cada punto |
| Mapa de riesgo | Mapa de riesgo | Calculado con reglas sobre los índices |
| Nivel de encaje | Nivel de ajuste al puesto | Deriva de la recomendación |
| Las seis dimensiones | Competencias evaluadas | Calculado |
| Cómo funciona | Cómo funciona | Calculado desde el estilo, Lambda y los cuadrantes |
| Qué dice cada prueba | Qué dice cada prueba | Calculado |
| Qué lo mueve | La voz del candidato | Los adjetivos del Benziger |
| En qué coinciden las fuentes | (no va) | Necesita entrevista y observación |
| Un dato para tomarse en serio | (opcional) | La psicóloga, si corresponde |
| Qué hacer | Qué hacer, y cuándo | Las recomendaciones del diccionario, agrupadas por momento |
| El cruce contra su descripción de puesto | (no va) | Un candidato externo no tiene puesto ocupado |
| Dónde queda hoy | (no va) | Ídem |
| Estilo de pensamiento | Estilo de pensamiento | Calculado |
| Sobre qué se apoya | Técnicas utilizadas | Fijo, según la batería |
| Anexo con los números | Anexo con los números | Calculado |

---

## 6. Reglas que el generador respeta

**Las constelaciones positivas no se imprimen con su valor.** Su contenido corresponde a la
devolución individual con la psicóloga y no entra en un documento de gestión (R4). El anexo deja
constancia de que existen y nombra a quién corresponde conversarlas. Cuando dan todas negativas, sí
se dice, porque eso no expone nada.

**El Raven va por rango y nunca por percentil.** Es regla del instrumento
(`method/instrumentos/raven-rangos.md`): un percentil suelto invita a leerlo como nota de colegio, y
"1 de cada 2 candidatos" no. Se muestra el puntaje directo y el rango con su frecuencia poblacional.

**Tres cosas que el diccionario de Rorschach pide expresamente:** Zf bajo no se informa cuando el
Raven también dio bajo, porque el motivo probable es la capacidad y no la motivación; de DQv alto se
informa la conducta observable y se omite la atribución a limitaciones intelectuales; y Y alto y Afr
fuera de banda entran como lectura sin recomendación, porque el diccionario no fija ninguna.

**La voz es en primera persona.** Las psicólogas escriben el informe, así que dice "lo que
observamos" y "cruzamos", y no "la psicóloga observó".

**El cliente es un parámetro y nunca un dato escrito en el código.**

---

## 7. Por dónde empezar

1. **Definir el molde de selección capítulo por capítulo**, marcando qué sale calculado y qué
   completa la psicóloga. Es la única pieza que necesita criterio; el resto es mecánico.
2. **Escribir las reglas del mapa de riesgo** como condiciones sobre los índices.
3. **Portar `dimensiones` y `redacciones` a JavaScript**, como módulo sin dependencias.
4. **El script de Airtable**, que lo consume y sube el adjunto.
5. **La página en tools**, que importa el mismo módulo.

Los pasos 1 y 2 son el trabajo real. Los otros tres son mecánicos.

---

## 8. Contexto para arrancar

- `SPECS-arquitectura.md`: el marco, la frontera entre código y datos, y por qué esto va antes que la
  migración.
- `Campos HR/CLAUDE.md`: las reglas del método, en particular R2, R4 y R6, y las reglas de copy.
- `Campos HR/clients/laruso/EMPEZAR-INFORMES.md`: cómo está armado el generador de mapeo, que es de
  donde sale la mitad del código.
- `Campos HR/method/instrumentos/`: los tres diccionarios (Rorschach, Raven, Benziger).
- `camposhr-site/public/informes-prueba/bruno-alsina.html`: el informe de selección de referencia.
