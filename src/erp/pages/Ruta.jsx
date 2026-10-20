/**
 * Quién queda en el camino de un viaje largo.
 *
 * Envíos contesta «quién está cerca de un destino». Esta pantalla contesta la
 * pregunta de antes de salir a la ruta: voy de Luján a La Pampa, ¿a quién le
 * paso por la puerta? El camión hace el viaje igual; cada parada de más le
 * cuesta poco y al cliente le ahorra un flete entero.
 *
 * Se lee de arriba abajo en el orden del viaje, pueblo por pueblo, con el
 * WhatsApp ya escrito. Lo que ya se avisó se tilda y queda guardado en este
 * navegador para ese viaje, así se puede mandar de a tandas sin repetir.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { esProspecto } from '../api/customers'
import { listDestinos } from '../api/shipping'
import { LEAD_STATE_LABELS, LOST_REASON_LABELS } from '../api/leads'
import { useAsync } from '../lib/useAsync'
import { formatNumber, whatsappLink } from '../lib/format'
import {
  geocodificar,
  paradasSobreRuta,
  prepararLinea,
  separarLugar,
  trazarRuta,
  ubicar,
} from '../lib/ruta'
import MapaRuta, { colorDeParada } from '../components/MapaRuta'
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  Loading,
  PageHeader,
  Stat,
  Textarea,
} from '../components/ui'

const VIAJE_INICIAL = {
  desde: 'Luján, Buenos Aires',
  hasta: 'Santa Rosa, La Pampa',
  por: '',
}

const MENSAJE_INICIAL =
  '¡Hola {nombre}! Te escribo de Recuvarilla. {cuando} salimos con el camión de {desde} a {hasta} y pasamos por {localidad}. ' +
  'Si necesitás varillas, aprovechá que te las llevamos con un flete mucho más barato que el habitual. ¿Te paso un presupuesto?'

const AVISADOS = 'recuvarilla.ruta.avisados'

function leerAvisados() {
  try {
    return JSON.parse(localStorage.getItem(AVISADOS) ?? '{}')
  } catch {
    return {}
  }
}

/** "2026-10-27" → "El martes 27/10". Sin fecha, algo que igual se lea bien. */
function cuandoTexto(fecha) {
  if (!fecha) return 'En los próximos días'
  const d = new Date(`${fecha}T12:00:00`)
  const dia = d.toLocaleDateString('es-AR', { weekday: 'long' })
  return `El ${dia} ${d.getDate()}/${d.getMonth() + 1}`
}

function primerNombre(nombre) {
  return String(nombre ?? '').trim().split(/\s+/)[0] ?? ''
}

/** De qué tipo es cada contacto, en el orden en que conviene llamarlos. */
function tipoDe(contacto) {
  if (contacto.clase === 'lead' && contacto.lost_reason === 'freight')
    return { orden: 0, label: 'Se perdió por el flete', tone: 'warn' }
  if (contacto.clase === 'cliente' && !esProspecto(contacto))
    return { orden: 1, label: 'Cliente', tone: 'info' }
  if (contacto.clase === 'cliente') return { orden: 2, label: 'Prospecto', tone: 'neutral' }
  return { orden: 3, label: 'Lead', tone: 'neutral' }
}

async function ubicarLugar(texto) {
  const lugar = separarLugar(texto)
  if (!lugar.localidad) return null
  const geo = (await geocodificar([lugar])).values().next().value
  if (!geo) throw new Error(`No encontré «${texto}». Probá escribiendo "Localidad, Provincia".`)
  return geo
}

function Contacto({ contacto, parada, mensaje, avisado, onAvisado }) {
  const tipo = tipoDe(contacto)
  const texto = mensaje
    .replaceAll('{nombre}', primerNombre(contacto.nombre))
    .replaceAll('{localidad}', parada.nombre)
  const wa = whatsappLink(contacto.telefono, texto)
  const ruta = contacto.clase === 'cliente' ? `/erp/clientes/${contacto.id}` : `/erp/leads/${contacto.id}`

  return (
    <li className={`flex items-center gap-3 py-2 ${avisado ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={avisado}
        onChange={(event) => onAvisado(contacto.id, event.target.checked)}
        title="Ya le avisé"
        className="h-4 w-4 shrink-0 rounded border-grafito-300 text-grafito-900 focus:ring-celeste-700"
      />
      <div className="min-w-0 flex-1">
        <Link
          to={ruta}
          className={`block truncate text-sm font-medium text-grafito-800 hover:text-celeste-700 ${
            avisado ? 'line-through' : ''
          }`}
        >
          {contacto.nombre}
        </Link>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-grafito-400">
          <Badge tone={tipo.tone}>{tipo.label}</Badge>
          {contacto.clase === 'cliente' && Number(contacto.pedidos) > 0 && (
            <span>
              {formatNumber(contacto.pedidos)} pedido{Number(contacto.pedidos) === 1 ? '' : 's'}
            </span>
          )}
          {contacto.clase === 'lead' && contacto.status && (
            <span>
              {LEAD_STATE_LABELS[contacto.status] ?? contacto.status}
              {contacto.lost_reason && ` · ${LOST_REASON_LABELS[contacto.lost_reason]}`}
            </span>
          )}
          {contacto.telefono && <span className="font-mono">{contacto.telefono}</span>}
        </span>
      </div>
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onAvisado(contacto.id, true)}
          className="shrink-0 rounded-md bg-grafito-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-grafito-700"
        >
          WhatsApp
        </a>
      ) : (
        <span className="shrink-0 text-xs text-grafito-300">sin teléfono</span>
      )}
    </li>
  )
}

export default function Ruta() {
  const [borrador, setBorrador] = useState(VIAJE_INICIAL)
  const [viaje, setViaje] = useState(VIAJE_INICIAL)
  const [fecha, setFecha] = useState('')
  const [corredor, setCorredor] = useState(30)
  /* Aparte del corredor: desviarse en el camino es ir y volver con el camión
     cargado; una vez en el destino, recorrer la zona es lo que se vino a hacer. */
  const [radioDestino, setRadioDestino] = useState(100)
  const [ver, setVer] = useState({ clientes: true, prospectos: false, leads: false })
  const [mensaje, setMensaje] = useState(MENSAJE_INICIAL)
  const [editandoMensaje, setEditandoMensaje] = useState(false)
  const [elegida, setElegida] = useState(null)
  const [avisados, setAvisados] = useState(leerAvisados)

  /* La cartera entera, ya con coordenadas. No depende del viaje: cambiar el
     destino no vuelve a pedir nada a la base. */
  const cartera = useAsync(async () => {
    const { filas, completo } = await listDestinos()
    return { ...(await ubicar(filas)), completo }
  }, [])

  const camino = useAsync(async () => {
    const [desde, hasta, ...por] = await Promise.all([
      ubicarLugar(viaje.desde),
      ubicarLugar(viaje.hasta),
      ...viaje.por
        .split(/[;\n]/)
        .map((texto) => texto.trim())
        .filter(Boolean)
        .map(ubicarLugar),
    ])
    if (!desde || !hasta) throw new Error('Falta el origen o el destino del viaje.')
    const ruta = await trazarRuta([desde, ...por, hasta])
    return { desde, hasta, ruta, preparada: prepararLinea(ruta.linea) }
  }, [viaje])

  const claveViaje = `${viaje.desde}→${viaje.por}→${viaje.hasta}`.toLowerCase()
  const avisadosDelViaje = avisados[claveViaje] ?? {}

  const marcarAvisado = useCallback(
    (id, valor) => {
      setAvisados((todos) => {
        const delViaje = { ...(todos[claveViaje] ?? {}) }
        if (valor) delViaje[id] = true
        else delViaje[id] = undefined
        const nuevos = { ...todos, [claveViaje]: JSON.parse(JSON.stringify(delViaje)) }
        try {
          localStorage.setItem(AVISADOS, JSON.stringify(nuevos))
        } catch {
          /* Sin almacenamiento se recuerda hasta cerrar la pestaña. */
        }
        return nuevos
      })
    },
    [claveViaje],
  )

  const paradas = useMemo(() => {
    if (!cartera.data || !camino.data) return []
    const elegidos = cartera.data.ubicados.filter((c) => {
      const t = tipoDe(c)
      if (t.orden === 0) return ver.leads || ver.clientes
      if (t.orden === 1) return ver.clientes
      if (t.orden === 2) return ver.prospectos
      return ver.leads
    })
    return paradasSobreRuta(
      elegidos,
      camino.data.preparada,
      corredor,
      camino.data.hasta,
      radioDestino,
    ).map((parada) => ({
      ...parada,
      contactos: [...parada.contactos].sort(
        (a, b) => tipoDe(a).orden - tipoDe(b).orden || a.nombre.localeCompare(b.nombre),
      ),
    }))
  }, [cartera.data, camino.data, corredor, radioDestino, ver])

  const primeraEnDestino = paradas.findIndex((p) => p.enDestino)
  const nombreDestino = camino.data?.hasta.nombre ?? separarLugar(viaje.hasta).localidad

  /** "km 143 · sobre el camino" o "a 62 km de Santa Rosa". */
  const dondeQueda = (parada) =>
    parada.enDestino
      ? `a ${formatNumber(Math.round(parada.alDestino))} km de ${nombreDestino}`
      : `km ${formatNumber(Math.round(parada.km))}${
          parada.desvio >= 8
            ? ` · ${formatNumber(Math.round(parada.desvio))} km fuera del camino`
            : ' · sobre el camino'
        }`

  useEffect(() => setElegida(null), [viaje])

  const mensajeViaje = camino.data
    ? mensaje
        .replaceAll('{cuando}', cuandoTexto(fecha))
        .replaceAll('{desde}', camino.data.desde.nombre)
        .replaceAll('{hasta}', camino.data.hasta.nombre)
    : mensaje

  const contactos = paradas.flatMap((p) => p.contactos)
  const yaAvisados = contactos.filter((c) => avisadosDelViaje[c.id]).length
  const porFlete = contactos.filter((c) => c.lost_reason === 'freight').length

  function copiarLista() {
    const texto = paradas
      .map(
        (p, i) =>
          `${i + 1}. ${p.nombre} (${dondeQueda(p)})\n` +
          p.contactos
            .map((c) => `   - ${c.nombre}${c.telefono ? ` · ${c.telefono}` : ''} · ${tipoDe(c).label}`)
            .join('\n'),
      )
      .join('\n')
    navigator.clipboard?.writeText(
      `Viaje ${camino.data.desde.nombre} → ${camino.data.hasta.nombre}${fecha ? ` · ${cuandoTexto(fecha)}` : ''}\n\n${texto}`,
    )
  }

  const toggle = (k) => setVer((v) => ({ ...v, [k]: !v[k] }))

  return (
    <>
      <PageHeader
        title="Ruta de viaje"
        description="A quién le pasás por la puerta en un viaje largo, en el orden del camino, para ofrecerle un flete barato."
        actions={
          <Link to="/erp/envios">
            <Button variant="ghost">Volver a Envíos</Button>
          </Link>
        }
      />

      <Card className="mb-4 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setViaje(borrador)
          }}
          className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]"
        >
          <Field label="Desde">
            <Input
              value={borrador.desde}
              onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
              placeholder="Localidad, Provincia"
            />
          </Field>
          <Field label="Hasta">
            <Input
              value={borrador.hasta}
              onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
              placeholder="Localidad, Provincia"
            />
          </Field>
          <Field label="Pasando por (opcional)" hint="Varias separadas con ;">
            <Input
              value={borrador.por}
              onChange={(e) => setBorrador({ ...borrador, por: e.target.value })}
              placeholder="General Pico, La Pampa"
            />
          </Field>
          <Field label="Fecha de salida">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <div className="mt-5">
            <Button type="submit" className="w-full">
              Trazar
            </Button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-grafito-100 pt-4">
          <label className="flex items-center gap-3 text-sm text-grafito-600">
            <span className="whitespace-nowrap">En el camino</span>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={corredor}
              onChange={(e) => setCorredor(Number(e.target.value))}
              className="w-36 accent-grafito-900"
            />
            <span className="w-24 font-mono text-grafito-900">{corredor} km</span>
          </label>
          <label className="flex items-center gap-3 text-sm text-grafito-600">
            <span className="whitespace-nowrap">Alrededor de {nombreDestino || 'el destino'}</span>
            <input
              type="range"
              min={0}
              max={300}
              step={10}
              value={radioDestino}
              onChange={(e) => setRadioDestino(Number(e.target.value))}
              className="w-36 accent-celeste-700"
            />
            <span className="w-24 font-mono text-grafito-900">{radioDestino} km</span>
          </label>
          {[
            ['clientes', 'Clientes'],
            ['prospectos', 'Prospectos'],
            ['leads', 'Leads'],
          ].map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-grafito-600">
              <input
                type="checkbox"
                checked={ver[k]}
                onChange={() => toggle(k)}
                className="h-4 w-4 rounded border-grafito-300 text-grafito-900 focus:ring-celeste-700"
              />
              {label}
            </label>
          ))}
          <button
            type="button"
            onClick={() => setEditandoMensaje((v) => !v)}
            className="ml-auto text-sm font-semibold text-celeste-700 hover:underline"
          >
            {editandoMensaje ? 'Listo' : 'Editar mensaje de WhatsApp'}
          </button>
        </div>

        {editandoMensaje && (
          <div className="mt-3">
            <Textarea rows={3} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
            <p className="mt-1 text-xs text-grafito-400">
              Se reemplazan solos: {'{nombre}'} {'{localidad}'} {'{cuando}'} {'{desde}'} {'{hasta}'}.{' '}
              <button
                type="button"
                onClick={() => setMensaje(MENSAJE_INICIAL)}
                className="font-semibold text-celeste-700 hover:underline"
              >
                Volver al original
              </button>
            </p>
          </div>
        )}
      </Card>

      {cartera.error && <ErrorNote onRetry={cartera.reload}>{cartera.error}</ErrorNote>}
      {camino.error && <ErrorNote onRetry={camino.reload}>{camino.error}</ErrorNote>}

      {(cartera.loading || camino.loading) && !cartera.error && !camino.error && (
        <Loading>
          {cartera.loading ? 'Ubicando a los clientes en el mapa…' : 'Trazando el camino…'}
        </Loading>
      )}

      {cartera.data && camino.data && !camino.loading && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Paradas"
              value={formatNumber(paradas.length)}
              hint={`en ${formatNumber(Math.round(camino.data.ruta.km))} km${
                camino.data.ruta.horas ? ` · ${camino.data.ruta.horas.toFixed(1).replace('.', ',')} h de manejo` : ''
              }`}
            />
            <Stat label="Contactos en el camino" value={formatNumber(contactos.length)} />
            <Stat
              label="Ya avisados"
              value={`${formatNumber(yaAvisados)} / ${formatNumber(contactos.length)}`}
              tone={contactos.length && yaAvisados === contactos.length ? 'good' : 'neutral'}
            />
            <Stat
              label="Perdidos por el flete"
              value={formatNumber(porFlete)}
              tone={porFlete ? 'warn' : 'neutral'}
              hint={porFlete ? 'Los primeros a los que escribir' : ver.leads ? undefined : 'Marcá "Leads" para verlos'}
            />
          </div>

          {camino.data.ruta.aproximado && (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              El ruteador no respondió: el camino es una línea recta entre las paradas y los kilómetros son
              aproximados.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="h-[60vh] overflow-hidden lg:sticky lg:top-6 lg:col-span-3 lg:h-[calc(100vh-3rem)]">
              <MapaRuta
                ruta={camino.data.ruta}
                origen={camino.data.desde}
                destino={camino.data.hasta}
                paradas={paradas}
                corredor={corredor}
                radioDestino={radioDestino}
                elegida={elegida}
                onElegir={setElegida}
              />
            </Card>

            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex flex-wrap gap-3 text-xs text-grafito-500">
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2.5 w-2.5 rounded-full bg-[#1f5e96]" /> Clientes
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2.5 w-2.5 rounded-full bg-[#d97706]" /> Perdido por flete
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="inline-block h-2.5 w-2.5 rounded-full bg-[#737c79]" /> Leads
                  </span>
                </p>
                {paradas.length > 0 && (
                  <button
                    type="button"
                    onClick={copiarLista}
                    className="text-xs font-semibold text-celeste-700 hover:underline"
                  >
                    Copiar lista
                  </button>
                )}
              </div>

              {paradas.length === 0 ? (
                <Card>
                  <Empty>
                    Nadie a menos de {corredor} km del camino ni de {radioDestino} km de {nombreDestino}.
                    Probá ampliar las distancias o sumar leads y prospectos.
                  </Empty>
                </Card>
              ) : (
                <ol className="space-y-3">
                  {paradas.map((parada, i) => (
                    <li key={parada.id}>
                      {i === primeraEnDestino && (
                        <p className="rotulo mb-2 mt-5 text-celeste-700">
                          Alrededor de {nombreDestino} · hasta {radioDestino} km
                        </p>
                      )}
                      <Card
                        className={`transition-shadow ${
                          parada.id === elegida ? 'ring-2 ring-celeste-400' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setElegida(parada.id)}
                          className="flex w-full items-center gap-3 border-b border-grafito-100 px-4 py-3 text-left"
                        >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold text-white"
                            style={{ background: colorDeParada(parada) }}
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-grafito-900">
                              {parada.nombre}
                            </span>
                            <span className="block text-xs text-grafito-400">
                              {parada.provincia} · {dondeQueda(parada)}
                            </span>
                          </span>
                          <span className="font-mono text-xs text-grafito-500">
                            {parada.contactos.filter((c) => avisadosDelViaje[c.id]).length}/
                            {parada.contactos.length}
                          </span>
                        </button>
                        <ul className="divide-y divide-grafito-100 px-4">
                          {parada.contactos.map((contacto) => (
                            <Contacto
                              key={`${contacto.clase}-${contacto.id}`}
                              contacto={contacto}
                              parada={parada}
                              mensaje={mensajeViaje}
                              avisado={Boolean(avisadosDelViaje[contacto.id])}
                              onAvisado={marcarAvisado}
                            />
                          ))}
                        </ul>
                      </Card>
                    </li>
                  ))}
                </ol>
              )}

              {(cartera.data.sinLugar.length > 0 ||
                cartera.data.noEncontrados.length > 0 ||
                !cartera.data.completo) && (
                <p className="mt-4 text-xs leading-relaxed text-grafito-400">
                  {cartera.data.sinLugar.length > 0 &&
                    `${formatNumber(cartera.data.sinLugar.length)} contactos no tienen localidad ni código postal y no se pueden ubicar. `}
                  {cartera.data.noEncontrados.length > 0 &&
                    `${formatNumber(cartera.data.noEncontrados.length)} tienen una localidad que el padrón oficial no reconoce (${[
                      ...new Set(cartera.data.noEncontrados.map((c) => c.localidad).filter(Boolean)),
                    ]
                      .slice(0, 6)
                      .join(', ')}${cartera.data.noEncontrados.length > 6 ? '…' : ''}). `}
                  {!cartera.data.completo && 'La base devolvió la cartera incompleta: puede faltar gente.'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
