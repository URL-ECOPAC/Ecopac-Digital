-- Politica de insercion para comunidades (solo administrador)
CREATE POLICY "Administrador crea comunidades"
  ON comunidades
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
        AND perfiles.rol = 'administrador'
    )
  );

-- Politica de actualizacion para comunidades (solo administrador)
CREATE POLICY "Administrador actualiza comunidades"
  ON comunidades
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
        AND perfiles.rol = 'administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
        AND perfiles.rol = 'administrador'
    )
  );