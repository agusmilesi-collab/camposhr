# Organigrama · especificación

Herramienta interna de Campos HR para diseñar, validar y decidir la estructura de un cliente.
Entra como una tarjeta más del hub de `tools.camposhr.com`.

Este archivo alcanza para arrancar el desarrollo sin más contexto. Lo que dice sobre Airtable está
verificado contra la base real el 14/8/2026.

**El marco está en `SPECS-arquitectura.md`**, que define la identidad de cliente, las tres audiencias
y la capa de servicios donde esta herramienta encaja. Tres cosas de acá se decidieron allá y valen
como dadas: el cliente es un parámetro y nunca un dato en el código, las personas se unifican en una
tabla por cliente (lo que resuelve los casos de la sección 5), y la tabla `Líneas` de la sección 4 es
el camino elegido para las capas.

---

## 1. Qué es, y qué no es

**Es un validador con interfaz, no un diseñador automático.** El diseño sale del relevamiento, que
lo hace la consultora. Lo que la herramienta aporta es que ningún diseño incoherente se pueda
guardar, y que cada movimiento muestre su consecuencia en el momento.

Tres usos, en orden de valor:

1. **Validar** el modelo de un cliente contra las reglas del método.
2. **Conducir la reunión de decisiones** con el dueño, moviendo puestos y personas y viendo qué se
   rompe.
3. **Generar las figuras** que hoy se escriben a mano en cada entregable.

El tercero no es menor: los organigramas de Laruso están escritos a mano en tres documentos
distintos, y el 7/8/2026 hubo que corregir cinco contradicciones entre las figuras y el texto.

**No hace:** no recomienda a qué persona poner en qué puesto, no califica personas con un cartel, no
se le entrega al cliente para que la opere.

---

## 2. Dónde vive

- **Ruta:** `app/organigrama/` dentro de `camposhr-site`. No es un proyecto aparte.
- **Hub:** una tarjeta más en `public/index.html`, junto a Rorschach, Zulliger, Cuestionario,
  Informes, Cotizaciones y Presentaciones.
- **Host:** `tools.camposhr.com`. El `middleware.ts` ya rutea las tres zonas y ya contempla que en
  `localhost` convivan todas.
- **Desarrollo:** `npm run dev` y `localhost:3000/organigrama`. Laruso ya está cargado en Airtable,
  así que se desarrolla contra datos reales desde el primer minuto.

---

## 3. De dónde salen los datos

### Airtable es el modelo relevado. Se lee, no se escribe.

Base `appGhbo58t44fOIGe`. El token de lectura es `AIRTABLE_TOKEN` en `.env.local`. Los IDs de tabla
de `lib/airtable.ts` sirven para Empresas (`tblNKMu8gqYmoA70N`) e Individuo (`tbl6Ji4P7d6hOKNUY`);
las demás se piden por nombre, que la API acepta.

| Tabla | Campos que importan |
|---|---|
| `Roles` | Puesto · Accountability · Área · Estado del puesto · Depende de (OBJETIVO) · Candidato tentativo · Criticidad · Descripción del rol · Raven mínimo · Empresa |
| `Cadena de Valor` | Actividad / paso · Orden · Tipo · Área responsable · Sigue a · Parte de · Empresa |
| `Capacidades` | Capacidad · Estado hoy · ¿Instalada? · Actividad que sirve · Roles que la sostienen · Qué busca · Empresa |
| `Individuo` | Las personas, con su sumario y sus pruebas |
| `Fit` | Veredicto · Estado · Empleado · Rol · Justificación · Fit Raven · Fit Benziger · Recomendación |
| `Hallazgos` | Hallazgo · Tipo · Severidad · Puesto relacionado · Evidencia / fuente · Empresa |

**Todas cuelgan de Empresa.** Eso es lo que hace la herramienta multi cliente sin trabajo extra.

### Supabase es el trabajo en curso. Ahí se escribe.

Escenarios de reunión, movimientos y decisiones. Credenciales en `.env.local`
(`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).

**Regla dura: la herramienta no escribe en Airtable hasta que una decisión se apruebe
explícitamente.** Un arrastre de prueba en una reunión no puede pisar el relevamiento del cliente.
Cuando se apruebe, la escritura usa `AIRTABLE_TOKEN_ESCRITURA` y actualiza `Estado del puesto` y la
línea de dependencia, dejando registro de qué decisión la produjo.

---

## 4. Las cuatro capas

**El organigrama de un cliente no es uno. Son cuatro y conviven.** En Laruso está documentado:

| Capa | Qué es | Fuente |
|---|---|---|
| Declarado | Lo que dicen las descripciones de puesto del cliente | Las fichas |
| Dibujado | El organigrama que la empresa dibujó | El documento del cliente |
| Real | Quién conduce de verdad | Las entrevistas |
| Objetivo | El que proponemos | El diseño |

Las tres primeras dicen cosas distintas sobre la misma línea de mando, y **la diferencia entre capas
es el diagnóstico**. La herramienta tiene que poder superponer dos capas y listar en qué difieren.

**Hoy Airtable guarda una sola capa.** El campo se llama `Depende de (OBJETIVO)`, lo cual lo
confirma. Hay dos caminos y la decisión es de Agustín:

- **A.** Agregar campos hermanos (`Depende de (DECLARADO)`, `(DIBUJADO)`, `(REAL)`). Simple, rígido.
- **B.** Crear una tabla `Líneas` con empresa, puesto, depende de, capa y fuente. Admite capas
  nuevas sin tocar el esquema. **Es la recomendada.**

---

## 5. Modelo de datos: los casos que lo rompen

Ninguno es hipotético. Todos salen de Laruso o de MyF.

- **Una persona ocupa dos puestos.** Jairo es Jefe de Planta y Director Técnico ante SENASA. Mauro
  es dirección y comercial. La relación persona-puesto es de muchos a muchos.
- **Un puesto tiene cuatro ocupantes.** Responsable de Turno. Una caja, cuatro personas, y no son
  intercambiables porque cubren turnos distintos.
- **Una persona sin ningún puesto.** Darío, que es quien más ordena la empresa, figura como externo
  y declara que no existe ni existirá un puesto para él. Tiene que estar en el tablero sin caja.
- **Un puesto sin ocupante y sin ficha.** Responsable de Mantenimiento existe y no tiene
  descripción. Planificación todavía no existe.
- **Gente de afuera que hace trabajo de adentro.** Veinte fleteros en MyF, la ingeniera externa de
  las ISO en Laruso.
- **Reporte por materia.** Los turnos le reportan a Franco "para las certificaciones y carga y
  descarga", que es una línea funcional y no de mando. Si cada nodo admite un solo padre, ese dato
  desaparece.
- **Dos sedes.** Cañada Rosquín y Funes. El árbol cruza ubicaciones.
- **La instancia de arriba sin definir.** Las fichas nombran "Directorio" y "Gerente General" como
  dos cosas y ninguna tiene descripción propia. El nodo raíz puede ser incierto.
- **Alcance parcial.** En MyF el depósito y la administración quedan fuera del proyecto. Lo que está
  deliberadamente afuera no puede contarse como huérfano.
- **Conteos en disputa.** En Laruso la dotación de planta tiene tres versiones: la dirección declara
  trece operarios, el dibujo y el mapeo muestran cuatro, y Jairo cuenta dieciocho personas cuando el
  dibujo le da siete reportes directos. **Un entero solo no alcanza:** cada conteo se guarda con su
  fuente y se muestra en desacuerdo.

### Marcas de honestidad

Cada dato viaja con su marca y la pantalla la muestra: ✅ confirmado, 🔵 inferido o de referencia,
❓ falta el dato. En Laruso las Capacidades y el cuello de botella están cargados como referencia de
rubro y no como relevamiento. En MyF casi todo va a estar en 🔵 porque habló una sola voz interesada.
Dibujar sin la marca convierte una declaración en verdad.

---

## 6. Las reglas que el sistema verifica

**Mecanizables:**

1. Toda actividad de la cadena de valor tiene un responsable.
2. Ningún resultado responde a más de un puesto.
3. Todo puesto declara un resultado único y medible (`Accountability` no vacío).
4. Quien controla no depende de quien produce. Calidad no cuelga de Operaciones.
5. Un puesto cuelga de quien necesita su resultado.
6. Ninguna persona queda por encima de su carga semanal.
7. Ningún puesto queda sin ocupante ni cobertura declarada.
8. Ninguna tarea queda sin puesto al reordenar.

**No mecanizable sin criterio humano:** si dos capacidades piden perfiles opuestos (regla 1 del
agrupamiento). Hay una vía a explorar: si el perfil esperado de cada puesto se expresa en cuadrantes
de Benziger, dos capacidades cuyos cuadrantes son diagonales no pueden convivir en un puesto. **Es
una hipótesis a validar con las psicólogas antes de codificarla.**

### Tareas y carga

Las tareas ya están escritas: son las de las descripciones de puesto del cliente. Las ocho fichas de
Laruso listan entre once y dieciséis cada una. El trabajo es vincular cada tarea a una capacidad, y
ahí el diagnóstico cae solo, porque un puesto cuyas tareas tocan cinco capacidades está mezclado.

**La carga se mide en puntos, no en horas.** Cada persona reparte cien puntos entre sus tareas.
Pedir horas devuelve números inventados que el sistema después trata como dato duro.

---

## 7. Los diez movimientos

Toda decisión cambia el puesto o cambia la persona que lo ocupa, y cada lado tiene cinco movimientos
que lo agotan.

| Sobre el puesto | Sobre la persona |
|---|---|
| Crear | Confirmar |
| Redefinir | Desarrollar |
| Recolgar de otra línea | Reubicar |
| Eliminar | Incorporar de afuera |
| Tercerizar o internalizar | Desvincular |

**Partir y fusionar no son movimientos nuevos.** Partir es redefinir más crear con transferencia de
resultados; fusionar es eliminar más redefinir con transferencia. Conviene ofrecerlos como atajo
porque son los dos más frecuentes.

### Las cuatro reglas de los movimientos

1. **Una decisión agrupa varios movimientos y se aprueba entera.** La decisión de Calidad en Laruso
   son tres: crear el puesto, colgarlo de dirección y reubicar a Franco. Registrar movimientos
   sueltos pierde la unidad sobre la que el dueño dice sí o no.
2. **Un movimiento puede estar bloqueado por otro.** Primero se corrige el puesto de Ismael, y
   recién a los noventa días se decide sobre la persona. La vía de la persona se muestra apagada
   hasta que la del puesto se ejecute.
3. **Un movimiento puede estar bloqueado por falta de dato, y el sistema dice cuál falta.** Sobre
   los cuatro responsables de turno no hay decisión legítima hasta que estén evaluados. Aparece como
   "no decidible" con el dato faltante escrito, y no como una opción más.
4. **Todo movimiento de puesto exige destino para los resultados que quedaban ahí.** Es lo que evita
   que eliminar, partir o acotar dejen algo huérfano.

Cada decisión aprobada sale con responsable y fecha.

---

## 8. Caso de prueba: Laruso completo

Si la herramienta reproduce este cuadro, funciona.

| Caso | Vía del puesto | Vía de la persona | Estado |
|---|---|---|---|
| Ismael · Comercial | Redefinir (sacarle logística, programación, stock y facturación) | Confirmar, desarrollar o desvincular | Persona **bloqueada** hasta 90 días después de acotado el puesto |
| Jairo · Jefe de Planta | Redefinir y crear Jefe de Turnos | Desarrollar o reubicar a un puesto técnico | **Bloqueada por falta de dato**: evaluar a los cuatro responsables de turno |
| Franco · Técnico y Logística | Partir: Calidad sube a dirección, la logística queda en Operaciones | Reubicar a Calidad | **Habilitada.** Único puesto con candidato evaluado |
| Los cuatro responsables de turno | Sin cambio | Ninguna | **No decidible.** Sin ningún dato |
| Jefe de Turnos | Crear | Incorporar o promover a uno de los cuatro | Depende de la evaluación |
| Planificación | Crear | Incorporar de afuera, con Leandro como desarrollo posible | Habilitada, necesita búsqueda |
| Darío | Crear el puesto que no existe e internalizar el vínculo | Confirmar | Depende de una conversación pendiente. Va primera en el calendario |
| Natalia · Administración y Finanzas | Sin cambio | Desarrollar sucesor o incorporar | **Habilitada y urgente.** Se retira, sin reemplazo |
| Valeria · Administración de planta | Redefinir: definir si el puesto es el de planta o el de Funes | Confirmar con más carga contable, o desvincular | **Bloqueada** por puesto ambiguo |
| Guillermo | Sin cambio | Confirmar | Cerrada |
| Antonella · Compras y Admisión | Redefinir: responsable única de la verificación documental | Confirmar | Habilitada, con **conflicto de carga**: declara la semana llena |
| Gerencia de Operaciones | Eliminar, con la rendición de cuentas transferida a Jefatura de Planta | No aplica | Ejecutada |
| Responsable de Mantenimiento | Ninguno: falta la ficha | Sin cambio | **No decidible** |
| Valentina y Leandro · Funes | Crear las dos fichas pendientes | Sin cambio | Trabajo en curso del cliente |
| Administración partida | Recolgar: la de planta se unifica bajo Finanzas | Sin cambio | Habilitada |
| Mauro · Dirección | Redefinir: soltar lo comercial y la gestión del cliente | Desarrollar | Depende de que exista a quién soltarle |

---

## 9. Interfaz

### El tablero, siempre a la vista

Tres números que cambian con cada movimiento:

- Resultados sin dueño
- Resultados con más de un dueño
- Personas por encima de su carga

### Dos modos, y no es opcional

- **Modo estructura:** puestos y capacidades, sin un solo nombre. Es el que se proyecta cuando hay
  más de una persona en la sala.
- **Modo personas:** con las tarjetas. Se abre solo con el dueño.

En la reunión de Laruso hay cuatro personas sentadas y una de ellas es sujeto de una decisión.

### Navegación

- **Zoom y encuadre.** Los organigramas llegan a cien nodos.
- **Colapsar cualquier nodo.** Al colapsar, el nodo muestra el conteo ("Operarios (13)") y **las
  alertas del subárbol no se apagan**. Si plegar una rama esconde sus errores, la herramienta miente.
- **Vistas guardadas.** El zoom y el estado de plegado se guardan. A la reunión se llega con la vista
  armada.
- **Modo presentación:** pantalla completa, sin interfaz de edición.

### Para la reunión

- **Escenarios.** Se abre escenario A y escenario B, se comparan, y uno queda como objetivo. El
  modelo relevado no se pisa nunca.
- **Deshacer inmediato.** Vas a mover algo mal delante del cliente.
- **Al soltar una tarjeta, el sistema pregunta si eso es una decisión.** Si lo es, exige responsable
  y fecha.
- **Exportar la vista** como imagen o HTML, para que entre en el entregable.

### El encaje al arrastrar una persona

La fórmula de las seis dimensiones ya existe y está publicada en `fichas-de-talento.html`. El perfil
esperado por puesto está en `Roles` y el veredicto en `Fit`.

**No se muestra como veredicto.** Nada de un cartel rojo sobre el nombre de alguien. Se muestra la
brecha y qué se hace con ella.

---

## 10. Reglas duras

- **El sistema marca incoherencias, nunca recomienda personas.** Puede decir que un resultado quedó
  sin dueño. No puede decir a quién poner. Esa frontera protege el criterio de la consultora.
- **El cliente mira, la consultora mueve.** La estructura se diseña para el dueño, no con el equipo.
- **El cliente es un parámetro, nunca un dato escrito en el código.** Ni "Laruso" ni
  `recW8hxy0qYGOEOt3` en ningún archivo de la herramienta. Es la R6 del método aplicada al software.
- **Familia y sociedad no se dibujan.** Cuatro socios de una familia en MyF, matrimonio en Laruso.
  La tarjeta puede llevar una nota de restricción, y nada más.
- **Sin datos, la herramienta lo dice.** Un modelo incompleto se muestra incompleto, no roto. MyF va
  a entrar con veinte personas sin ubicar.

---

## 11. Por dónde empezar

1. **Vista de solo lectura**, con el árbol generado desde Airtable, las marcas de honestidad y los
   tres contadores. Sin arrastrar nada. Si esa pantalla sola cambia la reunión, el resto se
   justifica.
2. **Validador**: la lista de violaciones de las ocho reglas, con el puesto y la evidencia.
3. **Capa de personas** con el encaje calculado, y la exportación de la figura al entregable.
4. **Editor** con arrastrar y soltar, escenarios en Supabase y decisiones con responsable y fecha.
5. **Escritura de vuelta a Airtable**, solo al aprobar.

Lo que no va, o va último: leer un organigrama desde una imagen. Un dibujo tiene cajas y líneas, y no
tiene de qué responde cada puesto ni qué capacidades agrupa. Los tres errores de método que se
encontraron en Laruso son invisibles en una imagen.

---

## 12. Contexto que conviene leer antes de arrancar

- `Campos HR/CLAUDE.md`: las reglas del método, en particular R2 (marcas de honestidad), R4 (cuidado
  con la evaluación de personas) y R6 (agnóstico del caso).
- `Campos HR/clients/laruso/EMPEZAR-POR-ACA.md`: el estado del caso y el aviso de qué datos de
  Airtable son de referencia y no relevados.
- `Campos HR/clients/laruso/outputs/Propuesta de servicios.html`: los dos organigramas, el declarado
  y el objetivo, tal como se le muestran hoy al cliente.
- `camposhr-site/lib/airtable.ts`: el patrón de lectura y de tabicado por empresa.
