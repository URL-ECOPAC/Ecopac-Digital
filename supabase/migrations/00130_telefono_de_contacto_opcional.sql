-- Ecopac Digital - El telefono de contacto del paciente deja de ser obligatorio (issue #838)
--
-- pacientes.telefono_contacto es NOT NULL desde la 00009. La 00093 ya habia documentado lo que
-- ese campo es de verdad:
--
--   'Telefono para contactar sobre este paciente: puede ser el suyo o el de un tutor/familiar
--    (comun en comunidades rurales con pacientes menores o adultos mayores sin telefono propio)'
--
-- Si el caso comun es que el numero sea de otra persona, el caso igual de comun es que no haya
-- ninguno. Exigirlo en el formulario deja dos salidas, las dos peores que un hueco: inventar un
-- numero -- que ademas viaja a la ficha clinica como si fuera real -- o no registrar al paciente.
-- Es el mismo razonamiento, y el mismo desenlace, que la 00111 aplico a comunidad_id (issue
-- #657).
--
-- LO QUE NO HAY QUE TOCAR, Y POR QUE
--
-- fn_registrar_paciente (00081) recibe p_telefono_contacto y lo inserta tal cual: ya acepta NULL,
-- porque el parametro no tiene restriccion propia -- la que rechazaba era la columna. No hace
-- falta otro DROP FUNCTION ni volver a otorgar el GRANT/REVOKE de la #511.
--
-- Ninguna vista, funcion ni politica RLS filtra ni agrupa por telefono_contacto: comprobado
-- contra pg_policies y contra las definiciones de vista_lotes_disponibles,
-- vista_reporte_impacto, fn_buscar_pacientes, fn_reporte_pacientes_atendidos y
-- fn_detectar_pacientes_duplicados. Un NULL aqui no esconde a nadie de ningun listado, que es lo
-- que si habria pasado con comunidad_id si la 00111 no hubiera cambiado tambien su JOIN.
--
-- La validacion del cliente (CAMPOS_REGISTRO_PACIENTE, packages/shared/pacientes/campos.js) se
-- afloja en el mismo PR: es la que hoy rechaza el formulario antes de llegar aqui.

ALTER TABLE pacientes
  ALTER COLUMN telefono_contacto DROP NOT NULL;

COMMENT ON COLUMN pacientes.telefono_contacto IS
  'Telefono para contactar sobre este paciente: puede ser el suyo o el de un tutor/familiar '
  '(comun en comunidades rurales con pacientes menores o adultos mayores sin telefono propio). '
  'Se llama distinto a perfiles.telefono/donantes.telefono a proposito -esas si son siempre el '
  'telefono de la persona duena del registro- y se documenta en vez de unificarse (issue #412). '
  'OPCIONAL desde la issue #838: en muchas comunidades no hay ningun numero al que llamar, y '
  'exigirlo llevaba a inventar uno o a no registrar al paciente.';
