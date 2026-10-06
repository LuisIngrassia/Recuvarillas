/**
 * El editor del texto de un documento, para un producto.
 *
 * Arma el formulario a partir de `CAMPOS` (ver `lib/fichas.js`): cada
 * documento dice qué campos tiene y de qué tipo, y acá hay un control por
 * tipo. Así un campo nuevo se agrega en una línea y no en tres pantallas.
 *
 * Guarda el contenido entero, no sólo lo que se tocó. El punto de partida
 * de la varilla está en el código, y si se guardara sólo la diferencia, un
 * cambio en ese punto de partida reescribiría en silencio papeles que alguien
 * ya había revisado.
 */
import { useState } from 'react'
import { updateProduct } from '../api/products'
import { uploadPhoto } from '../api/social'
import { CAMPOS, DIBUJO_GENERADO, IMAGENES_MARCA, contenidoDe, urlDeImagen } from '../lib/fichas'
import DibujoDimensiones from './DibujoDimensiones'
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from './ui'

/** Una lista de textos, un ítem por renglón. */
function CampoLista({ value, onChange }) {
  return (
    <Textarea
      rows={Math.max(3, (value?.length ?? 0) + 1)}
      value={(value ?? []).join('\n')}
      onChange={(event) => onChange(event.target.value.split('\n'))}
    />
  )
}

/** Una tabla de dato y valor, con alta, baja y orden. */
function CampoPares({ value, onChange, conPendiente }) {
  const filas = value ?? []
  const cambiar = (i, cambios) =>
    onChange(filas.map((fila, j) => (j === i ? { ...fila, ...cambios } : fila)))
  const mover = (i, delta) => {
    const destino = i + delta
    if (destino < 0 || destino >= filas.length) return
    const copia = [...filas]
    ;[copia[i], copia[destino]] = [copia[destino], copia[i]]
    onChange(copia)
  }

  return (
    <div className="space-y-2">
      {filas.map((fila, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Input
            className="sm:w-48"
            placeholder="Dato"
            value={fila.clave ?? ''}
            onChange={(event) => cambiar(i, { clave: event.target.value })}
          />
          <Input
            placeholder="Valor"
            value={fila.valor ?? ''}
            onChange={(event) => cambiar(i, { valor: event.target.value })}
          />
          {conPendiente && (
            <label
              className="flex shrink-0 items-center gap-1 text-xs text-grafito-500"
              title="Sale resaltado, como dato que todavía no se midió."
            >
              <input
                type="checkbox"
                checked={Boolean(fila.pendiente)}
                onChange={(event) => cambiar(i, { pendiente: event.target.checked })}
              />
              Pendiente
            </label>
          )}
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => mover(i, -1)}
              className="rounded px-1.5 text-grafito-400 hover:bg-grafito-100"
              aria-label="Subir"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => mover(i, 1)}
              className="rounded px-1.5 text-grafito-400 hover:bg-grafito-100"
              aria-label="Bajar"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onChange(filas.filter((_, j) => j !== i))}
              className="rounded px-1.5 text-tapita-600 hover:bg-tapita-50"
              aria-label="Quitar"
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...filas, { clave: '', valor: '' }])}
        className="text-xs font-semibold text-celeste-800 hover:underline"
      >
        + Agregar fila
      </button>
    </div>
  )
}

/**
 * Una imagen: del manual de marca, subida desde la compu, o ninguna. El
 * dibujo con medidas tiene además la opción de armarse solo (`generado`).
 */
function CampoImagen({ value, onChange, generado }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const url = urlDeImagen(value)
  const esGenerado = value === DIBUJO_GENERADO
  const subida = value && !esGenerado && !value.startsWith('marca:')

  const subir = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSubiendo(true)
    setError('')
    try {
      onChange(await uploadPhoto(file, 'productos'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded border border-grafito-200 bg-grafito-50">
        {esGenerado ? (
          <DibujoDimensiones {...generado} />
        ) : url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-grafito-400">Sin imagen</span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <Select
          value={subida ? 'subida' : (value ?? '')}
          onChange={(event) => {
            if (event.target.value !== 'subida') onChange(event.target.value || null)
          }}
        >
          <option value="">Sin imagen</option>
          {generado && <option value={DIBUJO_GENERADO}>Dibujado con las medidas de abajo</option>}
          {Object.entries(IMAGENES_MARCA).map(([clave, imagen]) => (
            <option key={clave} value={`marca:${clave}`}>
              {imagen.nombre}
            </option>
          ))}
          {subida && <option value="subida">Foto subida</option>}
        </Select>
        <label className="inline-block cursor-pointer text-xs font-semibold text-celeste-800 hover:underline">
          {subiendo ? 'Subiendo…' : 'Subir una foto'}
          <input type="file" accept="image/*" className="hidden" onChange={subir} disabled={subiendo} />
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </div>
  )
}

/** Saca renglones vacíos de las listas y filas vacías de las tablas. */
function limpiar(contenido) {
  return Object.fromEntries(
    Object.entries(contenido).map(([clave, valor]) => {
      if (!Array.isArray(valor)) return [clave, typeof valor === 'string' ? valor.trim() : valor]
      return [
        clave,
        valor
          .map((item) =>
            typeof item === 'string'
              ? item.trim()
              : { ...item, clave: item.clave?.trim() ?? '', valor: item.valor?.trim() ?? '' },
          )
          .filter((item) => (typeof item === 'string' ? item : item.clave || item.valor)),
      ]
    }),
  )
}

export default function DocEditor({ doc, producto, onClose, onSaved }) {
  const [form, setForm] = useState(() => contenidoDe(producto))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (clave) => (valor) => setForm((prev) => ({ ...prev, [clave]: valor }))

  const guardar = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateProduct(producto.id, { documentos: limpiar(form) })
      onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`${doc.titulo} · ${producto.nombre}`} onClose={onClose} wide>
      <form onSubmit={guardar} className="space-y-5">
        {CAMPOS[doc.tipo].map((campo) => {
          const valor = form[campo.clave]
          const onChange = set(campo.clave)

          /* `Field` es un `<label>`, y una tabla o una foto tienen varios
             controles adentro: un click en cualquier lado activaría el
             primero, que en la foto es el selector de archivos. */
          if (campo.tipo === 'pares' || campo.tipo === 'imagen') {
            return (
              <div key={campo.clave}>
                <span className="block text-xs font-semibold text-grafito-700">{campo.label}</span>
                <div className="mt-1">
                  {campo.tipo === 'pares' ? (
                    <CampoPares value={valor} onChange={onChange} conPendiente={campo.pendiente} />
                  ) : (
                    <CampoImagen
                      value={valor}
                      onChange={onChange}
                      generado={
                        campo.clave === 'dibujo'
                          ? {
                              largo: form.medida_largo,
                              ancho: form.medida_ancho,
                              alto: form.medida_alto,
                              perforada: producto.se_agujerea !== false,
                            }
                          : null
                      }
                    />
                  )}
                </div>
                {campo.hint && <span className="mt-1 block text-xs text-grafito-400">{campo.hint}</span>}
              </div>
            )
          }

          return (
            <Field key={campo.clave} label={campo.label} hint={campo.hint}>
              {campo.tipo === 'texto' && (
                <Input value={valor ?? ''} onChange={(event) => onChange(event.target.value)} />
              )}
              {campo.tipo === 'parrafo' && (
                <Textarea rows={2} value={valor ?? ''} onChange={(event) => onChange(event.target.value)} />
              )}
              {campo.tipo === 'lista' && <CampoLista value={valor} onChange={onChange} />}
            </Field>
          )
        })}

        <ErrorNote>{error}</ErrorNote>

        <p className="rounded-md bg-grafito-50 px-3 py-2 text-xs leading-relaxed text-grafito-500">
          Lo que quede vacío no sale impreso. Los datos que se repiten entre
          documentos —el dibujo, por ejemplo— se cambian en todos a la vez.
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
