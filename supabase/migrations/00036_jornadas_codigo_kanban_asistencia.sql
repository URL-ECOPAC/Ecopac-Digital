-- Ecopac Digital - Agrega columnas faltantes de JORNADA y JORNADA_PERSONAL
-- Estas columnas estan en el diccionario de datos original de JORNADA y
-- JORNADA_PERSONAL (entregable Semana 6) pero se omitieron al escribir la 00012
-- (issue #159 o equivalente), que ya esta aplicada en el proyecto remoto ecopac-dev
-- (confirmado con supabase migration list --linked): se agregan hacia adelante en vez
-- de editarla. El issue #286 (descriptores de shared/jornadas) las necesita para el
-- kanban (orden_kanban) y la pantalla de asignacion de personal (asistio).

-- ============================================================================
-- jornadas
-- ============================================================================
ALTER TABLE jornadas
  -- El diccionario original marca codigo como NOT NULL UK, pero no hay forma segura
  -- de generar un valor para filas ya existentes en ecopac-dev sin saber si tiene
  -- datos: se agrega nullable con UNIQUE. Una migracion futura, cuando la app ya
  -- genere el codigo al crear una jornada, puede hacer el backfill y endurecerla a
  -- NOT NULL.
  ADD COLUMN codigo VARCHAR(30) UNIQUE,
  ADD COLUMN fecha_inicio_real TIMESTAMPTZ,
  ADD COLUMN fecha_fin_real TIMESTAMPTZ,
  ADD COLUMN orden_kanban INT,
  ADD COLUMN cupo_estimado INT,
  ADD COLUMN botiquin_bodega_id UUID REFERENCES bodegas(id) ON DELETE SET NULL;

ALTER TABLE jornadas
  ADD CONSTRAINT chk_jornadas_cupo_estimado_no_negativo CHECK (cupo_estimado IS NULL OR cupo_estimado >= 0);

CREATE INDEX idx_jornadas_botiquin_bodega_id ON jornadas (botiquin_bodega_id);

-- ============================================================================
-- jornada_personal
-- ============================================================================
-- NOT NULL DEFAULT FALSE es seguro de agregar aunque la tabla ya tenga filas:
-- Postgres las llena con el DEFAULT al aplicar la migracion, sin backfill manual.
ALTER TABLE jornada_personal
  ADD COLUMN asistio BOOLEAN NOT NULL DEFAULT FALSE;
