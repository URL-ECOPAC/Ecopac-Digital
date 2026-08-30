-- Ecopac Digital - Documentar por que pacientes.telefono_contacto no se unifica a telefono
-- (issue #412)
--
-- perfiles.telefono (00002) y donantes.telefono (00022) son el telefono propio de alguien con
-- agencia sobre su dato: un miembro del equipo, un donante. pacientes.telefono_contacto (00009)
-- es distinto por diseno: en las comunidades rurales que atiende Ecopac, un paciente puede ser
-- un nino o una persona mayor sin telefono propio, y el numero que se registra ahi es el de
-- quien se puede contactar por esa persona -un tutor, un familiar-, no necesariamente el suyo.
-- Renombrar a telefono perderia esa distincion y sugeriria, sin serlo, que siempre es el
-- telefono del paciente.
--
-- Se documenta la razon en vez de unificar. Ademas, el alcance de un renombrado aqui es alto:
-- pacientes.telefono_contacto es NOT NULL y la tocan 10 archivos de packages/shared/pacientes y
-- 12 suites pgTAP de RLS ya verificadas del modulo clinico central del sistema (00009: "cada
-- paciente tiene un expediente clinico unico... la regla de negocio central"), sin que la
-- unificacion agregue nada mas alla de lo cosmetico.

COMMENT ON COLUMN pacientes.telefono_contacto IS
  'Telefono para contactar sobre este paciente: puede ser el suyo o el de un tutor/familiar '
  '(comun en comunidades rurales con pacientes menores o adultos mayores sin telefono propio). '
  'Se llama distinto a perfiles.telefono/donantes.telefono a proposito -esas si son siempre el '
  'telefono de la persona duena del registro- y se documenta en vez de unificarse (issue #412).';
