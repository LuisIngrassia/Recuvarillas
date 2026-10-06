/**
 * La ficha técnica: el dibujo con medidas y la tabla de características.
 *
 * Reemplaza a `docs/ficha-tecnica-recuvarilla.html`. Ese archivo traía además
 * los controles para cambiar largo, ancho, espesor y cantidad de perforaciones,
 * y redibujaba la varilla en vivo. Eso era una herramienta para *diseñar* la
 * ficha, no para emitirla: acá lo que hace falta es imprimirla bien.
 *
 * Hay una por producto. El texto sale de la ficha del producto y se cambia
 * con «Editar contenido» (ver `lib/fichas.js`); lo que quede vacío no se
 * imprime, así que un producto recién cargado ya tiene una ficha corta.
 *
 * El dibujo de la varilla es el gráfico de dimensiones del manual de marca:
 * "usalo en fichas, catálogos, la web y el stand" (08 · Producto).
 *
 * Lo que sí se conserva son las marcas de dato pendiente: los valores que
 * todavía no se midieron salen señalados en vez de escritos como si estuvieran
 * verificados. Es una ficha técnica; que se note lo que falta es la diferencia
 * entre un documento serio y uno que promete números que nadie ensayó.
 */
import { documentoPorTipo } from '../lib/documentos'
import { conTexto, esDato, urlDeImagen } from '../lib/fichas'
import { formatDate, todayISO } from '../lib/format'
import DocSheet, { LogoHoja, PieContacto } from '../components/DocSheet'

const ESTILOS = `
.ficha .ident { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--linea); border: 1px solid var(--linea); border-radius: 4px; overflow: hidden; margin-top: 26px; }
.ficha .ident > div { background: #fff; padding: 12px 14px; }
.ficha .ident .v { font-weight: 700; font-size: 16px; margin-top: 2px; }
.ficha .dimensiones { width: 100%; display: block; border: 1px solid var(--linea); border-radius: 4px; margin-bottom: 16px; }
.ficha .versus { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--linea); border: 1px solid var(--linea); border-radius: 4px; overflow: hidden; }
.ficha .versus.solo { grid-template-columns: 1fr; }
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

/** El valor de una fila: resaltado si no se midió, en mono si es un número. */
function Valor({ fila }) {
  if (fila.pendiente) return <span className="hm-pendiente">{fila.valor}</span>
  return fila.valor
}

function TablaDatos({ filas, encabezado }) {
  return (
    <table>
      {encabezado && (
        <thead>
          <tr>
            <th>Característica</th>
            <th>Valor</th>
          </tr>
        </thead>
      )}
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i}>
            <td className="apagado">{fila.clave}</td>
            <td className={esDato(fila.valor) ? 'mono' : undefined} style={{ fontWeight: encabezado ? 600 : undefined }}>
              <Valor fila={fila} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function DocDatasheet() {
  const doc = documentoPorTipo('ficha-tecnica')

  return (
    <DocSheet doc={doc}>
      {({ contacto, contenido: c }) => {
        const identificacion = conTexto(c.identificacion)
        const caracteristicas = conTexto(c.caracteristicas)
        const propias = conTexto(c.comp_propias)
        const otras = conTexto(c.comp_otras)
        const logistica = conTexto(c.logistica)
        const dibujo = urlDeImagen(c.dibujo)
        const hayPendientes = [...caracteristicas, ...logistica].some((fila) => fila.pendiente)

        return (
          <>
            <style>{ESTILOS}</style>

            <div className="hm ficha doc-hoja">
              <header className="hm-cabecera">
                <LogoHoja />
                <dl className="hm-meta">
                  <span className="hm-tipo">Ficha técnica</span>
                  {c.revision && (
                    <>
                      <dt>Revisión</dt>
                      <dd>{c.revision}</dd>
                    </>
                  )}
                  <dt>Emisión</dt>
                  <dd>{formatDate(todayISO())}</dd>
                </dl>
              </header>

              <h1 className="hm-titular">{c.ficha_titular}</h1>
              {c.ficha_bajada && <p className="hm-bajada">{c.ficha_bajada}</p>}

              {identificacion.length > 0 && (
                <div className="ident">
                  {identificacion.map((fila, i) => (
                    <div key={i}>
                      <div className="hm-rotulo">{fila.clave}</div>
                      <div className={`v ${esDato(fila.valor) || fila.clave === 'Código' ? 'mono' : ''}`}>
                        {fila.valor}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(dibujo || caracteristicas.length > 0) && (
                <section>
                  <div className="hm-seccion">
                    <span className="hm-rotulo">Dimensiones y datos verificables</span>
                  </div>
                  {dibujo && (
                    <img className="dimensiones" src={dibujo} alt={`Dibujo con medidas: ${c.ficha_titular}`} />
                  )}
                  {caracteristicas.length > 0 && <TablaDatos filas={caracteristicas} encabezado />}
                </section>
              )}

              {propias.length > 0 && (
                <section>
                  <div className="hm-seccion">
                    <span className="hm-rotulo">
                      {c.comp_otro ? `Por qué reemplaza a ${c.comp_otro.toLowerCase()} · comparación funcional` : 'Por qué conviene'}
                    </span>
                  </div>
                  <div className={`versus ${otras.length ? '' : 'solo'}`}>
                    <div className="col-ours">
                      <h3>{c.comp_propio || 'Recuvarilla'}</h3>
                      <ul className="hm-lista">
                        {propias.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    {otras.length > 0 && (
                      <div className="col-wood">
                        <h3>{c.comp_otro}</h3>
                        <ul className="hm-lista">
                          {otras.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {c.comp_nota && <p className="note">{c.comp_nota}</p>}
                </section>
              )}

              {logistica.length > 0 && (
                <section>
                  <div className="hm-seccion">
                    <span className="hm-rotulo">Presentación y logística · condiciones de venta</span>
                  </div>
                  <TablaDatos filas={logistica} />
                  {c.logistica_nota && <p className="note">{c.logistica_nota}</p>}
                </section>
              )}

              <PieContacto contacto={contacto}>
                {hayPendientes && (
                  <>
                    <br />
                    <span style={{ color: 'var(--gris)' }}>
                      Documento de trabajo{c.revision ? ` · Rev. ${c.revision}` : ''} · los datos
                      marcados no se publican hasta ser medidos
                    </span>
                  </>
                )}
              </PieContacto>
            </div>
          </>
        )
      }}
    </DocSheet>
  )
}
