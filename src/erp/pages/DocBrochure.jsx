/**
 * El folleto de una hoja, el que se deja en el mostrador.
 *
 * Reemplaza a `docs/folleto_recu_varilla.html`. Aquel archivo ya tenía el
 * bloque «Contacto del vendedor», pero con datos de ejemplo que había que
 * completar a mano en cada copia; el resultado previsible era que la mitad de
 * los folletos se repartieran diciendo «Nombre y Apellido · 011 0000-0000».
 * Acá el vendedor se elige de una lista y el bloque sale lleno.
 *
 * Hay uno por producto, con el texto y las fotos guardados en su ficha (ver
 * `lib/fichas.js`). Lo que quede vacío no se imprime.
 *
 * El diseño es el folleto del manual de marca (10 · Aplicaciones de marca):
 * la franja arriba, una frase y una foto real que venden, y abajo lo que
 * explica —medida, beneficios, cómo pedir—.
 */
import { documentoPorTipo } from '../lib/documentos'
import { conTexto, encuadreDeImagen, tieneDibujo, urlDeImagen } from '../lib/fichas'
import DocSheet, { LogoHoja, PieContacto } from '../components/DocSheet'
import { DibujoDelProducto } from '../components/DibujoDimensiones'

const ESTILOS = `
.folleto { padding-top: 0; }
.folleto .hm-franja { margin: 0 -44px 32px; }
.folleto .fotos { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; margin-top: 22px; }
.folleto .fotos.una { grid-template-columns: 1fr; }
.folleto .fotos img { width: 100%; height: 280px; object-fit: cover; border-radius: 4px; display: block; }
.folleto .dimensiones { width: 100%; display: block; border: 1px solid var(--linea); border-radius: 4px; }
.folleto .dos { display: grid; grid-template-columns: 1.2fr 1fr; gap: 28px; align-items: start; }
.folleto .dos.una { grid-template-columns: 1fr; }
@media (max-width: 720px) {
  .folleto .hm-franja { margin: 0 -20px 24px; }
  .folleto .fotos, .folleto .dos { grid-template-columns: 1fr; }
}
`

export default function DocBrochure() {
  const doc = documentoPorTipo('folleto')

  return (
    <DocSheet doc={doc}>
      {({ contacto, producto, contenido: c }) => {
        const fotos = [c.foto_1, c.foto_2]
          .filter((valor) => urlDeImagen(valor))
          .map((valor) => ({ url: urlDeImagen(valor), encuadre: encuadreDeImagen(valor) }))
        const dibujo = tieneDibujo(c)
        const especificaciones = conTexto(c.especificaciones)
        const ventajas = conTexto(c.ventajas)
        const columnas = [especificaciones.length > 0, ventajas.length > 0].filter(Boolean).length

        return (
          <>
            <style>{ESTILOS}</style>

            <div className="hm folleto doc-hoja">
              <div className="hm-franja" aria-hidden="true" />

              <header className="hm-cabecera">
                <LogoHoja />
                {c.folleto_tipo && <span className="hm-tipo">{c.folleto_tipo}</span>}
              </header>

              <h1 className="hm-titular" style={{ fontSize: 52 }}>
                {(c.folleto_titular ?? '').split('\n').map((renglon, i, todos) => (
                  <span key={i}>
                    {renglon}
                    {i < todos.length - 1 && <br />}
                  </span>
                ))}
              </h1>
              {c.folleto_bajada && <p className="hm-bajada">{c.folleto_bajada}</p>}

              {fotos.length > 0 && (
                <div className={`fotos ${fotos.length === 1 ? 'una' : ''}`}>
                  {fotos.map(({ url, encuadre }) => (
                    <img key={url} src={url} alt={c.folleto_titular} style={{ objectPosition: encuadre }} />
                  ))}
                </div>
              )}

              {dibujo && (
                <>
                  <div className="hm-seccion">
                    <span className="hm-rotulo">Medidas</span>
                  </div>
                  <DibujoDelProducto
                    contenido={c}
                    producto={producto}
                    className="dimensiones"
                    alt={`Dibujo con medidas: ${c.folleto_titular}`}
                  />
                </>
              )}

              {columnas > 0 && (
                <div className={`dos ${columnas === 1 ? 'una' : ''}`} style={{ marginTop: 22 }}>
                  {especificaciones.length > 0 && (
                    <div>
                      <p className="hm-rotulo" style={{ marginBottom: 6 }}>Especificaciones</p>
                      <table>
                        <tbody>
                          {especificaciones.map((fila, i) => (
                            <tr key={i}>
                              <td className="apagado">{fila.clave}</td>
                              <td style={{ fontWeight: 600 }}>{fila.valor}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {ventajas.length > 0 && (
                    <div>
                      <p className="hm-rotulo" style={{ marginBottom: 10 }}>Por qué conviene</p>
                      <ul className="hm-lista">
                        {ventajas.map((ventaja) => (
                          <li key={ventaja}>{ventaja}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Cuando sale el contacto de la empresa el rótulo tiene que
                  decirlo: «Contacto del vendedor» arriba del teléfono general
                  sería una promesa que el papel no cumple. */}
              <p className="hm-rotulo" style={{ margin: '28px 0 -14px' }}>
                {contacto.esEmpresa ? 'Pedí tu presupuesto' : 'Contacto del vendedor'}
              </p>
              <PieContacto contacto={contacto} />
            </div>
          </>
        )
      }}
    </DocSheet>
  )
}
