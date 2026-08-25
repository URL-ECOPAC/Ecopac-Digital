CREATE TABLE proyecto_hitos (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  fecha_prevista DATE NOT NULL,
  fecha_real DATE,
  registrado_por UUID DEFAULT auth.uid() REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proyecto_hitos_proyecto_id ON proyecto_hitos (proyecto_id);

CREATE INDEX idx_proyecto_hitos_pendientes
  ON proyecto_hitos (proyecto_id)
  WHERE fecha_real IS NULL;

ALTER TABLE proyecto_hitos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_proyecto_hitos_updated_at
BEFORE UPDATE ON proyecto_hitos
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

COMMENT ON TABLE proyecto_hitos IS
  'Hitos de un proyecto social. Un hito esta pendiente mientras fecha_real sea nula.';

COMMENT ON COLUMN proyecto_hitos.fecha_real IS
  'Fecha en que el hito se cumplio. Nula mientras siga pendiente. No se compara con fecha_prevista: cumplir antes de lo previsto es valido.';

COMMENT ON COLUMN proyecto_hitos.registrado_por IS
  'Quien creo el hito. El valor por defecto lo toma de auth.uid() para que la aplicacion no tenga que enviarlo ni pueda falsearlo.';

COMMENT ON INDEX idx_proyecto_hitos_pendientes IS
  'Indice parcial para la advertencia de cierre, que solo pregunta por los hitos sin fecha real.';

CREATE TABLE proyecto_seguimiento (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  nota TEXT,
  porcentaje_anterior INTEGER,
  porcentaje_nuevo INTEGER,
  registrado_por UUID DEFAULT auth.uid() REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_proyecto_seguimiento_contenido
    CHECK (nota IS NOT NULL OR porcentaje_nuevo IS NOT NULL),
  CONSTRAINT chk_proyecto_seguimiento_porcentajes
    CHECK (
      (porcentaje_anterior IS NULL OR porcentaje_anterior BETWEEN 0 AND 100)
      AND (porcentaje_nuevo IS NULL OR porcentaje_nuevo BETWEEN 0 AND 100)
    )
);

CREATE INDEX idx_proyecto_seguimiento_proyecto_fecha
  ON proyecto_seguimiento (proyecto_id, created_at DESC);

ALTER TABLE proyecto_seguimiento ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE proyecto_seguimiento IS
  'Bitacora de un proyecto: notas escritas a mano y cambios de porcentaje de avance, estos ultimos anotados por trigger. No lleva updated_at ni politicas de UPDATE o DELETE porque una bitacora no se corrige, se anota encima.';

COMMENT ON CONSTRAINT chk_proyecto_seguimiento_contenido ON proyecto_seguimiento IS
  'Una entrada sin nota y sin cambio de porcentaje no dice nada, asi que no se guarda.';

CREATE OR REPLACE FUNCTION registrar_avance_de_proyecto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.porcentaje_avance IS DISTINCT FROM NEW.porcentaje_avance THEN
    INSERT INTO public.proyecto_seguimiento (
      proyecto_id,
      porcentaje_anterior,
      porcentaje_nuevo,
      registrado_por
    )
    VALUES (NEW.id, OLD.porcentaje_avance, NEW.porcentaje_avance, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION registrar_avance_de_proyecto() IS
  'Anota en proyecto_seguimiento cada cambio del porcentaje de avance, con quien lo hizo y cuando. Mismo criterio que registrar_cambio_estado_proyecto() de la 00029: el rastro lo deja la base de datos, no la aplicacion, para que no dependa de que el cliente se acuerde.';

CREATE TRIGGER trg_proyectos_avance_seguimiento
AFTER UPDATE OF porcentaje_avance ON proyectos
FOR EACH ROW
EXECUTE FUNCTION registrar_avance_de_proyecto();

GRANT SELECT ON proyecto_hitos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON proyecto_hitos TO authenticated;
GRANT SELECT ON proyecto_seguimiento TO anon, authenticated;
GRANT INSERT ON proyecto_seguimiento TO authenticated;

CREATE POLICY "Administrador y junta directiva leen los hitos"
  ON proyecto_hitos FOR SELECT TO authenticated
  USING (public.es_administrador() OR public.rol_actual() = 'junta directiva');

CREATE POLICY "Solo administrador crea hitos"
  ON proyecto_hitos FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador actualiza hitos"
  ON proyecto_hitos FOR UPDATE TO authenticated
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador borra hitos"
  ON proyecto_hitos FOR DELETE TO authenticated
  USING (public.es_administrador());

CREATE POLICY "Administrador y junta directiva leen la bitacora"
  ON proyecto_seguimiento FOR SELECT TO authenticated
  USING (public.es_administrador() OR public.rol_actual() = 'junta directiva');

CREATE POLICY "Solo administrador anota en la bitacora"
  ON proyecto_seguimiento FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador());
