# PROMPT MAESTRO — TODOCOPIAS · Centro de Operaciones en Tiempo Real

> Pegá este documento completo en Claude Code al iniciar el proyecto.
> Conviene guardarlo también en la raíz del repositorio como `docs/ESPECIFICACION.md` para que sea la referencia permanente.

---

## 0. Rol, forma de trabajo y reglas inquebrantables

Sos el desarrollador principal de una aplicación web para **TODOCOPIAS**, un negocio de gráfica, impresión, fotocopias, papelería y regalos empresariales. Vas a construir un **centro de operaciones visual, minimalista y en tiempo real** que queda abierto toda la jornada en un monitor del local y que también se usa desde una PC y un iPad.

Reglas de trabajo:

1. **Trabajá por fases** (sección 14). Al terminar cada fase: corré las pruebas, verificá los criterios de aceptación de esa fase, mostrale al usuario qué quedó hecho (cómo verlo y probarlo) y **esperá su aprobación antes de pasar a la siguiente**.
2. **No improvises funcionalidades.** Si algo no está en este documento, no lo agregues. Si algo es ambiguo, consultalo. Las decisiones abiertas están listadas en la sección 15: preguntalas cuando llegues a la fase que las necesita, proponiendo la opción por defecto indicada.
3. **No inventes datos del negocio**: nombres de empleados, precios, dirección, horarios, textos comerciales. Donde falten, dejá campos configurables o marcadores claros.
4. **Nunca dejes funcionalidades a medias.** Mejor menos funciones terminadas que muchas incompletas. Nada de botones que no hacen nada ni pantallas "próximamente".
5. **Menos es más.** La prioridad absoluta es una herramienta rápida, clara, intuitiva y minimalista. Cada elemento visible debe tener una justificación operativa.
6. **Supabase y Vercel del usuario — prohibido tocar lo existente.** El usuario ya tiene:
   - Supabase: proyecto **"fidelizacion"** (activo) y **"todocopiascipo's Project"** (pausado).
   - Vercel: proyectos **"fidelizacion"** y **"todo-herramientas"** (todo-herramientas.vercel.app).
   **No modifiques, pauses, despauses, borres ni reutilices ninguno de ellos.** Esta aplicación usa un **proyecto de Supabase nuevo y dedicado** (sección 4). Pedí confirmación explícita antes de crearlo.
7. Idioma de toda la interfaz: **español rioplatense** (Argentina). Zona horaria: **America/Argentina/Buenos_Aires**. Formato de hora 24 h (ej. 14:00). Moneda: pesos argentinos (`$ 12.500`).
8. Código, nombres de tablas y columnas: en español y en `snake_case` para la base; TypeScript estricto en el frontend.
9. **Proyecto 100 % local por ahora.** Trabajá en la carpeta local donde te abrieron. Inicializá Git localmente (`git init`) y hacé commits pequeños y descriptivos al cerrar cada fase, pero **no conectes ningún repositorio remoto ni hagas push**: se sube a GitHub más adelante, cuando el usuario lo decida.
   **Destino futuro:** esta app se va a integrar como **un módulo nuevo** de la suite **todo-herramientas** (React + Vite, publicada en todo-herramientas.vercel.app). Construila pensando en esa integración:
   - Mismo stack (React + Vite + TypeScript).
   - Todo el código del módulo autocontenido en `src/modules/centro-operaciones/` (o equivalente), con su propia ruta de entrada.
   - Estilos encapsulados: sin estilos globales que puedan afectar a otras herramientas de la suite (prefijá clases o variables CSS con `co-`).
   - Configuración (claves de Supabase) solo por variables de entorno.
   - No intentes integrarla ni modificar todo-herramientas ahora.
10. **Desarrollo local**: la aplicación se desarrolla y prueba en la PC del usuario (`npm run dev`). La base de datos es un proyecto Supabase nuevo en la nube (sección 4). **No despliegues** en ningún hosting hasta que el usuario lo pida.

---

## 1. Contexto del negocio

- Actividades: fotocopias e impresiones B/N y color, distintos papeles, vinilos y stickers, libros, encuadernaciones y anillados, papelería, regalos empresariales, trabajos gráficos tercerizados, preparación y entrega de pedidos, envíos y logística.
- Equipo: **2 personas por turno**. Dos turnos: mañana y tarde (la tarde empieza a las 17:00). Todas las personas crean, asignan y reciben tareas. **No hay roles ni permisos diferenciados por ahora** (se agregarán más adelante: dejá el modelo preparado, sin implementarlo).
- Volumen: unos **5 trabajos grandes y 10 medianos por día**. Las ventas al paso (una lapicera, un par de fotocopias) **no** se cargan.
- Los pedidos llegan por mostrador, por WhatsApp o porque un integrante consigue un trabajo.
- Dispositivos:
  - **PC de trabajo** con varios monitores. Un **monitor común de computadora** (tamaño aún no definido) funcionará como "pizarra digital", aunque a veces se usa para otra cosa.
  - **iPad compartido**, muy usado por una persona.
  - No hay celulares personales para el trabajo (igual la app debe verse bien en celular).
  - La PC se suspende o apaga entre el turno mañana y el turno tarde.
- Internet: **se corta seguido** (es la zona); la red local es estable.
- Todos los dispositivos son **compartidos**. El historial es **global y visible para todos** ("transparencia, somos todos laburantes").

---

## 2. Concepto del producto

No es un dashboard administrativo. Es una **representación visual del estado operativo del negocio**, que se entiende de un vistazo y se actualiza sola en todas las pantallas.

Debe mostrar de inmediato: qué hay pendiente, qué es prioritario, quién es responsable, cuándo empezó, cuándo debe terminar, qué está en proceso y qué proyectos internos siguen pendientes.

Gestiona dos tipos de actividades, **sin mezclarlas visualmente**:

- **A. Trabajos y pedidos** (tipo `pedido`): entran al negocio, tienen cliente y plazo de entrega.
- **B. Proyectos internos** (tipo `interna`): mejoras del negocio a mediano y largo plazo (finanzas, cartelería, mejoras edilicias, orden y limpieza, mantenimiento de máquinas, marketing, desarrollo comercial). Un proyecto contiene tareas y subtareas; sus tareas pueden aparecer en la matriz cuando corresponda.

---

## 3. Arquitectura técnica

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript (strict)** | Rápido, liviano; el usuario ya tiene otra app en Vite/React. |
| Estilos | **Tailwind CSS** con los tokens del sistema de diseño (sección 9) como variables CSS | Consistencia con la marca, sin CSS suelto. |
| Datos y caché | **@supabase/supabase-js** + **TanStack Query** | Fetch, caché, actualizaciones optimistas. |
| Tiempo real | **Supabase Realtime** (`postgres_changes`) | Cambios instantáneos en todas las pantallas. |
| Base de datos | **Supabase (Postgres)**, proyecto nuevo dedicado | Relacional, RLS, plan gratis suficiente (1 de los 2 proyectos activos gratuitos). |
| Arrastrar y soltar | **dnd-kit** | Mouse y táctil (iPad), accesible. |
| Animaciones | **Framer Motion** | Efecto "levantar", seguimiento con leve retraso (spring), transiciones. |
| Confeti | **canvas-confetti** | Liviano. |
| Fechas | **date-fns** + `date-fns-tz`, locale `es` | Cálculos de plazos con zona horaria correcta. |
| PWA | **vite-plugin-pwa** | Instalable en iPad y PC, base para notificaciones. |
| Pruebas | **Vitest** + **Testing Library**; **Playwright** para flujos completos | Sección 13. |

**Alojamiento: se decide después.** Desarrollá y probá en local (`npm run dev`) contra el proyecto Supabase en la nube. Dejá el proyecto listo para desplegar en Vercel (variables de entorno documentadas, build sin errores), pero **no despliegues** hasta que el usuario lo pida.

Estructura sugerida:

```
src/
  app/            # rutas, providers, layout
  features/
    matriz/       # pantalla principal, cuadrantes, globos
    tareas/       # crear, detalle, subtareas, estados
    personas/     # "¿Quién soy?", vista personal
    proyectos/    # proyectos internos
    hechas/       # panel "hechas hoy" y entregados del día
    historial/
    configuracion/
  lib/            # supabase client, urgencia, fechas, realtime
  ui/             # componentes base (Glass, Boton, Slider, Dialogo...)
  styles/tokens.css
supabase/
  migrations/     # SQL versionado
  seed.sql
docs/ESPECIFICACION.md
```

---

## 4. Supabase: proyecto, acceso y seguridad

1. **Crear un proyecto nuevo** (nombre sugerido: `todocopias-operaciones`, región `us-east-1` como los existentes, o la más cercana disponible). **Pedí confirmación antes de crearlo.** No toques los otros proyectos.
2. Todo el esquema se crea mediante **migraciones versionadas** en `supabase/migrations/`.
3. **Acceso sin registro complejo** (requisito del usuario: nada de login por persona):
   - Opción por defecto (a confirmar, ver 15): **una única cuenta compartida del local** (email + contraseña de Supabase Auth). Se ingresa **una sola vez por dispositivo** y la sesión queda guardada. Así los datos no quedan expuestos a cualquiera que tenga la URL cuando se publique en internet.
   - Encima de eso, la identidad operativa es el selector **"¿Quién soy?"** (sección 7.6), sin contraseña, con **PIN opcional** por persona.
4. **RLS activado en todas las tablas**: solo el rol `authenticated` puede leer y escribir. Nada accesible con la clave anónima sin sesión.
5. Habilitar Realtime en las tablas que la UI escucha (`tareas`, `subtareas`, `tarea_responsables`, `proyectos`, `personas`, `configuracion`, `eventos`).
6. Nunca subir claves al repositorio: `.env.local` + `.env.example` documentado.
7. Correr los *advisors* de seguridad y rendimiento de Supabase al terminar el esquema y corregir lo que marquen.

---

## 5. Modelo de datos

> Tipos orientativos. Usá `uuid` como clave primaria (`gen_random_uuid()`), `timestamptz` para fechas, y `created_at` / `updated_at` en todas las tablas (trigger para `updated_at`).

### `personas`
- `id`, `nombre` (texto, obligatorio), `iniciales` (opcional), `pin_hash` (opcional), `activa` (bool, default true), `orden`.
- **No precargues nombres reales**: se cargan desde Configuración (preguntá al usuario los nombres en la Fase 1).

### `clientes`
- `id`, `nombre_apellido`, `telefono`.
- Se crea desde el formulario del pedido; si el teléfono ya existe, ofrecer reutilizar el cliente.

### `categorias`
- `id`, `nombre`, `tipo_aplica` (`pedido` | `interna` | `ambos`), `activa`, `orden`.
- Semilla sugerida (editable): Impresión B/N, Impresión color, Vinilos y stickers, Libros y encuadernación, Anillados, Papelería, Regalos empresariales, Trabajo tercerizado, Envíos y logística; y para internas: Finanzas, Cartelería, Mejoras edilicias, Orden y limpieza, Mantenimiento de máquinas, Marketing, Desarrollo comercial. **Confirmá la lista con el usuario.**

### `proyectos`
- `id`, `nombre`, `descripcion`, `estado` (`activo` | `en_pausa` | `terminado` | `cancelado`), `fecha_inicio`, `fecha_objetivo`, `responsable_id` (opcional), `categoria_id`, `orden`.

### `tareas`
- `id`
- `tipo`: `pedido` | `interna`
- `titulo` (obligatorio), `descripcion`
- `categoria_id`, `proyecto_id` (null salvo tareas de proyecto), `cliente_id` (solo pedidos)
- `sena` (numeric, default 0), `saldo` (numeric, default 0) — "seña" y "lo que deben"
- `importante` (bool, obligatorio)
- `urgencia_manual` (smallint 1–5, null = usa la automática)
- `estado`: `pendiente` | `en_proceso` | `en_espera` | `terminada` | `entregada` | `cancelada`
- `estado_anterior` (para "Devolver al estado anterior")
- `motivo_espera`: `archivo_cliente` | `material` | `pago` | `proveedor` | `otro` (+ `motivo_espera_detalle`)
- `fecha_inicio` (hora de inicio), `fecha_entrega` (fecha y hora estimada)
- `terminada_at`, `entregada_at`
- `mostrar_en_matriz` (bool; para tareas de proyectos, ver 7.9)
- `eliminada_at` (borrado lógico → papelera), `eliminada_por`
- `creada_por`, `actualizada_por` (→ `personas`, nullable)

### `tarea_responsables`
- `tarea_id`, `persona_id` (PK compuesta). Una tarea puede tener **varios responsables**.

### `subtareas`
- `id`, `tarea_id`, `titulo`, `responsable_id`, `hecha` (bool), `hecha_at`, `orden`, `inicio_estimado` (opcional), `duracion_min` (opcional).
- Caso típico: "uno corta, otro imprime". Los responsables de las subtareas se suman automáticamente a `tarea_responsables`.

### `eventos` (historial global)
- `id`, `tarea_id` (nullable), `proyecto_id` (nullable), `persona_id` (quién lo hizo, nullable), `accion` (`creada`, `editada`, `estado`, `reasignada`, `movida_cuadrante`, `eliminada`, `restaurada`, `subtarea_hecha`, …), `cambios` (jsonb: antes/después), `created_at`.
- Se registran automáticamente (trigger o capa de servicio, una sola vía, consistente).

### `configuracion`
- Clave/valor (`clave` text PK, `valor` jsonb). Incluye: confeti activado, umbrales de urgencia, horas de "día de entrega", plantilla del mensaje para copiar, días de retención de la papelera (default 30), disposición de cuadrantes.

### Futuro (no implementar ahora, solo no bloquearlo)
- `concatenaciones` (agrupar tareas de distintos trabajos que comparten una operación, ej. "cortar todo junto").
- Roles y permisos por persona.
- Vinculación de `clientes` con el sistema de fidelización existente (proyecto aparte, **no tocar**).

---

## 6. Reglas de negocio

### 6.1 Urgencia (5 niveles)
- **Urgencia estimada (automática)**: se calcula según el tiempo que falta para `fecha_entrega`. Umbrales por defecto (editables en Configuración; **confirmar con el usuario**):
  - 5 → vencida o vence en ≤ 2 h
  - 4 → vence hoy (día de entrega)
  - 3 → vence en ≤ 24 h
  - 2 → vence en ≤ 72 h
  - 1 → más de 72 h o sin fecha
- **Urgencia manual**: un **slider de 5 pasos** en el detalle de la tarea, junto al texto "Urgencia estimada: N".
- **Urgencia efectiva** = `urgencia_manual` si existe; si no, la estimada. (Regla por defecto; ver 15 la alternativa "el sistema puede subirla pero nunca bajarla".)
- **Urgente** (para el cuadrante) = urgencia efectiva **≥ 3**.
- El cálculo vive en una única función pura (`lib/urgencia.ts`) con pruebas unitarias, y se recalcula en el cliente cada minuto (sin escribir en la base).

### 6.2 Importancia
- Binaria: **Importante: Sí / No**. Sin slider.

### 6.3 Cuadrantes (Matriz de Eisenhower)
- Cuadrante = combinación de `importante` × `urgente`:
  - **HACER** — importante y urgente
  - **PLANIFICAR** — importante y no urgente
  - **DELEGAR** — no importante y urgente
  - **ELIMINAR** — no importante y no urgente
- **Disposición en pantalla, tal como la describió el usuario** (eje horizontal = urgencia, **derecha = urgente**; eje vertical = importancia, **arriba = importante**):

  ```
  ┌──────────────────────┬──────────────────────┐
  │ PLANIFICAR           │ HACER                │
  │ Importante           │ Importante           │
  │ No urgente           │ Urgente              │
  ├──────────────────────┼──────────────────────┤
  │ ELIMINAR             │ DELEGAR              │
  │ No importante        │ No importante        │
  │ No urgente           │ Urgente              │
  └──────────────────────┴──────────────────────┘
  ```
  ⚠️ La plantilla de Eisenhower más difundida pone "urgente" a la **izquierda** (HACER arriba-izquierda). **Confirmá con el usuario la disposición antes de la Fase 2** y dejala como una constante configurable (`configuracion.disposicion_cuadrantes`) para poder cambiarla sin tocar código.
- **Arrastrar una tarea a otro cuadrante cambia sus dos propiedades a la vez**: `importante` según la fila destino, y `urgencia_manual` según la columna destino (a urgente → `max(efectiva, 3)`; a no urgente → `min(efectiva, 2)`). Registrar evento `movida_cuadrante`.
- Una tarea **vencida no se mueve sola** de cuadrante: se destaca en su lugar.

### 6.4 Estados y ciclo de vida
- `pendiente` → `en_proceso` → (`en_espera` con motivo, ida y vuelta) → `terminada` → `entregada`. `cancelada` desde cualquier estado activo.
- **Terminar**: botón explícito **"Terminar"** + diálogo de confirmación ("¿Terminar esta tarea?"). Al confirmar:
  - Confeti azul y blanco (si está activado en Configuración).
  - La tarjeta **queda en su lugar** y se vuelve **totalmente azul** (código de color: azul = terminada).
  - El botón "Terminar" se convierte en **"Entregada"**.
- **Entregada**: con confirmación. La tarea sale de la matriz y pasa a la lista **"Entregados del día"** del panel lateral.
- **Tareas internas** (tipo `interna`): no tienen paso "Entregada". Al terminarlas pasan directamente a "Hechas hoy". (Supuesto a confirmar, ver 15.)
- **Devolver al estado anterior**: desde el menú de tres puntitos del globo (y desde la lista de entregados/hechas), restaura `estado_anterior`. También se puede arrastrar una tarea desde el panel de hechas de vuelta a la matriz.
- Toda transición registra un evento con la persona activa.

### 6.5 Eliminar y papelera
- Se elimina **arrastrando la tarea al tacho de basura**, que **solo aparece mientras se arrastra** (no está siempre visible).
- Al soltar: diálogo de confirmación: *"¿Eliminar esta tarea? Podrás recuperarla desde Configuración › Papelera durante 30 días."*
- Es un **borrado lógico** (`eliminada_at`). La **Papelera** vive en Configuración (un poco oculta, no en el uso diario): restaurar o borrar definitivamente. Purga automática pasado el plazo configurable.
- Además, en Configuración: **Exportar respaldo** (JSON completo de todas las tablas) como resguardo manual.

### 6.6 Vencimientos (efectos)
Progresión visual en el lugar donde está la tarea, siempre en degradados (sección 9.4):
- A medida que se acerca la fecha: el tinte se vuelve **cada vez más rojo**.
- **Día de entrega**: aparece un **signo de exclamación** y la tarjeta **"late" suavemente** (pulso tipo corazón, lento).
- **Vencida**: el efecto se exagera: tono **casi negro / rojo muy oscuro**, una **calavera sutil** en línea (icono lineal, chico) y el texto **"Vencida hace 40 min"** (tiempo relativo que se actualiza). Gracioso pero profesional: nada de caricaturas ni parpadeos agresivos.
- Respetar `prefers-reduced-motion`: sin pulso, solo el cambio de color y el icono.

### 6.7 Datos del cliente y mensaje para copiar
- En pedidos: **nombre y apellido, teléfono, seña y saldo (lo que deben)**.
- Junto a esos datos y al terminar un pedido aparece un **botón "Copiar mensaje"** que copia al portapapeles un aviso listo para pegar en WhatsApp.
- La plantilla es editable en Configuración, con variables `{nombre}`, `{trabajo}`, `{saldo}`. No inventes textos comerciales: plantilla por defecto mínima y neutra, por ejemplo: *"Hola {nombre}, tu trabajo "{trabajo}" ya está listo para retirar. Saldo pendiente: {saldo}."* — confirmala con el usuario.
- Opcional dentro del mismo alcance: botón para copiar solo el teléfono.

---

## 7. Pantallas y comportamiento

### 7.1 Pantalla principal (matriz)
- Ocupa prácticamente **el 100 % de la pantalla**. Sin menús permanentes, sin paneles administrativos, sin gráficos.
- Una **cruz central** divide cuatro cuadrantes **visualmente equilibrados**. Cada cuadrante muestra su nombre (etiqueta discreta) y sus globos.
- **Reloj y fecha discretos** en una esquina.
- Opcional, solo si aporta valor y de forma muy discreta: cantidad de tareas activas.
- **Orden dentro de cada cuadrante**: por urgencia efectiva (mayor primero) y luego por `fecha_entrega` más cercana.
- **Densidad**: si un cuadrante no entra, reducir el tamaño de los globos de forma progresiva; si aun así no entra, mostrar un globo "+N" que abre el cuadrante ampliado. Nunca solapar ni cortar texto.
- **Separación de los dos sistemas**: pedidos y tareas internas conviven en la matriz pero se distinguen con una marca sutil (por ejemplo, un pequeño icono de proyecto en las internas). Sin colores extra.

### 7.2 Globo de tarea (vista compacta)
Muestra solo lo esencial:
```
Imprimir vinilo
Juan · Ana          ← responsables
Entrega 14:00       ← o "Mañana 10:00", o "Vencida hace 40 min"
```
- Si tiene subtareas: indicador mínimo de progreso (ej. `2/3`).
- Menú de **tres puntitos** (aparece al tocar/hover): Editar · Devolver al estado anterior · Copiar mensaje (pedidos) · Eliminar. (Eliminar también abre el mismo diálogo de confirmación.)
- Tocar el globo abre el **detalle**.
- Arrastrar: **levantar** (escala ~1,05, sombra suave, efecto "pop") y la tarjeta **sigue al cursor/dedo con un retraso muy leve** (spring). En iPad: mantener presionado para levantar.

### 7.3 Cuadrante ampliado
- Al tocar el nombre de un cuadrante (o el "+N"), ese cuadrante se **amplía temporalmente** con una transición suave; los demás quedan visibles en miniatura.
- Volver a la vista general: tocar fuera, tecla `Esc` o botón "volver" discreto. Volver solo a los 60 s sin interacción en el modo pantalla.

### 7.4 Detalle de la tarea (panel o diálogo)
Permite consultar y modificar: título, descripción, tipo, categoría, proyecto asociado, responsables (reasignar), cliente (nombre, teléfono), seña, saldo, fecha de creación (solo lectura), hora de inicio, fecha y hora de entrega, **Importante Sí/No**, **slider de urgencia 1–5 con "Urgencia estimada: N"**, estado (+ motivo si está en espera), **subtareas** (checklist con responsable por ítem), historial de esa tarea. Botones de acción según estado: Terminar / Entregada / Devolver.

### 7.5 Creación rápida (crítico)
- Accesible en todo momento desde el borde (sección 7.10) y con la tecla **`N`** en la PC.
- Formulario mínimo, en un solo paso: **título**, **responsable(s)**, **fecha y hora de entrega** (atajos: Hoy, Mañana, +horas), **Importante Sí/No**. Todo lo demás (cliente, teléfono, seña, saldo, categoría, descripción, subtareas) en una sección "Más datos" plegada.
- Al guardar, la tarea aparece **inmediatamente** en todas las pantallas. Objetivo: un pedido cargado en **menos de 15 segundos**.

### 7.6 "¿Quién soy?"
- Selector de persona sin contraseña (PIN opcional si la persona lo configuró). Se recuerda por dispositivo hasta que se cambie.
- Al elegir persona: en la matriz se **resaltan sus tareas** y las demás se atenúan levemente. Un toque para quitar el resaltado.
- La persona activa queda registrada como autora en el historial. Si no hay persona elegida, al hacer una acción importante (crear, terminar, entregar, eliminar) se pide elegirla con un selector rápido.

### 7.7 Vista "Mis tareas" (tareas personales)
- Apartado separado del panel principal.
- Muestra las tareas y **subtareas de la persona activa, descompuestas en pasos**, ordenadas según la hora de entrega: "el trabajo grande se ve descompuesto en partes más sencillas con un encargado".
- **Checklist** para marcar subtareas hechas.
- **Línea de tiempo del día** (vista simple tipo Gantt de la jornada: qué hacer ahora y qué sigue). Un Gantt completo de proyectos queda para una fase posterior (ver 14).

### 7.8 Panel lateral "Hechas hoy"
- Oculto. En la PC se despliega al acercar el cursor al borde derecho; en el iPad, deslizando desde el borde o con un icono casi transparente.
- Dos listas: **Terminadas hoy** y **Entregados del día**, cada ítem con "Devolver".
- Se reinicia al cambiar el día (lo anterior queda en el historial).

### 7.9 Proyectos internos
- Vista propia (no se mezcla con la matriz): lista de proyectos con estado, responsable, fecha objetivo y progreso (tareas hechas / totales).
- Dentro de un proyecto: sus tareas y subtareas, crear/editar/reordenar.
- Una tarea de proyecto aparece en la matriz si `mostrar_en_matriz = true` (interruptor en la tarea; por defecto encendido cuando tiene fecha de entrega o está en proceso). Ahí se comporta como cualquier tarea.
- El detalle fino de esta sección está pendiente de definir con el usuario (ver 15): implementá lo descrito acá y nada más.

### 7.10 Herramientas ocultas en los bordes
- Ningún menú visible en reposo. Al acercar el cursor a un borde aparecen **iconos lineales blancos** discretos:
  - Crear tarea (el más importante, siempre el más accesible) · ¿Quién soy? · Mis tareas · Proyectos · Hechas hoy · Historial · Configuración.
- En pantallas táctiles: un **botón casi transparente en una esquina** que abre el mismo menú, más gesto de deslizar desde el borde. **Nunca depender del hover.**

### 7.11 Historial
- Global, visible para todos. Lista cronológica de eventos (quién, qué, cuándo), con filtro por persona, por tarea y por fecha, y búsqueda por texto. Paginado.

### 7.12 Configuración
- Personas (alta, baja, orden, PIN opcional).
- Categorías.
- Umbrales de urgencia y disposición de cuadrantes.
- Confeti: activar/desactivar.
- Notificaciones: activar/desactivar por dispositivo.
- Plantilla del mensaje para copiar.
- **Papelera** (restaurar / borrar definitivamente) y **Exportar respaldo**.

### 7.13 Modo pantalla (pizarra digital)
- Activable con `?modo=pantalla` o desde Configuración, por dispositivo.
- Tipografía más grande para lectura a distancia, cursor oculto tras inactividad, **Wake Lock API** para que no se apague, reconexión automática, vuelve sola a la vista general.
- Debe funcionar sin que nadie la toque.

---

## 8. Tiempo real, conexión y notificaciones

- Suscripción a Realtime al iniciar; los cambios de otros dispositivos se reflejan **sin recargar** (objetivo < 1 s).
- **Actualizaciones optimistas** para crear, mover, terminar y eliminar, con reversión si el servidor rechaza.
- **Desconexiones** (frecuentes en la zona):
  - Indicador discreto "Sin conexión" (no alarmante).
  - Mientras no hay conexión, **las ediciones se bloquean** con un aviso amable (por defecto; ver 15 la alternativa de cola sin conexión).
  - Al reconectar: **re-suscribir y volver a traer todo** el estado para no perder cambios ocurridos durante el corte.
  - Al volver de suspensión de la PC (`visibilitychange`), lo mismo.
- **Notificaciones** (el usuario las quiere):
  - Fase actual: notificaciones del navegador (Notification API) **mientras la app está abierta**, para: tarea asignada a la persona activa, tarea que entra en "día de entrega" y tarea vencida. Pedir permiso con un botón explícito, nunca al abrir.
  - En iPad, las notificaciones web requieren que la app esté **instalada en la pantalla de inicio (PWA)** y servida por **HTTPS**; por eso funcionarán en el iPad recién cuando se publique (fase de despliegue). Documentalo y no lo prometas antes.
  - Notificaciones push con la app cerrada (Web Push + Edge Function): **fase posterior**.

---

## 9. Diseño visual

### 9.1 Principios
Moderno, minimalista, elegante, tecnológico sin exagerar. **Menos es más.** Prohibido: dashboard lleno de botones, paneles permanentes, gráficos innecesarios, indicadores luminosos decorativos, demasiados colores, listados extensos, menús siempre visibles. La pantalla prioriza las tareas.

### 9.2 Tokens del sistema de diseño TODOCOPIAS (obligatorios)
```css
:root {
  --azul-principal: #174e97;   /* color dominante de marca */
  --azul-profundo:  #2c2a69;   /* refuerzo institucional */
  --blanco:         #ffffff;
  --negro:          #171717;
  --gradiente-marca: linear-gradient(90deg, #174e97, #2c2a69);

  --font-sans: "Plus Jakarta Sans", system-ui, sans-serif;

  --space-1: 8px;  --space-2: 16px; --space-3: 24px;
  --space-4: 32px; --space-6: 48px; --space-8: 64px;

  --radius-pill: 999px;
  --focus-ring: 2px;
}
```
- Tipografía: **exclusivamente Plus Jakarta Sans** (pesos 400–800), servida localmente (paquete `@fontsource/plus-jakarta-sans` o archivos en `public/fonts`).
- Jerarquía: título principal 48/56 ExtraBold mayúsculas · título 32/40 Bold · subtítulo 22/30 SemiBold · texto 16/24 Regular · texto chico 14/20 · dato clave 28/34 Bold · etiqueta 12/16 Bold, mayúsculas, tracking 0.06em.
- Escala de espaciado de 8 px. Esquinas redondeadas en todos los bloques; cápsulas para botones y etiquetas.
- Logo: logotipo tipográfico "**TODO**COPIAS" (TODO bold, COPIAS liviano), versión **blanca** sobre fondos azules. Pedile al usuario el SVG; no lo redibujes.
- Accesibilidad: contraste mínimo 4.5:1 en texto normal (3:1 en texto grande); foco visible de 2 px; **nunca comunicar algo solo con color** (acompañar con icono o texto: "!", calavera, "Terminada", "Vencida hace…"); sin parpadeos agresivos.

### 9.3 Fondo y globos
- Fondo: **degradado profundo y difuminado** desde `--azul-profundo` hacia `--azul-principal` con un brillo suave más claro (tono cian/celeste claro **derivado del azul principal**, a confirmar con el usuario), desenfocado, con sensación de profundidad. Sin texturas ni ruido. **La zona más clara nunca debe quedar detrás del texto blanco**: verificar contraste.
- Globos: tarjetas flotantes con bordes muy redondeados, **glassmorphism moderado** (fondo blanco translúcido, `backdrop-filter: blur()` moderado, borde fino blanco translúcido), texto blanco legible.
- Rendimiento: el desenfoque es costoso. Limitar su uso, y ofrecer un modo "liviano" automático (sin `backdrop-filter`, translúcido plano) si el equipo es lento o hay muchos globos.
- Iconos: **lineales, blancos o translúcidos**, set consistente (Lucide). Solo los necesarios.

### 9.4 Código de color por estado y urgencia (siempre degradados, nunca colores planos)
| Situación | Tratamiento |
|---|---|
| Sin urgencia (1–2) | Vidrio neutro (blanco translúcido) |
| Urgencia media (3) | Tinte **verde** suave en degradado |
| Urgencia alta (4) | Degradado **naranja → rojizo** |
| Día de entrega | Rojizo más intenso + **"!"** + pulso lento |
| Vencida | Degradado **rojo muy oscuro → casi negro**, calavera lineal sutil, "Vencida hace X" |
| Terminada | Totalmente **azul** (degradado `--azul-principal` → `--azul-profundo`) |
| En espera | Vidrio atenuado + icono de pausa + motivo |

- Los tintes son **suaves, sobre el vidrio**, no tarjetas saturadas: diferenciación sutil.
- El rojo/naranja/verde no forman parte de la paleta de marca: se usan **solo** como señal de urgencia, con saturación contenida.

### 9.5 Movimiento
Animaciones con propósito, breves y fluidas (150–300 ms), sin rebotes exagerados: aparición de globos (opacidad + leve desplazamiento), levantar/arrastrar con spring, ampliación de cuadrante, conversión a azul al terminar, confeti azul y blanco breve. Todo respeta `prefers-reduced-motion`.

### 9.6 Responsive
- **Monitor (pizarra)** y **PC**: matriz 2×2 completa.
- **iPad** (horizontal y vertical): matriz 2×2 con globos adaptados; objetivos táctiles ≥ 44 px.
- **Celular**: un cuadrante por vez (deslizar entre cuadrantes) o lista agrupada por cuadrante.
- Misma identidad visual en todos los tamaños. Sin scroll horizontal.

---

## 10. Rendimiento
- Carga inicial < 2 s en la PC del local; interacción fluida (60 fps) al arrastrar.
- Suscripciones Realtime filtradas; nada de refrescos periódicos completos salvo al reconectar.
- Recalcular urgencia en el cliente cada 60 s, sin escribir en la base.
- Tamaño de bundle controlado (carga diferida de Proyectos, Historial y Configuración).

## 11. Seguridad
- RLS en todas las tablas; solo sesión autenticada (cuenta del local).
- PIN opcional guardado como hash (nunca en texto plano).
- Claves en variables de entorno; `service_role` jamás en el frontend.
- Validación de datos en el cliente y restricciones en la base (`check` de rangos, `not null`, enums).
- Correr los advisors de Supabase y resolver los avisos antes de cerrar cada fase con cambios de esquema.

## 12. Mantenimiento
- Migraciones versionadas, nunca cambios manuales en el panel.
- `README.md` con: instalación, variables de entorno, cómo correr, cómo desplegar, cómo exportar respaldo.
- Tipos de TypeScript generados desde el esquema de Supabase.
- Código legible, componentes chicos, sin dependencias innecesarias.

## 13. Pruebas
- **Unitarias (Vitest)**: cálculo de urgencia y cuadrante, umbrales, transiciones de estado, "devolver al estado anterior", plantilla de mensaje, tiempo relativo "vencida hace…".
- **Componentes (Testing Library)**: globo en cada estado, creación rápida, diálogo de confirmación.
- **Extremo a extremo (Playwright)**: crear pedido → aparece en el cuadrante correcto; mover de cuadrante → cambian importancia y urgencia; terminar → azul + botón Entregada; entregar → pasa a Entregados del día; devolver; eliminar arrastrando → papelera → restaurar; sincronización entre dos navegadores abiertos a la vez; corte y reconexión.
- Todas las pruebas deben pasar al cierre de cada fase.

---

## 14. Plan por fases (detenerse y mostrar al final de cada una)

**Fase 0 — Preparación**
Revisar la carpeta local (si ya tiene archivos, no borrarlos sin consultar), `git init` local sin remoto. Guardar este documento como `docs/ESPECIFICACION.md` dentro del repo. Proyecto Vite + TS + Tailwind, tokens, fuente, estructura, lint/format, Vitest y Playwright configurados. Pedir confirmación y crear el proyecto Supabase nuevo.
*Acepta si:* `npm run dev`, `npm run build` y `npm test` funcionan sin errores; se ve una pantalla vacía con el fondo y la tipografía correctos.

**Fase 1 — Base de datos**
Migraciones del modelo (sección 5), RLS, triggers de `updated_at` y de eventos, Realtime habilitado, semilla de categorías y configuración. Preguntar nombres de personas.
*Acepta si:* advisors sin errores; tipos generados; sin sesión no se puede leer nada.

**Fase 2 — Matriz principal (lectura)**
Confirmar disposición de cuadrantes. Cruz, cuadrantes, globos con datos reales, reloj, ordenamiento, densidad, colores y efectos de urgencia y vencimiento.
*Acepta si:* datos de prueba se ubican en el cuadrante correcto según las reglas; los efectos se ven en cada nivel; contraste verificado.

**Fase 3 — Crear y editar**
Creación rápida, detalle completo, subtareas, varios responsables, datos de cliente, seña y saldo, slider de urgencia con estimada, Importante Sí/No.
*Acepta si:* un pedido se carga en < 15 s; todos los campos se guardan y se ven reflejados.

**Fase 4 — Tiempo real y conexión**
Realtime, optimismo, indicador sin conexión, bloqueo de ediciones sin conexión, resincronización al reconectar y al volver de suspensión.
*Acepta si:* dos navegadores se sincronizan en < 1 s; tras cortar y volver la red, el estado es correcto.

**Fase 5 — Arrastrar y soltar**
Mover entre cuadrantes (cambia ambas propiedades), tacho que aparece al arrastrar, confirmación, borrado lógico, papelera en Configuración, animación de levantar con leve retraso. Funciona con mouse y en iPad.
*Acepta si:* las pruebas E2E de mover y eliminar pasan; en táctil funciona con mantener presionado.

**Fase 6 — Ciclo terminar / entregar**
Botón Terminar + confirmación, confeti (desactivable), tarjeta azul, botón Entregada, Entregados del día, Hechas hoy, menú de tres puntitos, Devolver, Copiar mensaje.
*Acepta si:* todo el ciclo funciona de ida y vuelta y queda registrado en el historial.

**Fase 7 — Personas**
"¿Quién soy?" (PIN opcional), resaltado de tareas propias, vista "Mis tareas" con checklist y línea de tiempo del día, autoría en el historial.

**Fase 8 — Proyectos internos**
Lista y detalle de proyectos, tareas y subtareas de proyecto, `mostrar_en_matriz`. (Antes de empezar, resolver con el usuario las decisiones de 15 sobre proyectos.)

**Fase 9 — Herramientas ocultas, historial y configuración**
Menús de borde (hover y táctil), historial global con filtros, configuración completa, exportar respaldo.

**Fase 10 — Modo pantalla, PWA y notificaciones**
Modo pantalla (wake lock, tipografía grande, cursor oculto), PWA instalable, notificaciones con la app abierta.

**Fase 11 — Cierre**
Pasada completa de pruebas, accesibilidad, rendimiento en el equipo real, README. Dejar listo para desplegar en Vercel **sin desplegar**.

**Posteriores (no implementar sin pedido explícito):** despliegue en Vercel y acceso desde casa; Web Push con la app cerrada; Gantt completo de proyectos; concatenar tareas de distintos trabajos; roles y permisos; integración con fidelización; edición sin conexión con cola de sincronización.

---

## 15. Decisiones abiertas (preguntar en la fase indicada, proponiendo el valor por defecto)

| # | Tema | Valor por defecto propuesto | Fase |
|---|---|---|---|
| 1 | Nombres de las personas del equipo | — (preguntar) | 1 |
| 2 | Lista de categorías | La de la sección 5 | 1 |
| 3 | Acceso: cuenta compartida del local una vez por dispositivo | Sí | 0–1 |
| 4 | Disposición de cuadrantes (urgente a la derecha vs. a la izquierda) | La descrita por el usuario (derecha) | 2 |
| 5 | Umbrales de urgencia en horas | Los de 6.1 | 2 |
| 6 | Tono exacto del brillo cian/celeste del fondo | Derivado del azul principal | 2 |
| 7 | Urgencia manual vs. automática: ¿manda la manual o el sistema puede subirla? | Manda la manual | 3 |
| 8 | Texto de la plantilla "Copiar mensaje" | El de 6.7 | 6 |
| 9 | Tareas internas: ¿pasan directo a "Hechas" sin "Entregada"? | Sí | 6 |
| 10 | Sin conexión: ¿bloquear ediciones o encolarlas? | Bloquear | 4 |
| 11 | Proyectos internos: estructura, vistas, cuándo aparecen en la matriz | Lo descrito en 7.9 | 8 |
| 12 | Logo SVG blanco de TODOCOPIAS | Pedirlo al usuario | 2 |

---

## 16. Criterios de aceptación generales
- Se entiende el estado del negocio **de un vistazo**, a distancia, sin tocar nada.
- Un pedido nuevo aparece en todas las pantallas en menos de 1 segundo.
- Ninguna función visible está incompleta.
- Funciona con mouse, teclado y táctil (iPad).
- Respeta el sistema de diseño TODOCOPIAS y la regla "menos es más".
- No se tocó ningún proyecto existente de Supabase ni de Vercel.
- Todas las pruebas pasan y `npm run build` no tiene errores ni advertencias de tipos.
