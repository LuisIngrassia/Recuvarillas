/**
 * La ficha técnica: el dibujo con medidas y la tabla de características.
 *
 * Reemplaza a `docs/ficha-tecnica-recuvarilla.html`. Ese archivo traía además
 * los controles para cambiar largo, ancho, espesor y cantidad de perforaciones,
 * y redibujaba la varilla en vivo. Eso era una herramienta para *diseñar* la
 * ficha, no para emitirla: acá el producto tiene una sola medida y lo que hace
 * falta es imprimirla bien. Si algún día hay una varilla de otro largo, el
 * dibujo ya está parametrizado —`Dibujo` toma las medidas— y alcanza con
 * pasarle otras.
 *
 * Lo que sí se conserva son las marcas de dato pendiente: los valores que
 * todavía no se midieron salen señalados en vez de escritos como si estuvieran
 * verificados. Es una ficha técnica; que se note lo que falta es la diferencia
 * entre un documento serio y uno que promete números que nadie ensayó.
 */
import { documentoPorTipo } from '../lib/documentos'
import { formatDate, todayISO } from '../lib/format'
import DocSheet from '../components/DocSheet'

const ESTILOS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

.ficha {
  --graphite: #2e3234;
  --ink: #14181a;
  --ochre: #c8a02c;
  --rust: #8a4b2a;
  --slate: #6e7a80;
  --line: #dcdfe0;
  --white: #fff;
  max-width: 820px;
  margin: 0 auto;
  background: var(--white);
  border: 1px solid var(--line);
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: var(--ink);
}
.ficha .head { background: var(--graphite); color: var(--white); padding: 26px 32px; position: relative; overflow: hidden; }
.ficha .wires { position: absolute; inset: 0; pointer-events: none; }
.ficha .wires span { position: absolute; left: 0; right: 0; height: 1px; background: rgba(255,255,255,.16); }
.ficha .wires i { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(200,160,44,.55); }
.ficha .head-inner { position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
.ficha .brand {
  font-family: 'Barlow Condensed', 'Trebuchet MS', sans-serif;
  font-weight: 700;
  font-size: 44px;
  letter-spacing: 0.02em;
  line-height: 0.95;
  text-transform: uppercase;
}
.ficha .brand em { font-style: normal; color: var(--ochre); }
.ficha .head .tagline {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,.62);
  margin-top: 6px;
}
.ficha .doc-label {
  text-align: right;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,.75);
  white-space: nowrap;
}
.ficha .doc-label strong {
  display: block;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--white);
  margin-bottom: 4px;
}
.ficha .ident { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--line); }
.ficha .ident > div { padding: 14px 18px; border-right: 1px solid var(--line); }
.ficha .ident > div:last-child { border-right: none; }
.ficha .ident .k {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--slate);
}
.ficha .ident .v { font-family: 'Barlow Condensed', sans-serif; font-size: 19px; font-weight: 600; margin-top: 2px; }
.ficha section { padding: 24px 32px; border-bottom: 1px solid var(--line); }
.ficha h2 {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--graphite);
  padding-bottom: 7px;
  border-bottom: 2px solid var(--graphite);
  margin: 0 0 18px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.ficha h2 span {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--slate);
  text-transform: none;
  font-weight: 400;
}
.ficha .specs { display: grid; grid-template-columns: 230px 1fr; gap: 32px; align-items: start; }
.ficha .drawing { margin: 0; }
.ficha .drawing svg { display: block; width: 100%; height: auto; }
.ficha figcaption {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--slate);
  margin-top: 8px;
  text-align: center;
}
.ficha table { width: 100%; border-collapse: collapse; }
.ficha th {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--slate);
  font-weight: 500;
  border-bottom: 1px solid var(--graphite);
  text-align: left;
  padding: 6px 0;
}
.ficha td { font-size: 13px; padding: 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
.ficha td:first-child { width: 42%; font-weight: 500; padding-right: 12px; }
.ficha td.mono { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--rust); }
.ficha .todo {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--rust);
  background: rgba(200,160,44,.14);
  border: 1px dashed var(--ochre);
  padding: 1px 7px;
  display: inline-block;
}
.ficha .versus { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.ficha .versus > div { padding: 16px 18px; }
.ficha .col-ours { background: var(--graphite); color: var(--white); }
.ficha .col-wood { background: var(--white); }
.ficha .versus h3 {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding-bottom: 8px;
  margin: 0 0 12px;
}
.ficha .col-ours h3 { border-bottom: 2px solid var(--ochre); }
.ficha .col-wood h3 { border-bottom: 2px solid var(--rust); color: var(--rust); }
.ficha .versus ul { list-style: none; margin: 0; padding: 0; }
.ficha .versus li { font-size: 13px; padding: 5px 0 5px 16px; position: relative; }
.ficha .versus li::before { content: ''; position: absolute; left: 0; top: 11px; width: 6px; height: 6px; }
.ficha .col-ours li::before { background: var(--ochre); }
.ficha .col-wood li::before { background: var(--rust); }
.ficha .col-ours li { border-bottom: 1px solid rgba(255,255,255,.12); }
.ficha .col-wood li { border-bottom: 1px solid var(--line); }
.ficha .versus li:last-child { border-bottom: none; }
.ficha .note { font-size: 12.5px; color: var(--slate); margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--line); }
.ficha .foot {
  background: var(--graphite);
  color: rgba(255,255,255,.8);
  padding: 20px 32px;
  display: flex;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.05em;
}
.ficha .foot b { color: var(--ochre); font-weight: 600; }

@media (max-width: 660px) {
  .ficha .ident { grid-template-columns: repeat(2, 1fr); }
  .ficha .specs, .ficha .versus { grid-template-columns: 1fr; }
}
`

/*
  Las motas del material: la varilla sale de scrap recuperado y el color varía
  según el lote. Están fijas y no al azar para que la ficha se imprima siempre
  igual, que es lo que se espera de un documento técnico.
*/
const MOTAS = [
  [146.7, 218.6, 1.6], [139.8, 184.5, 2.1], [135.2, 310.9, 2.2], [144.5, 138.5, 2.4],
  [151.4, 78.2, 2.1], [139.6, 250.9, 1.7], [148.7, 197.3, 1.7], [134.4, 328.3, 2.7],
]

/**
 * El dibujo dimensional. Esquemático a propósito: el ancho se exagera para que
 * se lea, y la proporción real se muestra aparte en la vista de sección.
 */
function Dibujo({ largo = 120, ancho = 3, espesor = 3, perforaciones = 6 }) {
  const top = 36
  const bottom = 366
  const W = 36
  const cx = 147
  const x0 = cx - W / 2

  const paso = (bottom - top) / (perforaciones + 1)
  const agujeros = Array.from({ length: perforaciones }, (_, i) => top + paso * (i + 1))

  return (
    <svg
      viewBox="0 0 240 400"
      role="img"
      aria-label={`Dibujo dimensional de la varilla: ${ancho} cm de ancho por ${largo} cm de largo, con ${perforaciones} perforaciones para el paso de los hilos de alambre.`}
    >
      <defs>
        <marker id="ficha-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 z" fill="#6E7A80" />
        </marker>
      </defs>

      <rect x={x0} y={top} width={W} height={bottom - top} fill="#2E3234" />

      <g fill="#4A5052">
        {MOTAS.map(([mx, my, r]) => (
          <circle key={`${mx}-${my}`} cx={mx} cy={my} r={r} />
        ))}
      </g>

      <g fill="#E4E7E6">
        {agujeros.map((y) => (
          <circle key={y} cx={cx} cy={y} r={4.6} />
        ))}
      </g>

      {/* Los hilos del alambrado pasando por las perforaciones. */}
      <g stroke="#6E7A80" strokeWidth="1.2" strokeDasharray="5 4">
        {agujeros.map((y) => (
          <line key={y} x1={x0 + W + 14} y1={y} x2="238" y2={y} />
        ))}
      </g>

      {/* Cota del largo. */}
      <g stroke="#6E7A80" strokeWidth="1">
        <line x1="88" y1={top} x2="88" y2={bottom} markerStart="url(#ficha-ar)" markerEnd="url(#ficha-ar)" />
        <line x1="82" y1={top} x2={x0} y2={top} strokeDasharray="3 3" />
        <line x1="82" y1={bottom} x2={x0} y2={bottom} strokeDasharray="3 3" />
      </g>
      <text
        x="78" y="205" fill="#14181A" fontFamily="'IBM Plex Mono', monospace"
        fontSize="15" fontWeight="600" textAnchor="middle" transform="rotate(-90 78 205)"
      >
        {largo}
      </text>

      {/* Cota del ancho. */}
      <g stroke="#6E7A80" strokeWidth="1">
        <line x1={x0} y1="22" x2={x0 + W} y2="22" markerStart="url(#ficha-ar)" markerEnd="url(#ficha-ar)" />
        <line x1={x0} y1="16" x2={x0} y2={top} strokeDasharray="3 3" />
        <line x1={x0 + W} y1="16" x2={x0 + W} y2={top} strokeDasharray="3 3" />
      </g>
      <text x={cx} y="13" fill="#14181A" fontFamily="'IBM Plex Mono', monospace" fontSize="13" fontWeight="600" textAnchor="middle">
        {ancho}
      </text>

      {/* La sección, donde sí se respeta la proporción ancho/espesor. */}
      <g transform="translate(14,297)">
        <rect x="0" y="0" width="30" height={30 * (espesor / ancho)} fill="none" stroke="#2E3234" strokeWidth="1.6" />
        <g stroke="#6E7A80" strokeWidth=".9">
          <line x1="0" y1={30 * (espesor / ancho) + 10} x2="30" y2={30 * (espesor / ancho) + 10} markerStart="url(#ficha-ar)" markerEnd="url(#ficha-ar)" />
          <line x1="40" y1="0" x2="40" y2={30 * (espesor / ancho)} markerStart="url(#ficha-ar)" markerEnd="url(#ficha-ar)" />
        </g>
        <text x="15" y={30 * (espesor / ancho) + 22} fill="#14181A" fontFamily="'IBM Plex Mono', monospace" fontSize="11" textAnchor="middle">
          {ancho}
        </text>
        <text x="52" y={30 * (espesor / ancho) / 2 + 4} fill="#14181A" fontFamily="'IBM Plex Mono', monospace" fontSize="11">
          {espesor}
        </text>
        <text x="0" y="-8" fill="#6E7A80" fontFamily="'IBM Plex Mono', monospace" fontSize="8" letterSpacing="1">
          SECCIÓN
        </text>
      </g>
    </svg>
  )
}

const CARACTERISTICAS = [
  ['Largo', '120 cm'],
  ['Sección', '3 cm × 3 cm'],
  ['Peso unitario', '1000 g', true],
  ['Material', 'Polipropileno (PP) reciclado de scrap industrial'],
  ['Color', 'Grafito (variable según lote de scrap)'],
  ['Estabilización UV', 'Sí', true],
  ['Perforado', 'Opcional, cantidad a pedido · con cargo adicional'],
  ['Función', 'Guía y alineación de hilos entre postes'],
  ['Origen', 'Luján, Buenos Aires · Industria argentina'],
]

const NUESTRAS = [
  'No se pudre ni junta hongos',
  'No la atacan insectos ni roedores',
  'No se oxida',
  'Flexible: absorbe golpes en lugar de quebrarse',
  'Sin mantenimiento anual',
  'Fabricada con scrap industrial recuperado',
]

const MADERA = [
  'Se pudre por contacto con humedad',
  'Vulnerable a insectos',
  'Se quiebra ante el golpe del animal',
  'Requiere reposición periódica',
  'No es ecológico',
  'Precio creciente por escasez',
]

export default function DocDatasheet() {
  const doc = documentoPorTipo('ficha-tecnica')

  return (
    <DocSheet doc={doc}>
      {(contacto) => (
        <>
          <style>{ESTILOS}</style>

          <div className="ficha doc-hoja">
            <header className="head">
              <div className="wires" aria-hidden="true">
                <span style={{ top: '22%' }} />
                <span style={{ top: '42%' }} />
                <span style={{ top: '62%' }} />
                <span style={{ top: '82%' }} />
                <i style={{ left: '18%' }} />
                <i style={{ left: '52%' }} />
                <i style={{ left: '86%' }} />
              </div>
              <div className="head-inner">
                <div>
                  <div className="brand">
                    Recu<em>·</em>Varilla
                  </div>
                  <div className="tagline">
                    Varilla plástica de material recuperado · Industria nacional
                  </div>
                </div>
                <div className="doc-label">
                  <strong>Ficha técnica</strong>
                  <span>
                    Rev. 00
                    <br />
                    Emisión: {formatDate(todayISO())}
                  </span>
                </div>
              </div>
            </header>

            <div className="ident">
              <div>
                <div className="k">Producto</div>
                <div className="v">Varilla estándar</div>
              </div>
              <div>
                <div className="k">Código</div>
                <div className="v">RV-STD-120</div>
              </div>
              <div>
                <div className="k">Aplicación</div>
                <div className="v">Alambrado rural</div>
              </div>
              <div>
                <div className="k">Proceso</div>
                <div className="v">Inyección</div>
              </div>
            </div>

            <section>
              <h2>
                Dimensiones y datos verificables <span>medidas en cm</span>
              </h2>
              <div className="specs">
                <figure className="drawing">
                  <Dibujo />
                  <figcaption>Vista lateral y sección · perforado opcional</figcaption>
                </figure>

                <table>
                  <thead>
                    <tr>
                      <th>Característica</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CARACTERISTICAS.map(([clave, valor, mono]) => (
                      <tr key={clave}>
                        <td>{clave}</td>
                        <td className={mono ? 'mono' : undefined}>{valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2>
                Por qué reemplaza a la varilla de madera <span>comparación funcional</span>
              </h2>
              <div className="versus">
                <div className="col-ours">
                  <h3>Recu-Varilla</h3>
                  <ul>
                    {NUESTRAS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="col-wood">
                  <h3>Varilla de madera</h3>
                  <ul>
                    {MADERA.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="note">
                Los puntos de la columna izquierda describen el comportamiento
                esperado del material. Los que requieren un número medido están
                señalados como pendientes: hasta tener el ensayo, no se publican
                como especificación.
              </p>
            </section>

            <section>
              <h2>
                Presentación y logística <span>condiciones de venta</span>
              </h2>
              <table>
                <tbody>
                  <tr>
                    <td>Unidades por paquete</td>
                    <td>
                      <span className="todo">10 u.</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Compra mínima</td>
                    <td>
                      <span className="todo">10 paquetes</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Plazo de entrega</td>
                    <td className="mono">Dependiendo cantidad y locación del pedido.</td>
                  </tr>
                  <tr>
                    <td>Flete</td>
                    <td className="mono">
                      El valor del presupuesto corresponde exclusivamente al
                      producto. Los costos de envío desde nuestra planta (Luján)
                      hasta el destino son a cargo del cliente.
                    </td>
                  </tr>
                  <tr>
                    <td>Separación recomendada entre varillas</td>
                    <td>2 m (adaptable según el requerimiento de tensión y tipo de ganado).</td>
                  </tr>
                </tbody>
              </table>
              <p className="note">
                La separación de 2 m surge del criterio de cálculo del proyecto.
                Conviene validarla con un alambrador antes de publicarla como
                recomendación de instalación.
              </p>
            </section>

            <footer className="foot">
              <div>
                <b>{contacto.nombre}</b> · {contacto.localidad}
                <br />
                {[contacto.telefono, contacto.email, contacto.instagram]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <div style={{ textAlign: 'right' }}>
                Documento de trabajo · Rev. 00
                <br />
                Los campos marcados no se publican hasta ser medidos
              </div>
            </footer>
          </div>
        </>
      )}
    </DocSheet>
  )
}
