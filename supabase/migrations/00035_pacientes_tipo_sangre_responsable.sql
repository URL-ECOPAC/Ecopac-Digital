-- Ecopac Digital - Agrega tipo_sangre, nombre_responsable y parentesco_responsable a pacientes
-- Estos tres campos estan en el diccionario de datos original de PACIENTE (entregable
-- Semana 6) pero se omitieron por descuido al escribir la 00009 (issue #69), que ya
-- esta aplicada en el proyecto remoto ecopac-dev (confirmado con
-- supabase migration list --linked): se agregan hacia adelante en vez de editarla.
--
-- Los tres son nullable en el diccionario original ("Si" en la columna Nulo): no todo
-- paciente llega con esa informacion disponible en el momento del registro.

CREATE TYPE tipo_sanguineo AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

ALTER TABLE pacientes
  ADD COLUMN tipo_sangre tipo_sanguineo,
  ADD COLUMN nombre_responsable VARCHAR(150),
  ADD COLUMN parentesco_responsable VARCHAR(50);
