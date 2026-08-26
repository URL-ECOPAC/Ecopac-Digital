-- Habilitar Row Level Security
ALTER TABLE bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

-- Política para Bodegas
CREATE POLICY "Solo Administrador puede modificar bodegas"
  ON bodegas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid() AND perfiles.rol = 'administrador'
    )
  );

-- Política para Proveedores
CREATE POLICY "Solo Administrador puede modificar proveedores"
  ON proveedores FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles
      WHERE perfiles.id = auth.uid() AND perfiles.rol = 'administrador'
    )
  );

-- Políticas para la tabla 'proveedores'
CREATE POLICY "Lectura de proveedores para usuarios autenticados"
  ON proveedores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo Administrador puede modificar proveedores"
  ON proveedores FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE usuarios.id = auth.uid() AND usuarios.rol = 'administrador'
    )
  );