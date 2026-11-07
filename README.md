# TODOCOPIAS · Centro de operaciones

Pizarra operativa en tiempo real del local. La especificación completa está en
[docs/ESPECIFICACION.md](docs/ESPECIFICACION.md).

## Requisitos

- Node.js 20 o superior

## Instalación

```bash
npm install
npx playwright install chromium   # solo para las pruebas de punta a punta
```

## Variables de entorno

Copiá `.env.example` como `.env.local` y completá los datos del proyecto Supabase
dedicado. `.env.local` nunca se sube al repositorio.

## Comandos

| Comando            | Qué hace                                                 |
| ------------------ | -------------------------------------------------------- |
| `npm run dev`      | Servidor local en http://localhost:5173                  |
| `npm run build`    | Chequeo de tipos + build de producción en `dist/`        |
| `npm test`         | Pruebas unitarias y de componentes (Vitest)              |
| `npm run test:e2e` | Pruebas de punta a punta (Playwright, escritorio + iPad) |
| `npm run lint`     | ESLint                                                   |
| `npm run format`   | Prettier                                                 |

| `npm run verificar:acceso` | Comprueba que sin sesión la API no deja leer ni escribir nada |

## Base de datos (Supabase)

Proyecto dedicado `todocopias-operaciones`, región `sa-east-1` (São Paulo).

- El esquema se crea **solo** con las migraciones de `supabase/migrations/`
  (nunca cambios a mano en el panel). La semilla está en `supabase/seed.sql`.
- Después de cada migración, regenerar
  `src/modules/centro-operaciones/lib/database.types.ts`.
- **Acceso:** solo la cuenta compartida del local, registrada en
  `privado.cuentas_local`. Sin sesión (o con otra cuenta) no se ve nada.
- **Historial:** lo escriben automáticamente los triggers. El frontend manda la
  persona activa en el encabezado HTTP `x-persona-id` y, opcionalmente,
  `x-co-accion` (`movida_cuadrante` o `devuelta`).
- **Reglas automáticas en la base:** `estado_anterior`, `terminada_at`,
  `entregada_at`, autoría (`creada_por`, `actualizada_por`, `eliminada_por`) y
  el responsable de una subtarea se suma a los de la tarea.
- El hash del PIN vive en `privado.personas_pin`, fuera del alcance de la API.

## Estructura

Todo el código del módulo vive en `src/modules/centro-operaciones/`, pensado para
integrarse más adelante como módulo de la suite todo-herramientas:

- Los estilos están acotados a `.co-app`; Tailwind se usa **sin reset global** y
  con prefijo `co` (las utilidades se escriben `co:flex`, `co:text-white`).
- Los tokens de marca son variables CSS `--co-*` (`styles/tokens.css`).
- `src/main.tsx` y `src/standalone.css` son solo para correr la app suelta.
