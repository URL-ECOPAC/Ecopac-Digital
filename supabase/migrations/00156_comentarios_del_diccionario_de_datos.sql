-- ============================================================================
-- 00156: descripcion de cada tabla, columna y tipo enumerado (issue #233)
-- ============================================================================
--
-- docs/DICCIONARIO-DE-DATOS.md se genera del catalogo de PostgreSQL
-- (scripts/generar-diccionario-de-datos.mjs) y sus descripciones son los COMMENT ON. Al generarlo
-- por primera vez, 39 de 52 tablas y 369 de 415 columnas no tenian ninguno: el diccionario decia
-- que columnas hay, pero no que guarda cada una. Esta migracion los completa.
--
-- Solo agrega comentarios: no cambia ninguna estructura, dato ni permiso. Un COMMENT ON sobre un
-- objeto que ya tenia uno lo reemplaza, asi que aqui solo se comenta lo que no tenia.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Columnas comunes: id, created_at y updated_at, en cada tabla que no las describa
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_columna RECORD;
  v_texto TEXT;
BEGIN
  FOR v_columna IN
    SELECT c.relname AS tabla, a.attname AS columna
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attname IN ('id', 'created_at', 'updated_at')
      AND col_description(c.oid, a.attnum) IS NULL
  LOOP
    v_texto := CASE v_columna.columna
      WHEN 'id' THEN 'Identificador de la fila. Lo genera la base.'
      WHEN 'created_at' THEN 'Cuando se creo la fila. Lo pone la base.'
      ELSE 'Cuando se modifico la fila por ultima vez. Lo mantiene el trigger actualizar_timestamp_updated_at.'
    END;
    EXECUTE format('COMMENT ON COLUMN public.%I.%I IS %L', v_columna.tabla, v_columna.columna, v_texto);
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- Usuarios, roles y permisos
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.perfiles IS
  'Persona que usa el sistema. Una fila por cuenta de auth.users (mismo id), creada por trigger al invitarla. Su rol decide que modulos ve y que puede hacer.';
COMMENT ON COLUMN public.perfiles.nombres IS 'Nombres de la persona.';
COMMENT ON COLUMN public.perfiles.apellidos IS 'Apellidos de la persona.';
COMMENT ON COLUMN public.perfiles.email IS 'Correo con el que inicia sesion; unico, sin distinguir mayusculas (citext).';
COMMENT ON COLUMN public.perfiles.telefono IS 'Telefono de contacto. Solo lo ven la administradora y la propia persona (perfiles_directorio lo enmascara).';
COMMENT ON COLUMN public.perfiles.rol IS 'Rol en el sistema (rol_usuario). Decide modulos y permisos por defecto.';
COMMENT ON COLUMN public.perfiles.activo IS 'FALSE = cuenta desactivada: no inicia sesion ni tiene privilegios. Se desactiva, no se borra.';
COMMENT ON COLUMN public.perfiles.fecha_ingreso IS 'Desde cuando colabora con la organizacion.';

COMMENT ON TABLE public.perfil_especialidad IS
  'Especialidades clinicas de un perfil (medicina general, odontologia, ...). Una persona puede tener varias.';
COMMENT ON COLUMN public.perfil_especialidad.perfil_id IS 'Perfil al que pertenece la especialidad.';
COMMENT ON COLUMN public.perfil_especialidad.nombre_especialidad IS 'Nombre de la especialidad.';

COMMENT ON TABLE public.permisos IS
  'Catalogo de permisos finos que se pueden delegar por rol (rol_permiso) o por persona (usuario_permiso). Ver docs/PERMISOS.md.';
COMMENT ON COLUMN public.permisos.clave IS 'Clave estable del permiso, con la forma modulo.accion (por ejemplo proyectos.gestionar). La usa tiene_permiso().';
COMMENT ON COLUMN public.permisos.modulo IS 'Modulo al que pertenece el permiso.';
COMMENT ON COLUMN public.permisos.descripcion IS 'Que habilita el permiso, en palabras de la organizacion.';

COMMENT ON TABLE public.rol_permiso IS
  'Permisos finos que un rol tiene por defecto.';
COMMENT ON COLUMN public.rol_permiso.rol IS 'Rol que recibe el permiso.';
COMMENT ON COLUMN public.rol_permiso.permiso_id IS 'Permiso que recibe.';

COMMENT ON TABLE public.usuario_permiso IS
  'Excepciones por persona sobre los permisos de su rol: conceder uno que el rol no trae o revocar uno que si trae.';
COMMENT ON COLUMN public.usuario_permiso.perfil_id IS 'Persona a la que se le hace la excepcion.';
COMMENT ON COLUMN public.usuario_permiso.permiso_id IS 'Permiso concedido o revocado.';
COMMENT ON COLUMN public.usuario_permiso.concedido IS 'TRUE concede el permiso; FALSE lo revoca de forma explicita aunque el rol lo traiga.';
COMMENT ON COLUMN public.usuario_permiso.otorgado_por IS 'Quien hizo la excepcion.';
COMMENT ON COLUMN public.usuario_permiso.motivo IS 'Por que se hizo, opcional.';

COMMENT ON COLUMN public.rol_modulo.rol IS 'Rol al que se le abre el modulo.';
COMMENT ON COLUMN public.rol_modulo.modulo IS 'Modulo de la navegacion que se abre (id de MODULOS en packages/shared/navegacion.js).';
COMMENT ON COLUMN public.rol_modulo.otorgado_por IS 'Quien lo abrio.';
COMMENT ON COLUMN public.rol_modulo.otorgado_en IS 'Cuando se abrio.';

COMMENT ON COLUMN public.limites_de_uso.recurso IS 'Que se limita (por ejemplo invitaciones o busqueda de pacientes).';
COMMENT ON COLUMN public.limites_de_uso.actor_id IS 'Perfil al que se le cuentan las peticiones.';
COMMENT ON COLUMN public.limites_de_uso.contador IS 'Peticiones hechas dentro de la ventana actual.';
COMMENT ON COLUMN public.limites_de_uso.ventana_inicio IS 'Cuando empezo la ventana de tiempo que se esta contando.';

-- ----------------------------------------------------------------------------
-- Territorio y catalogos generales
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.departamentos IS 'Los 22 departamentos de Guatemala. Catalogo fijo, cargado por migracion.';
COMMENT ON COLUMN public.departamentos.nombre IS 'Nombre del departamento.';

COMMENT ON TABLE public.municipios IS 'Municipios de Guatemala, cada uno en su departamento. Catalogo fijo, cargado por migracion.';
COMMENT ON COLUMN public.municipios.departamento_id IS 'Departamento al que pertenece.';
COMMENT ON COLUMN public.municipios.nombre IS 'Nombre del municipio.';

COMMENT ON TABLE public.comunidades IS
  'Aldeas, caserios y colonias donde se hacen jornadas y de donde vienen los pacientes. La organizacion las agrega; no es un catalogo oficial.';
COMMENT ON COLUMN public.comunidades.municipio_id IS 'Municipio en el que esta la comunidad.';
COMMENT ON COLUMN public.comunidades.nombre IS 'Nombre de la comunidad.';
COMMENT ON COLUMN public.comunidades.latitud IS 'Latitud para ubicarla en el mapa, opcional.';
COMMENT ON COLUMN public.comunidades.longitud IS 'Longitud para ubicarla en el mapa, opcional.';
COMMENT ON COLUMN public.comunidades.referencia_acceso IS 'Como llegar, en texto libre: una comunidad rural no siempre tiene direccion.';
COMMENT ON COLUMN public.comunidades.es_vigente IS 'FALSE = retirada (borrado logico): ya no se ofrece al elegir, pero conserva su historial.';

COMMENT ON COLUMN public.idiomas.codigo IS 'Clave del idioma; la guarda pacientes.idioma.';
COMMENT ON COLUMN public.idiomas.nombre IS 'Nombre del idioma para mostrar.';

-- ----------------------------------------------------------------------------
-- Pacientes y expediente
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.pacientes IS
  'Personas atendidas en las jornadas. Datos personales sensibles: solo los lee el personal que atiende (ver docs/PROTECCION-DE-DATOS.md).';
COMMENT ON COLUMN public.pacientes.nombres IS 'Nombres del paciente.';
COMMENT ON COLUMN public.pacientes.apellidos IS 'Apellidos del paciente.';
COMMENT ON COLUMN public.pacientes.fecha_nacimiento IS 'Fecha de nacimiento; de ella sale la edad a la fecha de cada jornada.';
COMMENT ON COLUMN public.pacientes.idioma IS 'Idioma en que se le atiende (idiomas.codigo).';
COMMENT ON COLUMN public.pacientes.dpi IS 'Documento Personal de Identificacion, opcional (un menor o una persona sin documento no lo tiene). Unico cuando existe.';
COMMENT ON COLUMN public.pacientes.fecha_baja IS 'Fecha en que se dio de baja al paciente (fallecimiento, fusion u otro motivo). NULL = activo.';
COMMENT ON COLUMN public.pacientes.tipo_sangre IS 'Grupo sanguineo, si se conoce.';
COMMENT ON COLUMN public.pacientes.nombre_responsable IS 'Persona responsable (de un menor o de quien no puede responder por si mismo).';
COMMENT ON COLUMN public.pacientes.parentesco_responsable IS 'Parentesco de la persona responsable con el paciente.';

COMMENT ON TABLE public.expedientes IS
  'Expediente clinico de un paciente: uno por paciente, con su numero de ficha. Las consultas cuelgan de el.';
COMMENT ON COLUMN public.expedientes.paciente_id IS 'Paciente dueno del expediente (unico).';
COMMENT ON COLUMN public.expedientes.numero_ficha IS 'Numero de ficha que ve el personal. Lo genera la base con una secuencia (00081).';

COMMENT ON COLUMN public.fusiones_pacientes.paciente_absorbido_id IS 'Paciente duplicado que se dio de baja al fusionar.';
COMMENT ON COLUMN public.fusiones_pacientes.paciente_sobreviviente_id IS 'Paciente que conserva el historial de los dos.';
COMMENT ON COLUMN public.fusiones_pacientes.realizada_por IS 'Quien hizo la fusion.';
COMMENT ON COLUMN public.fusiones_pacientes.realizada_en IS 'Cuando se hizo.';

COMMENT ON TABLE public.condiciones_cronicas IS
  'Catalogo de condiciones cronicas que se registran en los pacientes (diabetes, hipertension, ...).';
COMMENT ON COLUMN public.condiciones_cronicas.nombre IS 'Nombre de la condicion; unico.';

COMMENT ON TABLE public.padecimientos_cronicos IS
  'Condiciones cronicas de un paciente, con su fecha de diagnostico y si siguen activas.';
COMMENT ON COLUMN public.padecimientos_cronicos.paciente_id IS 'Paciente que tiene la condicion.';
COMMENT ON COLUMN public.padecimientos_cronicos.condicion_id IS 'Condicion del catalogo.';
COMMENT ON COLUMN public.padecimientos_cronicos.fecha_diagnostico IS 'Cuando se diagnostico, si se sabe; no puede ser futura.';
COMMENT ON COLUMN public.padecimientos_cronicos.estado IS 'Si la condicion sigue activa o ya se controlo o resolvio.';
COMMENT ON COLUMN public.padecimientos_cronicos.notas IS 'Observaciones de quien la registro.';

COMMENT ON TABLE public.triajes IS
  'Signos vitales tomados a un paciente en una atencion, antes de la consulta.';
COMMENT ON COLUMN public.triajes.atencion_id IS 'Atencion en la que se tomaron.';
COMMENT ON COLUMN public.triajes.presion_diastolica IS 'Presion arterial diastolica, en mmHg.';
COMMENT ON COLUMN public.triajes.glucosa IS 'Glucosa capilar, en mg/dL.';
COMMENT ON COLUMN public.triajes.peso IS 'Peso, en kilogramos.';
COMMENT ON COLUMN public.triajes.talla IS 'Talla, en centimetros. Con el peso da el IMC (columna generada).';
COMMENT ON COLUMN public.triajes.temperatura IS 'Temperatura, en grados Celsius.';
COMMENT ON COLUMN public.triajes.tomado_por IS 'Quien tomo los signos. Lo pone la base con auth.uid().';
COMMENT ON COLUMN public.triajes.tomado_en IS 'Cuando se tomaron.';

-- ----------------------------------------------------------------------------
-- Atencion clinica
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.atenciones IS
  'La visita de un paciente a una jornada: se abre al recibirlo y se cierra al terminar. Los signos vitales, la consulta y la receta cuelgan de ella.';
COMMENT ON COLUMN public.atenciones.paciente_id IS 'Paciente atendido.';
COMMENT ON COLUMN public.atenciones.jornada_id IS 'Jornada en la que se le atendio; tiene que estar en curso.';

COMMENT ON TABLE public.consultas IS
  'Consulta medica de una atencion: motivo, sintomas, exploracion, diagnosticos y tratamiento.';
COMMENT ON COLUMN public.consultas.expediente_id IS 'Expediente del paciente.';
COMMENT ON COLUMN public.consultas.atencion_id IS 'Atencion a la que pertenece la consulta.';
COMMENT ON COLUMN public.consultas.medico_id IS 'Medico que atendio.';
COMMENT ON COLUMN public.consultas.jornada_id IS 'Jornada en la que se hizo; la misma de la atencion.';
COMMENT ON COLUMN public.consultas.motivo_consulta IS 'Por que viene el paciente, en sus palabras.';
COMMENT ON COLUMN public.consultas.antecedentes IS 'Antecedentes relevantes.';
COMMENT ON COLUMN public.consultas.sintomas IS 'Sintomas que refiere.';
COMMENT ON COLUMN public.consultas.exploracion IS 'Hallazgos de la exploracion fisica.';
COMMENT ON COLUMN public.consultas.tratamiento IS 'Tratamiento indicado.';
COMMENT ON COLUMN public.consultas.observaciones IS 'Otras observaciones del medico.';
COMMENT ON COLUMN public.consultas.plan_seguimiento IS 'Que sigue: control, referencia, examenes.';

COMMENT ON TABLE public.diagnosticos IS
  'Catalogo de diagnosticos que se eligen en la consulta. La organizacion lo amplia; un diagnostico se desactiva, no se borra.';
COMMENT ON COLUMN public.diagnosticos.nombre IS 'Nombre del diagnostico.';
COMMENT ON COLUMN public.diagnosticos.descripcion IS 'Descripcion o criterios, opcional.';

COMMENT ON TABLE public.consulta_diagnostico IS
  'Diagnosticos de una consulta; uno puede marcarse como principal.';
COMMENT ON COLUMN public.consulta_diagnostico.consulta_id IS 'Consulta diagnosticada.';
COMMENT ON COLUMN public.consulta_diagnostico.diagnostico_id IS 'Diagnostico del catalogo.';
COMMENT ON COLUMN public.consulta_diagnostico.es_principal IS 'TRUE en el diagnostico principal de la consulta.';

COMMENT ON TABLE public.recetas IS
  'Receta emitida en una consulta. Se anula, no se borra: queda con su motivo y quien la anulo.';
COMMENT ON COLUMN public.recetas.consulta_id IS 'Consulta en la que se emitio.';
COMMENT ON COLUMN public.recetas.medico_id IS 'Medico que la emitio.';
COMMENT ON COLUMN public.recetas.folio IS 'Folio que se imprime en la receta. Lo genera la base.';
COMMENT ON COLUMN public.recetas.indicaciones_generales IS 'Indicaciones para el paciente que no son de un medicamento en particular.';
COMMENT ON COLUMN public.recetas.motivo_anulacion IS 'Por que se anulo; obligatorio al anular.';
COMMENT ON COLUMN public.recetas.anulada_en IS 'Cuando se anulo. NULL mientras siga emitida.';

COMMENT ON TABLE public.receta_detalle IS
  'Renglones de una receta: cada medicamento, su dosis y cuanto se entrego, de que lote.';
COMMENT ON COLUMN public.receta_detalle.receta_id IS 'Receta a la que pertenece el renglon.';
COMMENT ON COLUMN public.receta_detalle.medicamento_id IS 'Medicamento recetado.';
COMMENT ON COLUMN public.receta_detalle.lote_id IS 'Lote del que salio lo entregado.';
COMMENT ON COLUMN public.receta_detalle.dosis IS 'Dosis indicada (por ejemplo 1 tableta).';
COMMENT ON COLUMN public.receta_detalle.frecuencia IS 'Cada cuanto (por ejemplo cada 8 horas).';
COMMENT ON COLUMN public.receta_detalle.duracion IS 'Por cuanto tiempo (por ejemplo 5 dias).';
COMMENT ON COLUMN public.receta_detalle.cantidad_entregada IS 'Unidades entregadas; salen del inventario de la bodega de la jornada.';

-- ----------------------------------------------------------------------------
-- Inventario
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.medicamentos IS
  'Catalogo de articulos del inventario: medicamentos e insumos. Un articulo se desactiva, no se borra.';
COMMENT ON COLUMN public.medicamentos.nombre IS 'Nombre del articulo.';
COMMENT ON COLUMN public.medicamentos.concentracion IS 'Concentracion (por ejemplo 500 mg) o, en un insumo, su medida.';
COMMENT ON COLUMN public.medicamentos.marca IS 'Marca o laboratorio.';
COMMENT ON COLUMN public.medicamentos.forma_farmaceutica IS 'Forma farmaceutica (tableta, jarabe, ...). Se captura pero la presentacion la da presentacion_id.';
COMMENT ON COLUMN public.medicamentos.es_pediatrico IS 'TRUE si es de uso pediatrico.';
COMMENT ON COLUMN public.medicamentos.activo IS 'FALSE = desactivado: ya no se ofrece al registrar, pero conserva su historial.';
COMMENT ON COLUMN public.medicamentos.tipo_articulo IS 'Medicamento o insumo.';
COMMENT ON COLUMN public.medicamentos.presentacion_id IS 'Presentacion (caja, frasco, sobre, ...), del catalogo presentaciones.';

COMMENT ON TABLE public.principios_activos IS 'Catalogo de principios activos (paracetamol, amoxicilina, ...).';
COMMENT ON COLUMN public.principios_activos.nombre IS 'Nombre del principio activo.';

COMMENT ON TABLE public.medicamento_principio IS 'Principios activos de cada medicamento (un medicamento puede tener varios).';
COMMENT ON COLUMN public.medicamento_principio.medicamento_id IS 'Medicamento.';
COMMENT ON COLUMN public.medicamento_principio.principio_id IS 'Principio activo que contiene.';

COMMENT ON TABLE public.presentaciones IS 'Catalogo de presentaciones de un articulo (caja, frasco, blister, ...).';
COMMENT ON COLUMN public.presentaciones.nombre IS 'Nombre de la presentacion; unico.';

COMMENT ON TABLE public.bodegas IS
  'Lugares donde se guarda inventario: la bodega central y los botiquines moviles que viajan a las jornadas.';
COMMENT ON COLUMN public.bodegas.nombre IS 'Nombre de la bodega; unico.';
COMMENT ON COLUMN public.bodegas.ubicacion IS 'Donde esta, en texto libre.';
COMMENT ON COLUMN public.bodegas.es_movil IS 'TRUE si es un botiquin que viaja a las jornadas.';

COMMENT ON TABLE public.proveedores IS 'Proveedores y donantes de los que entra inventario.';
COMMENT ON COLUMN public.proveedores.nombre IS 'Nombre del proveedor.';
COMMENT ON COLUMN public.proveedores.contacto IS 'Persona o dato de contacto.';
COMMENT ON COLUMN public.proveedores.tipo IS 'Si es un proveedor comercial o un donante.';

COMMENT ON TABLE public.lotes IS
  'Lote de un articulo: numero, vencimiento, de donde vino y cuanto entro. Lo disponible por bodega esta en existencias.';
COMMENT ON COLUMN public.lotes.medicamento_id IS 'Articulo del lote.';
COMMENT ON COLUMN public.lotes.numero_lote IS 'Numero de lote del fabricante.';
COMMENT ON COLUMN public.lotes.fecha_vencimiento IS 'Fecha de vencimiento; un lote vencido no se entrega.';
COMMENT ON COLUMN public.lotes.proveedor_id IS 'Proveedor o donante del que entro.';
COMMENT ON COLUMN public.lotes.origen IS 'Si entro por compra o por donacion.';
COMMENT ON COLUMN public.lotes.cantidad_ingresada IS 'Unidades que entraron con el lote; no cambia al entregar.';
COMMENT ON COLUMN public.lotes.fecha_ingreso IS 'Cuando entro a bodega.';

COMMENT ON TABLE public.existencias IS
  'Cuanto hay de cada lote en cada bodega. La mantienen los movimientos aprobados; nadie la escribe a mano.';
COMMENT ON COLUMN public.existencias.lote_id IS 'Lote.';
COMMENT ON COLUMN public.existencias.bodega_id IS 'Bodega.';
COMMENT ON COLUMN public.existencias.cantidad_disponible IS 'Unidades disponibles ahora; nunca negativa.';

COMMENT ON TABLE public.movimientos_inventario IS
  'Ingresos y salidas de inventario. Un movimiento pendiente no cambia existencias; al aprobarse, si.';
COMMENT ON COLUMN public.movimientos_inventario.tipo IS 'Ingreso o salida.';
COMMENT ON COLUMN public.movimientos_inventario.lote_id IS 'Lote que se mueve.';
COMMENT ON COLUMN public.movimientos_inventario.bodega_id IS 'Bodega en la que entra o de la que sale.';
COMMENT ON COLUMN public.movimientos_inventario.cantidad IS 'Unidades que se mueven; mayor que cero.';
COMMENT ON COLUMN public.movimientos_inventario.motivo IS 'Por que: numero de comprobante en un ingreso, o entrega, traslado, baja o donacion en una salida.';
COMMENT ON COLUMN public.movimientos_inventario.estado IS 'Pendiente, aprobado o rechazado.';
COMMENT ON COLUMN public.movimientos_inventario.registrado_por IS 'Quien lo registro.';
COMMENT ON COLUMN public.movimientos_inventario.aprobado_por IS 'Quien lo aprobo; la misma persona si se aprobo solo por su rol.';
COMMENT ON COLUMN public.movimientos_inventario.aprobado_en IS 'Cuando se aprobo.';

COMMENT ON TABLE public.alertas_caducidad IS
  'Alerta de un lote vencido o por vencer. La genera la rutina diaria y se atiende donando, reubicando o descartando.';
COMMENT ON COLUMN public.alertas_caducidad.lote_id IS 'Lote de la alerta.';
COMMENT ON COLUMN public.alertas_caducidad.estado IS 'Pendiente o atendida.';
COMMENT ON COLUMN public.alertas_caducidad.cantidad_afectada IS 'Unidades del lote en riesgo cuando se genero la alerta.';
COMMENT ON COLUMN public.alertas_caducidad.accion IS 'Accion principal con la que se atendio.';
COMMENT ON COLUMN public.alertas_caducidad.atendida_por IS 'Quien la atendio.';
COMMENT ON COLUMN public.alertas_caducidad.atendida_en IS 'Cuando se atendio.';

COMMENT ON TABLE public.alerta_caducidad_detalle IS
  'Como se reparte la atencion de una alerta entre varias acciones (por ejemplo, parte donada y parte descartada).';
COMMENT ON COLUMN public.alerta_caducidad_detalle.alerta_id IS 'Alerta atendida.';
COMMENT ON COLUMN public.alerta_caducidad_detalle.accion IS 'Que se hizo con esta parte.';
COMMENT ON COLUMN public.alerta_caducidad_detalle.cantidad IS 'Unidades de esta parte.';
COMMENT ON COLUMN public.alerta_caducidad_detalle.bodega_destino_id IS 'Bodega a la que se reubico, si la accion es reubicado.';

-- ----------------------------------------------------------------------------
-- Jornadas
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.jornadas IS
  'Jornada medica o dental en una comunidad: su fecha, responsable, estado, presupuesto y, si lo tiene, el proyecto al que pertenece.';
COMMENT ON COLUMN public.jornadas.nombre IS 'Nombre de la jornada.';
COMMENT ON COLUMN public.jornadas.fecha IS 'Fecha programada; no puede ser anterior a la creacion.';
COMMENT ON COLUMN public.jornadas.comunidad_id IS 'Comunidad donde se hace.';
COMMENT ON COLUMN public.jornadas.responsable_id IS 'Persona a cargo.';
COMMENT ON COLUMN public.jornadas.proyecto_id IS 'Proyecto social al que pertenece, si alguno.';
COMMENT ON COLUMN public.jornadas.estado IS 'Planificada, en curso, finalizada o cancelada. Las transiciones las valida un trigger.';
COMMENT ON COLUMN public.jornadas.presupuesto_asignado IS 'Presupuesto de la jornada: la suma de sus origenes en jornada_presupuesto_origen, que mantiene un trigger. No se escribe a mano (00135).';
COMMENT ON COLUMN public.jornadas.fecha_inicio_real IS 'Cuando empezo de verdad (al pasarla a en curso).';
COMMENT ON COLUMN public.jornadas.fecha_fin_real IS 'Cuando termino de verdad (al finalizarla).';
COMMENT ON COLUMN public.jornadas.cupo_estimado IS 'Cuantos pacientes se espera atender.';
COMMENT ON COLUMN public.jornadas.botiquin_bodega_id IS 'Bodega que viaja a la jornada; de ella salen las entregas.';

COMMENT ON TABLE public.jornada_personal IS
  'Equipo de una jornada: quien va, con que rol, en que horario y si asistio.';
COMMENT ON COLUMN public.jornada_personal.jornada_id IS 'Jornada.';
COMMENT ON COLUMN public.jornada_personal.perfil_id IS 'Persona asignada.';
COMMENT ON COLUMN public.jornada_personal.rol_en_jornada IS 'Rol con el que participa.';
COMMENT ON COLUMN public.jornada_personal.hora_inicio IS 'Hora en que empieza su turno.';
COMMENT ON COLUMN public.jornada_personal.hora_fin IS 'Hora en que termina su turno.';
COMMENT ON COLUMN public.jornada_personal.responsabilidad IS 'Que le toca hacer, en texto libre.';
COMMENT ON COLUMN public.jornada_personal.asistio IS 'Si llego a la jornada; se marca al cerrarla.';

COMMENT ON TABLE public.jornada_estado_historial IS
  'Cada cambio de estado de una jornada, con quien lo hizo. Lo escribe un trigger.';
COMMENT ON COLUMN public.jornada_estado_historial.jornada_id IS 'Jornada.';
COMMENT ON COLUMN public.jornada_estado_historial.estado_anterior IS 'Estado del que salio; NULL al crearse.';
COMMENT ON COLUMN public.jornada_estado_historial.estado_nuevo IS 'Estado al que paso.';
COMMENT ON COLUMN public.jornada_estado_historial.cambiado_por IS 'Quien hizo el cambio.';

COMMENT ON COLUMN public.jornada_insumos.jornada_id IS 'Jornada para la que se preve el articulo.';
COMMENT ON COLUMN public.jornada_insumos.medicamento_id IS 'Articulo del catalogo de inventario.';
COMMENT ON COLUMN public.jornada_insumos.cantidad IS 'Cantidad prevista; mayor que cero.';
COMMENT ON COLUMN public.jornada_insumos.unidad IS 'Unidad de la cantidad (cajas, unidades, ...).';
COMMENT ON COLUMN public.jornada_insumos.nota IS 'Observacion opcional.';

-- ----------------------------------------------------------------------------
-- Presupuestos y gastos
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.gastos IS
  'Gasto de una jornada. Se registra pendiente y lo aprueba o rechaza quien administra presupuestos.';
COMMENT ON COLUMN public.gastos.jornada_id IS 'Jornada a la que se carga el gasto.';
COMMENT ON COLUMN public.gastos.concepto IS 'En que se gasto.';
COMMENT ON COLUMN public.gastos.categoria IS 'Categoria del gasto (medicamentos, logistica, honorarios, ...).';
COMMENT ON COLUMN public.gastos.monto IS 'Monto en quetzales; mayor que cero.';
COMMENT ON COLUMN public.gastos.fecha IS 'Fecha del gasto.';
COMMENT ON COLUMN public.gastos.responsable_id IS 'Quien hizo el gasto.';
COMMENT ON COLUMN public.gastos.estado IS 'Pendiente, aprobado o rechazado.';
COMMENT ON COLUMN public.gastos.registrado_por IS 'Quien lo registro.';
COMMENT ON COLUMN public.gastos.aprobado_por IS 'Quien lo aprobo o rechazo.';
COMMENT ON COLUMN public.gastos.aprobado_en IS 'Cuando se aprobo o rechazo.';

COMMENT ON COLUMN public.fuentes_de_presupuesto.nombre IS 'Nombre de quien aporta.';
COMMENT ON COLUMN public.fuentes_de_presupuesto.registrado_por IS 'Quien la registro.';

COMMENT ON COLUMN public.jornada_presupuesto_origen.jornada_id IS 'Jornada cuyo presupuesto se explica.';
COMMENT ON COLUMN public.jornada_presupuesto_origen.monto IS 'Parte del presupuesto que viene de este origen.';
COMMENT ON COLUMN public.jornada_presupuesto_origen.descripcion IS 'Detalle del aporte.';
COMMENT ON COLUMN public.jornada_presupuesto_origen.registrado_por IS 'Quien lo registro.';

-- ----------------------------------------------------------------------------
-- Proyectos sociales
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.proyectos IS
  'Proyecto social que agrupa jornadas: su equipo, gastos e insumos salen de ellas. Uno cancelado ya no se modifica (00154).';
COMMENT ON COLUMN public.proyectos.nombre IS 'Nombre del proyecto.';
COMMENT ON COLUMN public.proyectos.descripcion IS 'De que trata.';
COMMENT ON COLUMN public.proyectos.fecha_inicio IS 'Cuando empieza.';
COMMENT ON COLUMN public.proyectos.fecha_fin IS 'Cuando termina; no antes del inicio.';
COMMENT ON COLUMN public.proyectos.responsable_id IS 'Persona a cargo.';
COMMENT ON COLUMN public.proyectos.estado IS 'Planificado, en curso, finalizado o cancelado. Finalizado y cancelado son terminales.';
COMMENT ON COLUMN public.proyectos.porcentaje_avance IS 'Avance declarado, de 0 a 100. Cada cambio queda en proyecto_seguimiento.';

COMMENT ON TABLE public.proyecto_estado_historial IS
  'Cada cambio de estado de un proyecto, con quien lo hizo. Lo escribe un trigger.';
COMMENT ON COLUMN public.proyecto_estado_historial.proyecto_id IS 'Proyecto.';
COMMENT ON COLUMN public.proyecto_estado_historial.estado_anterior IS 'Estado del que salio; NULL al crearse.';
COMMENT ON COLUMN public.proyecto_estado_historial.estado_nuevo IS 'Estado al que paso.';
COMMENT ON COLUMN public.proyecto_estado_historial.cambiado_por IS 'Quien hizo el cambio.';

COMMENT ON COLUMN public.proyecto_hitos.proyecto_id IS 'Proyecto.';
COMMENT ON COLUMN public.proyecto_hitos.nombre IS 'Nombre del hito.';
COMMENT ON COLUMN public.proyecto_hitos.descripcion IS 'Detalle del hito, opcional.';
COMMENT ON COLUMN public.proyecto_hitos.fecha_prevista IS 'Cuando se espera cumplir.';

COMMENT ON COLUMN public.proyecto_insumos.proyecto_id IS 'Proyecto para el que se previo el articulo.';
COMMENT ON COLUMN public.proyecto_insumos.medicamento_id IS 'Articulo del catalogo de inventario.';
COMMENT ON COLUMN public.proyecto_insumos.cantidad IS 'Cantidad prevista; mayor que cero.';
COMMENT ON COLUMN public.proyecto_insumos.unidad IS 'Unidad de la cantidad.';
COMMENT ON COLUMN public.proyecto_insumos.nota IS 'Observacion opcional.';

COMMENT ON COLUMN public.proyecto_personal.proyecto_id IS 'Proyecto.';
COMMENT ON COLUMN public.proyecto_personal.perfil_id IS 'Persona que participa.';

COMMENT ON COLUMN public.proyecto_seguimiento.proyecto_id IS 'Proyecto.';
COMMENT ON COLUMN public.proyecto_seguimiento.nota IS 'Nota escrita a mano, opcional si hay cambio de porcentaje.';
COMMENT ON COLUMN public.proyecto_seguimiento.porcentaje_anterior IS 'Avance antes del cambio.';
COMMENT ON COLUMN public.proyecto_seguimiento.porcentaje_nuevo IS 'Avance despues del cambio.';
COMMENT ON COLUMN public.proyecto_seguimiento.registrado_por IS 'Quien anoto.';

-- ----------------------------------------------------------------------------
-- Donaciones
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.donantes IS 'Personas u organizaciones que donan. Se dan de baja, no se borran.';
COMMENT ON COLUMN public.donantes.nombre IS 'Nombre del donante.';
COMMENT ON COLUMN public.donantes.tipo IS 'Persona u organizacion.';
COMMENT ON COLUMN public.donantes.contacto IS 'Persona de contacto.';
COMMENT ON COLUMN public.donantes.telefono IS 'Telefono de contacto.';
COMMENT ON COLUMN public.donantes.email IS 'Correo de contacto.';
COMMENT ON COLUMN public.donantes.direccion IS 'Direccion.';
COMMENT ON COLUMN public.donantes.activo IS 'FALSE = dado de baja.';

COMMENT ON TABLE public.donaciones IS
  'Donacion recibida: de quien, cuando, de que tipo y, opcionalmente, para que proyecto o jornada. Se anula, no se borra.';
COMMENT ON COLUMN public.donaciones.donante_id IS 'Quien dono.';
COMMENT ON COLUMN public.donaciones.fecha IS 'Cuando se recibio.';
COMMENT ON COLUMN public.donaciones.tipo IS 'Dinero, medicamentos, insumos o servicios.';
COMMENT ON COLUMN public.donaciones.observaciones IS 'Observaciones.';
COMMENT ON COLUMN public.donaciones.estado IS 'Registrada o anulada.';
COMMENT ON COLUMN public.donaciones.motivo_anulacion IS 'Por que se anulo; obligatorio al anular.';
COMMENT ON COLUMN public.donaciones.anulada_por IS 'Quien la anulo.';
COMMENT ON COLUMN public.donaciones.anulada_en IS 'Cuando se anulo.';
COMMENT ON COLUMN public.donaciones.registrado_por IS 'Quien la registro.';
COMMENT ON COLUMN public.donaciones.proyecto_id IS 'Proyecto al que se destina, si alguno. Si hay jornada, es el de la jornada (00153).';

COMMENT ON TABLE public.donacion_detalle IS
  'Renglones de una donacion: que se dono y cuanto. Un renglon de medicamentos puede enlazarse al lote que se creo al ingresarlo a inventario.';
COMMENT ON COLUMN public.donacion_detalle.donacion_id IS 'Donacion a la que pertenece.';
COMMENT ON COLUMN public.donacion_detalle.descripcion IS 'Que se dono.';
COMMENT ON COLUMN public.donacion_detalle.cantidad IS 'Cantidad, en articulos donados.';
COMMENT ON COLUMN public.donacion_detalle.unidad IS 'Unidad de la cantidad.';
COMMENT ON COLUMN public.donacion_detalle.monto IS 'Monto en quetzales, en una donacion de dinero o de servicios.';
COMMENT ON COLUMN public.donacion_detalle.lote_id IS 'Lote que se creo al ingresar este renglon a inventario; unico.';

-- ----------------------------------------------------------------------------
-- Notificaciones y auditoria
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN public.notificaciones.perfil_id IS 'Persona que recibe la notificacion.';
COMMENT ON COLUMN public.notificaciones.categoria IS 'De que trata: caducidad, stock, validacion o presupuestos.';
COMMENT ON COLUMN public.notificaciones.titulo IS 'Titulo corto.';
COMMENT ON COLUMN public.notificaciones.cuerpo IS 'Texto de la notificacion.';
COMMENT ON COLUMN public.notificaciones.origen_id IS 'Fila que la origino, en la tabla que dice origen_tabla. Sin llave foranea: apunta a tablas distintas.';
COMMENT ON COLUMN public.notificaciones.leida_en IS 'Cuando la leyo. NULL = sin leer.';
COMMENT ON COLUMN public.notificaciones.correo_error IS 'Error del ultimo intento de enviarla por correo, si fallo.';

COMMENT ON COLUMN public.eventos_auditoria.tabla_afectada IS 'Tabla en la que ocurrio el cambio.';
COMMENT ON COLUMN public.eventos_auditoria.realizado_en IS 'Cuando ocurrio.';
COMMENT ON COLUMN public.eventos_auditoria.valores_nuevos IS 'La fila despues del cambio (to_jsonb(NEW)); NULL en un borrado.';

-- ----------------------------------------------------------------------------
-- Funciones que no tenian descripcion
-- ----------------------------------------------------------------------------
COMMENT ON FUNCTION public.es_administrador() IS
  'TRUE si quien esta conectado tiene rol administrador y su cuenta esta activa. La usan las politicas RLS.';
COMMENT ON FUNCTION public.tiene_permiso(TEXT) IS
  'TRUE si quien esta conectado tiene el permiso fino p_codigo: por su rol (rol_permiso) salvo que se le revoque, o concedido a el (usuario_permiso). La usan las politicas RLS.';
COMMENT ON FUNCTION public.participa_en_jornada(UUID) IS
  'TRUE si quien esta conectado, con la cuenta activa, esta en el equipo de la jornada (jornada_personal). La usan las politicas RLS.';
COMMENT ON FUNCTION public.fn_bloquear_gasto_finalizado() IS
  'Trigger: un gasto aprobado o rechazado ya no se modifica ni se borra.';
COMMENT ON FUNCTION public.fn_impedir_presupuesto_a_mano() IS
  'Trigger: rechaza un UPDATE que cambie jornadas.presupuesto_asignado fuera de la sincronizacion con jornada_presupuesto_origen (00135).';
COMMENT ON FUNCTION public.fn_origen_del_presupuesto_inicial() IS
  'Trigger: una jornada que se crea con presupuesto_asignado mayor que cero registra ese monto como un origen sin_clasificar, para que el asignado siga siendo la suma de sus origenes (00135).';
COMMENT ON FUNCTION public.fn_fijar_registrado_por_origen_de_presupuesto() IS
  'Trigger: pone registrado_por con auth.uid() en un origen de presupuesto; el cliente no lo manda ni lo puede falsear.';
COMMENT ON FUNCTION public.fn_validar_lote_de_renglon_de_donacion() IS
  'Trigger: el lote que se enlaza a un renglon de donacion tiene que ser del mismo medicamento que se dono (00135).';
COMMENT ON FUNCTION public.fn_proyecto_de_la_jornada_de_la_donacion() IS
  'Trigger: si una donacion es para una jornada, su proyecto es el de esa jornada (00153).';
COMMENT ON FUNCTION public.fn_registrar_donacion(UUID, public.tipo_donacion, DATE, JSONB, UUID, TEXT, UUID) IS
  'Registra una donacion y sus renglones en una sola transaccion. En una de medicamentos, la descripcion y la unidad de cada renglon salen del catalogo, no del cliente.';
COMMENT ON FUNCTION public.fn_notificar_alerta_caducidad() IS
  'Trigger: avisa en el buzon de la administracion cuando aparece una alerta de caducidad (00138).';
COMMENT ON FUNCTION public.fn_notificar_gasto_por_aprobar() IS
  'Trigger: avisa a quien aprueba gastos cuando se registra uno pendiente (00138).';
COMMENT ON FUNCTION public.fn_notificar_medicamento_sin_stock() IS
  'Trigger: avisa cuando un medicamento se queda sin existencias en todas las bodegas (00138).';
COMMENT ON FUNCTION public.fn_notificar_movimiento_por_validar() IS
  'Trigger: avisa a quien valida movimientos cuando se registra uno pendiente (00138).';
COMMENT ON FUNCTION public.fn_disparar_correo_de_notificaciones() IS
  'Trigger: pide a la Edge Function de correo (pg_net) que envie por correo la notificacion recien creada (00138).';
COMMENT ON FUNCTION public.impedir_baja_de_paciente_sin_ser_administrador() IS
  'Trigger: dar de baja a un paciente (fecha_baja) es solo de la administracion.';
COMMENT ON FUNCTION public.impedir_desactivar_sin_ser_administrador() IS
  'Trigger: desactivar un articulo o un diagnostico del catalogo es solo de la administracion.';
COMMENT ON FUNCTION public.impedir_retirar_sin_ser_administrador() IS
  'Trigger: retirar (es_vigente) una condicion cronica o una comunidad es solo de la administracion (00148).';

-- ----------------------------------------------------------------------------
-- Tipos enumerados
-- ----------------------------------------------------------------------------
-- Cada uno solo si existe en public. Un COMMENT ON TYPE sobre un tipo que no existe aborta toda la
-- migracion, y al aplicarla en un ambiente remoto `public.categoria_gasto` no existia (SQLSTATE
-- 42704) aunque la 00025 lo crea: esa base no coincide del todo con las migraciones. Un comentario
-- no es motivo para bloquear el despliegue. Lo que falte lo senala la prueba
-- diccionario_de_datos.sql, que corre contra una base creada desde cero.
DO $$
DECLARE
  v_tipo RECORD;
BEGIN
  FOR v_tipo IN
    SELECT * FROM (VALUES
      ('accion_alerta', 'Que se hace con un lote vencido o por vencer: donarlo, reubicarlo en otra bodega o descartarlo.'),
      ('categoria_gasto', 'Categoria de un gasto de jornada.'),
      ('estado_alerta', 'Estado de una alerta de caducidad.'),
      ('estado_condicion_cronica', 'Si una condicion cronica de un paciente sigue activa.'),
      ('estado_donacion', 'Estado de una donacion: registrada o anulada.'),
      ('estado_jornada', 'Estado de una jornada. Las transiciones las valida un trigger.'),
      ('estado_movimiento', 'Estado de un movimiento de inventario: pendiente, aprobado o rechazado.'),
      ('estado_proyecto', 'Estado de un proyecto. Finalizado y cancelado son terminales.'),
      ('estado_receta', 'Estado de una receta: emitida o anulada.'),
      ('operacion_auditoria', 'Operacion registrada en la bitacora de auditoria.'),
      ('origen_de_presupuesto', 'De donde viene una parte del presupuesto de una jornada.'),
      ('rol_usuario', 'Roles del sistema. Lo replica packages/shared/usuarios/roles.js; ver docs/PERMISOS.md.'),
      ('tipo_articulo', 'Si un articulo del inventario es medicamento o insumo.'),
      ('tipo_donacion', 'Que se dono: dinero, medicamentos, insumos o servicios.'),
      ('tipo_donante', 'Tipo de donante: persona u organizacion.'),
      ('tipo_movimiento', 'Ingreso o salida de inventario.'),
      ('tipo_sanguineo', 'Grupo sanguineo de un paciente.')
    ) AS t(nombre, texto)
  LOOP
    IF to_regtype(format('public.%I', v_tipo.nombre)) IS NOT NULL THEN
      EXECUTE format('COMMENT ON TYPE public.%I IS %L', v_tipo.nombre, v_tipo.texto);
    ELSE
      RAISE NOTICE '00156: el tipo public.% no existe en esta base; se omite su comentario.', v_tipo.nombre;
    END IF;
  END LOOP;
END;
$$;
