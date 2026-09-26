import { useState } from "react";

import {
  MODULOS,
  ORIGEN_PERMISO,
  accionesDisponibles,
  etiquetaDeModuloDePermiso,
  useGestionPermisos,
} from "@ecopac/shared";

import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import Modal from "../components/Modal";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import StatusChip from "../components/StatusChip";
import TextField from "../components/TextField";
import "./permisos.css";

// Modal de permisos individuales de un usuario (issue #108), abierto DIRECTO desde la fila del
// listado en ColaboradoresPage.jsx -no desde adentro de ModalEdicionUsuario-: es una accion
// hermana de "Editar", al mismo nivel, no anidada (PLAN.md, decision 2).
//
// Solo dibuja lo que useGestionPermisos() ya resuelve: la combinacion rol/individual y el
// origen de cada permiso salen de obtenerPermisosEfectivos() (permisos.api.js, issue #104), no
// se recalculan aca.
//
// `MODULOS` (packages/shared/navegacion.js) presta la etiqueta legible de cada modulo -su
// campo `modulo` coincide a proposito con la columna `modulo` de la tabla `permisos`-, sin
// duplicar esa lista en este archivo.
//
// QUE CAMBIA EN EL DIBUJO. El contenido es el mismo; lo que era ilegible era la forma:
//
//   1. Cada permiso ofrecia un campo de texto de 180px SIEMPRE visible, aunque nadie fuera a
//      escribir un motivo. Con nueve permisos, la mitad del ancho del modal eran cajas vacias.
//      Ahora el motivo se despliega al pedirlo, y solo en la fila que se esta cambiando.
//   2. Conceder y Revocar eran los dos el mismo boton verde solido. Revocar QUITA un permiso:
//      va como accion destructiva, en contorno rojo.
//   3. El aviso de "sin efecto todavia" estaba dos veces. Desde la 00148 ya no existe: los nueve
//      permisos gobiernan una politica y el cliente los lee (usuarios/acceso.js).
//   4. Los modulos eran un h6 gris sobre una lista corrida. Ahora cada uno es una tarjeta, que
//      es como se agrupa cualquier otra cosa en el sistema.
// `item.nombre`, no `item.etiqueta`: MODULOS (navegacion.js) no tiene ningun campo `etiqueta`
// -- es el mismo campo inexistente que la #757 ya habia encontrado leido desde la pantalla de
// inicio, y que su prueba fija desde entonces. Aqui seguia: como el valor era undefined, cada
// grupo caia al `?? modulo` de mas abajo y se titulaba con la CLAVE de la tabla `permisos`
// ("pacientes", "presupuestos") en vez de con el nombre legible del modulo.
// Desde entonces el titulo sale de etiquetaDeModuloDePermiso() (usuarios/permisos.js), que tambien
// cubre `usuarios`, el unico grupo sin entrada en MODULOS.
const ACENTOS_MODULO = Object.fromEntries(
  MODULOS.filter((item) => item.modulo).map((item) => [
    item.modulo,
    `var(--accent-${item.id}, var(--color-primary))`,
  ]),
);

// La marca decia "Del rol" tambien cuando el rol NO lo da, y se leia como "ya lo tiene". Ahora
// dice de donde sale y si la persona lo tiene.
function etiquetaDeOrigen(permiso) {
  if (permiso.origen === ORIGEN_PERMISO.INDIVIDUAL) {
    return permiso.concedido ? "Concedido a esta persona" : "Revocado a esta persona";
  }
  return permiso.concedido ? "Lo trae su rol" : "No lo tiene";
}

function FilaDePermiso({
  permiso,
  enProceso,
  avisoSinEfecto,
  motivo,
  onMotivo,
  onConceder,
  onRevocar,
  onRestablecer,
}) {
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const esIndividual = permiso.origen === ORIGEN_PERMISO.INDIVIDUAL;
  const { mostrarConceder, mostrarRevocar, mostrarRestablecer } = accionesDisponibles(permiso);

  return (
    <div className="permiso-fila">
      <div className="permiso-descripcion">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="fw-semibold">{permiso.descripcion || permiso.clave}</span>
          <StatusChip status={permiso.origen} label={etiquetaDeOrigen(permiso)} />
        </div>

        {esIndividual && (permiso.otorgadoPorNombre || permiso.motivo) && (
          <p className="permiso-procedencia">
            {permiso.otorgadoPorNombre && `Por ${permiso.otorgadoPorNombre}`}
            {permiso.motivo
              ? `${permiso.otorgadoPorNombre ? ": " : ""}${permiso.motivo}`
              : permiso.otorgadoPorNombre
                ? ". Sin motivo registrado."
                : ""}
          </p>
        )}

        {avisoSinEfecto?.clave === permiso.clave && (
          <p className="text-danger small mb-0 mt-1">{avisoSinEfecto.mensaje}</p>
        )}

        {/* El motivo es opcional (usuario_permiso.motivo no es NOT NULL), asi que se pide solo
          cuando alguien quiere dejarlo escrito. */}
        {pidiendoMotivo && (
          <TextField
            aria-label="Motivo del cambio"
            placeholder="Por que se concede o revoca (opcional)"
            value={motivo ?? ""}
            onChange={(evento) => onMotivo(evento.target.value)}
            disabled={enProceso}
            style={{ marginTop: "var(--spacing-sm)", marginBottom: 0, maxWidth: "420px" }}
          />
        )}
      </div>

      <div className="permiso-acciones">
        {(mostrarConceder || mostrarRevocar) && !pidiendoMotivo && (
          <button
            type="button"
            className="btn btn-link btn-sm"
            onClick={() => setPidiendoMotivo(true)}
            disabled={enProceso}
          >
            Anotar motivo
          </button>
        )}
        {mostrarConceder && (
          <PrimaryButton
            title="Conceder"
            size="sm"
            onClick={() => {
              onConceder();
              setPidiendoMotivo(false);
            }}
            loading={enProceso}
          />
        )}
        {mostrarRevocar && (
          <SecondaryButton
            title="Revocar"
            variant="peligro"
            size="sm"
            onClick={() => {
              onRevocar();
              setPidiendoMotivo(false);
            }}
            loading={enProceso}
          />
        )}
        {mostrarRestablecer && (
          <SecondaryButton
            title="Restablecer"
            variant="neutra"
            size="sm"
            onClick={onRestablecer}
            disabled={enProceso}
          />
        )}
      </div>
    </div>
  );
}

export default function ModalPermisosUsuario({ perfil, onClose }) {
  const {
    modulos,
    cargando,
    error,
    claveEnProceso,
    avisoSinEfecto,
    conceder,
    revocar,
    restablecer,
  } = useGestionPermisos(perfil?.id);

  const nombre = [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ");

  const [motivoPorClave, setMotivoPorClave] = useState({});
  const establecerMotivo = (clave, valor) =>
    setMotivoPorClave((anteriores) => ({ ...anteriores, [clave]: valor }));

  const concederConMotivo = async (clave) => {
    await conceder(clave, motivoPorClave[clave]);
    establecerMotivo(clave, "");
  };
  const revocarConMotivo = async (clave) => {
    await revocar(clave, motivoPorClave[clave]);
    establecerMotivo(clave, "");
  };

  return (
    <Modal visible onClose={onClose} title={`Permisos de ${nombre}`} size="xl">
      <p className="text-body-secondary small">
        Aquí se le <strong>delegan a esta persona funciones de la administradora</strong>: al
        concederle una, le aparece el módulo donde se usa y puede hacerla. Lo que se concede o se
        revoca queda registrado con quien lo hizo; &quot;Restablecer&quot; la devuelve a lo que
        dicta su rol. Qué módulos ve cada rol se decide en la matriz de acceso.
      </p>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error.mensaje}
        </div>
      )}

      {cargando && <LoadingState />}

      {!cargando && !error && modulos.length === 0 && (
        <ErrorState message="No hay permisos que mostrar." />
      )}

      {!cargando &&
        modulos.map(({ modulo, permisos }) => (
          <div className="mb-3" key={modulo}>
            <Card
              title={etiquetaDeModuloDePermiso(modulo)}
              accent={ACENTOS_MODULO[modulo] ?? "var(--color-primary)"}
            >
              {permisos.map((permiso) => (
                <FilaDePermiso
                  key={permiso.clave}
                  permiso={permiso}
                  enProceso={claveEnProceso === permiso.clave}
                  avisoSinEfecto={avisoSinEfecto}
                  motivo={motivoPorClave[permiso.clave]}
                  onMotivo={(valor) => establecerMotivo(permiso.clave, valor)}
                  onConceder={() => concederConMotivo(permiso.clave)}
                  onRevocar={() => revocarConMotivo(permiso.clave)}
                  onRestablecer={() => restablecer(permiso.clave)}
                />
              ))}
            </Card>
          </div>
        ))}

      <div className="ec-acciones ec-acciones--fin mt-3">
        <SecondaryButton title="Cerrar" variant="neutra" onClick={onClose} />
      </div>
    </Modal>
  );
}
