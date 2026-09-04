/*
  Esquema del ERP de Recuvarilla.

  Se corre entero, una sola vez, en el editor SQL de Supabase. Es idempotente:
  volver a correrlo no rompe nada ni pisa datos ya cargados (las tablas usan
  `if not exists` y los precios semilla sólo entran si la tabla está vacía).

  Dos tablas las toca también la web pública, además del ERP:

  - `price_tiers`, que la landing lee para mostrar precios al día sin deployar.
  - `leads`, donde el simulador de presupuesto deja cada contacto.

  Todo lo demás queda detrás del login. El detalle del montaje está en
  `docs/erp.md`.
*/

-- ---------------------------------------------------------------------------
-- Precios
-- ---------------------------------------------------------------------------

/*
  Los escalones de la lista. `max_qty` en null es el último tramo, el que no
  tiene tope: del lado del navegador eso se lee como Infinity.

  Los importes son SIN IVA, igual que la lista impresa.
*/
create table if not exists price_tiers (
  id            bigint generated always as identity primary key,
  min_qty       integer not null check (min_qty > 0),
  max_qty       integer check (max_qty is null or max_qty >= min_qty),
  plain_price   numeric(12, 2) not null check (plain_price >= 0),
  drilled_price numeric(12, 2) not null check (drilled_price >= 0),
  kind          text not null check (kind in ('minorista', 'mayorista')),
  updated_at    timestamptz not null default now()
);

comment on table price_tiers is
  'Lista de precios por cantidad, sin IVA. La landing la lee sin autenticarse.';

-- ---------------------------------------------------------------------------
-- Clientes y leads
-- ---------------------------------------------------------------------------

create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (char_length(nombre) between 1 and 160),
  tipo          text not null default 'minorista' check (tipo in ('minorista', 'mayorista')),
  telefono      text,
  email         text,
  cuit          text,
  direccion     text,
  localidad     text,
  provincia     text,
  codigo_postal text,
  notas         text,
  created_at    timestamptz not null default now()
);

/*
  Cada presupuesto simulado en la web cae acá.

  `customer_id` queda en null hasta que alguien del ERP convierte el lead en
  cliente; ahí los dos quedan enlazados y se puede ver qué había cotizado antes
  de comprar.
*/
create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  nombre          text not null check (char_length(nombre) between 1 and 160),
  telefono        text,
  email           text,
  cantidad        integer check (cantidad > 0),
  agujereada      boolean not null default false,
  entrega         text not null default 'retiro' check (entrega in ('retiro', 'envio')),
  codigo_postal   text,
  localidad       text,
  provincia       text,
  kilometros      integer,
  precio_unitario numeric(12, 2),
  mercaderia      numeric(14, 2),
  estado          text not null default 'nuevo'
                  check (estado in ('nuevo', 'contactado', 'ganado', 'perdido')),
  notas           text,
  customer_id     uuid references customers (id) on delete set null
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_estado_idx on leads (estado);

/*
  De dónde salió el contacto.

  Al principio los leads sólo podían venir del simulador de la web, así que no
  hacía falta preguntarlo. Ahora se cargan también a mano —el que escribe por
  Instagram, el que llama, el que te pasó un conocido— y sin esta columna todos
  esos quedarían mezclados con los de la web y la pauta sería plata que se gasta
  a ciegas.

  El default es 'web' porque es el único origen que existía hasta acá: los leads
  ya cargados vinieron todos de ahí.

  La restricción se rehace en vez de crearse a secas para que el archivo se
  pueda volver a correr: `add constraint` sin más falla si ya está.
*/
alter table leads add column if not exists origen text not null default 'web';

alter table leads drop constraint if exists leads_origen_check;
alter table leads add constraint leads_origen_check
  check (origen in ('web', 'instagram', 'whatsapp', 'telefono', 'referido', 'feria', 'otro'));

create index if not exists leads_origen_idx on leads (origen);

-- ---------------------------------------------------------------------------
-- Productos y pedidos
-- ---------------------------------------------------------------------------

create table if not exists products (
  id      uuid primary key default gen_random_uuid(),
  codigo  text not null unique,
  nombre  text not null,
  drilled boolean not null default false,
  activo  boolean not null default true
);

/*
  Un pedido arranca como presupuesto y va cambiando de estado. Descuenta stock
  recién cuando se entrega (lo hace el trigger de más abajo) y pesa en la cuenta
  corriente del cliente desde que se confirma.

  `flete` en null significa "a cotizar", que es lo que corresponde mientras no
  lo haya tarifado la empresa de transporte. Cero es otra cosa: cero es sin
  cargo, como cuando el cliente retira.
*/
create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  numero            integer generated always as identity,
  customer_id       uuid not null references customers (id) on delete restrict,
  lead_id           uuid references leads (id) on delete set null,
  estado            text not null default 'presupuesto'
                    check (estado in ('presupuesto', 'confirmado', 'en_produccion', 'entregado', 'cancelado')),
  fecha             date not null default current_date,
  entrega           text not null default 'retiro' check (entrega in ('retiro', 'envio')),
  direccion_entrega text,
  localidad         text,
  provincia         text,
  codigo_postal     text,
  kilometros        integer,
  flete             numeric(14, 2) check (flete is null or flete >= 0),
  notas             text,
  created_at        timestamptz not null default now()
);

create index if not exists orders_customer_idx on orders (customer_id);
create index if not exists orders_estado_idx on orders (estado);
create index if not exists orders_fecha_idx on orders (fecha desc);

create table if not exists order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  product_id      uuid not null references products (id) on delete restrict,
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
  subtotal        numeric(14, 2) generated always as (cantidad * precio_unitario) stored
);

create index if not exists order_items_order_idx on order_items (order_id);

-- ---------------------------------------------------------------------------
-- Cobros
-- ---------------------------------------------------------------------------

create table if not exists payments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders (id) on delete cascade,
  monto      numeric(14, 2) not null check (monto > 0),
  metodo     text not null default 'transferencia'
             check (metodo in ('efectivo', 'transferencia', 'cheque', 'otro')),
  fecha      date not null default current_date,
  nota       text,
  created_at timestamptz not null default now()
);

create index if not exists payments_order_idx on payments (order_id);
create index if not exists payments_fecha_idx on payments (fecha desc);

-- ---------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------

/*
  El stock no se guarda como un número que se pisa: se guarda el movimiento que
  lo cambió y el saldo se suma. Así siempre se puede contestar "¿por qué hay
  esta cantidad?" mirando la historia, y dos cargas a la vez no se pisan entre
  sí.

  `cantidad` positiva entra y negativa sale.
*/
create table if not exists stock_movements (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete restrict,
  tipo       text not null check (tipo in ('produccion', 'venta', 'ajuste', 'devolucion')),
  cantidad   integer not null check (cantidad <> 0),
  order_id   uuid references orders (id) on delete set null,
  fecha      date not null default current_date,
  nota       text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on stock_movements (product_id);
create index if not exists stock_movements_fecha_idx on stock_movements (fecha desc);
create index if not exists stock_movements_order_idx on stock_movements (order_id);

/*
  Entregar un pedido descuenta su mercadería del stock, y volverlo atrás la
  devuelve. Está en un trigger y no en el ERP a propósito: si el descuento
  dependiera de que la pantalla haga las dos escrituras, una pestaña cerrada a
  la mitad dejaría el stock mintiendo.
*/
create or replace function sync_stock_on_delivery() returns trigger
language plpgsql
security definer
set search_path = public
as $trigger$
begin
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    insert into stock_movements (product_id, tipo, cantidad, order_id, fecha, nota)
    select i.product_id, 'venta', -i.cantidad, new.id, new.fecha,
           'Entrega del pedido #' || new.numero
    from order_items i
    where i.order_id = new.id;

  elsif old.estado = 'entregado' and new.estado is distinct from 'entregado' then
    delete from stock_movements
    where order_id = new.id and tipo = 'venta';
  end if;

  return new;
end;
$trigger$;

drop trigger if exists orders_sync_stock on orders;
create trigger orders_sync_stock
  after update of estado on orders
  for each row
  execute function sync_stock_on_delivery();

-- ---------------------------------------------------------------------------
-- Vendedores
-- ---------------------------------------------------------------------------

/*
  Quien trae la venta y se lleva una comisión por traerla.

  `comision_pct` es el porcentaje habitual de esa persona —el 5% de arranque—,
  pero es sólo el valor que se propone al cargar el pedido: cada venta guarda el
  suyo. Si mañana se negocia distinto en un pedido grande, cambiarlo acá no
  tiene que reescribir lo que ya se acordó en los pedidos viejos.
*/
create table if not exists sellers (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null unique check (char_length(nombre) between 1 and 120),
  telefono     text,
  email        text,
  comision_pct numeric(5, 2) not null default 5
               check (comision_pct >= 0 and comision_pct <= 100),
  activo       boolean not null default true,
  notas        text,
  created_at   timestamptz not null default now()
);

/*
  La localidad no es un dato administrativo: va impresa en el folleto y en la
  lista de precios que reparte cada vendedor, al lado de su teléfono. Un cliente
  que llama tiene que saber con quién está hablando y desde dónde.
*/
alter table sellers add column if not exists localidad text;

-- ---------------------------------------------------------------------------
-- Fletes
-- ---------------------------------------------------------------------------

/*
  Los transportes con los que se trabaja: expresos, correos y el camión propio.

  `tipo` es 'propio' para el camión de la empresa. No cambia ninguna cuenta
  —sale plata igual, sólo que la cobra uno mismo—, pero sirve para verlo
  distinto en la comparación y para saber cuándo conviene mandarlo.
*/
create table if not exists carriers (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique check (char_length(nombre) between 1 and 120),
  tipo       text not null default 'expreso'
             check (tipo in ('expreso', 'correo', 'propio', 'otro')),
  contacto   text,
  telefono   text,
  email      text,
  plazo_dias integer check (plazo_dias is null or plazo_dias >= 0),
  activo     boolean not null default true,
  notas      text,
  created_at timestamptz not null default now()
);

/*
  Hasta dónde llega cada transporte, por rango de código postal.

  Se guarda por rango y no por localidad a propósito: los expresos tarifan por
  zona —"todo Cuyo", "AMBA"—, no localidad por localidad, y el pedido ya trae el
  código postal cargado. Un transporte puede tener las zonas que quiera y pueden
  solaparse; al cotizar se toma la más barata que cubra ese destino.
*/
create table if not exists carrier_zones (
  id         uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers (id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 120),
  cp_desde   integer not null check (cp_desde between 1000 and 9999),
  cp_hasta   integer not null check (cp_hasta between 1000 and 9999),
  plazo_dias integer check (plazo_dias is null or plazo_dias >= 0),
  check (cp_hasta >= cp_desde)
);

create index if not exists carrier_zones_carrier_idx on carrier_zones (carrier_id);
create index if not exists carrier_zones_cp_idx on carrier_zones (cp_desde, cp_hasta);

/*
  El tarifario: cuánto sale mandar tantas varillas a esa zona.

  El precio tiene dos partes porque los transportes cobran de las dos maneras y
  a veces de las dos a la vez: `precio_fijo` es el importe del envío y
  `precio_por_unidad` lo que se suma por varilla. Uno de los dos en cero cubre
  el caso simple; los dos cargados cubren el "mínimo más excedente".
*/
create table if not exists carrier_rates (
  id                uuid primary key default gen_random_uuid(),
  zone_id           uuid not null references carrier_zones (id) on delete cascade,
  min_qty           integer not null check (min_qty > 0),
  max_qty           integer check (max_qty is null or max_qty >= min_qty),
  precio_fijo       numeric(14, 2) not null default 0 check (precio_fijo >= 0),
  precio_por_unidad numeric(12, 2) not null default 0 check (precio_por_unidad >= 0),
  updated_at        timestamptz not null default now()
);

create index if not exists carrier_rates_zone_idx on carrier_rates (zone_id);

/*
  El código postal escrito a mano viene de cualquier forma: "1900", "B1900",
  "B1900ABC", a veces con espacios. Lo que ubica la zona son los cuatro dígitos
  del medio, así que se sacan de donde estén en vez de exigir un formato que
  nadie tipea igual dos veces.
*/
create or replace function cp_numero(cp text) returns integer
language sql
immutable
as $$
  select (substring(cp from '[0-9]{4}'))::integer;
$$;

/*
  Qué transportes llegan a ese destino y cuánto cobra cada uno por esa cantidad.

  Está en la base y no en el ERP porque es la respuesta a una pregunta sobre
  datos —"quién llega hasta acá y a cuánto"— y porque así la contesta igual
  quien la haga: la pantalla del pedido hoy, un informe mañana.

  `distinct on` deja una fila por transporte: si dos zonas del mismo transporte
  cubren el destino, gana la más barata. El resultado sale ordenado por precio,
  que es el orden en que se quiere leer.
*/
create or replace function cotizar_flete(cp text, cantidad integer)
returns table (
  carrier_id uuid,
  nombre     text,
  tipo       text,
  zona       text,
  plazo_dias integer,
  precio     numeric
)
language sql
stable
as $$
  select o.op_carrier, o.op_nombre, o.op_tipo, o.op_zona, o.op_plazo, o.op_precio
  from (
    select distinct on (c.id)
      c.id                                 as op_carrier,
      c.nombre                             as op_nombre,
      c.tipo                               as op_tipo,
      z.nombre                             as op_zona,
      coalesce(z.plazo_dias, c.plazo_dias) as op_plazo,
      round(r.precio_fijo + r.precio_por_unidad * cantidad, 2) as op_precio
    from carriers c
    join carrier_zones z on z.carrier_id = c.id
    join carrier_rates r on r.zone_id = z.id
    where c.activo
      and cp_numero(cp) between z.cp_desde and z.cp_hasta
      and cantidad >= r.min_qty
      and (r.max_qty is null or cantidad <= r.max_qty)
    order by c.id, r.precio_fijo + r.precio_por_unidad * cantidad
  ) o
  order by o.op_precio;
$$;

-- ---------------------------------------------------------------------------
-- Costos
-- ---------------------------------------------------------------------------

/*
  Todo lo que sale de la empresa.

  El tipo no es sólo una etiqueta para ordenar: define **quién paga el gasto**.
  Hay dos grupos y la diferencia es de plata, no de prolijidad:

  - Los **operativos** —producción, flete — salen de la
    ganancia antes de repartir. Los paga la empresa.
  - Los **de reinversión** —pauta, muestras, suscripciones, otros— los paga la
    parte de reinversión del reparto. Para eso existe ese 5%: no es plata que se
    guarda, es plata con destino.

  `order_id` es opcional: un gasto puede ser de un pedido puntual —un flete que
  se pagó, una producción especial— o del mes en general, como la pauta.
*/
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null default current_date,
  tipo        text not null
              check (tipo in ('produccion', 'pauta', 'muestras', 'suscripciones',
                              'flete', 'otro')),
  descripcion text not null check (char_length(descripcion) between 1 and 200),
  monto       numeric(14, 2) not null check (monto > 0),
  proveedor   text,
  order_id    uuid references orders (id) on delete set null,
  notas       text,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_fecha_idx on expenses (fecha desc);
create index if not exists expenses_tipo_idx on expenses (tipo);
create index if not exists expenses_order_idx on expenses (order_id);

/*
  `suscripciones` llegó después, y `if not exists` en la tabla no cambia el
  `check` de una que ya existe. Se rehace: `add constraint` a secas fallaría al
  volver a correr el archivo.
*/
alter table expenses drop constraint if exists expenses_tipo_check;
alter table expenses add constraint expenses_tipo_check
  check (tipo in ('produccion', 'pauta', 'muestras', 'suscripciones',
                  'flete', 'otro'));

-- ---------------------------------------------------------------------------
-- Reparto de ganancias
-- ---------------------------------------------------------------------------

/*
  Cómo se parte la ganancia neta del mes. Los porcentajes tienen que sumar 100;
  el ERP lo avisa en pantalla en vez de impedirlo, porque mientras se está
  editando la lista queda descuadrada por un rato y una restricción acá haría
  imposible cambiar dos filas.

  La reinversión no es una persona pero se lleva su parte igual que los socios,
  así que va como una fila más. `es_reinversion` sólo la distingue al mostrarla:
  la cuenta es la misma.
*/
create table if not exists profit_shares (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique check (char_length(nombre) between 1 and 80),
  porcentaje     numeric(6, 3) not null check (porcentaje >= 0 and porcentaje <= 100),
  es_reinversion boolean not null default false,
  orden          integer not null default 0,
  activo         boolean not null default true
);

/*
  Lo que efectivamente se le pagó a cada uno.

  Hasta acá el reparto era una cuenta en pantalla: decía cuánto le tocaba a cada
  socio pero no quedaba registro de qué se pagó ni cuándo. Eso alcanza el primer
  mes y deja de alcanzar al tercero, cuando alguien pregunta si ya cobró lo de
  septiembre y la única respuesta es la memoria de otro.

  `tipo` separa las dos cosas que se liquidan, porque se deciden distinto:

  - `reparto` es la parte del mes: el porcentaje sobre la ganancia.
  - `pozo` es la liquidación de la reserva de reinversión que venció, que se
    reparte a la inversa de los porcentajes.

  El monto se guarda y no se recalcula: es lo que se pagó ese día. Si mañana se
  corrige un gasto viejo y la cuenta del mes cambia, lo que ya se pagó no cambia
  —y la diferencia se ve, que es justamente para lo que sirve tener el registro.

  `on delete restrict` sobre la parte: borrar a un socio con pagos hechos
  dejaría plata sin dueño en el historial.
*/
create table if not exists profit_payouts (
  id         uuid primary key default gen_random_uuid(),
  share_id   uuid not null references profit_shares (id) on delete restrict,
  mes        date not null,
  tipo       text not null default 'reparto' check (tipo in ('reparto', 'pozo')),
  monto      numeric(14, 2) not null check (monto <> 0),
  fecha      date not null default current_date,
  nota       text,
  created_at timestamptz not null default now()
);

create index if not exists profit_payouts_mes_idx on profit_payouts (mes desc);
create index if not exists profit_payouts_share_idx on profit_payouts (share_id, mes);

/*
  Al principio esta tabla tenía una restricción de unicidad por socio, mes y
  concepto, para que dos clics no generaran un doble pago. Se sacó cuando
  apareció la liquidación parcial: pagar a cuenta y completar después son varios
  pagos legítimos del mismo mes, y la restricción los impedía.

  Contra el doble pago ahora protege la pantalla, que muestra cuánto se lleva
  pagado y cuánto falta antes de registrar nada. Es una defensa más débil, pero
  la anterior prohibía algo que hay que poder hacer.
*/
alter table profit_payouts drop constraint if exists profit_payouts_share_id_mes_tipo_key;

-- ---------------------------------------------------------------------------
-- Columnas que se agregaron a `orders` después
-- ---------------------------------------------------------------------------

/*
  Van acá y no arriba, en el `create table`, para que el archivo se pueda volver
  a correr sobre una base que ya existe: `if not exists` en la tabla no agrega
  columnas nuevas a una tabla ya creada, y estas tres llegaron con los
  vendedores y los fletes.

  `comision_pct` se copia del vendedor al cargar el pedido pero después vive por
  su cuenta: es lo que se acordó en *esta* venta.
*/
alter table orders add column if not exists seller_id uuid references sellers (id) on delete set null;
alter table orders add column if not exists carrier_id uuid references carriers (id) on delete set null;
alter table orders add column if not exists comision_pct numeric(5, 2)
  check (comision_pct is null or (comision_pct >= 0 and comision_pct <= 100));

/*
  Cuándo se lo lleva.

  Va aparte de `fecha`, que es cuándo se tomó el pedido, porque son dos cosas
  distintas y la de arriba es la que ordena la contabilidad: un pedido de marzo
  que se retira en abril se vendió en marzo.

  Es nullable a propósito, y esa es la parte importante: el que llama y dice
  «la semana que viene paso a buscar 50» no está dando una fecha. Obligarlo a
  elegir un día haría que alguien invente uno, y una agenda llena de fechas
  inventadas es peor que una que dice «a confirmar», porque no se sabe cuál es
  cuál. Vacío significa exactamente eso: quedó reservado, falta el día.
*/
alter table orders add column if not exists fecha_entrega date;

create index if not exists orders_fecha_entrega_idx on orders (fecha_entrega);

/*
  El descuento del presupuesto. Va sobre la mercadería y no sobre el flete: lo
  que se resigna es margen propio, y el transporte cobra lo mismo igual.

  Es plata de verdad, no un adorno del papel: baja el total, baja la cuenta
  corriente del cliente, baja la comisión del vendedor y baja la ganancia del
  mes. Por eso vive acá y no en la pantalla que imprime.

  Cero y no null, porque «sin descuento» es un descuento del 0% y no un dato que
  falta: así ninguna cuenta tiene que preguntarse qué hacer con la ausencia.
*/
alter table orders add column if not exists descuento_pct numeric(5, 2) not null default 0
  check (descuento_pct >= 0 and descuento_pct <= 100);

-- ---------------------------------------------------------------------------
-- Cuánto cuesta producir una varilla
-- ---------------------------------------------------------------------------

/*
  El costo de producción dejó de cargarse a mano como un gasto suelto y pasó a
  calcularse: se define una vez cuánto cuesta hacer una varilla y después cada
  producción que se carga al stock arrastra ese costo sola.

  Los conceptos tienen dos bases distintas y esa es la parte que hace falta
  modelar:

  - Los de **unidad** son los que se gastan por varilla vayan las horas que
    vayan: la materia prima, principalmente.
  - Los de **hora** son los que corren con el reloj —la luz, los sueldos, el
    alquiler del galpón— y no dependen de cuántas varillas salgan. Para pasarlos
    a costo por varilla hace falta saber cuántas hace la máquina por hora.

  De ahí sale la cuenta:

      costo por varilla = (lo de unidad) + (lo de hora ÷ varillas por hora)

  Producir más rápido abarata cada varilla sin que cambie ningún precio, que es
  exactamente lo que pasa en la realidad y lo que una lista de gastos sueltos no
  deja ver.
*/
create table if not exists production_costs (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique check (char_length(nombre) between 1 and 80),
  base       text not null check (base in ('unidad', 'hora')),
  monto      numeric(12, 4) not null default 0 check (monto >= 0),
  activo     boolean not null default true,
  orden      integer not null default 0,
  notas      text,
  updated_at timestamptz not null default now()
);

/*
  Cuántas varillas hace la máquina por hora. Es el número que convierte los
  costos por hora en costo por varilla, así que vale la pena medirlo bien: si
  está mal, todo el costeo está mal en la misma proporción.

  La tabla tiene una sola fila, forzada por la clave primaria booleana con
  `check (id)`: sólo `true` entra, y sólo una vez. Es un truco viejo, pero es
  más honesto que una tabla de una fila que nadie garantiza que sea una.
*/
create table if not exists production_setup (
  id                boolean primary key default true check (id),
  varillas_por_hora numeric(10, 2) not null default 0 check (varillas_por_hora >= 0),
  updated_at        timestamptz not null default now()
);

insert into production_setup (id) values (true) on conflict (id) do nothing;

/*
  Los cuatro conceptos que nombró el negocio, en cero: los montos los carga
  quien los conoce. Un número inventado acá sería peor que un cero, porque
  parecería el correcto y nadie lo revisaría.
*/
insert into production_costs (nombre, base, monto, orden)
select * from (values
  ('Materia prima', 'unidad', 0, 1),
  ('Luz',           'hora',   0, 2),
  ('Empleados',     'hora',   0, 3),
  ('Galpón',        'hora',   0, 4)
) as v(nombre, base, monto, orden)
where not exists (select 1 from production_costs);

/*
  El desglose y el total, para que la pantalla no rehaga la cuenta y para que la
  conteste igual quien la haga.

  Sin varillas por hora cargadas, la parte horaria no se puede repartir: queda
  en null en vez de en cero, porque cero diría "la luz no cuesta nada" cuando lo
  que pasa es que falta un dato.
*/
drop view if exists costo_varilla;

create view costo_varilla with (security_invoker = on) as
  with sumas as (
    select
      coalesce(sum(monto) filter (where base = 'unidad'), 0) as por_unidad,
      coalesce(sum(monto) filter (where base = 'hora'), 0)   as por_hora
    from production_costs
    where activo
  )
  select
    s.por_unidad,
    s.por_hora,
    p.varillas_por_hora,
    round(s.por_hora / nullif(p.varillas_por_hora, 0), 4) as por_hora_unitario,
    /*
      Si hay costos por hora y no hay varillas por hora, el costo no se puede
      calcular: queda en null, no en "sólo los materiales". Devolver el número
      incompleto sería peor que no devolver ninguno, porque se guardaría en cada
      producción como si fuera el costo real y nadie lo revisaría.
    */
    case
      when s.por_hora > 0 and coalesce(p.varillas_por_hora, 0) = 0 then null
      else round(
        s.por_unidad + coalesce(s.por_hora / nullif(p.varillas_por_hora, 0), 0),
        4
      )
    end as costo_unitario
  from sumas s
  cross join production_setup p;

/*
  El costo con el que se produjo cada tanda.

  Se guarda en el movimiento y no se recalcula al mirar, por lo mismo que el
  precio de una varilla vive en el ítem del pedido: si mañana sube la luz, lo
  que costó producir en marzo no puede cambiar. Un mes cerrado que se mueve solo
  es un mes en el que ya no se puede confiar.

  En null significa que esa producción se cargó antes de que existiera el
  costeo. Cuenta como cero y la pantalla lo señala, en vez de inventarle el
  costo de hoy.
*/
alter table stock_movements add column if not exists costo_unitario numeric(12, 4)
  check (costo_unitario is null or costo_unitario >= 0);

create index if not exists orders_seller_idx on orders (seller_id);
-- ---------------------------------------------------------------------------
-- Reciclado por encargo
-- ---------------------------------------------------------------------------

/*
  Hay empresas que no compran varillas: nos traen su propio plástico para que se
  lo reciclemos y se llevan las varillas que salen de ahí.

  Es otro negocio, no otro precio. No se cobra mercadería —la materia prima es
  de ellos— sino el tiempo de las máquinas: la que procesa el plástico y la de
  producción tienen cada una su tarifa por hora, y el trabajo se factura por las
  horas que llevó.

  De ahí se desprende lo más fácil de malinterpretar: **esas varillas nunca
  entran al stock**. No es un olvido, es que nunca fueron nuestras. Se anotan
  igual en el pedido, porque es lo que se le entrega al cliente y hay que poder
  contestar cuántas salieron de tantos kilos.
*/
create table if not exists service_rates (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique check (char_length(nombre) between 1 and 80),
  precio_hora numeric(12, 2) not null check (precio_hora >= 0),
  activo      boolean not null default true,
  orden       integer not null default 0,
  updated_at  timestamptz not null default now()
);

/*
  Las horas que llevó un trabajo, con la tarifa que tenían el día que se cargó.

  `precio_hora` se copia y no se lee de `service_rates` por lo mismo que el
  precio de una varilla vive en el ítem y no en la lista: cuando suba la tarifa,
  los trabajos ya facturados no pueden moverse solos.

  `concepto` también se copia, para que renombrar o dar de baja una tarifa no
  deje trabajos viejos diciendo "servicio borrado".
*/
create table if not exists order_services (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders (id) on delete cascade,
  rate_id     uuid references service_rates (id) on delete set null,
  concepto    text not null check (char_length(concepto) between 1 and 80),
  horas       numeric(8, 2) not null check (horas > 0),
  precio_hora numeric(12, 2) not null check (precio_hora >= 0),
  subtotal    numeric(14, 2) generated always as (horas * precio_hora) stored
);

create index if not exists order_services_order_idx on order_services (order_id);

/*
  Un cliente puede ser de tres clases ahora. `empresa` es la que trae su propio
  plástico; no compra por lista de precios, así que no le corresponde ninguna.
*/
alter table customers drop constraint if exists customers_tipo_check;
alter table customers add constraint customers_tipo_check
  check (tipo in ('minorista', 'mayorista', 'empresa'));

/*
  Qué clase de trabajo es el pedido.

  Vive en el pedido y no se deduce del cliente porque una empresa que nos manda
  plástico también puede comprarnos varillas alguna vez, y ese pedido sería una
  venta común. Se propone según el cliente al crearlo y se puede cambiar.

  Los kilos que entraron y las varillas que salieron son del trabajo de
  reciclado: en una venta quedan en null, que es lo que corresponde.
*/
alter table orders add column if not exists tipo text not null default 'venta';

alter table orders drop constraint if exists orders_tipo_check;
alter table orders add constraint orders_tipo_check check (tipo in ('venta', 'reciclado'));

alter table orders add column if not exists kilos_recibidos numeric(10, 2)
  check (kilos_recibidos is null or kilos_recibidos >= 0);
alter table orders add column if not exists varillas_entregadas integer
  check (varillas_entregadas is null or varillas_entregadas >= 0);

create index if not exists orders_tipo_idx on orders (tipo);


-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

/*
  Se tiran abajo antes de rehacerlas. `create or replace view` no acepta que
  cambie la lista de columnas, y `orders_summary` empieza con `orders.*`: cada
  columna nueva del pedido le corre las suyas. Sin el drop, volver a correr este
  archivo después de agregar una columna fallaría.

  El orden importa: las de abajo se apoyan en las de arriba.
*/
drop view if exists leads_por_origen;
drop view if exists finanzas_mensuales;
drop view if exists customer_balances;
drop view if exists orders_summary;
drop view if exists stock_actual;

/*
  `security_invoker` hace que la vista se lea con los permisos de quien
  consulta y no con los del dueño. Sin eso, las políticas de más abajo no se
  aplicarían al leer por vista, que es justo por donde se escaparía todo.
*/

/*
  Lo que hay, lo que está prometido y lo que queda.

  El stock físico solo no alcanza para contestar la pregunta que se hace todos
  los días, que no es «¿cuántas tengo?» sino «¿cuántas puedo vender?». Alguien
  llama, reserva 50 para retirar la semana que viene, y hasta que no pase a
  buscarlas siguen en el depósito: el número físico dice que están y son de
  otro.

  `comprometido` son las de los pedidos confirmados y en producción. El
  presupuesto no cuenta —todavía no es una venta y reservar contra una consulta
  paralizaría mercadería por nada— y el entregado tampoco, porque ese ya se
  descontó de verdad al salir.

  Reservar, entonces, no es una operación nueva que haya que inventar: es
  confirmar el pedido. Lo que faltaba era que se viera.
*/
create or replace view stock_actual with (security_invoker = on) as
  select
    p.id as product_id,
    p.codigo,
    p.nombre,
    p.drilled,
    coalesce(m.stock, 0)::integer as stock,
    coalesce(c.comprometido, 0)::integer as comprometido,
    (coalesce(m.stock, 0) - coalesce(c.comprometido, 0))::integer as disponible
  from products p
  left join lateral (
    select sum(cantidad) as stock from stock_movements where product_id = p.id
  ) m on true
  left join lateral (
    select sum(i.cantidad) as comprometido
    from order_items i
    join orders o on o.id = i.order_id
    where i.product_id = p.id
      and o.estado in ('confirmado', 'en_produccion')
  ) c on true
  where p.activo;

/*
  El pedido con sus números ya sumados: mercadería, total con flete, cobrado y
  saldo. Evita que cada pantalla del ERP rehaga la misma cuenta y alguna se
  olvide de una parte.
*/
/*
  La comisión se devenga a medida que el cliente paga, no cuando se entrega: si
  el pedido se entregó y todavía no se cobró, el vendedor todavía no ganó nada.
  Por eso `cobrado` —la porción del pedido que ya está paga— multiplica al
  porcentaje.

  Se calcula sobre la mercadería sola. El flete no es plata de la empresa: entra
  y sale hacia el transporte, y pagar comisión sobre eso sería pagar por mover
  plata ajena. Un pedido anulado no devenga nada aunque tenga cobros: si hubo
  plata de por medio se devuelve, no se comisiona.

  Un trabajo de reciclado tampoco: se cobra por hora de máquina, no hay
  mercadería, y la cuenta da cero sola sin ninguna regla especial. Si algún día
  hay que comisionar esas horas, esto es lo que habría que cambiar.

  Y las ventas a revendedores tampoco comisionan. Ya se les vende con la lista
  mayorista, que es más barata justamente porque compran todos los meses: el
  descuento *es* lo que se resigna, y encima pagar comisión sería resignarlo dos
  veces. Está acá y no sólo en la pantalla para que una comisión cargada por
  error no ensucie el resultado del mes en silencio.
*/
create or replace view orders_summary with (security_invoker = on) as
  select
    o.*,
    c.nombre   as cliente_nombre,
    c.telefono as cliente_telefono,
    c.tipo     as cliente_tipo,
    coalesce(i.unidades, 0)::integer as unidades,
    m.bruta                as mercaderia,
    m.descuento            as descuento,
    m.bruta - m.descuento  as mercaderia_neta,
    coalesce(s.servicios, 0) as servicios,
    m.bruta - m.descuento + coalesce(s.servicios, 0) + coalesce(o.flete, 0) as total,
    coalesce(p.pagado, 0)  as pagado,
    m.bruta - m.descuento + coalesce(s.servicios, 0) + coalesce(o.flete, 0)
      - coalesce(p.pagado, 0) as saldo,
    case
      when o.estado = 'cancelado' then 0
      when c.tipo = 'mayorista' then 0
      else round(
        (m.bruta - m.descuento)
          * coalesce(o.comision_pct, 0) / 100
          * least(
              coalesce(
                coalesce(p.pagado, 0)
                  / nullif(m.bruta - m.descuento + coalesce(o.flete, 0), 0),
                0),
              1),
        2)
    end as comision
  from orders o
  join customers c on c.id = o.customer_id
  left join lateral (
    select sum(cantidad) as unidades, sum(subtotal) as mercaderia
    from order_items where order_id = o.id
  ) i on true
  /*
    La mercadería bruta y el descuento se calculan una sola vez acá: aparecen en
    cinco columnas de abajo y repetir la expresión es la forma segura de que
    alguna quede desactualizada cuando cambie la regla.
  */
  left join lateral (
    select
      coalesce(i.mercaderia, 0) as bruta,
      round(coalesce(i.mercaderia, 0) * o.descuento_pct / 100, 2) as descuento
  ) m on true
  /*
    Las horas de un trabajo de reciclado. En una venta no hay ninguna y suma
    cero, así que la cuenta es la misma para los dos tipos de pedido.
  */
  left join lateral (
    select sum(subtotal) as servicios from order_services where order_id = o.id
  ) s on true
  left join lateral (
    select sum(monto) as pagado from payments where order_id = o.id
  ) p on true;

/*
  Cuenta corriente. Un presupuesto todavía no es una deuda y un pedido anulado
  tampoco, así que ninguno de los dos entra en el saldo.
*/
create or replace view customer_balances with (security_invoker = on) as
  select
    c.id as customer_id,
    c.nombre,
    c.tipo,
    c.telefono,
    (count(o.id) filter (where o.estado not in ('presupuesto', 'cancelado')))::integer as pedidos,
    coalesce(sum(o.total)  filter (where o.estado not in ('presupuesto', 'cancelado')), 0) as facturado,
    coalesce(sum(o.pagado) filter (where o.estado not in ('presupuesto', 'cancelado')), 0) as cobrado,
    coalesce(sum(o.saldo)  filter (where o.estado not in ('presupuesto', 'cancelado')), 0) as saldo
  from customers c
  left join orders_summary o on o.customer_id = c.id
  group by c.id, c.nombre, c.tipo, c.telefono;

/*
  El resultado de cada mes: lo que entró, lo que salió y lo que quedó.

  Es el número sobre el que se reparte. Un mes aparece si tuvo ventas o si tuvo
  gastos —de ahí la unión de los dos lados—, porque un mes sin ventas pero con
  pauta paga igual y tiene que verse.

  Qué cuenta como venta: los pedidos desde que se confirman, por su fecha. Un
  presupuesto todavía no es nada y un pedido anulado tampoco, igual que en la
  cuenta corriente.

  El flete entra de los dos lados —facturado como ingreso, pagado como gasto de
  tipo 'flete'— en vez de quedar afuera. Así, si se cobró más de lo que costó,
  esa diferencia aparece donde tiene que aparecer en lugar de perderse.

  Una cosa que conviene tener presente: la comisión se imputa al mes del pedido
  pero se devenga cuando el cliente paga, así que un mes ya cerrado puede
  moverse un poco si entra un cobro viejo. Es a propósito: la alternativa era
  llevar dos fechas por comisión y no vale la complicación para un equipo de
  tres.
*/
create or replace view finanzas_mensuales with (security_invoker = on) as
  with meses as (
    select date_trunc('month', fecha)::date as mes
    from orders where estado not in ('presupuesto', 'cancelado')
    union
    select date_trunc('month', fecha)::date from expenses
    union
    select date_trunc('month', fecha)::date from stock_movements where tipo = 'produccion'
  ),

  /*
    El costo de producción del mes: cuántas varillas se fabricaron por lo que
    costaba hacerlas. Ya no se carga a mano como un gasto suelto —se cargaba
    dos veces o ninguna— sino que sale del propio movimiento de stock.

    `costo_unitario` en null es una producción cargada antes de que existiera
    el costeo: suma cero y la pantalla lo señala, en vez de aplicarle el costo
    de hoy a algo que se hizo con otros precios.
  */
  produccion as (
    select
      date_trunc('month', fecha)::date as mes,
      sum(cantidad)::integer as varillas,
      sum(cantidad * coalesce(costo_unitario, 0)) as costo
    from stock_movements
    where tipo = 'produccion'
    group by 1
  ),
  ventas as (
    select
      date_trunc('month', o.fecha)::date as mes,
      count(*)::integer     as pedidos,
      sum(o.mercaderia_neta) as mercaderia,
      sum(o.servicios)       as servicios,
      sum(o.descuento)       as descuento,
      sum(coalesce(o.flete, 0)) as flete,
      sum(o.pagado)         as cobrado,
      sum(o.comision)       as comisiones
    from orders_summary o
    where o.estado not in ('presupuesto', 'cancelado')
    group by 1
  ),
  /*
    Los gastos se separan en dos porque los paga gente distinta.

    Los operativos salen de la ganancia antes de repartir: los paga la empresa.
    Los de reinversión los paga la parte de reinversión del reparto, que para
    eso existe. Si esa parte no alcanza, sube —y esa escalera la resuelve el
    ERP, no esta vista, porque depende de los porcentajes de cada socio.
  */
  costos as (
    select
      date_trunc('month', fecha)::date as mes,
      /*
        El total excluye los gastos de tipo 'produccion': ese costo ahora sale
        del stock. Los que hayan quedado cargados se muestran aparte para que se
        vean y se puedan limpiar, pero no se suman a ningún lado —contarlos
        sería cobrarse la producción dos veces.
      */
      sum(monto) filter (where tipo <> 'produccion')   as total,
      sum(monto) filter (where tipo = 'produccion')    as produccion_manual,
      sum(monto) filter (where tipo = 'flete')         as flete,
      sum(monto) filter (where tipo = 'pauta')         as pauta,
      sum(monto) filter (where tipo = 'muestras')      as muestras,
      sum(monto) filter (where tipo = 'suscripciones') as suscripciones,
      sum(monto) filter (where tipo = 'otro')          as otros,
      sum(monto) filter (where tipo = 'flete') as operativos,
      sum(monto) filter (where tipo in ('pauta', 'muestras', 'suscripciones', 'otro'))
        as reinversion
    from expenses
    group by 1
  )
  select
    m.mes,
    coalesce(v.pedidos, 0)     as pedidos,
    coalesce(v.mercaderia, 0)  as mercaderia,
    coalesce(v.servicios, 0)   as servicios,
    coalesce(v.descuento, 0)   as descuento,
    coalesce(v.flete, 0)       as flete_facturado,
    coalesce(v.mercaderia, 0) + coalesce(v.servicios, 0) + coalesce(v.flete, 0)
      as facturado,
    coalesce(v.cobrado, 0)     as cobrado,
    coalesce(v.comisiones, 0)  as comisiones,

    coalesce(pr.varillas, 0)         as varillas_producidas,
    coalesce(pr.costo, 0)            as costo_produccion,
    /* Lo que quedó cargado a mano como gasto de producción y ya no se cuenta. */
    coalesce(c.produccion_manual, 0) as costo_produccion_cargado,
    coalesce(c.flete, 0)             as costo_flete,
    coalesce(c.pauta, 0)          as costo_pauta,
    coalesce(c.muestras, 0)       as costo_muestras,
    coalesce(c.suscripciones, 0)  as costo_suscripciones,
    coalesce(c.otros, 0)          as costo_otros,

    coalesce(c.operativos, 0) + coalesce(pr.costo, 0) as costos_operativos,
    coalesce(c.reinversion, 0) as costos_reinversion,
    coalesce(c.total, 0) + coalesce(pr.costo, 0) as costos,

    /*
      La que se reparte: lo facturado menos lo que paga la empresa. Los gastos
      de reinversión no se restan acá porque no los paga la empresa, los paga
      una de las partes del reparto.
    */
    coalesce(v.mercaderia, 0) + coalesce(v.servicios, 0) + coalesce(v.flete, 0)
      - coalesce(v.comisiones, 0)
      - coalesce(c.operativos, 0) - coalesce(pr.costo, 0) as ganancia_base,

    /* El resultado de verdad del mes, con todo descontado. */
    coalesce(v.mercaderia, 0) + coalesce(v.servicios, 0) + coalesce(v.flete, 0)
      - coalesce(v.comisiones, 0)
      - coalesce(c.total, 0) - coalesce(pr.costo, 0) as ganancia_neta
  from meses m
  left join ventas v on v.mes = m.mes
  left join costos c on c.mes = m.mes
  left join produccion pr on pr.mes = m.mes;

/*
  De dónde vinieron los contactos del mes y qué terminaron dejando.

  Es el otro lado de la pauta: en `finanzas_mensuales` se ve cuánto se gastó en
  publicidad, y acá cuántos contactos trajo cada canal y cuánto facturaron. Sin
  esto, la pauta es un gasto que baja la ganancia sin que nada diga si sirvió.

  La venta se imputa al mes del **lead**, no al del pedido, y es a propósito: lo
  que se está midiendo es la captación. Un contacto de septiembre que compra en
  noviembre lo trajo la plata que se gastó en septiembre.

  La atribución va por el cliente y no por `orders.lead_id`: esa columna existe
  pero el ERP no la completa nunca, así que apoyarse en ella daría cero siempre
  —una columna que parece decir algo y está vacía es peor que no tenerla—. Lo
  que sí se completa es `leads.customer_id`, al hacer cliente a un lead.

  A cada cliente se le atribuye **un solo** lead: el primero que lo trajo. Si
  alguien preguntó tres veces antes de comprar, contar sus ventas en los tres
  las triplicaría y la suma de los canales no daría lo facturado.

  Lo que no se puede atribuir no se reparte por aproximación: un cliente cargado
  a mano, sin ningún lead detrás, no suma en ningún canal.
*/
create or replace view leads_por_origen with (security_invoker = on) as
  with primer_lead as (
    select distinct on (l.customer_id)
      l.id as lead_id,
      l.customer_id
    from leads l
    where l.customer_id is not null
    order by l.customer_id, l.created_at
  ),
  ventas as (
    select p.lead_id, sum(s.mercaderia_neta) as facturado
    from primer_lead p
    join orders_summary s on s.customer_id = p.customer_id
    where s.estado not in ('presupuesto', 'cancelado')
    group by p.lead_id
  )
  select
    date_trunc('month', l.created_at)::date as mes,
    l.origen,
    count(*)::integer as leads,
    count(*) filter (where l.estado = 'ganado')::integer   as ganados,
    count(*) filter (where l.estado = 'perdido')::integer  as perdidos,
    count(*) filter (where l.estado = 'nuevo')::integer    as sin_contactar,
    coalesce(sum(v.facturado), 0) as facturado
  from leads l
  left join ventas v on v.lead_id = l.id
  group by 1, 2;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

alter table price_tiers     enable row level security;
alter table customers       enable row level security;
alter table leads           enable row level security;
alter table products        enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table payments        enable row level security;
alter table stock_movements enable row level security;
alter table sellers         enable row level security;
alter table carriers        enable row level security;
alter table carrier_zones   enable row level security;
alter table carrier_rates   enable row level security;
alter table expenses        enable row level security;
alter table profit_shares   enable row level security;
alter table profit_payouts  enable row level security;
alter table service_rates   enable row level security;
alter table order_services  enable row level security;
alter table production_costs enable row level security;
alter table production_setup enable row level security;

/*
  Supabase ya suele dar estos permisos sola al crear tablas nuevas, pero
  dejarlos escritos hace que el archivo se pueda correr en cualquier proyecto
  —incluso uno viejo con los permisos por defecto cambiados— y quede igual.
  El GRANT sólo abre la puerta: quién pasa lo deciden las políticas de abajo.
*/
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on price_tiers to anon;
grant insert on leads to anon;

/*
  Las funciones quedan abiertas a todo el mundo por defecto en Postgres, y
  PostgREST las publica como endpoints. `cotizar_flete` sólo lee tablas que la
  política deja ver a quien tiene sesión, así que sin sesión ya devolvería vacío
  —pero es mejor que el tarifario no figure siquiera como una puerta que se
  puede tocar desde afuera.
*/
revoke execute on function cp_numero(text) from public;
revoke execute on function cotizar_flete(text, integer) from public;
grant execute on function cp_numero(text) to authenticated;
grant execute on function cotizar_flete(text, integer) to authenticated;

/*
  Adentro del ERP no hay grados: cualquiera con sesión iniciada trabaja con
  todo. Los usuarios se crean a mano desde el panel de Supabase —no hay
  registro abierto—, así que la lista de quién entra la controlás vos.
*/
do $permisos$
declare
  tabla text;
begin
  foreach tabla in array array[
    'price_tiers', 'customers', 'leads', 'products',
    'orders', 'order_items', 'payments', 'stock_movements',
    'sellers', 'carriers', 'carrier_zones', 'carrier_rates',
    'expenses', 'profit_shares', 'profit_payouts',
    'service_rates', 'order_services',
    'production_costs', 'production_setup'
  ] loop
    execute format('drop policy if exists "equipo" on %I', tabla);
    execute format(
      'create policy "equipo" on %I for all to authenticated using (true) with check (true)',
      tabla
    );
  end loop;
end
$permisos$;

/* La landing muestra precios sin que nadie inicie sesión. */
drop policy if exists "la web lee precios" on price_tiers;
create policy "la web lee precios" on price_tiers
  for select to anon using (true);

/*
  El simulador deja el contacto sin sesión, igual que hoy lo deja en la planilla
  de Google. Sólo puede insertar —nunca leer ni editar— y siempre como lead
  nuevo, para que nadie desde afuera se marque solo como venta ganada.

  Cualquiera con la clave pública puede escribir acá. Es la misma exposición que
  ya tenía la planilla, y para juntar contactos no es un problema, pero conviene
  no guardar nada sensible en esta tabla.
*/
drop policy if exists "el simulador deja leads" on leads;
create policy "el simulador deja leads" on leads
  for insert to anon
  with check (
    estado = 'nuevo'
    and customer_id is null
    /*
      Sin sesión sólo se puede dejar un lead diciendo que vino de la web, que es
      de donde efectivamente viene el simulador. Si no, cualquiera con la clave
      pública podría cargar leads firmados como "referido" o "instagram" y la
      medición de la pauta pasaría a ser un número que se puede inventar desde
      afuera. Los otros orígenes se cargan a mano, con sesión.
    */
    and origen = 'web'
    and char_length(nombre) between 1 and 160
    and (cantidad is null or cantidad between 1 and 1000000)
    and (notas is null or char_length(notas) <= 500)
  );

-- ---------------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------------

/* Los dos productos que se venden. Si ya están, no se duplican. */
insert into products (codigo, nombre, drilled)
values
  ('VAR-COMUN', 'Varilla 3x3x120 sin agujerear', false),
  ('VAR-AGUJ',  'Varilla 3x3x120 agujereada',    true)
on conflict (codigo) do nothing;

/*
  Las dos listas vigentes desde el 01/09/2026, las mismas que están en
  `src/data/pricing.js`. Se cargan sólo si la tabla está vacía: una vez que
  edites precios desde el ERP, volver a correr este archivo no te los pisa.

  Son dos listas independientes, cada una con sus escalones. La mayorista
  arranca en 1.000 porque es la de los revendedores, y su recargo por
  agujereado es de $250 en todos los tramos.
*/
insert into price_tiers (min_qty, max_qty, plain_price, drilled_price, kind)
select * from (values
  (1,     99,   2950, 3450, 'minorista'),
  (100,   499,  2900, 3400, 'minorista'),
  (500,   999,  2850, 3350, 'minorista'),
  (1000,  4999, 2750, 3250, 'minorista'),
  (5000,  null, 2550, 2800, 'minorista'),

  (1000,  4999, 2655, 2905, 'mayorista'),
  (5000,  9999, 2475, 2725, 'mayorista'),
  (10000, null, 2295, 2545, 'mayorista')
) as v(min_qty, max_qty, plain_price, drilled_price, kind)
where not exists (select 1 from price_tiers);

/*
  Corrección para las bases que se crearon antes de que existieran dos listas.

  En aquella versión `kind` no decía "de qué lista es este escalón" sino "a
  partir de acá el precio es de volumen": los tramos de 1.000 y 5.000 estaban
  rotulados 'mayorista' pero con los precios que paga cualquiera. Con dos listas
  de verdad ese rótulo hace que un particular que compra 1.000 pague el precio
  del distribuidor, que es justo lo que no se quiere.

  Así que a esos escalones se les corrige el rótulo y se carga la lista
  mayorista real. El tramo de 10.000 unidades sólo existe en la lista nueva, así
  que sirve de marca: si ya está, esto no vuelve a tocar nada.
*/
do $listas$
begin
  if not exists (select 1 from price_tiers where kind = 'mayorista' and min_qty >= 10000) then
    update price_tiers set kind = 'minorista' where kind = 'mayorista';

    insert into price_tiers (min_qty, max_qty, plain_price, drilled_price, kind)
    values
      (1000,  4999, 2655, 2905, 'mayorista'),
      (5000,  9999, 2475, 2725, 'mayorista'),
      (10000, null, 2295, 2545, 'mayorista');
  end if;
end
$listas$;

/*
  Los dos conceptos que se le facturan a una empresa que trae su plástico. El
  precio arranca en cero a propósito: no lo sé, lo carga quien lo cobra. Un
  número inventado acá sería peor, porque parecería el correcto.
*/
insert into service_rates (nombre, precio_hora, orden)
select * from (values
  ('Hora de máquina (procesado de plástico)', 0, 1),
  ('Hora de producción',                      0, 2)
) as v(nombre, precio_hora, orden)
where not exists (select 1 from service_rates);

/*
  El reparto base de la planilla: 50 / 25 / 20 y un 5 de reinversión. Los
  nombres y los porcentajes se editan después desde el ERP; esto es sólo para
  que la pantalla no arranque en blanco.
*/
insert into profit_shares (nombre, porcentaje, es_reinversion, orden)
select * from (values
  ('Socio',       50.0, false, 1),
  ('Pipo',        25.0, false, 2),
  ('Lui',         20.0, false, 3),
  ('Reinversión',  5.0, true,  4)
) as v(nombre, porcentaje, es_reinversion, orden)
where not exists (select 1 from profit_shares);
