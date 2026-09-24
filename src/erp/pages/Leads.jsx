/**
 * Leads: todo el que preguntó, venga de donde venga.
 *
 * Es la vista de archivo: todo el que preguntó, con buscador y filtros. La
 * pregunta de "¿a quién llamo ahora?" la contesta "Hoy", que ordena por
 * vencimiento y no por fecha de entrada; acá se viene a buscar a alguien
 * puntual o a repasar una etapa entera.
 *
 * Por eso ya no arranca filtrada por los sin contactar: con el embudo, "nuevo"
 * dejó de ser sinónimo de pendiente —un lead puede estar en negociación hace
 * tres semanas y ser mucho más urgente— y esa lista ahora vive en "Hoy".
 *
 * Al principio los leads sólo llegaban del simulador de la web. Ahora también
 * se cargan a mano, porque el que escribe por Instagram o llama por teléfono es
 * exactamente igual de lead y antes no tenía dónde anotarse.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_TONES,
  LEAD_STATES,
  LEAD_STATE_LABELS,
  LEAD_TYPES,
  LEAD_TYPE_LABELS,
  convertLeadToCustomer,
  createLead,
  createQuoteFromLead,
  deleteLead,
  linkLeadToCustomer,
  listLeadProvinces,
  listLeads,
  updateLead,
} from '../api/leads'
import { listCustomerOptions } from '../api/customers'
import { StatusBadge } from '../components/LeadPipeline'
import { listProducts } from '../api/stock'
import { listLocalidades, provinciasDe } from '../api/shipping'
import LocalidadField from '../components/LocalidadField'
import { useAsync } from '../lib/useAsync'
import { useDebounced } from '../lib/useDebounced'
import { formatDate, formatDateTime, formatNumber, formatPesos, whatsappLink } from '../lib/format'
import { varillaDe } from '../lib/items'
import { usePriceTiers } from '../../lib/priceTiers'
import { tierFor } from '../../lib/quote'
import { findPostalCode, loadPostalCodes } from '../../lib/postalCodes'
import { PROVINCES, canonicalProvince, esProvinciaConocida } from '../../lib/provinces'
import { ROAD_FACTOR } from '../../data/pricing'
import {
  Async,
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  Loading,
  Modal,
  Money,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
} from '../components/ui'

/**
 * El mensaje con el que se retoma el contacto.
 *
 * Cambia según de dónde vino y si llegó a cotizar algo. Decirle "vi que
 * cotizaste en nuestra web" a alguien que escribió por Instagram es la clase de
 * detalle que hace sonar el mensaje a formulario automático, que es justo lo
 * contrario de lo que se busca al retomar un contacto.
 */
function saludo(lead) {
  const arranque = `Hola ${lead.nombre}, te escribo de Recuvarilla.`

  if (!lead.cantidad) {
    return `${arranque} Vi tu consulta por las varillas. ¿Te paso un presupuesto?`
  }

  /* Sin el dato no se inventa: decirle "sin agujerear" al que nunca lo dijo es
     ponerle en la boca algo que no eligió, y encima es lo que hay que
     preguntarle. Se sale sin el adjetivo y con la pregunta. */
  const tipo =
    lead.agujereada === null || lead.agujereada === undefined
      ? ''
      : lead.agujereada
        ? ' agujereadas'
        : ' sin agujerear'
  const donde = lead.source === 'web' ? ' en nuestra web' : ''
  const cierre = tipo
    ? '¿Te sirve que repasemos el presupuesto?'
    : '¿Las querías agujereadas o comunes? Con eso te paso el presupuesto.'

  return `${arranque} Vi que cotizaste ${formatNumber(lead.cantidad)} varillas${tipo}${donde}. ${cierre}`
}

/**
 * Lo que quiere el lead, recalculado.
 *
 * La cantidad, el precio unitario y el monto son un solo dato repartido en tres
 * columnas. Si se corrige la cantidad y las otras dos quedan como estaban, la
 * fila pasa a decir "800 varillas" al lado del monto de 600, y ese número
 * después se lee como si lo hubiera pedido el cliente. Por eso las tres se
 * escriben siempre juntas.
 *
 * El precio sale de la lista minorista, que es con la que cotiza el simulador
 * de la web: un lead todavía no es cliente de nadie y no tiene lista propia. La
 * del cliente se aplica recién al armarle el presupuesto, que es cuando ya se
 * sabe cuál es.
 *
 * Sin cantidad las tres quedan en null. Vacío no es cero: el que preguntó un
 * precio por Instagram todavía no dijo cuántas necesita, y un cero se leería
 * como que pidió ninguna.
 */
function cotizacionDeLead(cantidad, agujereada, tiers) {
  if (!cantidad) return { cantidad: null, precio_unitario: null, mercaderia: null }

  const tier = tierFor(cantidad, tiers, 'minorista')
  const precio = agujereada ? tier.drilled : tier.plain

  return { cantidad, precio_unitario: precio, mercaderia: precio * cantidad }
}

/**
 * La ficha del lead: todo lo suyo, editable.
 *
 * Empezó mostrando sólo estado y notas, con los datos del simulador escritos en
 * gris arriba. Eso alcanzaba mientras el lead fuera un papelito para acordarse
 * de llamar, pero dejó de alcanzar cuando el lead pasó a ser de dónde sale el
 * cliente: el teléfono que llegó mal tipeado no se podía arreglar, el que dejó
 * el mail por Instagram no tenía dónde anotarlo, y esos son justamente los
 * datos que después se copian a la ficha del cliente.
 *
 * Así que se edita todo lo que el lead tiene. Lo único que no está acá es el
 * CUIT y la dirección de facturación: no se le piden a alguien que todavía está
 * preguntando un precio, y viven en la ficha del cliente, que es donde se
 * completan cuando hace falta facturarle.
 */
function LeadModal({ lead, onClose, onSaved }) {
  const tiers = usePriceTiers()
  /* El padrón son ~55 KB que se bajan una sola vez por sesión, y sólo si
     alguien abre una ficha. Sirve para que corregir el código postal complete
     la localidad y los kilómetros en lugar de dejarlos viejos. */
  const padron = useAsync(loadPostalCodes, [])

  /* Las localidades donde ya hay alguien, para proponerlas escritas siempre
     igual y decir de paso cuánta gente hay en cada una. */
  const localidades = useAsync(listLocalidades, [])

  const [form, setForm] = useState({
    nombre: lead.nombre,
    telefono: lead.telefono ?? '',
    email: lead.email ?? '',
    source: lead.source,
    lead_type: lead.lead_type ?? '',
    owner: lead.owner ?? '',
    cantidad: lead.cantidad === null ? '' : String(lead.cantidad),
    /* Como string y no como booleano porque son tres valores y no dos: el
       select necesita poder representar "todavía no se sabe". */
    agujereada: lead.agujereada === null || lead.agujereada === undefined
      ? ''
      : String(lead.agujereada),
    entrega: lead.entrega,
    codigo_postal: lead.codigo_postal ?? '',
    localidad: lead.localidad ?? '',
    provincia: lead.provincia ?? '',
    kilometros: lead.kilometros,
    notas: lead.notas ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) =>
    setForm((prev) => ({
      ...prev,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }))

  /*
    El código postal arrastra la localidad, la provincia y los kilómetros, que
    es lo que hace el simulador de la web. Si no está en el padrón sólo se
    guarda el código: los tres campos siguen siendo de texto y se pueden
    escribir a mano, porque el padrón no tiene todo.
  */
  const setCodigoPostal = (event) => {
    const codigo_postal = event.target.value
    const lugar = padron.data ? findPostalCode(padron.data, codigo_postal) : null

    setForm((prev) =>
      lugar
        ? {
            ...prev,
            codigo_postal,
            localidad: lugar.name,
            /* El padrón las escribe sin tildes. Se pasa al nombre de la lista
               para que un lead y un cliente digan el mismo texto, no dos que
               haya que normalizar para comparar. */
            provincia: canonicalProvince(lugar.province),
            kilometros: Math.round(lugar.km * ROAD_FACTOR),
          }
        : { ...prev, codigo_postal },
    )
  }

  const vacia = form.cantidad.trim() === ''
  const cantidadNum = vacia ? null : Number.parseInt(form.cantidad, 10)
  const cantidadValida = vacia || (Number.isFinite(cantidadNum) && cantidadNum >= 1)

  /* El valor del select vuelve a ser booleano —o null— antes de tocar nada
     más. Pasarlo crudo cotizaba mal: el string 'false' es verdadero. */
  const agujereada = form.agujereada === '' ? null : form.agujereada === 'true'

  /* El monto se recalcula mientras se escribe, no al guardar: que el número se
     mueva a la vista es lo que hace que no sorprenda después. */
  const cotizacion = cantidadValida
    ? cotizacionDeLead(cantidadNum, agujereada, tiers)
    : null

  const save = async () => {
    const nombre = form.nombre.trim()
    if (!nombre) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    if (!cantidadValida) {
      setError('La cantidad tiene que ser un número de varillas, o quedar vacía.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await updateLead(lead.id, {
        nombre,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        source: form.source,
        lead_type: form.lead_type || null,
        owner: form.owner.trim() || null,
        /* Se guarda desde acá y no sólo desde el diálogo de calificación. La
           ficha lo venía mostrando y no lo mandaba: se corregía, el precio de
           abajo se movía, y al volver a abrirla estaba como antes. */
        agujereada,
        entrega: form.entrega,
        codigo_postal: form.codigo_postal.trim() || null,
        localidad: form.localidad.trim() || null,
        provincia: canonicalProvince(form.provincia) || null,
        kilometros: form.kilometros ?? null,
        notas: form.notas.trim() || null,
        ...cotizacion,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  /* Se prueba el número mientras se escribe: que la ficha diga ahí mismo si
     sirve para WhatsApp evita el viaje de guardar, volver a la lista y ver que
     el botón sigue sin aparecer. */
  const wa = whatsappLink(form.telefono)

  return (
    <Modal title={lead.nombre} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={set('nombre')} />
          </Field>
          <Field
            label="De dónde salió"
            hint="Corregirlo cambia a qué canal se le atribuye este contacto."
          >
            <Select value={form.source} onChange={set('source')}>
              {LEAD_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {LEAD_SOURCE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Teléfono"
            hint={
              form.telefono.trim() === ''
                ? 'Sin teléfono no hay botón de WhatsApp.'
                : wa
                  ? 'Sirve para WhatsApp.'
                  : 'No se entiende como número: revisá el área, o poné el + del país si es del exterior.'
            }
          >
            <Input value={form.telefono} onChange={set('telefono')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Cuántas quiere"
            hint={
              cotizacion?.cantidad
                ? `${formatNumber(cotizacion.cantidad)} × ${formatPesos(cotizacion.precio_unitario)} = ${formatPesos(cotizacion.mercaderia)} + IVA, con la lista de hoy.`
                : 'Vacío mientras no haya dicho cuántas necesita.'
            }
          >
            <Input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.cantidad}
              onChange={set('cantidad')}
            />
          </Field>
          {/*
            El estado ya no se elige de una lista.

            Con cuatro estados sueltos daba igual, pero ahora hay un camino: cada
            etapa pide sus datos y sólo lleva a algunas otras. Un desplegable
            libre permitiría saltar de "nuevo" a "ganado" sin monto ni historia,
            que es exactamente lo que hacía que después no se supiera dónde se
            caía la venta. Se mueve con los botones de la ficha, que piden lo que
            falta.
          */}
          <Field label="Qué es el que pregunta" hint="Define con qué lista se le cotiza.">
            <Select value={form.lead_type} onChange={set('lead_type')}>
              <option value="">Sin definir</option>
              {LEAD_TYPES.map((value) => (
                <option key={value} value={value}>
                  {LEAD_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="¿Van agujereadas?"
          hint="Sin definir es una respuesta: quiere decir que todavía no contestó."
        >
          <Select value={form.agujereada} onChange={set('agujereada')}>
            <option value="">Todavía no se sabe</option>
            <option value="true">Sí, agujereadas</option>
            <option value="false">No, comunes</option>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entrega">
            <Select value={form.entrega} onChange={set('entrega')}>
              <option value="retiro">Retira en fábrica</option>
              <option value="envio">Con envío</option>
            </Select>
          </Field>
          <Field
            label="Código postal"
            hint={
              form.kilometros
                ? `${formatNumber(form.kilometros)} km hasta la fábrica.`
                : 'Completa la localidad y la distancia si está en el padrón.'
            }
          >
            <Input value={form.codigo_postal} onChange={setCodigoPostal} />
          </Field>
          <LocalidadField
            value={form.localidad}
            onChange={set('localidad')}
            provincia={form.provincia}
            localidades={localidades.data ?? []}
          />
          {/* Desplegable y no texto libre, igual que en la ficha del cliente:
              escrita a mano, la misma provincia entra de tres formas. */}
          <Field label="Provincia">
            <Select value={form.provincia} onChange={set('provincia')}>
              <option value="">Sin especificar</option>
              {(esProvinciaConocida(form.provincia) || !form.provincia
                ? PROVINCES
                : [form.provincia, ...PROVINCES]
              ).map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notas" hint="Qué dijo, cuándo volver a llamar, qué lo frenó.">
          <Textarea
            rows={4}
            value={form.notas}
            onChange={set('notas')}
          />
        </Field>

        <p className="text-xs text-steel-400">Entró el {formatDateTime(lead.created_at)}.</p>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} type="button">
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const NUEVO = {
  nombre: '',
  telefono: '',
  email: '',
  source: 'whatsapp_organic',
  cantidad: '',
  agujereada: '',
  localidad: '',
  notas: '',
}

/**
 * Alta a mano del que no vino por la web.
 *
 * Pide poco: nombre y de dónde salió. Lo demás es opcional porque en el momento
 * en que alguien escribe por Instagram no se sabe casi nada, y un formulario
 * que exige la cantidad obliga a inventarla.
 */
function NewLeadModal({ onClose, onSaved }) {
  const [form, setForm] = useState(NUEVO)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  /* Acá no se pide ni provincia ni código postal —a alguien que recién pregunta
     un precio no se le piden tres datos de domicilio— así que la lista sale sin
     filtrar. Igual sirve: dice si ya hay gente en el lugar que se está
     escribiendo. */
  const localidades = useAsync(listLocalidades, [])

  const set = (key) => (event) =>
    setForm((prev) => ({
      ...prev,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }))

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nombre = form.nombre.trim()
    if (!nombre) {
      setError('Poné al menos el nombre.')
      return
    }

    const cantidad = form.cantidad === '' ? null : Number.parseInt(form.cantidad, 10)
    if (cantidad !== null && (!Number.isFinite(cantidad) || cantidad < 1)) {
      setError('La cantidad tiene que ser un número de varillas, o quedar vacía.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await createLead({
        nombre,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        source: form.source,
        cantidad,
        /*
          Tres respuestas y no dos, igual que en la calificación: sí, no, y
          todavía no se sabe. Con una casilla la tercera se comía a la segunda
          —sin marcar quedaba en null— y el que había dicho que las quería
          lisas entraba como si no hubiera contestado. Es uno de los tres datos
          que hacen falta para calificar, así que confundirlos dejaba al lead
          trabado por un dato que en realidad estaba.
        */
        agujereada: form.agujereada === '' ? null : form.agujereada === 'true',
        localidad: form.localidad.trim() || null,
        notas: form.notas.trim() || null,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Nuevo lead" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={set('nombre')} autoFocus />
          </Field>
          <Field label="De dónde salió">
            <Select value={form.source} onChange={set('source')}>
              {LEAD_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {LEAD_SOURCE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={set('telefono')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cantidad" hint="Opcional, si ya dijo cuántas necesita.">
            <Input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.cantidad}
              onChange={set('cantidad')}
            />
          </Field>
          <LocalidadField
            value={form.localidad}
            onChange={set('localidad')}
            localidades={localidades.data ?? []}
          />
        </div>

        <Field
          label="¿Van agujereadas?"
          hint="Si todavía no lo dijo, dejalo sin definir: es distinto de que las quiera lisas."
        >
          <Select value={form.agujereada} onChange={set('agujereada')}>
            <option value="">Todavía no se sabe</option>
            <option value="true">Sí, agujereadas</option>
            <option value="false">No, comunes</option>
          </Select>
        </Field>

        <Field label="Notas" hint="Qué preguntó, por dónde escribió, quién lo trajo.">
          <Textarea rows={3} value={form.notas} onChange={set('notas')} />
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
 * Nuevo o uno que ya está.
 *
 * Antes hacer cliente creaba uno nuevo siempre. El que ya te compró y vuelve a
 * preguntar terminaba con dos fichas y la cuenta corriente partida al medio,
 * que es la duplicación de verdad: no viene de tener dos tablas, viene de no
 * poder decir "este es aquel".
 *
 * Está aparte porque la pregunta es la misma se llegue por donde se llegue —al
 * hacerlo cliente o al armarle el presupuesto—, y una de las dos pantallas
 * ofreciendo enganchar y la otra no sería la forma de que los duplicados
 * vuelvan por la puerta de atrás.
 */
function ElegirCliente({ modo, onModo, customerId, onCustomerId, customers }) {
  return (
    <>
      <div className="space-y-2">
        {[
          ['nuevo', 'Es un cliente nuevo', 'Se crea la ficha con los datos que ya dejó.'],
          ['existente', 'Ya es cliente', 'Se engancha el lead a su ficha, sin duplicarlo.'],
        ].map(([valor, titulo, detalle]) => (
          <label
            key={valor}
            className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
              modo === valor
                ? 'border-secondary-500 bg-secondary-50'
                : 'border-steel-200 hover:border-steel-300'
            }`}
          >
            <input
              type="radio"
              name="modo"
              checked={modo === valor}
              onChange={() => onModo(valor)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-semibold text-steel-700">{titulo}</span>
              <span className="block text-xs text-steel-500">{detalle}</span>
            </span>
          </label>
        ))}
      </div>

      {modo === 'existente' && (
        <Field label="¿Cuál?">
          <Select value={customerId} onChange={(event) => onCustomerId(event.target.value)}>
            <option value="">Elegir cliente…</option>
            {(customers ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </>
  )
}

/** Pasar el lead a cliente, sin cargarle nada todavía. */
function ConvertModal({ lead, onClose, onDone }) {
  const customers = useAsync(listCustomerOptions, [])
  const [modo, setModo] = useState('nuevo')
  const [customerId, setCustomerId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const confirmar = async () => {
    if (modo === 'existente' && !customerId) {
      setError('Elegí a qué cliente engancharlo.')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (modo === 'existente') {
        await linkLeadToCustomer(lead.id, customerId)
        onDone(customerId)
      } else {
        const customer = await convertLeadToCustomer(lead)
        onDone(customer.id)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`${lead.nombre} pasa a cliente`} onClose={onClose}>
      <div className="space-y-4">
        <ElegirCliente
          modo={modo}
          onModo={setModo}
          customerId={customerId}
          onCustomerId={setCustomerId}
          customers={customers.data}
        />

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={saving}>
            {saving ? 'Guardando…' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Armarle el presupuesto de lo que cotizó.
 *
 * El camino que reemplaza era: hacerlo cliente, entrar a su ficha, crear un
 * pedido, elegir el producto, tipear la cantidad, tipear el precio. Seis pasos
 * para volver a cargar datos que la persona ya escribió sola en la web, y en el
 * medio la cantidad que se copia mal.
 *
 * Lo único que esta pantalla pregunta es lo que de verdad hay que decidir: a
 * qué ficha va, si van agujereadas y a qué precio. El resto sale del lead.
 */
function QuoteModal({ lead, onClose, onDone }) {
  const products = useAsync(listProducts, [])
  const customers = useAsync(listCustomerOptions, [])
  const tiers = usePriceTiers()

  /* Si el lead ya está enganchado a un cliente no hay nada que preguntar: el
     presupuesto va a esa ficha. */
  const fijo = lead.customer ?? null

  const [modo, setModo] = useState('nuevo')
  const [customerId, setCustomerId] = useState('')
  const [cantidad, setCantidad] = useState(String(lead.cantidad))
  /*
    Si van agujereadas se decide acá cuando el lead no lo dice.

    Es el mismo motivo por el que la cantidad se puede corregir en esta
    pantalla: acá es donde se está hablando con la persona. Y es un dato que
    cambia el precio, así que no se puede resolver solo. Antes, un lead con el
    dato en null no matcheaba ninguno de los dos productos y el presupuesto se
    trababa con un "no hay un producto cargado para esa varilla, revisá Stock",
    que mandaba a mirar el depósito por algo que faltaba en el lead.
  */
  const [agujereada, setAgujereada] = useState(
    lead.agujereada === null || lead.agujereada === undefined
      ? ''
      : String(lead.agujereada),
  )
  const [precioModo, setPrecioModo] = useState('lista')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const elegido = (customers.data ?? []).find((item) => item.id === customerId) ?? null

  /*
    La cantidad se puede corregir acá porque acá es donde se está hablando con
    la persona: pidió 600 hace tres semanas y ahora dice 800. Obligar a salir,
    editar la ficha y volver es el rodeo que hace que se presupueste el número
    viejo.
  */
  const cantidadNum = Number.parseInt(cantidad, 10)
  const cantidadValida = Number.isFinite(cantidadNum) && cantidadNum >= 1

  /* Mientras el campo está vacío o a medio escribir, las cuentas de abajo
     siguen mostrando las del lead en vez de un NaN. Confirmar igual está
     bloqueado hasta que el número sea uno. */
  const cantidadUsada = cantidadValida ? cantidadNum : lead.cantidad

  /*
    La lista que le toca. Un cliente nuevo arranca minorista; uno que ya está
    cotiza con la suya, que puede ser la mayorista si es revendedor. Es la
    misma regla que aplica el alta de mercadería en un pedido.
  */
  const tipoCliente = fijo?.tipo ?? (modo === 'existente' ? elegido?.tipo : null) ?? 'minorista'

  const agujereadaBool = agujereada === '' ? null : agujereada === 'true'
  const cambioAgujereado = agujereadaBool !== null && agujereadaBool !== lead.agujereada

  const tier = tierFor(cantidadUsada, tiers, tipoCliente)
  const precioLista = agujereadaBool ? tier.drilled : tier.plain
  const precioCotizado =
    lead.precio_unitario === null ? null : Number(lead.precio_unitario)

  /*
    Lo que vio en la web puede no ser lo que dice la lista de hoy: los precios
    se mueven y el lead puede ser de hace tres semanas. Se muestran los dos y se
    elige, en vez de resolverlo en silencio para cualquiera de los dos lados:
    cobrarle de más al que ya vio un número enoja, y cobrarle de menos sin
    haberlo decidido es margen que se va sin que nadie lo note.

    Si se cambió la cantidad no se ofrece: el precio que vio era el de otro
    escalón, y respetárselo para una cantidad distinta no es respetar nada, es
    cotizar con un número que no corresponde.
  */
  const cambioCantidad = cantidadValida && cantidadNum !== lead.cantidad
  const distinto =
    !cambioCantidad &&
    !cambioAgujereado &&
    precioCotizado !== null &&
    precioCotizado !== precioLista
  const precioUsado = distinto && precioModo === 'cotizado' ? precioCotizado : precioLista

  /*
    La varilla es una sola. El agujereado va en la línea del pedido, así que
    acá ya no hay que buscar "el producto agujereado": antes se lo buscaba por
    igualdad estricta contra el dato del lead, y un lead que todavía no había
    dicho si las quería agujereadas no matcheaba ninguno de los dos y se comía
    un "revisá Stock" por un faltante que no existía.
  */
  const producto = varillaDe(products.data)

  const confirmar = async () => {
    if (!cantidadValida) {
      setError('Poné cuántas varillas lleva.')
      return
    }
    if (agujereadaBool === null) {
      setError('Decí si van agujereadas: es lo que decide el precio.')
      return
    }
    if (!producto) {
      setError('No hay ningún producto cargado. Revisá Stock.')
      return
    }
    if (!fijo && modo === 'existente' && !customerId) {
      setError('Elegí a qué cliente engancharlo.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const order = await createQuoteFromLead(lead, {
        customerId: fijo?.id ?? (modo === 'existente' ? customerId : null),
        productId: producto.id,
        agujereada: agujereadaBool,
        cantidad: cantidadNum,
        precioUnitario: precioUsado,
        /* Corregido acá, el lead queda diciendo lo que pide ahora. Con su
           monto al día: las tres columnas se escriben juntas. Y si el
           agujereado se contestó recién en esta pantalla, también se guarda:
           el dato que faltaba para calificarlo ya está. */
        leadChanges: {
          ...(cambioCantidad || cambioAgujereado
            ? cotizacionDeLead(cantidadNum, agujereadaBool, tiers)
            : null),
          ...(cambioAgujereado ? { agujereada: agujereadaBool } : null),
        },
      })
      onDone(order)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Presupuesto para ${lead.nombre}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md bg-steel-50 p-3 text-xs text-steel-600">
          <p className="mt-1">
            {lead.entrega === 'envio'
              ? `Envío a ${lead.localidad ?? '—'} (${lead.codigo_postal ?? '—'}). El flete queda a cotizar.`
              : 'Retira en fábrica.'}
          </p>
        </div>

        <Field
          label="Cuántas lleva"
          hint={
            cambioCantidad
              ? `Pidió ${formatNumber(lead.cantidad)}. Al guardar, el lead queda con la cantidad nueva.`
              : 'Es lo que cotizó. Si cambió, corregilo acá.'
          }
        >
          <Input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={cantidad}
            onChange={(event) => setCantidad(event.target.value)}
          />
        </Field>

        <Field
          label="¿Van agujereadas?"
          hint={
            lead.agujereada === null || lead.agujereada === undefined
              ? 'El lead no lo dice. Preguntáselo: cambia el precio, y al guardar queda anotado.'
              : cambioAgujereado
                ? `El lead decía ${lead.agujereada ? 'agujereadas' : 'comunes'}. Al guardar queda con lo de acá.`
                : 'Es lo que pidió. Si cambió, corregilo acá.'
          }
        >
          <Select value={agujereada} onChange={(event) => setAgujereada(event.target.value)}>
            <option value="">Todavía no se sabe</option>
            <option value="true">Sí, agujereadas</option>
            <option value="false">No, comunes</option>
          </Select>
        </Field>

        {products.loading ? (
          <Loading>Cargando productos…</Loading>
        ) : (
          <>
            {fijo ? (
              <p className="text-sm text-steel-600">
                Va a la ficha de <strong className="text-steel-800">{fijo.nombre}</strong>,
                a la que este lead ya está enganchado.
              </p>
            ) : (
              <ElegirCliente
                modo={modo}
                onModo={setModo}
                customerId={customerId}
                onCustomerId={setCustomerId}
                customers={customers.data}
              />
            )}

            {distinto && (
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-steel-600">
                  ¿A qué precio?
                </span>
                {[
                  [
                    'lista',
                    `Lista de hoy: ${formatPesos(precioLista)}`,
                    `Es la ${tipoCliente} vigente para ${formatNumber(cantidadUsada)} varillas.`,
                  ],
                  [
                    'cotizado',
                    `El que cotizó: ${formatPesos(precioCotizado)}`,
                    'Es el número que vio en la web el día que preguntó.',
                  ],
                ].map(([valor, titulo, detalle]) => (
                  <label
                    key={valor}
                    className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
                      precioModo === valor
                        ? 'border-secondary-500 bg-secondary-50'
                        : 'border-steel-200 hover:border-steel-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="precio"
                      checked={precioModo === valor}
                      onChange={() => setPrecioModo(valor)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-steel-700">
                        {titulo}
                      </span>
                      <span className="block text-xs text-steel-500">{detalle}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="rounded-md border border-steel-200 px-3 py-2 text-sm text-steel-600">
              <span className="flex items-baseline justify-between gap-3">
                <span>
                  {formatNumber(cantidadUsada)} × {formatPesos(precioUsado)}
                </span>
                <Money value={precioUsado * cantidadUsada} className="font-semibold" />
              </span>
              <span className="mt-1 block text-xs text-steel-400">
                Sin IVA. El presupuesto se abre para completar flete y vendedor.
              </span>
            </div>
          </>
        )}

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} disabled={saving || products.loading}>
            {saving ? 'Armando…' : 'Armar presupuesto'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function Leads() {
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  /* El filtro por provincia lo resuelve la base, no esta pantalla: la lista
     corta en las primeras 300 y filtrarla acá contestaría "los de Mendoza que
     entraron últimos", que no es lo que se está preguntando. */
  const [provincia, setProvincia] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [converting, setConverting] = useState(null)
  const [quoting, setQuoting] = useState(null)
  const [error, setError] = useState('')

  // El buscador espera a que dejes de escribir antes de consultar.
  const term = useDebounced(search)
  /* No depende de ningún filtro: es la lista de provincias que existen, y se
     pide una sola vez. */
  const provincias = useAsync(listLeadProvinces, [])

  const query = useAsync(
    () => listLeads({ status, source, provincia, search: term }),
    [status, source, term],
  )
  const navigate = useNavigate()

  const remove = async (lead) => {
    if (!confirm(`¿Borrar el lead de ${lead.nombre}?`)) return
    setError('')
    try {
      await deleteLead(lead.id)
      query.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description="Todo el que preguntó, esté donde esté del embudo. Para trabajar el día está “Hoy”; acá se busca."
        actions={
          <>
            <Link to="/erp/leads/tablero">
              <Button variant="ghost">Tablero</Button>
            </Link>
            <Button onClick={() => setCreating(true)}>Nuevo lead</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-auto"
        >
          <option value="">Todas las etapas</option>
          {LEAD_STATES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATE_LABELS[value]}
            </option>
          ))}
        </Select>
        <Select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="w-auto"
        >
          <option value="">Todos los canales</option>
          {LEAD_SOURCES.map((value) => (
            <option key={value} value={value}>
              {LEAD_SOURCE_LABELS[value]}
            </option>
          ))}
        </Select>
        <Select
          value={provincia}
          onChange={(event) => setProvincia(event.target.value)}
          className="w-auto"
        >
          <option value="">Todas las provincias</option>
          {provinciasDe(provincias.data ?? []).map((item) => (
            <option key={item.clave} value={item.clave}>
              {item.nombre} ({item.cuenta})
            </option>
          ))}
        </Select>
        <Input
          type="search"
          placeholder="Buscar por nombre, teléfono o email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-auto min-w-[16rem] flex-1"
        />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <Card>
        <Async
          query={query}
          empty={
            provincia
              ? 'No hay leads con dirección en esa provincia.'
              : status
                ? 'No hay leads en esa etapa.'
                : 'No hay leads con ese filtro.'
          }
        >
          {(leads) => (
            <Table
              head={
                <>
                  <Th>Contacto</Th>
                  <Th>Canal</Th>
                  <Th align="right">Cotizó</Th>
                  <Th align="right">Monto</Th>
                  <Th>Entrega</Th>
                  <Th>Etapa</Th>
                  <Th>Fecha</Th>
                  <Th align="right">Acciones</Th>
                </>
              }
            >
              {leads.map((lead) => {
                const wa = whatsappLink(lead.telefono, saludo(lead))

                return (
                  <tr key={lead.id} className="hover:bg-steel-50">
                    <Td>
                      <Link
                        to={`/erp/leads/${lead.id}`}
                        className="text-left font-medium text-steel-700 hover:text-secondary-500"
                      >
                        {lead.nombre}
                      </Link>
                      <span className="block text-xs text-steel-400">
                        {lead.telefono}
                        {lead.email ? ` · ${lead.email}` : ''}
                      </span>
                      {lead.notas && (
                        <span className="mt-1 block max-w-xs truncate text-xs italic text-steel-400">
                          {lead.notas}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={LEAD_SOURCE_TONES[lead.source]}>
                        {LEAD_SOURCE_LABELS[lead.source]}
                      </Badge>
                    </Td>
                    {/* Un lead cargado a mano no cotizó nada: mostrar 0 haría
                        creer que pidió cero varillas por cero pesos. */}
                    <Td align="right" className="tabular-nums text-steel-700">
                      {lead.cantidad === null ? (
                        <span className="text-steel-300">—</span>
                      ) : (
                        <>
                          {formatNumber(lead.cantidad)}
                          <span className="block text-xs text-steel-400">
                            {lead.agujereada === null
                          ? 'sin definir'
                          : lead.agujereada
                            ? 'agujereada'
                            : 'común'}
                          </span>
                        </>
                      )}
                    </Td>
                    <Td align="right">
                      {lead.mercaderia === null ? (
                        <span className="text-steel-300">—</span>
                      ) : (
                        <Money value={lead.mercaderia} />
                      )}
                    </Td>
                    <Td className="text-xs text-steel-500">
                      {lead.entrega === 'envio'
                        ? `${lead.localidad ?? '—'} · ${formatNumber(lead.kilometros ?? 0)} km`
                        : (lead.localidad ?? 'Retira')}
                      {/* La provincia, para que filtrar por ella deje una lista
                          en la que se ve por qué está cada uno. */}
                      {lead.provincia && (
                        <span className="block text-xs text-steel-400">
                          {lead.provincia}
                          {lead.codigo_postal ? ` · ${lead.codigo_postal}` : ''}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={lead.status} />
                      {lead.next_action_at && (
                        <span className="mt-1 block text-xs text-steel-400">
                          {formatDate(lead.next_action_at)}
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-steel-400">
                      {formatDateTime(lead.created_at)}
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md bg-secondary-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-secondary-600"
                          >
                            WhatsApp
                          </a>
                        )}
                        {/* Sin cantidad no hay nada que presupuestar: el que
                            escribió por Instagram todavía no dijo cuántas
                            necesita, y un presupuesto de cero varillas no es un
                            atajo, es un pedido vacío. */}
                        {lead.cantidad !== null && (
                          <Button
                            variant="soft"
                            className="px-2.5 py-1.5 text-xs"
                            onClick={() => setQuoting(lead)}
                          >
                            Presupuestar
                          </Button>
                        )}
                        {lead.customer ? (
                          <Button
                            variant="ghost"
                            className="px-2.5 py-1.5 text-xs"
                            onClick={() => navigate(`/erp/clientes/${lead.customer.id}`)}
                          >
                            Ver cliente
                          </Button>
                        ) : (
                          <Button
                            variant="soft"
                            className="px-2.5 py-1.5 text-xs"
                            onClick={() => setConverting(lead)}
                          >
                            Hacer cliente
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          className="px-2.5 py-1.5 text-xs"
                          onClick={() => remove(lead)}
                        >
                          Borrar
                        </Button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </Table>
          )}
        </Async>
      </Card>

      {editing && (
        <LeadModal
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.reload()
          }}
        />
      )}

      {creating && (
        <NewLeadModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            query.reload()
          }}
        />
      )}

      {quoting && (
        <QuoteModal
          lead={quoting}
          onClose={() => setQuoting(null)}
          /* Se abre el pedido y no la ficha del cliente: lo que se vino a hacer
             es el presupuesto, y ahí falta ponerle el flete y el vendedor antes
             de mandarlo. */
          onDone={(order) => navigate(`/erp/pedidos/${order.id}`)}
        />
      )}

      {converting && (
        <ConvertModal
          lead={converting}
          onClose={() => setConverting(null)}
          /* Abrir la ficha del cliente es lo que sigue naturalmente: se lo hizo
             cliente para cargarle un pedido. */
          onDone={(customerId) => navigate(`/erp/clientes/${customerId}`)}
        />
      )}
    </>
  )
}
