/**
 * El mapa del viaje: el camino, el corredor y una marca numerada por localidad.
 *
 * El número de cada marca es el mismo que el de la lista de al lado, así que
 * se puede ir y venir entre los dos sin buscar nombres. El color dice qué hay
 * ahí: celeste si hay clientes, ámbar si hay alguien que se perdió por el
 * flete —el caso para el que existe esta pantalla—, gris si sólo hay leads.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const COLORES = {
  flete: '#d97706',
  cliente: '#1f5e96',
  lead: '#737c79',
}

export function colorDeParada(parada) {
  if (parada.contactos.some((c) => c.lost_reason === 'freight')) return COLORES.flete
  if (parada.contactos.some((c) => c.clase === 'cliente')) return COLORES.cliente
  return COLORES.lead
}

function marca(numero, color, cantidad, elegida) {
  const lado = elegida ? 34 : 28
  return L.divIcon({
    className: '',
    iconSize: [lado, lado],
    iconAnchor: [lado / 2, lado / 2],
    html: `<div style="width:${lado}px;height:${lado}px;border-radius:9999px;background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;font:600 12px/1 'Chivo Mono',monospace;
      border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)${elegida ? ',0 0 0 3px ' + color + '55' : ''}">
      ${numero}</div>${
        cantidad > 1
          ? `<div style="position:absolute;top:-6px;right:-8px;background:#1d2120;color:#fff;border-radius:9999px;
          font:600 10px/1 'Chivo Mono',monospace;padding:3px 5px;border:1.5px solid #fff">${cantidad}</div>`
          : ''
      }`,
  })
}

function extremo(texto, color) {
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<div style="position:absolute;width:max-content;transform:translate(-50%,calc(-100% - 6px));white-space:nowrap;background:${color};color:#fff;
      font:700 11px/1 Archivo,sans-serif;padding:5px 8px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.3)">
      ${texto}</div>`,
  })
}

export default function MapaRuta({ ruta, origen, destino, paradas, corredor, elegida, onElegir }) {
  const contenedor = useRef(null)
  const mapa = useRef(null)
  const capas = useRef(null)

  useEffect(() => {
    mapa.current = L.map(contenedor.current, { zoomControl: true, scrollWheelZoom: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      className: 'mapa-ruta-fondo',
    }).addTo(mapa.current)
    capas.current = L.layerGroup().addTo(mapa.current)
    return () => mapa.current.remove()
  }, [])

  /* El encuadre se hace sólo cuando cambia el camino. Si se rehiciera con cada
     cambio de corredor, mover el control mientras se mira un pueblo de cerca
     tiraría el zoom para atrás cada vez. */
  useEffect(() => {
    if (ruta) mapa.current.fitBounds(L.latLngBounds(ruta.linea), { padding: [30, 30] })
  }, [ruta])

  useEffect(() => {
    const grupo = capas.current
    grupo.clearLayers()
    if (!ruta) return

    /* El corredor se dibuja como una línea gruesa en metros reales: lo que
       queda adentro de la franja es lo que entra en la lista. */
    const metrosPorPixel = (zoom, lat) =>
      (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
    const franja = L.polyline(ruta.linea, {
      color: '#74acdf',
      opacity: 0.18,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    })
    const ajustar = () => {
      const lat = mapa.current.getCenter().lat
      franja.setStyle({ weight: (corredor * 2000) / metrosPorPixel(mapa.current.getZoom(), lat) })
    }
    ajustar()
    mapa.current.on('zoomend', ajustar)
    grupo.addLayer(franja)

    grupo.addLayer(
      L.polyline(ruta.linea, {
        color: '#1d2120',
        weight: 4,
        opacity: 0.85,
        dashArray: ruta.aproximado ? '8 8' : null,
      }),
    )

    grupo.addLayer(L.marker([origen.lat, origen.lon], { icon: extremo(origen.nombre, '#1d2120') }))
    grupo.addLayer(L.marker([destino.lat, destino.lon], { icon: extremo(destino.nombre, '#1d2120') }))

    paradas.forEach((parada, i) => {
      const m = L.marker([parada.lat, parada.lon], {
        icon: marca(i + 1, colorDeParada(parada), parada.contactos.length, parada.id === elegida),
        zIndexOffset: parada.id === elegida ? 1000 : 0,
      })
      m.bindTooltip(
        `<b>${parada.nombre}</b><br>${parada.contactos.length} contacto${
          parada.contactos.length === 1 ? '' : 's'
        } · km ${Math.round(parada.km)}`,
        { direction: 'top', offset: [0, -14] },
      )
      m.on('click', () => onElegir(parada.id))
      grupo.addLayer(m)
    })

    return () => mapa.current.off('zoomend', ajustar)
  }, [ruta, origen, destino, paradas, corredor, elegida, onElegir])

  /* Al elegir una parada desde la lista, el mapa va hasta ella. */
  useEffect(() => {
    const parada = paradas.find((p) => p.id === elegida)
    if (parada) mapa.current.panTo([parada.lat, parada.lon])
  }, [elegida, paradas])

  return (
    <>
      <style>{'.mapa-ruta-fondo{filter:saturate(.55) brightness(1.04)}'}</style>
      <div ref={contenedor} className="h-full min-h-[420px] w-full rounded-xl" />
    </>
  )
}
