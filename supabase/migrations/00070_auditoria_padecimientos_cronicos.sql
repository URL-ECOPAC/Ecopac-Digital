-- Audita padecimientos_cronicos (issue #122).
--
-- POR QUE LLEGA TARDE
--
-- La 00026 puso trg_<tabla>_auditoria sobre las tablas sensibles: pacientes, expedientes,
-- consultas, recetas, movimientos_inventario y perfiles. Dejo fuera padecimientos_cronicos, que
-- se habia creado dieciseis migraciones antes.
--
-- La omision importa mas de lo que parece, porque es justo la excepcion del esquema clinico:
-- docs/PERMISOS.md documenta que ninguna tabla clinica tiene politica de DELETE **salvo
-- padecimientos_cronicos**, donde la 00010 se lo concede al administrador. Es decir, la unica
-- fila clinica que se puede borrar de verdad era tambien la unica que desaparecia sin dejar
-- rastro. Hasta ahora eso no se notaba porque ningun codigo del repositorio ejecutaba ese
-- DELETE; la API de condiciones cronicas de #122 es la primera que lo hace alcanzable desde la
-- aplicacion, asi que el hueco se cierra en el mismo PR que lo abre.
--
-- registrar_evento_auditoria() (00026) opera sobre to_jsonb(OLD) y to_jsonb(NEW) en vez de sobre
-- columnas concretas, asi que sirve a esta tabla sin tocarla ni conocer su forma.
--
-- No cambia ninguna politica RLS ni ningun GRANT: quien puede escribir sigue siendo exactamente
-- quien decidio la 00010. Solo se registra lo que ya se podia hacer.

CREATE TRIGGER trg_padecimientos_cronicos_auditoria
AFTER INSERT OR UPDATE OR DELETE ON padecimientos_cronicos
FOR EACH ROW
EXECUTE FUNCTION registrar_evento_auditoria();
