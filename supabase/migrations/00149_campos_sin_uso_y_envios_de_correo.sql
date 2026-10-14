-- ============================================================================
-- 00149: retira dos columnas sin uso, deja a la administracion ver el envio de
-- correos de las notificaciones y agrega el catalogo de fuentes de aportes
-- externos al presupuesto
-- ============================================================================
--
-- 1. jornadas.orden_kanban (00036) y proyectos.orden_columna (00029).
--
--    Las dos eran la posicion manual de una tarjeta dentro de su columna del
--    tablero. Ninguna pantalla ofrecio nunca reordenar a mano: jornadas se ordena
--    por fecha y proyectos por fecha de inicio y nombre. La auditoria
--    campo-a-vista de la #756 ya las declaraba sin uso, y la revision de campos de
--    esta issue decidio retirarlas en vez de dejarlas viajando en cada consulta.
--    Ninguna vista, funcion ni politica las lee (comprobado contra pg_depend y el
--    cuerpo de las funciones de public antes de escribir esto).
--
-- 2. notificaciones: lectura para la administracion.
--
--    correo_enviado_en, correo_intentado_en y correo_error (00138) dicen si el
--    correo de cada notificacion salio o por que fallo, y hasta aqui solo se
--    veian entrando a la base. La bitacora los muestra, y para eso la
--    administradora necesita leer las notificaciones de todas las personas, no
--    solo las suyas. Solo lectura: marcar como leida sigue siendo de cada quien
--    (la politica de UPDATE no cambia). El buzon personal no se entera: sus
--    consultas filtran por perfil_id ademas de RLS (notificaciones/api.js).
-- ============================================================================

ALTER TABLE public.jornadas DROP COLUMN orden_kanban;
ALTER TABLE public.proyectos DROP COLUMN orden_columna;

CREATE POLICY "La administracion lee el envio de todas las notificaciones"
  ON public.notificaciones
  FOR SELECT
  USING (public.es_administrador());

-- ============================================================================
-- 3. Fuentes de los aportes externos al presupuesto de una jornada.
--
--    "Registrar un aporte" ofrecia "+ Crear opcion" para agregar una opcion a
--    "De donde viene", pero el origen es el enum origen_de_presupuesto (00135):
--    no se le pueden sumar valores desde la aplicacion, y el boton cerraba sin
--    guardar nada. Lo que la administracion necesita nombrar es QUIEN aporta de
--    fuera (la municipalidad, una empresa, una iglesia), no un tipo de origen
--    nuevo. Esa es esta tabla: un catalogo de fuentes que se elige cuando el
--    origen es 'aporte_externo', para que el mismo aportante no se escriba de tres
--    maneras en el detalle libre.
-- ============================================================================

CREATE TABLE public.fuentes_de_presupuesto (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  nombre VARCHAR(120) NOT NULL,
  registrado_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fuentes_de_presupuesto_nombre CHECK (length(btrim(nombre)) > 0)
);

-- La misma fuente no se repite escrita con otras mayusculas o espacios.
CREATE UNIQUE INDEX uq_fuentes_de_presupuesto_nombre
  ON public.fuentes_de_presupuesto (lower(btrim(nombre)));

COMMENT ON TABLE public.fuentes_de_presupuesto IS
  'Quien aporta de fuera al presupuesto de una jornada (origen aporte_externo). Catalogo que crece desde "Registrar un aporte".';

ALTER TABLE public.fuentes_de_presupuesto ENABLE ROW LEVEL SECURITY;

-- Sin UPDATE ni DELETE: una fuente ya usada es parte de la historia de un presupuesto.
GRANT SELECT, INSERT ON public.fuentes_de_presupuesto TO authenticated;

-- La leen quienes leen los aportes (misma regla que la politica de SELECT de
-- jornada_presupuesto_origen).
CREATE POLICY "Leen fuentes de presupuesto quien lee los aportes"
  ON public.fuentes_de_presupuesto FOR SELECT
  USING (
    public.es_administrador()
    OR public.tiene_permiso('jornadas.gestionar')
    OR public.accede_a_modulo_por_matriz('jornadas')
    OR public.accede_a_modulo_por_matriz('presupuestos')
  );

-- La crean quienes registran aportes.
CREATE POLICY "Registran fuentes de presupuesto quien registra aportes"
  ON public.fuentes_de_presupuesto FOR INSERT
  WITH CHECK (public.es_administrador() OR public.tiene_permiso('jornadas.gestionar'));

CREATE TRIGGER trg_fuentes_de_presupuesto_auditoria
AFTER INSERT ON public.fuentes_de_presupuesto
FOR EACH ROW
EXECUTE FUNCTION public.registrar_evento_auditoria();

ALTER TABLE public.jornada_presupuesto_origen
  ADD COLUMN fuente_id UUID REFERENCES public.fuentes_de_presupuesto(id) ON DELETE RESTRICT,
  -- Una fuente solo tiene sentido en un aporte externo.
  ADD CONSTRAINT chk_presupuesto_origen_fuente_solo_externo
    CHECK (fuente_id IS NULL OR origen = 'aporte_externo');

COMMENT ON COLUMN public.jornada_presupuesto_origen.fuente_id IS
  'Quien hizo el aporte externo (fuentes_de_presupuesto). Opcional: el detalle libre sigue existiendo.';
