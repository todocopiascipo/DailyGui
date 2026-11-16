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

En la matriz (solo tareas; las órdenes de trabajo van aparte):

- **Cuadrantes**, de izquierda a derecha y de arriba a abajo: Importante y
  urgente · Importante y no urgente · No importante y urgente · No importante y
  no urgente.
- **Tarea:** tecla `N` o el botón `+` casi transparente abajo al centro (en el
  celular, abajo a la derecha). Título, responsables, entrega, **importancia y
  urgencia con dos sliders de 0 a 10** (de 6 en adelante es "sí"; el formulario
  muestra a qué cuadrante va), categoría y, si es para un pedido, la orden de
  trabajo relacionada. La urgencia es la que se elige: la fecha de entrega no la
  cambia (solo se marca "vence hoy" o "vencida"). Dentro de cada cuadrante,
  arriba las de mayor importancia + urgencia.
- **Orden de trabajo (pedido):** tecla `O` o el botón `OT`, al lado del `+`.
  Tiene la forma de la OT de papel (sin importancia ni urgencia); la primera
  línea del detalle es el título y las fechas van al final.
- **Órdenes de trabajo (espacio propio):** el selector de abajo, junto al `+`,
  cambia entre "Tareas" (la matriz) y "Órdenes de trabajo": las OT abiertas
  colgadas como comandas (detalle, nombre, entrega, debe y avance de sus
  tareas). Tocar una la abre: a la izquierda la OT completa, a la derecha sus
  tareas (tocar una abre su detalle) y "Nueva tarea" (ya relacionada con esa
  OT). Arriba: Terminar, Entregada, Devolver, Copiar mensaje, Copiar teléfono y
  Editar. Al marcarla Entregada deja de estar colgada.
- **Tareas encadenadas (diagrama de flujo):** en la OT abierta, las tareas van
  en columnas: 1.º orden = se pueden hacer ya; 2.º, 3.º… = esperan a otras
  (flechas de la previa a la siguiente). Para encadenar: arrastrar una tarea y
  mantenerla encima de la que tiene que esperar hasta que se llene la barra
  (unos 2 segundos); soltar antes cancela. También desde el detalle de la tarea
  ("Espera a": agregar de una lista o quitar con ✕). Solo entre tareas de la
  misma OT y sin círculos. En la matriz, la que espera se ve atenuada con
  "Espera a: …" hasta que se termine la anterior.
- **Mover de cuadrante:** arrastrar el globo (en el iPad, mantener presionado y
  arrastrar). Cada nivel se ajusta lo mínimo para quedar del lado correcto (por
  ejemplo, urgencia 3 → 6). Para eliminar, soltarlo en el tacho que aparece abajo; se puede
  recuperar desde Configuración (engranaje abajo a la derecha) › Papelera
  durante 30 días. Después se borra solo.
- **Ver y editar una tarea:** tocar su globo. Las subtareas se guardan al
  momento; el resto, con "Guardar cambios".
- Las personas del equipo se agregan con "+ Persona" dentro del formulario.
- **Terminar:** desde el menú de tres puntitos de cada globo (o el detalle): la
  tarea pasa a "Hechas hoy". Las órdenes de trabajo se terminan, se entregan y
  tienen "Copiar mensaje" (WhatsApp) y "Copiar teléfono" en su detalle.
- **¿Quién soy?:** abajo a la izquierda. Cada dispositivo recuerda quién lo
  usa; lo que se hace queda a su nombre en el historial. Con el ojo se
  resaltan sus tareas, y "Mis tareas" muestra qué hacer ahora, la línea del
  día y el paso a paso. El PIN es opcional.
- **Herramientas (borde izquierdo):** acercando el mouse al borde izquierdo,
  con la pestaña casi transparente de ese borde o deslizando desde el borde
  (iPad): crear tarea, OT, ¿Quién soy?, Mis tareas, Hechas hoy,
  Historial y Configuración.
- **Historial:** todo lo que pasó, quién y cuándo. Se busca por texto y se
  filtra por persona, por fechas o por tarea (tocando su nombre).
- **Configuración** (engranaje abajo a la derecha): personas, categorías,
  dónde va cada cuadrante, confeti y mensaje, papelera (y cuántos días guarda) y
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
  `GET /api/hechas?desde=`, `GET /api/pedidos` (órdenes de trabajo abiertas, con avance), `GET /api/pedidos/:id/tareas`,
  `POST /api/tareas/:id/dependencias`, `DELETE /api/tareas/:id/dependencias/:otra`,
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

## Variables de entorno

Todas son opcionales para desarrollar (ver `.env.example`; se copian a
`.env.local`, que no se sube al repositorio).

| Variable                         | Para qué                                                             |
| -------------------------------- | -------------------------------------------------------------------- |
| `CO_DB_RUTA`                     | Base local SQLite (por defecto `datos/operaciones.db`)               |
| `CO_PUERTO_WEB`, `CO_PUERTO_API` | Puertos de la app y del servidor local (5173 y 5174)                 |
| `CO_BASE`                        | Carpeta donde se publica (`/DailyGui/` en GitHub Pages; `/` si no)   |
| `VITE_CO_BACKEND`                | `supabase` para que el build use Supabase (si no, el servidor local) |
| `VITE_SUPABASE_URL`              | Dirección del proyecto de Supabase                                   |
| `VITE_SUPABASE_PUBLISHABLE_KEY`  | Clave **publicable** de Supabase (hecha para el navegador)           |

Nunca se usa la clave `service_role` en la app.

## Desplegar

**Hoy:** GitHub Pages, automático en cada push a `main` (ver "App publicada").

**Vercel (listo, sin desplegar):** cuando se decida, en Vercel se importa el
repositorio y se configura:

- Framework: Vite · Build: `npm run build` · Salida: `dist` · Node 24.
- Variables: `VITE_CO_BACKEND=supabase`, `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_PUBLISHABLE_KEY` (las mismas del workflow de GitHub Pages).
  `CO_BASE` no hace falta (la app queda en la raíz).
- `vercel.json` ya indica todo eso y que `sw.js` no se guarde en caché.
- El acceso sigue siendo por link secreto: el link nuevo es la dirección de
  Vercel con el mismo `#acceso=…` (abrirlo una vez en cada dispositivo).

## Respaldo

Configuración › Respaldo › **Exportar respaldo** descarga un archivo
`todocopias-respaldo-AAAA-MM-DD.json` con todas las tablas (personas, clientes,
categorías, tareas, responsables, subtareas, historial y
configuración). Los PIN no se incluyen. Conviene guardarlo una vez por semana
fuera de la PC (por ejemplo, en Drive).

## Ícono de la app

El ícono actual es **provisorio** (fondo de marca con los cuatro cuadrantes; no
es el logo). Cuando esté el SVG blanco de TODOCOPIAS: reemplazar
`public/iconos/icono.svg` y correr `node scripts/iconos.mjs` para regenerar los
PNG.

## Accesibilidad y rendimiento

- `e2e/accesibilidad.spec.ts` revisa con axe la matriz, los formularios, el
  detalle, Configuración e Historial: sin problemas serios ni
  críticos (WCAG 2.1 AA).
- Carga inicial: unos 100 kB de código comprimido más estilos y fuentes.
  Historial, Mis tareas y Configuración se cargan recién al abrirlos.
