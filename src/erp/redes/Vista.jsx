/**
 * Una pieza achicada para mirarla en pantalla.
 *
 * Adentro la pieza sigue midiendo 1080 px: sólo se la escala con `transform`.
 * Por eso lo que se mide acá (si el texto entra, cuánto se achicó) es lo mismo
 * que va a salir en el PNG.
 */
import Pieza from './Pieza'
import { FORMATOS } from './plantillas'

export default function Vista({ post, formato, ancho = 280, onMedida }) {
  const { ancho: real, alto } = FORMATOS[formato]
  const escala = ancho / real

  return (
    <div
      className="overflow-hidden rounded-md border border-grafito-200 bg-white shadow-sm"
      style={{ width: ancho, height: Math.round(alto * escala) }}
    >
      <div style={{ transform: `scale(${escala})`, transformOrigin: 'top left', width: real }}>
        <Pieza plantilla={post.plantilla} campos={post.campos} formato={formato} onMedida={onMedida} />
      </div>
    </div>
  )
}
