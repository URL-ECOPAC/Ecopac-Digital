-- Ecopac Digital - Acceso a modulos por rol, y funciones de administracion delegables por persona
--
-- QUE CAMBIA. Hasta aqui la "matriz de permisos por rol" (00139) editaba rol_permiso: los nueve
-- permisos finos que trae cada rol por defecto. Probandola en uso real no servia: conceder
-- `donaciones.registrar` a medico no le abria nada, porque el menu, las rutas y los botones se
-- deciden por rol en el cliente y ninguno de ellos leia rol_permiso. La matriz prometia algo que el
-- sistema no hacia.
--
-- Ahora cada pieza hace una sola cosa:
--
--   - La MATRIZ decide que MODULOS ve cada rol ademas de los suyos (tabla nueva `rol_modulo`).
--     Abrir un modulo desde la matriz es de SOLO LECTURA: se ve la pantalla y sus datos, pero
--     registrar, aprobar o eliminar sigue siendo de quien ya podia (issue de esta migracion).
--   - Las FUNCIONES DE ADMINISTRACION se delegan por persona, desde el modal de permisos de
--     Colaboradores (usuario_permiso, sin cambios de forma). Esta migracion termina de conectar
--     las lecturas que les faltaban para que una delegacion funcione de punta a punta.
--   - rol_permiso deja de editarse: queda como el valor por defecto de cada rol, sembrado por
--     migracion. Con eso se cierra ademas la divergencia abierta de la 00139 -rol_permiso no tenia
--     el guardia que impide volver escritor a un rol consultivo-, porque ya nadie la escribe.
--
-- Y fija el piso de cada rol que pidio la administracion:
--
--   - Administradora: todo.
--   - Junta directiva y socio fundador: solo Reportes, y en Reportes todo -incluido el reporte de
--     jornada, que hasta aqui leia tablas clinicas crudas y por eso no se les daba (fn nueva abajo).
--   - Medico y colaborador (voluntario general):
--       * Pacientes por completo; el colaborador suma el historial clinico. Consultas y recetas
--         siguen siendo del medico: las firma un medico (medico_id). Ninguno elimina pacientes
--         (baja logica), diagnosticos, condiciones ni comunidades; si los crean y corrigen.
--       * Inventario completo salvo la validacion: registran movimientos (pendientes) y crean y
--         corrigen catalogos, nunca eliminan ni desactivan.
--       * Jornadas y proyectos de los que forman parte, sin crear ni editar.
--       * Presupuestos de lo suyo, sin aprobaciones; sus gastos entran pendientes.
--
-- Todo lo nuevo se escribe con dos funciones de apoyo para que las politicas se lean igual:
-- es_personal_de_campo() y accede_a_modulo_por_matriz(modulo).

-- ============================================================================
-- 1. Funciones de apoyo
-- ============================================================================

-- Los modulos que cada rol tiene POR DEFECTO. Es el espejo de MODULOS[].roles en
-- packages/shared/navegacion.js: la matriz no puede conceder uno de estos (ya los tiene) y la
-- restriccion de rol_modulo lo usa. IMMUTABLE porque la respuesta solo depende de los argumentos,
-- que es lo que exige un CHECK.
CREATE OR REPLACE FUNCTION public.modulo_por_defecto(p_rol public.rol_usuario, p_modulo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_rol = 'administrador' THEN TRUE
    WHEN p_rol IN ('medico', 'voluntario general') THEN
      p_modulo IN ('pacientes', 'inventario', 'jornadas', 'proyectos', 'presupuestos')
    WHEN p_rol IN ('junta directiva', 'socio fundador') THEN p_modulo = 'reportes'
    ELSE FALSE
  END;
$$;

COMMENT ON FUNCTION public.modulo_por_defecto(public.rol_usuario, TEXT) IS
  'Modulos que un rol ve por defecto, espejo de MODULOS[].roles (packages/shared/navegacion.js). La matriz de acceso (rol_modulo) solo concede modulos fuera de esta lista.';

-- Medico o voluntario general: el personal que atiende en campo. Se repite en una docena de
-- politicas nuevas; escrito una vez se lee igual en todas.
CREATE OR REPLACE FUNCTION public.es_personal_de_campo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.rol_actual() IN ('medico', 'voluntario general');
$$;

COMMENT ON FUNCTION public.es_personal_de_campo() IS
  'Si la sesion es medico o voluntario general (y esta activa: rol_actual() es NULL para un perfil desactivado).';

-- ============================================================================
-- 2. rol_modulo: la matriz de acceso a modulos
-- ============================================================================
-- Una fila = "este rol ve este modulo, en solo lectura, aunque no sea suyo". Solo guarda lo que la
-- administradora abrio: los modulos por defecto no se escriben (modulo_por_defecto) y la
-- administradora no necesita filas.
--
-- id propio (y no la llave compuesta de rol_permiso) para poder usar el trigger generico de
-- auditoria, que toma `id` como fila_id: la 00139 tuvo que escribir una funcion aparte por no
-- tenerlo.
CREATE TABLE rol_modulo (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  rol public.rol_usuario NOT NULL,
  modulo VARCHAR(50) NOT NULL,
  otorgado_por UUID REFERENCES perfiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  otorgado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rol_modulo UNIQUE (rol, modulo),
  -- Matriz de permisos y bitacora de auditoria no estan: se quedan siempre en la administradora.
  CONSTRAINT chk_rol_modulo_modulo CHECK (
    modulo IN (
      'pacientes', 'inventario', 'jornadas', 'proyectos',
      'presupuestos', 'donaciones', 'reportes', 'colaboradores'
    )
  ),
  CONSTRAINT chk_rol_modulo_no_por_defecto CHECK (NOT public.modulo_por_defecto(rol, modulo))
);

COMMENT ON TABLE rol_modulo IS
  'Modulos que la administradora abrio a un rol ademas de los suyos (matriz de acceso, web). Abrir es de solo lectura: las politicas de escritura no miran esta tabla.';

ALTER TABLE rol_modulo ENABLE ROW LEVEL SECURITY;

-- Solo authenticated, nunca anon (regla de la 00049). Sin UPDATE: no hay columna que corregir,
-- conceder es insertar y retirar es borrar.
GRANT SELECT, INSERT, DELETE ON rol_modulo TO authenticated;

-- Cualquier sesion activa lee la matriz: el cliente la necesita para dibujar su menu.
CREATE POLICY "Sesion activa lee rol_modulo"
  ON rol_modulo FOR SELECT
  USING (public.rol_actual() IS NOT NULL);

CREATE POLICY "Solo administrador concede modulos"
  ON rol_modulo FOR INSERT
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador retira modulos"
  ON rol_modulo FOR DELETE
  USING (public.es_administrador());

CREATE TRIGGER trg_rol_modulo_auditoria
AFTER INSERT OR DELETE ON rol_modulo
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria();

-- SECURITY DEFINER para no pasar por la RLS de rol_modulo en cada fila de cada politica que la
-- consulta. rol_actual() ya devuelve NULL para un perfil desactivado, asi que un perfil dado de
-- baja no alcanza nada por aqui.
CREATE OR REPLACE FUNCTION public.accede_a_modulo_por_matriz(p_modulo TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rol_modulo rm
    WHERE rm.rol = public.rol_actual()
      AND rm.modulo = p_modulo
  );
$$;

COMMENT ON FUNCTION public.accede_a_modulo_por_matriz(TEXT) IS
  'Si la matriz de acceso le abrio este modulo al rol de la sesion. Solo se usa en politicas de LECTURA: abrir un modulo no da escritura.';

-- Lo que el cliente necesita para dibujar menu, rutas y botones: los modulos que la matriz le
-- abrio a su rol y sus permisos finos efectivos (los de su rol mas sus excepciones personales,
-- resueltos por tiene_permiso(), la misma funcion que usan las politicas). Una sola llamada al
-- iniciar sesion.
CREATE OR REPLACE FUNCTION public.mis_accesos()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'modulos',
    COALESCE(
      (SELECT jsonb_agg(rm.modulo ORDER BY rm.modulo)
         FROM public.rol_modulo rm
        WHERE rm.rol = public.rol_actual()),
      '[]'::jsonb
    ),
    'permisos',
    COALESCE(
      (SELECT jsonb_agg(p.clave ORDER BY p.clave)
         FROM public.permisos p
        WHERE public.rol_actual() IS NOT NULL
          AND public.tiene_permiso(p.clave)),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION public.mis_accesos() IS
  'Modulos abiertos por la matriz al rol de la sesion y sus permisos finos efectivos. Solo describe a quien llama.';

-- La 00102 fijo que ninguna funcion queda con EXECUTE para PUBLIC.
REVOKE EXECUTE ON FUNCTION public.modulo_por_defecto(public.rol_usuario, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.es_personal_de_campo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accede_a_modulo_por_matriz(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mis_accesos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.modulo_por_defecto(public.rol_usuario, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_personal_de_campo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accede_a_modulo_por_matriz(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_accesos() TO authenticated;

-- ============================================================================
-- 3. rol_permiso vuelve a ser de solo lectura
-- ============================================================================
-- La matriz ya no la edita. Sin escritura, la asimetria documentada en la 00139 (no tenia el
-- guardia impedir_permiso_escritura_a_consultivo) deja de ser alcanzable.
DROP POLICY "Solo administrador escribe rol_permiso" ON rol_permiso;
DROP POLICY "Solo administrador borra rol_permiso" ON rol_permiso;
REVOKE INSERT, DELETE ON rol_permiso FROM authenticated;

-- El colaborador edita pacientes desde esta migracion, igual que el medico: pacientes.editar es el
-- permiso que gobierna el UPDATE de pacientes y expedientes (00086).
INSERT INTO rol_permiso (rol, permiso_id)
SELECT 'voluntario general', id FROM permisos WHERE clave = 'pacientes.editar'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. Delegar por persona: nadie se concede permisos a si mismo
-- ============================================================================
-- Quien tiene usuarios.gestionar_permisos sin ser administrador podia escribir su propia fila de
-- usuario_permiso y darse cualquier otro permiso. Ahora que esa delegacion se usa de verdad, se
-- cierra: gestiona los permisos de los demas, nunca los suyos.
ALTER POLICY "Solo administrador escribe usuario_permiso" ON usuario_permiso
  WITH CHECK (
    public.es_administrador()
    OR (public.tiene_permiso('usuarios.gestionar_permisos') AND perfil_id <> auth.uid())
  );

ALTER POLICY "Solo administrador actualiza usuario_permiso" ON usuario_permiso
  USING (
    public.es_administrador()
    OR (public.tiene_permiso('usuarios.gestionar_permisos') AND perfil_id <> auth.uid())
  )
  WITH CHECK (
    public.es_administrador()
    OR (public.tiene_permiso('usuarios.gestionar_permisos') AND perfil_id <> auth.uid())
  );

ALTER POLICY "Solo administrador borra usuario_permiso" ON usuario_permiso
  USING (
    public.es_administrador()
    OR (public.tiene_permiso('usuarios.gestionar_permisos') AND perfil_id <> auth.uid())
  );

-- ============================================================================
-- 5. Pacientes
-- ============================================================================
ALTER POLICY "Administrador, medico y voluntario leen pacientes" ON pacientes
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );

ALTER POLICY "Administrador, medico y voluntario leen expedientes" ON expedientes
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );

ALTER POLICY "Administrador, medico y voluntario leen atenciones" ON atenciones
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );

ALTER POLICY "Administrador, medico y voluntario leen triajes" ON triajes
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );

-- Corregir un triaje deja de ser solo del medico: el colaborador lo toma y lo corrige.
ALTER POLICY "Administrador y medico editan triajes" ON triajes
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Administrador y medico editan triajes" ON triajes
  RENAME TO "Administrador y personal de campo editan triajes";

-- El historial clinico: el colaborador ahora lo lee entero. Escribir consultas y recetas sigue
-- siendo del medico (sus politicas de INSERT/UPDATE no cambian).
ALTER POLICY "Medico y administrador leen consultas" ON consultas
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );
ALTER POLICY "Medico y administrador leen consultas" ON consultas
  RENAME TO "Administrador y personal de campo leen consultas";

ALTER POLICY "Medico y administrador leen consulta_diagnostico" ON consulta_diagnostico
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );
ALTER POLICY "Medico y administrador leen consulta_diagnostico" ON consulta_diagnostico
  RENAME TO "Administrador y personal de campo leen consulta_diagnostico";

ALTER POLICY "Medico y administrador leen recetas" ON recetas
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );
ALTER POLICY "Medico y administrador leen recetas" ON recetas
  RENAME TO "Administrador y personal de campo leen recetas";

ALTER POLICY "Medico y administrador leen receta_detalle" ON receta_detalle
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );
ALTER POLICY "Medico y administrador leen receta_detalle" ON receta_detalle
  RENAME TO "Administrador y personal de campo leen receta_detalle";

ALTER POLICY "Medico y administrador leen padecimientos_cronicos" ON padecimientos_cronicos
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );
ALTER POLICY "Medico y administrador leen padecimientos_cronicos" ON padecimientos_cronicos
  RENAME TO "Administrador y personal de campo leen padecimientos_cronicos";

-- Registrar y corregir la condicion de un paciente: tambien el colaborador. Quitarla (DELETE)
-- sigue siendo solo de la administradora.
ALTER POLICY "Medico y administrador registran padecimientos_cronicos" ON padecimientos_cronicos
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Medico y administrador registran padecimientos_cronicos" ON padecimientos_cronicos
  RENAME TO "Administrador y personal de campo registran padecimientos";

ALTER POLICY "Medico y administrador actualizan padecimientos_cronicos" ON padecimientos_cronicos
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Medico y administrador actualizan padecimientos_cronicos" ON padecimientos_cronicos
  RENAME TO "Administrador y personal de campo actualizan padecimientos";

-- Catalogo de diagnosticos: el personal de campo lo lee, agrega y corrige. Desactivar (lo mas
-- parecido a eliminarlo: no hay DELETE, 00018 lo referencia con RESTRICT) lo impide el trigger de
-- abajo.
ALTER POLICY "Medico y administrador leen diagnosticos" ON diagnosticos
  USING (
    public.es_administrador()
    OR public.es_personal_de_campo()
    OR public.accede_a_modulo_por_matriz('pacientes')
  );
ALTER POLICY "Medico y administrador leen diagnosticos" ON diagnosticos
  RENAME TO "Administrador y personal de campo leen diagnosticos";

ALTER POLICY "Solo administrador crea diagnosticos" ON diagnosticos
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador crea diagnosticos" ON diagnosticos
  RENAME TO "Administrador y personal de campo crean diagnosticos";

ALTER POLICY "Solo administrador edita diagnosticos" ON diagnosticos
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador edita diagnosticos" ON diagnosticos
  RENAME TO "Administrador y personal de campo editan diagnosticos";

-- Catalogo de condiciones cronicas: corregirlo tambien. No tiene DELETE para nadie.
ALTER POLICY "Solo administrador mantiene el catalogo de condiciones" ON condiciones_cronicas
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador mantiene el catalogo de condiciones" ON condiciones_cronicas
  RENAME TO "Administrador y personal de campo mantienen condiciones";

-- Comunidades: crear y corregir. Nadie tiene DELETE. De paso dejan de leer el rol de `perfiles`
-- a mano (00008): con rol_actual() un perfil desactivado tampoco crea comunidades (00079).
ALTER POLICY "Administrador crea comunidades" ON comunidades
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Administrador crea comunidades" ON comunidades
  RENAME TO "Administrador y personal de campo crean comunidades";

ALTER POLICY "Administrador actualiza comunidades" ON comunidades
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Administrador actualiza comunidades" ON comunidades
  RENAME TO "Administrador y personal de campo actualizan comunidades";

-- Dar de baja a un paciente (fecha_baja) es eliminarlo: solo la administradora. Un trigger y no la
-- politica, porque la politica de UPDATE no puede comparar el valor viejo con el nuevo (misma
-- razon que impedir_cambio_de_rol_propio, 00038).
CREATE OR REPLACE FUNCTION public.impedir_baja_de_paciente_sin_ser_administrador()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.fecha_baja IS DISTINCT FROM OLD.fecha_baja AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora da de baja o reactiva a un paciente.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_impedir_baja_de_paciente
BEFORE UPDATE OF fecha_baja ON pacientes
FOR EACH ROW
EXECUTE FUNCTION public.impedir_baja_de_paciente_sin_ser_administrador();

-- Desactivar un diagnostico o un medicamento es sacarlo de uso: lo mismo que eliminarlo para quien
-- lo busca. Solo la administradora. Reactivar si lo puede cualquiera que edite el catalogo.
CREATE OR REPLACE FUNCTION public.impedir_desactivar_sin_ser_administrador()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.activo AND NOT NEW.activo AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora desactiva un registro del catalogo.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_impedir_desactivar_diagnostico
BEFORE UPDATE OF activo ON diagnosticos
FOR EACH ROW
EXECUTE FUNCTION public.impedir_desactivar_sin_ser_administrador();

CREATE TRIGGER trg_impedir_desactivar_medicamento
BEFORE UPDATE OF activo ON medicamentos
FOR EACH ROW
EXECUTE FUNCTION public.impedir_desactivar_sin_ser_administrador();

-- Condiciones cronicas y comunidades se retiran con `es_vigente` (00115, 00008), no con `activo`:
-- misma regla, otra columna.
CREATE OR REPLACE FUNCTION public.impedir_retirar_sin_ser_administrador()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.es_vigente AND NOT NEW.es_vigente AND NOT public.es_administrador() THEN
    RAISE EXCEPTION 'Solo la administradora retira un registro del catalogo.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_impedir_retirar_condicion
BEFORE UPDATE OF es_vigente ON condiciones_cronicas
FOR EACH ROW
EXECUTE FUNCTION public.impedir_retirar_sin_ser_administrador();

CREATE TRIGGER trg_impedir_retirar_comunidad
BEFORE UPDATE OF es_vigente ON comunidades
FOR EACH ROW
EXECUTE FUNCTION public.impedir_retirar_sin_ser_administrador();

-- ============================================================================
-- 6. Inventario: el personal de campo crea y corrige catalogos, nunca elimina
-- ============================================================================
-- La lectura ya era de cualquier sesion activa (00079). Lotes no cambia: el personal de campo ya
-- los propone provisionales y los confirma la validacion (00106), igual que sus movimientos. Las
-- politicas de DELETE de principios_activos y presentaciones siguen siendo solo de la
-- administradora.
ALTER POLICY "Solo administrador crea bodegas" ON bodegas
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador crea bodegas" ON bodegas
  RENAME TO "Administrador y personal de campo crean bodegas";

ALTER POLICY "Solo administrador edita bodegas" ON bodegas
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador edita bodegas" ON bodegas
  RENAME TO "Administrador y personal de campo editan bodegas";

ALTER POLICY "Solo administrador crea proveedores" ON proveedores
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador crea proveedores" ON proveedores
  RENAME TO "Administrador y personal de campo crean proveedores";

ALTER POLICY "Solo administrador edita proveedores" ON proveedores
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador edita proveedores" ON proveedores
  RENAME TO "Administrador y personal de campo editan proveedores";

ALTER POLICY "Solo administrador crea medicamentos" ON medicamentos
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador crea medicamentos" ON medicamentos
  RENAME TO "Administrador y personal de campo crean medicamentos";

ALTER POLICY "Solo administrador edita medicamentos" ON medicamentos
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador edita medicamentos" ON medicamentos
  RENAME TO "Administrador y personal de campo editan medicamentos";

ALTER POLICY "Solo administrador asocia medicamento_principio" ON medicamento_principio
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador asocia medicamento_principio" ON medicamento_principio
  RENAME TO "Administrador y personal de campo asocian principios";

ALTER POLICY "Solo administrador crea principios_activos" ON principios_activos
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador crea principios_activos" ON principios_activos
  RENAME TO "Administrador y personal de campo crean principios_activos";

ALTER POLICY "Solo administrador edita principios_activos" ON principios_activos
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador edita principios_activos" ON principios_activos
  RENAME TO "Administrador y personal de campo editan principios_activos";

ALTER POLICY "Solo administrador crea presentaciones" ON presentaciones
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador crea presentaciones" ON presentaciones
  RENAME TO "Administrador y personal de campo crean presentaciones";

ALTER POLICY "Solo administrador edita presentaciones" ON presentaciones
  USING (public.es_administrador() OR public.es_personal_de_campo())
  WITH CHECK (public.es_administrador() OR public.es_personal_de_campo());
ALTER POLICY "Solo administrador edita presentaciones" ON presentaciones
  RENAME TO "Administrador y personal de campo editan presentaciones";

-- ============================================================================
-- 7. Jornadas
-- ============================================================================
-- Quien tiene jornadas.gestionar ya creaba y editaba (00039), pero solo veia las jornadas en las
-- que participa y no podia armar el equipo: una delegacion a medias. Ahora ve todas y asigna
-- personal. Presupuestos tambien las lee: sin jornadas no hay presupuesto que sumar.
ALTER POLICY "Administrador y junta directiva leen todas las jornadas; el per" ON jornadas
  USING (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.pertenece_a_jornada(id)
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('presupuestos')
  );
ALTER POLICY "Administrador y junta directiva leen todas las jornadas; el per" ON jornadas
  RENAME TO "Leen jornadas quien administra, gestiona o participa";

ALTER POLICY "Administrador y junta directiva leen asignaciones; cada quien l" ON jornada_personal
  USING (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.pertenece_a_jornada(jornada_id)
    OR perfil_id = auth.uid()
    OR public.accede_a_modulo_por_matriz('jornadas')
  );
ALTER POLICY "Administrador y junta directiva leen asignaciones; cada quien l" ON jornada_personal
  RENAME TO "Leen asignaciones quien administra, gestiona o participa";

ALTER POLICY "Solo administrador asigna personal a jornadas" ON jornada_personal
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));
ALTER POLICY "Solo administrador asigna personal a jornadas" ON jornada_personal
  RENAME TO "Administrador o jornadas.gestionar asigna personal";

ALTER POLICY "Solo administrador actualiza asignaciones de jornadas" ON jornada_personal
  USING (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));
ALTER POLICY "Solo administrador actualiza asignaciones de jornadas" ON jornada_personal
  RENAME TO "Administrador o jornadas.gestionar actualiza asignaciones";

ALTER POLICY "Solo administrador desasigna personal de jornadas" ON jornada_personal
  USING (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));
ALTER POLICY "Solo administrador desasigna personal de jornadas" ON jornada_personal
  RENAME TO "Administrador o jornadas.gestionar desasigna personal";

ALTER POLICY "Solo administrador lee jornada_estado_historial" ON jornada_estado_historial
  USING (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
  );
ALTER POLICY "Solo administrador lee jornada_estado_historial" ON jornada_estado_historial
  RENAME TO "Administrador o quien gestiona jornadas lee su historial";

ALTER POLICY "Administrador, consultivos y quien gestiona jornadas leen orige" ON jornada_presupuesto_origen
  USING (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('presupuestos')
  );
-- El nombre decia "consultivos" desde la 00135; la 00141 ya se los habia retirado.
ALTER POLICY "Administrador, consultivos y quien gestiona jornadas leen orige" ON jornada_presupuesto_origen
  RENAME TO "Leen origenes de presupuesto quien administra o gestiona";

-- ============================================================================
-- 8. Presupuestos
-- ============================================================================
-- El personal de campo ve los gastos de sus jornadas (participa_en_jornada, 00052) y los registra
-- pendientes (00089): no cambia. Lo nuevo es que quien tiene presupuestos.registrar o
-- presupuestos.aprobar VEA los gastos que aprueba o registra -antes aprobaba a ciegas: la politica
-- de UPDATE lo dejaba y la de SELECT no le mostraba la fila-.
ALTER POLICY "Administrador, junta directiva y socio fundador leen todos los " ON gastos
  USING (
    public.es_administrador()
    OR public.tiene_permiso('presupuestos.aprobar')
    OR public.tiene_permiso('presupuestos.registrar')
    OR public.participa_en_jornada(jornada_id)
    OR public.accede_a_modulo_por_matriz('presupuestos')
  );
ALTER POLICY "Administrador, junta directiva y socio fundador leen todos los " ON gastos
  RENAME TO "Leen gastos quien administra, gestiona o participa";

-- ============================================================================
-- 9. Proyectos
-- ============================================================================
-- "Los proyectos a los que pertenece" son dos caminos: estar en su equipo (proyecto_personal,
-- 00146) o participar en una de sus jornadas (00141). SECURITY DEFINER para poder mirar
-- proyecto_personal sin pasar por su RLS, que a su vez consulta proyectos: escrito en la propia
-- politica seria una recursion infinita.
CREATE OR REPLACE FUNCTION public.pertenece_a_proyecto(p_proyecto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.rol_actual() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.proyecto_personal pp
        WHERE pp.proyecto_id = p_proyecto_id
          AND pp.perfil_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.jornadas j
        WHERE j.proyecto_id = p_proyecto_id
          AND public.pertenece_a_jornada(j.id)
      )
    );
$$;

COMMENT ON FUNCTION public.pertenece_a_proyecto(UUID) IS
  'Si la sesion esta en el equipo del proyecto o participa en alguna de sus jornadas.';

REVOKE EXECUTE ON FUNCTION public.pertenece_a_proyecto(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pertenece_a_proyecto(UUID) TO authenticated;

ALTER POLICY "Administrador y junta directiva leen proyectos" ON proyectos
  USING (
    public.es_administrador()
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.pertenece_a_proyecto(id)
    OR public.accede_a_modulo_por_matriz('proyectos')
    OR public.accede_a_modulo_por_matriz('presupuestos')
  );
ALTER POLICY "Administrador y junta directiva leen proyectos" ON proyectos
  RENAME TO "Leen proyectos quien administra, gestiona o pertenece";

-- Hitos, bitacora e historial: quien gestiona proyectos los necesita para gestionarlos, y quien
-- tiene el modulo abierto por la matriz los ve. El personal de campo no: su detalle es de consulta
-- (issue de esta migracion).
ALTER POLICY "Administrador y junta directiva leen los hitos" ON proyecto_hitos
  USING (
    public.es_administrador()
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('proyectos')
  );
ALTER POLICY "Administrador y junta directiva leen los hitos" ON proyecto_hitos
  RENAME TO "Administrador o quien gestiona proyectos lee los hitos";

ALTER POLICY "Solo administrador crea hitos" ON proyecto_hitos
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));
ALTER POLICY "Solo administrador crea hitos" ON proyecto_hitos
  RENAME TO "Administrador o proyectos.gestionar crea hitos";

ALTER POLICY "Solo administrador actualiza hitos" ON proyecto_hitos
  USING (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));
ALTER POLICY "Solo administrador actualiza hitos" ON proyecto_hitos
  RENAME TO "Administrador o proyectos.gestionar actualiza hitos";

ALTER POLICY "Solo administrador borra hitos" ON proyecto_hitos
  USING (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));
ALTER POLICY "Solo administrador borra hitos" ON proyecto_hitos
  RENAME TO "Administrador o proyectos.gestionar borra hitos";

ALTER POLICY "Administrador y junta directiva leen la bitacora" ON proyecto_seguimiento
  USING (
    public.es_administrador()
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('proyectos')
  );
ALTER POLICY "Administrador y junta directiva leen la bitacora" ON proyecto_seguimiento
  RENAME TO "Administrador o quien gestiona proyectos lee la bitacora";

ALTER POLICY "Solo administrador anota en la bitacora" ON proyecto_seguimiento
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('proyectos.gestionar'));
ALTER POLICY "Solo administrador anota en la bitacora" ON proyecto_seguimiento
  RENAME TO "Administrador o proyectos.gestionar anota en la bitacora";

ALTER POLICY "Solo administrador lee proyecto_estado_historial" ON proyecto_estado_historial
  USING (
    public.es_administrador()
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('proyectos')
  );
ALTER POLICY "Solo administrador lee proyecto_estado_historial" ON proyecto_estado_historial
  RENAME TO "Administrador o quien gestiona proyectos lee su historial";

ALTER POLICY "Administrador o proyectos.gestionar leen insumos de proyectos" ON proyecto_insumos
  USING (
    public.es_administrador()
    OR public.tiene_permiso('proyectos.gestionar')
    OR public.accede_a_modulo_por_matriz('proyectos')
  );

-- El equipo del proyecto lo ve tambien quien pertenece a el por estar en su equipo, no solo por
-- sus jornadas.
CREATE OR REPLACE FUNCTION public.equipo_de_proyecto(p_proyecto_id UUID)
RETURNS TABLE(
  id UUID,
  proyecto_id UUID,
  perfil_id UUID,
  rol_en_proyecto TEXT,
  created_at TIMESTAMPTZ,
  nombres VARCHAR,
  apellidos VARCHAR
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
      OR public.pertenece_a_proyecto(pp.proyecto_id)
      OR public.accede_a_modulo_por_matriz('proyectos')
    )
  ORDER BY pp.created_at;
$$;

-- ============================================================================
-- 10. Donaciones
-- ============================================================================
ALTER POLICY "Administrador y consultivos leen donantes" ON donantes
  USING (
    public.es_administrador()
    OR public.tiene_permiso('donaciones.registrar')
    OR public.accede_a_modulo_por_matriz('donaciones')
  );
ALTER POLICY "Administrador y consultivos leen donantes" ON donantes
  RENAME TO "Leen donantes quien administra o registra donaciones";

ALTER POLICY "Administrador y consultivos leen donaciones" ON donaciones
  USING (
    public.es_administrador()
    OR public.tiene_permiso('donaciones.registrar')
    OR public.accede_a_modulo_por_matriz('donaciones')
  );
ALTER POLICY "Administrador y consultivos leen donaciones" ON donaciones
  RENAME TO "Leen donaciones quien administra o registra donaciones";

ALTER POLICY "Administrador y consultivos leen donacion_detalle" ON donacion_detalle
  USING (
    public.es_administrador()
    OR public.tiene_permiso('donaciones.registrar')
    OR public.accede_a_modulo_por_matriz('donaciones')
  );
ALTER POLICY "Administrador y consultivos leen donacion_detalle" ON donacion_detalle
  RENAME TO "Leen donacion_detalle quien administra o registra donaciones";

-- ============================================================================
-- 11. Colaboradores
-- ============================================================================
-- El directorio lo leen, ademas, quien tiene el modulo abierto y quien necesita elegir personas
-- para lo que se le delego: armar el equipo de una jornada o de un proyecto, o gestionar permisos.
-- Telefono y correo siguen siendo solo de la administradora y de cada quien.
CREATE OR REPLACE VIEW perfiles_directorio AS
SELECT
  id,
  nombres,
  apellidos,
  rol,
  activo,
  fecha_ingreso,
  created_at,
  updated_at,
  CASE WHEN public.es_administrador() OR id = auth.uid() THEN telefono ELSE NULL END AS telefono,
  CASE WHEN public.es_administrador() OR id = auth.uid() THEN email ELSE NULL END AS email
FROM perfiles
WHERE public.es_administrador()
  OR id = auth.uid()
  OR public.accede_a_modulo_por_matriz('colaboradores')
  OR public.tiene_permiso('usuarios.gestionar_permisos')
  OR public.tiene_permiso('jornadas.gestionar')
  OR public.tiene_permiso('proyectos.gestionar');

ALTER POLICY "Administrador o el propio perfil leen sus especialidades" ON perfil_especialidad
  USING (
    public.es_administrador()
    OR perfil_id = auth.uid()
    OR public.accede_a_modulo_por_matriz('colaboradores')
  );

-- ============================================================================
-- 12. Reportes
-- ============================================================================
-- Una sola definicion de quien consulta reportes, en vez de repetirla en cada vista y funcion.
CREATE OR REPLACE FUNCTION public.puede_consultar_reportes()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.es_administrador()
    OR public.es_consultivo()
    OR public.tiene_permiso('reportes.exportar')
    OR public.accede_a_modulo_por_matriz('reportes');
$$;

COMMENT ON FUNCTION public.puede_consultar_reportes() IS
  'Administradora, roles consultivos, quien tiene reportes.exportar o el rol al que la matriz le abrio Reportes.';

REVOKE EXECUTE ON FUNCTION public.puede_consultar_reportes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.puede_consultar_reportes() TO authenticated;

CREATE OR REPLACE VIEW pacientes_reporte AS
SELECT id, comunidad_id
FROM pacientes
WHERE public.puede_consultar_reportes();

CREATE OR REPLACE VIEW vista_reporte_impacto
WITH (security_invoker = false) AS
WITH pacientes_por_jornada AS (
  SELECT a.jornada_id, count(DISTINCT a.paciente_id) AS pacientes_atendidos
  FROM atenciones a
  GROUP BY a.jornada_id
), consultas_por_jornada AS (
  SELECT c.jornada_id, count(*) AS consultas_realizadas
  FROM consultas c
  GROUP BY c.jornada_id
), entregas_por_jornada AS (
  SELECT
    c.jornada_id,
    count(DISTINCT r.id) AS tratamientos_entregados,
    COALESCE(sum(rd.cantidad_entregada), 0::bigint) AS medicamentos_utilizados
  FROM consultas c
  JOIN recetas r ON r.consulta_id = c.id
  LEFT JOIN receta_detalle rd ON rd.receta_id = r.id
  GROUP BY c.jornada_id
)
SELECT
  j.id AS jornada_id,
  j.nombre AS jornada,
  j.fecha,
  j.estado AS estado_jornada,
  com.id AS comunidad_id,
  com.nombre AS comunidad,
  COALESCE(p.pacientes_atendidos, 0::bigint) AS pacientes_atendidos,
  COALESCE(cs.consultas_realizadas, 0::bigint) AS consultas_realizadas,
  COALESCE(e.tratamientos_entregados, 0::bigint) AS tratamientos_entregados,
  COALESCE(e.medicamentos_utilizados, 0::bigint) AS medicamentos_utilizados,
  j.proyecto_id,
  pr.nombre AS proyecto
FROM jornadas j
JOIN comunidades com ON com.id = j.comunidad_id
LEFT JOIN proyectos pr ON pr.id = j.proyecto_id
LEFT JOIN pacientes_por_jornada p ON p.jornada_id = j.id
LEFT JOIN consultas_por_jornada cs ON cs.jornada_id = j.id
LEFT JOIN entregas_por_jornada e ON e.jornada_id = j.id
WHERE public.puede_consultar_reportes();

CREATE OR REPLACE FUNCTION public.fn_reporte_pacientes_atendidos(
  p_agrupar_por TEXT DEFAULT 'jornada',
  p_jornada_id UUID DEFAULT NULL,
  p_comunidad_id UUID DEFAULT NULL,
  p_desde DATE DEFAULT NULL,
  p_hasta DATE DEFAULT NULL
)
RETURNS TABLE(
  grupo_id TEXT,
  grupo TEXT,
  pacientes INTEGER,
  nuevos INTEGER,
  recurrentes INTEGER,
  hombres INTEGER,
  mujeres INTEGER,
  menores INTEGER,
  adultos INTEGER,
  adultos_mayores INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.puede_consultar_reportes() THEN
    RAISE EXCEPTION 'Solo administracion, los roles consultivos o quien tiene acceso a Reportes consultan el reporte de pacientes atendidos.';
  END IF;

  IF p_agrupar_por NOT IN ('jornada', 'comunidad', 'periodo') THEN
    RAISE EXCEPTION 'Agrupacion no valida: %. Use jornada, comunidad o periodo.', p_agrupar_por;
  END IF;

  RETURN QUERY
  WITH atendidos AS (
    SELECT
      a.paciente_id,
      j.id AS jornada_id,
      j.nombre AS jornada_nombre,
      j.fecha AS jornada_fecha,
      c.id AS comunidad_id,
      c.nombre AS comunidad_nombre,
      p.sexo::TEXT AS sexo,
      date_part('year', age(j.fecha, p.fecha_nacimiento))::INT AS edad
    FROM public.atenciones a
    JOIN public.jornadas j ON j.id = a.jornada_id
    JOIN public.pacientes p ON p.id = a.paciente_id
    JOIN public.comunidades c ON c.id = j.comunidad_id
    WHERE (p_jornada_id IS NULL OR j.id = p_jornada_id)
      AND (p_comunidad_id IS NULL OR c.id = p_comunidad_id)
      AND (p_desde IS NULL OR j.fecha >= p_desde)
      AND (p_hasta IS NULL OR j.fecha <= p_hasta)
  ),
  -- Sin cambios desde la 00132: nuevo es "primera jornada en la que se le atendio".
  clasificados AS (
    SELECT DISTINCT ON (t.paciente_id, t.jornada_id)
      t.*,
      NOT EXISTS (
        SELECT 1
        FROM public.atenciones previa
        JOIN public.jornadas jp ON jp.id = previa.jornada_id
        WHERE previa.paciente_id = t.paciente_id
          AND jp.fecha < t.jornada_fecha
      ) AS es_nuevo
    FROM atendidos t
  ),
  por_grupo AS (
    SELECT
      CASE p_agrupar_por
        WHEN 'jornada' THEN cl.jornada_id::TEXT
        WHEN 'comunidad' THEN cl.comunidad_id::TEXT
        ELSE to_char(cl.jornada_fecha, 'YYYY-MM')
      END AS g_id,
      CASE p_agrupar_por
        WHEN 'jornada' THEN cl.jornada_nombre
        WHEN 'comunidad' THEN cl.comunidad_nombre
        ELSE to_char(cl.jornada_fecha, 'YYYY-MM')
      END AS g_nombre,
      cl.paciente_id,
      bool_or(cl.es_nuevo) AS es_nuevo,
      min(cl.sexo) AS sexo,
      min(cl.edad) AS edad
    FROM clasificados cl
    GROUP BY 1, 2, cl.paciente_id
  )
  SELECT
    pg.g_id,
    pg.g_nombre,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE pg.es_nuevo)::INT,
    COUNT(*) FILTER (WHERE NOT pg.es_nuevo)::INT,
    COUNT(*) FILTER (WHERE pg.sexo = 'Masculino')::INT,
    COUNT(*) FILTER (WHERE pg.sexo = 'Femenino')::INT,
    COUNT(*) FILTER (WHERE pg.edad < 18)::INT,
    COUNT(*) FILTER (WHERE pg.edad BETWEEN 18 AND 59)::INT,
    COUNT(*) FILTER (WHERE pg.edad >= 60)::INT
  FROM por_grupo pg
  GROUP BY pg.g_id, pg.g_nombre
  ORDER BY pg.g_nombre;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_valor_de_inventario_disponible(p_bodega_id UUID DEFAULT NULL)
RETURNS TABLE(
  bodega_id UUID,
  bodega TEXT,
  medicamento_id UUID,
  medicamento TEXT,
  origen public.origen_lote,
  cantidad_disponible BIGINT,
  valor_disponible NUMERIC,
  unidades_sin_costo BIGINT,
  lotes_sin_costo BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.puede_consultar_reportes() THEN
    RAISE EXCEPTION 'Solo administracion y quien consulta reportes ve la valorizacion de inventario.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.bodega_id,
    b.nombre::TEXT AS bodega,
    l.medicamento_id,
    m.nombre::TEXT AS medicamento,
    l.origen,
    SUM(e.cantidad_disponible)::BIGINT AS cantidad_disponible,
    SUM(e.cantidad_disponible * l.costo_unitario) FILTER (WHERE l.costo_unitario IS NOT NULL) AS valor_disponible,
    COALESCE(SUM(e.cantidad_disponible) FILTER (WHERE l.costo_unitario IS NULL), 0)::BIGINT AS unidades_sin_costo,
    COUNT(DISTINCT l.id) FILTER (WHERE l.costo_unitario IS NULL)::BIGINT AS lotes_sin_costo
  FROM public.existencias e
  JOIN public.lotes l ON l.id = e.lote_id
  JOIN public.medicamentos m ON m.id = l.medicamento_id
  JOIN public.bodegas b ON b.id = e.bodega_id
  WHERE e.cantidad_disponible > 0
    AND (p_bodega_id IS NULL OR e.bodega_id = p_bodega_id)
  GROUP BY e.bodega_id, b.nombre, l.medicamento_id, m.nombre, l.origen
  ORDER BY b.nombre, m.nombre, l.origen;
END;
$$;

-- El reporte de resultados de una jornada. Hasta aqui lo armaba el cliente leyendo consultas,
-- diagnosticos y recetas fila por fila, y por eso los roles consultivos no lo tenian: la 00054 les
-- retiro esas tablas (issue #407). Aqui se agrega en la base y solo salen totales y los nombres de
-- quienes atendieron -nunca un paciente-, que es lo que la 00054 si les deja ver.
CREATE OR REPLACE FUNCTION public.fn_reporte_jornada(p_jornada_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reporte JSONB;
BEGIN
  IF NOT (public.puede_consultar_reportes() OR public.rol_actual() = 'medico') THEN
    RAISE EXCEPTION 'Solo administracion, el medico y quien consulta reportes ve el reporte de una jornada.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'jornada', jsonb_build_object(
      'id', j.id,
      'nombre', j.nombre,
      'fecha', j.fecha,
      'estado', j.estado,
      'comunidad', jsonb_build_object('id', c.id, 'nombre', c.nombre)
    ),
    'resumen', jsonb_build_object(
      'total_consultas',
      (SELECT count(*) FROM public.consultas co WHERE co.jornada_id = j.id),
      'pacientes_atendidos',
      (SELECT count(DISTINCT e.paciente_id)
         FROM public.consultas co
         JOIN public.expedientes e ON e.id = co.expediente_id
        WHERE co.jornada_id = j.id)
    ),
    'diagnosticos_mas_frecuentes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('diagnostico', x.nombre, 'cantidad', x.cantidad)
        ORDER BY x.cantidad DESC, x.nombre
      )
      FROM (
        SELECT d.nombre, count(*) AS cantidad
        FROM public.consultas co
        JOIN public.consulta_diagnostico cd ON cd.consulta_id = co.id
        JOIN public.diagnosticos d ON d.id = cd.diagnostico_id
        WHERE co.jornada_id = j.id
        GROUP BY d.nombre
      ) x
    ), '[]'::jsonb),
    'medicamentos_mas_entregados', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('medicamento', x.nombre, 'cantidad', x.cantidad)
        ORDER BY x.cantidad DESC, x.nombre
      )
      FROM (
        SELECT COALESCE(m.nombre, 'Sin nombre') AS nombre,
               sum(COALESCE(rd.cantidad_entregada, 0)) AS cantidad
        FROM public.consultas co
        JOIN public.recetas r ON r.consulta_id = co.id
        JOIN public.receta_detalle rd ON rd.receta_id = r.id
        LEFT JOIN public.medicamentos m ON m.id = rd.medicamento_id
        WHERE co.jornada_id = j.id
        GROUP BY COALESCE(m.nombre, 'Sin nombre')
      ) x
    ), '[]'::jsonb),
    'personal_participante', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'usuario_id', x.medico_id,
          'nombre', x.nombre,
          'total_atenciones', x.cantidad
        )
        ORDER BY x.cantidad DESC, x.nombre
      )
      FROM (
        SELECT co.medico_id,
               NULLIF(trim(concat_ws(' ', pe.nombres, pe.apellidos)), '') AS nombre,
               count(*) AS cantidad
        FROM public.consultas co
        LEFT JOIN public.perfiles pe ON pe.id = co.medico_id
        WHERE co.jornada_id = j.id
        GROUP BY co.medico_id, pe.nombres, pe.apellidos
      ) x
    ), '[]'::jsonb)
  )
  INTO v_reporte
  FROM public.jornadas j
  JOIN public.comunidades c ON c.id = j.comunidad_id
  WHERE j.id = p_jornada_id;

  RETURN v_reporte;
END;
$$;

COMMENT ON FUNCTION public.fn_reporte_jornada(UUID) IS
  'Reporte de resultados de una jornada, ya agregado: totales, diagnosticos, medicamentos y personal. Sin filas de paciente. NULL si la jornada no existe.';

REVOKE EXECUTE ON FUNCTION public.fn_reporte_jornada(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_reporte_jornada(UUID) TO authenticated;
