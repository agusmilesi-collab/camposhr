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
- *Psicotécnicos, en cinco secciones:* Sin asignar, Entrevistas, Por analizar,
  Entregados y Seguimiento.
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
    la fecha y la modalidad editables; abajo lo ya agendado, de solo lectura.
  - En Agendadas el nombre abre la **hoja de la entrevista**, que es otra cosa
    que la ficha: se abre con la persona enfrente y tiene un renglón por test
    de la batería con su herramienta a un clic. Las láminas de Rorschach o
    Zulliger según corresponda; el enlace del Raven con en qué anda (mandado,
    empezado, terminado) y el reloj de lo que le queda mientras responde, que
    al terminar pasa a decir cuánto tardó; el gráfico de dos personas y el Bender, que se
    toman en papel: ahí se marca si se administraron y se escribe lo que la
    evaluadora vio mientras la persona dibujaba, y del gráfico se sube además
    la foto o el escaneo. El botón del Bender queda a la vista y apagado hasta
    que sus láminas estén construidas. Cuando la
    entrevista es online, arriba se guarda el enlace de la videollamada, que
    hasta ahora vivía en el calendario o en el chat donde se acordó. Al pie
    cierra la entrevista y la manda a Por analizar. No muestra nada de lo
    cargado: codificar es el trabajo de después, y en la sala sería ruido.
  - **Por analizar** son tarjetas y no una tabla: en esa etapa el trabajo es
    entrar a cada persona. Cada tarjeta entera lleva a su ficha y muestra la
    batería, hace cuánto espera (en rojo pasada la semana) y con qué cerró.
  - **Entregados** muestra lo que ya salió, de todas las evaluadoras, con la
    fecha, la conclusión con el nombre que lleva en el informe y el enlace para
    abrirlo.
  - **Seguimiento** es la etapa de los noventa días: si la persona entró a
    trabajar y cuándo toca preguntar cómo le fue. Tiene su sección desde el
    21/8/2026, porque el botón que lleva ahí existía desde antes y la etapa no
    tenía pantalla: apretarlo sacaba la evaluación de todas las listas sin
    forma de volver, y había tres personas atrapadas ahí.
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
    parseo es determinístico, por posiciones, sin modelo. De ahí salen sus 69
    datos y con ellos la hoja con el perfil, las cruces con su lectura de
    diagonal, la escala de alerta, el estado emocional, la autoimagen, lo que
    la persona escribió y los acontecimientos del último año. El cuadrante
    preferente lo elige la evaluadora en una cruz de cuatro botones.
    El archivo no se guarda: se leen sus datos y queda el nombre. El original
    está en la plataforma Benziger, y si hace falta releerlo se baja de ahí y se
    vuelve a subir. Una lectura incompleta o con las cuentas que no cierran se
    rechaza en el momento, con el detalle de qué no se encontró.
  - **Tests.** Bender y Gráfico 2 personas se muestran acá tal como quedaron en
    la entrevista, sin poder editarse: si se tomaron, lo que la evaluadora
    anotó, y el dibujo para abrirlo. Una observación de administración se
    escribe con la persona enfrente o no existe, y lo que se corrigiera semanas
    después entraría al informe con el mismo peso que lo observado. El Raven muestra el puntaje directo,
    el percentil y los desvíos, la escala completa de los cinco rangos con el
    de la persona marcado y el tramo de aciertos de cada uno, y qué quieren
    decir el percentil y los desvíos para quien no los usa todos los días.
    - El puntaje entra por dos caminos: lo escribe el test cuando la persona lo
      termina por su enlace, o lo carga la evaluadora cuando el Raven se tomó
      en papel. Cuál de los dos fue queda guardado en `raven.origen` y se
      muestra arriba del puntaje. Se guarda en vez de deducirse de si existe
      una sesión, porque se puede cargar a mano el puntaje de alguien que
      además rindió por su enlace: ahí la sesión existe y el número no salió de
      ella. Cuando pasan las dos cosas, la ficha las dice juntas, que es la
      única forma de ver que hay dos mediciones de la misma persona.
  - **Recomendación.** La conclusión y su fundamento, que se suben juntos con
    "Cargar": son una sola decisión y guardar a mitad de una frase dejaría media
    decisión en la base.
  - **Informe.** El botón que lo genera, las competencias cargadas y al pie el
    botón de entregar, que necesita la conclusión.
    - **El informe se arma solo** y se ve en la misma pestaña: la
      recomendación se elige ahí, apretando uno de los cuatro niveles con su
      color, y el semáforo del documento de abajo cambia sin recargar. Al lado
      se listan los tests de la batería con su punto verde o rojo, para ver si
      falta administrar algo antes de generarlo. Siete capítulos, con los cuatro niveles de ajuste y el que le tocó marcado, las
      seis competencias con su puntaje, el análisis repartido en destacadas,
      esperadas y a desarrollar, las recomendaciones al líder sin repetir, el
      gráfico del Benziger con sus cuatro ejes, las técnicas de su batería y la
      firma. Sale de `lib/redacciones.ts`, que es el diccionario del método
      aplicado sobre el sumario: la recomendación la escribe el instrumento y el
      motor la selecciona. El mismo documento se muestra en tres lugares con un
      solo molde (`informe/_doc/Documento.tsx`): la pestaña, su página aparte
      en el OS, y el portal del cliente. Lo interno (qué falta cargar y de
      dónde sale cada porcentaje) va apagado por defecto y solo se enciende en
      las dos primeras: una pantalla nueva que muestre el informe no filtra por
      olvido.
    - **El veredicto no se calcula.** El nivel de ajuste sale de la conclusión
      que cargó la psicóloga, y si falta, el informe lo dice arriba en un aviso
      que no se imprime, junto con todo lo demás que falte cargar.
    - **El resumen lo escribe la evaluadora o el motor.** Con el fundamento
      cargado, ese texto sale tal cual en el informe; vacío, lo arma el motor
      con las lecturas del sumario. El motor redacta correcto pero genérico, y
      quien tenga algo que decir del caso lo escribe y reemplaza al automático.
    - **Las competencias se puntúan como en las hojas de la psicóloga**: cada
      indicador vale 1, 2 o 3 según caiga bajo, medio o alto, se suman y una
      tabla convierte el total en porcentaje. Hay dos juegos, uno por Rorschach
      y otro por Zulliger, y la habilidad cognitiva entra por el Raven, que es
      el instrumento que la mide. Qué indicador alimenta cada competencia sale
      de las hojas; dónde corta cada uno entre bajo, medio y alto se decidió
      acá y está a la espera de que ella lo revise, para lo cual cada informe
      trae al pie el desglose de cómo se calculó.
    - **Subir al portal** es lo que antes se llamaba entregar: la evaluación
      pasa a Entregados, se sella la fecha y el cliente lo ve en su portal.
- *El ingreso.* Si la persona entró a trabajar, desde cuándo, y a los noventa
  días cómo le fue. Es lo que después permite calcular el acierto de cada
  evaluadora y modelar qué perfil funciona en cada familia de puesto.
- *Comercial.* Clientes, cotizaciones como embudo y costos por trabajo. El
  enlace del portal de cada cliente vive en su fila, con abrir y copiar: tenía
  su propia sección y era la misma lista con una columna sola.
- *Sistema.* Baterías con su precio, actualizable por cualquiera de las tres.
  Herramientas las lista todas, y desde el 20/8/2026 todas viven adentro del OS:
  las láminas de Rorschach y Zulliger se mudaron del hub, con sus imágenes en el
  bucket privado y servidas contra la sesión. Del Rorschach quedaron las 10 del
  test: la portada y la contraportada con el logo salieron, porque lo que se le
  muestra a la persona evaluada es la mancha. La pantalla es la misma de antes,
  lámina a lámina con puntero grande y pincel que se borra solo, y se abre
  también desde la hoja de la entrevista. Las direcciones viejas
  (`tools.camposhr.com/test-rorschach` y `/test-zulliger`) redirigen acá.

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
con la licencia. Esos totales sí se usan para controlar la lectura: el informe
trae tres cuentas hechas que tienen que cerrar, y si no cierran el archivo se
leyó mal.

**Lo que sigue.**

1. **Migrar los datos clínicos de Airtable.** Es lo que falta para que la ficha
   deje de estar vacía: `rorschach_respuestas`, `sumario_exner`, `benziger`,
   `raven`, `tests_cualitativos` e `informe_competencias` existen y hoy solo
   tienen los datos de prueba de Distribuidora Andina. Las tablas de origen son
   "Tests Proyectivos" (`tblhq78e1RSmvztC5`), "Benziger" (`tbl5Oi3FXtS5SPFoH`),
   "Tests cualitativos" (`tbls1lgzHFJ2T5KPY`) e "Informe" (`tblxBnYV7OZlscuxu`).
2. **Migrar las evaluaciones de Airtable**, que hoy el OS no muestra.
3. **Las láminas del Raven**, para que el test se pueda tomar de verdad, y las
   del Bender, que todavía no están: su botón en la hoja de la entrevista está
   puesto y apagado, esperándolas.
4. **La pantalla de acierto**, que cruza recomendación contra resultado a los
   noventa días, por evaluadora y por familia de puesto. Los datos ya se
   capturan y la sección Seguimiento ya los muestra por persona; falta el
   cruce, y marcar los que están vencidos.
5. **Los cortes de las competencias**, que los revise la psicóloga contra casos
   reales. Cada informe trae el desglose al pie, así que revisarlos es abrir un
   informe y leer de dónde salió cada porcentaje.
6. **El análisis discursivo**, que la batería 3 incluye y el OS no guarda: es el
   único capítulo del esqueleto que el informe todavía no puede armar, y el
   indicador de "Potencial" que le falta a la competencia de liderazgo.
7. **El alta de pedidos todavía escribe en Airtable** (`lib/airtable-alta.ts`
   desde `app/api/pedidos/route.ts`). Es la única escritura viva que queda.
8. **La batería no se puede cambiar desde la ficha del pedido.** `CAMPOS_PEDIDO`
   en `lib/pedido-campos.ts` no la incluye, así que hoy solo se fija al crear el
   pedido y cambiarla exige tocar la base a mano.
9. **El sumario puede quedar viejo sin avisar.** Si se corrige una codificación
   y no se recalcula, la pantalla muestra los números anteriores. Las
   respuestas guardan `created_at` pero no cuándo se editaron, así que hoy no se
   puede comparar contra `sumario_exner.actualizado_at`.
10. **Cuentas por psicóloga**, para que `accesos.quien` deje de ser un nombre
   elegido de un selector y lo clínico pueda mostrarse con registro real.

**Lo que hay que decidir.** El OS está desplegado **sin puerta**: `OS_CLAVE` no
está cargada en Vercel, así que quien conozca la dirección ve nombres, teléfonos
y correos de candidatos. Cargar esa variable lo cierra, sin tocar código.

**El portal del cliente lee de Supabase.** El enlace se resuelve primero contra
`empresas.token_portal` y después contra Airtable, que es donde siguen las
empresas sin migrar. Para las migradas el informe no es un archivo subido: se
arma con los datos cargados en `/p/<token>/evaluacion/<id>`, con el botón para
guardarlo en PDF. Antes de mostrarlo se controla que el enlace resuelva a una
empresa, que la evaluación sea de un pedido suyo y que esté entregada; si falla
cualquiera responde 404 sin decir cuál, porque decir "existe pero no es tuyo" ya
es información.

**Dónde vive cada cosa hoy.** Airtable: lo clínico y las evaluaciones sin migrar.
Supabase: el OS entero, el ciclo, el cuestionario, el test de Raven y las
láminas de Rorschach y Zulliger. Google: el
formulario viejo del Raven, que deja de hacer falta cuando estén las láminas, y
el calendario. El repositorio: la app y los entregables.
