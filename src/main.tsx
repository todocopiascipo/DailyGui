// Entrada independiente para desarrollo local.
// Cuando se integre a todo-herramientas, la suite importará directamente
// el componente del módulo (src/modules/centro-operaciones).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './standalone.css'
import { CentroOperaciones } from './modules/centro-operaciones'

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el elemento #root')

createRoot(root).render(
  <StrictMode>
    <CentroOperaciones />
  </StrictMode>,
)

// App instalable (PWA): solo en el build publicado (en desarrollo molestaría
// con archivos guardados viejos).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
