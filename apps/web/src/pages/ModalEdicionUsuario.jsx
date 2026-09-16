import { useState } from "react";

import {
  CAMPOS_EDICION_USUARIO,
  TIPOS_DE_CAMPO,
  useEdicionUsuario,
  useEspecialidadesDePerfil,
} from "@ecopac/shared";

import DateField from "../components/DateField";
import Modal from "../components/Modal";
import MultiSelector from "../components/MultiSelector";
import PrimaryButton from "../components/PrimaryButton";
import Selector from "../components/Selector";
import SecondaryButton from "../components/SecondaryButton";
import TextField from "../components/TextField";
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
const TIPO_DE_INPUT = {
  [TIPOS_DE_CAMPO.TEXTO]: "text",
  [TIPOS_DE_CAMPO.TELEFONO]: "tel",
};

export default function ModalEdicionUsuario({ perfil, idSesionActual, rol, onClose, onGuardado }) {
  const { valores, errores, error, enviando, setCampo, guardar } = useEdicionUsuario(perfil);
  const especialidades = useEspecialidadesDePerfil(perfil?.id, { rol, idSesionActual });
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const esUnoMismo = perfil?.id === idSesionActual;

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

        <section className="ec-form-seccion">
          <h3 className="ec-form-seccion-titulo">Datos del colaborador</h3>

          <div className="ec-form-grid">
            {CAMPOS_EDICION_USUARIO.map((campo) => {
              // Direccion y notas son texto largo: ocupan la fila entera en vez de media, para
              // que no queden dos cajas de tres lineas una al lado de la otra.
              const ancho = campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? "ec-form-grid--ancho" : "";

              if (campo.tipo === TIPOS_DE_CAMPO.SELECT) {
                return (
                  <Selector
                    key={campo.id}
                    label={campo.label}
                    value={valores[campo.id]}
                    options={campo.opciones}
                    onSelect={(valor) => setCampo(campo.id, valor)}
                    error={errores[campo.id]}
                    disabled={enviando}
                  />
                );
              }

              if (campo.tipo === TIPOS_DE_CAMPO.FECHA) {
                return (
                  <DateField
                    key={campo.id}
                    label={campo.label}
                    value={valores[campo.id] || null}
                    onChange={(valor) => setCampo(campo.id, valor)}
                    error={errores[campo.id]}
                    disabled={enviando}
                  />
                );
              }

              return (
                <TextField
                  key={campo.id}
                  label={campo.label}
                  className={ancho}
                  style={ancho ? { gridColumn: "1 / -1" } : undefined}
                  as={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? "textarea" : undefined}
                  rows={campo.tipo === TIPOS_DE_CAMPO.TEXTO_LARGO ? 3 : undefined}
                  type={TIPO_DE_INPUT[campo.tipo] ?? "text"}
                  maxLength={campo.validacion?.maxLongitud}
                  value={valores[campo.id] ?? ""}
                  onChange={(evento) => setCampo(campo.id, evento.target.value)}
                  error={errores[campo.id]}
                  disabled={enviando}
                />
              );
            })}
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
            <div>
              {esUnoMismo ? (
                <span className="text-body-secondary small">
                  No puedes desactivar tu propia cuenta.
                </span>
              ) : (
                <SecondaryButton
                  title={perfil?.activo ? "Desactivar" : "Reactivar"}
                  variant={perfil?.activo ? "peligro" : "outline"}
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
              />
              <PrimaryButton title="Guardar datos" onClick={guardarCambios} loading={enviando} />
            </div>
          </div>
        </section>

        <section className="ec-form-seccion">
          <h3 className="ec-form-seccion-titulo">Especialidades</h3>

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
                onClick={especialidades.guardar}
                loading={especialidades.enviando}
                disabled={!especialidades.hayCambios}
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
