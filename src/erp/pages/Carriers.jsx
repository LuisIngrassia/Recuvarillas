/**
 * Los fletes: con quién se manda, hasta dónde llega cada uno y a cuánto.
 *
 * La pantalla está armada al revés de como se carga: arriba el probador, que es
 * lo que se usa todos los días —"¿quién me lleva 800 varillas a Rosario?"—, y
 * abajo el tarifario, que se toca cuando llega una lista nueva.
 *
 * Un transporte tiene zonas —cada una con la lista de ciudades a las que
 * llega— y cada zona su tarifario por cantidad. Se ve todo anidado porque así
 * se lee una lista de precios de transporte, que es de donde se copia.
 */
import { useState } from 'react'
import {
  CARRIER_TYPES,
  CARRIER_TYPE_LABELS,
  CARRIER_TYPE_TONES,
  addZonePlaces,
  ciudadesDe,
  convertZoneToPlaces,
  createCarrier,
  createRate,
  createZone,
  deleteCarrier,
  deleteRate,
  deleteZone,
  esPorRango,
  listCarriers,
  quoteFreight,
  removeZonePlaces,
  updateCarrier,
  updateRate,
  updateZone,
} from '../api/carriers'
import {
  loadPostalCodes,
  placesInProvince,
  placesInRange,
  provinceNames,
  searchPlaces,
} from '../../lib/postalCodes'
import { useAsync } from '../lib/useAsync'
import { useDebounced } from '../lib/useDebounced'
import { formatNumber, formatPesos } from '../lib/format'
import {
  Async,
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  Modal,
  Money,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
} from '../components/ui'

// ---------------------------------------------------------------------------
// Probador
// ---------------------------------------------------------------------------

/**
 * Qué transportes llegan a un destino y por cuánto.
 *
 * Es la misma consulta que hace la pantalla del pedido, puesta acá suelta para
 * poder revisar el tarifario sin tener que inventar un pedido de prueba.
 */
function Probador() {
  const [cp, setCp] = useState('')
  const [cantidad, setCantidad] = useState('')

  const cpFinal = useDebounced(cp)
  const cantidadFinal = useDebounced(cantidad)
  const unidades = Number.parseInt(cantidadFinal, 10)

  const query = useAsync(
    () => quoteFreight(cpFinal.trim(), unidades),
    [cpFinal, unidades],
  )

  return (
    <Card title="¿Quién llega y a cuánto?">
      <div className="grid gap-3 border-b border-steel-100 px-4 py-4 sm:grid-cols-[1fr_1fr_2fr] sm:items-end">
        <Field label="Código postal">
          <Input
            placeholder="2000"
            value={cp}
            onChange={(event) => setCp(event.target.value)}
          />
        </Field>
        <Field label="Cantidad">
          <Input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="800"
            value={cantidad}
            onChange={(event) => setCantidad(event.target.value)}
          />
        </Field>
        <p className="text-xs text-steel-400 sm:pb-2">
          Sirve tanto el código de cuatro dígitos como el largo con letras:
          «2000» y «S2000ABC» son lo mismo.
        </p>
      </div>

      {!cpFinal.trim() || !Number.isFinite(unidades) || unidades < 1 ? (
        <Empty>Poné un código postal y una cantidad.</Empty>
      ) : (
        <Async
          query={query}
          empty="Ningún transporte cargado llega a ese código postal con esa cantidad."
        >
          {(opciones) => (
            <Table
              head={
                <>
                  <Th>Transporte</Th>
                  <Th>Zona</Th>
                  <Th align="right">Plazo</Th>
                  <Th align="right">Precio</Th>
                  <Th align="right">Por varilla</Th>
                </>
              }
            >
              {opciones.map((opcion, indice) => (
                <tr
                  key={opcion.carrier_id}
                  /* El primero es el más barato: la consulta ya viene ordenada
                     por precio, así que no hace falta buscarlo. */
                  className={indice === 0 ? 'bg-secondary-50' : 'hover:bg-steel-50'}
                >
                  <Td className="font-medium text-steel-700">
                    {opcion.nombre}
                    <span className="ml-2">
                      <Badge tone={CARRIER_TYPE_TONES[opcion.tipo]}>
                        {CARRIER_TYPE_LABELS[opcion.tipo]}
                      </Badge>
                    </span>
                    {indice === 0 && (
                      <span className="ml-2 text-xs font-semibold text-secondary-600">
                        el más barato
                      </span>
                    )}
                  </Td>
                  <Td className="text-steel-500">{opcion.zona}</Td>
                  <Td align="right" className="whitespace-nowrap text-steel-500">
                    {opcion.plazo_dias === null ? '' : `${opcion.plazo_dias} días`}
                  </Td>
                  <Td align="right">
                    <Money value={opcion.precio} className="font-semibold text-steel-800" />
                  </Td>
                  <Td align="right">
                    <Money
                      value={Number(opcion.precio) / unidades}
                      className="text-xs text-steel-400"
                    />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Async>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------

function CarrierModal({ carrier, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    nombre: carrier?.nombre ?? '',
    tipo: carrier?.tipo ?? 'expreso',
    contacto: carrier?.contacto ?? '',
    telefono: carrier?.telefono ?? '',
    email: carrier?.email ?? '',
    plazo_dias: carrier?.plazo_dias == null ? '' : String(carrier.plazo_dias),
    notas: carrier?.notas ?? '',
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nombre = form.nombre.trim()
    if (!nombre) {
      setError('Poné el nombre del transporte.')
      return
    }

    setSaving(true)
    setError('')

    const values = {
      nombre,
      tipo: form.tipo,
      contacto: form.contacto.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      plazo_dias: form.plazo_dias === '' ? null : Number.parseInt(form.plazo_dias, 10),
      notas: form.notas.trim() || null,
    }

    try {
      if (carrier) await updateCarrier(carrier.id, values)
      else await createCarrier(values)
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={carrier ? 'Editar transporte' : 'Nuevo transporte'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={set('nombre')} autoFocus />
          </Field>
          <Field label="Tipo">
            <Select value={form.tipo} onChange={set('tipo')}>
              {CARRIER_TYPES.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {CARRIER_TYPE_LABELS[tipo]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contacto">
            <Input value={form.contacto} onChange={set('contacto')} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={set('telefono')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Plazo (días)" hint="El habitual. Cada zona puede tener el suyo.">
            <Input
              type="number"
              min="0"
              step="1"
              value={form.plazo_dias}
              onChange={set('plazo_dias')}
            />
          </Field>
        </div>

        <Field label="Notas">
          <Textarea rows={2} value={form.notas} onChange={set('notas')} />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * A qué ciudades llega una zona.
 *
 * Es el reemplazo del rango de códigos postales, y el cambio no es de forma: un
 * expreso que llega a Rosario y a Venado Tuerto no llega a todo lo que hay en
 * el medio, y el rango decía que sí. Cotizaba envíos a pueblos a los que nadie
 * iba, y eso se descubre cuando el cliente ya tiene el precio en la mano.
 *
 * Se busca por nombre o por código postal contra el mismo padrón que usa el
 * simulador de la web, así que la localidad que se guarda es la misma que va a
 * traer el pedido — que es lo único que hace que después se encuentren.
 */
function PlacesModal({ zone, onClose, onSaved }) {
  const padron = useAsync(loadPostalCodes, [])
  const [busqueda, setBusqueda] = useState('')
  const [provincia, setProvincia] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const termino = useDebounced(busqueda, 200)
  const data = padron.data
  const ciudades = ciudadesDe(zone)

  /* Lo que ya está cargado, para no volver a ofrecerlo en los resultados. */
  const yaEstan = new Set(ciudades.flatMap((ciudad) => ciudad.codes))

  const resultados = data ? searchPlaces(data, termino) : []
  const disponibles = resultados.filter(
    (lugar) => !lugar.codes.every((cp) => yaEstan.has(cp)),
  )

  const correr = async (accion) => {
    setGuardando(true)
    setError('')
    try {
      await accion()
      await onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const agregar = (lugar) => correr(() => addZonePlaces(zone.id, [lugar]))
  const quitar = (ciudad) => correr(() => removeZonePlaces(zone.id, ciudad.codes))

  /*
    Una provincia entera de un saque. El modelo sigue siendo una lista de
    ciudades —no vuelve el rango— pero cargar Santa Fe de a una son doscientas
    búsquedas, y nadie lo haría: terminaría cargando un rango a mano en otro
    lado.
  */
  const agregarProvincia = () => {
    if (!data || !provincia) return
    const lugares = placesInProvince(data, provincia)
    const nuevos = lugares.filter((lugar) => !lugar.codes.every((cp) => yaEstan.has(cp)))

    if (nuevos.length === 0) {
      setError(`${provincia} ya está entera en esta zona.`)
      return
    }
    if (
      !confirm(
        `Agregar ${nuevos.length} localidades de ${provincia} a la zona "${zone.nombre}"?`,
      )
    ) {
      return
    }
    correr(() => addZonePlaces(zone.id, nuevos))
  }

  return (
    <Modal title={`A dónde llega · ${zone.nombre}`} onClose={onClose}>
      <div className="space-y-4">
        {esPorRango(zone) && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            Esta zona todavía cotiza por el rango{' '}
            <strong>
              CP {zone.cp_desde}–{zone.cp_hasta}
            </strong>
            . Apenas le agregues la primera ciudad, manda la lista y el rango deja
            de aplicar: sólo va a cotizar a las ciudades que cargues.
          </div>
        )}

        <Field
          label="Buscar una ciudad"
          hint="Por nombre o por código postal. Sale del mismo padrón que usa el simulador."
        >
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Venado Tuerto, 2600…"
            autoFocus
          />
        </Field>

        {padron.error && <ErrorNote>No se pudo cargar el padrón de localidades.</ErrorNote>}

        {termino.trim().length >= 2 && (
          <div className="max-h-48 overflow-y-auto rounded-md border border-steel-200">
            {!data ? (
              <p className="px-3 py-2 text-xs text-steel-400">Cargando el padrón…</p>
            ) : disponibles.length === 0 ? (
              <p className="px-3 py-2 text-xs text-steel-400">
                {resultados.length > 0
                  ? 'Todo lo que coincide ya está en la zona.'
                  : 'Ninguna localidad coincide.'}
              </p>
            ) : (
              <ul className="divide-y divide-steel-100">
                {disponibles.map((lugar) => (
                  <li
                    key={`${lugar.clave}`}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="text-sm text-steel-700">
                      {lugar.name}
                      <span className="block text-xs text-steel-400">
                        {lugar.province} ·{' '}
                        {lugar.codes.length === 1
                          ? `CP ${lugar.codes[0]}`
                          : `${lugar.codes.length} códigos postales`}
                      </span>
                    </span>
                    <Button
                      variant="soft"
                      className="px-2.5 py-1 text-xs"
                      disabled={guardando}
                      onClick={() => agregar(lugar)}
                    >
                      Agregar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 border-t border-steel-100 pt-4">
          <div className="min-w-[12rem] flex-1">
            <Field label="O una provincia entera">
              <Select
                value={provincia}
                onChange={(event) => setProvincia(event.target.value)}
              >
                <option value="">Elegir provincia…</option>
                {(data ? provinceNames(data) : []).map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button
            variant="ghost"
            type="button"
            disabled={!provincia || guardando}
            onClick={agregarProvincia}
          >
            Agregar provincia
          </Button>
        </div>

        <ErrorNote>{error}</ErrorNote>

        <div className="border-t border-steel-100 pt-4">
          <p className="mb-2 text-xs font-semibold text-steel-600">
            Llega a {ciudades.length === 0 ? 'ninguna ciudad todavía' : null}
            {ciudades.length > 0 &&
              `${formatNumber(ciudades.length)} ${
                ciudades.length === 1 ? 'ciudad' : 'ciudades'
              }`}
          </p>

          {ciudades.length === 0 ? (
            <p className="rounded-md bg-steel-50 px-3 py-2 text-xs text-steel-500">
              Sin ciudades cargadas esta zona no cotiza a ningún lado
              {esPorRango(zone) ? ', salvo por su rango viejo' : ''}.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {ciudades.map((ciudad) => (
                <li
                  key={ciudad.clave}
                  className="flex items-center justify-between gap-3 rounded-md bg-steel-50 px-3 py-1.5"
                >
                  <span className="text-sm text-steel-700">
                    {ciudad.localidad}
                    <span className="text-xs text-steel-400">
                      {ciudad.provincia ? ` · ${ciudad.provincia}` : ''}
                      {ciudad.codes.length === 1
                        ? ` · CP ${ciudad.codes[0]}`
                        : ` · ${ciudad.codes.length} CP`}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => quitar(ciudad)}
                    className="text-xs text-steel-400 underline-offset-2 hover:text-red-600 hover:underline"
                  >
                    quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" type="button" onClick={onClose}>
            Listo
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ZoneModal({ zone, carrierId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    nombre: zone?.nombre ?? '',
    plazo_dias: zone?.plazo_dias == null ? '' : String(zone.plazo_dias),
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nombre = form.nombre.trim()

    if (!nombre) {
      setError('Poné un nombre para la zona.')
      return
    }

    setSaving(true)
    setError('')

    const values = {
      nombre,
      plazo_dias: form.plazo_dias === '' ? null : Number.parseInt(form.plazo_dias, 10),
    }

    try {
      if (zone) await updateZone(zone.id, values)
      else await createZone({ ...values, carrier_id: carrierId })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={zone ? 'Editar zona' : 'Nueva zona'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre de la zona" hint="Como lo llama el transporte: «AMBA», «Cuyo», «Litoral».">
          <Input value={form.nombre} onChange={set('nombre')} autoFocus />
        </Field>

        <Field label="Plazo (días)" hint="Opcional. Si no se pone, vale el del transporte.">
          <Input
            type="number"
            min="0"
            step="1"
            value={form.plazo_dias}
            onChange={set('plazo_dias')}
          />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <p className="rounded-md bg-steel-50 px-3 py-2 text-xs leading-relaxed text-steel-500">
          {zone
            ? 'A qué ciudades llega se carga con el botón «Ciudades», sobre la zona.'
            : 'Después de guardarla hay que decirle a qué ciudades llega: hasta entonces no cotiza a ningún lado.'}{' '}
          Las zonas pueden solaparse — si dos cubren el mismo destino, al cotizar
          gana la más barata.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function RateModal({ rate, zoneId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    min_qty: rate ? String(rate.min_qty) : '1',
    max_qty: rate?.max_qty == null ? '' : String(rate.max_qty),
    precio_fijo: rate ? String(Number(rate.precio_fijo)) : '',
    precio_por_unidad: rate ? String(Number(rate.precio_por_unidad)) : '',
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    const min = Number.parseInt(form.min_qty, 10)
    const max = form.max_qty === '' ? null : Number.parseInt(form.max_qty, 10)
    /* El campo vacío es cero acá, a diferencia del precio de un ítem: una tarifa
       puede ser sólo fija o sólo por unidad, y exigir escribir "0" en la otra
       sería pedir un dato que no aporta. */
    const fijo = form.precio_fijo === '' ? 0 : Number(form.precio_fijo)
    const porUnidad = form.precio_por_unidad === '' ? 0 : Number(form.precio_por_unidad)

    if (!Number.isFinite(min) || min < 1) {
      setError('El escalón tiene que arrancar en 1 o más.')
      return
    }
    if (max !== null && max < min) {
      setError('El tope no puede ser menor que el arranque.')
      return
    }
    if (!Number.isFinite(fijo) || !Number.isFinite(porUnidad) || fijo < 0 || porUnidad < 0) {
      setError('Revisá los precios.')
      return
    }
    if (fijo === 0 && porUnidad === 0) {
      setError('Poné al menos uno de los dos precios: un flete gratis no se cotiza.')
      return
    }

    setSaving(true)
    setError('')

    const values = {
      min_qty: min,
      max_qty: max,
      precio_fijo: fijo,
      precio_por_unidad: porUnidad,
    }

    try {
      if (rate) await updateRate(rate.id, values)
      else await createRate({ ...values, zone_id: zoneId })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={rate ? 'Editar tarifa' : 'Nueva tarifa'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desde (varillas)">
            <Input
              type="number"
              min="1"
              step="1"
              value={form.min_qty}
              onChange={set('min_qty')}
              autoFocus
            />
          </Field>
          <Field label="Hasta" hint="Vacío = sin tope.">
            <Input type="number" min="1" step="1" value={form.max_qty} onChange={set('max_qty')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Precio fijo" hint="Lo que cuesta el envío, vaya la cantidad que vaya.">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.precio_fijo}
              onChange={set('precio_fijo')}
            />
          </Field>
          <Field label="Precio por varilla" hint="Lo que se suma por cada una.">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.precio_por_unidad}
              onChange={set('precio_por_unidad')}
            />
          </Field>
        </div>

        <ErrorNote>{error}</ErrorNote>

        <p className="rounded-md bg-steel-50 px-3 py-2 text-xs text-steel-500">
          Los dos se suman: <strong>fijo + por varilla × cantidad</strong>. Uno
          de los dos en blanco cubre el caso simple; los dos cargados sirven para
          el «mínimo más excedente».
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Tarifario
// ---------------------------------------------------------------------------

/** Cómo se lee una tarifa: "$12.000", "$80 por varilla" o la suma de las dos. */
function precioTexto(rate) {
  const partes = []
  if (Number(rate.precio_fijo) > 0) partes.push(formatPesos(Number(rate.precio_fijo)))
  if (Number(rate.precio_por_unidad) > 0) {
    partes.push(`${formatPesos(Number(rate.precio_por_unidad))} por varilla`)
  }
  return partes.join(' + ')
}

function CarrierCard({ carrier, onEdit, onChanged, onError }) {
  const [nuevaZona, setNuevaZona] = useState(false)
  const [zonaEditando, setZonaEditando] = useState(null)
  /* El id y no la zona: al agregar una ciudad la lista se vuelve a pedir, y un
     objeto congelado al abrir el diálogo seguiría mostrando la de antes. */
  const [ciudadesZonaId, setCiudadesZonaId] = useState(null)
  const [tarifaEditando, setTarifaEditando] = useState(null)

  const zonaDeCiudades = carrier.zones.find((zone) => zone.id === ciudadesZonaId)

  const guard = async (fn) => {
    onError('')
    try {
      await fn()
      onChanged()
    } catch (err) {
      onError(err.message)
    }
  }

  /*
    Convertir una zona vieja: se traduce su rango a las ciudades que de verdad
    hay adentro y se le borra el rango. No lo hace el schema al correr porque el
    padrón vive acá, en el navegador — y porque la lista que sale del rango hay
    que mirarla: es el punto de partida, no la respuesta.
  */
  const convertir = async (zone) => {
    const data = await loadPostalCodes()
    const lugares = placesInRange(data, zone.cp_desde, zone.cp_hasta)

    if (lugares.length === 0) {
      alert(
        `En el rango CP ${zone.cp_desde}–${zone.cp_hasta} no hay ninguna localidad del padrón. Cargale las ciudades a mano desde «Ciudades».`,
      )
      return
    }
    if (
      !confirm(
        `La zona "${zone.nombre}" pasa a llegar a ${lugares.length} ciudades, las que hay entre CP ${zone.cp_desde} y ${zone.cp_hasta}. Después podés sacar las que no correspondan. ¿Convertirla?`,
      )
    ) {
      return
    }

    guard(() => convertZoneToPlaces(zone.id, lugares))
  }

  return (
    <>
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{carrier.nombre}</span>
            <Badge tone={CARRIER_TYPE_TONES[carrier.tipo]}>
              {CARRIER_TYPE_LABELS[carrier.tipo]}
            </Badge>
            {!carrier.activo && <Badge tone="bad">Inactivo</Badge>}
          </span>
        }
        actions={
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              className="px-2.5 py-1.5 text-xs"
              onClick={() => setNuevaZona(true)}
            >
              Nueva zona
            </Button>
            <Button
              variant="ghost"
              className="px-2.5 py-1.5 text-xs"
              onClick={() =>
                guard(() => updateCarrier(carrier.id, { activo: !carrier.activo }))
              }
            >
              {carrier.activo ? 'Desactivar' : 'Activar'}
            </Button>
            <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={onEdit}>
              Editar
            </Button>
            <Button
              variant="danger"
              className="px-2.5 py-1.5 text-xs"
              onClick={() => {
                if (
                  !confirm(
                    `¿Borrar ${carrier.nombre}? Se van también sus zonas y tarifas. Los pedidos que lo tengan cargado quedan sin transporte, pero conservan el importe del flete.`,
                  )
                ) {
                  return
                }
                guard(() => deleteCarrier(carrier.id))
              }}
            >
              Borrar
            </Button>
          </div>
        }
      >
        {(carrier.contacto || carrier.telefono || carrier.email || carrier.notas) && (
          <p className="border-b border-steel-100 px-4 py-2 text-xs text-steel-500">
            {[carrier.contacto, carrier.telefono, carrier.email].filter(Boolean).join(' · ')}
            {carrier.notas && (
              <span className="block text-steel-400">{carrier.notas}</span>
            )}
          </p>
        )}

        {carrier.zones.length === 0 ? (
          <Empty>Sin zonas cargadas: todavía no cotiza a ningún lado.</Empty>
        ) : (
          <div className="divide-y divide-steel-100">
            {carrier.zones.map((zone) => (
              <div key={zone.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-steel-700">
                    {zone.nombre}
                    <span className="ml-2 font-normal text-xs text-steel-400">
                      {/* A dónde llega, que es lo que define la zona. Una que
                          todavía va por rango se marca: sigue cotizando, pero
                          cotiza de más. */}
                      {esPorRango(zone) ? (
                        <span className="text-amber-600">
                          por rango CP {zone.cp_desde}–{zone.cp_hasta}
                        </span>
                      ) : ciudadesDe(zone).length === 0 ? (
                        <span className="text-red-600">sin ciudades</span>
                      ) : (
                        `${formatNumber(ciudadesDe(zone).length)} ${
                          ciudadesDe(zone).length === 1 ? 'ciudad' : 'ciudades'
                        }`
                      )}
                      {zone.plazo_dias !== null && ` · ${zone.plazo_dias} días`}
                    </span>
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      variant="soft"
                      className="px-2 py-1 text-xs"
                      onClick={() => setCiudadesZonaId(zone.id)}
                    >
                      Ciudades
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => setTarifaEditando({ zoneId: zone.id })}
                    >
                      Nueva tarifa
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => setZonaEditando(zone)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        if (!confirm(`¿Borrar la zona ${zone.nombre} y sus tarifas?`)) return
                        guard(() => deleteZone(zone.id))
                      }}
                    >
                      Borrar
                    </Button>
                  </div>
                </div>

                {esPorRango(zone) && (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    Cotiza a <strong>todo</strong> lo que caiga entre CP{' '}
                    {zone.cp_desde} y {zone.cp_hasta}, y eso casi nunca es cierto:
                    un expreso que llega a dos ciudades no llega a todo lo que hay
                    en el medio.{' '}
                    <button
                      type="button"
                      onClick={() => convertir(zone)}
                      className="font-semibold underline underline-offset-2"
                    >
                      Convertirla a la lista de ciudades del rango
                    </button>{' '}
                    y sacar de ahí las que no correspondan.
                  </p>
                )}

                {zone.rates.length === 0 ? (
                  <p className="mt-2 text-xs text-steel-400">
                    Sin tarifas: esta zona no cotiza hasta que tenga al menos una.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {zone.rates.map((rate) => (
                      <li
                        key={rate.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-steel-50 px-3 py-1.5 text-sm"
                      >
                        <span className="tabular-nums text-steel-600">
                          {formatNumber(rate.min_qty)}
                          {rate.max_qty === null
                            ? ' o más'
                            : ` a ${formatNumber(rate.max_qty)}`}{' '}
                          varillas
                        </span>
                        <span className="flex items-baseline gap-3">
                          <span className="tabular-nums font-medium text-steel-800">
                            {precioTexto(rate)}
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-steel-400 underline-offset-2 hover:text-steel-600 hover:underline"
                            onClick={() => setTarifaEditando({ zoneId: zone.id, rate })}
                          >
                            editar
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-400 underline-offset-2 hover:text-red-600 hover:underline"
                            onClick={() => {
                              if (!confirm('¿Borrar esta tarifa?')) return
                              guard(() => deleteRate(rate.id))
                            }}
                          >
                            borrar
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {(nuevaZona || zonaEditando) && (
        <ZoneModal
          zone={zonaEditando}
          carrierId={carrier.id}
          onClose={() => {
            setNuevaZona(false)
            setZonaEditando(null)
          }}
          onSaved={() => {
            setNuevaZona(false)
            setZonaEditando(null)
            onChanged()
          }}
        />
      )}

      {zonaDeCiudades && (
        <PlacesModal
          zone={zonaDeCiudades}
          onClose={() => setCiudadesZonaId(null)}
          onSaved={onChanged}
        />
      )}

      {tarifaEditando && (
        <RateModal
          rate={tarifaEditando.rate ?? null}
          zoneId={tarifaEditando.zoneId}
          onClose={() => setTarifaEditando(null)}
          onSaved={() => {
            setTarifaEditando(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}

export default function Carriers() {
  const query = useAsync(listCarriers, [])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  return (
    <>
      <PageHeader
        title="Fletes"
        description="Con quién se manda, hasta dónde llega cada uno y a cuánto."
        actions={<Button onClick={() => setEditing({})}>Nuevo transporte</Button>}
      />

      <div className="mb-6">
        <Probador />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Async query={query} empty="Todavía no hay transportes cargados.">
        {(carriers) => (
          <div className="space-y-4">
            {carriers.map((carrier) => (
              <CarrierCard
                key={carrier.id}
                carrier={carrier}
                onEdit={() => setEditing(carrier)}
                onChanged={query.reload}
                onError={setError}
              />
            ))}
          </div>
        )}
      </Async>

      <p className="mt-4 text-xs text-steel-400">
        El camión propio se carga como un transporte más, con tipo «camión
        propio». Sale plata igual —combustible, chofer, tiempo—, así que ponerle
        su tarifa es lo que permite comparar de verdad cuándo conviene mandarlo.
      </p>

      {editing && (
        <CarrierModal
          carrier={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.reload()
          }}
        />
      )}
    </>
  )
}
