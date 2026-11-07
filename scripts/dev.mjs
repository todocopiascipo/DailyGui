// Levanta juntos el servidor local (datos) y la app web (Vite) para desarrollo.
// Si uno de los dos se cae, se detiene el otro.
import { spawn } from 'node:child_process'

// Configuración opcional (ver .env.example). Las variables ya definidas tienen prioridad.
try {
  process.loadEnvFile('.env.local')
} catch {
  // Sin .env.local se usan los valores por defecto.
}

const procesos = [
  spawn(process.execPath, ['--watch', 'server/index.ts'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
]

let cerrando = false
function cerrarTodo(codigo = 0) {
  if (cerrando) return
  cerrando = true
  for (const p of procesos) if (p.exitCode === null) p.kill()
  process.exit(codigo)
}

for (const p of procesos) p.on('exit', (codigo) => cerrarTodo(codigo ?? 0))
process.on('SIGINT', () => cerrarTodo(0))
process.on('SIGTERM', () => cerrarTodo(0))
