-- Agregar columna es_vigente a condiciones_cronicas si no existe
ALTER TABLE public.condiciones_cronicas
ADD COLUMN IF NOT EXISTS es_vigente BOOLEAN NOT NULL DEFAULT true;