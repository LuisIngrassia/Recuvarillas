/**
 * El flyer de la marca: una hoja para pegar en un corralón o mandar por
 * WhatsApp.
 *
 * Los otros tres papeles son de un producto y explican; éste es de la marca y
 * vende. Arriba la frase y la foto del alambrado, en el medio todo lo que
 * fabricamos —varillas y postes— con sus medidas, y abajo cómo pedir.
 *
 * Los productos salen de la base, no de un texto: uno que se cargue mañana
 * aparece solo. Sus medidas son las de su ficha (las del dibujo generado) y,
 * si no hay, las del nombre («Poste 6x165»); lo que no tenga medidas sale con
 * el nombre solo.
 *
 * Los perfiles van con los largos a escala entre sí, que es lo que el cliente
 * quiere ver de un vistazo: cuánto más largo es el poste que la varilla. El
 * grosor está exagerado —a escala real la varilla sería una raya— pero
 * respeta la proporción entre uno y otro.
 *
 * Todo se mide en `cqw` (centésimos del ancho de la hoja) para que en pantalla
 * y en el PDF sea la misma pieza, sólo que más grande o más chica. Se imprime
 * a sangre: sin el margen de 12 mm de los otros papeles.
 */
import { documentoPorTipo } from '../lib/documentos'
import {
  IMAGENES_MARCA,
  contenidoDe,
  medidasDe,
  medidasDelNombre,
  puedeDibujarse,
} from '../lib/fichas'
import DocSheet from '../components/DocSheet'
import { LOGO, QR_WHATSAPP } from '../../lib/marca'
import iconoResistencia from '../../../brand/assets/iconos/resistencia.svg?url'
import iconoElectrico from '../../../brand/assets/iconos/electrico.svg?url'
import iconoReciclado from '../../../brand/assets/iconos/reciclado.svg?url'
import iconoCampo from '../../../brand/assets/iconos/campo.svg?url'

const GRAFITO = '#1D2120'
const MONO = '"Chivo Mono", monospace'

/* El ancho del dibujo: el producto más largo lo ocupa entero. */
const ANCHO = 1000

const BENEFICIOS = [
  { icono: iconoResistencia, titulo: 'No se pudre', texto: 'Ni se oxida. Aguanta humedad, sol e insectos.' },
  { icono: iconoCampo, titulo: 'Sin mantenimiento', texto: 'No se pinta ni se repone.' },
  { icono: iconoElectrico, titulo: 'Apto eléctrico', texto: 'Es plástico: sirve para cercos eléctricos.' },
  { icono: iconoReciclado, titulo: 'Plástico recuperado', texto: 'Hecho con descarte industrial, en Luján.' },
]

const ESTILOS = `
.flyer-marco { container-type: inline-size; max-width: 860px; margin: 0 auto; }
.flyer {
  max-width: none; padding: 0; margin: 0;
  aspect-ratio: 210 / 297; overflow: hidden;
  display: flex; flex-direction: column;
}
.flyer .hm-franja { height: 1.4cqw; flex: none; }
.flyer .f-rotulo {
  font-family: "Chivo Mono", monospace; font-weight: 600;
  font-size: 1.45cqw; letter-spacing: 0.08em; text-transform: uppercase;
}
.flyer .f-condensada { font-weight: 800; font-stretch: 75%; line-height: 0.92; letter-spacing: -0.005em; margin: 0; }

/* Arriba: la marca y la foto. */
.flyer .f-hero { flex: none; height: 48cqw; display: grid; grid-template-columns: 1.12fr 0.88fr; background: var(--grafito); color: #fff; }
.flyer .f-hero-texto { padding: 5cqw 4.5cqw 4.6cqw 6cqw; display: flex; flex-direction: column; min-width: 0; }
.flyer .f-logo { width: 30cqw; height: auto; display: block; }
.flyer .f-hero .f-rotulo { color: var(--celeste); margin-top: auto; }
.flyer .f-titular { font-size: 7cqw; margin-top: 1.6cqw; }
.flyer .f-foto { width: 100%; height: 100%; object-fit: cover; display: block; min-height: 0; }

/* El medio: cada producto con su medida y su perfil. */
.flyer .f-linea { flex: 1; min-height: 0; padding: 3.4cqw 6cqw 2.4cqw; display: flex; flex-direction: column; }
.flyer .f-linea-cabeza { display: flex; justify-content: space-between; align-items: flex-end; gap: 3cqw; margin-bottom: 1.2cqw; }
.flyer .f-linea .f-rotulo { color: var(--gris); }
.flyer .f-subtitulo { font-size: 5.8cqw; margin-top: 0.8cqw; }
.flyer .f-productos { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.flyer .f-fila { display: grid; grid-template-columns: 31cqw 1fr; gap: 3cqw; align-items: center; padding: 1.5cqw 0; border-bottom: 1px solid var(--linea); }
.flyer .f-fila:first-child { border-top: 1.5px solid var(--grafito); }
.flyer .f-nombre { font-family: "Chivo Mono", monospace; font-weight: 600; font-size: 1.5cqw; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gris); }
.flyer .f-medida { font-size: 5cqw; margin-top: 0.5cqw; white-space: nowrap; }
.flyer .f-medida small { font-size: 2.4cqw; font-stretch: 100%; font-weight: 700; margin-left: 0.6cqw; }
.flyer .f-detalle { font-size: 1.6cqw; color: var(--gris); margin-top: 0.7cqw; }
.flyer .f-perfil { width: 100%; height: auto; display: block; }
.flyer .f-regla { display: grid; grid-template-columns: 31cqw 1fr; gap: 3cqw; margin-top: 1.2cqw; }
/* Con tres productos o más la hoja no se estira: se achica cada fila. */
.flyer .f-productos.compacta .f-fila { padding: 0.8cqw 0; }
.flyer .f-productos.compacta .f-medida { font-size: 3.8cqw; margin-top: 0.2cqw; }
.flyer .f-productos.compacta .f-medida small { font-size: 1.9cqw; }
.flyer .f-productos.compacta .f-detalle { font-size: 1.4cqw; margin-top: 0.3cqw; }
.flyer .f-productos.apretada .f-detalle { display: none; }
.flyer .f-productos.apretada .f-fila { padding: 0.4cqw 0; }
.flyer .f-productos.apretada .f-nombre { font-size: 1.25cqw; }
.flyer .f-productos.apretada .f-medida { font-size: 3.4cqw; }

/* Por qué conviene, con los iconos del manual. */
.flyer .f-beneficios { flex: none; background: var(--hormigon); padding: 2.6cqw 6cqw; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.4cqw; }
.flyer .f-beneficios img { width: 3.8cqw; height: 3.8cqw; display: block; margin-bottom: 1cqw; }
.flyer .f-beneficios b { display: block; font-size: 1.75cqw; line-height: 1.15; }
.flyer .f-beneficios span { display: block; font-size: 1.35cqw; line-height: 1.35; color: var(--gris); margin-top: 0.4cqw; }

/* Abajo: cómo pedir. */
.flyer .f-pie { flex: none; padding: 3cqw 6cqw 3.4cqw; }
.flyer .f-pie .hm-varilla { margin-bottom: 2.4cqw; }
.flyer .f-pie-contenido { display: flex; justify-content: space-between; align-items: center; gap: 4cqw; }
.flyer .f-pide { font-size: 5.8cqw; margin-top: 0.6cqw; }
.flyer .f-telefono { font-family: "Chivo Mono", monospace; font-weight: 600; font-size: 2.9cqw; margin-top: 1.4cqw; }
.flyer .f-datos { font-family: "Chivo Mono", monospace; font-size: 1.5cqw; color: var(--gris); margin-top: 0.8cqw; }
.flyer .f-qr { width: 13cqw; height: 13cqw; display: block; flex: none; }
.flyer .f-qr-texto { font-family: "Chivo Mono", monospace; font-size: 1.2cqw; color: var(--gris); text-align: center; margin-top: 0.6cqw; }

@media print {
  @page { size: A4; margin: 0; }
  .flyer-marco { width: 210mm; max-width: 210mm; break-inside: avoid; }
  .flyer { aspect-ratio: auto; height: 296.5mm; font-size: 14px; }
}
`

const numero = (valor) => Number(String(valor ?? '').replace(',', '.'))
const limpio = (valor) => String(valor ?? '').trim()

/** Las medidas de la ficha y, si no están, las del nombre o el titular. */
function medidasDelProducto(producto) {
  const c = contenidoDe(producto)
  const guardadas = medidasDe(c)
  if (puedeDibujarse(guardadas)) return guardadas
  return medidasDelNombre(producto.nombre) ?? medidasDelNombre(c.titular)
}

/** «Poste 6x165» → «Poste». */
const queEs = (nombre) => limpio(nombre).split(/\s+/)[0]?.replace(/[\d×x]+$/i, '') || limpio(nombre)

/** Lo que el perfil necesita: el largo y el grosor que se ve de costado. */
function perfilDe(medidas) {
  if (!medidas) return null
  const redonda = medidas.forma === 'redonda'
  return {
    redonda,
    largo: numero(medidas.largo),
    grosor: numero(redonda ? medidas.diametro : medidas.alto),
  }
}

/**
 * El perfil de costado, con la punta como en el dibujo de la ficha. El largo
 * va a escala contra el producto más largo; el grosor, exagerado tres veces y
 * con topes para que la varilla no sea un hilo ni el poste una viga.
 */
function Perfil({ perfil, cmPorPunto, perforada, etiqueta, maximo = 96 }) {
  const largo = perfil.largo / cmPorPunto
  const grosor = Math.min(maximo, Math.max(maximo / 4, (perfil.grosor / cmPorPunto) * 3))
  const alto = grosor + 8
  const y = 4
  const centro = y + grosor / 2
  const punta = largo - grosor * 0.9
  const radio = Math.min(9, Math.max(4.5, grosor * 0.18))
  const cantidad = Math.max(3, Math.round(perfil.largo / 18))
  const agujeros = perforada
    ? Array.from({ length: cantidad }, (_, i) => (punta * (i + 1)) / (cantidad + 1))
    : []

  return (
    <svg className="f-perfil" viewBox={`0 0 ${ANCHO} ${alto}`} role="img" aria-label={etiqueta}>
      <path d={`M0 ${y}H${punta}L${largo} ${centro}L${punta} ${y + grosor}H0Z`} fill={GRAFITO} />
      {perfil.redonda && (
        <path
          d={`M0 ${y + grosor * 0.24}H${punta + grosor * 0.2}`}
          stroke="#fff"
          strokeOpacity="0.18"
          strokeWidth={Math.max(3, grosor * 0.12)}
          strokeLinecap="round"
        />
      )}
      {agujeros.map((x) => (
        <circle key={x} cx={x} cy={centro} r={radio} fill="#fff" />
      ))}
    </svg>
  )
}

/** La regla de abajo: marcas cada 10 cm y números cada 20 (o 50 si es larga). */
function Regla({ maximo, cmPorPunto }) {
  const paso = maximo > 250 ? 50 : 20
  const marcas = []
  for (let cm = 0; cm <= maximo; cm += 10) marcas.push(cm)

  return (
    <svg className="f-perfil" viewBox={`0 0 ${ANCHO} 50`} aria-hidden="true" overflow="visible">
      <path d={`M0 2H${maximo / cmPorPunto}`} stroke={GRAFITO} strokeWidth="2" />
      {marcas.map((cm) => {
        const x = cm / cmPorPunto
        const conNumero = cm % paso === 0
        return (
          <g key={cm}>
            <path d={`M${x} 2V${conNumero ? 16 : 10}`} stroke={GRAFITO} strokeWidth="2" />
            {conNumero && (
              <text x={x} y="46" textAnchor={cm === 0 ? 'start' : cm === maximo ? 'end' : 'middle'} fontFamily={MONO} fontSize="24" fill={GRAFITO}>
                {cm}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Producto({ producto, perfil, medidas, cmPorPunto, grosorMaximo }) {
  const perforada = producto.se_agujerea !== false
  const medida = !medidas
    ? null
    : medidas.forma === 'redonda'
      ? `Ø ${limpio(medidas.diametro)} × ${limpio(medidas.largo)}`
      : `${limpio(medidas.ancho)} × ${limpio(medidas.alto)} × ${limpio(medidas.largo)}`
  const detalle = [
    medidas?.forma === 'redonda' ? 'Sección redonda' : medidas ? 'Sección cuadrada' : null,
    perforada ? 'lisa o agujereada' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="f-fila">
      <div>
        <div className="f-nombre">{queEs(producto.nombre)}</div>
        {medida ? (
          <p className="f-condensada f-medida">
            {medida}
            <small>cm</small>
          </p>
        ) : (
          <p className="f-condensada f-medida">{producto.nombre}</p>
        )}
        {detalle && <div className="f-detalle">{detalle.charAt(0).toUpperCase() + detalle.slice(1)}.</div>}
      </div>
      {perfil ? (
        <Perfil
          perfil={perfil}
          cmPorPunto={cmPorPunto}
          perforada={perforada}
          maximo={grosorMaximo}
          etiqueta={`${producto.nombre}${medida ? `: ${medida} cm` : ''}`}
        />
      ) : (
        <div />
      )}
    </div>
  )
}

/** La hoja, sin el marco del ERP: el contacto y la lista de productos. */
export function HojaFlyer({ contacto, productos }) {
  const foto = IMAGENES_MARCA['uso-alambrado']
  const filas = (productos ?? []).map((producto) => {
    const medidas = medidasDelProducto(producto)
    return { producto, medidas, perfil: perfilDe(medidas) }
  })
  const maximo = Math.max(0, ...filas.map(({ perfil }) => perfil?.largo ?? 0))
  /* La regla termina en una decena redonda, un poco más allá del más largo. */
  const tope = Math.ceil(maximo / 10) * 10
  const cmPorPunto = tope / ANCHO

  return (
    <>
      <style>{ESTILOS}</style>

      <div className="flyer-marco doc-hoja">
        <div className="hm flyer">
          <div className="hm-franja" aria-hidden="true" />

          <section className="f-hero">
            <div className="f-hero-texto">
              <img
                className="f-logo"
                src={LOGO.principal.negativo}
                alt="Recuvarilla, 100% Argentina"
                width={LOGO.principal.width}
                height={LOGO.principal.height}
              />
              <span className="f-rotulo">Varillas y postes para alambrado</span>
              <h1 className="f-condensada f-titular">
                Hecho para el campo.
                <br />
                Pensado para durar.
              </h1>
            </div>
            <img
              className="f-foto"
              src={foto.url}
              alt="Alambrado con varillas Recuvarilla al lado de una de madera"
              style={{ objectPosition: foto.encuadre }}
            />
          </section>

          <section className="f-linea">
            <div className="f-linea-cabeza">
              <div>
                <span className="f-rotulo">Lo que fabricamos</span>
                <h2 className="f-condensada f-subtitulo">Elegí tu medida.</h2>
              </div>
              {maximo > 0 && <span className="f-rotulo">Medidas en cm · largos a escala</span>}
            </div>

            <div className={`f-productos ${filas.length >= 3 ? 'compacta' : ''} ${filas.length >= 4 ? 'apretada' : ''}`}>
              {filas.map((fila) => (
                <Producto
                  key={fila.producto.id}
                  {...fila}
                  cmPorPunto={cmPorPunto}
                  grosorMaximo={filas.length >= 4 ? 48 : filas.length === 3 ? 64 : 96}
                />
              ))}
              {maximo > 0 && (
                <div className="f-regla">
                  <div />
                  <Regla maximo={tope} cmPorPunto={cmPorPunto} />
                </div>
              )}
            </div>
          </section>

          <section className="f-beneficios">
            {BENEFICIOS.map((item) => (
              <div key={item.titulo}>
                <img src={item.icono} alt="" />
                <b>{item.titulo}</b>
                <span>{item.texto}</span>
              </div>
            ))}
          </section>

          <footer className="f-pie">
            <span className="hm-varilla" aria-hidden="true" />
            <div className="f-pie-contenido">
              <div>
                <span className="f-rotulo" style={{ color: 'var(--gris)' }}>
                  {contacto.esEmpresa ? 'Despachamos desde Luján por expreso' : `Te atiende ${contacto.nombre}`}
                </span>
                <p className="f-condensada f-pide">Pedí tu presupuesto.</p>
                <div className="f-telefono">WhatsApp {contacto.telefono}</div>
                <div className="f-datos">
                  {[contacto.email, contacto.instagram, contacto.localidad].filter(Boolean).join('  ·  ')}
                </div>
              </div>
              {/* El QR abre el WhatsApp de la empresa: con el contacto de
                  un vendedor mandaría a otro número que el impreso. */}
              {contacto.esEmpresa && (
                <div>
                  <img className="f-qr" src={QR_WHATSAPP} alt="QR para escribir por WhatsApp" />
                  <div className="f-qr-texto">Escaneá y escribinos</div>
                </div>
              )}
            </div>
          </footer>

          <div className="hm-franja" aria-hidden="true" />
        </div>
      </div>
    </>
  )
}

export default function DocFlyer() {
  const doc = documentoPorTipo('flyer')

  return (
    <DocSheet doc={doc}>
      {({ contacto, productos }) => <HojaFlyer contacto={contacto} productos={productos} />}
    </DocSheet>
  )
}
