/**
 * El botón de WhatsApp que acompaña toda la página.
 *
 * Casi todas las ventas arrancan por WhatsApp, y el link estaba en el hero, en
 * el contacto y en el pie: lejos de donde está quien lee una tabla de precios
 * a mitad de la página. Éste está siempre a mano.
 *
 * Va en el verde de WhatsApp y no en los colores de la marca a propósito: es
 * el botón de otra aplicación, y se lo reconoce por el color antes que por el
 * dibujo. Queda debajo de la galería ampliada (z-60), que lo tapa mientras se
 * miran fotos.
 */
import { company } from '../data/siteContent'

const MENSAJE = 'Hola Recuvarilla, quiero hacer una consulta.'

export default function WhatsappFlotante() {
  return (
    <a
      href={`https://wa.me/${company.whatsapp}?text=${encodeURIComponent(MENSAJE)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      title="Escribinos por WhatsApp"
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95 sm:right-6"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8" fill="currentColor" aria-hidden="true">
        <path d="M16.004 3C8.832 3 3.004 8.828 3.004 16c0 2.293.6 4.53 1.74 6.5L3 29l6.68-1.703A12.94 12.94 0 0 0 16.004 29C23.176 29 29 23.172 29 16S23.176 3 16.004 3Zm0 23.62a10.6 10.6 0 0 1-5.41-1.48l-.39-.23-3.96 1.01 1.06-3.86-.25-.4A10.6 10.6 0 0 1 5.38 16c0-5.86 4.77-10.62 10.63-10.62S26.62 10.14 26.62 16 21.86 26.62 16.004 26.62Zm5.83-7.95c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66 0 1.57 1.14 3.08 1.3 3.3.16.21 2.25 3.43 5.45 4.81.76.33 1.36.53 1.82.67.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.74.27-1.38.19-1.52-.08-.13-.29-.21-.61-.37Z" />
      </svg>
    </a>
  )
}
