/**
 * El gráfico de dimensiones del manual de marca, dibujado con las medidas
 * del producto.
 *
 * El de la varilla es un SVG fijo (`brand/assets/producto/`), generado una vez
 * con `brand/herramientas/generar_producto.py`. Para el poste o las tablas no
 * hay archivo, y pedir que alguien corra un script de Python por cada producto
 * nuevo es la forma de que la ficha salga sin dibujo. Así que acá se arma en
 * el momento, con la misma grilla: la cota del largo arriba, el perfil con la
 * punta y las perforaciones, y abajo la sección acotada al lado de la tabla.
 *
 * El perfil va a escala: su grosor es el que corresponde al largo dibujado,
 * con un tope para que una pieza muy fina no desaparezca ni una muy gruesa se
 * coma la hoja. La sección se dibuja con el lado mayor en 150, como la de la
 * varilla, así se ve la proporción entre ancho y alto.
 */
import { DIBUJO_GENERADO, medidasDe, puedeDibujarse, urlDeImagen } from '../lib/fichas'

const GRAFITO = '#1D2120'
const GRIS = '#5D6562'
const LINEA = '#DADFDA'
const MONO = '"Chivo Mono", monospace'
const SANS = '"Archivo Variable", "Archivo", Arial, sans-serif'

const X0 = 60
const X1 = 1340
const LADO = 150

const numero = (valor) => Number(String(valor ?? '').replace(',', '.'))

/** Las medidas se dejan como se escribieron: «2,5» sigue diciendo «2,5». */
const cm = (valor) => `${String(valor).trim()} cm`

/** Una cota: la línea con sus dos topes. */
function Cota({ x1, y1, x2, y2 }) {
  const vertical = x1 === x2
  const d = vertical
    ? `M${x1} ${y1}V${y2}M${x1 - 10} ${y1}H${x1 + 10}M${x1 - 10} ${y2}H${x1 + 10}`
    : `M${x1} ${y1}H${x2}M${x1} ${y1 - 12}V${y1 + 12}M${x2} ${y1 - 12}V${y1 + 12}`
  return <path d={d} stroke={GRAFITO} strokeWidth="2" fill="none" />
}

export default function DibujoDimensiones({
  largo,
  ancho,
  alto,
  perforada,
  material = 'Polipropileno recuperado',
  nombre,
  className,
}) {
  if (!puedeDibujarse({ largo, ancho, alto })) return null

  const L = numero(largo)
  const A = numero(ancho)
  const H = numero(alto)

  /* El perfil, a escala del largo dibujado. */
  const grosor = Math.min(90, Math.max(20, Math.round(((X1 - X0) * H) / L)))
  const yPerfil = 128
  const centro = yPerfil + grosor / 2
  const punta = X1 - grosor * 1.1
  const radio = Math.min(10, Math.max(5, grosor * 0.2))
  const agujeros = perforada
    ? Array.from({ length: 7 }, (_, i) => X0 + ((punta - X0) * (i + 1)) / 8)
    : []

  /* Todo lo de abajo se corre lo que el perfil crezca respecto de la varilla. */
  const dy = grosor - 34
  const ySeccion = 280 + dy
  const mayor = Math.max(A, H)
  const w = (LADO * A) / mayor
  const h = (LADO * H) / mayor

  const filas = [
    ['Largo', cm(largo)],
    ['Sección', `${String(ancho).trim()} × ${String(alto).trim()} cm`],
    ['Material', material],
    ['Terminación', perforada ? 'Perforada a medida' : 'Lisa'],
  ]

  const alturaTotal = Math.max(ySeccion + h + 90, 280 + dy + 4 * 50 + 20)
  const titulo = `${nombre ? `${nombre}: ` : ''}${A} × ${H} × ${L} cm`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 1400 ${alturaTotal}`}
      role="img"
      aria-label={titulo}
      className={className}
      style={{ width: '100%', height: 'auto', display: 'block', background: '#fff' }}
    >
      <title>{titulo}</title>

      {/* El largo. */}
      <Cota x1={X0} y1={96} x2={X1} y2={96} />
      <text x={(X0 + X1) / 2} y={78} textAnchor="middle" fontFamily={MONO} fontSize="28" fill={GRAFITO}>
        {cm(largo)}
      </text>

      {/* El perfil con la punta y, si va perforada, los agujeros. */}
      <path
        d={`M${X0} ${yPerfil}H${punta}L${X1} ${centro}L${punta} ${yPerfil + grosor}H${X0}Z`}
        fill={GRAFITO}
      />
      {agujeros.map((x) => (
        <circle key={x} cx={x} cy={centro} r={radio} fill="#fff" />
      ))}

      {/* La sección, acotada. */}
      <text x={X0} y={258 + dy} fontFamily={MONO} fontSize="18" fill={GRIS} letterSpacing="1">
        SECCIÓN
      </text>
      <rect x={X0} y={ySeccion} width={w} height={h} fill={GRAFITO} />
      <Cota x1={X0 + w + 25} y1={ySeccion} x2={X0 + w + 25} y2={ySeccion + h} />
      <text x={X0 + w + 45} y={ySeccion + h / 2 + 9} fontFamily={MONO} fontSize="22" fill={GRAFITO}>
        {cm(alto)}
      </text>
      <Cota x1={X0} y1={ySeccion + h + 25} x2={X0 + w} y2={ySeccion + h + 25} />
      <text x={X0 + w / 2} y={ySeccion + h + 63} textAnchor="middle" fontFamily={MONO} fontSize="22" fill={GRAFITO}>
        {cm(ancho)}
      </text>

      {/* La tabla de al lado. */}
      {filas.map(([clave, valor], i) => {
        const y = 294 + dy + i * 50
        return (
          <g key={clave}>
            <text x={380} y={y + 6} fontFamily={MONO} fontSize="17" fill={GRIS} letterSpacing="1">
              {clave.toUpperCase()}
            </text>
            <text x={570} y={y + 8} fontFamily={SANS} fontSize="24" fontWeight="700" fill={GRAFITO}>
              {valor}
            </text>
            <path d={`M380 ${y + 24}H${X1}`} stroke={LINEA} strokeWidth="2" />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * El dibujo de un documento: el generado con las medidas o la imagen elegida
 * —el SVG del manual, en la varilla, o uno subido—.
 */
export function DibujoDelProducto({ contenido: c, producto, className, alt }) {
  if (c.dibujo === DIBUJO_GENERADO) {
    return (
      <DibujoDimensiones
        {...medidasDe(c)}
        perforada={producto?.se_agujerea !== false}
        nombre={producto?.nombre}
        className={className}
      />
    )
  }

  const url = urlDeImagen(c.dibujo)
  return url ? <img className={className} src={url} alt={alt} /> : null
}
