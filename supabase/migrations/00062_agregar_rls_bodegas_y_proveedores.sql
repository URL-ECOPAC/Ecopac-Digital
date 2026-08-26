-- Habilitar Row Level Security
ALTER TABLE bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

-- Políticas para la tabla 'bodegas'
DROP POLICY IF EXISTS "Lectura de bodegas para usuarios autenticados" ON bodegas;
CREATE POLICY "Lectura de bodegas para usuarios autenticados"
  ON bodegas FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Solo Administrador puede modificar bodegas" ON bodegas;
CREATE POLICY "Solo Administrador puede modificar bodegas"
  ON bodegas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid() AND perfiles.rol = 'administrador'
    )
  );

-- Políticas para la tabla 'proveedores'
DROP POLICY IF EXISTS "Lectura de proveedores para usuarios autenticados" ON proveedores;
CREATE POLICY "Lectura de proveedores para usuarios autenticados"
  ON proveedores FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Solo Administrador puede modificar proveedores" ON proveedores;
CREATE POLICY "Solo Administrador puede modificar proveedores"
  ON proveedores FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid() AND perfiles.rol = 'administrador'
    )
  );