/**
 * Alta y edición de un cliente, en un diálogo.
 *
 * Es el mismo formulario en los dos casos porque los campos son los mismos:
 * tener dos copias sería garantizar que un día se agregue un dato en una y no
 * en la otra.
 */
import { useState } from 'react'
import { createCustomer, updateCustomer } from '../api/customers'
import { PROVINCES, canonicalProvince, esProvinciaConocida } from '../../lib/provinces'
import { findPostalCode, loadPostalCodes } from '../../lib/postalCodes'
import { useAsync } from '../lib/useAsync'
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from './ui'

const EMPTY = {
  nombre: '',
  tipo: 'minorista',
  telefono: '',
  email: '',
  cuit: '',
  direccion: '',
  localidad: '',
  provincia: '',
  codigo_postal: '',
  notas: '',
}

export default function CustomerForm({ customer, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...cleaned(customer) }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  /* El padrón de códigos postales, el mismo que usa el simulador de la web. Se
     baja aparte y recién cuando este diálogo se abre. */
  const padron = useAsync(loadPostalCodes, [])

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  /*
    El código postal arrastra la localidad y la provincia, igual que en el alta
    de un lead. Es la otra mitad de tener la provincia en un desplegable: de
    poco sirve elegirla bien de una lista si la localidad de al lado se escribe
    a mano y queda "rosario " con un espacio al final.

    Si el código no está en el padrón sólo se guarda el código y los otros dos
    campos se dejan como estaban: el padrón no tiene todo, y pisar con vacío lo
    que alguien ya había escrito sería peor que no ayudar.
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
            provincia: canonicalProvince(lugar.province),
          }
        : { ...prev, codigo_postal },
    )
  }

  /* Un dato viejo que no coincide con ningún nombre de la lista se ofrece
     igual, como está. Cambiárselo solo al abrir el diálogo sería corregir por
     nuestra cuenta la provincia de un cliente que nadie vino a tocar. */
  const opciones = esProvinciaConocida(form.provincia) || !form.provincia
    ? PROVINCES
    : [form.provincia, ...PROVINCES]

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.nombre.trim()) {
      setError('El cliente necesita un nombre.')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Los campos vacíos se guardan como null y no como cadena vacía: así una
      // consulta por "sin teléfono" da lo que uno espera.
      const values = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value?.trim() || null]),
      )
      values.nombre = form.nombre.trim()
      values.tipo = form.tipo
      /* Por si viene de un dato viejo: lo que salga de la lista ya es canónico,
         pero esto deja parejo lo que estaba cargado de antes. */
      values.provincia = canonicalProvince(form.provincia) || null

      const saved = customer
        ? await updateCustomer(customer.id, values)
        : await createCustomer(values)

      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={customer ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre o razón social">
            <Input value={form.nombre} onChange={set('nombre')} autoFocus />
          </Field>
          <Field
            label="Tipo"
            hint="Mayorista es el revendedor: lista mayorista y sin comisión. Empresa es la que trae su propio plástico a reciclar."
          >
            <Select value={form.tipo} onChange={set('tipo')}>
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista (revendedor)</option>
              <option value="empresa">Empresa (trae su plástico)</option>
            </Select>
          </Field>
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={set('telefono')} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="CUIT">
            <Input value={form.cuit} onChange={set('cuit')} />
          </Field>
          <Field label="Dirección">
            <Input value={form.direccion} onChange={set('direccion')} />
          </Field>
          <Field
            label="Código postal"
            hint="Completa la localidad y la provincia solas, si está en el padrón."
          >
            <Input
              value={form.codigo_postal}
              onChange={setCodigoPostal}
              inputMode="numeric"
              placeholder="2000"
            />
          </Field>
          <Field label="Localidad">
            <Input value={form.localidad} onChange={set('localidad')} />
          </Field>
          {/* Desplegable y no texto libre: escrita a mano, la misma provincia
              entra como "Córdoba", "Cordoba" y "Cba", y después no hay forma de
              juntarlas en una lista ni de filtrar por ellas. */}
          <Field label="Provincia">
            <Select value={form.provincia} onChange={set('provincia')}>
              <option value="">Sin especificar</option>
              {opciones.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notas">
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
 * Deja sólo los campos del formulario y cambia los null por texto vacío: un
 * `<input>` con `value={null}` pasa a no controlado y React protesta.
 */
function cleaned(customer) {
  if (!customer) return {}

  return Object.fromEntries(
    Object.keys(EMPTY).map((key) => [key, customer[key] ?? '']),
  )
}
