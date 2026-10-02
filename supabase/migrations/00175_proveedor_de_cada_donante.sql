-- ============================================================================
-- 00175: cada donante tiene su proveedor en inventario, y es el mismo
-- ============================================================================
--
-- `donantes` (00022) y `proveedores` (00017) son dos catalogos sin relacion. Un lote donado
-- necesita un proveedor (lotes.proveedor_id), asi que el ingreso de una donacion buscaba un
-- proveedor de tipo 'donante' con el mismo nombre y, si no lo encontraba, lo creaba
-- (obtenerOCrearProveedorPorNombre, issue #756). Ademas inventario dejaba crear proveedores de tipo
-- donante a mano. Resultado: los "donantes" de inventario y los de Donaciones no coincidian -habia
-- proveedores donantes que no eran donantes, donantes sin proveedor, y contactos distintos para la
-- misma organizacion-, y editar uno no cambiaba el otro.
--
-- Desde aqui el donante manda y el proveedor lo sigue:
--
-- 1. proveedores.donante_id enlaza el proveedor con su donante (uno a uno). Solo un proveedor de
--    tipo 'donante' puede tenerlo.
-- 2. Se enlazan los proveedores donantes que ya existian con el donante del mismo nombre (sin
--    acentos ni mayusculas). A los que no tienen donante se les crea uno, de tipo persona: se
--    corrige despues desde Donantes si era una organizacion.
-- 3. Un trigger sobre donantes crea o actualiza el proveedor al registrar el donante o al cambiar
--    su nombre o sus datos de contacto. Cada donante que ya existia recibe el suyo aqui mismo.
--
-- El contacto del proveedor es uno solo (VARCHAR(150)): se arma con el contacto, el telefono y el
-- correo del donante.
-- ============================================================================

ALTER TABLE public.proveedores
  ADD COLUMN donante_id UUID UNIQUE REFERENCES public.donantes (id) ON DELETE RESTRICT;

ALTER TABLE public.proveedores
  ADD CONSTRAINT chk_proveedores_donante_solo_en_tipo_donante
  CHECK (donante_id IS NULL OR tipo = 'donante');

COMMENT ON COLUMN public.proveedores.donante_id IS
  'Donante del que sale este proveedor (00175). Lo mantiene un trigger sobre donantes: el nombre y el contacto se editan en el donante, no aqui.';

-- ----------------------------------------------------------------------------
-- 1. El proveedor de un donante
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER: quien registra donantes por delegacion (donaciones.registrar, 00086) no
-- escribe proveedores por RLS (00062, solo administrador), y el proveedor tiene que existir igual.
-- No devuelve nada que quien escribe no pudiera ver: el id del proveedor.
CREATE FUNCTION public.fn_sincronizar_proveedor_de_donante(p_donante_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_donante public.donantes;
  v_proveedor_id UUID;
  v_nombre TEXT;
  v_contacto TEXT;
BEGIN
  SELECT * INTO v_donante FROM public.donantes WHERE id = p_donante_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_contacto := LEFT(
    NULLIF(concat_ws(' · ', v_donante.contacto, v_donante.telefono, v_donante.email::TEXT), ''),
    150
  );

  SELECT id INTO v_proveedor_id FROM public.proveedores WHERE donante_id = p_donante_id;

  -- Sin proveedor enlazado, adopta el proveedor donante suelto del mismo nombre, si lo hay.
  IF v_proveedor_id IS NULL THEN
    SELECT id INTO v_proveedor_id
    FROM public.proveedores
    WHERE tipo = 'donante'
      AND donante_id IS NULL
      AND lower(public.f_unaccent(trim(nombre))) = lower(public.f_unaccent(trim(v_donante.nombre)))
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- proveedores.nombre es UNIQUE: si un proveedor comercial ya tiene ese nombre, el del donante
  -- se distingue con un sufijo en vez de fallar.
  v_nombre := v_donante.nombre;
  IF EXISTS (
    SELECT 1 FROM public.proveedores
    WHERE nombre = v_nombre AND id IS DISTINCT FROM v_proveedor_id
  ) THEN
    v_nombre := LEFT(v_donante.nombre, 139) || ' (donante)';
  END IF;

  IF v_proveedor_id IS NULL THEN
    INSERT INTO public.proveedores (nombre, contacto, tipo, donante_id)
    VALUES (v_nombre, v_contacto, 'donante', p_donante_id)
    RETURNING id INTO v_proveedor_id;
  ELSE
    UPDATE public.proveedores
    SET nombre = v_nombre,
        contacto = v_contacto,
        tipo = 'donante',
        donante_id = p_donante_id
    WHERE id = v_proveedor_id;
  END IF;

  RETURN v_proveedor_id;
END;
$$;

COMMENT ON FUNCTION public.fn_sincronizar_proveedor_de_donante(UUID) IS
  'Crea o actualiza el proveedor de tipo donante de un donante, con su mismo nombre y su contacto (00175).';

REVOKE EXECUTE ON FUNCTION public.fn_sincronizar_proveedor_de_donante(UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Los proveedores donantes que ya existian
-- ----------------------------------------------------------------------------
-- Se enlazan con el donante del mismo nombre: un donante y un proveedor como mucho, el mas antiguo.
WITH pares AS (
  SELECT DISTINCT ON (p.id) p.id AS proveedor_id, d.id AS donante_id
  FROM public.proveedores p
  JOIN public.donantes d
    ON lower(public.f_unaccent(trim(p.nombre))) = lower(public.f_unaccent(trim(d.nombre)))
  WHERE p.tipo = 'donante'
  ORDER BY p.id, d.created_at
),
unicos AS (
  SELECT DISTINCT ON (donante_id) proveedor_id, donante_id
  FROM pares
  ORDER BY donante_id, proveedor_id
)
UPDATE public.proveedores p
SET donante_id = unicos.donante_id
FROM unicos
WHERE p.id = unicos.proveedor_id;

-- Los que no tienen donante reciben uno. Va antes del trigger: se enlazan aqui abajo.
INSERT INTO public.donantes (nombre, tipo, contacto)
SELECT p.nombre, 'persona', p.contacto
FROM public.proveedores p
WHERE p.tipo = 'donante'
  AND p.donante_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.donantes d WHERE d.nombre = p.nombre);

UPDATE public.proveedores p
SET donante_id = d.id
FROM public.donantes d
WHERE p.tipo = 'donante'
  AND p.donante_id IS NULL
  AND d.nombre = p.nombre
  AND NOT EXISTS (SELECT 1 FROM public.proveedores otro WHERE otro.donante_id = d.id);

-- Y cada donante deja su proveedor al dia: nombre, contacto, o uno nuevo si no tenia.
SELECT public.fn_sincronizar_proveedor_de_donante(id) FROM public.donantes ORDER BY created_at;

-- ----------------------------------------------------------------------------
-- 3. De aqui en adelante, lo mantiene un trigger
-- ----------------------------------------------------------------------------
CREATE FUNCTION public.fn_proveedor_sigue_al_donante()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.fn_sincronizar_proveedor_de_donante(NEW.id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_proveedor_sigue_al_donante() IS
  'Al registrar un donante o cambiar su nombre o contacto, crea o actualiza su proveedor (00175).';

REVOKE EXECUTE ON FUNCTION public.fn_proveedor_sigue_al_donante() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_donantes_proveedor
AFTER INSERT OR UPDATE OF nombre, contacto, telefono, email ON public.donantes
FOR EACH ROW
EXECUTE FUNCTION public.fn_proveedor_sigue_al_donante();
