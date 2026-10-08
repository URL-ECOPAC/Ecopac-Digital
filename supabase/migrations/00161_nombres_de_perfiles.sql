-- ============================================================================
-- 00161: los nombres de las personas se ven donde se ve su trabajo
-- ============================================================================
--
-- `perfiles` la lee la administradora y cada quien la suya (00038), y `perfiles_directorio` solo
-- quien tiene Colaboradores o gestiona jornadas o proyectos (00148). Por eso un colaborador que
-- abria su jornada veia el equipo y al responsable como "—", el proyecto decia "Responsable: -" y
-- la lista de gastos mostraba el UUID del encargado; imprimir el cuadro de turnos llegaba a romper
-- la pantalla.
--
-- La administracion pidio que, aunque no se tenga acceso a Colaboradores, los nombres se vean en
-- esas partes. Un nombre no es un dato de contacto: esta vista expone solo id, nombres, apellidos
-- y si la persona esta activa -nada de telefono, correo, direccion ni notas- a toda persona activa.
-- Que filas se ven donde (la jornada, sus gastos, el proyecto) lo sigue decidiendo el RLS de esas
-- tablas; esta vista solo pone nombre a los ids que ya se ven.
--
-- Corre con los privilegios de su dueno (sin security_invoker), igual que perfiles_directorio: es
-- lo que le permite leer perfiles de otras personas. security_barrier impide que un filtro del
-- cliente se evalue antes que el WHERE de la vista.
-- ============================================================================

CREATE VIEW public.nombres_de_perfiles
WITH (security_barrier = true) AS
SELECT p.id,
       p.nombres,
       p.apellidos,
       p.activo
FROM public.perfiles p
WHERE public.rol_actual() IS NOT NULL;

COMMENT ON VIEW public.nombres_de_perfiles IS
  'Nombre de cada persona (id, nombres, apellidos, activo), sin datos de contacto, para toda persona activa (00161). Pone nombre a los ids que el RLS de cada tabla ya deja ver.';
COMMENT ON COLUMN public.nombres_de_perfiles.id IS 'Id del perfil (perfiles.id).';
COMMENT ON COLUMN public.nombres_de_perfiles.nombres IS 'Nombres de la persona.';
COMMENT ON COLUMN public.nombres_de_perfiles.apellidos IS 'Apellidos de la persona.';
COMMENT ON COLUMN public.nombres_de_perfiles.activo IS 'Si la persona esta activa; una inactiva conserva su nombre en lo que ya hizo.';

REVOKE ALL ON public.nombres_de_perfiles FROM PUBLIC, anon;
GRANT SELECT ON public.nombres_de_perfiles TO authenticated;
