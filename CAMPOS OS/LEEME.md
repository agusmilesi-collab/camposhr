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
  pendientes con responsable, y lo que cada una tiene en curso.
- *Psicotécnicos, en cuatro secciones:* Sin asignar, Entrevistas, Por analizar,
  Entregados.
  - **Sin asignar** es el tablero de reparto por arrastre, y significa todo lo
    que no tiene evaluadora, esté en la etapa que esté. Cada tarjeta muestra la
    fecha de la solicitud y hace cuánto entró. Tocarla abre el cajón de la
    derecha, donde se corrigen pedido, nombre, teléfono, correo, evaluadora y
    CV, y donde se borra un candidato: el borrado pide confirmación, arrastra
    manchas, tests e informe por cascade, y queda anotado en `accesos` con su
    propia acción.
  - La columna sin dueño cierra con la tarjeta **Agregar candidato**: pedido,
    nombre y un contacto a la vista, y el resto detrás de un clic. Si el pedido
    no existe todavía, "+ Pedido nuevo" abre un cajón con sus ocho campos
    (cliente, puesto, área, nivel, batería, Benziger, fecha y qué pidió), y al
    guardarlo queda elegido para seguir cargando candidatos.
  - **Entrevistas** junta las etapas "Por citar" y "Por entrevistar", que en la
    base siguen separadas. Son dos bloques: arriba a quién hay que citar, con
    la fecha y la modalidad editables; abajo lo ya agendado, de solo lectura,
    con el botón **Copiar link** que genera el enlace del test de Raven para
    pegarlo en el chat donde se esté hablando con la persona.
  - **Por analizar** son tarjetas y no una tabla: en esa etapa el trabajo es
    entrar a cada persona. Cada tarjeta entera lleva a su ficha y muestra la
    batería, hace cuánto espera (en rojo pasada la semana) y con qué cerró.
  - Cada fila puede volver a la etapa anterior con la flecha azul.
- *Ficha del candidato.* Seis pestañas: Datos, el test de manchas, Benziger,
  Tests, Recomendación e Informe.
  - **La pestaña del test lleva el nombre del que se administró**, Rorschach o
    Zulliger. Lo dice la codificación cargada; si todavía no hay ninguna, lo
    dice la batería del pedido. Cuando las dos existen y no coinciden, un aviso
    lo señala.
  - **El sumario vive en esa misma pestaña**, debajo de la grilla de la que
    sale. "Calcular sumario" está en el pie de la grilla, contra el borde
    derecho. La hoja se dibuja con la disposición del papel: Controles, Afectos
    e Interpersonal arriba; Ideación, Mediación, Procesamiento y Autopercepción
    abajo; y al cierre, dos tarjetas del mismo tamaño con las constelaciones y
    su detalle, y con los códigos especiales. X−%, Xu%, el Aislamiento y el
    índice de egocentrismo muestran la cuenta completa, del tipo `1 / 20 = 0.05`.
  - **Benziger.** Se sube el informe en PDF y al calcular se lee solo: el
    parseo es determinístico, por posiciones, sin modelo. De ahí sale la hoja
    con el perfil, las cruces con su lectura de diagonal, la escala de alerta,
    el estado emocional, la autoimagen, lo que la persona escribió y los
    acontecimientos del último año. El cuadrante preferente lo elige la
    evaluadora en una cruz de cuatro botones.
  - **Tests.** Bender y Gráfico 2 personas se marcan acá. El Raven se carga con
    el puntaje directo y el percentil, los desvíos y el rango salen solos.
  - **Recomendación.** La conclusión y su fundamento, que se suben juntos con
    "Cargar": son una sola decisión y guardar a mitad de una frase dejaría media
    decisión en la base.
  - **Informe.** Las competencias, y al pie el botón de entregar, que necesita
    la conclusión cargada.
- *El ingreso.* Si la persona entró a trabajar, desde cuándo, y a los noventa
  días cómo le fue. Es lo que después permite calcular el acierto de cada
  evaluadora y modelar qué perfil funciona en cada familia de puesto.
- *Comercial.* Clientes, cotizaciones como embudo, costos por trabajo, accesos.
- *Sistema.* Baterías con su precio, actualizable por cualquiera de las tres.
  Herramientas incluye la vista de prueba del Raven.

**El test de Raven se toma desde el OS.** La evaluadora copia el enlace en la
entrevista y lo manda por donde esté hablando con la persona. Son 36 láminas de
ocho opciones numeradas y 45 minutos. El reloj lo lleva el servidor, no el
navegador: quien decide si una respuesta llegó a tiempo es el momento en que se
abrió la primera lámina. Se puede volver a cualquier lámina y cambiar lo
respondido, la tira de abajo marca las que faltan, y el cronómetro se puede
ocultar sin que deje de correr. A los cinco minutos del final aparece el aviso,
anunciado desde las instrucciones. Al terminar corrige contra la clave y el
puntaje entra solo en la ficha. El candidato no ve su resultado.

**Lo que le falta al Raven para usarse con gente:** las 36 láminas escaneadas,
que van a `public/raven/laminas/` numeradas de 1 a 36. Hoy hay una de muestra
que se repite y una réplica en SVG de la 36, hecha para probar si conviene
dibujarlas con código en vez de escanearlas. Si se toma ese camino, cada réplica
tiene que validarse contra el manual: una línea de más en una celda cambia cuál
es la respuesta correcta. La clave de las 36 ya está cargada, del lado del
servidor.

**Las tablas del pipeline tienen anchos fijos por campo.** Están en `ANCHO`, en
`app/os/psicotecnicos/Tabla.tsx`, y se declaran por nombre de columna y no por
posición: así "Candidato" mide lo mismo en las cuatro secciones y cambiar de
pantalla no mueve nada de lugar. Ninguna tabla pasa de 1200 px, y las dos de
Entrevistas dan exactamente eso. Una fila es un renglón: lo que no entra se
recorta. El pedido es la única excepción, con dos.

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

**Los motores viven separados de las pantallas.** `lib/exner.ts` calcula el
sumario de Rorschach y Zulliger; `lib/benziger-pdf.ts` lee el informe y
`lib/benziger-lectura.ts` lo interpreta; `lib/raven.ts` tiene el baremo. Lo que
sale del informe Benziger se guarda tal como viene y no se recalcula: el PDF ya
trae los totales, y rehacerlos sería una segunda fuente que puede no coincidir
con la licencia.

**Lo que sigue.**

1. **Migrar los datos clínicos de Airtable.** Es lo que falta para que la ficha
   deje de estar vacía: `rorschach_respuestas`, `sumario_exner`, `benziger`,
   `raven`, `tests_cualitativos` e `informe_competencias` existen y hoy solo
   tienen los datos de prueba de Distribuidora Andina. Las tablas de origen son
   "Tests Proyectivos" (`tblhq78e1RSmvztC5`), "Benziger" (`tbl5Oi3FXtS5SPFoH`),
   "Tests cualitativos" (`tbls1lgzHFJ2T5KPY`) e "Informe" (`tblxBnYV7OZlscuxu`).
2. **Migrar las evaluaciones de Airtable**, que hoy el OS no muestra.
3. **Las láminas del Raven**, para que el test se pueda tomar de verdad.
4. **La pantalla de acierto**, que cruza recomendación contra resultado a los
   noventa días, por evaluadora y por familia de puesto. Los datos ya se
   capturan; falta mostrarlos. Y una lista de seguimientos vencidos, porque sin
   eso nadie los va a preguntar.
5. **El alta de pedidos todavía escribe en Airtable** (`lib/airtable-alta.ts`
   desde `app/api/pedidos/route.ts`). Es la única escritura viva que queda.
6. **La batería no se puede cambiar desde la ficha del pedido.** `CAMPOS_PEDIDO`
   en `lib/pedido-campos.ts` no la incluye, así que hoy solo se fija al crear el
   pedido y cambiarla exige tocar la base a mano.
7. **El sumario puede quedar viejo sin avisar.** Si se corrige una codificación
   y no se recalcula, la pantalla muestra los números anteriores. Las
   respuestas guardan `created_at` pero no cuándo se editaron, así que hoy no se
   puede comparar contra `sumario_exner.actualizado_at`.
8. **Cuentas por psicóloga**, para que `accesos.quien` deje de ser un nombre
   elegido de un selector y lo clínico pueda mostrarse con registro real.

**Lo que hay que decidir.** El OS está desplegado **sin puerta**: `OS_CLAVE` no
está cargada en Vercel, así que quien conozca la dirección ve nombres, teléfonos
y correos de candidatos. Cargar esa variable lo cierra, sin tocar código.

**Dónde vive cada cosa hoy.** Airtable: lo clínico y las evaluaciones sin migrar.
Supabase: el OS entero, el ciclo, el cuestionario y el test de Raven. Google: el
formulario viejo del Raven, que deja de hacer falta cuando estén las láminas, y
el calendario. El repositorio: la app y los entregables.
