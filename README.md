# TODOCOPIAS · Centro de operaciones

Pizarra operativa en tiempo real del local. La especificación completa está en
[docs/ESPECIFICACION.md](docs/ESPECIFICACION.md) y los cambios acordados en
[docs/DECISIONES.md](docs/DECISIONES.md).

## Requisitos

- Node.js 24 o superior (trae SQLite y ejecuta TypeScript sin compilar)

## Instalación

```bash
npm install
npx playwright install chromium   # solo para las pruebas de punta a punta
```

## Uso

```bash
npm run dev
```

Levanta el servidor de datos y la app. En esta PC: http://localhost:5173.
Desde el iPad o el monitor: la dirección "Network" que aparece en la consola
(por ejemplo `http://192.168.0.208:5173`), dentro de la red del local.

En la matriz:

- **Crear una tarea:** tecla `N` (en la PC) o el botón `+` casi transparente
  abajo al centro (en el celular, abajo a la derecha).
- **Ver y editar una tarea:** tocar su globo. Las subtareas se guardan al
  momento; el resto, con "Guardar cambios".
- Las personas del equipo se agregan con "+ Persona" dentro del formulario.

Con datos de demostración (solo en desarrollo, no se guardan):
http://localhost:5173/?demo y http://localhost:5173/?demo=muchas.

## Datos (prototipo local)

- Base SQLite en `datos/operaciones.db` (no se sube al repositorio).
- Esquema en `server/migraciones/`, aplicado automáticamente al arrancar.
  Al crear la base se cargan las categorías y la configuración por defecto.
- Reglas automáticas e historial: `server/reglas.ts` y `server/servicio.ts`
  (`estado_anterior`, `terminada_at`, `entregada_at`, autoría, responsables de
  subtareas). La persona activa viaja en el encabezado `x-persona-id`.
- Configuración opcional en `.env.local` (ver `.env.example`).
- API (`server/app.ts`): `GET /api/matriz`, `GET /api/catalogos`,
  `GET /api/clientes?telefono=`, `POST /api/personas`, `POST /api/tareas`,
  `GET|PATCH /api/tareas/:id`, `POST /api/tareas/:id/subtareas`,
  `PATCH|DELETE /api/subtareas/:id`. Todo lo que llega se valida en
  `server/validar.ts`.

## Comandos

| Comando            | Qué hace                                                  |
| ------------------ | --------------------------------------------------------- |
| `npm run dev`      | Servidor de datos + app web, con recarga automática       |
| `npm run servidor` | Solo el servidor de datos                                 |
| `npm run build`    | Chequeo de tipos + build de producción en `dist/`         |
| `npm test`         | Pruebas unitarias, de componentes y del servidor (Vitest) |
| `npm run test:e2e` | Pruebas de punta a punta (Playwright, escritorio + iPad)  |
| `npm run lint`     | ESLint                                                    |
| `npm run format`   | Prettier                                                  |

## Estructura

Todo el código del módulo vive en `src/modules/centro-operaciones/`, pensado para
integrarse más adelante como módulo de la suite todo-herramientas:

- Los estilos están acotados a `.co-app`; Tailwind se usa **sin reset global** y
  con prefijo `co` (las utilidades se escriben `co:flex`, `co:text-white`).
- Los tokens de marca son variables CSS `--co-*` (`styles/tokens.css`).
- La app accede a los datos solo por `lib/api.ts`.
- `src/main.tsx` y `src/standalone.css` son solo para correr la app suelta.
- `server/`: servidor local de datos (prototipo).

## Más adelante: Supabase

Proyecto creado y sin uso: `todocopias-operaciones` (`sa-east-1`). Su esquema,
con RLS y triggers equivalentes a las reglas locales, está en
`supabase/migrations/` y `supabase/seed.sql`. `npm run verificar:acceso`
comprueba que sin sesión no se puede leer nada (usa `VITE_SUPABASE_URL` y
`VITE_SUPABASE_PUBLISHABLE_KEY` de `.env.local`).
