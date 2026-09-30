import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Las fuentes del manual, servidas desde el propio sitio (sin Google Fonts).
// La variable de Archivo trae el eje de ancho: la condensada de los
// titulares y el texto normal salen del mismo archivo.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/chivo-mono/500.css'
import '@fontsource/chivo-mono/600.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
