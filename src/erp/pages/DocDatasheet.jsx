/**
 * La ficha técnica: el dibujo con medidas y la tabla de características.
 *
 * Reemplaza a `docs/ficha-tecnica-recuvarilla.html`. Ese archivo traía además
 * los controles para cambiar largo, ancho, espesor y cantidad de perforaciones,
 * y redibujaba la varilla en vivo. Eso era una herramienta para *diseñar* la
 * ficha, no para emitirla: acá el producto tiene una sola medida y lo que hace
 * falta es imprimirla bien.
 *
 * El dibujo es el gráfico de dimensiones del manual de marca, tal cual: "usalo
 * en fichas, catálogos, la web y el stand" (08 · Producto). Si algún día hay
 * una varilla de otro largo, se regenera con
 * `brand/herramientas/generar_producto.py` y esta ficha lo toma sola.
 *
 * Lo que sí se conserva son las marcas de dato pendiente: los valores que
 * todavía no se midieron salen señalados en vez de escritos como si estuvieran
 * verificados. Es una ficha técnica; que se note lo que falta es la diferencia
 * entre un documento serio y uno que promete números que nadie ensayó.
 */
import { documentoPorTipo } from '../lib/documentos'
import { formatDate, todayISO } from '../lib/format'
import DocSheet, { LogoHoja, PieContacto } from '../components/DocSheet'
import dimensionesUrl from '../../../brand/assets/producto/dimensiones-perforada.svg?url'

const ESTILOS = `
.ficha .ident { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--linea); border: 1px solid var(--linea); border-radius: 4px; overflow: hidden; margin-top: 26px; }
.ficha .ident > div { background: #fff; padding: 12px 14px; }
.ficha .ident .v { font-weight: 700; font-size: 16px; margin-top: 2px; }
.ficha .dimensiones { width: 100%; display: block; border: 1px solid var(--linea); border-radius: 4px; margin-bottom: 16px; }
.ficha .versus { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--linea); border: 1px solid var(--linea); border-radius: 4px; overflow: hidden; }
.ficha .versus > div { padding: 16px 18px; background: #fff; }
.ficha .versus .col-ours { background: var(--grafito); color: #fff; }
.ficha .versus h3 { font-weight: 800; font-stretch: 75%; font-size: 22px; line-height: 1; margin: 0 0 10px; }
.ficha .versus .col-wood h3, .ficha .versus .col-wood li { color: var(--gris); }
.ficha .versus .col-ours .hm-lista li::before { border-color: #fff; }
.ficha .note { font-size: 12.5px; color: var(--gris); margin: 12px 0 0; }
.ficha td.mono { font-size: 12.5px; }
@media (max-width: 720px) {
  .ficha .ident { grid-template-columns: repeat(2, 1fr); }
  .ficha .versus { grid-template-columns: 1fr; }
}
`

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

          <div className="hm ficha doc-hoja">
            <header className="hm-cabecera">
              <LogoHoja />
              <dl className="hm-meta">
                <span className="hm-tipo">Ficha técnica</span>
                <dt>Revisión</dt>
                <dd>00</dd>
                <dt>Emisión</dt>
                <dd>{formatDate(todayISO())}</dd>
              </dl>
            </header>

            <h1 className="hm-titular">Varilla estándar 3 × 3 × 120 cm</h1>
            <p className="hm-bajada">Varilla para alambrado de plástico recuperado. Industria argentina.</p>

            <div className="ident">
              <div>
                <div className="hm-rotulo">Producto</div>
                <div className="v">Varilla estándar</div>
              </div>
              <div>
                <div className="hm-rotulo">Código</div>
                <div className="v mono">RV-STD-120</div>
              </div>
              <div>
                <div className="hm-rotulo">Aplicación</div>
                <div className="v">Alambrado rural</div>
              </div>
              <div>
                <div className="hm-rotulo">Proceso</div>
                <div className="v">Inyección</div>
              </div>
            </div>

            <section>
              <div className="hm-seccion">
                <span className="hm-rotulo">Dimensiones y datos verificables · medidas en cm</span>
              </div>
              <img
                className="dimensiones"
                src={dimensionesUrl}
                alt="Varilla de 120 cm de largo y sección de 3 × 3 cm, con perforaciones para el paso de los hilos"
              />
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
                      <td className="apagado">{clave}</td>
                      <td className={mono ? 'mono' : undefined} style={{ fontWeight: 600 }}>
                        {valor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <div className="hm-seccion">
                <span className="hm-rotulo">Por qué reemplaza a la varilla de madera · comparación funcional</span>
              </div>
              <div className="versus">
                <div className="col-ours">
                  <h3>Recuvarilla</h3>
                  <ul className="hm-lista">
                    {NUESTRAS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="col-wood">
                  <h3>Varilla de madera</h3>
                  <ul className="hm-lista">
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
              <div className="hm-seccion">
                <span className="hm-rotulo">Presentación y logística · condiciones de venta</span>
              </div>
              <table>
                <tbody>
                  <tr>
                    <td className="apagado">Unidades por paquete</td>
                    <td>
                      <span className="hm-pendiente">10 u.</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="apagado">Compra mínima</td>
                    <td>
                      <span className="hm-pendiente">10 paquetes</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="apagado">Plazo de entrega</td>
                    <td>Según cantidad y localidad del pedido.</td>
                  </tr>
                  <tr>
                    <td className="apagado">Flete</td>
                    <td>
                      El valor del presupuesto corresponde exclusivamente al
                      producto. Los costos de envío desde nuestra planta (Luján)
                      hasta el destino son a cargo del cliente.
                    </td>
                  </tr>
                  <tr>
                    <td className="apagado">Separación recomendada entre varillas</td>
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

            <PieContacto contacto={contacto}>
              <br />
              <span style={{ color: 'var(--gris)' }}>
                Documento de trabajo · Rev. 00 · los datos marcados no se publican hasta ser medidos
              </span>
            </PieContacto>
          </div>
        </>
      )}
    </DocSheet>
  )
}
