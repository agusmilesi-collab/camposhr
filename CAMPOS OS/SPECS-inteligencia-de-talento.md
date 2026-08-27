# Inteligencia de talento · especificación

Qué se puede afirmar con los datos de las evaluaciones, con cuántos casos hace
falta contar para afirmar cada cosa, y en qué orden se construye.

Sale de contrastar un documento de ideas de producto contra la base real el
26/08/2026 (`~/Desktop/portal_inteligencia_talento_ideas.md`). Lo que sobrevivió
al contraste está en la sección 4. Lo que no, en la sección 6, con la condición
que lo habilitaría.

**Estado: nada construido.** La sección 4.1 es la que hay que hacer primero,
porque sin ella ninguna de las otras cinco es posible más adelante.

---

## 1. Qué es, y para quién

Es la capa que responde qué se aprendió de las personas evaluadas, más allá del
informe de cada una.

Hay tres audiencias y conviene no mezclarlas nunca, porque el número que se
puede publicar en cada una es distinto:

| Audiencia | Dónde | Qué puede ver |
|---|---|---|
| El cliente | portal, `app/c/[slug]` y `app/p/[token]` | Sus candidatos, y su posición dentro del conjunto evaluado por Campos HR |
| El equipo | el OS, `app/os/` | Todo, con nombre |
| Campos HR | el OS | El acumulado transversal, que no pertenece a ningún cliente y sale siempre agregado |

**Lo que se evalúa son candidatos externos que se presentaron a una búsqueda.**
No son la plantilla del cliente, y la mayoría no va a trabajar ahí. Cualquier
texto que diga "tu gente" o "tu organización" sobre estos datos es falso. La
única población interna que existe hoy es la del servicio de mapeo, que son
diecinueve individuos de un cliente y usa otro instrumento.

---

## 2. Lo que hay hoy, medido

Verificado el 26/08/2026 contra Supabase (API REST, tabla por tabla) y contra la
base Psicotécnicos de Airtable.

| Dato | Cuánto |
|---|---|
| Evaluaciones | 54 en Supabase; 74 registros de Individuo en Airtable, de los que 19 son del servicio de mapeo |
| Desde cuándo | El registro más viejo es del 19/06/2026. Dos meses |
| Empresas con pedidos | 9. La mayor tiene 25 evaluaciones; después 11, 7, 5, 2, 1, 1, 1, 1 |
| Pedidos | 43, con 38 puestos distintos |
| Candidatos por pedido | 32 pedidos con uno, 7 con dos, 2 con cuatro |
| Familia de puesto | Comercial 18, IT 8, Administración 8, Dirección 7, Operaciones 7, Ingeniería 3, RRHH 2 |
| Seniority | Junior 21, Semi Senior 16, Senior 9, Jefatura 5, Dirección 2 |
| Sumario de Exner | 42 casos |
| Benziger | 40 casos, con veintidós números cada uno |
| Raven | 39 casos |
| Competencias puntuadas y guardadas | 0. `informe_competencias` está vacía y la tabla Informe de Airtable también |
| Recomendación cargada | 14 de 54 |
| Contratado | 1 registro. Fit a 90 días: 0 |
| Contexto del puesto y exigencia | Las nueve columnas de `pedidos` y `exigencia_id`: 0 de 43 con dato |

---

## 3. Los tres límites que fijan el alcance

**El volumen.** El cliente más grande tiene 25 evaluaciones y el puesto más
repetido tiene cuatro candidatos. Un porcentaje calculado sobre tres personas se
lee igual que uno calculado sobre trescientas, y es el motivo por el cual un
motor que busque patrones solo va a encontrar diferencias que no existen, y las
va a escribir con la firma de Campos HR.

**La historia.** El dato más viejo tiene diez semanas. Todo lo que sea evolución
temporal, comparación entre años o "qué cambió desde la última vez" necesita una
serie que todavía no existe.

**La población.** Ver la advertencia de la sección 1.

De los tres sale la regla que gobierna todo lo demás:

> **Ningún número sale a un cliente sin decir sobre cuántos casos está
> calculado, y ninguna afirmación se publica por debajo del umbral de la
> sección 7.**

---

## 4. Qué se construye, en orden

### 4.1 Guardar las competencias que hoy se calculan y se descartan

`lib/competencias.ts` produce seis puntajes de 0 a 100 por persona: Autogestión,
Control emocional, Habilidad interpersonal, Proactividad, Liderazgo (esta última
solo con Rorschach) y la habilidad cognitiva, que sale del Raven. Cada una lleva
sus indicadores con el nivel y el peso, así que el número muestra de dónde sale.

Hoy se calculan al abrir el informe y no quedan en ninguna tabla. La tabla que
los recibiría ya existe, con la columna de indicadores y la de justificación
(`supabase/psicotecnicos.sql:300`), y está vacía.

**Qué hace falta:** que al generar o cerrar el informe se escriba una fila por
competencia, con el puntaje, los indicadores fuente, la banda que le tocó y con
qué perfil de exigencia se la nombró. El puntaje y la banda son dos datos
distintos: mover la exigencia cambia el rótulo y nunca el número
(`lib/exigencia.ts:1-14`), así que el que se guarda para comparar es el puntaje.

**Por qué va primero:** sin esta tabla, todo lo demás de este documento es
imposible hoy y va a seguir siendo imposible dentro de dos años, porque el dato
se pierde en cada informe que se genera.

### 4.2 Comparar los candidatos de una misma búsqueda

Es la única agregación con casos suficientes hoy, porque el n va de dos a cuatro,
y es la decisión que el cliente está tomando en ese momento: a cuál de estos
tres.

**Qué muestra:** los candidatos del pedido lado a lado, con las seis
competencias, el percentil del Raven, el cuadrante preferente del Benziger y la
recomendación. Con las bandas del perfil de exigencia del pedido, cuando lo
tenga.

**Dónde vive:** en el OS, dentro del pedido. En el portal del cliente, la misma
comparación limitada a los candidatos de su búsqueda.

**Qué no hace:** ordenar candidatos por un puntaje general. No existe un puntaje
general, y fabricarlo sumando seis competencias inventa una jerarquía que
ninguno de los instrumentos sostiene.

### 4.3 Poner al candidato contra el conjunto evaluado por Campos HR

Acá los casos alcanzan: 42 sumarios, 40 Benziger, 39 Raven, y sube unos
veinticinco por mes.

**Qué muestra:** para cada competencia, en qué percentil quedó esta persona
dentro del conjunto evaluado por Campos HR, diciendo sobre cuántos casos está
calculado y con qué cortes. Después, con más volumen, el mismo percentil
restringido a la familia de puesto y al seniority, cuando cada corte pase el
umbral.

**Por qué es el que más valor entrega:** es un dato que hoy ningún cliente puede
conseguir por su cuenta, es verdadero desde el primer día, y no depende de que
un cliente acumule veinte evaluaciones propias.

**Las reglas que lo hacen publicable:**

- El conjunto es de Campos HR y sale siempre agregado. Nunca se identifica de
  qué empresa salió cada caso.
- Un corte se publica desde el umbral de la sección 7 y no antes. Debajo del
  umbral, la pantalla dice cuántos casos faltan.
- Distribuidora Andina y sus candidatos quedan fuera del cálculo. La marca ya
  existe (`lib/psicotecnicos-supabase.ts:150` y `lib/psicotecnicos-tipos.ts:181`,
  el campo `prueba`).

### 4.4 Llenar la ficha del puesto, que ya está construida y vacía

`pedidos` tiene nueve columnas de contexto (`puesto_problemas`,
`puesto_presion`, `puesto_interaccion`, `puesto_estabilidad`,
`puesto_contacto_jefe`, `puesto_innovacion`, `jefe_estilo`, `jefe_paciencia`,
`jefe_emociones`) y `exigencia_id`, todas sin dato en los 43 pedidos.

**Qué habilita:** que la recomendación se pueda explicar contra algo declarado
de antemano. El puntaje del candidato contra la exigencia del puesto es la única
inteligencia por posición defendible con estos volúmenes, porque no necesita
cuarenta evaluados del mismo puesto, que no van a existir nunca: hay 38 puestos
distintos en 43 pedidos.

**Qué hace falta:** que cargar el contexto sea parte de tomar el pedido y no un
formulario aparte, y que el perfil de exigencia quede asignado al crearlo.

### 4.5 Empezar a capturar el resultado

`Contratado`, `Fecha de contratación` y `Fit a 90 días` existen como campos en
Airtable y tienen un registro, cero y cero. El seguimiento a los noventa días ya
tiene su fecha en la base.

**Qué hace falta:** que el seguimiento pregunte las tres cosas y las guarde en
Supabase, y que quede en Pendientes cuando la fecha llega.

**Por qué ahora:** es el único dato de esta lista que no se puede recuperar
después. Sin resultado no hay forma de saber si los psicotécnicos predicen algo,
y con doce meses de captura empieza a haberla.

**Qué no se hace con eso todavía:** correlacionar puntajes con desempeño y
publicarlo. Eso está en la sección 6 y tiene su propia condición.

### 4.6 El tablero de la operación

Lo que sí tiene casos suficientes hoy es el negocio: 43 pedidos con fechas de
ingreso, entrevista y entrega, dos evaluadoras, 25 facturas.

**Qué muestra:** cuánto tarda una evaluación de punta a punta y en cada etapa,
cuántas lleva cada evaluadora, qué clientes concentran, qué se factura por
batería, y qué pedidos están frenados y desde cuándo.

**Para quién:** el equipo. No sale al cliente.

---

## 5. Cómo se escribe cada número que sale de acá

Cinco reglas, y valen para las seis piezas:

1. **Ningún gráfico entra si abajo no se puede escribir una frase que signifique
   algo.** Un gráfico que solo se puede describir ("acá se ve la distribución")
   es un gráfico que todavía no encontró su motivo.
2. **Cada afirmación dice sobre cuántos casos está calculada**, en la misma
   frase y no en una nota al pie.
3. **Se describe lo observado y no se afirma la causa.** Los datos muestran que
   dos cosas aparecen juntas; por qué aparecen juntas no está en la base.
4. **La muestra se nombra por lo que es.** "Dentro de las 54 personas evaluadas
   por Campos HR" y nunca "en tu empresa".
5. **Cada número muestra su origen.** Es la misma regla que ya sostiene el
   informe: cada puntaje de competencia trae sus indicadores
   (`supabase/psicotecnicos.sql:296-300`, "cada número muestra su origen").

---

## 6. Lo que queda afuera, y con qué se habilitaría

| Idea | Por qué no | Qué la habilitaría |
|---|---|---|
| Motor de descubrimiento automático | Con 54 casos encuentra diferencias que no existen y las publica firmadas | Volumen, y una prueba estadística por afirmación con su umbral declarado |
| Evolución temporal, deriva de perfiles, "qué cambió" | Diez semanas de historia | Doce meses de datos y un corte mínimo por período |
| Retrato agregado de la empresa | Mide al pool de candidatos y lo rotula como la organización | El servicio de mapeo, que sí evalúa gente de adentro, y con su propia muestra |
| Preguntar a los datos en lenguaje natural | Sobre 25 registros la respuesta honesta casi siempre es que no alcanza, y un modelo de lenguaje sobre datos psicométricos con nombre es el peor lugar para ponerlo | Volumen, y una capa que solo devuelva agregados por encima del umbral |
| Composición de equipos | Necesita la plantilla del cliente | El servicio de mapeo |
| Mapa de fortalezas y brechas | No existen como dato: viven en la prosa del informe | Que fortalezas y brechas se carguen como campo, o se deriven de las competencias ya puntuadas |
| Correlacionar evaluación con desempeño posterior | Un registro de contratación y ninguno de fit a 90 días | La sección 4.5 corriendo doce meses, y revisión metodológica antes de publicar nada |

---

## 7. Umbrales, y de dónde salen

Son criterio propio, como los cortes de `lib/competencias.ts`, y están acá para
poder discutirlos en un solo lugar:

| Qué se quiere afirmar | Casos mínimos |
|---|---|
| Percentil de una persona dentro del conjunto | 30 en el conjunto |
| Un corte del conjunto (familia, seniority) | 20 en ese corte |
| Comparar dos cortes entre sí | 20 en cada uno |
| Una tendencia en el tiempo | 20 por período, y tres períodos |
| Una relación entre evaluación y resultado | Fuera de alcance hasta la revisión metodológica |

Debajo del umbral, la pantalla dice cuántos casos faltan. Ese texto es una
funcionalidad y no un error: muestra que el conocimiento crece con cada
evaluación, sin inventar el que todavía no está.

---

## 8. Lo que queda por decidir

1. **¿El percentil contra el conjunto sale al portal del cliente, o solo al
   informe?** El informe ya es el lugar donde el cliente lee números sobre una
   persona, y sumarlo ahí no necesita pantalla nueva.
2. **¿La comparación de candidatos de una búsqueda se le muestra al cliente, o
   se usa en la sesión de decisión?** Está cerca de lo que cubre
   `SPECS-sesion-decision.md` y conviene resolverlo junto con eso.
3. **¿El conjunto transversal incluye a los candidatos de todos los clientes sin
   excepción?** Un cliente puede haber pedido que sus datos no se usen ni
   agregados, y eso hay que poder marcarlo por empresa.
4. **¿Quién revisa la metodología antes de publicar algo comparativo?** Los
   cortes de competencias ya esperan revisión de la psicóloga, y esto pide lo
   mismo.

---

## 9. Fuentes

Medido el 26/08/2026:
- Supabase, por API REST: conteos de `evaluaciones`, `pedidos`, `empresas`,
  `benziger`, `raven`, `sumario_exner`, `informe_competencias`, y llenado de las
  columnas de contexto de `pedidos`.
- Airtable, base Psicotécnicos: tabla Individuo (74 registros) y tabla Informe
  (0 registros).

Del repositorio:
`lib/competencias.ts:1-20` y `:313-500` (las seis competencias y sus
indicadores), `lib/exigencia.ts:1-14` (puntaje y banda son datos distintos),
`lib/psicotecnicos-supabase.ts:150` (la marca de los casos de prueba),
`supabase/psicotecnicos.sql:296-300`
(la tabla de puntajes del informe), `supabase/pedido-como-airtable.sql` (las
columnas de contexto del puesto), `middleware.ts:8-15` (las tres zonas),
`app/c/[slug]` y `app/p/[token]` (el portal del cliente).

Documento de origen: `~/Desktop/portal_inteligencia_talento_ideas.md`.
