# El ERP

Sistema de gestión de Recuvarilla. Vive en el mismo proyecto que la landing,
colgado de `/erp`, y guarda todo en [Supabase](https://supabase.com).

El día a día:

| Pantalla         | Para qué                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| **Panel**        | Qué hay que entregar hoy, y cómo viene el mes de punta a punta.         |
| **Leads**        | Todo el que preguntó, por donde sea: a quién llamar y qué contestó.     |
| **Clientes**     | Los que compraron, con la cuenta corriente de cada uno.                 |
| **Pedidos**      | Dos solapas: los presupuestos mandados, y lo vendido hasta la entrega.  |
| **Stock**        | Existencias y movimientos: producción, ventas, ajustes y devoluciones.  |
| **Caja**         | Los cobros del período, con el total por medio de pago.                 |
| **Envíos**       | Quién está cerca de un viaje que ya sale, para compartir el flete.      |
| **Costos**       | Lo que sale, y de la parte de quién sale cada cosa.                     |
| **Rentabilidad** | El resultado del mes y la cuenta de cada socio.                         |
| **Documentos**   | La lista de precios, el folleto y la ficha técnica, con el contacto de cada vendedor. |

Y lo que se toca de vez en cuando, bajo **Ajustes**:

| Pantalla        | Para qué                                                                |
| --------------- | ----------------------------------------------------------------------- |
| **Precios**     | La lista por cantidad, que es la misma que usa el simulador de la web.   |
| **Costo de la varilla** | Qué se gasta en producir una, y de dónde sale ese número.        |
| **Fletes**      | Los transportes, hasta dónde llega cada uno y a cuánto.                  |
| **Vendedores**  | Quién trae la venta, su comisión y lo que hay que liquidarle en el mes.  |
| **Tipos de gasto** | Qué gastos existen y qué socio banca cada uno.                        |

---

## Montarlo (una sola vez, unos 15 minutos)

### 1. Crear el proyecto en Supabase

Entrá a [supabase.com](https://supabase.com), creá una cuenta y hacé un
proyecto nuevo. Elegí la región más cercana (São Paulo) y guardá la contraseña
de la base que te pide: no se vuelve a mostrar.

El plan gratuito alcanza y sobra para esto.

### 2. Crear las tablas

En el panel del proyecto: **SQL Editor → New query**. Pegá todo el contenido de
[`supabase/schema.sql`](../supabase/schema.sql) y dale **Run**.

Eso crea las tablas, las vistas, los permisos y carga la lista de precios que
hoy está en el código. Se puede volver a correr sin miedo: no pisa nada de lo
que ya haya cargado.

Y hay que volver a correrlo cada vez que el archivo cambie —cuando se agrega una
pantalla nueva, por ejemplo—, porque es la única forma en que la base se entera.
Está escrito para eso: las tablas usan `if not exists`, las columnas que
llegaron después se agregan con `alter table`, las vistas se tiran abajo y se
rehacen, y las semillas sólo entran si la tabla está vacía.

> **La corrida que trae el embudo de leads migra datos y no se puede deshacer.**
> Convierte los estados viejos (`nuevo`→nuevo, `contactado`→en calificación,
> `ganado`→ganado, `perdido`→perdido con motivo "otro"), pasa `origen` a `source`
> y **borra las dos columnas viejas**. Los ganados sin monto anotado se quedan
> con lo que hubiera cotizado el simulador, o en cero. Los activos quedan con la
> próxima acción para hoy, así aparecen todos en "Hoy" y se repasan de una vez.
> Conviene sacar un backup antes (Database → Backups). Después de esa corrida el
> archivo vuelve a ser idempotente como siempre.

### 3. Enchufar las claves

En **Project Settings → API** vas a encontrar dos datos: la **URL** del proyecto
y la clave **anon public**.

Copiá `.env.example` a `.env` y pegalos:

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> Ojo con la URL: el panel muestra dos parecidas, la **Project URL** y el
> *RESTful endpoint*, que es la misma con `/rest/v1/` pegado atrás. Va la
> primera, el dominio pelado y sin barra final. Con la otra, el login falla con
> «Invalid path specified in request URL» y la landing se queda con los precios
> del código, porque el `/rest/v1/` termina puesto dos veces.

Volvé a levantar `npm run dev` (Vite lee el `.env` al arrancar, no en caliente).

> La clave `anon` es pública: viaja en el código de la web y cualquiera puede
> verla. No es un descuido, es cómo funciona: lo que cuida los datos son las
> políticas del paso 2. La clave **`service_role` no va nunca acá**, ni en el
> `.env` ni en Vercel: esa sí saltea todos los permisos.

### 4. Crear los usuarios

En **Authentication → Users → Add user**, uno por cada persona que va a entrar.
Marcá **Auto Confirm User** para que no tenga que validar el mail.

No hay registro abierto ni recuperación de contraseña por diseño: las cuentas
las crea el administrador y las cambia desde el mismo panel. Es un equipo chico
y conocido; un formulario de alta abierto en internet sería una puerta que nadie
necesita.

### 5. Deployar

En Vercel, en **Settings → Environment Variables**, cargá las mismas dos
variables y volvé a deployar.

> **El prefijo `VITE_` no es decorativo.** Tienen que llamarse exactamente
> `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Vite sólo deja pasar al
> navegador las variables que empiezan así, justamente para que una contraseña
> cargada en Vercel no termine dentro del JavaScript que se baja cualquiera. Si
> las cargás como `SUPABASE_URL` a secas, el bundle no las ve y el ERP muestra
> «Falta conectar la base» como si no existieran.

Y **hay que volver a compilar**, no sólo redeployar: Vite mete estos valores
dentro del bundle al build, no los lee cuando alguien abre la página. En el
menú de los tres puntos del deploy, *Redeploy* con **Use existing Build Cache
desmarcado**, o directamente un push nuevo.

Cargalas también en **Preview** si probás desde ramas: un deploy de preview no
ve las de Production.

El archivo [`vercel.json`](../vercel.json) ya está: hace que cualquier
dirección devuelva `index.html`, que es lo que necesita el router para que
entrar directo a `/erp/pedidos` o recargar ahí no dé 404. Vercel sirve primero
los archivos que existen, así que las imágenes y el JS no pasan por esa regla.

---

## Cómo se usa

### El circuito de una venta

```
Alguien cotiza en la web o escribe por WhatsApp
        ↓
   nuevo → en calificación → calificado → presupuesto enviado
                                                  ↓
                                       en negociación → por cerrar → GANADO
        ↓ en cualquier punto                                            ↓
   dormido (recontacto a 75 días)                          "Hacer cliente"
        ↓ dos intentos sin respuesta                                    ↓
   perdido (siempre con motivo)                       Nuevo pedido → presupuesto
                                                                        ↓
                                            confirmado → en producción → entregado
                                                                        ↓
                                                        el stock se descuenta solo
```

El embudo de la primera mitad es nuevo: reemplazó a los cuatro estados de antes
(`nuevo / contactado / ganado / perdido`). El detalle está abajo, en
[El embudo](#el-embudo).

Los cobros se cargan desde el pedido, en cualquier momento del circuito, y bajan
el saldo de la cuenta corriente del cliente.

**Presupuestar abre una ficha, y eso no vuelve cliente a nadie.** Un pedido
necesita un dueño —la tabla no admite uno sin él— así que armarle el presupuesto
a un lead le crea la ficha. Cliente es el que compró: mientras no tenga un pedido
fuera de presupuesto, la ficha figura como **prospecto** y queda fuera de la
lista de Clientes, que se abre para ver quién debe y no para leer a quién se le
cotizó. Se los muestra con "Incluir prospectos", y si alguno coincide con lo que
se está buscando la pantalla lo avisa en vez de callárselo: el que busca y no
encuentra concluye que no está y termina cargando la misma persona dos veces.

### El embudo

Un lead ya no tiene cuatro estados sueltos sino un camino, con plazos y con
campos obligatorios en cada paso. El cambio salió de un problema concreto:
"contactado" tapaba tres situaciones que se trabajan distinto —le mandé la
lista, le mandé el presupuesto, está regateando— y como quedaban indistinguibles
no había forma de saber en cuál de las tres se caía la venta.

| Etapa | Qué significa | Si nadie lo toca |
|---|---|---|
| **Nuevo** | Entró y todavía no lo atendió nadie | a las 24 hs pasa a calificación |
| **En calificación** | Se le está tratando de sacar zona, cantidad y si van agujereadas | a los 7 días se duerme |
| **Calificado** | Ya están los tres datos: se le puede cotizar | sólo avisa |
| **Presupuesto enviado** | Se le mandó el número | a los 10 días se duerme |
| **En negociación** | Objetó el precio, pidió muestra, contrapropuso | sólo avisa |
| **Por cerrar** | Dijo que sí, falta coordinar seña y entrega | sólo avisa |
| **Ganado** | Compró. Terminal | — |
| **Dormido** | No se cayó: se recontacta a los 75 días | dos intentos sin respuesta y se pierde |
| **Perdido** | Se cayó, **siempre con un motivo** | — |

**La regla que ordena todo: un lead activo siempre tiene una próxima acción con
fecha.** No es una recomendación, la base no deja guardarlo de otra forma. Un
lead activo sin próxima acción es un lead perdido que todavía no se detectó, y
así es como se pierden: nadie decide no llamarlos, simplemente dejan de aparecer.

Cuando se lo mueve de etapa, la fecha se recalcula sola con el plazo de la nueva
—dos horas para uno recién entrado, dos días después de un presupuesto— salvo
que se ponga una a mano. Quien está hablando con la persona sabe mejor que la
tabla cuándo hay que volver a llamarla; pero si no dice nada, algo queda
agendado igual.

**No se puede saltar de cualquier etapa a cualquier otra.** De "nuevo" no se
llega a "ganado": hay que pasar por el medio. Eso es a propósito, porque
saltearse las etapas es exactamente lo que hacía que después no se supiera dónde
se cae la venta. La regla vive en la base, no en la pantalla, así que también
vale para una corrección hecha a mano desde el panel de Supabase.

Cada etapa pide lo suyo antes de dejar entrar:

- **Calificado** exige localidad, cantidad y si van agujereadas. Calificar *es*
  tener con qué cotizar; sin esos datos el estado mentiría.
- **Presupuesto enviado** exige el monto.
- **Ganado** exige el monto de la venta.
- **Perdido** exige el motivo. Sin él, "perdido" no explica nada y no se corrige
  nada: los motivos son los que dicen si el problema es el precio, el flete o el
  producto.

**Todo cambio de etapa queda en el historial**, con quién lo hizo y cuándo. Es
append-only: no se puede editar ni borrar, ni desde el ERP ni con la clave del
equipo. Si una entrada del historial se pudiera corregir, dejaría de ser
historial y las métricas pasarían a medir lo que alguien quiso que dijeran.

#### Las cuatro pantallas

- **Hoy** es con la que abre el ERP. No es una lista de leads sino de acciones:
  lo que vence hoy o antes, más los dormidos a los que les llegó la fecha de
  recontacto. Ordenada por cuán cerca está la plata —primero el que está por
  cerrar, último el que recién entró— y no por fecha: dos días de atraso en
  alguien que ya dijo "dale, mandámelas" no valen lo mismo que dos días de
  atraso en alguien que preguntó un precio.
- **Tablero** es el embudo entero en columnas. Se arrastra una tarjeta para
  moverla; si el destino pide datos, se abren a preguntar. Sirve sobre todo para
  ver dónde se amontonan los leads: una columna de presupuestos enviados que no
  baja nunca dice más que cualquier informe.
- **Embudo** son las métricas: cuántos llegan a cada etapa, cuánto tardan en
  salir, tasa de cierre, por qué se pierden, y la conversión por canal y por tipo
  de cliente. Todo calculado sobre el historial y no sobre el estado actual,
  porque un lead perdido hoy dice "perdido" y nada más, mientras que su historia
  cuenta que llegó a estar por cerrar.
- **Leads** es el archivo: buscador y filtros, para encontrar a alguien puntual.

**El panel de siempre** —facturación, pedidos, caja— sigue estando, ahora en
**Panel**. Se corrió de la entrada porque contesta cómo viene el negocio, y lo
que se necesita al abrir el sistema a la mañana es qué hay que hacer ahora.

#### El barrido de la mañana

Todos los días a las 7 corre un barrido que mueve lo vencido: el nuevo que nadie
atendió pasa a calificación, el que lleva una semana sin dar datos o diez días
sin contestar el presupuesto se duerme, y el dormido que ya tuvo dos recontactos
sin respuesta se da por perdido con motivo "nunca contestó".

Lo dispara `pg_cron` en Supabase. Si el proyecto no tiene esa extensión
habilitada no pasa nada: el ERP llama al mismo barrido al abrirse, así que lo
corre la primera persona que entra cada día. Es idempotente, así que correrlo de
más no hace nada.

Dos cosas que el barrido **no** hace, a propósito:

- **No marca "vencido" en una columna.** Se calcula al mirar la pantalla. Una
  columna escrita a la noche queda mintiendo apenas alguien mueve una fecha a la
  mañana siguiente.
- **No cuenta los recontactos.** Si los contara él, un lead dormido llegaría a
  dos "intentos" en dos días sin que nadie lo haya llamado —y a los dos
  intentos se da por perdido—. El contador lo sube quien de verdad hace el
  recontacto, con el botón de "Hoy".

#### Cuando vuelve alguien que ya está en la base

Si el que escribe tiene un lead **abierto**, se retoma ése en vez de abrir uno
nuevo: el historial queda entero en vez de partido en dos fichas. Si su único
lead está **ganado**, sí se abre uno nuevo, porque eso es una recompra y hay que
poder contarla como tal.

Por eso el teléfono **no** es único en la base, aunque la spec lo pedía: un lead
es un hecho —"alguien preguntó por 500 el 3 de septiembre"— y la misma persona
genera varios en dos años. Un único global chocaría con la recompra y, además,
no se podría ni crear: en la base ya hay gente que cotizó tres veces desde la
web.

### Leads y de dónde vienen

Un lead es **cualquiera que preguntó**, no sólo el que usó el simulador. Los de
la web entran solos; el que escribe por Instagram, el que llama o el que te pasó
un conocido se cargan con **Nuevo lead**, eligiendo el canal.

Los leads cargados a mano no traen presupuesto, y está bien: el que pregunta un
precio por Instagram todavía no cotizó nada. Esos campos quedan vacíos y la
pantalla los muestra con un guión en vez de un cero, que se leería como si
hubiera pedido cero varillas.

**La ficha del lead se edita entera**: nombre, teléfono, email, canal, qué es el
que pregunta, responsable, cuántas quiere, si las quiere agujereadas, entrega,
código postal, localidad, provincia y notas. **La etapa no está en esa lista**:
se mueve con los botones de la ficha, que piden lo que cada una necesita. Un
desplegable libre dejaría saltar de "nuevo" a "ganado" sin monto ni historia, que
es justo lo que se vino a arreglar. Empezó mostrando sólo estado y notas, con lo del simulador
escrito en gris arriba, y eso alcanzaba mientras el lead fuera un papelito para
acordarse de llamar. Dejó de alcanzar cuando el lead pasó a ser de dónde sale el
cliente: el teléfono mal tipeado no se podía arreglar y el mail que dejó por
Instagram no tenía dónde anotarse, y son justo los datos que después se copian a
la ficha del cliente.

**Qué es el que pregunta** —consumidor final, alambrador, corralón,
distribuidor— define con qué lista se le cotiza y con qué tipo se crea su ficha
de cliente. Antes se asumía siempre minorista porque el lead no tenía dónde
decirlo, y marcar mayorista por la cantidad cotizada estaba mal: una compra
grande de una sola vez no es un revendedor. Sin cargar, se sigue asumiendo
minorista, que es el caso común y el que no regala margen.

Lo único que no está ahí es el **CUIT y la dirección de facturación**. No se le
piden a alguien que todavía está preguntando un precio, y viven en la ficha del
cliente, que es donde se completan cuando hay que facturarle.

**Si van agujereadas tiene tres respuestas y no dos**: sí, no, y todavía no se
sabe. La tercera es la de casi todo lead recién entrado, y sin ella no habría
cómo distinguir al que dijo que las quería lisas del que no contestó —que es uno
de los tres datos que hay que sacarle a alguien para poder calificarlo—.

Las tres están en los cuatro lugares donde se toca el dato: el alta a mano, la
ficha, el diálogo de calificación y el presupuesto. Antes el alta y la ficha
tenían una casilla, que sólo sabe decir dos cosas: el que había dicho que las
quería comunes se guardaba como "todavía no se sabe" y quedaba trabado sin
motivo. La ficha, además, mostraba la casilla y no guardaba lo que se marcaba.

**El código postal arrastra localidad, provincia y kilómetros**, como en el
simulador de la web. Si el código no está en el padrón se guarda igual y los
otros tres se escriben a mano: el padrón no lo tiene todo.

**Cuántas quiere se corrige desde su ficha**, y también al presupuestarlo. La
gente cambia de idea entre que pregunta y que compra, y el que llamó por 600
termina llevando 800. Al cambiar la cantidad, el monto se recalcula solo con la
lista de hoy: cantidad, precio unitario y monto son un solo dato en tres
columnas, y dejar dos viejas haría que la fila diga 800 varillas al lado del
importe de 600. El precio que se usa es el de la lista minorista, la misma con
la que cotiza el simulador: un lead todavía no tiene lista propia.

**El botón de WhatsApp aparece cuando el teléfono se entiende.** Los números se
cargan de cualquier forma —tal como los copia WhatsApp (`93516154503`), con el 0
y el 15, con `+54` o sin nada— y todas esas formas llevan al mismo `549` más
área más abonado. Los del exterior andan si se los escribe con el `+` del país:
sin él no hay con qué saber de dónde son. Cuando el número no se entiende, la
ficha lo dice mientras se escribe en vez de dejar que uno lo descubra al volver
a la lista y ver que el botón sigue faltando.

El canal se cruza con la pauta en **Rentabilidad**: ahí se ve cuántos contactos
trajo cada uno, cuántos cerraron y cuánto facturaron, al lado de lo que se gastó
en publicidad ese mes. Sin eso la pauta es un gasto que baja la ganancia sin que
nada diga si sirvió.

Dos detalles del cálculo:

- **La venta se cuenta en el mes del contacto, no en el del pedido.** Se está
  midiendo la captación: al que preguntó en septiembre lo trajo la plata gastada
  en septiembre, aunque compre en noviembre.
- **A cada cliente se le atribuye un solo lead: el primero que lo trajo.** Si
  alguien preguntó tres veces antes de comprar, contar sus ventas en las tres
  las triplicaría. Un cliente cargado a mano, sin ningún lead detrás, no suma en
  ningún canal: es preferible a repartirlo por aproximación y creer que la
  cuenta cierra.

Sin sesión sólo se pueden dejar leads marcados como `web`, que es de donde
efectivamente viene el simulador. Si no, cualquiera con la clave pública podría
cargar contactos firmados como "referido" y la medición pasaría a ser un número
que se puede inventar desde afuera.

**Leads y clientes son dos tablas y siguen siéndolo**, a propósito. Un lead es
un hecho ("alguien preguntó por 500 varillas el 3 de septiembre") y un cliente
es una persona; la misma persona puede generarte cinco consultas en dos años. La
ficha del cliente ya muestra todas las suyas. Y hay una razón de seguridad:
`leads` acepta escritura anónima —la necesita el simulador— y `customers` no,
así que unificarlas pondría los CUIT y las direcciones en una tabla donde puede
escribir cualquiera con la clave pública.

"Hacer cliente" **ya no marca el lead como ganado**. Antes lo hacía, porque con
cuatro estados sueltos crear la ficha era lo más parecido a haber vendido. Ahora
ganar tiene monto, fecha y un camino que hay que recorrer; tener ficha y haber
comprado dejaron de ser lo mismo —y de hecho nunca lo fueron, porque la ficha se
crea para poder colgarle un presupuesto—.

Lo que sí faltaba, y ya está: cuando el que vuelve a preguntar **ya es cliente**,
"Hacer cliente" ofrece engancharlo a la ficha que existe en vez de crear una
nueva. Esa era la duplicación real.

#### Presupuestar un lead

**Presupuestar** arma el pedido con lo que la persona cotizó, sin volver a
cargar nada. Antes había que hacerlo cliente, entrar a su ficha, crear un
pedido, elegir el producto, tipear la cantidad y tipear el precio: seis pasos
para copiar datos que ya estaban escritos, y en el medio la cantidad que se
copia mal.

El botón aparece sólo si el lead cotizó algo. Sin cantidad no hay nada que
armar: el que preguntó un precio por Instagram todavía no dijo cuántas
necesita.

Lo único que se pregunta es lo que hay que decidir de verdad:

- **A qué ficha va.** Cliente nuevo, o enganchado a uno que ya existe —la misma
  pregunta que hace "Hacer cliente", porque el que ya compró y vuelve a
  preguntar no tiene que terminar con dos fichas. Si el lead ya está enganchado
  a un cliente, ni se pregunta.
- **Cuántas lleva.** Viene puesta la que cotizó y se puede corregir ahí mismo,
  que es donde se está hablando con la persona. Si se cambia, el lead queda
  diciendo lo que pide ahora: es un solo número y no dos que se contradicen.
- **Si van agujereadas.** Lo mismo: viene puesto lo que el lead dice y se
  corrige acá. Si el lead todavía no lo decía, hay que contestarlo antes de
  seguir, porque es lo que decide el precio, y lo que se elija queda guardado en
  el lead. Antes esto no se preguntaba y el presupuesto se trababa con un
  "revisá Stock" por un dato que faltaba en el lead, no en el depósito.
- **A qué precio.** El que vio en la web puede no ser el de la lista de hoy: los
  precios se mueven y el lead puede ser de hace tres semanas. Cuando difieren se
  muestran los dos y se elige, en vez de resolverlo en silencio para cualquiera
  de los dos lados. Cobrarle de más al que ya vio un número enoja, y cobrarle de
  menos sin haberlo decidido es margen que se va sin que nadie lo note.

  Si se cambió la cantidad, esa elección no aparece: el precio que vio era el de
  otro escalón, y respetárselo para una cantidad distinta no es respetar nada.

El pedido queda en **presupuesto**, con el destino y los kilómetros del lead ya
puestos y el flete a cotizar, y la pantalla se abre en él para ponerle el
transporte y el vendedor antes de mandarlo.

**El lead pasa a "presupuesto enviado", no a "ganado".** Armarle un presupuesto
es haberlo trabajado, no haberle vendido: ganar es una etapa aparte, con monto y
fecha, a la que sólo se llega desde "por cerrar". La ficha de cliente se crea
porque un pedido necesita un dueño —la tabla no admite uno sin él—, y eso no lo
vuelve cliente todavía: cliente es el que completó al menos un pedido.

Si el lead venía en "nuevo", pasa antes por "en calificación", que es lo que de
verdad ocurrió: alguien lo atendió y le sacó los datos. Y si ya estaba en "por
cerrar", el estado no se mueve —volver atrás no tendría sentido— pero el monto
se actualiza y el presupuesto queda anotado en el historial. A un mismo lead se
le pueden mandar varios: el campo guarda el último, el historial los guarda a
todos.

### Presupuestos

El presupuesto no es un documento aparte: **es el pedido**, en su primer estado.
Se carga el cliente, la mercadería y el flete como cualquier pedido, y el botón
**Presupuesto** lo muestra con la marca, listo para exportar a PDF y mandar.

Eso reemplaza al formulario suelto que había en
[`presupuesto_recu_varilla.html`](presupuesto_recu_varilla.html). La diferencia
de fondo no es el lugar: ahí los datos se tipeaban de nuevo cada vez y el papel
era todo lo que quedaba. Acá el presupuesto ya está guardado contra su cliente,
con su número, y si el cliente compra se convierte en venta sin volver a cargar
nada. También admite varias líneas: aquel formulario tenía una sola varilla más
el agujereado, y un pedido de 600 comunes y 600 agujereadas no entraba.

**Una tabla, dos solapas.** Que el presupuesto sea el pedido es lo que hace que
vender no obligue a recargar nada, y por eso se mantiene. Pero mirarlos juntos
es otra cosa: un presupuesto es trabajo comercial que puede no ir a ningún lado,
un pedido es mercadería que hay que fabricar, despachar y cobrar. En una sola
lista lo que apremia se pierde entre lo que no, así que Pedidos abre con dos
solapas y el número de cada una al lado. Una pila de presupuestos que no baja
nunca dice que se cotiza mucho y se cierra poco, y ahora se ve sin ir a
buscarla.

En la solapa de presupuestos, la columna del estado —que sería siempre la misma—
se reemplaza por **hace cuánto se mandó**, que es lo único que dice si sigue
vivo. Se pone en ámbar a los tres días y en rojo a los diez, que es el mismo
plazo con el que la base duerme a un lead presupuestado: si las dos pantallas
usaran números distintos, una diría "dormido" mientras la otra lo muestra en
juego. El saldo tampoco aparece: un presupuesto no es una deuda, y su saldo es
el total entero.

El presupuesto sigue sin contar en facturación, en la cuenta corriente, en la
ganancia del mes ni en el stock comprometido. Eso no cambió: las solapas son
cómo se mira, no qué se cuenta.

Tres cosas se manejan desde esa pantalla:

- **El descuento** es un porcentaje sobre la mercadería, no sobre el flete: lo
  que se resigna es margen propio y el transporte cobra igual. Es plata de
  verdad, así que se guarda en el pedido y baja el total, la cuenta corriente,
  la comisión del vendedor y la ganancia del mes. Se puede escribir para ver
  cómo queda antes de comprometerlo; hasta que no se guarda, se imprime pero no
  afecta ningún total, y la pantalla lo avisa.
- **La moneda** puede ser pesos o dólares. En dólares, los precios de lista se
  convierten solos: la cotización del día se trae de dolarapi.com y aparece
  propuesta en el campo —el oficial, con el blue a un clic—, pero es un campo
  que se escribe, porque el dólar con el que se cotiza suele ser el propio.

  Lo que se convierte es **sólo el papel**. Los pagos, la cuenta corriente, las
  comisiones y la ganancia del mes siguen contando en pesos, que es la moneda en
  la que se cobra. Lo que sí se guarda en el pedido es a qué cotización salió:
  un presupuesto en dólares es un compromiso a un tipo de cambio concreto, y sin
  ese número no hay forma de volver a sacar el PDF que se mandó ni de saber qué
  se prometió cuando el cliente conteste dos semanas después. La ficha del
  pedido lo muestra, abajo del total.

  La conversión se hace precio por precio y los subtotales se recalculan sobre
  el unitario ya redondeado, para que el papel cierre cuando el cliente agarra
  la calculadora. Si falta la cotización, el presupuesto se sigue viendo en
  pesos y no se puede exportar: mostrar los importes de siempre bajo un
  encabezado que diga dólares es la única forma de equivocarse feo acá.
- **El IVA** es sólo una forma de mostrarlo. El sistema entero trabaja sin IVA
  —la lista impresa también— y eso no cambia: el 21% se agrega al papel para el
  cliente que lo pide, y no se guarda en ningún lado.

Las notas al pie se pueden retocar haciendo clic sobre ellas antes de exportar,
pero ese cambio vale para ese PDF y no queda guardado.

### Estados de un pedido

- **Presupuesto** — todavía no es una venta. No pesa en la cuenta corriente ni
  en las ventas del mes.
- **Confirmado** — el cliente lo cerró. Desde acá cuenta como venta **y la
  mercadería queda reservada**: sigue en el depósito, pero deja de estar
  disponible para venderle a otro.
- **En producción** — se está fabricando.
- **Entregado** — salió. En este momento, y sólo en este, se descuenta el stock.
- **Cancelado** — se cayó. Queda registrado pero no suma en ningún total.

Volver un pedido entregado a otro estado devuelve la mercadería al stock. Los
ítems no se pueden editar una vez entregado, justamente para que el descuento
que ya se hizo siga coincidiendo con lo que dice el pedido.

**Una seña cobrada contra un presupuesto entra en Caja pero no es una venta.**
Es la diferencia que más confunde: cobraste, la plata está, y el mes figura en
cero en Facturado y en Rentabilidad. Es correcto —el pedido todavía no se
cerró—, y ahora las tres pantallas lo dicen: el pedido avisa al registrar el
cobro, Caja marca esos cobros como *sin confirmar* y aclara cuánto del total
son, y Rentabilidad, cuando el mes está vacío, explica que puede ser por eso.

Para que cuente, el pedido tiene que pasar a **confirmado**.

### Precios y revendedores

Hay **dos listas**, no una con tramos de volumen:

- **Minorista** — la pública. Es la que cotiza el simulador de la web y la que
  paga cualquiera que no tenga acuerdo. Baja por cantidad, pero es la misma
  lista de punta a punta.
- **Mayorista** — la de los revendedores, que compran todos los meses. Arranca
  en 1.000 unidades y es notablemente más barata.

Lo que decide cuál se aplica es **quién compra, no cuánto compra**. Un
particular que un día lleva 2.000 varillas paga la minorista; un revendedor que
este mes lleva 300 paga la mayorista igual, porque lo que se le reconoce es que
vuelve. Si su pedido queda por debajo del primer escalón de su lista, se le
aplica ese primer escalón.

Un cliente pasa a revendedor marcándolo **Mayorista** en su ficha. Es una
decisión de una persona, no algo que dispare una cantidad: el ERP nunca lo
cambia solo, ni siquiera al convertir un lead que cotizó mucho.

**Las ventas a revendedores no pagan comisión.** Ya se les vende más barato, y
ese descuento es lo que se resigna; sumarle comisión sería resignarlo dos veces.
La pantalla del pedido lo explica en lugar de dejar el campo puesto, y la regla
también está en la base, así que vale aunque la comisión se cargue desde otro
lado.

La lista vive en la base y se edita desde **Precios**, cada una en su tabla. Lo
que guardes en la minorista es lo que cotiza el simulador de la landing al rato
siguiente, sin deployar nada.

`src/data/pricing.js` guarda una copia de la lista que se usa **sólo si la base
no contesta**, para que la web nunca quede sin precios. Conviene actualizarla
cuando el cambio de precios es grande, en el mismo commit en que se actualiza la
lista impresa.

### Reciclado por encargo

Hay un tercer tipo de cliente: **empresa**. No compra varillas — trae su propio
plástico para que se lo reciclemos y se lleva las varillas que salen de ahí.

Es otro negocio, no otro precio:

- **No se cobra mercadería.** La materia prima es del cliente. Se cobran las
  horas: la máquina que procesa el plástico y la de producción tienen cada una
  su tarifa, que se carga en Ajustes → **Precios**, abajo de las dos listas.
- **Esas varillas nunca entran al stock.** No es un olvido: nunca fueron
  nuestras. Si un mes producís 500 varillas para una empresa y el stock no se
  mueve, está bien.
- **Tampoco pagan comisión**, porque la comisión se calcula sobre la mercadería
  y acá no hay. Si algún día hay que comisionar esas horas, es un cambio chico.

Al crear el pedido se elige el **tipo de trabajo**. Si el cliente es una empresa
arranca en *reciclado*, pero es una propuesta y se puede cambiar: esa misma
empresa puede comprarte varillas alguna vez, y ese pedido es una venta común.

En un trabajo de reciclado la pantalla del pedido cambia: donde va la mercadería
van las **horas de trabajo**, y en Entrega se cargan los **kilos recibidos** y
las **varillas entregadas**. Eso último es para poder contestar cuántas varillas
salieron de tantos kilos, que es la pregunta que hace el cliente.

Lo demás funciona igual: los cobros, la cuenta corriente, el flete y el
presupuesto no distinguen entre un trabajo y una venta, porque del lado de la
plata son lo mismo.

### Reservas y fecha de retiro

El caso típico: llaman, dicen que la semana que viene pasan a buscar 50, y no
dan un día. Quieren que queden apartadas igual.

Eso se resuelve **confirmando el pedido**: reservar no es una operación nueva,
es el mismo paso de siempre. Lo que cambió es que ahora se ve. Desde que un
pedido está confirmado o en producción, sus varillas cuentan como reservadas y
salen del disponible, aunque sigan en el depósito. La pantalla de Stock muestra
los tres números:

- **Disponible** — el que se contesta por teléfono: cuántas se pueden vender.
- **En depósito** — cuántas hay físicamente.
- **Reservadas** — cuántas ya tienen dueño.

Un presupuesto no reserva nada, a propósito: todavía no es una venta, y apartar
mercadería contra una consulta paralizaría stock por nada.

La **fecha de retiro** (o de entrega, si va con envío) es aparte de la fecha del
pedido, que es cuándo se tomó y es la que ordena la contabilidad: un pedido de
marzo que se retira en abril se vendió en marzo. Y puede quedar vacía, que
significa "a confirmar". Es a propósito: obligar a elegir un día haría que
alguien invente uno, y una agenda llena de fechas inventadas es peor que una que
avisa cuáles faltan. El pedido lo muestra en el encabezado.

Si el disponible queda en negativo, hay más comprometido que fabricado y la
pantalla dice cuánto falta producir.

**Dónde se ve qué sale y cuándo.** En el **Panel**, arriba de todo, está *Para
entregar*: los pedidos confirmados y en producción ordenados por fecha, con los
"a confirmar" al final. Cada uno dice si hay que despacharlo —y a qué
localidad— o si lo retiran en fábrica, y cuánto apremia:

- **Atrasado** en rojo, con cuántos días pasaron.
- **Hoy** en rojo, **Mañana** y los tres días siguientes en ámbar.
- **A confirmar** en ámbar, porque es lo que hay que destrabar llamando.

El encabezado de esa tarjeta resume cuántos hay atrasados, para hoy y sin fecha.

La lista de **Pedidos** muestra lo mismo en su columna *Cómo y cuándo sale*, y
tiene un filtro para ver sólo los que hay que despachar o sólo los que retiran.
El criterio de urgencia es uno solo para las dos pantallas: si una dijera
"atrasado" donde la otra muestra gris, la que se mire primero decidiría el día.

### Stock

**Hay un solo stock, y es de varillas.** La agujereada no es otra mercadería: es
una varilla a la que se le hace un agujero contra el pedido. Por eso el
agujereado vive en la línea del pedido y no en el producto, y por eso un pedido
de 100 agujereadas descuenta del mismo pozo que uno de 100 comunes.

Antes eran dos productos con dos stocks. Como la producción se carga toda contra
la varilla, la agujereada se quedaba en cero para siempre: un pedido de 100
agujereadas leía cero disponibles con tres mil varillas en el galpón, y
presupuestarlo mandaba a revisar un faltante que no existía. El stock no estaba
mal cargado, estaba partido en dos pozos donde hay uno solo.

Al lado de las reservadas aparece **a agujerear**: cuántas de las comprometidas
hay que pasar por la máquina antes de que salgan. No cambia el disponible —la
varilla es la misma— pero es trabajo ya comprometido, y conviene verlo antes de
que el camión esté esperando.

Esto vale mientras se agujeree contra el pedido. Si alguna vez se agujerea una
tanda por adelantado y queda guardada, el modelo hay que partirlo en dos otra
vez: una varilla agujereada no vuelve a ser común, y esa es la asimetría que un
solo número no sabe representar.

El número de existencias no se guarda: se calcula sumando los movimientos. Por
eso la pantalla muestra las dos cosas juntas, y por eso cuando algo no cuadra la
respuesta está en la lista de abajo.

- **Producción** y **devolución** suman; se cargan a mano.
- **Ajuste** puede sumar o restar: es el movimiento para cuando lo contado en el
  depósito no coincide. Se carga en negativo si falta mercadería.
- **Venta** la genera el sistema al entregar un pedido, y no se puede borrar a
  mano. Para revertirla hay que sacar el pedido del estado entregado.

### Fletes

Cada transporte se carga una vez con sus **zonas** y, dentro de cada zona, su
**tarifario por cantidad**. El precio de una tarifa tiene dos partes que se
suman: un importe fijo por envío y otro por varilla. Con una sola de las dos
alcanza para el caso simple; las dos juntas cubren el "mínimo más excedente"
que cobran varios expresos.

#### Una zona es una lista de ciudades

Una zona tiene un nombre —«AMBA», «Cuyo», «Litoral»— y **la lista de ciudades a
las que llega**. Se cargan con el botón **Ciudades** de la zona, buscando por
nombre o por código postal contra el mismo padrón que usa el simulador de la
web: la localidad que se guarda es la misma que va a traer el pedido, que es lo
único que hace que después se encuentren.

> **Antes una zona era un rango de códigos postales, y el rango mentía.** Los
> códigos argentinos se asignaron por región pero no son un mapa: un expreso que
> llega a Rosario y a Venado Tuerto no llega a todo lo que hay en el medio, y el
> rango decía que sí. Cotizaba envíos a pueblos a los que nadie iba, y eso se
> descubre cuando el cliente ya tiene el precio en la mano.

Una ciudad puede tener varios códigos postales —la Ciudad de Buenos Aires tiene
quinientos— y se agrega y se quita como una sola cosa. El código postal es cómo
la encuentra el sistema; la ciudad es cómo se piensa la zona.

Para no cargar doscientas localidades de a una está **Agregar provincia**, que
suma todas las de una provincia de un saque. Sigue siendo una lista de ciudades:
lo que cambia es cuántos clics cuesta, no qué se guarda. Después se sacan las
que no correspondan.

**Las zonas cargadas con el esquema viejo siguen funcionando.** Mientras una
zona no tenga ni una ciudad, se la sigue cotizando por su rango, y la pantalla
la marca en ámbar con un botón para convertirla: traduce el rango a las ciudades
que de verdad hay adentro y ahí se depuran. Apenas tiene la primera ciudad, el
rango deja de aplicar — si valieran los dos, una zona a medio convertir
cotizaría destinos que ya se habían sacado a propósito.

Con eso cargado, el pedido contesta solo. Al poner el código postal en **Entrega
y flete** aparecen los transportes que llegan a ese destino con esa cantidad,
ordenados por precio y con el más barato marcado. Elegir uno completa el importe
del flete, que se puede corregir a mano antes de guardar: el tarifario es una
referencia, y lo que vale al final es lo que se pagó.

El camión propio se carga como un transporte más, con tipo *camión propio*.
Ponerle su tarifa es lo que permite comparar de verdad cuándo conviene mandarlo
en lugar de darlo por gratis, que es como se pierde plata sin verla.

La pantalla de **Fletes** tiene arriba un probador: código postal y cantidad, y
muestra la misma comparación sin tener que inventar un pedido de prueba.

### Envíos: quién está cerca de un viaje que ya sale

El flete es lo que más veces mata una venta lejos. La varilla compite bien y el
envío no, y hay leads perdidos con motivo **Costo de flete** que lo dicen con
todas las letras.

Pero el grueso del costo de un envío es el viaje, no la varilla de más. Si ya
hay un pedido confirmado a Rosario, al de al lado se le puede ofrecer un flete
que solo no pagaría. **Envíos** contesta a quién llamar.

Arriba, los **viajes que ya salen**: los pedidos confirmados o en producción con
entrega por envío. Un presupuesto todavía no es un viaje y un entregado ya
volvió, así que no cuentan. Cada uno muestra cuánta gente hay cerca de ese
destino; tocándolo se abre la lista.

#### Qué quiere decir «cerca»

No hay kilómetros entre dos destinos, y conviene saber por qué: el padrón de
códigos postales guarda la distancia hasta la **fábrica**, no coordenadas. Dos
localidades a 300 km de la fábrica pueden estar a 600 km entre sí, una al norte
y la otra al sur. Estimarlo con ese dato daría un número que parece preciso y no
lo es.

Así que «cerca» no se estima, se define con lo que sí es exacto:

| Nivel | Qué significa |
| --- | --- |
| **Misma localidad** | Mismo código postal: entra en el mismo reparto. |
| **Misma zona de flete** | El transporte cobra **lo mismo** por los dos destinos. No es una aproximación geográfica, es el precio. |
| **Misma provincia** | Cerca en sentido amplio. Conviene confirmar el flete antes de prometer nada. |

El del medio es el bueno, y sale del tarifario que ya está cargado en Fletes:
dos destinos que caen en la misma zona de un mismo transporte cuestan lo mismo.
**Sin tarifario cargado la pantalla funciona igual**, pero sólo puede distinguir
misma localidad y misma provincia — y lo avisa.

Dentro de cada nivel se ordena por diferencia de código postal. En Argentina los
códigos se asignaron por región, así que dos números parecidos suelen ser dos
pueblos vecinos. Es un desempate para ordenar una lista corta, nunca una medida
de distancia.

#### A quién llamar primero

La lista no viene ordenada por cercanía sino por **a quién conviene llamar**:

1. **Los que se perdieron por el flete.** Ya quisieron comprar, ya dijeron que
   sí al producto, y lo que los frenó es exactamente lo que este viaje abarata.
   Van marcados en ámbar.
2. **Los que quedaron a mitad de camino**: perdidos por otro motivo, y dormidos.
3. **Los leads abiertos.**
4. **Los clientes**, al final: ya compran, y esto les suma un envío más barato,
   no una venta nueva.

Abajo, **la cartera por provincia**: cuántos clientes y leads hay en cada una,
cuántas localidades distintas, y cuántos se perdieron por el flete. Tocando una
provincia se la usa como destino, que sirve para planear un viaje que todavía no
existe.

> «Córdoba» y «Cordoba» cuentan como una sola provincia. Se agrupan sin tildes,
> por las fichas viejas que quedaron escritas de cualquier forma — si no, media
> cartera queda en una provincia y media en otra, y ninguna de las dos mitades
> sirve.

#### La provincia se elige, no se escribe

En la ficha de un cliente y en el alta de un lead, **la provincia es un
desplegable** con las 24 jurisdicciones. Escrita a mano, la misma provincia
entraba como «Córdoba», «Cordoba» y «Cba», y después no había forma de juntarlas
en una lista ni de filtrar por ellas.

El **código postal completa la localidad y la provincia solas** en los dos
formularios, contra el mismo padrón que usa el simulador de la web. De poco
serviría elegir bien la provincia de una lista si la localidad de al lado se
escribe a mano y queda «rosario » con un espacio al final.

El padrón escribe las provincias sin tildes, así que lo que autocompleta pasa
por la lista antes de guardarse: un lead que entró por la web y un cliente
cargado a mano dicen **el mismo texto**, no dos que haya que normalizar para
comparar. Lo que no se reconoce —un dato viejo raro, un envío al exterior— se
deja como está y se ofrece igual en el desplegable: es algo para mirar, no algo
que el sistema tenga que decidir por su cuenta.

Correr `schema.sql` empareja de una vez las provincias que ya estaban cargadas,
con la misma regla y las mismas abreviaturas. Se puede volver a correr sin
efecto.

#### Filtrar por provincia

**Clientes** y **Leads** tienen su propio filtro por provincia, con la cantidad
al lado de cada una, y las dos listas muestran dónde está cada uno. Las opciones
del filtro salen de lo que hay cargado y no de las 24: un desplegable con
veinticuatro opciones de las que sirven tres hay que leerlo entero cada vez.

En Leads el filtro lo resuelve la base y no el navegador, y es a propósito: esa
lista corta en los primeros 300, así que filtrar después de traerlos contestaría
«los de Mendoza que entraron últimos», que no es lo que se está preguntando.

Quien no tenga localidad cargada no puede aparecer en ninguna de las dos
pantallas: Envíos lo cuenta aparte, en **Sin dirección**, porque a esa gente no
se le puede ofrecer un envío hasta saber dónde está.

### Documentos

Los tres papeles que se reparten —lista de precios, folleto y ficha técnica—
salen del ERP, y cada uno **con el contacto del vendedor que se elija**. Ese es
el punto: hasta ahora todos llevaban el teléfono de la empresa, así que cuando
el cliente llamaba no había forma de saber quién lo había traído. Ahora cada
vendedor reparte su versión y el cliente que responde es suyo.

Se elige el vendedor una vez en **Documentos** y los tres salen con sus datos.
El vendedor viaja en la dirección (`?vendedor=…`), así que el link de "el
folleto de Marta" se puede guardar o mandar por WhatsApp y siempre abre el suyo.
Un campo que el vendedor no tenga cargado se completa con el de la empresa, para
que no quede un renglón vacío en un papel que va a manos de un cliente; la
pantalla avisa cuáles faltan.

Reemplazan a los HTML sueltos de `docs/`, que quedan como referencia de cómo era
cada uno. Tres cosas cambian:

- **La lista de precios lee de la base.** Antes había que reeditar el archivo
  cada vez que cambiaba un escalón, y entre una cosa y la otra siempre había
  alguien repartiendo la lista vieja. También el recargo por agujereado y la
  fecha de vigencia salen de los datos: el recargo es la diferencia entre las
  dos columnas y la vigencia es la última vez que se tocó un precio, así que ya
  no pueden contradecir a la tabla que tienen al lado.
- **El folleto sale con el contacto lleno.** El archivo traía "Nombre y
  Apellido · 011 0000-0000" de ejemplo, y la mitad de las copias se repartían
  así.
- **La ficha técnica ya no trae los controles de dibujo.** Cambiar largo, ancho
  y perforaciones servía para *diseñar* la ficha, no para emitirla; el producto
  tiene una sola medida. El dibujo sigue siendo paramétrico por dentro, así que
  el día que haya otra varilla alcanza con pasarle otras medidas. Lo que sí se
  conserva son las marcas de dato pendiente: lo que no se midió sale señalado y
  no escrito como si estuviera verificado.

El presupuesto no está en esta pantalla porque no es un papel general: sale de
cada pedido. También lleva al pie el contacto de su vendedor.

### Vendedores y comisiones

Cada vendedor tiene un porcentaje habitual —el 5% de arranque—, que es el que se
propone al cargarlo en un pedido. Lo que se paga sale de cada venta, que guarda
el suyo: si un pedido grande se negocia distinto, cambiar después la ficha del
vendedor no reescribe lo que ya se acordó.

Tres reglas que conviene tener claras:

- **Se calcula sobre la mercadería sola.** El flete no es plata de la empresa:
  entra y sale hacia el transporte.
- **Se devenga a medida que el cliente paga**, no cuando se entrega. Un pedido
  entregado y sin cobrar todavía no le debe nada a nadie.
- **Un pedido anulado no devenga nada**, aunque tenga cobros cargados.

La pantalla de **Vendedores** muestra abajo la liquidación del mes: cuánto le
toca a cada uno y, desplegando, los pedidos que lo componen.

El teléfono, el email y la localidad no son datos internos: son los que salen
impresos en su folleto y en su lista de precios. Conviene tenerlos completos
antes de que empiece a repartir.

### Cuánto cuesta producir una varilla

El costo de producción **dejó de cargarse a mano**. Se define una vez qué se
gasta, en **Ajustes → Costo de la varilla**, y después cada producción que
cargás en Stock arrastra ese costo sola.

Los conceptos tienen dos bases, y esa distinción es toda la idea:

| Base | Qué es | Ejemplos |
| --- | --- | --- |
| **Por varilla** | Se gasta por unidad, vayan las horas que vayan | Materia prima |
| **Por hora** | Corre con el reloj, no depende de cuántas salgan | Luz, empleados, galpón |

Para pasar los de hora a costo por varilla hace falta saber **cuántas hace la
máquina por hora**. De ahí sale la cuenta:

```
costo por varilla = (lo de unidad) + (lo de hora ÷ varillas por hora)
```

Producir más rápido abarata cada varilla sin que cambie ningún precio, que es lo
que pasa en la realidad y lo que una lista de gastos sueltos no deja ver. Por eso
las varillas por hora están arriba de la pantalla y no escondidas: si ese número
está mal, todo el costeo está mal en la misma proporción.

**Mientras falte, no se inventa nada.** Si hay costos por hora cargados y las
varillas por hora están en cero, el costo por varilla queda vacío en vez de
mostrar sólo los materiales. Un número incompleto se guardaría en cada
producción como si fuera el real y nadie lo revisaría.

**El costo se congela al producir.** Cada movimiento de producción guarda lo que
costaba una varilla ese día. Si mañana sube la luz, lo que costó producir en
marzo no cambia — un mes cerrado que se mueve solo es un mes en el que ya no se
puede confiar. Las producciones cargadas antes de que existiera el costeo salen
señaladas en Stock y cuentan cero.

> **Ojo si venías cargando "producción" como gasto.** Ese tipo ya no se ofrece y
> **no se cuenta en ningún total**, para no cobrarse la producción dos veces. Los
> que hayan quedado cargados siguen ahí y tanto Costos como Rentabilidad los
> señalan en ámbar, para que los borres o los pases a otro tipo.

### Costos

Todo lo que sale de la empresa se carga en **Costos**. El tipo no es una
etiqueta para ordenar: **define de la parte de quién sale ese gasto**. Cada fila
de la lista lo dice, en su propia columna.

Quién paga cada tipo se configura en **Ajustes › Tipos de gasto**, y hay tres
reglas posibles:

| Regla | Quién lo termina pagando |
| --- | --- |
| **El cliente** | Un pasamanos: se le cobra al cliente y se le paga al proveedor. No lo banca nadie de adentro y no entra en el reparto. |
| **Sale de arriba, en proporción** | Se descuenta antes de repartir, así que lo paga cada parte en proporción a su porcentaje. |
| **Socios puntuales, en mitades** | Lo bancan sólo los socios marcados, **en mitades iguales** entre ellos, sin mirar sus porcentajes. |
| **El pozo de reinversión** | Lo paga el pozo. Lo que el pozo no llegue a cubrir lo ponen, también en mitades, los socios marcados. |

De fábrica queda así:

| Tipo | Regla | Lo bancan |
| --- | --- | --- |
| Producción | Socios, mitades | Esteban y Juan |
| Flete | El cliente | nadie de adentro |
| Pauta | El pozo | y si no alcanza, Luis y Juan |
| Suscripciones | El pozo | y si no alcanza, Luis y Juan |
| Muestras | El pozo | y si no alcanza, Luis y Juan |

Los tipos se agregan desde esa pantalla: se le pone nombre, se elige la regla y
se marca quién lo banca. La lista ya no está escrita en el código. Las dos
primeras reglas no llevan lista de socios: en una no lo banca nadie de adentro y
en la otra lo bancan todos.

**Un tipo no se borra, se retira.** Deja de ofrecerse al cargar un gasto pero
los que ya estaban se siguen contando y pagando igual — borrarlo dejaría plata
sin dueño en un mes ya liquidado.

**Un tipo sin socios asignados no se reparte solo.** Los gastos que se carguen
con él aparecen en rojo, tanto en Costos como en Rentabilidad, como *gasto sin
dueño*. Repartirlos entre todos por defecto es exactamente lo que se quiso dejar
atrás.

> **Se retiró el tipo "Otro".** Un cajón de sastre es justamente el que no
> contesta de la parte de quién sale. Los gastos que hayan quedado con ese tipo
> se siguen contando y los banca quien tenga asignado, pero conviene
> reclasificarlos mientras alguien se acuerde de qué eran. La pantalla los
> señala.

Un gasto puede imputarse a un pedido por su número —un flete que se pagó, una
producción especial— o quedar suelto en el mes, como la pauta. No hay un segundo
lugar donde anotar gastos.

### El reparto

La regla, en una frase: **cada uno cobra su porcentaje sobre el valor del
producto vendido, y después se le descuentan sólo los costos que él banca.**

Eso es lo que cambió, y no es un detalle. Antes los costos salían de arriba, de
la ganancia, y por lo tanto los pagaban los tres en proporción a su parte: un
costo de producción de $100.000 le salía $50.000 a quien tenía el 50 y $20.000 a
quien tenía el 20, sin que nadie lo hubiera acordado así.

**Rentabilidad** muestra la cascada completa:

```
   Mercadería + servicios
 − comisiones                       (la única que sale de arriba)
 ─────────────────────────────
 = base del reparto   →   cada parte cobra su porcentaje sobre esto

 − producción y demás costos        →   en mitades, a quienes los bancan
 − pauta y suscripciones            →   al pozo; lo que no cubra, a sus socios

   flete facturado − pagado al fletero   →   afuera: lo paga el cliente
```

**El flete no lo paga ninguno de ustedes.** Se cotiza del tarifario, se le
factura ese mismo número al cliente y se le paga al fletero: entra y sale la
misma plata. Por eso ni lo facturado ni lo pagado tocan la parte de nadie, y por
eso el flete facturado queda fuera de la base.

Y por eso mismo **tiene que dar cero**. Si lo facturado y lo pagado no coinciden,
no hay plata de alguien en el medio: falta cargar el gasto del fletero, o hay un
flete pagado que ningún pedido facturó. Rentabilidad lo muestra como *descalce*
y dice para qué lado está, en vez de buscarle dueño — que sería inventar un
ingreso donde hay un error de carga.

La **comisión del vendedor** es lo único que se descuenta antes de repartir, así
que la absorben todos en proporción: con 5% de comisión, quien tiene el 50%
resigna 2,5 puntos y quien tiene el 20% resigna 1.

Cuenta como venta todo pedido confirmado en adelante, por su fecha; los
presupuestos y los anulados no entran, igual que en la cuenta corriente.

Los porcentajes se editan en la misma pantalla y arrancan en 50 / 25 / 20 y un 5
de reinversión, que sale de arriba y por lo tanto lo ponen los tres.

**La tabla muestra de dónde salió cada número.** Debajo del monto de cada socio
se lista su bruto y cada descuento con su concepto: sin eso, un socio ve una
cifra más chica que su porcentaje y no tiene cómo saber qué se le cobró.

Un mes de ejemplo, con $1.000.000 de mercadería, $300.000 de producción y
$100.000 de pauta:

| | Su % | Bruto | Se le descuenta | Le toca |
| --- | --- | --- | --- | --- |
| Esteban | 50% | $500.000 | $150.000 de producción | **$350.000** |
| Juan | 25% | $250.000 | $150.000 de producción + $25.000 de pauta | **$75.000** |
| Luis | 20% | $200.000 | $25.000 de pauta | **$175.000** |
| Reinversión | 5% | $50.000 | — | al pozo |

El 5% juntó $50.000 y la pauta fue $100.000, así que faltaron $50.000: los
ponen Luis y Juan, en mitades, $25.000 cada uno. La producción no le toca a
Luis. Las tres cifras suman $600.000, que es exactamente la ganancia neta del
mes — **si no cerrara, habría plata apareciendo o desapareciendo en el reparto.**

**Si un mes da pérdida**, los montos salen negativos y se ven en rojo. Es real:
ese mes alguien puso plata en vez de cobrar.

Si los porcentajes no suman 100, el ERP lo avisa y muestra cuánta plata queda
sin asignar, en vez de estirar los números para que cierre. Un reparto que
cierra siempre no deja ver que la lista está mal cargada.

### El pozo es plata ya invertida

Lo que la reinversión junta y no gasta **se acumula, y no vence**.

El pozo no es plata guardada esperando el mes que viene: es plata que ya está
invertida —en la marca, en las muestras, en lo que hace que el mes que viene
exista—. Por eso se acumula en vez de repartirse.

Cuando el pozo crece, Rentabilidad lo mide contra lo que se está gastando por
mes y lo dice: *«el pozo equivale a 4,2 meses de reinversión al ritmo actual»*.
Un pozo de dos millones no dice nada por sí solo; dice algo cuando se sabe que
son diez meses de pauta sin usar. **Eso es la señal de invertir más fuerte**, y
la decisión es de los socios, no de una regla automática.

La columna *Pozo* en la tabla de los últimos meses muestra cómo viene creciendo.

Cuando el pozo no alcanza para los gastos del mes, la diferencia la ponen los
socios asignados a cada tipo, en mitades, y queda descontada en la tabla con su
concepto. El pozo cubre todos los tipos **en la misma proporción**, no uno
entero y después el otro: cubrirlos en orden daría un resultado distinto según
cómo esté ordenada una tabla.

> **Se eliminó la regla del pozo que vencía.** Antes la reserva tenía un mes de
> gracia: lo que sobrevivía sin usarse volvía entero al socio minoritario, y la
> reinversión escalaba a 7,5% o 10% cuando no alcanzaba. Las dos cosas ya no
> existen. Las liquidaciones de pozo que se hayan hecho bajo esa regla siguen
> contadas en «cobró», y la cuenta de cada socio lo aclara para que un saldo
> pagado de más no parezca un error.

### Registrar lo que se pagó

El reparto era hasta acá una cuenta en pantalla: decía cuánto le tocaba a cada
uno pero no quedaba constancia de qué se pagó. Eso alcanza el primer mes y deja
de alcanzar al tercero, cuando alguien pregunta si ya cobró lo de septiembre y
la única respuesta es la memoria de otro.

Cada socio tiene su liquidación y **se puede pagar de una vez o en partes**:

- **Liquidar** paga todo lo que falta de un clic. Es el caso normal.
- **parte** abre el detalle, con un campo para poner el monto a mano. Es cuando
  se paga a cuenta porque no está toda la plata junta.

El detalle muestra las tres cifras que importan —le toca, pagado, falta—, la
lista de los pagos ya hechos con la opción de borrar cualquiera, y mientras
escribís el monto te dice cómo queda el saldo después de ese pago. La fila de la
tabla queda diciendo *Pagado $80.000 · falta $40.000* hasta que se completa.

Abajo de la tabla se ve cuánto se liquidó del total del mes, y avisa cuando está
**todo pagado**.

Dos detalles:

- **El monto se congela al pagar.** Si después se corrige un gasto viejo y la
  cuenta del mes se mueve, lo pagado sigue diciendo lo que se pagó. La
  diferencia queda a la vista, que es para lo que sirve tener el registro.
- **La reinversión no se liquida**: su parte no se le paga a nadie, va al pozo.

> La base tenía una restricción que impedía dos pagos del mismo socio en el
> mismo mes, justamente para que dos clics no generaran un doble pago. Se sacó
> al permitir el pago parcial, porque prohibía algo que hay que poder hacer.
> Contra el doble pago protege ahora la pantalla, que muestra el saldo antes de
> registrar nada: es más débil, pero no impide lo legítimo.

### La cuenta corriente de cada socio

Todo lo anterior mira un mes. La tarjeta **Cuenta corriente de cada socio**, al
final de Rentabilidad, mira el historial completo y contesta la pregunta que no
se puede responder mes por mes: *cuánto le tocó en total, cuánto cobró y qué
falta*.

El **saldo** dice **al día** cuando está saldado, en ámbar cuando se le debe y
en rojo cuando se le pagó de más. Desplegando *Ver mes por mes* se ve el detalle
de cada mes con lo que correspondía y lo que se cobró; hacer clic en una fila
lleva la pantalla a ese mes.

Una diferencia que conviene entender: **«le tocó» se recalcula siempre con los
datos de hoy y «cobró» es lo que quedó registrado al pagar.** Si aparece un
saldo donde no debería, casi siempre es que se corrigió un gasto de un mes ya
liquidado y la cuenta de ese mes se movió después de pagar. Eso es información,
no un error: la diferencia se ve en vez de perderse.

Un detalle a tener presente: la comisión se imputa al mes del pedido pero se
devenga cuando el cliente paga, así que un mes ya cerrado puede moverse un poco
si entra un cobro viejo. Es a propósito: la alternativa era llevar dos fechas
por comisión, y no vale la complicación para un equipo de tres.

---

## Cosas que conviene saber

**Los leads se guardan en dos lados.** El simulador escribe en Supabase y
además sigue mandando todo a la planilla de Google de siempre (ver
[`planilla-de-contactos.md`](planilla-de-contactos.md)). Es a propósito
mientras dure la transición: la planilla queda como respaldo y no se pierde el
histórico. Para cortarla, vaciá `LEADS_ENDPOINT` en
[`src/lib/leads.js`](../src/lib/leads.js).

**Cualquiera con la clave pública puede dejar un lead.** Es la misma exposición
que ya tenía la planilla de Google, y para juntar contactos que la gente deja
voluntariamente no es un problema. Lo que no puede hacer nadie desde afuera es
*leerlos*: la política sólo permite insertar. Por las dudas, no guardes nada
sensible en esa tabla.

Lo que sí se acotó es **qué** puede insertar: sin sesión, un lead sólo puede
entrar como `nuevo` y con canal `web`, y no puede traer responsable, tipo de
cliente ni monto. Si no, cualquiera con la clave pública podría cargar contactos
firmados como "referido" o ya "ganados" por diez millones, y la medición que
decide dónde se pone la plata de la pauta pasaría a ser un número que se puede
inventar desde afuera.

**El ERP no aparece en Google.** `public/robots.txt` lo excluye y la pantalla
agrega una etiqueta `noindex`. De todos modos pide login, así que eso es sólo
para que no figure en las búsquedas.

**Todos los usuarios ven todo.** No hay roles: quien entra, trabaja con todo el
sistema. Si en algún momento hace falta separar (por ejemplo, que producción no
vea los precios de compra), se hace con políticas nuevas en Supabase, sin tocar
las pantallas.

**Sin las variables de entorno, la landing anda igual.** Muestra los precios del
código y el simulador funciona; lo único que no pasa es que se guarde el lead en
la base. El ERP, en cambio, avisa que falta configurarlo.

**Los importes son todos sin IVA y en pesos**, igual que la lista impresa. Las
dos excepciones son visuales y viven en la misma pantalla: el presupuesto se
puede exportar con el 21% agregado y se puede exportar en dólares, para el
cliente que lo pide, sin que ninguna de las dos cosas toque lo que hay guardado.
De la conversión sí queda registrada la cotización usada, que es lo único que no
se puede reconstruir después.

**El flete ya no se carga a ciegas.** Con el tarifario de Fletes cargado, el
pedido propone los transportes que llegan al destino con su precio; el importe
igual se puede escribir a mano, y mientras esté vacío el pedido dice "a
cotizar", que es distinto de decir cero.

**El ERP no le pesa a la landing.** Se carga aparte y sólo al entrar a `/erp`:
son unos 59 KB comprimidos que quien visita la web pública no descarga nunca.

---

## Respaldo

Supabase hace copias automáticas en el plan gratuito, pero se guardan pocos
días. Para una copia propia: **Database → Backups**, o desde el panel de cada
tabla el botón de exportar a CSV.

Vale la pena bajarse `orders`, `order_items`, `payments` y `customers` de vez en
cuando: son los datos que no se pueden reconstruir.
