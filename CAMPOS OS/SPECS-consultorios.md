# Consultorios

El alquiler de las salas del Centro Integral Santiago (Santiago 1269, Rosario),
con su calendario, su cuenta corriente y, más adelante, la agenda de turnos de
cada inquilino.

Es la segunda pantalla del grupo Sentir Mindfulness del OS, al lado de
Encuentros.

---

## Qué resuelve

Hoy la disponibilidad se pregunta por WhatsApp: si el consultorio 2 está libre
el 18/9 de 17 a 20. Cada respuesta obliga a alguien a mirar una grilla y a
contestar, y dos consultas al mismo tiempo se pisan. El sistema muestra qué hay
libre, con su precio, y deja reservar.

De paso resuelve dos cosas que hoy se llevan a mano: quién debe cuánto este mes,
y qué horas quedaron sin vender.

---

## Dos lados, un repositorio

**Administración**, adentro del OS: `/os/consultorios`, en cuatro pestañas:
**Calendario**, **Inquilinos**, **Finanzas** y **Espacios**. Fueron seis hasta el 8/9/2026, y
tres eran la misma lista dos veces: las cuentas aparte de los inquilinos
obligaban a buscar un teléfono en la otra pantalla para reclamar un pago, y los
precios aparte de los espacios a cruzar de memoria por qué una sala cuesta más.
Los cierres tampoco son una pestaña: se ponen sobre el calendario, que es donde
se ve la fecha. Acá adentro se hace el
trabajo entero, y mandar la mitad a otra dirección obligaba a salir y volver.

**Una reserva se puede repetir.** En la burbuja se elige cada semana o todos
los días, y hasta cuándo, que arranca en el fin del mes de la fecha elegida. Es
lo que hoy se carga a mano semana por semana: "los martes de 17 a 20, todo el
mes". El precio muestra el total de todas las fechas antes de confirmar.

**Una fecha ocupada no cancela las demás.** Se guardan las que entran y se avisa
cuáles quedaron afuera con su día. Abortando todo por una, había que ir sacando
fechas a mano hasta dar con la que chocaba. Vale también para los cierres, que
es como se carga un taller que se repite.

**Sobre la grilla se trabaja.** Se aprieta en la hora de inicio y se estira
hasta la de fin, como en un calendario; el arrastre corta solo contra lo
ocupado y contra los cierres. Tocar una hora libre la reserva o la cierra, y
tocar una ocupada la libera. Con el dedo no se arrastra, porque capturar el
gesto sobre la grilla mata el desplazamiento de la página: ahí el toque abre el
panel y la hora de fin se elige en el selector. Ahí adentro se puede cargar a alguien que no usa el
sistema: queda con su cuenta corriente y se le reserva igual, que es el caso de
quien alquila y no va a entrar nunca.

**Cada inquilino tiene su color**, y la hora suelta lleva además una trama
diagonal para distinguirse de la banda fija. Con un solo azul para todos, una
fila de la grilla era una franja continua y había que leer los nombres para
saber dónde terminaba una persona y empezaba otra.

El tono se asigna **por orden de alta**, de una lista de catorce escritos a
mano (`tonosPorInquilino`). No por un hash del identificador: reparte bien en
abstracto y en concreto choca: con trece personas cargadas, dos que tienen
nombres parecidos salieron del mismo verde, que es justo el par que hay que
poder distinguir. Por
orden de alta no se repite ninguno mientras quepan, y quien ya está nunca cambia
de color: el que entra toma el siguiente. Tampoco es una columna que se elija al
dar de alta, porque nadie va a entrar a una ficha a decidir de qué color quiere
ver sus horas. Los tonos están escritos y no repartidos por la rueda entera: los
amarillos y los verde lima quedan ilegibles sobre el fondo claro, y dos tonos a
veinte grados se ven iguales en dos celdas que no están al lado.

**El calendario abre en el mes.** La primera pregunta al entrar no es qué pasa
el jueves: es cómo viene el mes. La semana manda solo cuando su fecha viene en
la dirección.

**Y se puede mirar una sala sola**, mes por mes, que es como lo piden Lorena y
Lucila. La sala elegida viaja en la dirección (`?sala=`), así cambiar de mes no
devuelve a la vista de todas, y la ocupación de arriba sigue el mismo recorte
para que el número y la grilla hablen de lo mismo. **Con una sala elegida no se
ofrece la vista semanal**: una columna por día no es un calendario, es una
lista, y para el detalle de un día están las salas juntas.

**La semana muestra las cinco salas juntas.** La pregunta que se contesta en
esa pantalla casi nunca es cómo viene una sala: es qué hay libre el jueves a las
17. Con una pestaña por consultorio, esa comparación queda en la memoria de
quien mira.

### Finanzas

Cuatro preguntas en ese orden: **cuánto quedó** este mes, **cómo viene el año**,
**quién sostiene el negocio** y **qué horas están vacías**. Las dos primeras son
la cuenta; las dos últimas son con qué decidir.

**Los costos se cargan acá y no en Costos.** Esa pantalla es la del estudio
(psicotécnicos y servicios de Campos HR); el Centro es otro negocio, con otro
resultado. Viven en `gastos` (`supabase/consultorios-gastos.sql`), con **el
período además de la fecha**, como en `movimientos`: la factura de luz llega el
5 y corresponde al mes anterior. El rubro es una lista cerrada, porque con el
rubro escrito a mano "Luz", "luz" y "Electricidad" son tres rubros distintos y
el resumen del año deja de poder agruparse.

**El año va en dos barras por mes, al lado y no apiladas.** Apiladas, el costo
se lee como una parte del ingreso y el resultado hay que restarlo con la vista,
que es justo el número que se mira. Lo que quedó va escrito debajo del nombre
del mes.

**La ocupación se mide contra lo abierto**, no contra el día entero: una sala
que abre de 8 a 21 tiene trece horas para vender, y contra veinticuatro ninguna
llegaría al 60 %. Los cierres se descuentan de lo abierto, porque una sala
cerrada por refacción no es una hora que no se pudo vender: es una hora que no
existió. `medirOcupacion` deja los cuatro cortes de un solo recorrido (hora,
día, sala y la cruza de día por hora).

**El mapa de calor va apaisado**, con los días en filas y las horas en
columnas. Al revés, con trece horas apiladas, salía más alto que ancho y había
que recorrerlo de arriba abajo; así se ve la semana entera de un golpe, que es
como se piensa "los martes a la mañana".

**El mapa es lo que contesta la pregunta sin que nadie la formule.** Con dos listas ordenadas (las tres más ocupadas y las tres menos) se
sabe el ranking pero no el dibujo: que los jueves a las diez estén llenos y los
viernes a las diez vacíos no aparece en ningún ranking de horas.

**Y el ranking de inquilinos lleva su barra de participación**: tres personas
que suman la mitad del mes es un riesgo que en una columna de números no se ve.

### La pantalla de una persona

**La pestaña Inquilinos es una lista, y cada persona tiene su pantalla**, en
`/os/consultorios/inquilino/<id>`. Hasta el 8/9/2026 tocar una fila abría un
panel debajo de la tabla: para mirar a alguien había que perder de vista a los
demás, la dirección no decía a quién se estaba mirando (así que no se podía
compartir ni volver con el botón del navegador), y su historia no entraba en
ningún lado. De la lista se llega con el botón de la fila y no tocando la fila
entera: seleccionar un teléfono para copiarlo abría la ficha.

La pantalla contesta cuatro preguntas en ese orden: **quién es** (sus datos, su
matrícula, su acceso al sistema), **qué alquila** (los contratos vigentes, día
por día, con sus horas), su **histórico** (los últimos doce meses) y **qué
debe** (el resumen del mes que se elija, con el cobro).

**El histórico es un solo cuadro con las dos series**: barras para las horas
usadas y línea con puntos para lo facturado. Cada una con su escala, porque son
horas y pesos, y los máximos escritos en la referencia hacen de eje. Lo que se
compara es la forma de las dos curvas: un mes con muchas horas y poca plata es
alguien que pasó a un tramo más barato. En dos gráficos al lado había que
recordar la altura de una barra para compararla con la de al lado. La línea
pasa también por los meses en cero: salteándolos unía dos meses lejanos como si
en el medio hubiera trabajo.

**Los doce meses se cuentan hacia atrás desde hoy y no desde el mes que se está
mirando.** La historia es una sola: moverse a un mes viejo para revisar un pago
no puede correr el gráfico de lugar.

**El resumen muestra cada hora con su precio.** Un renglón por reserva: qué
día, en qué sala, de qué hora a qué hora, cuántas horas y a cuánto la hora.
Listaba el importe y nada más, y quien lo recibía veía "$ 5.985" sin poder
rehacer la cuenta. Las horas van en una tabla y los pagos en otra: mezclados,
un pago quedaba entre dos reservas y no se veía cuánto se usó ni cuánto se
cobró por eso. Y en orden cronológico, del principio del mes al final, que es
como se lee un extracto; en la pantalla la cuenta va al revés, porque ahí se
busca lo último que pasó.

**El resumen trae los tres plazos con la cuenta hecha**: lo que se paga hasta
el 10, del 11 al 20 con el 15 % y del 21 en adelante con el 25 %. La regla sola
obliga a quien lo recibe a sacar el porcentaje de su propio saldo, y el que
quiere pagar necesita el número, no la fórmula. Solo sale si hay saldo a pagar.

**Un movimiento se borra en dos pasos.** El botón pide confirmación en el
lugar: un pago borrado de un clic es plata que desaparece de la cuenta de
alguien sin que nadie lo haya decidido dos veces, y el movimiento no se puede
deshacer.

**Cada pago tiene su recibo**, con el membrete del Centro: de quién se recibió,
cuánto, en concepto de qué mes, cómo pagó, cuándo y quién lo recibió, más el
renglón de la firma. Se pide desde la fila del pago y no de a uno por mes,
porque en un mes puede haber dos. Lleva escrito que es un **comprobante interno
sin validez fiscal**: hoy nadie factura el alquiler de las salas, y un papel que
parece una factura sin serlo le crea un problema al que lo recibe y al que lo
firma. El número es el principio del identificador del movimiento, que sirve
para encontrar el pago en el sistema; no es una numeración correlativa, que es
lo que exigiría un comprobante fiscal.

**Lo firma quien cobró.** El trazo es el mismo que va en los informes de
psicotécnicos (`firmas/lorena-campos.png` en el bucket privado, leído con
`firmaEnDatos`), y entra como `data:` porque el recibo se guarda como PDF: una
dirección firmada que vence en una hora dejaría el papel sin firma al día
siguiente. Quien no tenga trazo cargado deja la línea para firmar a mano.

**El resumen se imprime desde la misma pantalla.** Es lo que se le manda cuando
pregunta cuánto debe: los movimientos del mes, las horas usadas, lo que pagó y
el saldo, más el saldo de todos los meses si arrastra deuda. La hoja se dibuja
siempre y aparece recién al imprimir (`os-papel-cuenta`, con
`body[data-imprimir='cuenta']`), como el informe de psicotécnicos: así lo que
sale en el PDF es la misma cuenta que está en la pantalla y no una segunda
versión que se separa en la primera corrección. Va `position: fixed` fuera de
la vista y no `display: none`, porque un bloque sin dibujar no se mide, y no
`absolute` porque una hoja de dos carillas colgada del documento le estira el
alto a la pantalla.

**Y las dos hojas se cuelgan del `body` con un portal.** La regla que esconde
todo lo demás alcanza a los hijos directos del `body`
(`body[data-imprimir] > *:not(...)`), así que una hoja dibujada dentro del árbol
de la pantalla se iba con el contenedor que la contenía y el PDF salía en
blanco. Es lo mismo que hace el diagrama de potencial.

**Del lado del inquilino, el mes entero en semanas apiladas.** Hasta el
8/9/2026 la pantalla tenía arriba una tira de días que se corría con el pulgar y
debajo la grilla de ese día: para encontrar un hueco el jueves 24 había que
tocar día por día hasta llegar, y comparar dos fechas era imposible porque nunca
estaban las dos a la vista. Ahora las cuatro semanas van una debajo de la otra,
cada una con los días en columnas y las horas en filas, como el calendario del
OS. Veintiocho días en un solo eje horizontal no entran en un teléfono; de a
seis columnas sí, y el mes se recorre hacia abajo, que es el gesto natural. La
primera semana arranca con las columnas de los días que ya pasaron vacías, para
que cada día caiga bajo su nombre.

**Y se puede mirar una sala o todas juntas.** "Todas" es la vista de entrada,
porque la pregunta de quien busca un hueco casi nunca es "¿está libre el 2?":
es "¿tenés algo el jueves a las tres?". Ahí la celda dice **cuántas salas quedan
libres** a esa hora y la sala se elige al reservar, en el panel, que es el único
momento en que hay que decidirla. Con una sala elegida el número desaparece,
porque siempre sería uno.

**Y la reserva se arma en una burbuja colgada de la celda**, no en un panel
arriba de la grilla. Con el mes entero en pantalla ese panel podía quedar a dos
pantallas de la hora elegida y había que subir a buscarlo. El anclaje y el
cierre al tocar afuera viven en `lib/burbuja.ts`, compartidos con el calendario
del OS: el mecanismo es el mismo y lo que cambia es el marcado, porque cada zona
tiene su hoja de estilo y su contenedor.

**Lo no disponible va en gris marcado**, y lo cerrado además rayado. Es la
decisión contraria a la del calendario de las psicólogas: ahí lo ocupado es el
dato y por eso se pinta; acá lo que se busca es el blanco, así que lo ocupado
tiene que pesar o el mes se lee como una plancha vacía.

**La zona del inquilino tiene barra lateral**, con Reservar y Mi cuenta: son las
dos cosas que se vienen a hacer y con la barra arriba la cuenta era un enlace
chico al lado del nombre. En el teléfono vuelve a ser una fila arriba, porque
una columna fija de doscientos píxeles sobre trescientos sesenta se come el
calendario.

**Y la cuenta muestra el mismo detalle que el resumen que bajan las
propietarias**, leído en pantalla en vez de descargado: una fila por hora usada
con el día, la sala, el horario, cuántas horas y a cuánto la hora, el cierre con
horas, pagos y saldo, y los tres plazos con el recargo ya calculado. Un renglón
que dice "$ 13.220" y nada más obliga a preguntar de dónde salió, que es
justamente el WhatsApp que este sistema viene a sacar.

**Una hora soltada fuera de plazo queda marcada en la cuenta.** El cargo no se
borra (la hora se paga, como dice la norma), así que en la cuenta aparece una
hora que ya no está en el calendario: sin la aclaración se lee como un error del
sistema. Al liberar sin crédito, la ruta le anexa al detalle del cargo "se
liberó fuera de plazo, se cobra igual", y la pantalla lo muestra al lado de la
sala y lo explica al pie. Por eso sala y horario se leen del **principio** del
detalle y no de toda la cadena: exigiendo que termine en la hora, ese renglón
salía sin sala ni horario.

**Inquilinos**, zona nueva en `centro.camposhr.com`, con su propia hoja de
estilo y pensada para el teléfono: se abre parado en la sala de espera para ver
si el 2 está libre el jueves. Entran con correo y contraseña y no ven nada del
OS. De las reservas ajenas sale solo que la hora está tomada; el nombre de quien
alquila la sala de al lado no llega al navegador. El ruteo por host ya existe en `middleware.ts`,
así que es un bloque más, y el subdominio se apunta al mismo proyecto de Vercel.

Todo se gestiona desde `camposhr.com`. El día que se compre
`centrointegralsantiago.com` se apunta encima del mismo bloque y no cambia nada
del sistema: la zona se identifica por host y acepta más de uno.

---

## Las reglas del Centro las hace cumplir el sistema

Salen del documento de convivencia (última versión, marzo de 2024) y dejan de
depender de que alguien las recuerde.

**Sin legajo no se reserva.** Matrícula profesional y DNI antes de empezar a
usar el Centro. Mientras falte, el inquilino ve el calendario y no puede
confirmar (`legajoAlDia` en `lib/centro-sesion.ts`). Los archivos van a un
bucket privado de Supabase, nunca al repositorio.

**Alcanza con la matrícula cargada.** Hasta el 8/9/2026 se pedía además que
estuviera vigente, y el campo de vencimiento se sacó de la ficha porque nadie lo
llevaba: exigir un dato que no se carga habría dejado a todo el mundo sin poder
reservar desde su pantalla. La columna `matricula_vence` sigue en la base con lo
que se haya cargado.

**Se paga por hora reservada, siempre.** Si el paciente no vino, la hora se
cobra igual. Vale para consultorios y SUM.

**El pago es del 1 al 10 del mes que se reserva.** Del 11 al 20 lleva 15% de
recargo y del 21 en adelante, 25%. El sistema emite el cargo el día 1 y muestra
el importe al día, con el aviso de cuánto pasa a costar después del 10.

**Los valores se actualizan cuatro veces al año**, en enero, abril, julio y
octubre, según inflación. La actualización se hace por porcentaje: se escribe el
aumento, el sistema arma la escala siguiente con todos los valores aplicados y su
fecha de vigencia, y queda para revisar antes de confirmarla. Cada reserva
congela el importe que le tocó, así una actualización no toca lo ya cobrado.

**Solo se usa la sala reservada y en el horario reservado.** El calendario es la
constancia de qué hora es de quién.

**No se cede ni se subalquila.** El titular de una reserva es siempre el
profesional, y el sistema no deja reservar a nombre de otro.

**Las normas se aceptan en el sistema.** Al entrar por primera vez, y otra vez
cada vez que el documento se actualice. Queda registrado quién aceptó qué
versión y cuándo, en lugar de una firma en papel de 2024.

---

## Los espacios y su precio

Cinco espacios: los consultorios 1, 2, 3 y 4, y el SUM. El 4 se sumó el
8/9/2026 en la categoría A, la de los consultorios 1 y 3.

**Qué días abre se tilda, sala por sala o para todas.** Son seis píldoras con
la inicial del día: la semana entera se ve de un vistazo y se toca la que hay
que mover. Antes era un texto ("Lun a Sáb") que decía cómo estaba y no dejaba
cambiarlo. Un día que se saca **borra su fila de `apertura`** y no la deja con
horario cero: la grilla lee "no hay apertura ese día" como cerrado, y una fila
con desde igual a hasta pasaría por abierta con cero horas. Y cambiar la hora
sin tocar los días conserva los que la sala ya tenía: mover el cierre a las 21
no puede reabrir un sábado que estaba cerrado.

**La pestaña es una tabla de comparación y se edita donde se lee**: las salas en
columnas y lo que las distingue en filas (horario, equipamiento, la escala
entera tramo por tramo y si está en alquiler). La pregunta de esa pantalla es en
qué se diferencian, y con una ficha por sala había que recordar el precio de la
primera para compararlo con el de la cuarta.

**Cada sala tiene su escala.** Hasta el 8/9/2026 el precio venía de una
categoría compartida, que ahorraba repetir seis números pero convertía la tabla
en algo que no se podía editar donde se lee: tocar el precio del consultorio 1
cambiaba también el del 3 sin decirlo. Dos salas que valen lo mismo tienen los
mismos números, y el aumento por porcentaje sigue alcanzándolas a todas de una
vez, que era lo único que la categoría ahorraba de verdad.

**Un valor editado a mano cambia la escala vigente**, así que rige desde la
próxima reserva; las ya hechas conservan el importe que congelaron. El aumento
por porcentaje sigue creando una escala nueva con su fecha.

**El horario se edita por sala o para todas.** Los cinco días van iguales: el
Centro no abre distinto un martes que un jueves, y el día que pase se agrega el
día como tercer dato en vez de multiplicar la tabla por cinco desde ahora.

**El precio es por tramo de horas semanales.** Los tramos son 1, 4, 8, 12, 16 y
20 horas por semana, y el precio por hora baja a medida que sube el tramo. Los
consultorios 1, 3 y 4 tienen hoy los mismos números; el 2 sale más caro.

**El SUM tiene una tarifa por hora única**, sin escala por volumen: se usa para
talleres y encuentros sueltos y no se contrata por bandas semanales.

**Los importes no viven en el repositorio.** La escala vigente se carga en
`tarifas`, con su fecha de vigencia, y se edita desde Configuración. El
repositorio guarda cómo se calcula, no cuánto sale.

### Cómo se aplica la escala

**El tramo se calcula por consultorio.** Ocho horas en el 1 y cuatro en el 2 son
un tramo de 8 en el primero y uno de 4 en el segundo.

**Las horas intermedias van al escalón inmediato inferior.** El descuento se
gana al completar la franja: con diez horas por semana se paga el precio del
renglón de ocho, y recién a las doce se pasa al siguiente. Se evaluó la regla
contraria (cobrar el precio del renglón al que se apunta, o sea diez horas al
precio de doce) y se descartó el 8/9/2026: baja lo facturado entre un 7 % y un
36 % según el tramo, y en el escalón más alto de la escala actual, que está
invertido, empezaría a encarecer desde las diecisiete horas en vez de desde las
veinte.

**Y por eso cada tramo se nombra con su rango**, en las dos tablas de Espacios y
en la burbuja del calendario: "8 a 11 horas" y no "8 hs por semana". El segundo
no dice qué paga quien tiene diez, que es exactamente la pregunta, y obliga a
saber la regla de antemano.

Encima corre una regla más: el sistema cobra el menor importe entre el tramo que
le toca y el tramo siguiente completo, y lo avisa. Con la escala actual hay dos puntos donde
contratar el escalón de arriba sale más barato que quedarse abajo, y en el resto
de los cortes la hora que falta para el escalón siguiente cuesta una fracción de
lo que cuesta una hora suelta. Ese aviso en la pantalla de contrato es lo que
hace crecer las horas vendidas, y evita que un inquilino se entere después de
que podía pagar menos.

**Una hora suelta se cobra al tramo de quien la toma.** El tramo sale del total
de horas que esa persona tiene contratadas, sea en la sala que sea, y la columna
sale del consultorio que usa. Quien ya alquila paga menos que quien viene por
una hora.

---

## Contratos, reservas y disponibilidad

Conviven las bandas fijas mensuales y las horas sueltas.

**Un contrato es una banda semanal**: inquilino, sala, día de semana, horario y
desde cuándo rige. Al abrirse un mes, cada contrato genera las reservas
concretas de ese mes.

**El calendario lee siempre de `reservas`.** Una banda fija y una hora suelta son
la misma fila, así no hay dos calendarios que puedan contradecirse, y soltar un
martes puntual no toca el contrato.

**El solapamiento lo impide la base**, con una restricción de exclusión sobre
sala y rango horario. Dos personas que confirman el mismo horario en el mismo
segundo: la segunda recibe un rechazo de Postgres. Una consulta previa de "está
libre" no alcanza, porque entre la consulta y el guardado entra la otra reserva.

**La disponibilidad no se guarda en ninguna columna.** Es la apertura del Centro,
menos los cierres, menos lo reservado. Por eso no puede quedar desactualizada.

**El Centro abre de lunes a sábado**, los cinco espacios igual. El horario se
edita desde Espacios, para todas las salas de una o para una sola, y los días
van todos con el mismo horario: el Centro no abre distinto un martes que un
jueves, y el día que eso pase se agrega el día como tercer dato en vez de
multiplicar la tabla desde ahora.
El total de horas que abre es el denominador de la ocupación.

**Los cierres son de las propietarias**: feriados, mantenimiento, y las horas que
el propio Sentir usa para sus talleres.

---

## La renovación del mes

Los que ya alquilan tienen prioridad sobre el mes siguiente.

El mes se abre en dos tiempos. **Del 20 al 25 solo se confirman las bandas de
los contratos vigentes**, sala por sala y horario por horario. **Desde el 26**,
lo que quedó suelto se abre a todos. La ventana cierra antes de fin de mes
porque el día 1 se emite el cargo y tiene que estar cerrado qué se cobra.

**El silencio renueva.** Un contrato que no se toca antes del 25 sigue vigente.
La relación es de continuidad y la mayoría sigue mes a mes: soltar por olvido le
saca la banda a alguien que la quería y deja la hora sin vender. Quien no
sigue, lo dice. El sistema avisa el 20 y el 24, y hasta el 25 se puede soltar
sin cargo.

En el OS, la pantalla de renovación lista contrato por contrato con confirmar o
soltar, y muestra qué queda liberado para vender.

---

## La cuenta corriente

`movimientos` guarda cargos, pagos, recargos, créditos y ajustes. El saldo es la
suma.

**El cargo nace con la reserva**, con el importe congelado y el período del mes
al que pertenece. El total del mes sale de las reservas concretas, así que un mes
con cinco martes se cobra por cinco martes.

**El recargo lo calcula el sistema** según la fecha en que se registra el pago:
15% del 11 al 20, 25% del 21 en adelante.

**Los pagos los registran las propietarias**, en efectivo o transferencia, con
fecha y detalle, desde la pantalla de esa persona. El inquilino ve su mes, su
total, sus pagos y su saldo.

**Soltar una hora hasta siete días antes devuelve un crédito**, que descuenta
del mes siguiente en lugar de devolver plata. La hora vuelve al calendario y se
puede vender de nuevo. Siete días alcanzan para revenderla: las consultas por
horas sueltas llegan con menos de una semana de anticipación. Pasado ese plazo,
la hora se paga, como dice la norma.

**Deshacer no es soltar.** Una reserva de hace menos de quince minutos
(`MINUTOS_PARA_DESHACER`) se cancela sin condiciones: no mira la fecha, no
cuenta contra el tope del mes y **borra el cargo** en vez de compensarlo con un
crédito, porque no hubo alquiler que devolver sino un dedo en la fila
equivocada. Sin esa salida, equivocarse de consultorio terminaba en un WhatsApp
a Lorena, que es justo lo que este sistema viene a sacar. Quince minutos
alcanzan para mirar lo que quedó y arrepentirse, y no tantos como para reservar,
ocupar la sala y después deshacer.

**Y cuando no se puede, se dice por qué y dónde estaría el botón**: "se suelta
hasta 7 días antes", "son 4 horas y el tope es 2 por mes". Antes la única manera
de enterarse era tocar el botón y leer el rechazo, y el rechazo decía "este mes
ya soltaste 0 horas", que no explica nada a quien intenta soltar una banda de
cuatro.

**El tope es de dos horas por mes por inquilino.** Sin tope, una banda de ocho
horas se desarma de a pedazos y el contrato deja de significar algo.

**La excepción tiene rastro.** Las propietarias pueden liberar una hora fuera de
plazo desde el OS, con el motivo escrito, y queda como ajuste en la cuenta.

---

## Los inquilinos

Entran con correo y contraseña. El OS hoy no tiene nada de esto: usa una clave
compartida y el portal de clientes usa enlaces secretos.

**Sin registro abierto.** El alta la hacen las propietarias desde el OS y sale un
enlace de un solo uso para que la persona ponga su contraseña.

**Restablecer contraseña sin correo saliente.** `camposhr.com` no tiene casilla
configurada. Las propietarias aprietan "restablecer", el OS genera el enlace y se
manda por WhatsApp. El día que haya envío de correo se automatiza sin cambiar el
modelo.

**La sesión es una cookie firmada** con el identificador del inquilino. La firma
sale de `CENTRO_SECRETO`, y sin esa variable no entra nadie: la zona falla
cerrada, al revés del OS, que mientras se prueba abre sin puerta. Acá adentro hay
plata y datos de terceros.

**La contraseña se guarda como huella de scrypt**, con sal por persona y
comparación en tiempo constante. No hace falta ninguna dependencia nueva.

Cada lectura de datos de inquilinos se anota en `accesos`, como el resto del
sistema.

---

## El esquema

    espacios              id, nombre, tipo (consultorio|sum), categoria (A|B|SUM),
                          orden, activo
    espacio_incluye       espacio_id, texto, orden        (camilla, timbre propio, aire)
    tarifas               espacio_id, horas_semana_desde, precio_hora, desde
    apertura              espacio_id, dia_semana, desde_hora, hasta_hora
    cierres               espacio_id?, fecha, desde_hora, hasta_hora, motivo

    inquilinos            id, nombre, correo unico, hash, telefono, activo,
                          matricula, matricula_vence, dni_archivo, matricula_archivo,
                          llave_entregada, normas_version, normas_aceptadas_at
    contratos             inquilino_id, espacio_id, dia_semana, desde_hora, hasta_hora,
                          vigente_desde, vigente_hasta
    reservas              id, espacio_id, inquilino_id, fecha, desde_hora, hasta_hora,
                          franja tsrange generada, origen (contrato|suelta), estado,
                          importe, contrato_id?
                          exclude using gist (espacio_id with =, franja with &&)
                          where (estado = 'activa')
    movimientos           inquilino_id, tipo (cargo|pago|recargo|credito|ajuste),
                          fecha, importe, reserva_id?, detalle

Índices por `(espacio_id, fecha)` y por `(inquilino_id, fecha)`.

**El SUM no tiene tabla de precios propia.** Es una fila más de `tarifas`, con
categoría SUM y un solo tramo: dos tablas para lo mismo obligan a preguntar en
cada consulta cuál mirar.

**Las horas se guardan sin huso.** `fecha`, `desde_hora` y `hasta_hora` son lo
que se lee en pantalla, y `franja` se deriva de las tres. Con `timestamptz`, una
reserva de las 17 se convierte a otra hora según dónde corra el servidor.

El DDL está en `supabase/consultorios.sql` y los datos de arranque en
`supabase/consultorios-semilla.sql`.

---

## Fase 2: la agenda del inquilino

Es un adicional mensual sobre el alquiler, y es lo que sostiene el precio: la
agenda del día, los pacientes y las notas de cada sesión viven acá, así que
mudarse de centro significa quedarse sin agenda.

Funciona por dos motivos concretos:

1. **Sabe qué horas alquiló.** Muestra los turnos sobre las horas contratadas, y
   cuando quiere agendar fuera de ellas le ofrece reservar esa hora ahí mismo.
   Ese aviso también hace crecer las horas vendidas del Centro.
2. **El enlace que le pasa a sus pacientes.** Cada inquilino tiene una dirección
   propia donde sus pacientes eligen turno dentro de sus horas alquiladas. Ese
   enlace circula por los WhatsApp de sus pacientes.

Se cobra como suscripción mensual y el cargo entra en la misma cuenta corriente.

**Los pacientes y las fichas son del inquilino, no del Centro.** Toda consulta
filtra por `inquilino_id`. Del lado del OS se ve la cantidad de turnos del mes,
que es lo que hace falta para facturar el adicional y para saber a quién
ofrecerle más horas. Nunca los nombres ni las notas.

Y la exportación de sus turnos y sus fichas existe desde el primer día. La
permanencia sale de que el sistema sea útil, y ofrecer la salida saca de encima
la objeción de quien duda en cargar su cartera de pacientes.

### El esquema, con las correcciones al modelo de referencia

    pacientes             inquilino_id, nombre, telefono, correo, antecedentes
    servicios             inquilino_id, nombre, duracion_min, precio
    turnos                inquilino_id, paciente_id, reserva_id, servicio_id,
                          franja tstzrange,
                          estado (agendado|cancelado|atendido|no_vino)
    notas                 turno_id, texto, created_at

Tres cosas cambian respecto del esquema de referencia que circula para agendas
médicas:

- **El turno cuelga de la reserva, no de una plantilla recurrente.** Apuntar a un
  bloque semanal deja al sistema sin saber qué fecha concreta se ocupó, y además
  así queda garantizado que nadie agenda un paciente en una hora que no pagó.
- **La disponibilidad publicada del inquilino es la intersección** de lo que
  quiere ofrecer con las horas que efectivamente reservó.
- **El paciente no tiene cuenta.** Entra por el enlace del inquilino, deja nombre
  y teléfono, y si después quiere ver o cancelar su turno recibe un código.

La nota es de la sesión y cuelga del turno; los antecedentes son de la persona y
se cargan una vez.

---

## Los números del centro

El sistema ya sabe todo lo que entra. Con los gastos cargados sabe también cuánto
queda, y con las dos cosas juntas puede decir dónde tocar.

### Gastos

`gastos` guarda fecha, categoría, proveedor, detalle, importe, medio de pago y el
comprobante si lo hay. Las categorías arrancan con alquiler del inmueble,
expensas, servicios, limpieza, insumos e infusiones, mantenimiento, impuestos y
tasas, seguro, honorarios y otros.

Lo que se repite todos los meses se marca como recurrente y se copia con un
botón, con el importe editable: el gasto fijo cambia de valor pero no de
existencia, y volver a tipearlo cada mes es lo que hace que se deje de cargar.

### El resultado, en dos cuentas

**Devengado**: los cargos del mes menos los gastos del mes. Dice si el centro
funciona.

**Caja**: lo cobrado menos lo pagado. Dice si hay plata.

Se muestran las dos porque un mes con buen resultado y tres inquilinos que no
pagaron no se parece en nada a un mes cobrado.

### Los indicadores, y qué se decide con cada uno

Ninguno entra a la pantalla si no termina en algo que se hace. Un número que
solo se mira no es un indicador, es decoración.

| Indicador | Qué se decide |
|---|---|
| **Ocupación por sala y franja** (horas vendidas sobre horas disponibles) | Qué franjas se promocionan o bajan de precio. Es el número del negocio: una sala vacía cuesta lo mismo que una llena. |
| **Ingreso por hora disponible** | Compara salas de precio distinto sobre la misma base. Si el consultorio 2 rinde menos por hora disponible que el 1 pese a ser más caro, el problema es la ocupación y no el precio. |
| **Quién está a una o dos horas del tramo siguiente** | A quién llamar esta semana. La hora que le falta le sale una fracción de lo que paga por una suelta, y para el centro es una hora vendida. |
| **Franjas sin vender hace más de cuatro semanas** | Qué horario se ofrece como promoción o se destina a otra cosa, como talleres en el SUM. |
| **Concentración de ingresos** (cuánto pesa el mayor inquilino y los tres mayores) | Cuándo hay que salir a captar. Si uno solo supera el 30% del ingreso, su baja es un problema y no un contratiempo. |
| **Horas contratadas por inquilino, mes a mes** | A quién llamar antes de que se vaya. Dos meses seguidos bajando horas es el aviso; la baja llega después. |
| **Cobranza**: deuda vencida por persona, cuánto se cobró con recargo, días promedio de pago | A quién se le pide el pago por adelantado y a quién se le retiene la reserva del mes siguiente. |
| **Punto de equilibrio en horas** (gastos fijos sobre ingreso promedio por hora) | Cuántas horas hay que vender antes de comprometer un gasto nuevo. |

### Cuando se facture

Hoy no factura nadie por el alquiler de las salas, así que la cuenta corriente
registra pagos y no comprobantes. El día que se facture, `lib/monotributo.ts` ya
calcula lo que ARCA mira, que son los ingresos de los últimos doce meses
corridos: esos ingresos suman al cómputo de quien emita, y el aviso de que se
está cerca del tope tiene que llegar antes de la recategorización.

---

## La página pública, anotada y sin pensar

Hay planos y fotos de las salas, y en algún momento habrá una página que las
muestre. No se diseña ahora. Queda anotado lo único que condiciona algo: los
precios no se publican, se piden, así que la página lleva formulario y no lista
de precios.

---

## Orden de construcción

1. **Esquema y configuración.** Hecho el 7/9/2026 y reordenado el 8/9: espacios
   con qué incluye cada uno y su escala, tarifas con actualización por
   porcentaje, apertura, cierres sobre el calendario, y el calendario en sus dos
   vistas. Las propietarias ya
   ven todo en un lugar, aunque las reservas sigan entrando por WhatsApp.
2. **Inquilinos y reserva.** Del lado del OS, hecho el 7/9/2026: se toca una
   hora de la grilla y se reserva, se cierra, o se libera lo reservado; se
   carga a alguien que no usa el sistema y desde ese momento tiene cuenta; y la
   pestaña de inquilinos lleva el legajo, con la marca de a quién le falta.
   La zona del inquilino quedó construida el mismo día: entra con su correo y
   contraseña, elige el día en una tira que se corre con el pulgar, ve las
   cuatro salas, reserva con el precio a la vista y suelta lo que puede soltar.
   El acceso se da desde el OS con un enlace de un solo uso que vence a las 48
   horas, y ahí mismo se aceptan las normas de convivencia, con su versión y su
   fecha.
3. **Cuenta corriente.** Hecha el 7/9/2026 de los dos lados: el cargo nace con
   la reserva, los pagos se registran con el recargo calculado según el día, el
   crédito por hora liberada descuenta del mes, y el inquilino ve su saldo, sus
   movimientos y cuánto le costaría pagar tarde.
4. **Contratos y renovación.** Bandas semanales, generación del mes y ventana de
   prioridad.
5. **Los números del centro.** Gastos, resultado e indicadores. Va acá porque
   recién con un mes entero de reservas y cobros adentro los números dicen algo.
6. **Fase 2.** Agenda, pacientes, fichas y enlace de autoagenda, como
   suscripción.

Se prueba con inquilinos y pacientes falsos cargados en Supabase, nunca con
datos reales, como el resto del sistema.

---

## Lo que falta definir

1. Tarifa por hora del SUM.
2. Precio mensual del adicional de agenda.
3. Si el tramo de 20 horas queda más caro por hora que el de 16, como está hoy
   en la planilla, o se corrige para que la escala siga bajando.
