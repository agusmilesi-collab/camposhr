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

## Estado del sistema al 19/8/2026

**Dónde vive el repositorio.** `~/Documents/camposhr-site`. Se mudó del Escritorio
el 19/8 porque macOS bloqueó el acceso a esa carpeta entera y el servidor de
desarrollo empezó a devolver 500 sin que hubiera un error de código.

**Lo que funciona sin intervención.** Las psicólogas trabajan en sus interfaces de
Airtable. El portal de clientes sirve los once informes de Laruso y los dos
documentos, contra token válido.

**Lo que se construyó el 19/8, en Campos OS.**

- *Reparto por arrastre.* "Sin asignar" es un tablero: una columna con lo que no
  tiene dueño y una por evaluadora, mostrando su carga abierta. La tarjeta se
  mueve al soltar, sin esperar al servidor. **"Sin asignar" pasó a significar
  todo lo que no tiene evaluadora**, esté en la etapa que esté; una ficha que
  quedó huérfana en Por citar aparece ahí y conserva su etapa.
- *Volver atrás.* Cada fila tiene una flecha que devuelve a la etapa anterior.
  Volver a "Sin asignar" también suelta la evaluadora, si no la ficha quedaría
  fuera de toda pantalla.
- *Ficha del candidato.* `/os/psicotecnicos/ficha/<id>`, se entra por el nombre
  desde cualquier etapa. Seis pestañas: Datos, Manchas, Sumario estructural,
  Benziger, Tests, Informe. La pestaña viaja en la dirección, así se comparte y
  se recarga.
- *Codificación Rorschach editable.* La grilla de Manchas, con los mismos campos,
  desplegables y colores que la tabla "Tests Proyectivos" de Airtable. Guarda en
  `rorschach_respuestas` celda por celda y valida contra las mismas listas.
- *Motor Exner adentro.* `lib/exner.ts` es el motor v7 traído sin tocarle el
  cálculo. El botón "Calcular sumario" corre `POST /api/os/sumario`, que lee la
  codificación y escribe `sumario_exner` con el JSON completo en `crudo`. El
  perfil (Rorschach o Zulliger) se deduce de las láminas, porque acá no existe
  el campo "Test aplicado" que usaba el wrapper de Airtable.
- *El OS dejó de escribir en Airtable*, y dejó de mostrar lo que vive allá. Ver
  la regla al principio de este archivo y `CLAUDE.md`.

**Lo que sigue.**

1. **Migrar los datos clínicos de Airtable.** Es lo que falta para que la ficha
   deje de estar vacía: `rorschach_respuestas`, `sumario_exner`, `benziger`,
   `raven`, `tests_cualitativos` e `informe_competencias` existen y tienen cero
   filas. Las tablas de origen en Airtable son "Tests Proyectivos", "Benziger",
   "Tests cualitativos" e "Informe".
2. **Migrar las evaluaciones de Airtable**, que hoy el OS no muestra.
3. **El alta de pedidos todavía escribe en Airtable** (`lib/airtable-alta.ts`,
   desde `app/api/pedidos/route.ts`). Es la única escritura viva que queda.
4. **Cuentas por psicóloga**, para que `accesos.quien` deje de ser un nombre
   elegido de un selector y lo clínico pueda mostrarse con registro real.
5. **Desplegar.** Nada del OS está commiteado ni en producción.

**Dónde vive cada cosa hoy.** Airtable: psicotécnicos, el motor y lo clínico.
Supabase: el OS entero, el ciclo y el cuestionario. Google: el formulario del
Raven y el calendario. El repositorio: la app y los entregables.

