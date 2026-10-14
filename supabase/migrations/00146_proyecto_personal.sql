-- Ecopac Digital - Equipo de un proyecto: tabla proyecto_personal
--
-- La pestana "Equipo" del detalle de un proyecto no tenia de donde leer: el unico equipo que
-- existe es jornada_personal (00012), que es el cuadro de turnos de UNA jornada -con horario y
-- rol clinico- y no la gente que sostiene un proyecto de principio a fin. Una persona puede estar
-- en el equipo de un proyecto sin estar en el turno de ninguna de sus jornadas (quien coordina,
-- quien rinde cuentas), y al reves, asi que no se deriva de jornada_personal: es su propia tabla.
--
-- Mismo patron que jornada_personal, sin lo que solo tiene sentido en una jornada (horas y
-- responsabilidad). `rol_en_proyecto` es texto libre y opcional -"Coordinadora", "Enlace con la
-- comunidad"- y no el enum rol_usuario: el rol de sistema de la persona ya vive en perfiles.rol
-- y lo que se anota aqui es su funcion dentro de este proyecto.
--
-- Este archivo solo crea; no toca ninguna politica existente. En particular NO amplia la lectura
-- de proyectos: estar en el equipo de un proyecto no lo hace visible para quien hoy no lo ve
-- (#864: el medico ve solo los proyectos de las jornadas en las que participa).

-- ============================================================================
-- 1. Tabla
-- ============================================================================
-- UNIQUE (proyecto_id, perfil_id): una persona figura una sola vez en el equipo de un proyecto.
-- ON DELETE CASCADE en las dos FK, igual que jornada_personal: si el proyecto o el perfil dejan
-- de existir, la asignacion no tiene a que apuntar.
CREATE TABLE proyecto_personal (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  perfil_id UUID NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  rol_en_proyecto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proyecto_id, perfil_id),
  -- Sin rol se guarda NULL, nunca '' ni espacios: es lo que la interfaz consulta como "sin rol".
  CONSTRAINT chk_proyecto_personal_rol
    CHECK (rol_en_proyecto IS NULL OR (length(btrim(rol_en_proyecto)) > 0 AND length(rol_en_proyecto) <= 100))
);

COMMENT ON TABLE proyecto_personal IS
  'Equipo de un proyecto: quien participa en el, con una funcion opcional (rol_en_proyecto). No es jornada_personal (00012): aquel es el cuadro de turnos de una jornada y este es la gente del proyecto, este o no en el turno de alguna de sus jornadas.';

COMMENT ON COLUMN proyecto_personal.rol_en_proyecto IS
  'Funcion de la persona dentro de ESTE proyecto, en texto libre. No es perfiles.rol (el rol de sistema) ni jornada_personal.rol_en_jornada (el rol clinico de un turno). NULL cuando no se anoto ninguno.';

CREATE INDEX idx_proyecto_personal_perfil_id ON proyecto_personal (perfil_id);

CREATE TRIGGER trg_proyecto_personal_updated_at
BEFORE UPDATE ON proyecto_personal
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

COMMENT ON TRIGGER trg_proyecto_personal_updated_at ON proyecto_personal IS
  'Actualiza automaticamente updated_at antes de cada UPDATE de una fila de proyecto_personal.';

-- ============================================================================
-- 2. RLS y privilegios
-- ============================================================================
ALTER TABLE proyecto_personal ENABLE ROW LEVEL SECURITY;

-- Sin anon (00049/00056, y la prueba privilegios_anon.sql lo comprueba tabla por tabla). DELETE se
-- concede a proposito y por nombre: desde la 00120 una tabla nueva no lo hereda, y aqui si hay
-- politica de DELETE que lo gobierna.
REVOKE ALL ON proyecto_personal FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON proyecto_personal TO authenticated;

-- Lectura: quien puede ver el proyecto ve su equipo completo. No se repite aqui la lista de roles
-- de la politica de proyectos: el EXISTS pasa por ella (una subconsulta sobre otra tabla con RLS
-- se evalua con los permisos de quien consulta), asi que si esa politica cambia, esta cambia con
-- ella y no pueden divergir. Hoy son la administradora, quien tenga proyectos.gestionar (00086) y
-- quien participa en una jornada del proyecto (00141). La rama perfil_id = auth.uid() deja a cada
-- persona leer su propia asignacion aunque no vea el proyecto, como en jornada_personal (00039).
CREATE POLICY "Quien ve el proyecto ve su equipo; cada quien lee su asignacion"
  ON proyecto_personal FOR SELECT TO authenticated
  USING (
    public.es_administrador()
    OR perfil_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_personal.proyecto_id
    )
  );

-- Escritura: la misma regla que proyectos (00039, 00086): administrador o proyectos.gestionar.
-- Quien puede editar un proyecto puede armar su equipo; nadie mas.
CREATE POLICY "Administrador o proyectos.gestionar asigna equipo de proyectos"
  ON proyecto_personal FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));

CREATE POLICY "Administrador o proyectos.gestionar actualiza equipo de proyectos"
  ON proyecto_personal FOR UPDATE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));

CREATE POLICY "Administrador o proyectos.gestionar desasigna equipo de proyectos"
  ON proyecto_personal FOR DELETE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));

-- ============================================================================
-- 3. equipo_de_proyecto(): el equipo con sus nombres, para quien no lee perfiles
-- ============================================================================
-- perfiles solo la lee la administradora y cada quien la suya (00038), asi que un
-- `perfiles(nombres, apellidos)` embebido le devolvia al medico las filas del equipo SIN nombre
-- para las demas personas. Esta funcion es el camino enmascarado: SECURITY DEFINER para poder leer
-- perfiles, pero devuelve UNICAMENTE nombres y apellidos -nunca telefono ni correo, que es lo que
-- perfiles_directorio (00038) protege- y solo de las filas que la persona ya puede ver.
--
-- Como un DEFINER no pasa por la RLS de quien llama, la regla de "que filas ve" se escribe aqui a
-- mano: es la de la politica de SELECT de proyecto_personal (administrador, la propia asignacion,
-- o un proyecto visible), y la de un proyecto visible es la de proyectos tras la 00141
-- (proyectos.gestionar, o participar en una jornada del proyecto). Son dos copias de una misma
-- regla y pueden divergir: la prueba proyecto_personal.sql compara esta funcion contra la lectura
-- directa de la tabla, rol por rol, para que el dia que una cambie sin la otra el CI lo diga.
--
-- SET search_path = '' y nombres calificados, como el resto de las funciones DEFINER del esquema.
CREATE OR REPLACE FUNCTION equipo_de_proyecto(p_proyecto_id UUID)
RETURNS TABLE (
  id UUID,
  proyecto_id UUID,
  perfil_id UUID,
  rol_en_proyecto TEXT,
  created_at TIMESTAMPTZ,
  nombres VARCHAR(100),
  apellidos VARCHAR(100)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pp.id, pp.proyecto_id, pp.perfil_id, pp.rol_en_proyecto, pp.created_at,
         pe.nombres, pe.apellidos
  FROM public.proyecto_personal pp
  JOIN public.perfiles pe ON pe.id = pp.perfil_id
  WHERE pp.proyecto_id = p_proyecto_id
    AND (
      public.es_administrador()
      OR public.tiene_permiso('proyectos.gestionar')
      OR pp.perfil_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.jornadas j
        WHERE j.proyecto_id = pp.proyecto_id
          AND public.pertenece_a_jornada(j.id)
      )
    )
  ORDER BY pp.created_at;
$$;

COMMENT ON FUNCTION equipo_de_proyecto(UUID) IS
  'El equipo de un proyecto con nombre y apellido de cada persona, para quien no puede leer perfiles (00038). DEFINER; devuelve solo nombres, nunca contacto. Repite a mano la regla de SELECT de proyecto_personal, y proyecto_personal.sql la compara contra la tabla rol por rol.';

-- Recien creada: nace con EXECUTE abierto a PUBLIC (00102, 00120). Solo authenticated la ejecuta.
REVOKE EXECUTE ON FUNCTION equipo_de_proyecto(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION equipo_de_proyecto(UUID) TO authenticated;
