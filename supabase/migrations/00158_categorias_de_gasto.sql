-- ============================================================================
-- 00158: las categorias de gasto pasan a un catalogo que se puede ampliar
-- ============================================================================
--
-- gastos.categoria era el enum categoria_gasto (00025) con seis valores fijos. El formulario de
-- gasto ofrecia "Crear categoria nueva", que solo agregaba la opcion en pantalla: al guardar, el
-- enum la rechazaba ("La categoria seleccionada no es valida"). Es el mismo defecto que la 00149
-- corrigio en el origen del presupuesto con fuentes_de_presupuesto, y se corrige igual: la
-- categoria es una fila de un catalogo y crearla la guarda.
--
-- gastos.categoria se queda con su nombre y su contenido (el texto de la categoria), ahora como
-- TEXT con llave foranea a categorias_de_gasto(nombre). Asi ningun gasto cambia de valor y el
-- cliente sigue leyendo y filtrando la misma columna.
--
-- La 00156 dejo anotado que en una base remota public.categoria_gasto no existia: esa base no
-- coincide del todo con las migraciones y su columna puede ser ya de texto, con categorias fuera
-- de las seis. Por eso el catalogo se siembra tambien con las que ya usan los gastos, y cada paso
-- funciona tanto si la columna es el enum como si es texto.
-- ============================================================================

CREATE TABLE public.categorias_de_gasto (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre TEXT NOT NULL,
  registrado_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_categorias_de_gasto_nombre_exacto UNIQUE (nombre),
  CONSTRAINT chk_categorias_de_gasto_nombre
    CHECK (length(btrim(nombre)) BETWEEN 1 AND 80 AND nombre = btrim(nombre))
);

-- La misma categoria no se repite escrita con otras mayusculas.
CREATE UNIQUE INDEX uq_categorias_de_gasto_nombre
  ON public.categorias_de_gasto (lower(nombre));

COMMENT ON TABLE public.categorias_de_gasto IS
  'Categorias de gasto (00158). Catalogo que crece desde el formulario de gasto ("Crear categoria nueva"); reemplaza al enum categoria_gasto.';
COMMENT ON COLUMN public.categorias_de_gasto.id IS 'Identificador de la categoria.';
COMMENT ON COLUMN public.categorias_de_gasto.nombre IS
  'Nombre de la categoria, tal como se muestra y como lo guarda gastos.categoria. Unico sin importar mayusculas.';
COMMENT ON COLUMN public.categorias_de_gasto.registrado_por IS 'Quien creo la categoria (auth.uid()).';
COMMENT ON COLUMN public.categorias_de_gasto.created_at IS 'Cuando se creo la categoria.';

-- Siembra: las seis del enum y las que ya aparecen en gastos. Si dos de estas solo difieren en
-- mayusculas o espacios, se queda la primera y los gastos se normalizan a ella mas abajo.
INSERT INTO public.categorias_de_gasto (nombre, registrado_por)
SELECT nombre, NULL
FROM (
  SELECT btrim(v.nombre) AS nombre, v.orden
  FROM (VALUES
    ('Medicamentos', 1), ('Logistica', 2), ('Diagnostico', 3),
    ('Honorarios', 4), ('Educacion', 5), ('Infraestructura', 6)
  ) AS v(nombre, orden)
  UNION ALL
  SELECT DISTINCT btrim(g.categoria::TEXT), 100
  FROM public.gastos g
  WHERE g.categoria IS NOT NULL AND btrim(g.categoria::TEXT) <> ''
) AS candidatas
ORDER BY orden, nombre
ON CONFLICT DO NOTHING;

-- La columna pasa a texto. Si ya lo era, no cambia nada.
ALTER TABLE public.gastos ALTER COLUMN categoria TYPE TEXT USING categoria::TEXT;

-- Gastos cuya categoria solo difiere de la del catalogo en mayusculas o espacios. Un gasto aprobado
-- o rechazado no se puede tocar (tr_bloquear_gasto_finalizado), pero esto no cambia lo que dice:
-- solo lo escribe como esta en el catalogo, para que la llave foranea lo reconozca.
ALTER TABLE public.gastos DISABLE TRIGGER tr_bloquear_gasto_finalizado;
UPDATE public.gastos g
SET categoria = c.nombre
FROM public.categorias_de_gasto c
WHERE lower(btrim(g.categoria)) = lower(c.nombre)
  AND g.categoria IS DISTINCT FROM c.nombre;
ALTER TABLE public.gastos ENABLE TRIGGER tr_bloquear_gasto_finalizado;

ALTER TABLE public.gastos
  ADD CONSTRAINT fk_gastos_categoria
  FOREIGN KEY (categoria) REFERENCES public.categorias_de_gasto(nombre)
  ON UPDATE CASCADE ON DELETE RESTRICT;

COMMENT ON COLUMN public.gastos.categoria IS
  'Categoria del gasto: el nombre de una fila de categorias_de_gasto (00158; antes el enum categoria_gasto).';

-- Ya nada usa el enum.
DROP TYPE IF EXISTS public.categoria_gasto;

ALTER TABLE public.categorias_de_gasto ENABLE ROW LEVEL SECURITY;

-- Sin UPDATE ni DELETE: una categoria ya usada es parte de la historia de los gastos.
GRANT SELECT, INSERT ON public.categorias_de_gasto TO authenticated;

-- La lee toda persona activa: son nombres, y la necesita quien registra un gasto en su jornada.
CREATE POLICY "Leen categorias de gasto las personas activas"
  ON public.categorias_de_gasto FOR SELECT
  USING (public.rol_actual() IS NOT NULL);

-- La crea quien registra o aprueba gastos por delegacion, y la administradora. El personal de
-- campo registra gastos en su jornada con las categorias que ya existen.
CREATE POLICY "Crean categorias de gasto quien registra o aprueba gastos"
  ON public.categorias_de_gasto FOR INSERT
  WITH CHECK (
    public.es_administrador()
    OR public.tiene_permiso('presupuestos.registrar')
    OR public.tiene_permiso('presupuestos.aprobar')
  );

CREATE TRIGGER trg_categorias_de_gasto_auditoria
AFTER INSERT ON public.categorias_de_gasto
FOR EACH ROW
EXECUTE FUNCTION public.registrar_evento_auditoria();

COMMENT ON TRIGGER trg_categorias_de_gasto_auditoria ON public.categorias_de_gasto IS
  'Deja en la bitacora de auditoria quien creo cada categoria de gasto.';
