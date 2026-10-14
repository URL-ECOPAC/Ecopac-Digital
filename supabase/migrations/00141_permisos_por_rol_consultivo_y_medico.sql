-- Ecopac Digital - Que ve cada rol, tambien en la base (issue #864)
--
-- QUE ESTABA MAL
--
-- El criterio 6 de la #864 fija el modelo de acceso: administrador ve todo; junta directiva y
-- socio fundador ven SOLO reportes; el medico ve pacientes entero, un inventario acotado, y los
-- proyectos y jornadas en los que esta asignado, sin crear ni editar nada. Contra eso, la base
-- decia otra cosa:
--
--   1. Los dos roles consultivos leian jornadas, jornada_personal, proyectos, proyecto_hitos,
--      proyecto_seguimiento, gastos, donantes, donaciones, donacion_detalle, perfil_especialidad
--      y jornada_presupuesto_origen. Junta directiva leia ademas el personal por la vista
--      perfiles_directorio. Es gobernanza mirando la operacion del dia.
--
--   2. El medico no tenia NINGUNA politica de lectura sobre proyectos, asi que el modulo no se
--      le podia abrir aunque la interfaz quisiera.
--
--   3. El medico no podia dar de alta un medicamento: las politicas de INSERT de medicamentos y
--      medicamento_principio (00034) exigen es_administrador(). El alta en linea existe en el
--      formulario desde la #851, pero para un medico terminaba en un 42501.
--
--   4. Quien esta en el cuadro de turnos de una jornada veia UNA SOLA FILA de jornada_personal,
--      la suya. El criterio 6 pide que el medico vea "el equipo" de su jornada.
--
--   5. Y el que aparecio probando, que la issue no nombra: **el responsable de una jornada no ve
--      su propia jornada, ni a su equipo**. jornadas.responsable_id y jornada_personal son dos cosas distintas
--      -quien organiza la jornada y quien esta en el cuadro de turnos de ese dia-, y
--      participa_en_jornada() (00079) solo mira la segunda. La #838 ya habia encontrado esto y lo
--      arreglo **solo del lado del cliente**: obtenerJornadasDePersona() consulta las dos por
--      separado. La base nunca recibio el arreglo. Comprobado con los datos de demostracion:
--      "Jornada Demo Vista Hermosa" esta EN CURSO y su responsable_id es el medico Mario, que no
--      esta en su jornada_personal; con la sesion de Mario, /jornadas no la lista y la pantalla
--      de inicio dice "No hay ninguna jornada en curso ahora mismo".
--
-- QUE NO CAMBIA, Y POR QUE
--
-- **Los consultivos conservan la lectura del inventario** (medicamentos, lotes, existencias,
-- bodegas, alertas_caducidad...) y fn_valor_de_inventario_disponible (00122). Dos de sus cuatro
-- reportes leen esas tablas DIRECTO, no por una vista: inventario.api.js y vencimientos.api.js
-- consultan `existencias`, y reportes/api.js consulta `lotes`. Quitarles esa lectura les vaciaria
-- justo lo unico que deben ver. Queda anotado como divergencia declarada en docs/PERMISOS.md: la
-- salida limpia es pasar esos dos reportes a vistas SECURITY DEFINER, que es la regla de
-- "RLS filtra filas, no columnas" de ese mismo documento, y va en su propia issue.
--
-- Tampoco cambia fn_reporte_pacientes_atendidos: su guarda ya dice es_consultivo() desde la
-- 00086. Quien estaba desactualizado era el cliente (reportes/permisos.js), que seguia citando
-- la 00067 y le escondia ese reporte a socio fundador.
--
-- COMO SE RETIRA UN ROL DE UNA POLITICA
--
-- Con ALTER POLICY y conservando el nombre original, igual que la 00080 y la 00106: el nombre
-- describe la politica de cuando se creo y cambiarlo obligaria a un DROP + CREATE que perderia
-- el historial de por que existe. Donde el nombre ya no describe lo que hace, se corrige su
-- COMMENT ON POLICY.

-- ============================================================================
-- 1. "Estar en una jornada" son dos cosas, y hasta ahora la base solo miraba una
-- ============================================================================
-- participa_en_jornada() (00079) responde "esta en el cuadro de turnos de ese dia". Es la
-- pregunta correcta para lo operativo -leer los gastos de la jornada, entrar a su cola de
-- atencion-, y se queda como esta en todas esas politicas.
--
-- Pero para "esta jornada es mia" hace falta la otra mitad: jornadas.responsable_id, quien la
-- organiza. Sin ella, el responsable de una jornada no la veia, y -peor- veia su propia jornada
-- pero no a su equipo, con la pantalla diciendo "todavia no hay personal asignado" cuando si lo
-- habia. Un vacio que miente es peor que un permiso denegado.
--
-- Se nombra la union en vez de repetir el OR en tres politicas: asi el concepto existe una sola
-- vez y la proxima politica que lo necesite no tiene que acordarse de las dos mitades.
CREATE OR REPLACE FUNCTION pertenece_a_jornada(p_jornada_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.participa_en_jornada(p_jornada_id)
      OR EXISTS (
        SELECT 1
        FROM public.jornadas j
        JOIN public.perfiles pe ON pe.id = j.responsable_id
        WHERE j.id = p_jornada_id AND j.responsable_id = auth.uid() AND pe.activo
      );
$$;

COMMENT ON FUNCTION pertenece_a_jornada(UUID) IS
  'La jornada es de esta persona: o esta en su cuadro de turnos (participa_en_jornada, 00079) o figura como su responsable_id. SECURITY DEFINER y search_path fijo por el mismo motivo que su companera. Exige perfiles.activo tambien en la rama del responsable, para no reabrir por aqui lo que cerro la 00079.';

-- REVOKE antes del GRANT: Postgres le da EXECUTE a PUBLIC por defecto a toda funcion nueva, y
-- PUBLIC incluye a anon. La 00049 y la 00056 establecieron que anon no tiene NADA sobre el
-- esquema publico, y la prueba pgTAP privilegios_anon.sql lo comprueba en cada PR -- fue ella la
-- que cazo este descuido al escribir esta migracion.
REVOKE EXECUTE ON FUNCTION pertenece_a_jornada(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pertenece_a_jornada(UUID) TO authenticated;

-- ============================================================================
-- 2. Jornadas: fuera los consultivos, y el responsable ve su jornada
-- ============================================================================
ALTER POLICY "Administrador y junta directiva leen todas las jornadas; el personal asignado lee las suyas"
  ON jornadas
  USING (public.es_administrador() OR public.pertenece_a_jornada(id));

COMMENT ON POLICY "Administrador y junta directiva leen todas las jornadas; el personal asignado lee las suyas"
  ON jornadas IS
  'El nombre es el de la 00039 y ya no describe la politica: junta directiva salio en la 00141 (issue #864). Hoy leen la administradora, quien esta en el cuadro de turnos de la jornada y quien figura como su responsable_id. Esa ultima rama cierra el defecto que la #838 solo habia arreglado en el cliente: ser responsable de una jornada sin estar en su jornada_personal dejaba la jornada invisible para su propio responsable.';

-- ============================================================================
-- 3. jornada_personal: el equipo de la jornada, para quien pertenece a ella
-- ============================================================================
-- pertenece_a_jornada(jornada_id) y no solo perfil_id = auth.uid(): el criterio 6 pide que el
-- medico vea "el equipo". Sigue siendo el equipo de SU jornada, no el de todas.
--
-- Se conserva la rama perfil_id = auth.uid(): una persona lee su propia asignacion aunque un dia
-- deje de cumplirse pertenece_a_jornada() -por ejemplo si se la desasigna de la jornada y la
-- fila sigue existiendo un instante-, que es lo que evita una pantalla vacia sin explicacion.
ALTER POLICY "Administrador y junta directiva leen asignaciones; cada quien lee la suya"
  ON jornada_personal
  USING (
    public.es_administrador()
    OR public.pertenece_a_jornada(jornada_id)
    OR perfil_id = auth.uid()
  );

COMMENT ON POLICY "Administrador y junta directiva leen asignaciones; cada quien lee la suya"
  ON jornada_personal IS
  'El nombre es el de la 00039. Desde la 00141 (issue #864) no lee junta directiva y si lee el equipo completo de una jornada cualquiera que participe en ella, que es lo que necesita el detalle de la jornada para mostrar "el equipo". La escritura sigue siendo solo de la administradora (00039, 00044).';

-- ============================================================================
-- 4. Proyectos: fuera los consultivos, entra el medico por su jornada
-- ============================================================================
-- El medico ve el proyecto al que pertenece una jornada en la que participa, y nada mas. Se
-- resuelve con un EXISTS sobre jornadas (jornadas.proyecto_id existe desde la 00012) apoyado en
-- participa_en_jornada(), que es SECURITY DEFINER y por lo tanto no vuelve a pasar por la RLS de
-- jornadas: el EXISTS no depende de si el medico puede o no leer esa fila de jornadas.
--
-- Se conserva tiene_permiso('proyectos.gestionar') de la 00086: es el permiso fino que puede
-- delegarse a alguien sin convertirlo en administrador.
ALTER POLICY "Administrador y junta directiva leen proyectos"
  ON proyectos
  USING (
    public.es_administrador()
    OR public.tiene_permiso('proyectos.gestionar')
    OR EXISTS (
      SELECT 1
      FROM public.jornadas j
      WHERE j.proyecto_id = proyectos.id
        AND public.pertenece_a_jornada(j.id)
    )
  );

COMMENT ON POLICY "Administrador y junta directiva leen proyectos"
  ON proyectos IS
  'El nombre es el de la 00039. Desde la 00141 (issue #864) no leen los roles consultivos, y si lee el personal de campo, pero SOLO los proyectos de las jornadas en las que participa. La escritura sigue siendo de la administradora o de quien tenga proyectos.gestionar (00039, 00086).';

-- ============================================================================
-- 5. El resto de lo que leian los consultivos y ya no les toca
-- ============================================================================
ALTER POLICY "Administrador y junta directiva leen los hitos"
  ON proyecto_hitos
  USING (public.es_administrador());

ALTER POLICY "Administrador y junta directiva leen la bitacora"
  ON proyecto_seguimiento
  USING (public.es_administrador());

-- gastos conserva participa_en_jornada(): el personal de campo sigue viendo los gastos de las
-- jornadas en las que esta, que es lo que la 00052 quiso. Era ademas la unica politica del
-- esquema que nombraba a socio fundador por su nombre.
ALTER POLICY "Administrador, junta directiva y socio fundador leen todos los gastos; el personal asignado lee los de su jornada"
  ON gastos
  USING (public.es_administrador() OR public.participa_en_jornada(jornada_id));

ALTER POLICY "Administrador y consultivos leen donantes"
  ON donantes
  USING (public.es_administrador() OR public.tiene_permiso('donaciones.registrar'));

ALTER POLICY "Administrador y consultivos leen donaciones"
  ON donaciones
  USING (public.es_administrador() OR public.tiene_permiso('donaciones.registrar'));

ALTER POLICY "Administrador y consultivos leen donacion_detalle"
  ON donacion_detalle
  USING (public.es_administrador() OR public.tiene_permiso('donaciones.registrar'));

ALTER POLICY "Administrador, consultivos y quien gestiona jornadas leen origenes"
  ON jornada_presupuesto_origen
  USING (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

-- perfil_especialidad: cada quien conserva las suyas. Lo que se retira es que un rol consultivo
-- lea las de los demas (00085), que existia para el cuadro de turnos que ya no ve.
ALTER POLICY "Administrador o el propio perfil leen sus especialidades"
  ON perfil_especialidad
  USING (public.es_administrador() OR perfil_id = auth.uid());

-- ============================================================================
-- 6. perfiles_directorio: junta directiva sale
-- ============================================================================
-- Postgres no soporta RLS sobre vistas, asi que se redeclara entera con CREATE OR REPLACE
-- cambiando solo el WHERE -mismo procedimiento que la 00080 y la 00086-. Sigue SIN
-- security_invoker, por la razon que explica la 00038.
--
-- La vista se queda -no se borra- porque es la unica forma en que alguien lee perfiles ajenos
-- sin telefono ni correo, y la administradora la sigue usando. Lo que cambia es que ya no hay un
-- segundo rol que entre por aqui.
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
  CASE WHEN public.es_administrador() OR id = auth.uid() THEN telefono END AS telefono,
  CASE WHEN public.es_administrador() OR id = auth.uid() THEN email END AS email
FROM perfiles
WHERE public.es_administrador() OR id = auth.uid();

COMMENT ON VIEW perfiles_directorio IS
  'Perfiles sin datos de contacto sensibles (telefono, email) salvo para administrador y para el propio perfil. Junta directiva leia por aqui hasta la 00141 (issue #864), que la deja con Reportes como unica pantalla; la vista se conserva porque sigue siendo el unico camino enmascarado a perfiles ajenos y porque cada quien lee su propia fila por ella.';

-- ============================================================================
-- 7. El medico da de alta un medicamento del catalogo
-- ============================================================================
-- Solo el INSERT. Editar y desactivar siguen siendo de la administradora (00034, 00050): dar de
-- alta lo que falta para poder registrar un ingreso es parte del trabajo de jornada; reescribir
-- el catalogo, no.
--
-- No hace falta tocar fn_registrar_medicamento (00050): NO es SECURITY DEFINER a proposito, asi
-- que quien puede llamarla lo siguen decidiendo estas dos politicas.
--
-- medicamento_principio va en el mismo cambio porque la funcion inserta en las dos dentro de la
-- misma transaccion: abrir solo medicamentos dejaria el alta fallando igual, una linea mas
-- abajo.
ALTER POLICY "Solo administrador crea medicamentos"
  ON medicamentos
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');

COMMENT ON POLICY "Solo administrador crea medicamentos"
  ON medicamentos IS
  'El nombre es el de la 00034. Desde la 00141 (issue #864) tambien da de alta el medico: el alta en linea del formulario de ingreso (issue #851) le terminaba en 42501. El UPDATE sigue siendo solo de la administradora.';

ALTER POLICY "Solo administrador asocia medicamento_principio"
  ON medicamento_principio
  WITH CHECK (public.es_administrador() OR public.rol_actual() = 'medico');

COMMENT ON POLICY "Solo administrador asocia medicamento_principio"
  ON medicamento_principio IS
  'Acompania a la politica de INSERT de medicamentos: fn_registrar_medicamento (00050) escribe en las dos tablas en la misma transaccion, asi que abrir una sola dejaria el alta fallando igual.';
