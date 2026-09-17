import { useState } from "react";

import {
  CAMPOS_EDICION_USUARIO,
  useEdicionUsuario,
  useEspecialidadesDePerfil,
} from "@ecopac/shared";

import { Save, UserCheck, UserX, X } from "lucide-react";

import Modal from "../components/Modal";
import MultiSelector from "../components/MultiSelector";
import PrimaryButton from "../components/PrimaryButton";
import SeccionDeFormulario from "../components/SeccionDeFormulario";
import SecondaryButton from "../components/SecondaryButton";
import ModalConfirmarDesactivacion from "./ModalConfirmarDesactivacion";

// Modal de edicion de usuario (issue #107), abierto al clickear una fila de
// ColaboradoresPage.jsx (issue #105): no tiene ruta propia, mismo patron que
// ModalAltaUsuario.jsx (#106) -Modal generico + Selector/TextField elegidos a mano por
// campo.tipo-. La Pregunta 1 del plan de #107 decidio abrir desde la fila del listado en vez
// de una ficha de #184, que todavia no existe.
//
// Solo dibuja lo que useEdicionUsuario() le entrega. Etiquetas, tipos y orden de los campos
// salen de CAMPOS_EDICION_USUARIO (el subconjunto de CAMPOS_USUARIO que declara ese hook), no
// de literales propios.
//
// LAS ESPECIALIDADES YA SE PUEDEN EDITAR. El comentario que estaba aqui decia que el selector
// del prototipo no existia porque "perfil_especialidad es de solo lectura hasta el issue #405, y
// ademas TIPOS_DE_CAMPO.ETIQUETAS no tiene ningun componente del catalogo que lo dibuje
// editable". Las dos razones dejaron de ser ciertas: la migracion 00085 (esa misma issue #405)
// habilito INSERT y DELETE sobre la tabla, y MultiSelector es ahora parte del catalogo. Sin
// esto, dar de alta a un medico no permitia decir de que es especialista, que es justo el dato
// por el que se busca a un medico en el listado de colaboradores.
//
// Van en su propio bloque, con su propio boton de guardar, y no dentro del formulario de
// arriba: son OTRA TABLA, con sus propias politicas y su propia forma de escribirse (borrar e
// insertar, porque la PK de perfil_especialidad es la pareja y no tiene UPDATE). Un solo boton
// que escribiera las dos tendria que decidir que hacer cuando una falla y la otra no.
//
// Desactivar/reactivar (criterio 2) se abre desde aca, con un boton propio que abre
// ModalConfirmarDesactivacion.
export default function ModalEdicionUsuario({
  perfil,
  idSesionActual,
  rol,
  onClose,
  onGuardado,
  onEspecialidadesGuardadas,
}) {
  const { valores, errores, error, enviando, setCampo, guardar } = useEdicionUsuario(perfil);
  const especialidades = useEspecialidadesDePerfil(perfil?.id, { rol, idSesionActual });
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const esUnoMismo = perfil?.id === idSesionActual;

  // Guardar especialidades no cerraba nada ni avisaba a nadie: la lista de colaboradores seguia con
  // las de antes hasta recargar la pagina, y parecia que el cambio "tardaba en cargar".
  const guardarEspecialidades = async () => {
    const resultado = await especialidades.guardar();
    if (resultado.ok) onEspecialidadesGuardadas?.(resultado.especialidades);
  };

  const guardarCambios = async () => {
    const resultado = await guardar();
    if (resultado.ok) onGuardado?.(resultado.perfil);
  };

  return (
    <>
      <Modal visible={!mostrarConfirmacion} onClose={onClose} title="Editar colaborador" size="lg">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error.mensaje}
          </div>
        )}

        <SeccionDeFormulario
          titulo="Datos del colaborador"
          descripcion="Los datos de contacto y el rol con el que entra al sistema."
          acento="var(--accent-colaboradores)"
          campos={CAMPOS_EDICION_USUARIO}
          valores={valores}
          errores={errores}
          onChange={setCampo}
          disabled={enviando}
        >
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              {esUnoMismo ? (
                <span className="text-body-secondary small">
                  No puedes desactivar tu propia cuenta.
                </span>
              ) : (
                <SecondaryButton
                  title={perfil?.activo ? "Desactivar" : "Reactivar"}
                  variant={perfil?.activo ? "peligro" : "outline"}
                  icon={
                    perfil?.activo ? (
                      <UserX size={16} aria-hidden="true" />
                    ) : (
                      <UserCheck size={16} aria-hidden="true" />
                    )
                  }
                  onClick={() => setMostrarConfirmacion(true)}
                  disabled={enviando}
                />
              )}
            </div>
            <div className="ec-acciones">
              <SecondaryButton
                title="Cancelar"
                variant="neutra"
                onClick={onClose}
                disabled={enviando}
                icon={<X size={16} aria-hidden="true" />}
              />
              <PrimaryButton
                title="Guardar datos"
                onClick={guardarCambios}
                loading={enviando}
                icon={<Save size={16} aria-hidden="true" />}
              />
            </div>
          </div>
        </SeccionDeFormulario>

        <section
          className="ec-form-seccion"
          style={{ "--ec-acento": "var(--accent-colaboradores)" }}
        >
          <div className="ec-form-seccion-cabecera">
            <h3 className="ec-form-seccion-titulo">Especialidades</h3>
            <p className="ec-form-seccion-descripcion">
              De qué es especialista. Es el dato por el que se busca a un médico en el listado.
            </p>
          </div>

          {especialidades.error && (
            <div className="alert alert-danger" role="alert">
              {especialidades.error.mensaje}
            </div>
          )}

          {!especialidades.editable && (
            <p className="text-body-secondary small">
              Solo la administracion, o cada persona sobre su propio perfil, puede cambiar las
              especialidades.
            </p>
          )}

          <MultiSelector
            label="Especialidades del colaborador"
            value={especialidades.especialidades}
            options={especialidades.catalogo}
            onChange={especialidades.setEspecialidades}
            placeholder="Elegir una ya registrada"
            placeholderLibre="O escribir una nueva"
            permiteLibre
            error={especialidades.errores.especialidades}
            disabled={
              !especialidades.editable || especialidades.cargando || especialidades.enviando
            }
          />

          {especialidades.editable && (
            <div className="ec-acciones ec-acciones--fin">
              <PrimaryButton
                title="Guardar especialidades"
                onClick={guardarEspecialidades}
                loading={especialidades.enviando}
                disabled={!especialidades.hayCambios}
                icon={<Save size={16} aria-hidden="true" />}
              />
            </div>
          )}
        </section>
      </Modal>

      {mostrarConfirmacion && (
        <ModalConfirmarDesactivacion
          perfil={perfil}
          idSesionActual={idSesionActual}
          onClose={() => setMostrarConfirmacion(false)}
          onResuelto={(perfilActualizado) => {
            setMostrarConfirmacion(false);
            onGuardado?.(perfilActualizado);
          }}
        />
      )}
    </>
  );
}
