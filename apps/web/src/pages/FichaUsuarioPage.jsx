import { useState } from "react";
import { Badge } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";

import {
  CAMPOS_FICHA_VOLUNTARIO,
  COLUMNAS_HISTORIAL_VOLUNTARIO,
  ESTADOS_USUARIO,
  filasDeHistorial,
  formatearFechaCorta,
  OPCIONES_ROL,
  permisosDeUsuarios,
  PESTANIA_FICHA_VOLUNTARIO_POR_DEFECTO,
  PESTANIAS_FICHA_VOLUNTARIO,
  TIPOS_DE_PRESENTACION,
  useFichaUsuario,
  valoresDeFichaVoluntario,
} from "@ecopac/shared";

import {
  Card,
  DataList,
  ErrorState,
  LoadingState,
  PageHeader,
  ScreenContainer,
  StatusChip,
  Tabs,
} from "../components";
import { useSesionCompartida } from "../contexto/SesionProvider";
import ModalEdicionUsuario from "./ModalEdicionUsuario";
import ModalPermisosUsuario from "./ModalPermisosUsuario";
import NotFoundPage from "./NotFoundPage";

// Ficha de una persona del equipo: sus datos y el historial de jornadas en las que participo,
// en pestañas. Solo dibuja lo que useFichaUsuario() ya resuelve: no llama a Supabase, no valida,
// no formatea reglas de negocio y no decide ningun permiso por su cuenta.
//
// Quien puede entrar a esta ruta lo decide el guard de rutas desde App.jsx, con los mismos
// roles que ya protegen /voluntarios (no es un modulo propio del sidebar). Los botones Editar y
// Permisos igual pasan por permisosDeUsuarios(rol): aunque hoy son redundantes con el guard de
// ruta (solo administrador llega hasta aca), la decision de que se puede hacer sigue viniendo
// del modulo de permisos, nunca escrita a mano en el componente.
const CATALOGOS_FICHA = { roles: OPCIONES_ROL, estadoUsuario: ESTADOS_USUARIO };

/** Etiqueta de un valor de catalogo, o el valor crudo si no aparece en el catalogo. */
function etiquetaDeCatalogo(nombreCatalogo, valor) {
  const opcion = (CATALOGOS_FICHA[nombreCatalogo] ?? []).find((entrada) => entrada.value === valor);
  return opcion?.label ?? valor;
}

/** Dibuja el valor de un campo de CAMPOS_FICHA_VOLUNTARIO segun su tipo. */
function valorDeCampo(campo, valores) {
  const valor = valores[campo.desde ?? campo.id];

  if (campo.tipo === TIPOS_DE_PRESENTACION.ESTADO) {
    const opcion = (CATALOGOS_FICHA[campo.etiquetasDesde] ?? []).find(
      (entrada) => entrada.value === valor,
    );
    return <StatusChip status={opcion?.clave ?? valor} label={opcion?.label} />;
  }

  if (campo.tipo === TIPOS_DE_PRESENTACION.CHIPS) {
    const elementos = Array.isArray(valor) ? valor : [];
    if (elementos.length === 0) return "—";
    return (
      <span className="d-inline-flex flex-wrap gap-1">
        {elementos.map((elemento) => (
          <Badge key={String(elemento)} bg="light" text="dark">
            {elemento}
          </Badge>
        ))}
      </span>
    );
  }

  if (campo.etiquetasDesde) {
    return valor === null || valor === undefined
      ? "—"
      : etiquetaDeCatalogo(campo.etiquetasDesde, valor);
  }

  if (campo.tipo === TIPOS_DE_PRESENTACION.FECHA) {
    return valor ? formatearFechaCorta(valor) : "—";
  }

  return valor === null || valor === undefined || valor === "" ? "—" : valor;
}

export default function FichaUsuarioPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rol, perfil: perfilDeSesion } = useSesionCompartida();
  const { perfil, historial, cargando, error, errorHistorial, recargar } = useFichaUsuario(id);
  const [pestaniaActiva, setPestaniaActiva] = useState(PESTANIA_FICHA_VOLUNTARIO_POR_DEFECTO);
  const [editando, setEditando] = useState(false);
  const [gestionandoPermisos, setGestionandoPermisos] = useState(false);

  if (cargando && !perfil) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error && !perfil) {
    return (
      <ScreenContainer>
        <PageHeader
          title="Ficha del personal"
          actions={[
            { label: "Volver", onClick: () => navigate("/voluntarios"), variant: "secondary" },
          ]}
        />
        <ErrorState message={error.mensaje} onRetry={recargar} />
      </ScreenContainer>
    );
  }

  // perfil llega en null sin error cuando la fila no existe o cuando RLS no la deja ver (mismo
  // caso para quien mira la pantalla, ver obtenerPerfil() en usuarios/api.js): NotFoundPage ya
  // cubre los dos con un mensaje generico, igual que FichaPacientePage.jsx y DetalleJornadaPage.jsx.
  if (!perfil) {
    return <NotFoundPage />;
  }

  const valores = valoresDeFichaVoluntario(perfil);
  const permisos = permisosDeUsuarios(rol);
  const filas = filasDeHistorial(historial);

  const acciones = [
    { label: "Volver", onClick: () => navigate("/voluntarios"), variant: "secondary" },
  ];
  if (permisos.puedeEditarOtro) {
    acciones.push({ label: "Editar", onClick: () => setEditando(true) });
  }
  if (permisos.puedeGestionarPermisosFinos) {
    acciones.push({
      label: "Permisos",
      onClick: () => setGestionandoPermisos(true),
      variant: "secondary",
    });
  }

  return (
    <ScreenContainer>
      <PageHeader
        title={valores.nombreCompleto || "Sin nombre"}
        subtitle={etiquetaDeCatalogo("roles", perfil.rol)}
        actions={acciones}
      />

      <Tabs tabs={PESTANIAS_FICHA_VOLUNTARIO} activo={pestaniaActiva} onChange={setPestaniaActiva}>
        {pestaniaActiva === "datos" && (
          <Card>
            <dl className="row mb-0">
              {CAMPOS_FICHA_VOLUNTARIO.map((campo) => (
                <div className="col-sm-6 mb-2" key={campo.id}>
                  <dt className="text-body-secondary fw-normal">{campo.label}</dt>
                  <dd className="mb-0">{valorDeCampo(campo, valores)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {pestaniaActiva === "historial" &&
          (errorHistorial ? (
            <ErrorState message={errorHistorial.mensaje} onRetry={recargar} />
          ) : (
            <DataList
              columnas={COLUMNAS_HISTORIAL_VOLUNTARIO}
              datos={filas}
              vacio="Esta persona todavia no participo en ninguna jornada."
              onRowPress={(fila) => navigate(`/jornadas/${fila.id}`)}
            />
          ))}
      </Tabs>

      {editando && (
        <ModalEdicionUsuario
          perfil={perfil}
          idSesionActual={perfilDeSesion?.id}
          onClose={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            recargar();
          }}
        />
      )}

      {gestionandoPermisos && (
        <ModalPermisosUsuario perfil={perfil} onClose={() => setGestionandoPermisos(false)} />
      )}
    </ScreenContainer>
  );
}
