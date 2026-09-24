/**
 * El campo «Localidad»: se elige de lo ya cargado o se escribe una nueva.
 *
 * Un desplegable cerrado no sirve —el padrón argentino tiene miles de
 * localidades y siempre aparece una que no está— y el texto libre solo tampoco:
 * así entran "Rosario", "rosario" y "Rosario " como tres lugares distintos, y
 * después no hay forma de ver quién está cerca de quién.
 *
 * Un `<datalist>` hace las dos cosas: propone lo que ya existe y deja escribir
 * cualquier otra cosa. Es HTML, no un componente que haya que mantener.
 *
 * Y de paso contesta la pregunta por la que uno mira esa lista: **cuánta gente
 * hay ya en ese lugar**. Ahí es donde aparece un viaje para compartir.
 */
import { useId } from 'react'
import { clave } from '../api/shipping'
import { Field, Input } from './ui'

/** "3 clientes y 1 lead", sin las combinaciones que no aportan. */
function cuantos(fila) {
  const partes = []
  if (fila.clientes > 0) {
    partes.push(`${fila.clientes} ${fila.clientes === 1 ? 'cliente' : 'clientes'}`)
  }
  if (fila.leads > 0) {
    partes.push(`${fila.leads} ${fila.leads === 1 ? 'lead' : 'leads'}`)
  }
  return partes.join(' y ')
}

export default function LocalidadField({
  value,
  onChange,
  provincia,
  localidades = [],
  label = 'Localidad',
}) {
  /* El `id` del `datalist` tiene que ser único en la página: este campo aparece
     en más de un formulario y dos listas con el mismo id se pisan. */
  const id = useId()
  const claveProvincia = clave(provincia)

  /*
    Con una provincia elegida se ofrecen sólo las de ahí. Es lo que hace que la
    lista sirva: hay una San Martín en varias provincias, y mezcladas no se sabe
    cuál se está eligiendo. Sin provincia se ofrecen todas, porque el orden en
    que se completa el formulario lo elige quien carga, no esta lista.
  */
  const opciones = claveProvincia
    ? localidades.filter((fila) => fila.provincia_clave === claveProvincia)
    : localidades

  const actual = opciones.find((fila) => fila.clave === clave(value))
  const escrito = String(value ?? '').trim()

  return (
    <Field
      label={label}
      hint={
        actual
          ? `En ${actual.localidad} ya hay ${cuantos(actual)}.`
          : escrito
            ? 'Localidad nueva: no hay nadie cargado ahí todavía.'
            : opciones.length > 0
              ? `Elegí una de las ${opciones.length} donde ya hay gente, o escribí una nueva.`
              : 'Escribila como vaya a quedar: después se ofrece sola.'
      }
    >
      <Input
        value={value}
        onChange={onChange}
        list={id}
        /* El autocompletado del navegador taparía la lista con direcciones
           viejas de quien esté usando la máquina. */
        autoComplete="off"
        placeholder="Rosario"
      />
      <datalist id={id}>
        {opciones.map((fila) => (
          <option
            key={`${fila.clave}|${fila.provincia_clave}`}
            value={fila.localidad}
            /* Lo que el navegador muestra al costado del nombre. Cuánto de esto
               se ve depende del navegador, así que lo que de verdad importa
               —cuánta gente hay— se repite abajo del campo, donde se ve
               siempre. */
            label={
              claveProvincia
                ? cuantos(fila)
                : [fila.provincia, cuantos(fila)].filter(Boolean).join(' · ')
            }
          />
        ))}
      </datalist>
    </Field>
  )
}
