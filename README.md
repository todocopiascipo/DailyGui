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

- **Tarea interna:** tecla `N` o el botón `+` casi transparente abajo al
  centro (en el celular, abajo a la derecha). Formulario simple: título,
  responsables, entrega, importante, urgente (sí, no o según la fecha),
  categoría y, si es para un pedido, la orden de trabajo relacionada.
- **Orden de trabajo (pedido):** tecla `O` o el botón `OT`, al lado del `+`.
  Tiene la forma de la OT de papel; la primera línea del detalle es el título
  y las fechas van al final.
- **Mover de cuadrante:** arrastrar el globo (en el iPad, mantener presionado y
  arrastrar). Para eliminar, soltarlo en el tacho que aparece abajo; se puede
  recuperar desde Configuración (engranaje abajo a la derecha) › Papelera
  durante 30 días. Después se borra solo.
- **Ver y editar una tarea:** tocar su globo. Las subtareas se guardan al
  momento; el resto, con "Guardar cambios".
- Las personas del equipo se agregan con "+ Persona" dentro del formulario.
- **Terminar y entregar:** desde el menú de tres puntitos de cada globo (o el
  detalle). Al terminar, la tarjeta queda azul con el botón "Entregada"; al
  entregarla, sale de la matriz. El menú también tiene "Devolver al estado
  anterior", "Copiar mensaje" (para WhatsApp) y "Copiar teléfono".
- **¿Quién soy?:** abajo a la izquierda. Cada dispositivo recuerda quién lo
  usa; lo que se hace queda a su nombre en el historial. Con el ojo se
  resaltan sus tareas, y "Mis tareas" muestra qué hacer ahora, la línea del
  día y el paso a paso. El PIN es opcional.
- **Proyectos:** botón "Proyectos" abajo a la izquierda. Lista de proyectos
  internos con estado, responsable, fecha objetivo y avance; dentro de cada uno,
  sus datos, sus tareas (nueva, abrir, terminar, subir o bajar) e historial.
  Una tarea de proyecto aparece en la matriz sola cuando tiene fecha de entrega
  o está en proceso; el botón de cuadrícula ("Mostrar en la matriz") lo cambia
  a mano. Con el "+", el proyecto se elige en "Más datos".
- **Herramientas (borde izquierdo):** acercando el mouse al borde izquierdo,
  con la pestaña casi transparente de ese borde o deslizando desde el borde
  (iPad): crear tarea, OT, ¿Quién soy?, Mis tareas, Proyectos, Hechas hoy,
  Historial y Configuración.
- **Historial:** todo lo que pasó, quién y cuándo. Se busca por texto y se
  filtra por persona, por fechas o por tarea (tocando su nombre).
- **Configuración** (engranaje abajo a la derecha): personas, categorías,
  urgencia y cuadrantes, confeti y mensaje, papelera (y cuántos días guarda) y
  **Exportar respaldo** (descarga un archivo con todo, sin los PIN).
- **Modo pantalla (monitor):** abrir la app con `?modo=pantalla` al final de
  la dirección (o Configuración › Este dispositivo). Letra más grande, pantalla
  siempre encendida, cursor oculto y vuelve sola a la matriz si nadie la toca.
  `?modo=normal` lo apaga.
- **Instalarla (PWA):** en el iPad, desde Safari: Compartir › Agregar a
  inicio. En la PC (Chrome o Edge): el ícono de instalar en la barra de
  direcciones. En el iPad instalado, la primera vez pide pegar el link de
  acceso (no comparte lo guardado con Safari).
- **Notificaciones:** Configuración › Este dispositivo › Activar
  notificaciones. Avisan con la app abierta: tarea asignada, se entrega hoy y
  vencida. En el iPad, solo con la app instalada.
- **Hechas hoy:** acercando el mouse al borde derecho (o la pestaña del borde
  en el iPad): lo terminado y lo entregado en el día, con "Devolver".
- **Tiempo real:** lo que se guarda en un dispositivo aparece en los demás en
  menos de un segundo. Si se corta la conexión con la PC del local aparece
  "Sin conexión · reconectando" abajo a la izquierda y no se puede guardar
  hasta que vuelva; al volver, todo se actualiza solo.

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
- Tiempo real: `GET /api/cambios` (Server-Sent Events, `server/canal.ts`)
  avisa cada cambio a las pantallas abiertas, con un latido cada 5 s.
- API (`server/app.ts`): `GET /api/matriz`, `GET /api/catalogos`,
  `GET /api/clientes?telefono=`, `POST /api/personas`,
  `POST /api/personas/:id/verificar`, `PUT /api/personas/:id/pin`,
  `GET /api/personas/:id/tareas`, `POST /api/tareas`,
  `GET|PATCH /api/tareas/:id`, `POST /api/tareas/:id/subtareas`,
  `PATCH|DELETE /api/subtareas/:id`, `GET /api/papelera`,
  `POST /api/tareas/:id/eliminar|restaurar|terminar|entregar|devolver`,
  `GET /api/hechas?desde=`, `GET|POST /api/proyectos`,
  `GET|PATCH|DELETE /api/proyectos/:id`, `PUT /api/proyectos/:id/orden`,
  `GET /api/personas`, `PATCH /api/personas/:id`, `PUT /api/personas/orden`,
  `GET|POST /api/categorias`, `PATCH /api/categorias/:id`,
  `PUT /api/categorias/orden`, `GET /api/historial?persona=&tarea=&desde=&hasta=&texto=&antes=`,
  `GET /api/respaldo`,
  `PUT /api/configuracion/:clave` (confeti y
  plantilla), `DELETE /api/tareas/:id` (solo
  desde la papelera). Todo lo que llega se valida en
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

## App publicada (Supabase + GitHub Pages)

- Dirección: https://todocopiascipo.github.io/DailyGui/ . Cada push a `main`
  corre las pruebas y, si pasan, publica (`.github/workflows/publicar.yml`).
- Datos en Supabase (`todocopias-operaciones`, `sa-east-1`). La app llama a
  funciones `public.co_*` equivalentes a cada ruta del servidor local
  (`lib/rutasSupabase.ts`); el tiempo real llega por el canal `co-cambios`.
  Esquema y funciones en `supabase/migrations/`.
- **Acceso por link secreto** (sin pantalla de ingreso): cada dispositivo abre
  una vez `https://todocopiascipo.github.io/DailyGui/#acceso=CLAVE`; la clave
  queda guardada en ese navegador y desaparece de la barra de direcciones.
  La base guarda solo su hash (`privado.claves_acceso`). Sin la clave no se
  puede leer ni escribir nada. La clave nunca va al repositorio.
- **Cambiar la clave** (por ejemplo, si el link se compartió de más): generar
  una nueva, agregar su hash sha256 a `privado.claves_acceso` y poner
  `activa = false` en la anterior. Cada dispositivo vuelve a abrir el link nuevo.
- La clave "publicable" de Supabase del workflow está hecha para ir en el
  navegador; la `service_role` nunca se usa en la app.
- `npm run verificar:acceso` comprueba que sin la clave no se puede leer nada
  (usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` de `.env.local`).
