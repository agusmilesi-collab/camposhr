# Arquitectura de tools · el sistema de Campos HR

Este archivo alcanza para retomar la conversación de arquitectura desde cero. Sale de las charlas del
13 y 14 de agosto de 2026, con el relevamiento del sistema tal como está y las decisiones tomadas.

**Es el marco donde entran los specs de cada herramienta.** Define la frontera entre código y datos,
la identidad de cliente, las audiencias y la capa de servicios. Cada herramienta define lo suyo en su
propio archivo y se apoya en este.

| Spec | Qué cubre |
|---|---|
| Este archivo | El marco: unificación, datos sensibles, identidad de cliente, audiencias, capa de servicios |
| `SPECS-organigrama.md` | La herramienta de estructura del servicio de mapeo y rediseño organizacional |
| `SPECS-generador-informes.md` | El botón que genera el informe desde los datos cargados |
| `SPECS-sesion-decision.md` | La pantalla que la psicóloga comparte con el cliente para decidir |

---

## El norte

Tres objetivos, en las palabras con las que se plantearon:

1. **Que el proyecto deje de estar repartido en varios lugares.** Unificar.
2. **Irse de Airtable en el mediano plazo.**
3. **Que las psicólogas carguen los datos, aprieten un botón y salga el informe.**

Y un requisito que llegó después y reordena el diseño: las psicólogas vienen de trabajar en papel, y
al pasar a digital el sistema va a guardar evaluaciones psicológicas de personas identificables.

---

## El problema hoy

### Está repartido en ocho lugares

`Campos HR` sin git, `camposhr-site` sin repositorio remoto, `camposhr-portal-src` al lado, Airtable
con datos y motores e interfaces, Supabase con el ciclo y el cuestionario, Google con el formulario
del Raven y el calendario, los entregables copiados a mano a `documentos/`, y archivos sueltos en
`Sistema Campos HR`.

### La identidad de cliente está duplicada

**Hay dos tablas de empresas.** Una en Airtable (`Empresas`, con el token del portal y los pedidos) y
otra en Supabase (`empresas`, con los ciclos y sus corridas). No hay puente: `getCorridaActiva()` usa
el identificador de Supabase y el portal usa el record de Airtable. La misma empresa vive dos veces y
ninguna mitad sabe de la otra.

Con diez empresas y tres servicios eso ya son treinta combinaciones que se resuelven a mano o en
código: los documentos de Laruso están escritos dentro de `lib/servicios.ts`.

### Cinco puertas, una por servicio

| Puerta | Quién entra | Qué ve | Fuente |
|---|---|---|---|
| `clientes.camposhr.com/<token>` | el cliente comprador | psicotécnicos y documentos | Airtable |
| `/l/<token>` | quien asistió a una charla | lo que respondió desde el celular | Supabase |
| `/c/<slug>` | quien responde el cuestionario | el cuestionario | Supabase |
| `/ciclo/<slug>` | el asistente al encuentro, por QR | la pantalla del encuentro | Supabase |
| `tools.camposhr.com` | el equipo interno | las herramientas | mezcla |

---

## La frontera que ordena todo: código y datos van separados

Unificar significa dos lugares en vez de ocho, con una división que no se cruza.

**El repositorio privado** guarda código, método, plantillas y generadores. **Nada con nombre y
apellido.**

**Supabase** guarda los datos y los archivos, con control de acceso y registro de quién leyó qué.

### Por qué los datos clínicos no van al repositorio

Una evaluación psicológica de una persona identificable es un dato sensible bajo la ley argentina de
protección de datos, y además está alcanzada por el secreto profesional de quien la administró. Un
repositorio de git no sirve para guardarla, y el motivo es estructural y no de permisos:

- **No hay borrado real.** El historial conserva todo lo que alguna vez se subió. Si alguien pide que
  se elimine su evaluación, con git no se puede cumplir.
- **No hay acceso por registro.** Quien clona el repositorio se lleva la base entera.
- **No hay trazabilidad de lectura.** No queda constancia de quién abrió qué.

Esto cambia algo que ya está en producción: los once informes de Laruso viven hoy como adjunto en
Airtable, y el plan anterior era moverlos a `documentos/` del repositorio. Con este requisito, esa
carpeta deja de ser el destino y pasan a Storage privado.

### Qué va en cada lado

| Va al repositorio | Va a Supabase |
|---|---|
| La app, los generadores, los motores | Las evaluaciones y sus sumarios |
| El método y las plantillas agnósticas | Las personas y las empresas |
| Los specs y la documentación | Los informes generados y los escaneos, en Storage |
| Los aprendizajes destilados sin nombre | El registro de accesos |

La regla de lista blanca que ya funciona en `lib/airtable.ts`, donde los campos clínicos se piden por
identificador explícito para que la API nunca los devuelva, se conserva y se traslada a Postgres como
seguridad por fila.

---

## Decisiones tomadas

**El repositorio es privado.** Hoy media docena de comentarios en el código asumen que es público, y
por eso los entregables viven fuera de `public/`. Al unificar entra material con nombre y apellido,
así que la privacidad deja de ser opcional. GitHub privado no tiene costo y Vercel despliega desde
ahí sin problema, siempre que el repositorio esté bajo la cuenta personal y no bajo una organización,
que es la restricción real del plan gratuito.

**Airtable tiene salida planificada.** Deja de ser "se queda y no crece" y pasa a ser una migración
con orden, servicio por servicio, reemplazando módulos de la capa de servicios. La estimación
completa es de 310 a 500 horas contra un ahorro de 864 dólares al año, así que la migración no se
justifica por el ahorro y sí por el control, la unificación y el requisito de datos sensibles.

**Las personas se unifican por cliente.** El evaluado del psicotécnico, el asistente al ciclo y quien
responde un cuestionario son la misma persona cuando lo son. Es lo único que después permite decir
"de los once evaluados, ocho pasaron por el ciclo".

**El asistente a una charla es un participante y no un rol del cliente.** La ruta `/l/<token>` se
llama "portal del líder" por su origen, y del otro lado hay alguien que fue a una charla y respondió
preguntas desde el celular. Que en esa charla fuera líder es circunstancial.

**Sin IA por ahora**, con los lugares donde entraría dejados planteados más abajo.

---

## El modelo

```
Cliente
 ├── Contratación (servicio, período, estado)
 │    └── Piezas (documentos, evaluaciones, encuentros, cuestionarios)
 └── Persona
      └── Participaciones (en qué contratación entra, y con qué rol)
```

**Cliente** es la única identidad. Hoy está duplicada, así que el primer trabajo sobre datos es
reconciliarla: una fila por empresa con el identificador de Airtable y el de Supabase al lado, hasta
que el primero desaparezca.

**Contratación** es una instancia de un servicio para un cliente. Reemplaza al `SERVICIOS` escrito en
código y hace que dar de alta un cliente sea cargar una fila en lugar de desplegar.

**Persona** guarda la identidad y nada más. Los datos de cada servicio cuelgan de su participación,
que es lo que permite que la evaluación psicotécnica y las respuestas de una charla convivan sin que
una consulta pueda devolver las dos juntas.

**Quien más necesita esa tabla es el organigrama.** Su spec lista los casos que rompen un modelo
ingenuo, todos de clientes reales: una persona en dos puestos, un puesto con cuatro ocupantes que no
son intercambiables, una persona sin ningún puesto que igual va en el tablero, y gente de afuera que
hace trabajo de adentro. Ver `SPECS-organigrama.md`, sección 5.

### Las capas del organigrama

El organigrama de un cliente son cuatro y conviven: el declarado por las fichas, el dibujado por la
empresa, el real que sale de las entrevistas, y el objetivo que proponemos. La diferencia entre capas
es el diagnóstico, así que las cuatro se guardan. La decisión de esquema está en
`SPECS-organigrama.md`, sección 4, y el camino elegido es una tabla `Líneas` con empresa, puesto,
depende de, capa y fuente.

---

## Las tres audiencias

**El cliente comprador** quiere saber qué pasa con su empresa. Entra por `clientes.camposhr.com` con
su token y ve una home con una tarjeta por servicio contratado.

**El participante** quiere hacer una cosa y salir: responder el cuestionario, ver la pantalla del
encuentro, mirar lo que contestó. Piensa por evento y no por empresa. Entra por QR o enlace corto.
Acá caen `/c/`, `/ciclo/` y `/l/`.

**El equipo interno** necesita las dos vistas: por servicio para operar el día y por cliente para
preparar una reunión. Entra por `tools.camposhr.com`, donde cada herramienta es una tarjeta del hub.

Hay un cuarto uso que es un momento y no una audiencia: **la reunión con el dueño**, donde el equipo
interno opera la herramienta con el cliente mirando. Impone requisitos propios, como el modo
estructura sin nombres, el deshacer inmediato y el modo presentación. Están en
`SPECS-organigrama.md`, sección 9.

---

## La capa de servicios

Cada servicio se expone como un módulo con la misma forma, y la app no sabe de dónde salen los datos:

```ts
type Servicio = {
  slug: string;
  titulo: string;
  estado(clienteId): Promise<Estado>;
  resumen(clienteId): Promise<Resumen>;
  piezas(clienteId): Promise<Pieza[]>;
  pendientes(clienteId): Promise<Pendiente[]>;
};
```

**Es lo que vuelve barata la salida de Airtable.** Psicotécnicos lee Airtable hoy y Postgres mañana;
se reemplaza un módulo y el resto del sistema ni se entera. Por eso toda pieza nueva se construye
contra esta capa aunque el dato todavía viva en Airtable.

El organigrama ya está especificado con esta forma: lee el modelo relevado de Airtable, escribe el
trabajo en curso en Supabase, y solo devuelve datos cuando una decisión se aprueba de manera
explícita. Su regla dura es la misma que sostiene `contrataciones`: **el cliente es un parámetro y
nunca un dato escrito en el código.**

---

## El generador de informes

Es el tercer objetivo, y se puede construir antes de migrar nada.

### Lo que ya se calcula solo

Al armar los informes individuales de Laruso quedó separado lo que se calcula de lo que se redacta:

- `redacciones.py` aplica el diccionario del método sobre el sumario y produce entre trece y
  veintidós lecturas por persona, con siete a dieciséis recomendaciones, sin que nadie escriba una
  línea.
- `dimensiones.py` calcula las seis dimensiones desde el Rorschach, el Raven y el Benziger.
- El anexo completo, los cuadrantes, el Raven por rango y el estado de estrés salen de los datos.

### La distinción que hace viable el botón

**Un informe de selección se puede generar entero salvo el veredicto. Uno de mapeo no.**

Un mapeo cruza entrevistas, observación y estructura de la empresa, y esa lectura es humana. Una
selección es una persona, tres pruebas y un puesto.

Mirando el informe de selección de referencia contra lo que ya existe: los cuadrantes, las
competencias, el anexo y los adjetivos del candidato ya se generan; el mapa de riesgo se deriva con
reglas de D y AdjD, GHR:PHR, Zd y Lambda; y el capítulo de qué hacer son las recomendaciones que el
diccionario ya devuelve.

**El veredicto queda humano a propósito.** R4 del método dice que ningún puntaje decide solo y que lo
firma la psicóloga que administró la prueba. Automatizarlo sería violar el método, no ganar tiempo.

### Cómo se usa

La psicóloga carga la prueba, aprieta un botón, y el informe sale completo con todo lo calculado.
Ella pone el veredicto, ajusta lo que quiera y lo entrega. Es además el negocio de volumen: de los
sesenta y un individuos cargados, la mayoría son selección.

---

## La UX de la home por cliente

Al entrar, el cliente quiere tres respuestas. Las dos primeras ya existen en el portal de Laruso, que
de hecho ya es una home por cliente con dos servicios, solo que cableada en código.

**Qué se está moviendo.** Lo que avanza esta semana, con su estado.

**Qué me entregaron.** Los documentos y los informes, con la fecha.

**Qué están esperando de mí.** En Laruso hay cinco pedidos a la dirección y tres decisiones abiertas
que viven adentro de un HTML que hay que abrir y leer entero. Si la home dijera "tres decisiones
esperan tu respuesta", con el enlace a cada una, el portal deja de ser un repositorio de archivos y
pasa a ser el lugar donde el trabajo avanza. De paso da algo que falta: saber si el cliente las miró.

---

## El orden de construcción

**1 · Unificar el repositorio.** Privado, con el código, el método, los generadores y los motores
adentro. Los datos de personas quedan afuera desde el primer día. Vercel apunta a la subcarpeta de la
app. Es la base de todo lo demás y no tiene costo.

**2 · El generador de informes de selección.** Lee de Airtable a través de la capa de servicios, así
que no espera a la migración. Es lo que le saca trabajo de encima a las psicólogas todos los días y
lo que hace que el sistema empiece a devolver valor antes de estar terminado.

**3 · El esquema en Supabase y la migración de psicotécnicos.** Con seguridad por fila y registro de
accesos desde el arranque, porque es donde viven los datos sensibles. Es el bloque más grande de la
salida de Airtable y el que más justifica hacerla.

**4 · Identidad de cliente y contrataciones.** Reconciliar las dos tablas de empresas y sacar el
cableado de `lib/servicios.ts`. El criterio de aceptación es que el portal de Laruso siga mostrando
exactamente lo mismo, que es la forma de saber que no se rompió nada.

**5 · La home por cliente sobre esa tabla**, con el bloque de pendientes.

El organigrama tiene su propio orden en cinco pasos dentro de su spec. Su primera pantalla, la vista
de solo lectura con el árbol y los tres contadores, se puede construir en paralelo desde el punto 1,
porque lee de Airtable donde la empresa ya es un parámetro. Lo que sí espera es su capa de personas.

---

## Dónde entra la IA, cuando entre

Está planteada y no se implementa todavía.

**Donde se paga sola:** la redacción de las fichas de un mapeo, que es lo único genuinamente humano
del informe; la extracción de datos del Benziger, que hoy Airtable resuelve con un nodo de IA y que
hay que reemplazar al migrar; y el ajuste de tono de un informe ya generado.

**Donde no entra nunca:** el veredicto, y el cálculo del sumario y de las dimensiones. Los dos tienen
que seguir siendo deterministas y auditables, porque un informe psicológico se defiende mostrando de
dónde salió cada número.

---

## Fuera de alcance

**Los cientos de informes en papel.** Digitalizarlos es un proyecto propio, con escaneo, nombrado,
carga e indexado, y por ahora no se hace. Cuando se haga, la pregunta previa es si esos legajos se
consultan o se guardan por obligación: si es lo segundo alcanza con escanearlos y hacerlos buscables
por persona y fecha, sin extraer lo que dicen adentro.

---

## Lo que no se hace

**Usuario y contraseña para el cliente.** El enlace secreto es la razón por la que lo usan.

**Un solo dominio para todo.** La separación por host entre cliente e interno funciona y sale gratis.

**La home por cliente para el participante.** Quien entra por QR a un encuentro quiere la pantalla de
ese encuentro.

**Datos de personas en el repositorio.** Ni informes, ni entrevistas, ni sumarios, ni escaneos. Es la
frontera que sostiene todo el resto.
