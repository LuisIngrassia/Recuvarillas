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
  notas           text,
  customer_id     uuid references customers (id) on delete set null
);

create index if not exists leads_created_at_idx on leads (created_at desc);

-- ---------------------------------------------------------------------------
-- Pipeline de leads
-- ---------------------------------------------------------------------------

/*
  El embudo comercial: en qué anda cada consulta y qué hay que hacer con ella.

  Reemplaza a los cuatro estados de antes (`nuevo / contactado / ganado /
  perdido`), que alcanzaban para una lista de pendientes pero no para saber
  dónde se cae la venta. "Contactado" tapaba tres situaciones que se trabajan
  distinto —le mandé la lista, le mandé el presupuesto, está regateando— y las
  tres quedaban indistinguibles.

  El principio que ordena todo lo de abajo: **todo lead en estado activo tiene
  que tener una próxima acción con fecha**. Un lead activo sin próxima acción es
  un lead perdido que todavía no se detectó, y la base no lo deja guardar.

  Los enums se crean adentro de un bloque porque `create type` no admite
  `if not exists` y este archivo se vuelve a correr entero.
*/
do $tipos$
begin
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type lead_status as enum (
      'new', 'qualifying', 'qualified', 'quoted',
      'negotiating', 'closing', 'won', 'dormant', 'lost'
    );
  end if;

  /* Qué es el que pregunta. Define qué lista de precios se le manda. */
  if not exists (select 1 from pg_type where typname = 'lead_type') then
    create type lead_type as enum ('end_user', 'installer', 'retailer', 'distributor');
  end if;

  /*
    De dónde salió el contacto.

    Los tres últimos no están en la spec y se agregan para no perder lo que ya
    estaba cargado en la columna `origen`. 'web' además es el único origen que
    el simulador puede escribir sin sesión: sacarlo dejaría a la landing sin
    poder dejar un lead.
  */
  if not exists (select 1 from pg_type where typname = 'lead_source') then
    create type lead_source as enum (
      'whatsapp_organic', 'instagram', 'cold_outreach', 'referral',
      'facebook', 'tiktok', 'other',
      'web', 'phone', 'fair'
    );
  end if;

  /*
    Por qué se perdió. Es el dato que dice si el problema es el precio, el flete
    o el producto; sin él "perdido" no explica nada y no se puede corregir.
  */
  if not exists (select 1 from pg_type where typname = 'lost_reason') then
    create type lost_reason as enum (
      'price', 'freight', 'lead_time', 'chose_wood',
      'chose_competitor', 'not_target', 'no_response', 'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'lead_event_type') then
    create type lead_event_type as enum (
      'inbound_message', 'auto_reply_sent', 'price_list_sent', 'quote_sent',
      'followup_sent', 'objection_raised', 'sample_requested',
      'status_change', 'note', 'reactivation_attempt'
    );
  end if;
end
$tipos$;

/*
  Las columnas del embudo.

  Los nombres nuevos van en inglés. Los que ya existían —`nombre`, `telefono`,
  `cantidad`, `agujereada`, `localidad`— se quedan como están: renombrarlos
  obliga a tocar el insert anónimo de la landing, donde el error se traga a
  propósito para no romperle el formulario a nadie, y un desfasaje entre esta
  migración y el deploy haría que los leads dejen de llegar sin que nada avise.
  El mapeo con los nombres de la spec:

    spec           acá
    -------------  ----------
    name           nombre
    phone          telefono
    zone           localidad
    qty_estimated  cantidad
    drilled        agujereada
*/
alter table leads add column if not exists status             lead_status not null default 'new';
alter table leads add column if not exists lead_type          lead_type;
alter table leads add column if not exists source             lead_source not null default 'web';
alter table leads add column if not exists next_action        text;
alter table leads add column if not exists next_action_at     timestamptz;
alter table leads add column if not exists owner              text;
alter table leads add column if not exists lost_reason        lost_reason;
alter table leads add column if not exists lost_notes         text;
alter table leads add column if not exists quote_amount       numeric(12, 2);
alter table leads add column if not exists quote_sent_at      timestamptz;
alter table leads add column if not exists won_amount         numeric(12, 2);
alter table leads add column if not exists won_at             timestamptz;
alter table leads add column if not exists dormant_until      date;
alter table leads add column if not exists reactivation_count integer not null default 0;
alter table leads add column if not exists updated_at         timestamptz not null default now();

/*
  Si van agujereadas dejó de ser sí o no: ahora hay un tercer caso, "todavía no
  se sabe", que es el de casi todo lead recién entrado. Sin ese null no hay cómo
  distinguir al que dijo que las quería lisas del que todavía no contestó, y es
  justo uno de los tres datos que hay que sacarle a alguien para poder cotizar.
*/
alter table leads alter column agujereada drop default;
alter table leads alter column agujereada drop not null;

/*
  Lo que se apoyaba en las columnas viejas, fuera antes de tocarlas.

  Postgres no deja borrar una columna de la que dependen otros objetos, y en una
  base que ya venía andando hay dos: la vista `leads_por_origen`, que agrupaba
  por `origen` y contaba por `estado`, y la política del simulador, que exigía
  `estado = 'nuevo'` y `origen = 'web'`.

  Las dos se vuelven a crear más abajo en este mismo archivo, ya escritas contra
  `status` y `source`, así que tirarlas acá no pierde nada. Va antes de la
  migración de datos y no después porque el `drop column` está adentro de ella.
*/
drop view if exists leads_por_origen;
drop policy if exists "el simulador deja leads" on leads;

/*
  Migración de los estados viejos.

  Corre una sola vez: en cuanto la columna `estado` deja de existir, el bloque
  se saltea solo. `contactado` cae en `qualifying` y no en `qualified` porque
  quería decir "le escribí", que es exactamente calificar todavía sin datos.

  Los perdidos viejos quedan con motivo 'other'. No hay forma de saber por qué
  se perdieron, y ponerles 'price' porque suele ser el motivo más común sería
  inventar justo el dato que vinimos a medir.
*/
do $migra_estado$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'estado'
  ) then
    update leads set
      status = case estado
        when 'nuevo'      then 'new'
        when 'contactado' then 'qualifying'
        when 'ganado'     then 'won'
        when 'perdido'    then 'lost'
        else 'new'
      end::lead_status,
      lost_reason = case when estado = 'perdido' then 'other'::lost_reason else lost_reason end,
      /*
        Los ganados viejos no tienen monto de venta anotado. Se usa lo que había
        cotizado el simulador, que es lo más cerca que se puede estar sin
        inventar; si no cotizó nada queda en cero, que se ve y se corrige,
        mientras que un null no se ve.
      */
      won_amount = case when estado = 'ganado' then coalesce(mercaderia, 0) else won_amount end,
      won_at     = case when estado = 'ganado' then created_at else won_at end,
      /*
        Los que quedan activos necesitan próxima acción, porque el guardián no
        deja guardar un lead activo sin ella y si no la tuvieran quedarían
        imposibles de editar. Se les pone para hoy: son leads que venían del
        modelo viejo sin nadie a cargo, y lo correcto es que aparezcan todos en
        la pantalla de "Hoy" para repasarlos de una vez.
      */
      next_action_at = case
        when estado in ('nuevo', 'contactado') then coalesce(next_action_at, now())
        else next_action_at
      end,
      next_action = case
        when estado in ('nuevo', 'contactado')
          then coalesce(next_action, 'Repasar: viene del modelo anterior')
        else next_action
      end;

    alter table leads drop column estado;
  end if;
end
$migra_estado$;

/* Los canales viejos, a los valores del enum. */
do $migra_origen$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'origen'
  ) then
    update leads set source = case origen
      when 'web'       then 'web'
      when 'instagram' then 'instagram'
      when 'facebook'  then 'facebook'
      when 'whatsapp'  then 'whatsapp_organic'
      when 'telefono'  then 'phone'
      when 'referido'  then 'referral'
      when 'feria'     then 'fair'
      else 'other'
    end::lead_source;

    alter table leads drop column origen;
  end if;
end
$migra_origen$;

drop index if exists leads_estado_idx;
drop index if exists leads_origen_idx;

create index if not exists leads_status_idx         on leads (status);
create index if not exists leads_source_idx         on leads (source);
create index if not exists leads_next_action_at_idx on leads (next_action_at);
create index if not exists leads_dormant_until_idx  on leads (dormant_until);
create index if not exists leads_localidad_idx      on leads (localidad);

/*
  El teléfono se indexa para buscar, pero **no** es único.

  La spec lo pide único como clave de deduplicación (§2.1) y a la vez pide abrir
  un lead nuevo cuando un cliente ganado vuelve a comprar (§8.1). Las dos cosas
  no pueden ser ciertas a la vez, y la segunda es la que coincide con cómo
  funciona esto: un lead es un hecho —"alguien preguntó por 500 el 3 de
  septiembre"— y la misma persona genera varios en dos años. Un único global
  además fallaría al crearse, porque en la base ya hay gente que cotizó tres
  veces desde la web.

  La deduplicación que la spec quiere de verdad —no abrir un lead nuevo cuando
  ya hay uno abierto para ese teléfono— la resuelve `lead_abierto(text)`, más
  abajo, que aplica la regla sin borrar historia.
*/
create index if not exists leads_telefono_idx on leads (telefono);

/*
  El historial de cada lead. Append-only: nada de acá se edita ni se borra.

  El estado actual dice dónde está el lead hoy; sólo el historial dice por dónde
  pasó, cuánto tardó en cada etapa y cuántas veces se lo intentó reactivar. Las
  métricas del embudo se calculan sobre esta tabla y no sobre `leads.status`,
  porque el estado actual de un lead perdido no cuenta que antes llegó a estar
  por cerrar.
*/
create table if not exists lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads (id) on delete cascade,
  type        lead_event_type not null,
  from_status lead_status,
  to_status   lead_status,
  note        text,
  actor       text not null default 'system',
  created_at  timestamptz not null default now()
);

create index if not exists lead_events_lead_idx    on lead_events (lead_id, created_at desc);
create index if not exists lead_events_type_idx    on lead_events (type);
create index if not exists lead_events_created_idx on lead_events (created_at);

comment on table lead_events is
  'Historial de cada lead, append-only. Sobre esto se calculan las métricas del embudo.';

/* Los estados en los que el lead todavía se trabaja. */
create or replace function lead_activo(estado lead_status) returns boolean
language sql immutable
as $activo$
  select estado in ('new', 'qualifying', 'qualified', 'quoted', 'negotiating', 'closing');
$activo$;

/*
  Qué transiciones son legales.

  Está acá y no en el ERP porque es una regla del negocio, no de una pantalla:
  el kanban, la ficha, el job nocturno y cualquier corrección hecha a mano desde
  el panel de Supabase tienen que respetar la misma tabla. Una regla que vive en
  el navegador es una regla que se saltea abriendo otra pestaña.
*/
create or replace function lead_transicion_valida(desde lead_status, hasta lead_status)
returns boolean
language sql immutable
as $transicion$
  select case desde
    when 'new'         then hasta in ('qualifying', 'qualified', 'lost')
    when 'qualifying'  then hasta in ('qualified', 'quoted', 'dormant', 'lost')
    when 'qualified'   then hasta in ('quoted', 'dormant', 'lost')
    when 'quoted'      then hasta in ('negotiating', 'closing', 'dormant', 'lost')
    when 'negotiating' then hasta in ('closing', 'quoted', 'dormant', 'lost')
    when 'closing'     then hasta in ('won', 'negotiating', 'dormant', 'lost')
    when 'dormant'     then hasta in ('qualified', 'quoted', 'lost', 'new')
    /* Ganado es terminal: el que vuelve a comprar genera un lead nuevo. */
    when 'won'         then false
    /* Perdido sólo se reabre a mano, y reabrirlo es despertarlo. */
    when 'lost'        then hasta = 'dormant'
  end;
$transicion$;

/*
  Quién hizo el cambio.

  Sale del mail del JWT de Supabase. Si no hay sesión —el simulador de la web
  escribe sin ella— o el claim no viene, queda 'system'. Envuelto en un bloque
  con `exception` porque esto corre adentro de un trigger que no puede fallar
  por no saber quién fue: perder el nombre del autor es molesto, perder el lead
  es grave.
*/
create or replace function lead_actor() returns text
language plpgsql stable
as $actor$
begin
  return coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'system'
  );
exception when others then
  return 'system';
end;
$actor$;

/*
  El guardián del embudo: completa lo que falta y rechaza lo que no cierra.

  Hace tres cosas, en este orden:

  1. **Valida la transición** contra `lead_transicion_valida`.
  2. **Pone los defaults** de próxima acción al cambiar de estado, para que
     nadie tenga que acordarse de escribir "seguimiento post-presupuesto" cada
     vez. Si quien guarda ya puso una fecha, se respeta la suya.
  3. **Exige los campos obligatorios** de cada estado. Un lead perdido sin
     motivo o un presupuestado sin monto son filas que después no se pueden
     medir, y el momento de pedirlos es cuando se guarda, no seis meses después
     cuando alguien intenta sacar el informe.
*/
create or replace function leads_guard() returns trigger
language plpgsql
as $guard$
declare
  cambio   boolean := tg_op = 'INSERT' or new.status is distinct from old.status;
  plazo    interval;
  sugerida text;
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and not lead_transicion_valida(old.status, new.status) then
    raise exception 'No se puede pasar un lead de % a %.', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if cambio then
    if new.status = 'dormant' then
      /* Dormido no tiene próxima acción: la fecha de recontacto hace ese papel. */
      new.next_action    := null;
      new.next_action_at := null;
      new.dormant_until  := coalesce(new.dormant_until, current_date + 75);

    elsif lead_activo(new.status) then
      plazo := case new.status
        when 'new'         then interval '2 hours'
        when 'qualifying'  then interval '1 day'
        when 'qualified'   then interval '1 day'
        when 'quoted'      then interval '2 days'
        when 'negotiating' then interval '2 days'
        when 'closing'     then interval '1 day'
      end;

      sugerida := case new.status
        when 'new'         then 'Responder y pedir zona, cantidad y si van agujereadas'
        when 'qualifying'  then 'Reintento pidiendo datos'
        when 'qualified'   then 'Armar y mandar presupuesto'
        when 'quoted'      then 'Seguimiento post-presupuesto'
        when 'negotiating' then 'Resolver objeción o contrapropuesta'
        when 'closing'     then 'Coordinar seña y entrega'
      end;

      /*
        La fecha se **recalcula** con el plazo del estado nuevo, no se conserva.
        Un lead que pasa de recién entrado a presupuestado arrastraría si no el
        vencimiento de dos horas que le tocaba al entrar, y aparecería vencido
        en la pantalla de Hoy el mismo día en que se le mandó el presupuesto.

        La excepción es que quien guarda haya puesto una fecha a propósito en la
        misma operación: ésa gana, porque el que está hablando con la persona
        sabe mejor que esta tabla cuándo hay que volver a llamarla.
      */
      if tg_op = 'INSERT' then
        new.next_action_at := coalesce(new.next_action_at, now() + plazo);
        new.next_action    := coalesce(new.next_action, sugerida);
      else
        if new.next_action_at is null
           or new.next_action_at is not distinct from old.next_action_at then
          new.next_action_at := now() + plazo;
        end if;

        if new.next_action is null
           or new.next_action is not distinct from old.next_action then
          new.next_action := sugerida;
        end if;
      end if;
    end if;

    if new.status = 'quoted' then new.quote_sent_at := coalesce(new.quote_sent_at, now()); end if;
    if new.status = 'won'    then new.won_at        := coalesce(new.won_at, now());        end if;
  end if;

  /* Las de abajo son invariantes: se revisan siempre, cambie el estado o no. */

  if lead_activo(new.status) and new.next_action_at is null then
    raise exception 'Un lead en % necesita una próxima acción con fecha.', new.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'lost' and new.lost_reason is null then
    raise exception 'Para dar un lead por perdido hay que decir por qué.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'dormant' and new.dormant_until is null then
    raise exception 'Un lead dormido necesita fecha de recontacto.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'quoted' and new.quote_amount is null then
    raise exception 'Un lead presupuestado necesita el monto del presupuesto.'
      using errcode = 'check_violation';
  end if;

  if new.status = 'won' and new.won_amount is null then
    raise exception 'Un lead ganado necesita el monto de la venta.'
      using errcode = 'check_violation';
  end if;

  /*
    Calificar es, justamente, tener los tres datos con los que se puede cotizar.
    Sin ellos el estado diría que el lead está listo para presupuestar y no lo
    está.
  */
  if new.status = 'qualified'
     and (new.localidad is null or new.cantidad is null or new.agujereada is null) then
    raise exception 'Para calificar un lead hacen falta localidad, cantidad y si van agujereadas.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$guard$;

drop trigger if exists leads_guard_trigger on leads;
create trigger leads_guard_trigger
  before insert or update on leads
  for each row
  execute function leads_guard();

/*
  Todo cambio de estado deja rastro. Sin excepción: el historial es lo que
  después permite medir dónde se cae el embudo, y un cambio sin registrar es un
  agujero que no se nota hasta que el informe da cualquier cosa.

  `security definer` porque el simulador de la web escribe leads sin sesión y
  no tiene —ni debe tener— permiso sobre `lead_events`.
*/
create or replace function leads_log_status() returns trigger
language plpgsql
security definer
set search_path = public
as $log$
begin
  if tg_op = 'INSERT' then
    insert into lead_events (lead_id, type, to_status, note, actor)
    values (new.id, 'status_change', new.status, 'Lead creado', lead_actor());

  elsif new.status is distinct from old.status then
    insert into lead_events (lead_id, type, from_status, to_status, note, actor)
    values (new.id, 'status_change', old.status, new.status, new.lost_notes, lead_actor());
  end if;

  return null;
end;
$log$;

drop trigger if exists leads_log_status_trigger on leads;
create trigger leads_log_status_trigger
  after insert or update on leads
  for each row
  execute function leads_log_status();

/*
  El lead abierto de un teléfono, si lo hay.

  Es la deduplicación de §5.2: cuando vuelve a escribir alguien que ya está en
  la base, no se abre un lead nuevo —se retoma el que está—, y así el historial
  queda entero en vez de partido en dos fichas.

  "Abierto" excluye a los ganados a propósito: el que ya compró y vuelve es una
  recompra, y ésa sí merece un lead nuevo para que la métrica la pueda contar.
*/
create or replace function lead_abierto(tel text) returns uuid
language sql stable
as $abierto$
  select l.id
  from leads l
  where l.telefono is not null
    and tel is not null
    and l.telefono = tel
    and l.status <> 'won'
  order by l.created_at desc
  limit 1;
$abierto$;

/*
  El barrido de vencimientos. Corre solo una vez por día y se puede correr a
  mano cuantas veces haga falta: es idempotente.

  Los estados nuevos no ponen la fecha a mano —la dejan en null— para que el
  guardián de arriba les aplique el default que corresponde al estado destino.
  Así el plazo de cada etapa está escrito en un solo lugar.

  Dos cosas que la spec pide y acá se resuelven distinto, por lo mismo en los
  dos casos: tal como están escritas, corriendo todos los días harían daño.

  - **El `overdue` de los estados que sólo alertan** (`qualified`,
    `negotiating`, `closing`) no se guarda en ninguna columna: se calcula en la
    vista `leads_hoy`. Una columna se escribe una vez por noche y queda mintiendo
    en cuanto alguien mueve la fecha de la próxima acción a la mañana siguiente.

  - **El contador de reactivación no se toca acá.** Si el job lo subiera cada
    día, un lead dormido llegaría a dos "intentos" en dos días sin que nadie lo
    haya llamado, y la tarea de recontacto desaparecería de la vista el mismo
    día en que apareció. El contador lo sube quien de verdad hace el recontacto,
    desde el ERP. Del job queda sólo la regla de rendirse: el que ya tuvo dos
    intentos y sigue sin contestar se da por perdido.
*/
create or replace function run_lead_sla() returns jsonb
language plpgsql
security definer
set search_path = public
as $sla$
declare
  a_calificar integer;
  a_dormir    integer;
  perdidos    integer;
begin
  /* Sin trabajar el primer día: pasa a calificación y se le reintenta. */
  with movidos as (
    update leads set status = 'qualifying', next_action = null, next_action_at = null
    where status = 'new' and next_action_at < now() - interval '1 day'
    returning 1
  )
  select count(*)::integer into a_calificar from movidos;

  /*
    Una semana sin sacarle los datos, o diez días sin respuesta al presupuesto,
    y el lead se duerme. No se pierde: dormido es la base de recontacto, que es
    lo más valioso que tiene un negocio estacional como éste.
  */
  with movidos as (
    update leads set status = 'dormant', dormant_until = null
    where (status = 'qualifying' and next_action_at < now() - interval '7 days')
       or (status = 'quoted'     and next_action_at < now() - interval '10 days')
    returning 1
  )
  select count(*)::integer into a_dormir from movidos;

  /* Dos recontactos sin respuesta: se cierra con motivo, no en silencio. */
  with cerrados as (
    update leads set
      status = 'lost',
      lost_reason = 'no_response',
      lost_notes = coalesce(lost_notes, 'Sin respuesta después de dos intentos de recontacto.')
    where status = 'dormant'
      and dormant_until <= current_date
      and reactivation_count >= 2
    returning 1
  )
  select count(*)::integer into perdidos from cerrados;

  return jsonb_build_object(
    'a_calificar', a_calificar,
    'a_dormir', a_dormir,
    'perdidos', perdidos,
    'corrido_el', now()
  );
end;
$sla$;

/*
  El job de las 7 de la mañana, si el proyecto tiene pg_cron habilitado.

  Si no lo tiene, no pasa nada malo: el ERP llama a `run_lead_sla()` al abrirse,
  así que el barrido igual ocurre: lo dispara la primera persona que entra cada
  día. La extensión se habilita desde el panel de Supabase, en Database →
  Extensions.
*/
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'lead-sla') then
      perform cron.unschedule('lead-sla');
    end if;

    /* 10:00 UTC son las 7:00 en Argentina. */
    perform cron.schedule('lead-sla', '0 10 * * *', $job$select run_lead_sla()$job$);
  end if;
end
$cron$;

/*
  La pantalla de "Hoy": no es una lista de leads, es una lista de acciones.

  Trae lo que vence hoy o antes, más los dormidos a los que les llegó la fecha
  de recontacto, ordenado por cuán cerca está la plata: primero el que está por
  cerrar, último el que recién entró.

  `dias_vencido` en cero quiere decir "es para hoy"; en 3, que hace tres días
  que alguien tendría que haber hecho algo.
*/
/*
  Se tira y se rehace en vez de `create or replace`, porque trae `l.*`: el día
  que `leads` gane una columna, la vista tendría una columna más y `create or
  replace` no admite cambiar la lista —falla con "cannot change name of view
  column"— y este archivo dejaría de poder correrse dos veces.
*/
drop view if exists leads_hoy;

create view leads_hoy with (security_invoker = on) as
  select
    l.*,
    coalesce(l.next_action_at::date, l.dormant_until) as vence_el,
    greatest(0, current_date - coalesce(l.next_action_at::date, l.dormant_until))::integer
      as dias_vencido,
    (lead_activo(l.status) and l.next_action_at < now()) as overdue
  from leads l
  where (lead_activo(l.status) and l.next_action_at::date <= current_date)
     or (l.status = 'dormant' and l.dormant_until <= current_date)
  order by
    case l.status
      when 'closing'     then 1
      when 'negotiating' then 2
      when 'qualified'   then 3
      when 'quoted'      then 4
      when 'new'         then 5
      when 'qualifying'  then 6
      else 7
    end,
    coalesce(l.next_action_at, l.dormant_until::timestamptz) asc;

-- ---------------------------------------------------------------------------
-- Métricas del embudo
-- ---------------------------------------------------------------------------

/*
  Todas se calculan sobre `lead_events` y no sobre el estado actual, salvo las
  que preguntan por dónde está parado el lead hoy. La diferencia importa: un
  lead perdido tiene status 'lost' y nada más, pero su historial cuenta que
  llegó a estar por cerrar, y ése es justamente el dato que dice dónde se cae la
  venta.
*/

/* Cuántos leads llegaron alguna vez a cada etapa. El embudo, literal. */
create or replace view lead_funnel with (security_invoker = on) as
  select
    e.to_status as status,
    count(distinct e.lead_id)::integer as leads
  from lead_events e
  where e.type = 'status_change' and e.to_status is not null
  group by 1;

/* Cuánto se tarda en salir de cada etapa: dónde se traba el embudo. */
create or replace view lead_stage_times with (security_invoker = on) as
  with pasos as (
    select
      e.from_status,
      e.created_at,
      coalesce(
        lag(e.created_at) over (partition by e.lead_id order by e.created_at),
        l.created_at
      ) as entro
    from lead_events e
    join leads l on l.id = e.lead_id
    where e.type = 'status_change' and e.from_status is not null
  )
  select
    from_status as status,
    count(*)::integer as salidas,
    round(avg(extract(epoch from (created_at - entro)) / 86400)::numeric, 1) as dias_promedio
  from pasos
  group by 1;

/* De qué etapa a cuál: la conversión de cada paso. */
create or replace view lead_transitions with (security_invoker = on) as
  select
    from_status,
    to_status,
    count(*)::integer as veces
  from lead_events
  where type = 'status_change' and from_status is not null
  group by 1, 2;

/*
  El resultado por mes, canal y tipo de cliente. De acá salen la tasa de cierre,
  la conversión por canal y por tipo, y el ticket promedio.

  El mes es el de entrada del lead y no el de la venta, igual que en
  `leads_por_origen` y por la misma razón: se está midiendo captación, y al que
  preguntó en septiembre lo trajo la plata gastada en septiembre.
*/
create or replace view lead_outcomes with (security_invoker = on) as
  select
    date_trunc('month', l.created_at)::date as mes,
    l.source,
    l.lead_type,
    count(*)::integer as leads,
    count(*) filter (where l.status = 'won')::integer     as ganados,
    count(*) filter (where l.status = 'lost')::integer    as perdidos,
    count(*) filter (where l.status = 'dormant')::integer as dormidos,
    count(*) filter (where lead_activo(l.status))::integer as abiertos,
    coalesce(sum(l.won_amount) filter (where l.status = 'won'), 0) as facturado
  from leads l
  group by 1, 2, 3;

/* Por qué se pierden. El dato que dice si el problema es precio, flete o producto. */
create or replace view lead_lost_reasons with (security_invoker = on) as
  select
    date_trunc('month', l.updated_at)::date as mes,
    l.lost_reason,
    count(*)::integer as leads
  from leads l
  where l.status = 'lost' and l.lost_reason is not null
  group by 1, 2;

/*
  Si mantener la base dormida sirve o no.

  `reactivados` cuenta a los que volvieron a moverse después de un recontacto;
  `ganados`, a los que además terminaron comprando. Si la segunda columna da
  siempre cero, el recontacto es tiempo que se está tirando.
*/
create or replace view lead_reactivations with (security_invoker = on) as
  select
    count(*) filter (where reactivation_count > 0)::integer as intentados,
    count(*) filter (
      where reactivation_count > 0
        and status in ('qualified', 'quoted', 'negotiating', 'closing', 'won')
    )::integer as reactivados,
    count(*) filter (where reactivation_count > 0 and status = 'won')::integer as ganados
  from leads;

-- ---------------------------------------------------------------------------
-- Productos y pedidos
-- ---------------------------------------------------------------------------

/*
  Lo que se vende. El agujereado no está acá: es un acabado de la línea del
  pedido, no un producto distinto. El porqué está en la sección "El agujereado
  es un acabado, no otro producto", más abajo.
*/
create table if not exists products (
  id     uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  activo boolean not null default true
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

/*
  El agujereado es un acabado, no otro producto.

  Al principio la varilla agujereada era un producto aparte, con su código y su
  stock. Es la forma obvia de modelarlo y es la equivocada, porque en el
  depósito no hay dos cosas: hay varillas. Cuando alguien pide agujereadas se
  agarra una varilla y se la agujerea en el momento.

  Con dos productos, toda la producción se cargaba contra la común y la
  agujereada se quedaba en cero para siempre. Un pedido de 100 agujereadas leía
  cero disponibles con tres mil varillas en el galpón, y presupuestarlo mandaba
  a "revisar el stock" por un faltante que no existía. El stock no estaba mal
  cargado: estaba partido en dos pozos donde hay uno solo.

  Así que el acabado baja del producto a la línea, que es donde siempre estuvo
  en la realidad: lo que decide si va agujereada no es qué hay en el depósito,
  es qué pidió el cliente. El stock vuelve a ser un número y el precio lo sigue
  eligiendo el acabado, como en la lista.

  Lo que esto no hace —y no puede hacer— es al revés: una varilla agujereada no
  se vuelve común. Por eso el modelo aguanta sólo mientras se agujeree contra el
  pedido. El día que se agujeree una tanda por adelantado y quede guardada, esto
  hay que volver a partirlo en dos, y la vuelta no es gratis.

  Va como `alter` y no adentro del `create table` de arriba porque las bases que
  ya venían andando tienen esa tabla hecha, y `create table if not exists` no
  les agregaría nada. El fundido de los dos productos viejos en uno está al
  final, en "Datos iniciales".
*/
alter table order_items add column if not exists agujereada boolean not null default false;

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
    /*
      El acabado va en la nota porque un pedido puede tener dos líneas del mismo
      producto —tantas comunes y tantas agujereadas— y desde que la varilla es
      una sola las dos salidas quedarían idénticas en el listado de movimientos.
      Dos filas iguales en el historial de stock se leen como una cargada dos
      veces, que es justo lo que el historial existe para descartar.
    */
    insert into stock_movements (product_id, tipo, cantidad, order_id, fecha, nota)
    select i.product_id, 'venta', -i.cantidad, new.id, new.fecha,
           'Entrega del pedido #' || new.numero ||
           case when i.agujereada then ' (agujereadas)' else '' end
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
  Elegir mal el tipo no desordena un informe, le mueve plata a alguien.

  Quién paga cada tipo se configura en `expense_types`, acá abajo. En esta tabla
  `tipo` es sólo la clave: qué claves son válidas lo impone una clave foránea y
  no un `check` escrito a mano, que habría que venir a editar cada vez que
  aparece un gasto nuevo.

  `order_id` es opcional: un gasto puede ser de un pedido puntual —un flete que
  se pagó, una producción especial— o del mes en general, como la pauta.
*/
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null default current_date,
  tipo        text not null,
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
  De quién sale cada peso de esta tabla lo decide `expense_types`, que está más
  abajo: necesita que las partes del reparto ya existan para poder apuntarlas.
*/


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
-- Quién paga cada gasto
-- ---------------------------------------------------------------------------

/*
  Va acá abajo y no junto a `expenses`, donde se leería más natural, porque
  apunta a las partes del reparto: un gasto se le carga a alguien, y ese alguien
  tiene que existir primero.
*/

/*
  La regla de reparto de un gasto, editable desde el ERP.

  Antes era una lista fija en el código y en un `check`: los operativos los
  pagaba «la empresa» y los de reinversión «el pozo». Eso escondía lo que en
  realidad pasa, que es que cada costo sale del bolsillo de alguien en
  particular. Un costo que «paga la empresa» lo terminan pagando los socios en
  proporción a su parte, y no es lo que acordaron.

  `paga` es la regla, y son tres:

  - `proporcional`: sale de arriba, antes de repartir, y lo termina pagando
    cada parte en proporción a su porcentaje. Es la regla que sigue la comisión
    del vendedor, que no es un tipo de gasto pero se descuenta igual.
  - `socios`: lo pagan las partes listadas en `expense_type_payers`, en
    **mitades iguales** entre ellas. No en proporción a sus porcentajes: si dos
    socios bancan la producción, le cuesta la mitad a cada uno aunque uno tenga
    el 50 y el otro el 25.
  - `pozo`: lo paga primero el pozo de reinversión. Lo que el pozo no llega a
    cubrir lo ponen las partes listadas, también en mitades.

  Dos banderas que no son lo mismo:

  - `interno` es un tipo cuyo monto **no se carga a mano**: lo calcula el
    sistema. La producción sale del stock, de lo que costaba hacer cada varilla
    el día que se produjo. Lo que haya quedado cargado a mano con un tipo
    interno no se suma a ningún total —contarlo sería cobrarse la producción
    dos veces— pero quién lo paga sí se configura acá.
  - `activo` es si se ofrece al cargar un gasto nuevo. Un tipo que se retira se
    desactiva, nunca se borra: los gastos ya cargados apuntan a su tipo por
    `clave`, y borrarlo dejaría plata sin dueño en un mes ya liquidado. Los
    gastos de un tipo inactivo se siguen contando y pagando igual.
*/
create table if not exists expense_types (
  id      uuid primary key default gen_random_uuid(),
  clave   text not null unique check (clave ~ '^[a-z0-9_]{1,40}$'),
  nombre  text not null check (char_length(nombre) between 1 and 60),
  paga    text not null default 'socios'
          check (paga in ('proporcional', 'socios', 'pozo')),
  interno boolean not null default false,
  activo  boolean not null default true,
  orden   integer not null default 0
);

/*
  Quiénes bancan un tipo de gasto.

  Sin filas acá, un tipo `socios` o `pozo` no tiene de dónde salir. El ERP lo
  muestra como lo que es —un gasto sin pagador— en vez de repartirlo por
  defecto entre todos, que es exactamente el reparto que se quiso dejar atrás.
*/
create table if not exists expense_type_payers (
  tipo_id  uuid not null references expense_types (id) on delete cascade,
  share_id uuid not null references profit_shares (id) on delete cascade,
  primary key (tipo_id, share_id)
);

create index if not exists expense_type_payers_share_idx
  on expense_type_payers (share_id);

/*
  Los tipos que ya existían, con la regla que les toca.

  `on conflict do nothing` y no `where not exists` sobre la tabla entera: lo que
  importa es que cada clave esté, no que la tabla esté vacía. Así el archivo se
  puede volver a correr después de haber agregado un tipo desde el ERP sin
  pisarlo ni duplicarlo.
*/
insert into expense_types (clave, nombre, paga, interno, activo, orden)
select * from (values
  ('produccion',    'Producción',    'socios', true,  false, 1),
  ('flete',         'Flete',         'socios', false, true,  2),
  ('pauta',         'Pauta',         'pozo',   false, true,  3),
  ('suscripciones', 'Suscripciones', 'pozo',   false, true,  4),
  ('muestras',      'Muestras',      'pozo',   false, true,  5),
  /*
    'otro' se retira. Un cajón de sastre es justamente el tipo que no contesta
    la pregunta que ahora hay que contestar: de la parte de quién sale. Queda
    inactivo —no se ofrece al cargar— pero sus gastos se siguen contando y los
    siguen pagando los socios que tenga asignados, porque esa plata salió
    igual. La pantalla de Costos los señala para reclasificarlos.
  */
  ('otro',          'Otro',          'socios', false, false, 99)
) as v(clave, nombre, paga, interno, activo, orden)
on conflict (clave) do nothing;


/*
  Qué claves valen lo dice la tabla de tipos, no un `check`: agregar un tipo
  desde el ERP no puede requerir una migración.

  `on update cascade` para que renombrar la clave de un tipo arrastre los gastos
  ya cargados en vez de romper.
*/
alter table expenses drop constraint if exists expenses_tipo_check;
alter table expenses drop constraint if exists expenses_tipo_fkey;
alter table expenses add constraint expenses_tipo_fkey
  foreign key (tipo) references expense_types (clave) on update cascade;

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

/*
  En qué moneda salió el presupuesto, y a qué dólar.

  El sistema sigue llevando pesos: los pagos, la cuenta corriente, las
  comisiones y la ganancia del mes se cuentan en la moneda en la que se cobra, y
  convertir eso sería inventar un resultado que depende del día en que se mire.
  Lo que se convierte es el papel, para el cliente que pide el presupuesto en
  dólares.

  La cotización se guarda en vez de recalcularse al abrir la pantalla, y esa es
  la parte que importa: un presupuesto en dólares es un compromiso a un tipo de
  cambio concreto, y el dólar del martes no es el del jueves. Sin este número no
  hay forma de volver a sacar el PDF que se mandó, ni de saber qué se prometió
  cuando el cliente conteste dos semanas después.

  Null mientras el pedido sea en pesos: no hay tipo de cambio que registrar
  cuando no se convirtió nada.
*/
alter table orders add column if not exists moneda text not null default 'ARS'
  check (moneda in ('ARS', 'USD'));
alter table orders add column if not exists cotizacion numeric(12, 2)
  check (cotizacion is null or cotizacion > 0);

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
    coalesce(m.stock, 0)::integer as stock,
    coalesce(c.comprometido, 0)::integer as comprometido,
    coalesce(c.agujereadas, 0)::integer as comprometido_agujereadas,
    (coalesce(m.stock, 0) - coalesce(c.comprometido, 0))::integer as disponible
  from products p
  left join lateral (
    select sum(cantidad) as stock from stock_movements where product_id = p.id
  ) m on true
  left join lateral (
    /*
      Cuántas de las reservadas hay que agujerear antes de que salgan. No cambia
      el disponible —la varilla es la misma esté agujereada o no— pero sí es
      trabajo que ya está comprometido y que alguien tiene que hacer. Que
      aparezca al lado del número es la diferencia entre enterarse ahora y
      enterarse el día que el camión está esperando.
    */
    select
      sum(i.cantidad) as comprometido,
      sum(i.cantidad) filter (where i.agujereada) as agujereadas
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
  esa diferencia aparece donde tiene que aparecer en lugar de perderse. Los dos
  lados van juntos a los mismos bolsillos, pero eso lo resuelve el ERP.

  Lo que esta vista **no** hace es decidir quién paga qué. Antes lo hacía, y era
  el lugar equivocado: la regla depende de `expense_types`, que se edita desde
  el ERP, y de los porcentajes de cada parte. Acá quedan los ingresos y el
  detalle de gastos por tipo; el reparto vive en `src/erp/api/profit.js`, en un
  solo lugar y a la vista.

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
    Los gastos del mes, agrupados por tipo y nada más.

    La lista de tipos ya no está escrita acá: se agrega uno desde el ERP y esta
    vista lo cuenta sin que haya que tocarla. Por eso el detalle sale como un
    objeto y no como una columna por tipo.

    Los tipos internos quedan fuera del total: su monto lo calcula el sistema
    —la producción sale del stock, de lo que costaba hacer cada varilla el día
    que se produjo— y lo que haya quedado cargado a mano se muestra aparte,
    para verlo y limpiarlo, sin sumarlo a ningún lado. Contarlo sería cobrarse
    la producción dos veces.
  */
  costos as (
    select
      g.mes,
      coalesce(
        jsonb_object_agg(g.tipo, g.total) filter (where not t.interno),
        '{}'::jsonb
      ) as por_tipo,
      sum(g.total) filter (where not t.interno)      as total,
      sum(g.total) filter (where t.interno)          as internos_cargados,
      sum(g.total) filter (where g.tipo = 'flete')   as flete,
      sum(g.total) filter (where g.tipo = 'pauta')   as pauta
    from (
      select date_trunc('month', fecha)::date as mes, tipo, sum(monto) as total
      from expenses
      group by 1, 2
    ) g
    /*
      `join` y no `left join`: la clave foránea de `expenses.tipo` garantiza que
      todo gasto tenga su tipo, así que una fila que no cruzara sería un dato
      imposible, no un caso a contemplar.
    */
    join expense_types t on t.clave = g.tipo
    group by g.mes
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

    /*
      Sobre esto se calculan los porcentajes del reparto.

      El flete facturado queda afuera a propósito: es un pasamanos, se cobra y
      se paga. Va, junto con su costo, a quienes bancan el tipo de gasto
      `flete`. Si entrara acá, quien cobra un porcentaje sobre el valor del
      producto cobraría además una parte de un transporte cuyo costo banca otro.

      La comisión del vendedor sí se resta, y es la única que se descuenta antes
      de repartir: la termina pagando cada parte en proporción a lo suyo.
    */
    coalesce(v.mercaderia, 0) + coalesce(v.servicios, 0)
      - coalesce(v.comisiones, 0) as base_reparto,

    coalesce(pr.varillas, 0)         as varillas_producidas,
    coalesce(pr.costo, 0)            as costo_produccion,
    /* Lo que quedó cargado a mano con un tipo interno y ya no se cuenta. */
    coalesce(c.internos_cargados, 0) as costo_produccion_cargado,
    coalesce(c.flete, 0)             as costo_flete,
    coalesce(c.pauta, 0)             as costo_pauta,

    /*
      El detalle por tipo: `{"pauta": 120000, "flete": 8000, …}`. De acá sale
      todo el reparto de costos, cruzándolo con `expense_types` para saber quién
      pone cada peso. Un tipo sin gastos en el mes no aparece.
    */
    coalesce(c.por_tipo, '{}'::jsonb) as gastos_por_tipo,

    coalesce(c.total, 0) + coalesce(pr.costo, 0) as costos,

    /* El resultado de verdad del mes, con todo descontado. Quién pone cada peso
       es la otra cuenta; ésta es la de la empresa. */
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
    l.source as origen,
    count(*)::integer as leads,
    count(*) filter (where l.status = 'won')::integer   as ganados,
    count(*) filter (where l.status = 'lost')::integer  as perdidos,
    count(*) filter (where l.status = 'new')::integer   as sin_contactar,
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
alter table lead_events     enable row level security;
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
alter table expense_types   enable row level security;
alter table expense_type_payers enable row level security;
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
  El barrido de vencimientos lo dispara el ERP al abrirse, así que hace falta
  poder llamarlo con sesión —pero sólo con sesión: es una función que mueve
  leads de estado y no tiene por qué ser un botón abierto al mundo.
*/
revoke execute on function run_lead_sla() from public;
grant execute on function run_lead_sla() to authenticated;

/*
  El historial es de sólo agregar. El equipo lo lee y escribe en él, pero no
  puede editarlo ni borrarlo: si una entrada del historial se pudiera corregir,
  dejaría de ser historial y las métricas del embudo pasarían a medir lo que
  alguien quiso que dijera. Se revoca además el permiso de tabla, para que la
  regla no dependa sólo de la política.
*/
revoke update, delete on lead_events from authenticated;

drop policy if exists "el equipo lee el historial" on lead_events;
create policy "el equipo lee el historial" on lead_events
  for select to authenticated using (true);

drop policy if exists "el equipo anota en el historial" on lead_events;
create policy "el equipo anota en el historial" on lead_events
  for insert to authenticated with check (true);

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
    'expenses', 'expense_types', 'expense_type_payers',
    'profit_shares', 'profit_payouts',
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
    status = 'new'
    and customer_id is null
    /*
      Sin sesión sólo se puede dejar un lead diciendo que vino de la web, que es
      de donde efectivamente viene el simulador. Si no, cualquiera con la clave
      pública podría cargar leads firmados como "referido" o "instagram" y la
      medición de la pauta pasaría a ser un número que se puede inventar desde
      afuera. Los otros canales se cargan a mano, con sesión.
    */
    and source = 'web'
    /*
      Y tampoco puede llegar apuntado a nadie ni con plata escrita: los campos
      del embudo los completa el ERP. Sin esto, cualquiera con la clave pública
      podría dejar leads ya "ganados" por diez millones y ensuciar la métrica
      que decide dónde se pone la plata de la pauta.
    */
    and owner is null
    and lead_type is null
    and quote_amount is null
    and won_amount is null
    and char_length(nombre) between 1 and 160
    and (cantidad is null or cantidad between 1 and 1000000)
    and (notas is null or char_length(notas) <= 500)
  );

-- ---------------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------------

/* La varilla. Una sola: el agujereado va en la línea del pedido. */
insert into products (codigo, nombre)
values ('VAR', 'Varilla 3x3x120')
on conflict (codigo) do nothing;

/*
  Las bases que se crearon con los dos productos se funden acá.

  El orden es el que importa: primero el acabado baja a las líneas que lo
  tenían por el producto, después la historia entera —líneas y movimientos de
  stock— se repunta a la varilla única, y recién ahí se borran los códigos
  viejos. Al revés no se podría: las dos claves foráneas son `on delete
  restrict` justamente para que nadie borre un producto que tiene historia
  colgando.

  No se pierde nada. Los movimientos conservan su fecha, su tipo, su nota y el
  costo con el que se cargaron; lo único que cambia es a qué producto apuntan.

  El bloque entero se saltea si `products.drilled` ya no está, que es la marca
  de que esto ya corrió: una base fundida no tiene esa columna, y en una base
  nueva nunca existió. Se chequea con un `if` y no dejando que las sentencias no
  encuentren filas, porque plpgsql planifica cada sentencia al ejecutarla y
  nombrar una columna que no existe explota aunque no haya nada que actualizar.
*/
do $productos$
declare
  varilla uuid;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'drilled'
  ) then
    return;
  end if;

  select id into varilla from products where codigo = 'VAR';
  if varilla is null then
    return;
  end if;

  update order_items i
     set agujereada = p.drilled
    from products p
   where p.id = i.product_id
     and p.codigo in ('VAR-COMUN', 'VAR-AGUJ');

  update order_items i
     set product_id = varilla
    from products p
   where p.id = i.product_id
     and p.codigo in ('VAR-COMUN', 'VAR-AGUJ');

  update stock_movements m
     set product_id = varilla
    from products p
   where p.id = m.product_id
     and p.codigo in ('VAR-COMUN', 'VAR-AGUJ');

  delete from products where codigo in ('VAR-COMUN', 'VAR-AGUJ');

  /*
    Y se va la columna que partía el stock en dos. Dejarla en false sobre la
    única fila no sería inofensivo: es el campo que hacía que existiera un
    "producto agujereado", y mientras esté alguien lo va a volver a usar.
  */
  alter table products drop column drilled;
end
$productos$;

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
  El reparto base de la planilla: 50 / 25 / 20 y un 5 de reinversión, todo sobre
  el valor del producto vendido.

  El 5 de reinversión sale de arriba, así que lo ponen los tres en proporción a
  su parte. Los nombres y los porcentajes se editan después desde el ERP; esto
  es sólo para que la pantalla no arranque en blanco.

  El orden importa más de lo que parece: el reparto inicial de quién paga qué
  —más arriba, en `expense_type_payers`— se arma mirando cuál es la parte mayor
  y cuál la menor de esta misma tabla.
*/
insert into profit_shares (nombre, porcentaje, es_reinversion, orden)
select * from (values
  ('Esteban',     50.0, false, 1),
  ('Juan',        25.0, false, 2),
  ('Luis',        20.0, false, 3),
  ('Reinversión',  5.0, true,  4)
) as v(nombre, porcentaje, es_reinversion, orden)
where not exists (select 1 from profit_shares);

/*
  El punto de partida de quién paga qué.

  Va entre las semillas y no junto a `expense_types`, que sería su lugar, porque
  necesita que las partes del reparto ya estén cargadas: en una base nueva se
  siembran acá abajo, unas líneas más arriba que esto.

  Se elige por porcentaje y no por nombre porque una base ya andando tiene en
  `profit_shares` los nombres reales de cada uno, que no tienen por qué ser los
  de este archivo:

  - Los costos operativos los bancan todos los socios **menos el de menor
    parte**. Quien cobra un porcentaje sobre el valor del producto lo cobra
    entero: la producción no se le descuenta.
  - Los del pozo, cuando el pozo no alcanza, los ponen todos **menos el de
    mayor parte**.

  Corre una sola vez, con la tabla vacía. De ahí en más manda lo que se haya
  configurado en Ajustes › Tipos de gasto.
*/
do $pagadores$
declare
  menor uuid;
  mayor uuid;
begin
  if exists (select 1 from expense_type_payers) then return; end if;

  select id into menor from profit_shares
    where not es_reinversion and activo
    order by porcentaje asc, orden asc limit 1;

  select id into mayor from profit_shares
    where not es_reinversion and activo
    order by porcentaje desc, orden asc limit 1;

  /* Sin partes cargadas no hay nada que asignar, y menor = mayor es una sola
     parte: darle todo a esa sería inventar un acuerdo que no existe. */
  if menor is null or menor = mayor then return; end if;

  insert into expense_type_payers (tipo_id, share_id)
  select t.id, s.id
    from expense_types t
    join profit_shares s
      on not s.es_reinversion
     and s.activo
     and s.id <> case t.paga when 'pozo' then mayor else menor end
   where t.paga <> 'proporcional'
  on conflict do nothing;
end
$pagadores$;
