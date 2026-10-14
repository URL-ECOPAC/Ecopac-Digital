-- Ecopac Digital - El catalogo de condiciones cronicas se puede escribir (issue #850)
--
-- QUE ESTABA MAL
--
-- condiciones_cronicas nacio en la 00010 con una nota que se quedo sin cumplir: "escribirlo queda
-- para el issue de politicas de escritura de catalogos". Desde entonces la tabla tiene
-- GRANT SELECT para authenticated (00032, recortado a solo authenticated por la 00049) y una
-- unica politica, la de SELECT de la 00079. Ni GRANT de INSERT/UPDATE, ni politica de escritura.
--
-- El cliente, en cambio, ya esta escrito como si se pudiera escribir: crearCondicionCatalogo() y
-- actualizarCondicionCatalogo() (packages/shared/pacientes/condiciones.api.js) hacen insert y
-- update contra esta tabla, y el hook useCatalogoCondiciones (issue #641) los monta. La 00115 le
-- agrego incluso es_vigente para el retiro logico. Nada de eso podia funcionar: cada alta muere
-- con 42501 antes de que RLS llegue a evaluarse. La auditoria de esquema de la #840 lo dejo
-- anotado como divergencia 2 de docs/MODELO-DE-DATOS.md, seccion 17.
--
-- QUIEN LO MANTIENE, Y POR QUE NO ES SOLO LA ADMINISTRACION
--
-- Una condicion cronica que falta en el catalogo se descubre en jornada, con el paciente delante,
-- y quien la ve es quien atiende. Si escribirla exige esperar a que la administracion la de de
-- alta, el dato se pierde o se escribe mal en otro campo. Por eso el INSERT alcanza a los tres
-- roles que atienden -administrador, medico y voluntario general- y no solo al administrador,
-- que es el criterio que sigue el catalogo de diagnosticos (00105).
--
-- Junta directiva y socio fundador quedan fuera a proposito: son los dos roles consultivos, y
-- desde la 00054 no tocan ninguna fila clinica. Un catalogo de diagnosticos cronicos lo es.
--
-- EL UPDATE NO SE REPARTE IGUAL QUE EL INSERT
--
-- Dar de alta y retirar no son la misma accion. Retirar una condicion del catalogo (es_vigente =
-- FALSE) la quita del selector de TODAS las fichas, y renombrarla reescribe lo que ya citan
-- expedientes ajenos: eso es curaduria del catalogo, no captura en jornada. El UPDATE queda solo
-- para el administrador.
--
-- Consecuencia que conviene tener presente y que docs/PERMISOS.md deja escrita: el voluntario
-- general puede dar de alta aqui, pero no vera el resultado en la ficha de ningun paciente,
-- porque padecimientos_cronicos (00010) no tiene ninguna politica para su rol, ni de SELECT. Para
-- el, el unico camino es la pantalla de catalogo. Abrir eso seria otra issue, no esta.

-- ============================================================================
-- 1. Los privilegios de tabla
-- ============================================================================
-- RLS no sustituye a los privilegios SQL (mismo criterio que 00031/00032/00033/00105): sin GRANT,
-- el INSERT muere en 42501 antes de que la politica se evalue. Es exactamente el vacio que dejo
-- rota la creacion de comunidades de la #662.
--
-- Solo authenticated, nunca anon: regla establecida por la 00049. anon no tiene sesion, asi que
-- rol_actual() le devuelve NULL y no pasaria ninguna de las dos politicas de todas formas.
--
-- Sin DELETE, por dos razones que se refuerzan: padecimientos_cronicos referencia el catalogo
-- ON DELETE RESTRICT (00010), asi que borrar una condicion ya usada fallaria -- y debe fallar,
-- porque el padecimiento de un paciente es historia clinica --; y la 00120 ya revoco DELETE por
-- defecto sobre todo el esquema public. El retiro es logico, con es_vigente (00115).
GRANT INSERT, UPDATE ON condiciones_cronicas TO authenticated;

-- ============================================================================
-- 2. Quien atiende da de alta
-- ============================================================================
CREATE POLICY "Quien atiende crea condiciones cronicas" ON condiciones_cronicas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.es_administrador()
    OR public.rol_actual() IN ('medico', 'voluntario general')
  );

-- ============================================================================
-- 3. La administracion mantiene el catalogo
-- ============================================================================
CREATE POLICY "Solo administrador mantiene el catalogo de condiciones" ON condiciones_cronicas
  FOR UPDATE TO authenticated
  USING (public.es_administrador())
  WITH CHECK (public.es_administrador());

-- La politica de SELECT no se toca: "Sesion activa lee condiciones_cronicas" (00079) sigue
-- abriendo el catalogo a cualquier sesion activa. Un catalogo no dice nada de ningun paciente, y
-- una condicion retirada tiene que seguir siendo legible para las fichas que ya la citan.

-- ============================================================================
-- 4. Que el mismo nombre no entre dos veces escrito de tres formas
-- ============================================================================
-- El UNIQUE de la 00010 es sobre la columna cruda, asi que es sensible a mayusculas, acentos y
-- espacios: hoy "Hipertension", "hipertension" y "Hipertension" con tilde conviven como tres
-- filas distintas. Con un solo rol escribiendo eso era teorico; con tres y una pantalla en cada
-- plataforma, deja de serlo.
--
-- El cliente ya elige la existente en vez de duplicarla (buscarOpcionPorEtiqueta, formato/
-- opciones.js), pero eso es una comodidad de la pantalla, no una garantia: dos personas
-- escribiendo a la vez, o cualquier llamada que no pase por ese selector, meten el duplicado
-- igual. La garantia es este indice.
--
-- public.f_unaccent(TEXT) es el wrapper IMMUTABLE de extensions.unaccent que la 00011 creo
-- justamente para poder normalizar dentro de un indice: extensions.unaccent() a secas es STABLE y
-- Postgres no la acepta en una expresion de indice.
CREATE UNIQUE INDEX idx_condiciones_cronicas_nombre_normalizado
  ON condiciones_cronicas (lower(public.f_unaccent(btrim(nombre))));

COMMENT ON INDEX idx_condiciones_cronicas_nombre_normalizado IS
  'Impide dos condiciones cuyo nombre solo difiere en mayusculas, acentos o espacios de los '
  'extremos. Complementa el UNIQUE de la columna cruda (00010), que no los distingue.';

COMMENT ON COLUMN condiciones_cronicas.es_vigente IS
  'Retiro logico del catalogo (00115): FALSE deja de ofrecerla al asignar una condicion nueva, '
  'sin romper las fichas que ya la citan. Solo el administrador la cambia (00140).';
