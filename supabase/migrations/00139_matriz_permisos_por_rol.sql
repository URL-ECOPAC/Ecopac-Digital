-- Ecopac Digital - Matriz de permisos por rol en web (issue #638)
--
-- rol_permiso (00003) es de solo lectura desde la 00038: "sin politicas de escritura todavia
-- (las gestiona un administrador directamente hasta que exista una pantalla dedicada)". Esta es
-- esa pantalla.
--
-- A diferencia de usuario_permiso (00038/00086), la politica de escritura aqui es SOLO
-- es_administrador(), sin el "OR tiene_permiso(...)": el criterio de aceptacion de la issue #638
-- exige explicitamente que unicamente el administrador entre a esta pantalla, no un permiso fino
-- delegable.
--
-- rol_permiso no tiene ninguna columna mutable aparte de su propia llave primaria compuesta
-- (rol, permiso_id): conceder un permiso a un rol es INSERT la fila, retirarlo es DELETE la
-- fila. No hace falta politica ni GRANT de UPDATE.
--
-- La politica de SELECT vigente ("Sesion activa lee rol_permiso", 00079) ya es
-- USING (rol_actual() IS NOT NULL) -abierta a cualquier sesion activa-, a diferencia de
-- usuario_permiso, que necesito ampliar su propia politica de SELECT en la 00086 para que un
-- INSERT con RETURNING pudiera leer la fila recien escrita. Aqui no hace falta tocarla.
--
-- Fuera de alcance, a proposito: usuario_permiso tiene un guardia
-- (impedir_permiso_escritura_a_consultivo, 00086) que bloquea conceder un permiso de escritura a
-- junta directiva/socio fundador por excepcion individual. rol_permiso no lo tiene todavia: un
-- administrador puede, desde esta pantalla, marcar un permiso de escritura como parte del
-- default de todo el rol consultivo. Se documenta la asimetria en docs/PERMISOS.md en vez de
-- replicar el guardia en esta issue.

-- Solo authenticated, nunca anon: la 00049 revoco todo privilegio de anon sobre public
-- precisamente porque los GRANT anteriores (00032, 00033, 00034, 00038, 00039) lo agregaban por
-- costumbre sin que anon lo necesitara, y establecio la regla de no volver a hacerlo salvo que
-- se justifique en su propia migracion. anon no tiene sesion, asi que nunca pasa
-- es_administrador() de todos modos.
GRANT INSERT, DELETE ON rol_permiso TO authenticated;

CREATE POLICY "Solo administrador escribe rol_permiso"
  ON rol_permiso FOR INSERT
  WITH CHECK (public.es_administrador());

CREATE POLICY "Solo administrador borra rol_permiso"
  ON rol_permiso FOR DELETE
  USING (public.es_administrador());

-- ============================================================================
-- Auditoria propia, mismo motivo que registrar_evento_auditoria_usuario_permiso (00045):
-- rol_permiso no tiene columna id (su PK es compuesta), y eventos_auditoria.fila_id es
-- UUID NOT NULL (00026). Pegarle el trigger generico dejaria fila_id en NULL y el INSERT del
-- trigger fallaria en cada concesion o retiro.
--
-- Diferencia real con la 00045: alli perfil_id (UUID de una persona) sirve de fila_id. Aqui la
-- columna que identifica a quien afecta el cambio es `rol`, pero `rol` es el enum rol_usuario,
-- no un UUID -no puede ser fila_id-. El unico UUID disponible en la fila es permiso_id, asi que
-- se usa como fila_id: identifica QUE PERMISO cambio de disponibilidad, y `rol` viaja dentro de
-- valores_anteriores/valores_nuevos via to_jsonb(OLD)/to_jsonb(NEW), igual que perfil_id viaja en
-- la 00045 (fila completa, no solo la PK).
--
-- Dos ramas, no tres: rol_permiso nunca recibe UPDATE (no hay politica ni GRANT de UPDATE,
-- arriba), asi que a diferencia de la 00045 esta funcion no necesita la rama TG_OP = 'UPDATE'.
CREATE OR REPLACE FUNCTION registrar_evento_auditoria_rol_permiso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_anteriores JSONB;
  v_nuevos JSONB;
  v_operacion public.operacion_auditoria;
  v_fila_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_anteriores := to_jsonb(OLD);
    v_nuevos := NULL;
    v_operacion := 'eliminacion';
    v_fila_id := (v_anteriores ->> 'permiso_id')::UUID;

  ELSE
    v_anteriores := NULL;
    v_nuevos := to_jsonb(NEW);
    v_operacion := 'insercion';
    v_fila_id := (v_nuevos ->> 'permiso_id')::UUID;
  END IF;

  INSERT INTO public.eventos_auditoria (
    tabla_afectada,
    fila_id,
    operacion,
    realizado_por,
    valores_anteriores,
    valores_nuevos
  )
  VALUES (
    TG_TABLE_NAME,
    v_fila_id,
    v_operacion,
    auth.uid(),
    v_anteriores,
    v_nuevos
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION registrar_evento_auditoria_rol_permiso() IS
  'Como registrar_evento_auditoria_usuario_permiso() (00045), pero para rol_permiso: usa permiso_id como fila_id -no rol, que es un enum, no un UUID- porque esta tabla no identifica una persona sino que permiso cambio de disponibilidad para un rol. rol y permiso_id quedan en valores_anteriores/valores_nuevos. Solo INSERT/DELETE: rol_permiso nunca recibe UPDATE.';

CREATE TRIGGER trg_rol_permiso_auditoria
AFTER INSERT OR DELETE ON rol_permiso
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria_rol_permiso();