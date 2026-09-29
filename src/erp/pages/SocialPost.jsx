/**
 * Un posteo: se completa, se mira cómo queda y se baja listo para subir.
 *
 * A la izquierda lo que se escribe; a la derecha las piezas tal cual van a
 * salir, en feed y en historia, con los avisos del manual abajo. Se guarda
 * solo mientras se escribe: es un formulario que se toca de a poco, muchas
 * veces, y un botón de guardar es la forma más fácil de perder un texto.
 *
 * Subir a Instagram es a mano. Desde la compu se bajan los PNG; desde el
 * teléfono el botón de compartir abre Instagram con la imagen puesta y el
 * texto ya copiado para pegar.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { deletePost, getPost, updatePost, uploadPhoto } from '../api/social'
import {
  Async,
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui'
import { formatDateTime } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useDebounced } from '../lib/useDebounced'
import { FOTOS_MARCA } from '../redes/assets'
import {
  ESTADOS,
  FONDOS,
  FORMATOS,
  PLANTILLAS,
  PLANTILLA_KEYS,
  fechaLarga,
} from '../redes/plantillas'
import { contarHashtags, revisarMedidas, revisarPost, textoParaPegar } from '../redes/marca'
import { compartir, descargar, nombreArchivo, puedeCompartir, renderizarPng } from '../redes/exportar'
import Vista from '../redes/Vista'

/** Lo que se guarda solo. El estado va aparte: ése se cambia a propósito, con un botón. */
const editable = (post) =>
  JSON.stringify({
    fecha: post.fecha,
    plantilla: post.plantilla,
    formatos: post.formatos,
    campos: post.campos,
    caption: post.caption,
    hashtags: post.hashtags,
    notas: post.notas ?? null,
  })

/** El ancho de una caja, para que las dos vistas previas entren lado a lado. */
function useAncho(ref) {
  const [ancho, setAncho] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setAncho(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return ancho
}

function FotoPicker({ campos, onChange }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const subida = /^https?:\/\//.test(campos.foto ?? '') ? campos.foto : null
  const foco = campos.foco ?? { x: 50, y: 50 }

  async function subir(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSubiendo(true)
    setError(null)
    try {
      const url = await uploadPhoto(file)
      onChange({ foto: url, foco: { x: 50, y: 50 } })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  const miniatura = (activa) =>
    `h-16 w-16 rounded-md object-cover ring-offset-1 ${activa ? 'ring-2 ring-secondary-500' : 'opacity-80 hover:opacity-100'}`

  return (
    <div>
      <span className="block text-xs font-semibold text-steel-600">Foto</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {FOTOS_MARCA.map((foto) => (
          <button
            key={foto.archivo}
            type="button"
            title={foto.archivo}
            onClick={() => onChange({ foto: foto.archivo, foco: { x: 50, y: 50 } })}
          >
            <img src={foto.url} alt={foto.archivo} className={miniatura(campos.foto === foto.archivo)} />
          </button>
        ))}
        {subida && (
          <img src={subida} alt="Foto subida" className={miniatura(true)} />
        )}
        <label
          className={`flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-steel-300 text-center text-[11px] font-semibold leading-tight text-steel-500 hover:border-secondary-500 hover:text-secondary-600 ${
            subiendo ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <span className="text-lg leading-none">+</span>
          {subiendo ? 'Subiendo…' : 'Subir'}
          <input type="file" accept="image/*" className="sr-only" onChange={subir} />
        </label>
      </div>
      <p className="mt-1 text-xs text-steel-400">
        Las del manual, o una propia. Desde el teléfono, "Subir" deja sacarla en el momento.
      </p>
      <ErrorNote>{error}</ErrorNote>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={`Encuadre horizontal · ${foco.x}%`}>
          <input
            type="range"
            min="0"
            max="100"
            value={foco.x}
            onChange={(e) => onChange({ foco: { ...foco, x: Number(e.target.value) } })}
            className="w-full accent-secondary-500"
          />
        </Field>
        <Field label={`Encuadre vertical · ${foco.y}%`}>
          <input
            type="range"
            min="0"
            max="100"
            value={foco.y}
            onChange={(e) => onChange({ foco: { ...foco, y: Number(e.target.value) } })}
            className="w-full accent-secondary-500"
          />
        </Field>
      </div>
    </div>
  )
}

function Campo({ def, campos, onChange }) {
  const valor = campos[def.key]

  if (def.tipo === 'foto') return <FotoPicker campos={campos} onChange={onChange} />

  if (def.tipo === 'paso') {
    const total = Number(campos.total) || 6
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paso">
          <Select value={campos.paso ?? 1} onChange={(e) => onChange({ paso: Number(e.target.value) })}>
            {Array.from({ length: total }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="De cuántos">
          <Input
            type="number"
            min="2"
            max="12"
            value={total}
            onChange={(e) => onChange({ total: Math.min(12, Math.max(2, Number(e.target.value) || 2)) })}
          />
        </Field>
      </div>
    )
  }

  if (def.tipo === 'lista') {
    return (
      <Field label={def.label} hint={def.hint}>
        <Textarea
          rows={4}
          value={(valor ?? []).join('\n')}
          onChange={(e) => onChange({ [def.key]: e.target.value.split('\n') })}
        />
      </Field>
    )
  }

  if (def.tipo === 'parrafo') {
    return (
      <Field label={def.label} hint={def.hint}>
        <Textarea rows={3} value={valor ?? ''} onChange={(e) => onChange({ [def.key]: e.target.value })} />
      </Field>
    )
  }

  return (
    <Field label={def.label} hint={def.hint}>
      <Input value={valor ?? ''} onChange={(e) => onChange({ [def.key]: e.target.value })} />
    </Field>
  )
}

function Avisos({ avisos }) {
  if (!avisos.length) {
    return (
      <p className="rounded-md bg-secondary-50 px-3 py-2 text-sm text-secondary-700">
        Cumple con el manual. Mirá la foto y la primera línea, que eso no lo revisa nadie más que vos.
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {avisos.map((aviso) => (
        <li
          key={aviso.texto}
          className={`rounded-md px-3 py-2 text-sm ${
            aviso.nivel === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {aviso.texto}
        </li>
      ))}
    </ul>
  )
}

/**
 * Bajar, compartir y copiar.
 *
 * En el teléfono las imágenes se preparan antes, con un botón aparte: el
 * navegador sólo deja abrir el menú de compartir en el mismo toque, y armar
 * una pieza tarda más que eso. Preparadas, compartir es instantáneo.
 */
function Exportar({ post, onPublicado }) {
  const firma = editable(post)
  const [imagenes, setImagenes] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const movil = puedeCompartir()
  const texto = post.formatos.includes('cuadrado') ? textoParaPegar(post) : ''
  const listas = imagenes?.firma === firma ? imagenes.blobs : null

  async function preparar() {
    setOcupado('preparar')
    setError(null)
    try {
      const blobs = {}
      for (const formato of post.formatos) blobs[formato] = await renderizarPng(post, formato)
      setImagenes({ firma, blobs })
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(null)
    }
  }

  async function bajar(formato) {
    setOcupado(formato)
    setError(null)
    try {
      const blob = listas?.[formato] ?? (await renderizarPng(post, formato))
      descargar(blob, nombreArchivo(post, formato))
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(null)
    }
  }

  function mandar(formato) {
    setError(null)
    compartir(listas[formato], nombreArchivo(post, formato), texto).catch((err) =>
      setError(err.message),
    )
    if (texto) setCopiado(true)
  }

  async function copiar() {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <Card title="Bajar y subir">
      <div className="space-y-3 px-4 py-4">
        {movil && (
          <div className="space-y-2">
            {!listas ? (
              <Button className="w-full" disabled={ocupado === 'preparar'} onClick={preparar}>
                {ocupado === 'preparar' ? 'Preparando…' : 'Preparar para Instagram'}
              </Button>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {post.formatos.map((formato) => (
                  <Button key={formato} onClick={() => mandar(formato)}>
                    Compartir {FORMATOS[formato].nombre.toLowerCase()}
                  </Button>
                ))}
              </div>
            )}
            {listas && texto && (
              <p className="text-xs text-steel-500">
                Al compartir, el texto queda copiado: en Instagram, mantené apretado el
                campo del texto y pegalo.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {post.formatos.map((formato) => (
            <Button
              key={formato}
              variant={movil ? 'ghost' : 'primary'}
              disabled={Boolean(ocupado)}
              onClick={() => bajar(formato)}
            >
              {ocupado === formato ? 'Armando…' : `Descargar ${FORMATOS[formato].nombre.toLowerCase()}`}
            </Button>
          ))}
          {texto && (
            <Button variant="ghost" onClick={copiar}>
              {copiado ? 'Texto copiado' : 'Copiar texto'}
            </Button>
          )}
        </div>
        <p className="text-xs text-steel-400">
          PNG de {post.formatos.map((f) => FORMATOS[f].medida).join(' y ')}, como pide Instagram.
        </p>

        <ErrorNote>{error}</ErrorNote>

        {post.estado !== 'publicado' && (
          <div className="border-t border-steel-100 pt-3">
            <Button variant="soft" onClick={onPublicado}>
              Ya lo subí: marcar como publicado
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function Editor({ inicial }) {
  const navigate = useNavigate()
  const [post, setPost] = useState(inicial)
  const [guardado, setGuardado] = useState(() => editable(inicial))
  const [errorGuardado, setErrorGuardado] = useState(null)
  const [medidas, setMedidas] = useState({})
  const vistasRef = useRef(null)
  const anchoVistas = useAncho(vistasRef)

  const actual = editable(post)
  const asentado = useDebounced(actual, 700)

  useEffect(() => {
    if (asentado === guardado) return
    let vigente = true
    updatePost(post.id, JSON.parse(asentado))
      .then(() => {
        if (!vigente) return
        setGuardado(asentado)
        setErrorGuardado(null)
      })
      .catch((err) => vigente && setErrorGuardado(err.message))
    return () => {
      vigente = false
    }
    // Sólo cuando el texto se asienta; `guardado` cambia por esta misma respuesta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asentado, post.id])

  /*
    Si se sale de la pantalla antes de que el último cambio se asiente, se
    guarda igual. Sin esto, escribir y tocar "volver" enseguida perdería las
    últimas letras.
  */
  const pendienteRef = useRef(null)
  pendienteRef.current = actual !== guardado ? actual : null
  useEffect(
    () => () => {
      if (pendienteRef.current) updatePost(inicial.id, JSON.parse(pendienteRef.current)).catch(() => {})
    },
    [inicial.id],
  )

  const set = (changes) => setPost((prev) => ({ ...prev, ...changes }))
  const setCampos = (changes) => setPost((prev) => ({ ...prev, campos: { ...prev.campos, ...changes } }))

  function cambiarPlantilla(key) {
    const nueva = PLANTILLAS[key]
    setPost((prev) => {
      // Lo que ya estaba escrito pasa a la plantilla nueva si ésta lo usa.
      const campos = structuredClone(nueva.inicial)
      for (const k of ['titular', 'bajada', 'foto', 'foco', 'origen']) {
        if (prev.campos[k] !== undefined && (k in nueva.inicial || k === 'origen')) campos[k] = prev.campos[k]
      }
      return { ...prev, plantilla: key, campos }
    })
    setMedidas({})
  }

  function alternarFormato(formato) {
    const tiene = post.formatos.includes(formato)
    if (tiene && post.formatos.length === 1) return
    const formatos = tiene
      ? post.formatos.filter((f) => f !== formato)
      : ['cuadrado', 'historia'].filter((f) => f === formato || post.formatos.includes(f))
    set({ formatos })
    setMedidas((prev) => ({ ...prev, [formato]: undefined }))
  }

  async function cambiarEstado(estado) {
    try {
      const actualizado = await updatePost(post.id, { estado })
      setPost((prev) => ({ ...prev, estado: actualizado.estado, publicado_at: actualizado.publicado_at }))
    } catch (err) {
      setErrorGuardado(err.message)
    }
  }

  async function borrar() {
    if (!window.confirm('¿Borrar este posteo? No se puede deshacer.')) return
    pendienteRef.current = null
    await deletePost(post.id)
    navigate('/erp/redes')
  }

  const plantilla = PLANTILLAS[post.plantilla]
  const avisos = [
    ...revisarMedidas(Object.fromEntries(post.formatos.map((f) => [f, medidas[f]]))),
    ...revisarPost(post),
  ]
  const primera = post.caption.trim().split('\n')[0] ?? ''
  // Las dos vistas lado a lado; en pantallas angostas, cada una a la mitad.
  const anchoVista = Math.max(120, Math.min(260, Math.floor((anchoVistas - 16) / post.formatos.length)))

  const estadoGuardado = errorGuardado
    ? { tone: 'bad', texto: 'No se guardó' }
    : actual !== guardado
      ? { tone: 'neutral', texto: 'Guardando…' }
      : { tone: 'good', texto: 'Guardado' }

  return (
    <>
      <PageHeader
        title={<span className="first-letter:uppercase">{fechaLarga(post.fecha)}</span>}
        description={`${plantilla.nombre} · ${post.formatos.map((f) => FORMATOS[f].nombre.toLowerCase()).join(' y ')}`}
        actions={
          <>
            <Link
              to="/erp/redes"
              className="rounded-md border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-600 hover:border-steel-300"
            >
              Volver al calendario
            </Link>
            <Button variant="danger" onClick={borrar}>
              Borrar
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {Object.entries(ESTADOS).map(([key, estado]) => (
          <button
            key={key}
            type="button"
            onClick={() => cambiarEstado(key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              post.estado === key
                ? 'border-secondary-500 bg-secondary-500 text-white'
                : 'border-steel-200 bg-white text-steel-600 hover:border-steel-300'
            }`}
          >
            {estado.label}
          </button>
        ))}
        {post.publicado_at && (
          <span className="text-xs text-steel-500">Subido el {formatDateTime(post.publicado_at)}</span>
        )}
        <span className="ml-auto">
          <Badge tone={estadoGuardado.tone}>{estadoGuardado.texto}</Badge>
        </span>
      </div>
      <ErrorNote>{errorGuardado}</ErrorNote>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
        {/* En el teléfono, las piezas primero: es lo que se viene a mirar. */}
        <div className="order-2 space-y-6 xl:order-1">
          <Card title="La pieza">
            <div className="space-y-4 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Día">
                  <Input type="date" required value={post.fecha} onChange={(e) => e.target.value && set({ fecha: e.target.value })} />
                </Field>
                <Field label="Plantilla" hint={plantilla.para}>
                  <Select value={post.plantilla} onChange={(e) => cambiarPlantilla(e.target.value)}>
                    {PLANTILLA_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {PLANTILLAS[key].nombre} · fondo {FONDOS[PLANTILLAS[key].fondo].nombre.toLowerCase()}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div>
                <span className="block text-xs font-semibold text-steel-600">Sale en</span>
                <div className="mt-1 flex gap-4">
                  {Object.entries(FORMATOS).map(([key, formato]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-steel-700">
                      <input
                        type="checkbox"
                        checked={post.formatos.includes(key)}
                        onChange={() => alternarFormato(key)}
                        className="accent-secondary-500"
                      />
                      {formato.nombre} <span className="text-xs text-steel-400">{formato.medida}</span>
                    </label>
                  ))}
                </div>
              </div>

              {plantilla.campos.map((def) => (
                <Campo key={def.key} def={def} campos={post.campos} onChange={setCampos} />
              ))}
            </div>
          </Card>

          {post.formatos.includes('cuadrado') && (
            <Card title="El texto del posteo">
              <div className="space-y-4 px-4 py-4">
                <Field
                  label="Texto"
                  hint={`La primera línea tiene que funcionar sola (${primera.length}/125). Un número y una acción: escribinos por WhatsApp.`}
                >
                  <Textarea rows={7} value={post.caption} onChange={(e) => set({ caption: e.target.value })} />
                </Field>
                <Field label="Hashtags" hint={`Tres o cuatro, al final. Van ${contarHashtags(post.hashtags)}.`}>
                  <Input value={post.hashtags} onChange={(e) => set({ hashtags: e.target.value })} />
                </Field>
              </div>
            </Card>
          )}

          <Card title="Notas">
            <div className="px-4 py-4">
              <Textarea
                rows={2}
                placeholder="Para el equipo: de dónde salió la foto, qué falta confirmar…"
                value={post.notas ?? ''}
                onChange={(e) => set({ notas: e.target.value || null })}
              />
            </div>
          </Card>
        </div>

        <div className="order-1 space-y-4 xl:order-2">
          <div className="xl:sticky xl:top-6 xl:space-y-4">
            <div ref={vistasRef} className="flex flex-wrap items-start gap-4">
              {anchoVistas > 0 &&
                post.formatos.map((formato) => (
                  <figure key={formato}>
                    <Vista
                      post={post}
                      formato={formato}
                      ancho={anchoVista}
                      onMedida={(medida) =>
                        setMedidas((prev) =>
                          JSON.stringify(prev[formato]) === JSON.stringify(medida)
                            ? prev
                            : { ...prev, [formato]: medida },
                        )
                      }
                    />
                    <figcaption className="mt-1 text-xs text-steel-500">
                      {FORMATOS[formato].nombre} · {FORMATOS[formato].medida}
                    </figcaption>
                  </figure>
                ))}
            </div>

            <div className="mt-4 xl:mt-0">
              <Avisos avisos={avisos} />
            </div>

            <div className="mt-4 xl:mt-0">
              <Exportar post={post} onPublicado={() => cambiarEstado('publicado')} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function SocialPost() {
  const { id } = useParams()
  const query = useAsync(() => getPost(id), [id])

  return <Async query={query}>{(post) => <Editor key={post.id} inicial={post} />}</Async>
}
