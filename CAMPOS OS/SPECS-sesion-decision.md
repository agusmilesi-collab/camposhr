# SPEC — Sesión de decisión (Campos HR)

> Autoría: Agustín, 18/8/2026. Archivado en CAMPOS OS sin modificar.
> Las verificaciones contra el sistema real están al final, en una sección aparte.

## Qué es

Reemplazo del informe psicotécnico en PDF. No es un documento: es una pantalla
que Lore (psicóloga, Mat. 5217) comparte con el cliente durante la llamada,
donde exploran juntos cómo cambia el veredicto según cómo esté definido el puesto.

## Por qué existe

El cliente compra dos cosas: un **go/no-go** y **la firma de la psicóloga**
como cobertura si el contratado después falla. El PDF de 8 páginas no sirve
para ninguna: es demasiado para decidir y no es lo que lo cubre. Patrón
observado: el cliente recibía el PDF, llamaba a Lore y le pedía "mandame un
audio corto explicándome". Iba a buscar la conclusión y el **grado de certeza**,
que es justo lo que el papel borra.

## Tesis del producto

Un "apto" binario es una predicción, y una predicción se refuta con el
desempeño. Un veredicto **condicionado** ("sí, si se dan estas condiciones")
es un consejo condicionado: a los 8 meses la pregunta deja de ser "¿se equivocó
la psicóloga?" y pasa a ser "¿se cumplieron las condiciones?".

Corolario: el cliente deja de ser receptor y pasa a ser **participante del
juicio**. Y las condiciones no las impone Lore — las elige él en pantalla.

## Regla dura de integridad

- **Los indicadores del test NO se tocan.** Nunca, por nadie.
- **Solo se mueve el contexto del puesto.**

Si el cliente pudiera mover un valor Rorschach, el sistema se vuelve una
máquina de justificar la decisión que ya tomó, y el registro de auditoría
mostraría que los datos se modificaron. Es el riesgo inverso al que la firma
intenta cubrir.

## Modelo

**Capacidad (fija, del perfil)** — 6 dimensiones 0-100, cada una derivada de
indicadores de Rorschach / Zulliger / Raven / entrevista. Cada dimensión guarda
cuántas fuentes la sostienen (`fuentes`) — eso alimenta la certeza.

| dim | qué mide | fuentes ej. |
|---|---|---|
| presion | tolerancia a la presión | D, Adj D, EA |
| conflicto | control emocional | Afr, FC:CF+C, AgC |
| autonomia | autonomía de juicio | Zd, P |
| complejidad | procesamiento cognitivo | Raven Pc, W:D:Dd, Zf |
| equipo | vínculo con el equipo | H:(H)+Hd, COP, SumT |
| jefe | relación con la autoridad | entrevista (1 sola fuente) |

**Demanda (variable, del puesto)** — un control por dimensión, 0-100.
Ritmo/exigencia · exposición a conflicto · autonomía requerida · complejidad
de decisiones · personas a cargo · nivel de supervisión.

**Acoplamientos** (lo que hace que no sea un formulario):
- supervisión alta → baja demanda de `presion` y de `autonomia`, sube la de `jefe`
- supervisión baja → sube demanda de `presion`
- acompañamiento 90 días (toggle) → −12 en `presion` y `conflicto`

**Motor:** `gap = demanda − capacidad`
- gap > 38 → crítica
- gap > 14 → grave
- gap > 0 → leve

**Veredicto:** alguna crítica → `No, en este escenario` · alguna tensión →
`Sí, condicionado a:` · ninguna → `Sí.`

**Certeza:** MEDIA si la tensión se apoya en una sola fuente, o si algún gap
está a menos de 5 de un umbral (avisa que un ajuste chico da vuelta el
resultado). ALTA si no.

## UI

Dos columnas.

**Izquierda — "El cruce"** (panel oscuro). Una fila por dimensión. La fila
fusiona dato y control: la **barra** es la capacidad (fija, gris-azul), el
**slider** es la demanda y su thumb es una marca de bronce que se arrastra por
encima de la barra. Cuando la marca pasa el borde de la barra, la porción
excedida se pinta en rojo. Debajo de cada fila, los indicadores fuente en mono.
Al pie, el único toggle: acompañamiento 90 días.

**Derecha — "El fit"**. Veredicto en serif grande. Mapa de 6 celdas
(holgado / al límite / excedido / crítico) — fit sin reducir a un número.
Condiciones que sostienen el sí. "Dónde aprieta" con severidad y brecha
numérica. **"Qué conviene mover"**: toma la brecha mayor y nombra la palanca
que la achica. Certeza. Audio de Lore (la voz, no un texto más).

**Abajo — Registro**. Cada escenario guardado entra con hora, configuración y
veredicto. Al cerrar, eso es el acta que firman los dos. Esa tabla es la capa
legal: "elegiste este escenario, con estas condiciones, el 12 de marzo".

## Detalles que importan

- Tipografía por hablante: serif itálica = Lore (juicio clínico), sans =
  sistema, mono = datos.
- El audio no es una sección aparte: es la voz del veredicto, arriba, sin scroll.
- El sistema tiene que poder decir "no tengo base para responder eso". Si
  siempre da resultado, es un oráculo y se rompe al primer caso raro.
- Quién mueve: Lore. El cliente pide. Si el cliente arrastra, se pierde la
  autoridad clínica que es lo que se está pagando.

## Fuera de alcance en el prototipo

Umbrales, textos clínicos y mapeo indicador → dimensión son **inventados**.
Los define Lore. Ese es el trabajo real del producto.

## Capas del producto completo (esta pantalla es la 1-2)

1. Decidir — veredicto condicionado + audio + condiciones · decisor · al decidir
2. Preguntas → respuestas en audio de Lore · decisor · al decidir
3. Conducir — 30/60/90 + situaciones · jefe directo · **se desbloquea al contratar**
4. Clínica + indicadores crudos + firma y método · auditoría · cuando algo sale mal

El corte entre 2 y 3 es deliberado: si el 30/60/90 está disponible al decidir,
el jefe se enamora del plan de acompañamiento y contamina la decisión.

## Stack

HTML/CSS/JS vanilla en un archivo, sin dependencias más allá de Google Fonts
(Newsreader, IBM Plex Sans, IBM Plex Mono). Deploy estático tipo Vercel, igual
que el portal de clientes. Datos del candidato vienen de Airtable
(base `appkoAF7ZF5521VRm`).

---
---

# Verificado al archivar · 18/8/2026

Lo de arriba está tal como se escribió. Acá va lo que se chequeó contra el
sistema real, y lo que hay que resolver antes de construir.

## 1. La base de Airtable no existe

`appkoAF7ZF5521VRm` no está en la cuenta. Las dos que hay son:

| Base | ID | Qué tiene |
|---|---|---|
| Psicotécnicos | `appGhbo58t44fOIGe` | Individuo, Tests Proyectivos, Benziger, y el motor Exner |
| Mapeo | `appN15kfqYCF4MCAd` | Sin relevar todavía |

Los datos del candidato salen de `Psicotécnicos`, tabla `Individuo`
(`tbl6Ji4P7d6hOKNUY`). Ahí ya están el `Sumario JSON` del Rorschach, las
columnas `Sx` desglosadas, el Raven y el vínculo al Benziger.

## 2. Hay dos juegos de seis dimensiones, y no son el mismo

Este spec define seis dimensiones de **capacidad frente a demanda**. Ya existe
otro juego de seis, publicado en `fichas-de-talento.html` y usado en los once
informes de Laruso, que mide **perfil sin contraparte**:

| Este spec | El que ya está publicado | Relación |
|---|---|---|
| presion (D, AdjD, EA) | MARGEN (EA, D, AdjD) | Son la misma |
| conflicto (Afr, FC:CF+C, AgC) | CRITERIO (XA%, X+%, FC:CF+C) | Se pisan en parte |
| autonomia (Zd, P) | reparte entre ANÁLISIS (Zd) y MÉTODO (P) | Se parte |
| complejidad (Raven, W:D:Dd, Zf) | reparte entre ANÁLISIS (Raven) y VISIÓN (W) | Se parte |
| equipo (H, COP, SumT) | VÍNCULO (Benziger BD, GHR:PHR, COP, Afr) | Se pisan en parte |
| jefe (entrevista) | sin equivalente | Nueva |

**No es una contradicción a resolver ya**, y sí algo que hay que decidir antes
de construir: si las dos conviven, un mismo candidato va a tener dos lecturas de
seis números que no coinciden, y alguien va a preguntar cuál vale.

Lo que las diferencia de fondo: el juego publicado describe a la persona sola,
y este la mide contra un puesto. Para selección, medir contra el puesto es más
útil. Para el mapeo de Laruso, donde el puesto ya existe y se evalúa el encaje,
el juego publicado ya cumple. Puede que la respuesta sea que cada servicio use
el suyo, y en ese caso conviene que se llamen distinto.

## 3. Qué pasa con el generador de informes

`SPECS-generador-informes.md` describe el botón que genera el informe de
selección como documento. Este spec dice que ese documento se reemplaza por una
pantalla. Las dos cosas comparten el motor de cálculo y difieren en la salida.

Lo que conviene decidir: si la sesión de decisión reemplaza al informe, o si el
informe sobrevive como el respaldo que queda por escrito después de la llamada.
El propio spec sugiere lo segundo cuando habla de la capa 4 (clínica,
indicadores crudos, firma y método, para auditoría), que es exactamente el
contenido del informe actual.

## 4. Dos frases contra una regla del repo

`Campos HR/CLAUDE.md` prohíbe la construcción "no es X, es Y" en todo lo que
sale del repo. El spec la usa dos veces: *"No es un documento: es una pantalla"*
y *"El audio no es una sección aparte: es la voz del veredicto"*. Como es un
documento interno de trabajo y son de autoría de Agustín, quedan sin tocar. Si
algo de este texto viaja a un cliente, hay que reescribirlas.

## 5. Lo que ya existe y sirve tal cual

- **El motor Exner** deja el sumario calculado, así que la capacidad se deriva
  sin recalcular nada.
- **`redacciones.py`** (577 líneas) traduce cada índice a lenguaje llano con su
  recomendación asociada, sacada del diccionario del método. Es lo que puede
  alimentar el "dónde aprieta" y el "qué conviene mover".
- **`dimensiones.py`** (220 líneas) ya hace la conversión de índices a escala
  0–99, que es la misma operación que pide este spec.
- **El registro de escenarios** que sirve de acta necesita una tabla propia. Va
  en Supabase, no en Airtable ni en el repositorio: es dato de una persona
  identificable con valor legal. Ver la frontera en `SPECS-arquitectura.md`.
