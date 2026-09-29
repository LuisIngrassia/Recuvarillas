/**
 * Una pieza de Instagram, a tamaño real: 1080 × 1080 o 1080 × 1920.
 *
 * Se dibuja siempre en píxeles de verdad y quien la muestra la achica con
 * `transform`. Así la vista previa y el PNG exportado son la misma pieza, no
 * dos parecidas: lo que se ve en el ERP es lo que sale.
 *
 * Además se mide sola. Los textos los escribe cualquiera, y un titular largo
 * en una plantilla pensada para tres palabras se come el pie o queda cortado.
 * Si no entra, se va achicando de a 5% hasta un 70% del tamaño del manual; si
 * ni así entra, avisa por `onMedida` para que la pantalla lo diga antes de
 * exportar.
 */
import { useLayoutEffect, useRef } from 'react'
import { LOGOS, SISTEMA, fotoUrl } from './assets'
import { CONTACTOS, tipografia } from './plantillas'
import { useFuentes } from './fuentes'

/*
  Las proporciones de los SVG, escritas a mano. Una imagen sin cargar mide cero
  de alto, y la pieza se mediría sin logo: el ajuste haría lugar para un texto
  que después no entra. Con la proporción fija el alto se sabe desde el primer
  cuadro.
*/
const PROPORCION = {
  palabra: '5695 / 926',
  principal: '5695 / 1133.2',
  varilla: '40 / 1',
}

const AJUSTE_MINIMO = 0.7

function Logo({ variante = 'palabraColor', className = 'rvp-logo' }) {
  const proporcion = variante === 'principalColor' ? PROPORCION.principal : PROPORCION.palabra
  return (
    <img
      className={className}
      src={LOGOS[variante]}
      alt="Recuvarilla"
      style={{ aspectRatio: proporcion }}
    />
  )
}

function Foto({ campos }) {
  const url = fotoUrl(campos.foto)
  const foco = campos.foco ?? { x: 50, y: 50 }

  if (!url) {
    return (
      <div
        className="rvp-foto"
        data-falta-foto
        style={{ background: '#D9DDDA', display: 'grid', placeItems: 'center' }}
      >
        <span className="rvp-etiqueta">Falta la foto</span>
      </div>
    )
  }

  return (
    <img
      className="rvp-foto"
      src={url}
      alt=""
      // Las subidas vienen de Supabase, otro dominio. Sin esto el navegador
      // guarda la imagen sin permiso de lectura y la exportación no la puede
      // copiar al PNG.
      crossOrigin={/^https?:\/\//.test(campos.foto ?? '') ? 'anonymous' : undefined}
      style={{ objectPosition: `${foco.x}% ${foco.y}%` }}
    />
  )
}

function Pie({ oscura }) {
  return (
    <div className="rvp-pie">
      <img
        className="rvp-varilla"
        src={oscura ? SISTEMA.varillaSeparadorBlanca : SISTEMA.varillaSeparador}
        alt=""
        style={{ aspectRatio: PROPORCION.varilla }}
      />
      <div className="rvp-contactos">
        {CONTACTOS.map((contacto) => (
          <span key={contacto}>{contacto}</span>
        ))}
      </div>
    </div>
  )
}

function Producto({ campos }) {
  return (
    <>
      <Logo />
      <div className="rvp-cabeza">
        <span className="rvp-etiqueta">{campos.etiqueta}</span>
        <h1 className="rvp-titular" data-cabe="ancho">
          {tipografia(campos.titular)}
        </h1>
      </div>
      <div className="rvp-cuerpo" data-cabe>
        <p className="rvp-bajada">{tipografia(campos.bajada)}</p>
        <Foto campos={campos} />
      </div>
      <Pie />
    </>
  )
}

function Aplicaciones({ campos }) {
  return (
    <>
      <div className="rvp-arriba">
        <Foto campos={campos} />
        <Logo variante="palabraNegativo" />
      </div>
      <div className="rvp-abajo">
        <span className="rvp-etiqueta">{campos.etiqueta}</span>
        <h1 className="rvp-titular" data-cabe="ancho">
          {tipografia(campos.titular)}
        </h1>
        <p className="rvp-bajada">{tipografia(campos.bajada)}</p>
        <Pie />
      </div>
    </>
  )
}

function Educacion({ campos }) {
  const items = (campos.items ?? []).filter((item) => item.trim())
  return (
    <>
      <Logo variante="palabraNegativo" />
      <div className="rvp-cuerpo">
        <span className="rvp-etiqueta">{campos.etiqueta}</span>
        <h1 className="rvp-titular" data-cabe="ancho">
          {tipografia(campos.titular)}
        </h1>
        <ul className="rvp-lista">
          {items.map((item, index) => (
            <li key={index}>
              <img src={SISTEMA.vinetaAgujero} alt="" />
              {tipografia(item)}
            </li>
          ))}
        </ul>
      </div>
      <Pie oscura />
    </>
  )
}

function Marca({ campos }) {
  return (
    <>
      <div className="rvp-franja" />
      <div className="rvp-cuerpo">
        <Logo variante="principalColor" />
        <h1 className="rvp-titular" data-cabe="ancho">
          {tipografia(campos.titular)}
        </h1>
      </div>
      <Pie />
    </>
  )
}

function Proceso({ campos }) {
  const total = Number(campos.total) || 6
  const paso = Math.min(Math.max(Number(campos.paso) || 1, 1), total)
  return (
    <>
      <Logo />
      <div className="rvp-cuerpo">
        <span className="rvp-etiqueta">
          Proceso · paso {paso} de {total}
        </span>
        <div className="rvp-paso">{String(paso).padStart(2, '0')}</div>
        <h1 className="rvp-titular" data-cabe="ancho">
          {tipografia(campos.titular)}
        </h1>
        <p className="rvp-bajada">{tipografia(campos.bajada)}</p>
        <div className="rvp-pasos">
          {Array.from({ length: total }, (_, index) => (
            <i key={index} className={index < paso ? 'on' : undefined} />
          ))}
        </div>
      </div>
      <Pie />
    </>
  )
}

function Pruebas({ campos }) {
  return (
    <>
      <Logo />
      <div className="rvp-marco">
        <span className="rvp-etiqueta">{campos.etiqueta}</span>
        <p className="rvp-cita" data-cabe="ancho">
          {campos.cita}
        </p>
        <p className="rvp-quien">
          <b>{campos.quien}</b>
        </p>
      </div>
      <Pie />
    </>
  )
}

const CUERPOS = {
  producto: Producto,
  aplicaciones: Aplicaciones,
  educacion: Educacion,
  marca: Marca,
  proceso: Proceso,
  pruebas: Pruebas,
}

const FONDO_CLASE = { educacion: 'rvp--oscura', pruebas: 'rvp--hormigon' }

/**
 * ¿Algo se sale de su lugar? La pieza entera, o una caja marcada `data-cabe`.
 *
 * Los titulares se marcan `data-cabe="ancho"` y sólo se les mide el ancho, que
 * es donde se nota una palabra que no entra. El alto no: con el interlineado
 * apretado del manual (0,92) las letras con cola siempre asoman unos píxeles
 * debajo de su renglón, y el titular "desbordaría" aunque sobre lugar. Si el
 * titular es de verdad demasiado alto, lo dice la caja que lo contiene.
 */
function desborda(nodo) {
  return [nodo, ...nodo.querySelectorAll('[data-cabe]')].some(
    (el) =>
      el.scrollWidth > el.clientWidth + 1 ||
      (el.dataset.cabe !== 'ancho' && el.scrollHeight > el.clientHeight + 1),
  )
}

export default function Pieza({ plantilla, campos, formato = 'cuadrado', onMedida, ref }) {
  const nodoRef = useRef(null)
  const fuentes = useFuentes()
  const onMedidaRef = useRef(onMedida)
  onMedidaRef.current = onMedida

  const firma = JSON.stringify(campos)

  useLayoutEffect(() => {
    const nodo = nodoRef.current
    if (!nodo || !fuentes) return

    let ajuste = 1
    nodo.style.setProperty('--ajuste', '1')
    while (desborda(nodo) && ajuste > AJUSTE_MINIMO + 0.001) {
      ajuste = Math.round((ajuste - 0.05) * 100) / 100
      nodo.style.setProperty('--ajuste', String(ajuste))
    }

    const foto = nodo.querySelector('.rvp-foto')
    onMedidaRef.current?.({
      desborda: desborda(nodo),
      ajuste,
      // Una foto de menos de un cuarto del alto no se lee en el teléfono.
      fotoChica: Boolean(foto && foto.offsetHeight < nodo.offsetHeight / 4),
      faltaFoto: Boolean(nodo.querySelector('[data-falta-foto]')),
    })
  }, [plantilla, formato, firma, fuentes])

  const Cuerpo = CUERPOS[plantilla]
  if (!Cuerpo) return null

  const clases = [
    'rvp',
    `rvp-${plantilla}`,
    formato === 'historia' && 'rvp--historia',
    FONDO_CLASE[plantilla],
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={clases}
      ref={(nodo) => {
        nodoRef.current = nodo
        if (typeof ref === 'function') ref(nodo)
        else if (ref) ref.current = nodo
      }}
    >
      <Cuerpo campos={campos} />
    </div>
  )
}
