# ERP RECU-VARILLA — Spec de implementación: Pipeline de leads

Spec funcional para implementar el módulo de gestión de leads/clientes.
Los identificadores de código van en inglés; los labels de UI en español rioplatense.

---

## 1. Objetivo

Reemplazar el modelo actual de 4 estados (`nuevo / contactado / ganado / perdido`) por
una máquina de estados con SLA, motivos de pérdida y campo obligatorio de próxima acción.

Principio rector: **todo lead en estado activo debe tener una `next_action_at`.**
Un lead activo sin próxima acción es un lead perdido que todavía no fue detectado.

---

## 2. Modelo de datos

### 2.1 Tabla `leads`

| Campo | Tipo | Null | Notas |
|---|---|---|---|
| `id` | uuid PK | no | |
| `phone` | text | no | E.164. **UNIQUE** — clave de deduplicación |
| `name` | text | sí | |
| `status` | enum `lead_status` | no | default `new` |
| `lead_type` | enum `lead_type` | sí | define qué lista de precios se manda |
| `zone` | text | sí | localidad/partido — define flete |
| `qty_estimated` | integer | sí | unidades |
| `drilled` | boolean | sí | `null` = todavía no se sabe |
| `source` | enum `lead_source` | no | default `whatsapp_organic` |
| `next_action` | text | sí | qué hay que hacer |
| `next_action_at` | timestamptz | sí | **obligatorio si `status` es activo** |
| `owner` | text | sí | Luis / Pipo |
| `lost_reason` | enum `lost_reason` | sí | **obligatorio si `status = lost`** |
| `lost_notes` | text | sí | |
| `quote_amount` | numeric(12,2) | sí | monto del último presupuesto |
| `quote_sent_at` | timestamptz | sí | |
| `won_amount` | numeric(12,2) | sí | |
| `won_at` | timestamptz | sí | |
| `dormant_until` | date | sí | fecha de recontacto programado |
| `reactivation_count` | integer | no | default 0 — cuántas veces pasó por `dormant` |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

Índices: `status`, `next_action_at`, `dormant_until`, `zone`, `phone` (unique).

### 2.2 Tabla `lead_events` (historial, append-only)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `lead_id` | uuid FK → leads | |
| `type` | enum `event_type` | ver 3.5 |
| `from_status` | enum `lead_status` | null en eventos que no cambian estado |
| `to_status` | enum `lead_status` | idem |
| `note` | text | |
| `actor` | text | usuario o `system` |
| `created_at` | timestamptz | |

Todo cambio de `status` **debe** generar un `lead_event`. Sin excepción: el historial
es lo que después permite medir dónde se cae el embudo.

---

## 3. Enums

### 3.1 `lead_status`

| Valor | Label UI | Activo | SLA (días) | Vence a |
|---|---|---|---|---|
| `new` | Nuevo | sí | 1 | `qualifying` |
| `qualifying` | En calificación | sí | 7 | `dormant` |
| `qualified` | Calificado | sí | 1 | — (solo alerta) |
| `quoted` | Presupuesto enviado | sí | 10 | `dormant` |
| `negotiating` | En negociación | sí | 5 | — (solo alerta) |
| `closing` | Por cerrar | sí | 3 | — (solo alerta) |
| `won` | Ganado | no | — | — |
| `dormant` | Dormido | no | — | reactivación programada |
| `lost` | Perdido | no | — | — |

"Vence a" = transición automática por el job diario (ver §5).
"Solo alerta" = no cambia de estado, se marca como vencido en la vista de hoy.

### 3.2 `lead_type`

| Valor | Label |
|---|---|
| `end_user` | Consumidor final |
| `installer` | Alambrador |
| `retailer` | Corralón / agropecuaria |
| `distributor` | Distribuidor |

Determina qué lista de precios aplica (minorista vs. mayorista) al generar presupuesto.

### 3.3 `lead_source`

`whatsapp_organic` · `instagram` · `cold_outreach` · `referral` · `facebook` · `tiktok` · `other`

### 3.4 `lost_reason`

| Valor | Label |
|---|---|
| `price` | Precio |
| `freight` | Costo de flete |
| `lead_time` | Plazo de entrega |
| `chose_wood` | Compró madera |
| `chose_competitor` | Compró a competidor |
| `not_target` | No era el target |
| `no_response` | Nunca contestó |
| `other` | Otro |

### 3.5 `event_type`

`inbound_message` · `auto_reply_sent` · `price_list_sent` · `quote_sent` · `followup_sent` ·
`objection_raised` · `sample_requested` · `status_change` · `note` · `reactivation_attempt`

---

## 4. Máquina de estados

### 4.1 Transiciones permitidas

```
new         → qualifying | qualified | lost
qualifying  → qualified | quoted | dormant | lost
qualified   → quoted | dormant | lost
quoted      → negotiating | closing | dormant | lost
negotiating → closing | quoted | dormant | lost
closing     → won | negotiating | dormant | lost
dormant     → qualified | quoted | lost | new
won         → (terminal; permitir nuevo lead para recompra)
lost        → dormant   [solo reapertura manual]
```

Cualquier transición fuera de esta tabla se rechaza con error de validación.

### 4.2 Árbol de decisión operativo

```
Entra mensaje de WhatsApp
  └─> [new] se dispara el mensaje automático
             (pide zona / cantidad / agujereado)
       │
       ├─ Contesta los 3 datos ───────────────────> [qualified]
       │       └─> se arma y manda presupuesto ───> [quoted]
       │
       ├─ Contesta solo "cuánto sale" ────────────> [qualifying]
       │       └─> se manda lista + repregunta cantidad y zona
       │             ├─ contesta ──────────────────> [qualified]
       │             └─ no contesta ──> followup d2, d7 ──> [dormant]
       │
       └─ No contesta nada ───────────────────────> [qualifying]
               └─> reintento 24-48 hs ──> 7 días sin respuesta ──> [dormant]

[quoted]
  ├─ Objeta precio / pide descuento ──────────────> [negotiating]
  ├─ Pide muestra o ficha técnica ────────────────> [negotiating]
  ├─ "Lo veo y te aviso" ─────────────────────────> [quoted] + followup d2 / d7
  ├─ "Dale, mandámelas" ──────────────────────────> [closing]
  ├─ Sin respuesta 10 días ───────────────────────> [dormant]
  └─ Rechaza ─────────────────────────────────────> [lost] + lost_reason

[negotiating]
  ├─ Acepta ──────────────────────────────────────> [closing]
  ├─ Se estanca ──────────────────────────────────> [dormant]
  └─ Rechaza ─────────────────────────────────────> [lost] + lost_reason

[closing]
  └─ Paga o seña ─────────────────────────────────> [won]

[dormant]  (recontacto a los 60-90 días, con novedad real)
  ├─ Reactiva ───────────> [qualified] o [quoted] según cuánto dato haya
  └─ 2do intento fallido ─> [lost] con lost_reason = no_response
```

---

## 5. Reglas automáticas

### 5.1 Job diario (cron, 07:00 ART)

```
POR CADA lead:

  1. Si status ∈ {new, qualifying, quoted}
     Y next_action_at < hoy - SLA(status):
        → transicionar al estado de vencimiento definido en §3.1
        → escribir lead_event(type='status_change', actor='system')
        → si el destino es dormant: dormant_until = hoy + 75 días

  2. Si status ∈ {qualified, negotiating, closing}
     Y next_action_at < hoy:
        → marcar flag `overdue` (no cambiar estado)
        → aparece arriba de todo en la vista "Hoy"

  3. Si status = dormant Y dormant_until <= hoy:
        → generar tarea de recontacto en la vista "Hoy"
        → reactivation_count += 1
        → si reactivation_count >= 2 → status = lost,
          lost_reason = 'no_response'
```

### 5.2 Validaciones a nivel de escritura

- `status` activo (`new`…`closing`) ⇒ `next_action_at NOT NULL`. Rechazar el guardado si falta.
- `status = lost` ⇒ `lost_reason NOT NULL`.
- `status = dormant` ⇒ `dormant_until NOT NULL` (default: hoy + 75 días).
- `status = quoted` ⇒ `quote_amount` y `quote_sent_at NOT NULL`.
- `status = won` ⇒ `won_amount` y `won_at NOT NULL`.
- Al pasar a `qualified` ⇒ `zone`, `qty_estimated` y `drilled` deben estar cargados.
- Deduplicación: si entra un mensaje de un `phone` que ya existe en estado `dormant`
  o `lost`, no se crea un lead nuevo — se reabre el existente y se conserva el historial.

### 5.3 Defaults de `next_action_at` al cambiar de estado

| Nuevo estado | `next_action_at` | `next_action` sugerido |
|---|---|---|
| `new` | +2 horas | "Responder y pedir zona/cantidad/agujereado" |
| `qualifying` | +1 día | "Reintento pidiendo datos" |
| `qualified` | +1 día | "Armar y mandar presupuesto" |
| `quoted` | +2 días | "Seguimiento post-presupuesto" |
| `negotiating` | +2 días | "Resolver objeción / contrapropuesta" |
| `closing` | +1 día | "Coordinar seña y entrega" |
| `dormant` | null | — (usa `dormant_until`) |

---

## 6. Vistas de UI

### 6.1 "Hoy" — pantalla principal (default al abrir el ERP)

No es una lista de leads, es una lista de acciones. Query:

```sql
SELECT * FROM leads
WHERE (status IN ('new','qualifying','qualified','quoted','negotiating','closing')
       AND next_action_at::date <= CURRENT_DATE)
   OR (status = 'dormant' AND dormant_until <= CURRENT_DATE)
ORDER BY
  CASE status
    WHEN 'closing' THEN 1 WHEN 'negotiating' THEN 2 WHEN 'qualified' THEN 3
    WHEN 'quoted' THEN 4 WHEN 'new' THEN 5 WHEN 'qualifying' THEN 6
    ELSE 7 END,
  next_action_at ASC;
```

Cada fila necesita: nombre, teléfono, estado, próxima acción, días vencido,
botón "Abrir WhatsApp" (`https://wa.me/<phone>`), y acciones rápidas de cambio de estado.

### 6.2 Kanban del embudo

Columnas: `new` → `qualifying` → `qualified` → `quoted` → `negotiating` → `closing` → `won`.
`dormant` y `lost` van en paneles colapsados aparte.
Drag & drop dispara la transición (validada contra §4.1) y abre un modal si el destino
requiere campos obligatorios (ej. `lost_reason`).

### 6.3 Ficha de lead

Datos + timeline de `lead_events` en orden cronológico inverso.

---

## 7. Métricas

Calculadas sobre `lead_events`, no sobre el estado actual:

- **Conversión por etapa**: % que pasa de cada estado al siguiente.
- **Tiempo promedio por etapa** (detecta dónde se traba el embudo).
- **Tasa de cierre global**: `won / (won + lost)`.
- **Distribución de `lost_reason`** → el dato que dice si el problema es precio, flete o producto.
- **Conversión por `lead_type`** → dónde conviene poner el esfuerzo comercial.
- **Conversión por `source`** → qué canal rinde.
- **Tasa de reactivación de `dormant`** → justifica (o no) mantener la base dormida.
- **Ticket promedio** de `won_amount` por `lead_type`.

---

## 8. Casos borde

1. **Cliente que vuelve después de ganado**: crear un lead nuevo vinculado por `phone`,
   no reabrir el ganado. Así la métrica de recompra queda medible.
2. **Lead que pide precio de nuevo estando en `dormant`**: reabrir a `qualifying` o
   `qualified` según los datos que ya estén cargados, sin resetear `reactivation_count`.
3. **Estacionalidad**: `dormant` con `dormant_until` es la base de recontacto más valiosa
   del negocio. No colapsar `dormant` dentro de `lost` en ninguna vista ni métrica.
4. **Múltiples presupuestos al mismo lead**: `quote_amount` guarda el último;
   el histórico completo vive en `lead_events` con `type='quote_sent'`.
5. **Lead sin teléfono** (viene por Instagram DM): permitir `phone` null solo si
   `source != 'whatsapp_organic'`, y usar otra clave de deduplicación (handle).

---

## 9. Checklist de implementación

- [ ] Migración: crear enums, tabla `leads`, tabla `lead_events`, índices
- [ ] Migración de datos: mapear estados viejos → nuevos
      (`nuevo`→`new`, `contactado`→`qualifying`, `ganado`→`won`, `perdido`→`lost`
      con `lost_reason='other'`)
- [ ] Capa de transiciones con validación contra la matriz de §4.1
- [ ] Hook post-transición: escribir `lead_event` + setear `next_action_at` default
- [ ] Validaciones de campos obligatorios por estado (§5.2)
- [ ] Job diario de SLA y reactivación (§5.1)
- [ ] Vista "Hoy"
- [ ] Kanban con drag & drop validado
- [ ] Ficha de lead con timeline
- [ ] Dashboard de métricas (§7)