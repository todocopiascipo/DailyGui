# TODOCOPIAS · Centro de operaciones — contexto para Claude Code

Este archivo lo lee Claude Code al abrir el proyecto: resume lo acordado con el
usuario en las sesiones anteriores para poder seguir desde cualquier PC.

## Qué es

Pizarra operativa en tiempo real (matriz de Eisenhower) para la imprenta
TODOCOPIAS. Especificación completa: `docs/ESPECIFICACION.md` (la fuente de
verdad). Cambios acordados con el usuario: `docs/DECISIONES.md` (leerlo antes
de tocar algo: ahí está todo lo que se decidió y por qué).

## Cómo trabajar con el usuario

- Escribir en **español rioplatense**, simple: el usuario no es programador.
- Trabajar **por fases** (sección 14 de la especificación) y **esperar su
  aprobación** al terminar cada una. No improvisar funciones ni inventar datos
  del negocio (nombres, precios, dirección, horarios, textos comerciales).
- Al final de cada fase: pruebas en verde, documentación al día, un commit con
  el detalle de lo hecho y **push a `main`** de
  https://github.com/todocopiascipo/DailyGui (pedido del usuario: lo sigue desde
  la PC del trabajo). El repo es **público**: nunca subir claves ni datos
  (`.env.local` y `datos/` están en `.gitignore`).
- Le gusta **ver el progreso en vivo**: dejar corriendo `npm run dev` (vista
  previa) y pasarle las direcciones (local y de la red).
- Para revisar algo visualmente sin tocar sus datos, usar una copia aparte con
  la base en memoria: `CO_PUERTO_WEB=5190 CO_PUERTO_API=5191 CO_DB_RUTA=:memory: node scripts/dev.mjs`.
- No desplegar. Supabase (`todocopias-operaciones`, sa-east-1) está creado y
  **sin uso** hasta terminar el prototipo. No tocar los otros proyectos de
  Supabase/Vercel del usuario (fidelizacion, todocopiascipo's Project,
  todo-herramientas).

## Estado (al 2026-11-10)

Hechas: Fases 0–7 y los pedidos extra del usuario (ver `docs/DECISIONES.md`):
matriz, crear/editar, tiempo real, arrastrar y soltar con tacho y papelera,
OT con forma de la de papel, terminar/entregar/devolver, "Hechas hoy",
"Copiar mensaje", "¿Quién soy?" con PIN, "Mis tareas"; "+" = tareas internas
simples con "Pedido relacionado"; "Urgente: Sí / No / Por fecha" al crear.

**Siguiente: Fase 8 — Proyectos internos.** Antes de empezar, resolver con el
usuario la decisión abierta 11 (estructura, vistas, cuándo aparecen en la
matriz). Después: Fase 9 (herramientas en los bordes, historial global,
configuración completa, exportar respaldo), 10 (modo pantalla, PWA,
notificaciones) y 11 (cierre).

Pendiente del usuario: el **logo SVG blanco** de TODOCOPIAS (no redibujarlo).

## Cómo correr

- Node 24 (trae SQLite y ejecuta TypeScript sin compilar).
- `npm install` y, para las pruebas de punta a punta, `npx playwright install chromium`.
- `npm run dev`: servidor de datos (puerto 5174) + app (5173, también por la
  red del local para el iPad). Datos reales en `datos/operaciones.db` (no se
  sube a git). `?demo` muestra datos de demostración.
- Comandos: `npm test` (Vitest), `npm run test:e2e` (Playwright, escritorio +
  iPad), `npm run lint`, `npm run format`, `npm run build`. Todo debe quedar en
  verde antes de cerrar una fase.

## Arquitectura

- `server/`: servidor local (node:http + node:sqlite). Migraciones en
  `server/migraciones/` (se aplican solas al arrancar, por `PRAGMA user_version`;
  hay que escribir también la equivalente en `supabase/migrations/`, sin
  aplicarla). Reglas e historial en `server/reglas.ts` y `server/servicio.ts`;
  validación de todo lo que llega en `server/validar.ts`; tiempo real por
  Server-Sent Events en `server/canal.ts` (`/api/cambios`).
- `src/modules/centro-operaciones/`: todo el módulo (pensado para integrarse a
  la suite todo-herramientas). La app accede a datos solo por `lib/api.ts`.
  Estilos acotados a `.co-app`, clases `co-…`, Tailwind sin reset y con
  prefijo `co` (`co:flex`). Tokens de marca en `styles/tokens.css`.
- Tipos de datos en `lib/database.types.ts` (generados de Supabase; al agregar
  columnas, actualizarlos a mano).
- Hora siempre en `America/Argentina/Buenos_Aires`, 24 h (`lib/tiempo.ts`,
  `lib/fechas.ts`).

## Pruebas: convenciones

- Las de punta a punta comparten una base en memoria y corren en paralelo:
  títulos con `unico()` y `test.afterEach(({ request }) => limpiar(request))`
  (`e2e/utiles.ts`). Crear o terminar exige persona: llamar `identificarse(page)`
  antes de `page.goto`.
- Con dos botones del mismo nombre (por ej. "Sí" de Importante y de Urgente),
  ubicar dentro de su grupo (`getByRole('radiogroup', { name: 'Importante' })`).
- Las pruebas de arrastre verifican qué globo levantaron (otras pruebas
  reacomodan la matriz en tiempo real).

## Cuidados conocidos

- `.co-app` usa `overflow: clip`: el panel escondido a la derecha corría la
  matriz al enfocar algo. No volver a `overflow: hidden` solo.
- Para atenuar o transformar globos usar `filter` o desactivar la animación:
  las animaciones con `both` pisan `opacity`/`transform`.
- Desde el iPad (http por la red del local) no existe `navigator.clipboard` ni
  `crypto.randomUUID`: ya hay alternativas en `lib/mensaje.ts` y `lib/ids.ts`.
- Nunca subir claves: `.env.local` está en `.gitignore` (tiene las claves
  públicas de Supabase para más adelante).
