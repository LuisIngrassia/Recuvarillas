/**
 * Redes: el calendario de Instagram.
 *
 * Tres preguntas, en el orden en que se hacen: qué hay que subir hoy (y qué
 * quedó sin subir), cómo viene el mes, y qué se podría postear. Las piezas se
 * arman solas con las plantillas del manual; lo que queda a mano es elegir
 * qué contar y subirlo.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPost, listPosts, loadSocialFacts } from '../api/social'
import { loadPriceTiers } from '../../lib/priceTiers'
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader } from '../components/ui'
import { currentMonth, formatMonth, monthRange, todayISO } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { ESTADOS, FONDOS, PLANTILLAS, PLANTILLA_KEYS, fechaLarga, postNuevo } from '../redes/plantillas'
import { armarIdeas } from '../redes/ideas'
import { descargar, zipDePosts } from '../redes/exportar'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function sumarMes(mes, delta) {
  const [anio, numero] = mes.split('-').map(Number)
  const fecha = new Date(anio, numero - 1 + delta, 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

function iso(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

/** Las semanas del mes, de lunes a domingo, con los días de los meses vecinos en null. */
function semanasDe(mes) {
  const [anio, numero] = mes.split('-').map(Number)
  const primero = new Date(anio, numero - 1, 1)
  const dias = new Date(anio, numero, 0).getDate()
  const blancos = (primero.getDay() + 6) % 7
  const celdas = [
    ...Array(blancos).fill(null),
    ...Array.from({ length: dias }, (_, i) => iso(new Date(anio, numero - 1, i + 1))),
  ]
  while (celdas.length % 7) celdas.push(null)
  return Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7))
}

/**
 * Qué dice el manual del ritmo del feed: alternar fondos blancos, fotos y un
 * posteo oscuro cada tanto. Sólo cuentan los que van al feed; las historias
 * se van a las 24 horas y no hacen grilla.
 */
function revisarRitmo(posts) {
  const feed = posts.filter((post) => post.formatos.includes('cuadrado'))
  const avisos = []

  for (let i = 1; i < feed.length; i += 1) {
    const antes = PLANTILLAS[feed[i - 1].plantilla].fondo
    const ahora = PLANTILLAS[feed[i].plantilla].fondo
    if (antes === ahora) {
      avisos.push(
        `${fechaLarga(feed[i - 1].fecha)} y ${fechaLarga(feed[i].fecha)}: dos fondos ${FONDOS[ahora].nombre.toLowerCase()} seguidos.`,
      )
    }
  }

  if (feed.length >= 6 && !feed.some((post) => PLANTILLAS[post.plantilla].fondo === 'oscuro')) {
    avisos.push('Ningún posteo oscuro en el mes: el manual pide uno cada tanto (Educación).')
  }

  return avisos
}

function Chip({ post }) {
  const plantilla = PLANTILLAS[post.plantilla]
  const estado = ESTADOS[post.estado]
  const formatos = post.formatos.map((f) => (f === 'cuadrado' ? 'F' : 'H')).join('+')

  return (
    <Link
      to={`/erp/redes/${post.id}`}
      title={`${plantilla.nombre} · ${estado.label}`}
      className={`flex items-center gap-1.5 rounded border px-1.5 py-1 text-xs font-medium hover:border-celeste-600 ${
        post.estado === 'publicado'
          ? 'border-celeste-200 bg-celeste-50 text-celeste-800'
          : post.estado === 'listo'
            ? 'border-celeste-100 bg-celeste-50 text-celeste-700'
            : 'border-grafito-200 bg-white text-grafito-600'
      }`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-sm border border-grafito-300"
        style={{ background: FONDOS[plantilla.fondo].muestra }}
      />
      <span className="truncate">{plantilla.nombre}</span>
      <span className="ml-auto shrink-0 text-[10px] text-grafito-400">{formatos}</span>
    </Link>
  )
}

/** El formulario de alta: el día y, si no viene de una idea, la plantilla. */
function NuevoPost({ inicial, onClose }) {
  const navigate = useNavigate()
  const [fecha, setFecha] = useState(inicial.fecha)
  const [plantilla, setPlantilla] = useState(inicial.idea?.post.plantilla ?? 'producto')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function crear(event) {
    event.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const values = inicial.idea
        ? { ...inicial.idea.post, fecha, estado: 'borrador' }
        : postNuevo(plantilla, fecha)
      const creado = await createPost(values)
      navigate(`/erp/redes/${creado.id}`)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal title={inicial.idea ? `Agendar: ${inicial.idea.titulo}` : 'Nuevo posteo'} onClose={onClose}>
      <form onSubmit={crear} className="space-y-4">
        <Field label="Día">
          <Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>

        {!inicial.idea && (
          <div>
            <p className="text-xs font-semibold text-grafito-600">Plantilla</p>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {PLANTILLA_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlantilla(key)}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    plantilla === key
                      ? 'border-celeste-600 bg-celeste-50'
                      : 'border-grafito-200 hover:border-grafito-300'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-grafito-800">
                    <span
                      className="h-3 w-3 rounded-sm border border-grafito-300"
                      style={{ background: FONDOS[PLANTILLAS[key].fondo].muestra }}
                    />
                    {PLANTILLAS[key].nombre}
                  </span>
                  <span className="mt-0.5 block text-xs text-grafito-500">{PLANTILLAS[key].para}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear y editar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Ideas({ posts, onUsar }) {
  const datos = useAsync(
    () =>
      Promise.all([
        loadSocialFacts().catch(() => null),
        loadPriceTiers().catch(() => null),
      ]),
    [],
  )
  const [verUsadas, setVerUsadas] = useState(false)

  const [hechos, tramos] = datos.data ?? []
  const ideas = useMemo(() => armarIdeas({ posts, hechos, tramos }), [posts, hechos, tramos])
  const visibles = ideas.filter((idea) => verUsadas || !idea.usada)
  const grupos = [...new Set(visibles.map((idea) => idea.grupo))]
  const usadas = ideas.filter((idea) => idea.usada).length

  return (
    <Card
      title="Qué postear"
      actions={
        usadas > 0 && (
          <button
            type="button"
            onClick={() => setVerUsadas((v) => !v)}
            className="text-xs font-semibold text-grafito-500 hover:text-grafito-700"
          >
            {verUsadas ? 'Ocultar las usadas' : `Ver las usadas (${usadas})`}
          </button>
        )
      }
    >
      <div className="divide-y divide-grafito-100">
        {grupos.map((grupo) => (
          <div key={grupo} className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-grafito-400">{grupo}</p>
            <ul className="mt-2 space-y-2">
              {visibles
                .filter((idea) => idea.grupo === grupo)
                .map((idea) => (
                  <li key={idea.origen} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${idea.usada ? 'text-grafito-400' : 'text-grafito-800'}`}>
                        {idea.titulo}
                        {idea.usada && <span className="ml-1.5 text-xs font-normal">· ya agendada</span>}
                      </p>
                      <p className="text-xs text-grafito-500">
                        {PLANTILLAS[idea.post.plantilla].nombre}
                        {idea.nota && ` · ${idea.nota}`}
                      </p>
                    </div>
                    <Button variant="soft" className="shrink-0 !px-2 !py-1 text-xs" onClick={() => onUsar(idea)}>
                      Agendar
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        {grupos.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-grafito-400">
            Ya están agendadas todas. Cargá reseñas nuevas en la web o armá uno de cero.
          </p>
        )}
      </div>
    </Card>
  )
}

export default function Social() {
  const [mes, setMes] = useState(currentMonth)
  const [nuevo, setNuevo] = useState(null)
  const [zip, setZip] = useState(null)
  const hoy = todayISO()

  const { desde, hasta } = monthRange(mes)
  const delMes = useAsync(() => listPosts({ desde, hasta }), [mes])
  // Todos, para saber qué ideas ya se usaron y qué quedó atrasado. Son pocas
  // filas: un posteo por día son 365 al año.
  const todos = useAsync(() => listPosts(), [])

  const porDia = useMemo(() => {
    const mapa = new Map()
    for (const post of delMes.data ?? []) {
      mapa.set(post.fecha, [...(mapa.get(post.fecha) ?? []), post])
    }
    return mapa
  }, [delMes.data])

  const pendientes = (todos.data ?? []).filter(
    (post) => post.fecha <= hoy && post.estado !== 'publicado',
  )
  const ritmo = revisarRitmo(delMes.data ?? [])
  const faltan = (delMes.data ?? []).filter((post) => post.estado !== 'publicado')

  /**
   * Dos días después del último agendado, o hoy. Un posteo día por medio es un
   * ritmo que se sostiene sin que nadie viva para Instagram.
   */
  function proximoLibre() {
    const ultimos = (todos.data ?? []).map((post) => post.fecha).filter((f) => f >= hoy).sort()
    if (!ultimos.length) return hoy
    const [anio, m, d] = ultimos.at(-1).split('-').map(Number)
    return iso(new Date(anio, m - 1, d + 2))
  }

  async function bajarMes() {
    setZip({ hechos: 0, total: 1 })
    try {
      const blob = await zipDePosts(faltan, (hechos, total) => setZip({ hechos, total }))
      descargar(blob, `recuvarilla-redes-${mes}.zip`)
      setZip(null)
    } catch (err) {
      setZip({ error: err.message })
    }
  }

  return (
    <>
      <PageHeader
        title="Redes"
        description="El calendario de Instagram. Las piezas salen solas con las plantillas del manual; se revisan, se bajan y se suben."
        actions={
          <Button onClick={() => setNuevo({ fecha: proximoLibre() })}>Nuevo posteo</Button>
        }
      />

      {pendientes.length > 0 && (
        <Card title="Para subir" className="mb-6">
          <ul className="divide-y divide-grafito-100">
            {pendientes.map((post) => (
              <li key={post.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-grafito-800">
                    {PLANTILLAS[post.plantilla].nombre}
                    {post.campos?.titular && (
                      <span className="font-normal text-grafito-500"> · {post.campos.titular}</span>
                    )}
                  </p>
                  <p className={`text-xs ${post.fecha < hoy ? 'text-amber-700' : 'text-grafito-500'}`}>
                    {post.fecha === hoy ? 'Hoy' : `Atrasado: era para el ${fechaLarga(post.fecha)}`}
                    {' · '}
                    {post.formatos.map((f) => (f === 'cuadrado' ? 'feed' : 'historia')).join(' y ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={ESTADOS[post.estado].tone}>{ESTADOS[post.estado].label}</Badge>
                  <Link
                    to={`/erp/redes/${post.id}`}
                    className="rounded-md bg-grafito-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-grafito-700"
                  >
                    Abrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <Card
            title={<span className="capitalize">{formatMonth(mes)}</span>}
            actions={
              <div className="flex items-center gap-1">
                <Button variant="ghost" className="!px-2 !py-1" onClick={() => setMes((m) => sumarMes(m, -1))} aria-label="Mes anterior">
                  ‹
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setMes(currentMonth())}>
                  Hoy
                </Button>
                <Button variant="ghost" className="!px-2 !py-1" onClick={() => setMes((m) => sumarMes(m, 1))} aria-label="Mes siguiente">
                  ›
                </Button>
              </div>
            }
          >
            {delMes.error && (
              <div className="p-4">
                <ErrorNote onRetry={delMes.reload}>{delMes.error}</ErrorNote>
              </div>
            )}

            {/* La grilla del mes, desde tablet. En el teléfono no entran siete columnas. */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-7 border-b border-grafito-100 bg-grafito-50 text-center text-xs font-semibold uppercase tracking-wide text-grafito-500">
                {DIAS.map((dia) => (
                  <div key={dia} className="py-2">
                    {dia}
                  </div>
                ))}
              </div>
              {semanasDe(mes).map((semana, i) => (
                <div key={i} className="grid grid-cols-7 border-b border-grafito-100 last:border-b-0">
                  {semana.map((dia, j) => (
                    <div
                      key={dia ?? `v${j}`}
                      className={`group min-h-24 border-r border-grafito-100 p-1.5 last:border-r-0 ${
                        dia ? '' : 'bg-grafito-50/60'
                      }`}
                    >
                      {dia && (
                        <>
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-semibold ${
                                dia === hoy
                                  ? 'rounded-full bg-grafito-900 px-1.5 text-white'
                                  : 'text-grafito-400'
                              }`}
                            >
                              {Number(dia.slice(8))}
                            </span>
                            <button
                              type="button"
                              onClick={() => setNuevo({ fecha: dia })}
                              className="rounded px-1 text-sm leading-none text-grafito-300 opacity-0 hover:bg-grafito-100 hover:text-grafito-600 focus:opacity-100 group-hover:opacity-100"
                              aria-label={`Nuevo posteo el ${fechaLarga(dia)}`}
                            >
                              +
                            </button>
                          </div>
                          <div className="mt-1 space-y-1">
                            {(porDia.get(dia) ?? []).map((post) => (
                              <Chip key={post.id} post={post} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* En el teléfono, la lista del mes. */}
            <ul className="divide-y divide-grafito-100 sm:hidden">
              {(delMes.data ?? []).map((post) => (
                <li key={post.id} className="px-4 py-2.5">
                  <p className="mb-1 text-xs font-semibold capitalize text-grafito-500">{fechaLarga(post.fecha)}</p>
                  <Chip post={post} />
                </li>
              ))}
              {delMes.data?.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-grafito-400">Nada agendado este mes.</li>
              )}
            </ul>
          </Card>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-grafito-500">
              {Object.entries(FONDOS).map(([key, fondo]) => (
                <span key={key} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm border border-grafito-300" style={{ background: fondo.muestra }} />
                  {fondo.nombre}
                </span>
              ))}
              <span>· F feed · H historia</span>
            </div>

            <div className="flex items-center gap-2">
              {zip?.total && !zip.error && (
                <span className="text-xs text-grafito-500">
                  Armando {zip.hechos} de {zip.total}…
                </span>
              )}
              <Button variant="ghost" disabled={!faltan.length || Boolean(zip?.total)} onClick={bajarMes}>
                Descargar lo que falta subir ({faltan.length})
              </Button>
            </div>
          </div>
          {zip?.error && (
            <div className="mt-2">
              <ErrorNote>{zip.error}</ErrorNote>
            </div>
          )}

          {ritmo.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Ritmo del feed</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                {ritmo.map((aviso) => (
                  <li key={aviso} className="first-letter:uppercase">
                    {aviso}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Ideas posts={todos.data ?? []} onUsar={(idea) => setNuevo({ fecha: proximoLibre(), idea })} />
      </div>

      {nuevo && <NuevoPost inicial={nuevo} onClose={() => setNuevo(null)} />}
    </>
  )
}
