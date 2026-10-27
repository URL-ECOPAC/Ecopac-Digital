-- Ecopac Digital - Saturacion de oxigeno y frecuencia respiratoria en los signos vitales (issue #964).
--
-- La administradora pidio agregarlas al paso "Signos vitales" de la consulta. Van en triajes (00013),
-- junto a los demas signos, y siguen sus mismas reglas:
--
-- - Opcionales, como todos desde la 00136: en jornada no siempre hay oximetro.
-- - Un CHECK de rango POSIBLE, no clinico: atrapa el digito de mas o de menos al anotar. Lo que es
--   alarmante para la edad lo avisa el cliente (signos.referencias.js) y no bloquea.
--     saturacion_oxigeno       50 a 100 %. Mas de 100 no existe; por debajo de 50 el oximetro de
--                              dedo ya no mide con fiabilidad y casi siempre es un error de captura.
--     frecuencia_respiratoria  4 a 100 respiraciones por minuto. Cubre la taquipnea de un neonato
--                              (que puede pasar de 60) y la bradipnea grave de un adulto.
-- - Cuentan como signo para chk_triajes_al_menos_un_signo: un triaje con solo la saturacion es un
--   triaje valido.

ALTER TABLE public.triajes
  ADD COLUMN saturacion_oxigeno SMALLINT,
  ADD COLUMN frecuencia_respiratoria SMALLINT;

ALTER TABLE public.triajes
  ADD CONSTRAINT chk_triajes_saturacion_oxigeno_rango
    CHECK (saturacion_oxigeno BETWEEN 50 AND 100),
  ADD CONSTRAINT chk_triajes_frecuencia_respiratoria_rango
    CHECK (frecuencia_respiratoria BETWEEN 4 AND 100);

ALTER TABLE public.triajes DROP CONSTRAINT chk_triajes_al_menos_un_signo;

ALTER TABLE public.triajes
  ADD CONSTRAINT chk_triajes_al_menos_un_signo
    CHECK (
      presion_sistolica IS NOT NULL
      OR frecuencia_cardiaca IS NOT NULL
      OR glucosa IS NOT NULL
      OR peso IS NOT NULL
      OR talla IS NOT NULL
      OR temperatura IS NOT NULL
      OR saturacion_oxigeno IS NOT NULL
      OR frecuencia_respiratoria IS NOT NULL
    );

COMMENT ON COLUMN public.triajes.saturacion_oxigeno IS
  'Saturacion de oxigeno (SpO2), en porcentaje. Opcional (00190, issue #964).';
COMMENT ON COLUMN public.triajes.frecuencia_respiratoria IS
  'Respiraciones por minuto. Opcional (00190, issue #964).';
COMMENT ON CONSTRAINT chk_triajes_al_menos_un_signo ON public.triajes IS
  'Un triaje registra al menos un signo (00136). Desde la 00190 cuentan tambien la saturacion de oxigeno y la frecuencia respiratoria.';
