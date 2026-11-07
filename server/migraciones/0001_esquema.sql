-- =============================================================================
-- Base local (SQLite) del prototipo. Replica el modelo de la especificación,
-- sección 5, y el esquema de supabase/migrations para migrar más adelante.
--
-- Convenciones: ids uuid como texto, fechas ISO 8601 en UTC como texto,
-- booleanos 0/1, jsonb como texto JSON.
-- =============================================================================

CREATE TABLE personas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 60),
  iniciales TEXT CHECK (iniciales IS NULL OR length(trim(iniciales)) BETWEEN 1 AND 4),
  pin_hash TEXT,
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE clientes (
  id TEXT PRIMARY KEY,
  nombre_apellido TEXT NOT NULL CHECK (length(trim(nombre_apellido)) BETWEEN 1 AND 120),
  telefono TEXT CHECK (telefono IS NULL OR length(trim(telefono)) BETWEEN 3 AND 30),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX clientes_telefono_idx ON clientes (telefono);

CREATE TABLE categorias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE CHECK (length(trim(nombre)) BETWEEN 1 AND 60),
  tipo_aplica TEXT NOT NULL DEFAULT 'ambos' CHECK (tipo_aplica IN ('pedido', 'interna', 'ambos')),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE proyectos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 120),
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'en_pausa', 'terminado', 'cancelado')),
  fecha_inicio TEXT,
  fecha_objetivo TEXT,
  responsable_id TEXT REFERENCES personas (id) ON DELETE SET NULL,
  categoria_id TEXT REFERENCES categorias (id) ON DELETE SET NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (fecha_objetivo IS NULL OR fecha_inicio IS NULL OR fecha_objetivo >= fecha_inicio)
);
CREATE INDEX proyectos_responsable_idx ON proyectos (responsable_id);
CREATE INDEX proyectos_categoria_idx ON proyectos (categoria_id);

CREATE TABLE tareas (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'pedido' CHECK (tipo IN ('pedido', 'interna')),
  titulo TEXT NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 200),
  descripcion TEXT,
  categoria_id TEXT REFERENCES categorias (id) ON DELETE SET NULL,
  proyecto_id TEXT REFERENCES proyectos (id) ON DELETE SET NULL,
  cliente_id TEXT REFERENCES clientes (id) ON DELETE SET NULL,
  sena REAL NOT NULL DEFAULT 0 CHECK (sena >= 0),
  saldo REAL NOT NULL DEFAULT 0 CHECK (saldo >= 0),
  importante INTEGER NOT NULL CHECK (importante IN (0, 1)),
  urgencia_manual INTEGER CHECK (urgencia_manual BETWEEN 1 AND 5),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_proceso', 'en_espera', 'terminada', 'entregada', 'cancelada')),
  estado_anterior TEXT
    CHECK (estado_anterior IN ('pendiente', 'en_proceso', 'en_espera', 'terminada', 'entregada', 'cancelada')),
  motivo_espera TEXT
    CHECK (motivo_espera IN ('archivo_cliente', 'material', 'pago', 'proveedor', 'otro')),
  motivo_espera_detalle TEXT,
  fecha_inicio TEXT,
  fecha_entrega TEXT,
  terminada_at TEXT,
  entregada_at TEXT,
  mostrar_en_matriz INTEGER NOT NULL DEFAULT 1 CHECK (mostrar_en_matriz IN (0, 1)),
  eliminada_at TEXT,
  eliminada_por TEXT REFERENCES personas (id) ON DELETE SET NULL,
  creada_por TEXT REFERENCES personas (id) ON DELETE SET NULL,
  actualizada_por TEXT REFERENCES personas (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (cliente_id IS NULL OR tipo = 'pedido'),
  CHECK (proyecto_id IS NULL OR tipo = 'interna'),
  CHECK (estado <> 'entregada' OR tipo = 'pedido'),
  CHECK (estado <> 'en_espera' OR motivo_espera IS NOT NULL)
);
CREATE INDEX tareas_categoria_idx ON tareas (categoria_id);
CREATE INDEX tareas_proyecto_idx ON tareas (proyecto_id);
CREATE INDEX tareas_cliente_idx ON tareas (cliente_id);
CREATE INDEX tareas_activas_idx ON tareas (estado, fecha_entrega) WHERE eliminada_at IS NULL;
CREATE INDEX tareas_eliminadas_idx ON tareas (eliminada_at) WHERE eliminada_at IS NOT NULL;

CREATE TABLE tarea_responsables (
  tarea_id TEXT NOT NULL REFERENCES tareas (id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tarea_id, persona_id)
);
CREATE INDEX tarea_responsables_persona_idx ON tarea_responsables (persona_id);

CREATE TABLE subtareas (
  id TEXT PRIMARY KEY,
  tarea_id TEXT NOT NULL REFERENCES tareas (id) ON DELETE CASCADE,
  titulo TEXT NOT NULL CHECK (length(trim(titulo)) BETWEEN 1 AND 200),
  responsable_id TEXT REFERENCES personas (id) ON DELETE SET NULL,
  hecha INTEGER NOT NULL DEFAULT 0 CHECK (hecha IN (0, 1)),
  hecha_at TEXT,
  orden INTEGER NOT NULL DEFAULT 0,
  inicio_estimado TEXT,
  duracion_min INTEGER CHECK (duracion_min IS NULL OR duracion_min BETWEEN 1 AND 1440),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX subtareas_tarea_idx ON subtareas (tarea_id, orden);
CREATE INDEX subtareas_responsable_idx ON subtareas (responsable_id);

-- Historial global. Lo escribe únicamente el servidor (server/servicio.ts).
CREATE TABLE eventos (
  id TEXT PRIMARY KEY,
  tarea_id TEXT REFERENCES tareas (id) ON DELETE SET NULL,
  proyecto_id TEXT REFERENCES proyectos (id) ON DELETE SET NULL,
  persona_id TEXT REFERENCES personas (id) ON DELETE SET NULL,
  accion TEXT NOT NULL CHECK (accion IN (
    'creada', 'editada', 'estado', 'devuelta', 'movida_cuadrante',
    'eliminada', 'restaurada', 'borrada_definitiva', 'reasignada',
    'subtarea_creada', 'subtarea_editada', 'subtarea_hecha', 'subtarea_deshecha',
    'subtarea_eliminada',
    'proyecto_creado', 'proyecto_editado', 'proyecto_estado', 'proyecto_eliminado'
  )),
  cambios TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(cambios)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX eventos_fecha_idx ON eventos (created_at DESC);
CREATE INDEX eventos_tarea_idx ON eventos (tarea_id, created_at DESC);
CREATE INDEX eventos_proyecto_idx ON eventos (proyecto_id);
CREATE INDEX eventos_persona_idx ON eventos (persona_id);

CREATE TABLE configuracion (
  clave TEXT PRIMARY KEY CHECK (clave GLOB '[a-z]*' AND length(clave) <= 60),
  valor TEXT NOT NULL CHECK (json_valid(valor)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- updated_at automático en todas las tablas.
CREATE TRIGGER personas_updated_at AFTER UPDATE ON personas WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE personas SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id; END;
CREATE TRIGGER clientes_updated_at AFTER UPDATE ON clientes WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE clientes SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id; END;
CREATE TRIGGER categorias_updated_at AFTER UPDATE ON categorias WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE categorias SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id; END;
CREATE TRIGGER proyectos_updated_at AFTER UPDATE ON proyectos WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE proyectos SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id; END;
CREATE TRIGGER tareas_updated_at AFTER UPDATE ON tareas WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE tareas SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id; END;
CREATE TRIGGER tarea_responsables_updated_at AFTER UPDATE ON tarea_responsables
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE tarea_responsables SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE tarea_id = NEW.tarea_id AND persona_id = NEW.persona_id;
END;
CREATE TRIGGER subtareas_updated_at AFTER UPDATE ON subtareas WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE subtareas SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id; END;
CREATE TRIGGER eventos_updated_at AFTER UPDATE ON eventos WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE eventos SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id; END;
CREATE TRIGGER configuracion_updated_at AFTER UPDATE ON configuracion
  WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE configuracion SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE clave = NEW.clave;
END;
