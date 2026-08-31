-- Ecopac Digital - Direccion y notas del personal
--
-- Fusion del listado y la ficha de /voluntarios en una sola pantalla de tarjetas expandibles:
-- la vista expandida muestra estos dos datos, que hoy no existen en perfiles (migracion 00002).
--
-- Las dos columnas son texto libre y nulables: nadie las tiene todavia y por ahora no hay
-- formulario que las escriba (ModalAltaUsuario.jsx y ModalEdicionUsuario.jsx siguen limitados a
-- proposito a los campos que ya aceptaban, ver el comentario de useAltaUsuario.js /
-- useEdicionUsuario.js). Se llenan a mano desde el panel de Supabase hasta que exista ese
-- formulario.
--
-- No hace falta tocar RLS ni docs/PERMISOS.md: las politicas de perfiles (00038) son por fila,
-- no por columna, asi que quien ya podia leer o editar una fila de perfiles puede leer o editar
-- estas dos columnas nuevas sin ninguna politica adicional.

ALTER TABLE perfiles
  ADD COLUMN direccion TEXT,
  ADD COLUMN notas TEXT;

COMMENT ON COLUMN perfiles.direccion IS
  'Direccion de contacto en texto libre (ej. "Zona 10, Guatemala"). Nulable: dato opcional, sin formulario que lo escriba todavia.';

COMMENT ON COLUMN perfiles.notas IS
  'Notas internas sobre la persona (ej. disponibilidad, rol dentro del equipo). Nulable: dato opcional, sin formulario que lo escriba todavia.';
