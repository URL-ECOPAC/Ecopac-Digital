-- Cerrar el CHECK del DPI sobre las filas que ya estaban (issue #847).
--
-- QUE QUEDO ABIERTO
--
-- La 00132 agrego chk_pacientes_dpi_13_digitos. Entro VALID y el despliegue a ecopac-dev fallo
-- con SQLSTATE 23514: habia pacientes con un DPI de otra longitud, capturados cuando la columna
-- era un VARCHAR(20) sin ninguna regla. La #840 lo cambio a NOT VALID para desbloquear el
-- despliegue: desde entonces todo DPI nuevo o editado cumple los 13 digitos, y los anteriores
-- siguen como estaban, sin revisar. Esta migracion los revisa y cierra el CHECK.
--
-- LA REGLA
--
-- Se decide por el formato, sin mirar paciente por paciente:
--
-- 1. Se quita del DPI todo lo que no sea un digito. Si lo que queda son exactamente 13, ese es el
--    DPI. Cubre lo que de verdad se ve en los datos: espacios, guiones y puntos de separacion
--    ("1234 56789 0101", "1234-56789-0101"), que son la misma identidad escrita de otra forma.
-- 2. Cualquier otro caso -menos de 13 digitos, mas de 13, o nada- pasa a NULL. La columna lo
--    admite desde el principio: mucha poblacion rural no tiene DPI, y un numero que no es un DPI
--    no vale mas que la ausencia de DPI. Inventarle digitos a uno incompleto seria peor: quedaria
--    un documento de identidad falso con apariencia de verdadero.
--
-- El paciente no se pierde en ningun caso: se vacia la columna dpi, nunca la fila. La busqueda
-- principal de pacientes es por nombre (00011), justamente porque el DPI no siempre esta.
--
-- NADA SE PIERDE SIN RASTRO
--
-- pacientes tiene trg_pacientes_auditoria (00026), que en cada UPDATE escribe to_jsonb(OLD) en
-- eventos_auditoria. El DPI anterior de cada fila que se toca aqui queda registrado ahi, dentro
-- de la base y bajo las mismas politicas que el resto del dato clinico. No hace falta -ni se
-- debe- sacar ningun DPI fuera para revisarlo.
--
-- LA COLUMNA ES UNIQUE
--
-- dpi es UNIQUE desde la 00009, asi que limpiar el formato puede hacer que dos filas distintas
-- apunten al mismo numero ("1234-56789-0101" y "1234567890101" son el mismo DPI escrito dos
-- veces). Cuando eso pasa se corrige la mas antigua -la que primero capturo esa identidad- y las
-- demas quedan en NULL: son candidatas a fusion de pacientes duplicados, que es lo que resuelve
-- la 00101, no esta migracion. Lo mismo si el numero limpio ya lo tiene otro paciente.

DO $$
DECLARE
  v_corregidos INTEGER;
  v_vaciados INTEGER;
BEGIN
  -- 1. Los que son solo un problema de formato y no chocan con nadie.
  WITH candidatos AS (
    SELECT
      id,
      regexp_replace(dpi, '[^0-9]', '', 'g') AS limpio,
      ROW_NUMBER() OVER (
        PARTITION BY regexp_replace(dpi, '[^0-9]', '', 'g')
        ORDER BY created_at, id
      ) AS orden
    FROM pacientes
    WHERE dpi IS NOT NULL
      AND dpi !~ '^[0-9]{13}$'
  ),
  aplicables AS (
    SELECT c.id, c.limpio
    FROM candidatos c
    WHERE c.limpio ~ '^[0-9]{13}$'
      AND c.orden = 1
      AND NOT EXISTS (SELECT 1 FROM pacientes p WHERE p.dpi = c.limpio)
  )
  UPDATE pacientes p
  SET dpi = a.limpio
  FROM aplicables a
  WHERE p.id = a.id;

  GET DIAGNOSTICS v_corregidos = ROW_COUNT;

  -- 2. Todo lo que siga sin cumplir, a NULL.
  UPDATE pacientes
  SET dpi = NULL
  WHERE dpi IS NOT NULL
    AND dpi !~ '^[0-9]{13}$';

  GET DIAGNOSTICS v_vaciados = ROW_COUNT;

  -- Solo cuentas: ningun DPI aparece en el log (regla de confidencialidad de AGENTS.md).
  RAISE NOTICE 'DPI (issue #847): % corregidos por formato, % vaciados.', v_corregidos, v_vaciados;
END;
$$;

-- Ya no queda ninguna fila que lo incumpla, asi que el CHECK pasa a valer tambien para las
-- anteriores. VALIDATE toma un SHARE UPDATE EXCLUSIVE, que no bloquea lecturas ni escrituras.
ALTER TABLE pacientes VALIDATE CONSTRAINT chk_pacientes_dpi_13_digitos;

COMMENT ON CONSTRAINT chk_pacientes_dpi_13_digitos ON pacientes IS
  'El DPI guatemalteco tiene exactamente 13 digitos (issue #699). Espejo de REGEX_DPI en '
  'packages/shared/pacientes/validaciones.js. NULL sigue permitido: el DPI es opcional. Validado '
  'sobre las filas anteriores en la 00137 (issue #847): las que solo tenian separadores se '
  'limpiaron, el resto quedo en NULL, y el DPI anterior de cada una esta en eventos_auditoria.';
