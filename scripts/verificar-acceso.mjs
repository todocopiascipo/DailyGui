// Verifica que, sin iniciar sesión, la API de Supabase no deja leer ni escribir nada.
// Uso: npm run verificar:acceso   (lee VITE_SUPABASE_URL y la clave de .env.local)
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const url = env.VITE_SUPABASE_URL
const clave = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !clave) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en .env.local')
  process.exit(1)
}

const tablas = [
  'personas',
  'clientes',
  'categorias',
  'proyectos',
  'tareas',
  'tarea_responsables',
  'subtareas',
  'eventos',
  'configuracion',
]
const headers = { apikey: clave, 'Content-Type': 'application/json' }
let fallas = 0

for (const tabla of tablas) {
  const lectura = await fetch(`${url}/rest/v1/${tabla}?select=*&limit=1`, { headers })
  const escritura = await fetch(`${url}/rest/v1/${tabla}`, {
    method: 'POST',
    headers,
    body: '{}',
  })
  const ok = !lectura.ok && !escritura.ok
  if (!ok) fallas++
  console.log(
    `${ok ? 'OK   ' : 'FALLA'} ${tabla.padEnd(20)} lectura ${lectura.status} · escritura ${escritura.status}`,
  )
}

// Funciones internas tampoco deben poder llamarse.
const rpc = await fetch(`${url}/rest/v1/rpc/es_cuenta_local`, {
  method: 'POST',
  headers,
  body: '{}',
})
console.log(`${rpc.ok ? 'FALLA' : 'OK   '} rpc es_cuenta_local   ${rpc.status}`)
if (rpc.ok) fallas++

if (fallas) {
  console.error(`\n${fallas} verificación(es) fallaron: hay datos accesibles sin sesión.`)
  process.exit(1)
}
console.log('\nSin sesión no se puede leer ni escribir nada.')
