-- Ecopac Digital - Ningun signo vital es obligatorio (issue #840, reglas B2 y G2, bloque F).
--
-- triajes (00013) exigia presion sistolica, presion diastolica y frecuencia cardiaca: NOT NULL.
-- En jornada muchas veces no hay tensiometro, igual que no hay glucometro ni bascula -que ya eran
-- opcionales-, y un triaje sin esos tres datos no se podia guardar. La consecuencia en campo era
-- inventar un valor para poder avanzar, que es peor que no tenerlo.
--
-- Con la consulta como unidad del historial (bloque F), los signos son un paso OPCIONAL de la
-- consulta: se toman o no. Esta migracion hace que la base diga lo mismo.
--
-- Lo que se sigue exigiendo, porque un triaje sin esto no tiene sentido:
-- - Al menos un signo. Una fila de triajes sin ninguna medicion no registra nada: si no se tomo
--   ninguno, no se crea el triaje.
-- - La presion completa o nada: una sistolica sin diastolica (o al reves) es casi siempre un
--   dato a medio anotar, y chk_triajes_presion_coherente no puede comparar lo que falta.
--
-- Los CHECK de rango de la 00013 no cambian: un CHECK con NULL da NULL y no rechaza la fila, asi
-- que siguen protegiendo el valor cuando lo hay.

ALTER TABLE triajes
  ALTER COLUMN presion_sistolica DROP NOT NULL,
  ALTER COLUMN presion_diastolica DROP NOT NULL,
  ALTER COLUMN frecuencia_cardiaca DROP NOT NULL;

ALTER TABLE triajes
  ADD CONSTRAINT chk_triajes_presion_completa
    CHECK ((presion_sistolica IS NULL) = (presion_diastolica IS NULL)),
  ADD CONSTRAINT chk_triajes_al_menos_un_signo
    CHECK (
      presion_sistolica IS NOT NULL
      OR frecuencia_cardiaca IS NOT NULL
      OR glucosa IS NOT NULL
      OR peso IS NOT NULL
      OR talla IS NOT NULL
      OR temperatura IS NOT NULL
    );

COMMENT ON COLUMN triajes.presion_sistolica IS
  'mmHg. Opcional desde la 00135 (issue #840): va junto con la diastolica o no va ninguna.';
COMMENT ON COLUMN triajes.frecuencia_cardiaca IS
  'Latidos por minuto. Opcional desde la 00135 (issue #840).';

-- ============================================================================
-- La cola de la jornada, con signos opcionales
-- ============================================================================
--
-- vista_cola_jornada (00060) decidia la etapa mirando primero si habia triaje: sin triaje,
-- "espera triaje". Con los signos opcionales, una consulta registrada sin signos dejaria al
-- paciente en "espera triaje" para siempre. Se decide ahora de lo mas avanzado a lo menos: lo que
-- ya ocurrio manda.
--
-- La cola deja de mostrarse en la app movil con esta misma issue, pero la vista no se borra: el
-- panel de jornada la sigue pudiendo consultar, y la decision de retirarla del todo queda para
-- cuando se confirme que ninguna jornada grande la necesita. Las columnas y su orden no cambian,
-- asi que CREATE OR REPLACE conserva el GRANT de la 00060.
CREATE OR REPLACE VIEW vista_cola_jornada AS
SELECT
  a.id           AS atencion_id,
  a.jornada_id,
  a.paciente_id,
  p.nombres,
  p.apellidos,
  a.created_at   AS iniciada_en,

  CASE
    WHEN r.id IS NOT NULL THEN 'espera entrega'
    WHEN c.id IS NOT NULL THEN 'lista para cerrar'
    WHEN t.id IS NOT NULL THEN 'espera consulta'
    ELSE 'espera triaje'
  END AS etapa,

  CASE
    WHEN c.id IS NOT NULL THEN c.created_at
    WHEN t.id IS NOT NULL THEN t.created_at
    ELSE a.created_at
  END AS esperando_desde

FROM atenciones a
JOIN pacientes p ON p.id = a.paciente_id
LEFT JOIN triajes t ON t.atencion_id = a.id
LEFT JOIN consultas c ON c.atencion_id = a.id
LEFT JOIN recetas r ON r.consulta_id = c.id
WHERE a.cerrada_en IS NULL
  AND (public.es_administrador() OR public.participa_en_jornada(a.jornada_id));

COMMENT ON VIEW vista_cola_jornada IS
  'Cola de pacientes de una jornada, por etapa del flujo (issue #173, RF-24). Solo atenciones
   abiertas (cerrada_en IS NULL). Desde la 00135 (issue #840) la etapa se decide de lo mas
   avanzado a lo menos, porque los signos vitales son opcionales: una consulta sin triaje ya no
   deja al paciente en "espera triaje".
   SECURITY DEFINER a proposito: un voluntario general no puede leer consultas ni recetas
   (00033), asi que con security_invoker veria a todo paciente ya atendido como si siguiera
   esperando consulta. El owner lee las tablas base y el WHERE restringe las filas a quien
   participa en la jornada, mas la administradora.
   No expone ningun dato clinico: se ve QUE hubo consulta, no lo que dice.';
