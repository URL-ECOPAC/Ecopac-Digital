-- Agregar columna es_vigente a la tabla comunidades para borrado logico
ALTER TABLE comunidades
ADD COLUMN IF NOT EXISTS es_vigente BOOLEAN NOT NULL DEFAULT true;