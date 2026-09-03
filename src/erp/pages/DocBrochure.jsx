/**
 * El folleto de una hoja, el que se deja en el mostrador.
 *
 * Reemplaza a `docs/folleto_recu_varilla.html`. Aquel archivo ya tenía el
 * bloque «Contacto del vendedor», pero con datos de ejemplo que había que
 * completar a mano en cada copia; el resultado previsible era que la mitad de
 * los folletos se repartieran diciendo «Nombre y Apellido · 011 0000-0000».
 * Acá el vendedor se elige de una lista y el bloque sale lleno.
 *
 * Las dos fotos salían embebidas en el archivo, que por eso pesaba medio mega.
 * Ahora son archivos en `public/docs/` y el navegador las cachea.
 */
import { documentoPorTipo } from '../lib/documentos'
import DocSheet from '../components/DocSheet'

const ESPECIFICACIONES = [
  ['Largo', '120 cm'],
  ['Sección', '3 x 3 cm'],
  ['Peso aproximado', '1.000 g'],
  ['Material', 'Polipropileno (PP) reciclado de descarte industrial'],
  ['Protección UV', 'Sí, estabilizante UV incorporado'],
  ['Agujereado', 'Opcional, a pedido'],
  ['Presentación', 'Packs de 10 unidades · mínimo 10 packs'],
  ['Flete', 'A cargo del comprador, despacho desde Luján'],
]

const VENTAJAS = [
  'Resistente a la humedad',
  'No lo atacan insectos',
  'Resistente al sol',
  'Cero mantenimiento',
  'Reemplazo directo del poste de madera',
  'Descuentos por volumen',
]

const ESTILOS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Work+Sans:wght@400;600&display=swap');

.folleto {
  --verde-oscuro: #33502e;
  --verde-claro: #6b8a4f;
  --marron: #8a5a34;
  --gris: #4a4a44;
  --crema: #f7f5ef;
  max-width: 800px;
  margin: 0 auto;
  background: var(--crema);
  border: 2px solid var(--verde-oscuro);
  font-family: 'Work Sans', system-ui, sans-serif;
  color: var(--gris);
}
.folleto header {
  background: var(--verde-oscuro);
  color: var(--crema);
  padding: 16px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.folleto .header-left { display: flex; align-items: center; gap: 12px; }
.folleto .logo { height: 56px; width: auto; display: block; }
.folleto h1 {
  font-family: 'Oswald', 'Trebuchet MS', sans-serif;
  margin: 0;
  font-size: 28px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.folleto header .lema { font-size: 13px; opacity: 0.85; }
.folleto .cuerpo { padding: 24px 28px; }
.folleto .fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.folleto .fotos img {
  width: 100%;
  height: 240px;
  object-fit: cover;
  border: 2px solid var(--verde-claro);
  display: block;
}
.folleto .fotos img.en-uso { object-position: center 85%; }
.folleto h2 {
  font-family: 'Oswald', 'Trebuchet MS', sans-serif;
  color: var(--verde-oscuro);
  text-transform: uppercase;
  font-size: 16px;
  letter-spacing: 0.5px;
  border-bottom: 2px solid var(--verde-claro);
  padding-bottom: 6px;
  margin: 24px 0 12px;
}
.folleto .cuerpo > h2:first-of-type { margin-top: 0; }
.folleto table { width: 100%; border-collapse: collapse; font-size: 14px; }
.folleto td { padding: 8px 6px; border-bottom: 1px solid #ddd6c4; }
.folleto td:first-child { font-weight: 600; color: var(--verde-oscuro); width: 45%; }
.folleto ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 14px;
}
.folleto li { padding-left: 18px; position: relative; }
.folleto li::before { content: "●"; color: var(--marron); position: absolute; left: 0; }
.folleto .contacto {
  background: var(--verde-claro);
  color: var(--crema);
  padding: 18px 28px;
}
.folleto .contacto h2 {
  font-family: 'Oswald', sans-serif;
  font-size: 16px;
  text-transform: uppercase;
  margin: 0 0 10px;
  color: var(--crema);
  border: none;
  padding: 0;
}
.folleto .contacto-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 20px;
  font-size: 14px;
}
.folleto .contacto-grid span {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  opacity: 0.8;
  margin-bottom: 2px;
}

@media (max-width: 520px) {
  .folleto .fotos, .folleto ul, .folleto .contacto-grid { grid-template-columns: 1fr; }
}
`

export default function DocBrochure() {
  const doc = documentoPorTipo('folleto')

  return (
    <DocSheet doc={doc}>
      {(contacto) => (
        <>
          <style>{ESTILOS}</style>

          <div className="folleto doc-hoja">
            <header>
              <div className="header-left">
                <img className="logo" src="/docs/folleto-logo.png" alt="" />
                <h1>Recu-Varilla</h1>
              </div>
              <span className="lema">Varillas plásticas para alambrado rural</span>
            </header>

            <div className="cuerpo">
              <div className="fotos">
                <img src="/docs/folleto-apiladas.jpg" alt="Varillas Recuvarilla apiladas" />
                <img
                  className="en-uso"
                  src="/docs/folleto-en-uso.jpg"
                  alt="Varillas Recuvarilla puestas en un alambrado"
                />
              </div>

              <h2>Especificaciones técnicas</h2>
              <table>
                <tbody>
                  {ESPECIFICACIONES.map(([clave, valor]) => (
                    <tr key={clave}>
                      <td>{clave}</td>
                      <td>{valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2>Ventajas</h2>
              <ul>
                {VENTAJAS.map((ventaja) => (
                  <li key={ventaja}>{ventaja}</li>
                ))}
              </ul>
            </div>

            <div className="contacto">
              {/* Cuando sale el contacto de la empresa el rótulo tiene que
                  decirlo: «Contacto del vendedor» arriba del teléfono general
                  sería una promesa que el papel no cumple. */}
              <h2>{contacto.esEmpresa ? 'Contacto' : 'Contacto del vendedor'}</h2>
              <div className="contacto-grid">
                <div>
                  <span>Nombre</span>
                  {contacto.nombre}
                </div>
                <div>
                  <span>Teléfono / WhatsApp</span>
                  {contacto.telefono}
                </div>
                <div>
                  <span>Localidad</span>
                  {contacto.localidad}
                </div>
                <div>
                  <span>Email</span>
                  {contacto.email}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </DocSheet>
  )
}
