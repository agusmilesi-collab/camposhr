# CAMPOS OS

El sistema de Campos HR: qué es, cómo está pensado y en qué orden se construye.

Esta carpeta guarda las especificaciones. Se abre por acá.

---

## Antes que nada: Airtable no se toca

**El OS no escribe en Airtable.** Airtable se lee, y solo para lo que todavía no
fue migrado. Todo lo que el OS guarda va a Supabase.

El objetivo es migrar Airtable a Supabase y apagarlo. Una escritura nueva del
lado de Airtable es trabajo que después hay que deshacer, y mientras tanto deja
el dato verdadero repartido en dos lugares que se contradicen.

Mientras dura la migración se prueba con **Distribuidora Andina y candidatos
falsos, cargados en Supabase**. Si una pantalla nueva necesita datos para
probarse, se cargan ahí.

Cuando una pantalla necesita guardar algo que hoy vive en Airtable, se migra esa
entidad a Supabase primero y después se construye la pantalla.

La misma regla está en `CLAUDE.md`, en la raíz del repositorio.

---

## Los specs

| Archivo | Qué cubre | Estado |
|---|---|---|
| `SPECS-arquitectura.md` | El marco: unificación, frontera entre código y datos, identidad de cliente, audiencias, capa de servicios | Completo |
| `SPECS-generador-informes.md` | El botón que genera el informe desde los datos cargados | Completo, con dos decisiones abiertas |
| `SPECS-sesion-decision.md` | La pantalla que la psicóloga comparte con el cliente para decidir | Completo, con cuatro cosas a resolver |
| `SPECS-organigrama.md` | La herramienta de estructura del servicio de mapeo | Completo, con las cuatro capas a resolver |

---

## El norte, en tres frases

1. Que el proyecto deje de estar repartido en varios lugares.
2. Irse de Airtable en el mediano plazo.
3. Que las psicólogas carguen los datos, aprieten un botón y salga el informe.

Y un requisito que llegó después y ordena el resto: al pasar de papel a digital,
el sistema va a guardar evaluaciones psicológicas de personas identificables.

---

## La regla que sostiene todo lo demás

**El código va al repositorio. Los datos de personas van a Supabase.**

Un repositorio de git no sirve para guardar una evaluación psicológica, y el
motivo es estructural: no tiene borrado real, así que si alguien pide que se
elimine la suya no se le puede cumplir; quien clona se lleva la base entera; y
no queda constancia de quién leyó qué.

Está desarrollada en `SPECS-arquitectura.md`.

---

## Orden de construcción

1. **Unificar el repositorio.** Privado, con código, método, generadores y
   motores adentro. Los datos de personas afuera desde el primer día.
2. **El generador de informes de selección.** Lee de Airtable a través de la
   capa de servicios, así que no espera a la migración.
3. **El esquema en Supabase y la migración de psicotécnicos**, con seguridad por
   fila y registro de accesos.
4. **Identidad de cliente y contrataciones.** Sacar el cableado de
   `lib/servicios.ts`.
5. **La home por cliente**, con el bloque de decisiones pendientes.

El organigrama tiene su propio orden de cinco pasos y su primera pantalla se
puede construir en paralelo desde el punto 1.

---

## Lo que hay que decidir antes de construir

**Los dos juegos de seis dimensiones.** El de `fichas-de-talento.html`, usado en
los once informes de Laruso, mide el perfil de la persona sola. El de
`SPECS-sesion-decision.md` mide capacidad contra demanda del puesto. Se pisan en
parte y no coinciden. Si conviven, un mismo candidato tiene dos lecturas de seis
números distintas. Detalle en `SPECS-sesion-decision.md`, sección 2.

**Si la sesión de decisión reemplaza al informe o convive con él.** El spec de la
sesión dice que reemplaza al PDF; su propia capa 4 (clínica, indicadores crudos,
firma y método, para auditoría) describe exactamente el informe actual.

**Las capas del organigrama.** Cuatro capas conviven y Airtable guarda una sola.
El camino elegido es una tabla `Líneas`. Ver `SPECS-organigrama.md`, sección 4.

---

## Estado del sistema al 20/8/2026

**Campos OS está desplegado.** Vive en `os.camposhr.com` y lo usan las tres. Todo
lo que sigue ya está en producción, commiteado en `main`.

**Dónde vive el repositorio.** `~/Documents/camposhr-site`. Se mudó del Escritorio
el 19/8 porque macOS bloqueó el acceso a esa carpeta entera y el servidor de
desarrollo empezó a devolver 500 sin que hubiera un error de código.

**Qué hace el OS hoy.**

- *Inicio.* El espacio de trabajo de las tres: temas de la próxima reunión,
  pendientes con responsable, y lo que cada una tiene en curso. Todo se anota,
  se tilda y se reasigna sin salir de ahí.
- *Psicotécnicos.* Reparto por arrastre en "Sin asignar", que significa todo lo
  que no tiene evaluadora, esté en la etapa que esté. Cada fila puede volver a
  la etapa anterior. El nombre abre la ficha del candidato.
- *Ficha del candidato.* Seis pestañas. Datos en tres bloques (la persona, la
  evaluación con lo económico, el ingreso). Manchas es la grilla de codificación
  Rorschach, con las mismas opciones y colores que Airtable. El botón "Calcular
  sumario" corre el motor Exner y escribe `sumario_exner`.
- *El ingreso.* Si la persona entró a trabajar, desde cuándo, y a los noventa
  días cómo le fue. Es lo que después permite calcular el acierto de cada
  evaluadora y modelar qué perfil funciona en cada familia de puesto.
- *Comercial.* Clientes, cotizaciones como embudo, costos por trabajo, accesos.
- *Sistema.* Baterías con su precio, actualizable por cualquiera de las tres.

**Las reglas que hay que conocer antes de tocar nada.** Están en `CLAUDE.md`, en
la raíz del repositorio:

1. El OS no escribe en Airtable, y desde el 19/8 tampoco muestra lo que vive
   allá. Todo lo que guarda va a Supabase.
2. Las columnas de Supabase se llaman como los campos de Airtable.
3. Los cambios de esquema van en un archivo de `supabase/` y se corren con
   `bash scripts/supabase-sql.sh supabase/<archivo>.sql`.
4. `lib/rorschach.ts` se genera desde el esquema de Airtable, no se edita.

**Los precios tienen historia.** El precio de una evaluación es el que regía el
día de su pedido, no el de hoy: actualizar agrega una fila a
`bateria_precios`, no pisa la anterior. El Benziger es opcional en todas las
baterías, cuesta USD 40 y se pesifica al dólar tarjeta del día, que se lee de
dolarapi.com.

**Lo que sigue.**

1. **Migrar los datos clínicos de Airtable.** Es lo que falta para que la ficha
   deje de estar vacía: `rorschach_respuestas`, `sumario_exner`, `benziger`,
   `raven`, `tests_cualitativos` e `informe_competencias` existen y tienen cero
   filas. Las tablas de origen son "Tests Proyectivos" (`tblhq78e1RSmvztC5`),
   "Benziger" (`tbl5Oi3FXtS5SPFoH`), "Tests cualitativos" (`tbls1lgzHFJ2T5KPY`)
   e "Informe" (`tblxBnYV7OZlscuxu`).
2. **Migrar las evaluaciones de Airtable**, que hoy el OS no muestra.
3. **La pantalla de acierto**, que cruza recomendación contra resultado a los
   noventa días, por evaluadora y por familia de puesto. Los datos ya se
   capturan; falta mostrarlos. Y una lista de seguimientos vencidos, porque sin
   eso nadie los va a preguntar.
4. **El alta de pedidos todavía escribe en Airtable** (`lib/airtable-alta.ts`
   desde `app/api/pedidos/route.ts`). Es la única escritura viva que queda.
5. **Cuentas por psicóloga**, para que `accesos.quien` deje de ser un nombre
   elegido de un selector y lo clínico pueda mostrarse con registro real.

**Lo que hay que decidir.** El OS está desplegado **sin puerta**: `OS_CLAVE` no
está cargada en Vercel, así que quien conozca la dirección ve nombres, teléfonos
y correos de candidatos. Cargar esa variable lo cierra, sin tocar código.

**Dónde vive cada cosa hoy.** Airtable: lo clínico y las evaluaciones sin migrar.
Supabase: el OS entero, el ciclo y el cuestionario. Google: el formulario del
Raven y el calendario. El repositorio: la app y los entregables.
