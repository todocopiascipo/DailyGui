/**
 * Servidor local del prototipo: guarda los datos en SQLite en esta PC.
 * Variables: CO_DB_RUTA (por defecto datos/operaciones.db), CO_PUERTO_API (5174).
 */
import { join } from 'node:path'
import { crearServidor } from './app.ts'
import { abrirBase } from './db.ts'
import { purgarPapelera } from './servicio.ts'

const ruta = process.env.CO_DB_RUTA ?? join(process.cwd(), 'datos', 'operaciones.db')
const puerto = Number(process.env.CO_PUERTO_API ?? 5174)

const db = abrirBase(ruta)
const servidor = crearServidor(db)

// Purga de la papelera: al arrancar y cada hora (lo que pasó el plazo se borra para siempre).
function purgar() {
  try {
    const n = purgarPapelera(db)
    if (n > 0) console.log(`[servidor] papelera: ${n} tarea(s) borradas por vencimiento`)
  } catch (error) {
    console.error('[servidor] no se pudo purgar la papelera', error)
  }
}
purgar()
setInterval(purgar, 3_600_000).unref()

// Solo escucha en esta PC: los demás dispositivos entran a través de la app web.
servidor.listen(puerto, '127.0.0.1', () => {
  console.log(`[servidor] datos en ${ruta === ':memory:' ? 'memoria' : ruta}`)
  console.log(`[servidor] API en http://127.0.0.1:${puerto}/api`)
})

function cerrar() {
  servidor.close()
  db.close()
  process.exit(0)
}
process.on('SIGINT', cerrar)
process.on('SIGTERM', cerrar)
