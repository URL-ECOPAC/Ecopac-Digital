-- Habilitar RLS en las tres tablas
ALTER TABLE public.donantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donacion_detalle ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas si existen
DROP POLICY IF EXISTS "Permitir lectura de donantes a Administrador y Junta Directiva" ON public.donantes;
DROP POLICY IF EXISTS "Permitir insercion/actualizacion de donantes a Administrador y Junta Directiva" ON public.donantes;
DROP POLICY IF EXISTS "Impedir eliminacion fisica de donantes" ON public.donantes;

DROP POLICY IF EXISTS "Permitir lectura de donaciones a Administrador y Junta Directiva" ON public.donaciones;
DROP POLICY IF EXISTS "Permitir insercion de donaciones a Administrador y Junta Directiva" ON public.donaciones;
DROP POLICY IF EXISTS "Permitir anular donaciones a Administrador y Junta Directiva" ON public.donaciones;
DROP POLICY IF EXISTS "Impedir eliminacion fisica de donaciones" ON public.donaciones;

DROP POLICY IF EXISTS "Permitir lectura de detalle a Administrador y Junta Directiva" ON public.donacion_detalle;
DROP POLICY IF EXISTS "Permitir insercion de detalle a Administrador y Junta Directiva" ON public.donacion_detalle;

--------------------------------------------------------------------------------
-- POLÍTICAS PARA TABLA: donantes
--------------------------------------------------------------------------------

-- Lectura: Solo Administrador y Junta Directiva
CREATE POLICY "Permitir lectura de donantes a Administrador y Junta Directiva"
ON public.donantes
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Administrador', 'Junta Directiva')
);

-- Inserción y actualización: Solo Administrador y Junta Directiva
CREATE POLICY "Permitir insercion/actualizacion de donantes a Administrador y Junta Directiva"
ON public.donantes
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Administrador', 'Junta Directiva')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Administrador', 'Junta Directiva')
);

--------------------------------------------------------------------------------
-- POLÍTICAS PARA TABLA: donaciones
--------------------------------------------------------------------------------

-- Lectura: Solo Administrador y Junta Directiva
CREATE POLICY "Permitir lectura de donaciones a Administrador y Junta Directiva"
ON public.donaciones
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Administrador', 'Junta Directiva')
);

-- Inserción: Solo Administrador y Junta Directiva
CREATE POLICY "Permitir insercion de donaciones a Administrador y Junta Directiva"
ON public.donaciones
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Administrador', 'Junta Directiva')
);

-- Actualización (Solo para anular con motivo): no se permite cambiar datos históricos, solo estado/motivo
CREATE POLICY "Permitir anular donaciones a Administrador y Junta Directiva"
ON public.donaciones
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Administrador', 'Junta Directiva')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Administrador', 'Junta Directiva')
  AND estado::text IN ('ANULADA', 'anulada')
  AND motivo_anulacion IS NOT NULL
  AND length(trim(motivo_anulacion)) > 0
);

--------------------------------------------------------------------------------
-- POLÍTICAS PARA TABLA: donacion_detalle
--------------------------------------------------------------------------------

-- Lectura: Solo Administrador y Junta Directiva
CREATE POLICY "Permitir lectura de detalle a Administrador y Junta Directiva"
ON public.donacion_detalle
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Administrador', 'Junta Directiva')
);

-- Inserción: Solo Administrador y Junta Directiva
CREATE POLICY "Permitir insercion de detalle a Administrador y Junta Directiva"
ON public.donacion_detalle
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Administrador', 'Junta Directiva')
);