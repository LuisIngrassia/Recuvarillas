/**
 * Alta y edición de un cliente, en un diálogo.
 *
 * Es el mismo formulario en los dos casos porque los campos son los mismos:
 * tener dos copias sería garantizar que un día se agregue un dato en una y no
 * en la otra.
 */
import { useState } from 'react'
import { createCustomer, updateCustomer } from '../api/customers'
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

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

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
          <Field label="Localidad">
            <Input value={form.localidad} onChange={set('localidad')} />
          </Field>
          <Field label="Provincia">
            <Input value={form.provincia} onChange={set('provincia')} />
          </Field>
          <Field label="Código postal">
            <Input value={form.codigo_postal} onChange={set('codigo_postal')} />
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
