/**
 * Las fotos con las que el producto sale en la web.
 *
 * Se suben al bucket `productos` y se guardan en orden: la primera es la que
 * se ve en la tarjeta, las demás se pasan con las flechas. Achicadas antes de
 * subir (lo hace `uploadPhoto`), así una foto de celular no pesa cinco megas
 * en la página.
 */
import { useState } from 'react'
import { uploadPhoto } from '../api/social'
import { ErrorNote } from './ui'

export default function FotosWeb({ value, onChange }) {
  const fotos = value ?? []
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  const subir = async (event) => {
    const archivos = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!archivos.length) return
    setSubiendo(true)
    setError('')
    try {
      const nuevas = []
      for (const archivo of archivos) nuevas.push(await uploadPhoto(archivo, 'productos'))
      onChange([...fotos, ...nuevas])
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  const mover = (i, delta) => {
    const destino = i + delta
    if (destino < 0 || destino >= fotos.length) return
    const copia = [...fotos]
    ;[copia[i], copia[destino]] = [copia[destino], copia[i]]
    onChange(copia)
  }

  return (
    <div>
      <span className="block text-xs font-semibold text-grafito-700">Fotos para la web</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {fotos.map((url, i) => (
          <div
            key={url}
            className="relative h-24 w-20 overflow-hidden rounded border border-grafito-200 bg-grafito-50"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-grafito-900/80 px-1 text-[10px] font-semibold text-white">
                Portada
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-white/85 text-xs">
              <button type="button" onClick={() => mover(i, -1)} className="px-1.5" aria-label="Antes">
                ←
              </button>
              <button
                type="button"
                onClick={() => onChange(fotos.filter((_, j) => j !== i))}
                className="px-1.5 text-tapita-600"
                aria-label="Quitar"
              >
                ×
              </button>
              <button type="button" onClick={() => mover(i, 1)} className="px-1.5" aria-label="Después">
                →
              </button>
            </div>
          </div>
        ))}
        <label className="flex h-24 w-20 cursor-pointer items-center justify-center rounded border border-dashed border-grafito-300 text-center text-xs font-semibold text-celeste-800 hover:bg-grafito-50">
          {subiendo ? 'Subiendo…' : '+ Subir'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={subir}
            disabled={subiendo}
          />
        </label>
      </div>
      <span className="mt-1 block text-xs text-grafito-400">
        La primera es la portada de la tarjeta. Verticales quedan mejor: la
        tarjeta las muestra altas y angostas.
      </span>
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  )
}
