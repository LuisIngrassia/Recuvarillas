/**
 * De la pieza al archivo que se sube a Instagram.
 *
 * Cada exportación dibuja la pieza de nuevo, fuera de la pantalla y a tamaño
 * real, con el mismo componente de la vista previa. No se saca foto de la vista
 * previa porque ésa está achicada y a medio cargar mientras se edita; acá se
 * espera a que estén las fuentes y las fotos antes de copiar un solo píxel.
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { domToBlob } from 'modern-screenshot'
import { strToU8, zipSync } from 'fflate'
import Pieza from './Pieza'
import { cargarFuentes } from './fuentes'
import { FORMATOS, PLANTILLAS } from './plantillas'
import { textoParaPegar } from './marca'

function esperarImagenes(nodo) {
  return Promise.all(
    [...nodo.querySelectorAll('img')].map((img) =>
      img.complete && img.naturalWidth
        ? img.decode().catch(() => {})
        : new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true })
            img.addEventListener('error', resolve, { once: true })
          }),
    ),
  )
}

/** La pieza de un posteo en un formato, como PNG. */
export async function renderizarPng(post, formato) {
  await cargarFuentes()

  const { ancho, alto } = FORMATOS[formato]
  const contenedor = document.createElement('div')
  // Fuera de la pantalla pero dibujado: con `display: none` no habría layout
  // que medir ni copiar.
  contenedor.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;'
  document.body.appendChild(contenedor)
  const root = createRoot(contenedor)

  try {
    let nodo = null
    flushSync(() => {
      root.render(
        createElement(Pieza, {
          plantilla: post.plantilla,
          campos: post.campos,
          formato,
          ref: (el) => {
            nodo = el
          },
        }),
      )
    })
    await esperarImagenes(nodo)

    return await domToBlob(nodo, { width: ancho, height: alto, scale: 1, type: 'image/png' })
  } finally {
    root.unmount()
    contenedor.remove()
  }
}

/** "2026-10-06-producto-feed.png": ordenados por fecha en cualquier carpeta. */
export function nombreArchivo(post, formato) {
  const sufijo = formato === 'historia' ? 'historia' : 'feed'
  return `${post.fecha}-${post.plantilla}-${sufijo}.png`
}

export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * ¿Este navegador puede mandar imágenes a otra app? Es el caso del teléfono:
 * el menú de compartir abre Instagram con la imagen puesta.
 */
export function puedeCompartir() {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false
  const prueba = new File([new Blob()], 'prueba.png', { type: 'image/png' })
  return navigator.canShare({ files: [prueba] })
}

/**
 * Abre el menú de compartir del teléfono con la pieza.
 *
 * Instagram ignora el texto que llega por este menú, así que antes se copia al
 * portapapeles y queda listo para pegar. Las dos cosas se piden en el mismo
 * toque, sin esperar entre una y otra: el navegador sólo deja compartir
 * mientras dure el gesto de quien tocó el botón.
 */
export function compartir(blob, nombre, texto) {
  if (texto) navigator.clipboard?.writeText(texto).catch(() => {})
  const file = new File([blob], nombre, { type: 'image/png' })
  return navigator.share({ files: [file] }).catch((error) => {
    // Cerrar el menú sin elegir nada no es un error.
    if (error.name !== 'AbortError') throw error
  })
}

function fechaLarga(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(anio, mes - 1, dia),
  )
}

/**
 * Todas las piezas de una tanda de posteos en un .zip, con un `textos.txt`
 * que dice qué va cada día y el texto listo para pegar.
 */
export async function zipDePosts(posts, onProgreso) {
  const archivos = {}
  const renglones = []
  const total = posts.reduce((suma, post) => suma + post.formatos.length, 0)
  let hechos = 0

  for (const post of posts) {
    const nombres = []
    for (const formato of post.formatos) {
      const blob = await renderizarPng(post, formato)
      const nombre = nombreArchivo(post, formato)
      archivos[nombre] = new Uint8Array(await blob.arrayBuffer())
      nombres.push(nombre)
      hechos += 1
      onProgreso?.(hechos, total)
    }

    renglones.push(
      `${fechaLarga(post.fecha)} · ${PLANTILLAS[post.plantilla].nombre}`,
      ...nombres.map((nombre) => `  ${nombre}`),
      '',
      post.formatos.includes('cuadrado') ? textoParaPegar(post) : '(Sólo historia: no lleva texto.)',
      '',
      '----------------------------------------',
      '',
    )
  }

  archivos['textos.txt'] = strToU8(renglones.join('\n'))
  // Los PNG ya vienen comprimidos: volver a comprimirlos tarda y no ahorra nada.
  return new Blob([zipSync(archivos, { level: 0 })], { type: 'application/zip' })
}
