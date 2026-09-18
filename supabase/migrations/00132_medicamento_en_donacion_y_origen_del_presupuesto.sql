-- Ecopac Digital - El medicamento de una donacion sale del catalogo, y el presupuesto de una
-- jornada dice de donde viene (issue #840, bloques C y D).
--
-- Van juntos porque cierran el mismo circulo: lo que entra por una donacion -medicamentos al
-- inventario, dinero al presupuesto- tiene que quedar ligado a lo que produce, sin volver a
-- teclearlo.
--
-- ============================================================================================
-- PARTE C. donacion_detalle.medicamento_id
-- ============================================================================================
--
-- El renglon de una donacion de medicamentos se capturaba como texto libre -descripcion y
-- unidad- y el medicamento del catalogo se elegia despues, al dar el ingreso a inventario,
-- adivinando a cual correspondia ese texto. donacion_detalle no guardaba ninguna referencia al
-- catalogo, asi que la donacion y el lote nunca quedaban ligados por el medicamento.
--
-- - medicamento_id es nullable: las donaciones de insumos, dinero y servicios no tienen catalogo
--   contra el que validar, y las de medicamentos ya registradas tampoco tienen de donde sacarlo.
--   Que sea obligatorio para las de medicamentos NUEVAS lo exige fn_registrar_donacion, que es
--   el unico camino de escritura (no hay GRANT de UPDATE sobre donacion_detalle salvo lote_id).
-- - La unidad no se pide: es la presentacion del medicamento (tableta, jarabe, ...), que ya esta
--   en el catalogo. La funcion la copia a donacion_detalle.unidad, que sigue existiendo para las
--   donaciones de insumos.
-- - La descripcion tampoco se pide: se arma con el nombre y la concentracion del catalogo.
--   donacion_detalle.descripcion sigue siendo NOT NULL, y es lo que se lee en el historial.
-- - ON DELETE RESTRICT: un medicamento que ya se dono no se puede borrar del catalogo. El
--   catalogo se da de baja con `activo`, no con DELETE.

ALTER TABLE donacion_detalle
  ADD COLUMN medicamento_id UUID REFERENCES medicamentos(id) ON DELETE RESTRICT;

CREATE INDEX idx_donacion_detalle_medicamento_id ON donacion_detalle (medicamento_id);

COMMENT ON COLUMN donacion_detalle.medicamento_id IS
  'Medicamento del catalogo que se dono (issue #840). Obligatorio para las donaciones de '
  'medicamentos registradas desde la 00132 -lo exige fn_registrar_donacion-, NULL para los otros '
  'tipos y para las donaciones de medicamentos anteriores, que se capturaban como texto libre. '
  'Con el, el ingreso a inventario desde la donacion ya no pide volver a elegir el medicamento.';

-- La firma no cambia: el medicamento viaja dentro de cada renglon de p_detalle
-- ({ "medicamentoId": ... }), igual que descripcion, cantidad y monto. CREATE OR REPLACE conserva
-- los GRANT y el REVOKE de la 00114.
CREATE OR REPLACE FUNCTION fn_registrar_donacion(
  p_donante_id UUID,
  p_tipo tipo_donacion,
  p_fecha DATE,
  p_detalle JSONB,
  p_proyecto_id UUID DEFAULT NULL,
  p_observaciones TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_donacion public.donaciones;
  v_renglon JSONB;
  v_detalle_id UUID;
  v_ids_detalle JSONB := '[]'::JSONB;
  v_medicamento_id UUID;
  v_medicamento public.medicamentos;
  v_descripcion TEXT;
  v_unidad TEXT;
BEGIN
  IF p_detalle IS NULL OR jsonb_array_length(p_detalle) = 0 THEN
    RAISE EXCEPTION 'Una donacion necesita al menos un renglon de detalle.';
  END IF;

  INSERT INTO public.donaciones (
    donante_id, proyecto_id, tipo, fecha, observaciones, registrado_por
  )
  VALUES (
    p_donante_id, p_proyecto_id, p_tipo, p_fecha, p_observaciones, auth.uid()
  )
  RETURNING * INTO v_donacion;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(p_detalle)
  LOOP
    v_medicamento_id := NULLIF(v_renglon ->> 'medicamentoId', '')::UUID;
    v_descripcion := v_renglon ->> 'descripcion';
    v_unidad := v_renglon ->> 'unidad';

    IF p_tipo = 'medicamentos' THEN
      IF v_medicamento_id IS NULL THEN
        RAISE EXCEPTION 'Cada renglon de una donacion de medicamentos tiene que elegir un medicamento del catalogo.'
          USING ERRCODE = 'check_violation';
      END IF;

      SELECT * INTO v_medicamento FROM public.medicamentos WHERE id = v_medicamento_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El medicamento elegido no existe en el catalogo.'
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      -- El catalogo manda: lo que el cliente haya mandado como texto se ignora.
      v_descripcion := concat_ws(' ', v_medicamento.nombre, v_medicamento.concentracion);
      v_unidad := v_medicamento.presentacion::TEXT;
    ELSIF v_medicamento_id IS NOT NULL THEN
      RAISE EXCEPTION 'Solo una donacion de medicamentos lleva un medicamento del catalogo.'
        USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.donacion_detalle (
      donacion_id, descripcion, cantidad, unidad, monto, medicamento_id
    )
    VALUES (
      v_donacion.id,
      v_descripcion,
      NULLIF(v_renglon ->> 'cantidad', '')::NUMERIC,
      v_unidad,
      NULLIF(v_renglon ->> 'monto', '')::NUMERIC,
      v_medicamento_id
    )
    RETURNING id INTO v_detalle_id;

    v_ids_detalle := v_ids_detalle || to_jsonb(v_detalle_id);
  END LOOP;

  RETURN jsonb_build_object('donacion', to_jsonb(v_donacion), 'detalleIds', v_ids_detalle);
END;
$$;

COMMENT ON FUNCTION fn_registrar_donacion(UUID, tipo_donacion, DATE, JSONB, UUID, TEXT) IS
  'Inserta una donacion y todos sus renglones de donacion_detalle en una sola transaccion '
  '(issue #635). registrado_por sale de auth.uid(). No es SECURITY DEFINER: la politica de '
  'INSERT de donaciones y donacion_detalle sigue decidiendo quien puede llamarla. Devuelve '
  '{ donacion, detalleIds }, con los ids en el mismo orden que p_detalle. Desde la 00132 '
  '(issue #840) cada renglon de una donacion de medicamentos exige medicamentoId, y su '
  'descripcion y su unidad salen del catalogo, no del texto que mande el cliente.';

-- ============================================================================================
-- PARTE D. Origen del presupuesto de una jornada
-- ============================================================================================
--
-- jornadas.presupuesto_asignado (00012) era un NUMERIC suelto: no habia forma de saber de donde
-- salio ese monto. Ahora cada aporte es una fila de jornada_presupuesto_origen, y el asignado de
-- la jornada es la SUMA de sus origenes, que mantiene un trigger.
--
-- DECISIONES
--
-- - presupuesto_asignado se queda como columna y no se reemplaza por una vista: lo leen
--   fn_presupuesto_jornada/proyecto/sistema (00040, 00123), el reporte de impacto y las dos
--   apps. Convertirlo en derivado sin tocar a ninguno de ellos es la razon de mantenerlo
--   sincronizado por trigger en vez de calcularlo.
-- - Nadie lo escribe a mano: un UPDATE directo que cambie presupuesto_asignado se rechaza. La
--   sincronizacion lo hace marcando la transaccion con ecopac.sincronizando_presupuesto.
-- - Un INSERT de jornada con presupuesto_asignado > 0 (el seed de demostracion, las pruebas, o
--   una integracion vieja) no se rechaza: su monto entra como un origen "sin_clasificar". Asi el
--   invariante -asignado = suma de origenes- se cumple siempre, sin romper a quien ya inserta.
-- - El presupuesto que ya existe entra como "sin_clasificar" en esta misma migracion: es el dato
--   historico, y inventarle un origen seria peor que decir que no se sabe.
-- - Un origen "donacion" apunta a una donacion de DINERO registrada, y la suma de lo asignado
--   desde una donacion no puede pasar de su monto total. Es lo que permite convertir una
--   donacion en presupuesto sin volver a teclear el monto sin gastarla dos veces.

CREATE TYPE origen_de_presupuesto AS ENUM (
  'donacion',
  'fondos_propios',
  'aporte_externo',
  'sin_clasificar'
);

CREATE TABLE jornada_presupuesto_origen (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  origen origen_de_presupuesto NOT NULL,
  donacion_id UUID REFERENCES donaciones(id) ON DELETE RESTRICT,
  monto NUMERIC(12, 2) NOT NULL,
  descripcion VARCHAR(200),
  registrado_por UUID DEFAULT auth.uid() REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_presupuesto_origen_monto_positivo CHECK (monto > 0),
  CONSTRAINT chk_presupuesto_origen_donacion_coherente
    CHECK ((origen = 'donacion') = (donacion_id IS NOT NULL))
);

CREATE INDEX idx_presupuesto_origen_jornada_id ON jornada_presupuesto_origen (jornada_id);
CREATE INDEX idx_presupuesto_origen_donacion_id ON jornada_presupuesto_origen (donacion_id);

COMMENT ON TABLE jornada_presupuesto_origen IS
  'De donde viene cada parte del presupuesto de una jornada (issue #840). '
  'jornadas.presupuesto_asignado es la suma de estas filas y la mantiene '
  'fn_sincronizar_presupuesto_de_jornada; nadie la escribe a mano.';
COMMENT ON COLUMN jornada_presupuesto_origen.origen IS
  'donacion: sale de una donacion de dinero (donacion_id). fondos_propios: dinero de la '
  'organizacion. aporte_externo: otra fuente que no pasa por el registro de donaciones. '
  'sin_clasificar: el presupuesto que existia antes de la 00132, o el de un INSERT de jornada '
  'que traia el monto ya puesto.';
COMMENT ON COLUMN jornada_presupuesto_origen.donacion_id IS
  'La donacion de dinero de la que sale el monto. Obligatoria si y solo si origen = donacion.';

ALTER TABLE jornada_presupuesto_origen ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_presupuesto_origen_updated_at
BEFORE UPDATE ON jornada_presupuesto_origen
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ---------------------------------------------------------------------------------------------
-- registrado_por no se puede falsear: en un INSERT lo fija auth.uid(), mande lo que mande el
-- cliente. Mismo criterio que registrado_por en donaciones (00114) y gastos.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_fijar_registrado_por_origen_de_presupuesto()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Fuera de una peticion (migraciones, seed) auth.uid() es NULL y se respeta lo que venga.
  IF auth.uid() IS NOT NULL THEN
    NEW.registrado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_presupuesto_origen_registrado_por
BEFORE INSERT ON jornada_presupuesto_origen
FOR EACH ROW
EXECUTE FUNCTION fn_fijar_registrado_por_origen_de_presupuesto();

-- ---------------------------------------------------------------------------------------------
-- Un origen "donacion" tiene que ser una donacion de dinero registrada, y no se puede asignar
-- mas de lo que se dono. SECURITY DEFINER porque quien gestiona jornadas (jornadas.gestionar)
-- puede no tener lectura sobre donaciones: la regla tiene que valer igual para todos, no
-- depender de lo que RLS le deje ver a quien escribe. Solo lee, y solo lo que necesita.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_origen_de_presupuesto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo public.tipo_donacion;
  v_estado public.estado_donacion;
  v_total NUMERIC;
  v_ya_asignado NUMERIC;
BEGIN
  -- Sin donacion_id la fila la rechaza chk_presupuesto_origen_donacion_coherente, con su propio
  -- mensaje: este trigger corre antes que el CHECK y no tiene que adelantarse a decir otra cosa.
  IF NEW.origen <> 'donacion' OR NEW.donacion_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.tipo, d.estado INTO v_tipo, v_estado
  FROM public.donaciones d
  WHERE d.id = NEW.donacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La donacion elegida no existe.' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_tipo <> 'dinero' THEN
    RAISE EXCEPTION 'Solo una donacion de dinero puede ser origen de presupuesto.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_estado <> 'registrada' THEN
    RAISE EXCEPTION 'Una donacion anulada no puede ser origen de presupuesto.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(dd.monto), 0) INTO v_total
  FROM public.donacion_detalle dd
  WHERE dd.donacion_id = NEW.donacion_id;

  SELECT COALESCE(SUM(o.monto), 0) INTO v_ya_asignado
  FROM public.jornada_presupuesto_origen o
  WHERE o.donacion_id = NEW.donacion_id
    AND o.id IS DISTINCT FROM NEW.id;

  IF v_ya_asignado + NEW.monto > v_total THEN
    RAISE EXCEPTION 'La donacion es de Q% y ya se asignaron Q%: quedan Q% para asignar.',
      v_total, v_ya_asignado, v_total - v_ya_asignado
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_validar_origen_de_presupuesto() IS
  'Un origen de tipo donacion tiene que apuntar a una donacion de dinero registrada, y lo '
  'asignado desde ella en todas las jornadas no puede pasar de su monto (issue #840).';

CREATE TRIGGER trg_presupuesto_origen_validar
BEFORE INSERT OR UPDATE ON jornada_presupuesto_origen
FOR EACH ROW
EXECUTE FUNCTION fn_validar_origen_de_presupuesto();

-- ---------------------------------------------------------------------------------------------
-- Sincronizacion: presupuesto_asignado = suma de los origenes de la jornada.
--
-- SECURITY DEFINER por el mismo motivo que fn_aplicar_ajuste_existencias (00086): quien escribe
-- un origen ya paso la politica de esta tabla; el efecto secundario sobre jornadas no puede
-- depender de un segundo permiso sobre otra tabla. Solo toca presupuesto_asignado, y solo con
-- la suma de lo que ya esta guardado.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sincronizar_presupuesto_de_jornada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jornada_id UUID;
BEGIN
  -- Un UPDATE que mueve el origen de una jornada a otra tiene que recalcular las dos.
  FOR v_jornada_id IN
    SELECT DISTINCT unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.jornada_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.jornada_id END
    ])
  LOOP
    CONTINUE WHEN v_jornada_id IS NULL;

    PERFORM set_config('ecopac.sincronizando_presupuesto', 'on', true);
    UPDATE public.jornadas j
    SET presupuesto_asignado = (
      SELECT COALESCE(SUM(o.monto), 0)
      FROM public.jornada_presupuesto_origen o
      WHERE o.jornada_id = v_jornada_id
    )
    WHERE j.id = v_jornada_id;
    PERFORM set_config('ecopac.sincronizando_presupuesto', 'off', true);
  END LOOP;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION fn_sincronizar_presupuesto_de_jornada() IS
  'Mantiene jornadas.presupuesto_asignado igual a la suma de sus filas de '
  'jornada_presupuesto_origen (issue #840). Es la unica via que escribe esa columna.';

CREATE TRIGGER trg_presupuesto_origen_sincronizar
AFTER INSERT OR UPDATE OR DELETE ON jornada_presupuesto_origen
FOR EACH ROW
EXECUTE FUNCTION fn_sincronizar_presupuesto_de_jornada();

-- ---------------------------------------------------------------------------------------------
-- presupuesto_asignado ya no se escribe a mano.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_impedir_presupuesto_a_mano()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.presupuesto_asignado IS DISTINCT FROM OLD.presupuesto_asignado
     AND current_setting('ecopac.sincronizando_presupuesto', true) IS DISTINCT FROM 'on'
  THEN
    RAISE EXCEPTION 'El presupuesto de una jornada es la suma de sus origenes: se registra un origen, no el total.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jornadas_impedir_presupuesto_a_mano
BEFORE UPDATE OF presupuesto_asignado ON jornadas
FOR EACH ROW
EXECUTE FUNCTION fn_impedir_presupuesto_a_mano();

-- Un INSERT que ya trae presupuesto no se rechaza: su monto entra como origen sin clasificar.
-- SECURITY DEFINER para que quien puede crear la jornada no necesite ademas permiso sobre la
-- tabla de origenes para que el invariante se cumpla.
CREATE OR REPLACE FUNCTION fn_origen_del_presupuesto_inicial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.presupuesto_asignado > 0 THEN
    INSERT INTO public.jornada_presupuesto_origen (jornada_id, origen, monto, descripcion)
    VALUES (NEW.id, 'sin_clasificar', NEW.presupuesto_asignado,
            'Presupuesto indicado al crear la jornada');
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_jornadas_origen_del_presupuesto_inicial
AFTER INSERT ON jornadas
FOR EACH ROW
EXECUTE FUNCTION fn_origen_del_presupuesto_inicial();

-- ---------------------------------------------------------------------------------------------
-- El dato historico: cada presupuesto que ya existe entra como un origen sin clasificar.
-- ---------------------------------------------------------------------------------------------
INSERT INTO jornada_presupuesto_origen (jornada_id, origen, monto, descripcion)
SELECT j.id, 'sin_clasificar', j.presupuesto_asignado,
       'Presupuesto asignado antes de registrar su origen'
FROM jornadas j
WHERE j.presupuesto_asignado > 0;

-- ---------------------------------------------------------------------------------------------
-- RLS. Mismo criterio que presupuesto_asignado, que es lo que estas filas explican:
-- - escribe quien puede actualizar la jornada (00039/00086): administrador o jornadas.gestionar;
-- - lee el administrador, los roles consultivos (que ya leen presupuestos y gastos) y quien
--   gestiona jornadas, que necesita la fila de vuelta en un INSERT con RETURNING (00086).
-- El personal asignado sigue viendo el total en jornadas, no el desglose.
-- ---------------------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON jornada_presupuesto_origen TO authenticated;

CREATE POLICY "Administrador, consultivos y quien gestiona jornadas leen origenes de presupuesto"
  ON jornada_presupuesto_origen FOR SELECT TO authenticated
  USING (
    public.es_administrador()
    OR public.es_consultivo()
    OR public.tiene_permiso('jornadas.gestionar')
  );

CREATE POLICY "Administrador o quien gestiona jornadas registra origenes de presupuesto"
  ON jornada_presupuesto_origen FOR INSERT TO authenticated
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

CREATE POLICY "Administrador o quien gestiona jornadas corrige origenes de presupuesto"
  ON jornada_presupuesto_origen FOR UPDATE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'))
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

CREATE POLICY "Administrador o quien gestiona jornadas quita origenes de presupuesto"
  ON jornada_presupuesto_origen FOR DELETE TO authenticated
  USING (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

-- Las funciones de trigger no se invocan fuera de un trigger, pero el EXECUTE a PUBLIC es el
-- default de Postgres y la 00102 lo cierra en todo el esquema: se sigue el mismo criterio.
REVOKE EXECUTE ON FUNCTION fn_fijar_registrado_por_origen_de_presupuesto() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_validar_origen_de_presupuesto() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_sincronizar_presupuesto_de_jornada() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_impedir_presupuesto_a_mano() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_origen_del_presupuesto_inicial() FROM PUBLIC;
