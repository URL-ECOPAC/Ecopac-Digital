import { useState } from "react";

import {
  CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL,
  COLUMNAS_RESULTADOS_ASIGNACION_PERSONAL,
  OPCIONES_ROL,
  useAsignacionPersonal,
} from "@ecopac/shared";

import DataList from "../components/DataList";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import Selector from "../components/Selector";
import TextField from "../components/TextField";

// Modal de buscar y asignar personal a una jornada (issue #182). No va en components/: es
// especifico de esta pantalla, mismo motivo que ModalAltaUsuario.jsx (#106) -no es una pieza
// reutilizable del catalogo de #280-. Solo dibuja lo que useAsignacionPersonal() le entrega
// (packages/shared/jornadas/); no valida, no formatea ni decide permisos aca.
//
// Dos pasos dentro del mismo modal, sin ruta ni modal anidado: buscar (TextField + Selector de
// rol opcional + DataList de resultados) y, al elegir una fila, completar el rol en la jornada y
// el horario (CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL). DataList no tiene una accion por fila aparte
// de onRowPress (ver ModalEdicionUsuario.jsx), asi que "elegir a alguien" es un click de fila que
// cambia de paso, igual que "editar" abre otro modal desde VoluntariosPage.jsx.
//
// Quien puede abrir este modal lo decide DetalleJornadaPage.jsx con permisos.puedeEditar antes de
// montarlo (mismo criterio que el resto de la pestaña Equipo); este componente no vuelve a
// preguntar.
const TIPO_DE_INPUT = {
  hora: "time",
};

export default function ModalAsignarPersonal({
  visible,
  jornadaId,
  jornadaFecha,
  personal,
  onClose,
  onAsignado,
}) {
  const {
    busqueda,
    setBusqueda,
    rolFiltro,
    setRolFiltro,
    buscando,
    resultados,
    resultadosTruncados,
    errorBusqueda,
    personaElegida,
    elegirPersona,
    volverABuscar,
    valores,
    errores,
    setCampo,
    verificandoChoque,
    advertenciaChoque,
    errorVerificacionChoque,
    enviando,
    error,
    advertenciasGuardado,
    asignar,
    reiniciar,
  } = useAsignacionPersonal({ jornadaId, jornadaFecha, personal });

  const [recienGuardado, setRecienGuardado] = useState(false);

  const cerrar = () => {
    reiniciar();
    setRecienGuardado(false);
    onClose?.();
  };

  const guardar = async () => {
    const resultado = await asignar();
    if (resultado.ok) {
      setRecienGuardado(true);
      onAsignado?.();
    }
  };

  const asignarOtraPersona = () => {
    volverABuscar();
    setRecienGuardado(false);
  };

  return (
    <Modal visible={visible} onClose={cerrar} title="Asignar personal">
      {!personaElegida && (
        <>
          <TextField
            label="Buscar"
            placeholder="Nombre, apellido o correo"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
          <Selector
            label="Rol (opcional)"
            value={rolFiltro}
            options={OPCIONES_ROL}
            onSelect={setRolFiltro}
            placeholder="Cualquier rol"
          />

          {errorBusqueda && (
            <div className="alert alert-danger" role="alert">
              {errorBusqueda.mensaje}
            </div>
          )}

          {!errorBusqueda && (
            <DataList
              columnas={COLUMNAS_RESULTADOS_ASIGNACION_PERSONAL}
              datos={resultados}
              cargando={buscando}
              onRowPress={elegirPersona}
              vacio={
                busqueda.trim() === "" && !rolFiltro
                  ? "Escribe un nombre, un correo o elige un rol para buscar."
                  : "No hay personal activo que coincida con la busqueda."
              }
            />
          )}

          {/* Hallazgo de la revision: listarUsuarios() trae como maximo un numero fijo de filas, y
              excluir a quien ya esta asignado (useAsignacionPersonal.js) puede dejar mas
              coincidencias reales sin mostrar. Sin este aviso, "no aparece en la lista" se leia
              como "no existe" en vez de "hay mas, afina la busqueda". */}
          {!buscando && !errorBusqueda && resultadosTruncados && (
            <div className="alert alert-info" role="alert">
              Hay mas resultados de los que se muestran. Escribe mas texto o elige un rol para
              acotar la busqueda.
            </div>
          )}
        </>
      )}

      {personaElegida && !recienGuardado && (
        <>
          <p className="mb-3">
            Asignando a <strong>{personaElegida.nombreCompleto}</strong> (
            {personaElegida.rolEtiqueta}).{" "}
            <SecondaryButton title="Cambiar" onClick={volverABuscar} disabled={enviando} />
          </p>

          {verificandoChoque && (
            <p className="text-muted small">Comprobando otras jornadas del mismo dia...</p>
          )}

          {/* Nunca se afirma "no hay choque": si la comprobacion fallo, se dice explicitamente
              que no se pudo verificar en vez de dejar pasar el silencio como una garantia
              (useAsignacionPersonal.js, verificarChoque()). */}
          {!verificandoChoque && errorVerificacionChoque && (
            <div className="alert alert-warning" role="alert">
              No se pudo comprobar si esta persona ya esta asignada a otra jornada el mismo dia.
              Revisa manualmente antes de confiar en que no hay choque.
            </div>
          )}

          {!verificandoChoque && !errorVerificacionChoque && advertenciaChoque && (
            <div className="alert alert-warning" role="alert">
              {advertenciaChoque}
            </div>
          )}

          {error && (
            <div className="alert alert-danger" role="alert">
              {error.mensaje}
            </div>
          )}

          {CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL.map((campo) =>
            campo.tipo === "select" ? (
              <Selector
                key={campo.id}
                label={campo.label}
                value={valores[campo.id]}
                options={campo.opciones}
                onSelect={(valor) => setCampo(campo.id, valor)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            ) : (
              <TextField
                key={campo.id}
                label={campo.label}
                type={TIPO_DE_INPUT[campo.tipo] ?? "text"}
                value={valores[campo.id] ?? ""}
                onChange={(evento) => setCampo(campo.id, evento.target.value)}
                error={errores[campo.id]}
                disabled={enviando}
              />
            ),
          )}

          <div className="d-flex justify-content-end gap-2 mt-3">
            <SecondaryButton title="Cancelar" onClick={cerrar} disabled={enviando} />
            <PrimaryButton title="Asignar" onClick={guardar} loading={enviando} />
          </div>
        </>
      )}

      {recienGuardado && (
        <>
          <div className="alert alert-success" role="alert">
            {personaElegida?.nombreCompleto} quedo asignado a esta jornada.
          </div>

          {/* advertenciasGuardado llega DESPUES de guardar (asignarPersonal() la calcula tras el
              INSERT, api.js): la asignacion ya existe, esto es informativo, no una confirmacion
              con opcion de cancelar. */}
          {advertenciasGuardado.map((advertencia, indice) => (
            <div className="alert alert-warning" role="alert" key={indice}>
              {advertencia}
            </div>
          ))}

          <div className="d-flex justify-content-end gap-2 mt-3">
            <SecondaryButton title="Cerrar" onClick={cerrar} />
            <PrimaryButton title="Asignar a otra persona" onClick={asignarOtraPersona} />
          </div>
        </>
      )}
    </Modal>
  );
}
