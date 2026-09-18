import { Suspense, useCallback, useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Button } from "react-bootstrap";
import {
  MODULOS,
  seccionesVisibles,
  etiquetaDeRol,
  formatearFechaCorta,
  useExpiracionPorInactividad,
  MINUTOS_INACTIVIDAD_POR_DEFECTO,
} from "@ecopac/shared";
import { labels } from "@ecopac/ui-tokens";
import { almacenamientoWeb } from "../almacenamiento";
import { useSesionCompartida } from "../contexto/SesionProvider";
import { useEnLinea } from "../hooks/useEnLinea";
import AvisoDeInactividad from "./AvisoDeInactividad";
import AvisoSinConexion from "./AvisoSinConexion";
import IconoModulo from "./IconoModulo";
import LimiteDeError from "./LimiteDeError";
import LoadingState from "./LoadingState";
import "./MainLayout.css";

const EVENTOS_DE_ACTIVIDAD = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];

const SUBTITULOS = {
  inicio: "Panel general del sistema",
  pacientes: "Expedientes clinicos",
  donaciones: "Ingresos registrados",
  inventario: "Existencias y alertas de caducidad",
  presupuestos: "Administracion financiera por jornada y proyecto",
  proyectos: "Proyectos sociales y su avance",
  reportes: "Indicadores de impacto",
  jornadas: "Tablero de jornadas medicas",
  colaboradores: "Personal registrado",
};

function moduloDeRuta(pathname) {
  return [...MODULOS]
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .find((m) => (m.ruta === "/" ? pathname === "/" : pathname.startsWith(m.ruta)));
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const { perfil, logout } = useSesionCompartida();
  const enLinea = useEnLinea();

  const secciones = seccionesVisibles(perfil.rol);
  const actual = moduloDeRuta(location.pathname);

  const iniciales = `${perfil.nombres[0] ?? ""}${perfil.apellidos[0] ?? ""}`.toUpperCase();

  const fecha = formatearFechaCorta(new Date());

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  // Cierre por inactividad. Al vencer se sale con un motivo en el state de la navegacion para que
  // la pantalla de inicio de sesion diga por que se cerro, en vez de aparecer sin explicacion.
  const cerrarPorInactividad = useCallback(async () => {
    await logout();
    navigate("/login", { replace: true, state: { motivo: "inactividad" } });
  }, [logout, navigate]);

  const { registrarActividad, seguirConectado, avisoVisible, segundosRestantes } =
    useExpiracionPorInactividad({
      minutos: MINUTOS_INACTIVIDAD_POR_DEFECTO,
      alVencer: cerrarPorInactividad,
      almacenamiento: almacenamientoWeb,
    });

  useEffect(() => {
    EVENTOS_DE_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, registrarActividad));
    return () => {
      EVENTOS_DE_ACTIVIDAD.forEach((evento) =>
        window.removeEventListener(evento, registrarActividad),
      );
    };
  }, [registrarActividad]);

  return (
    <div className="app-shell">
      <button
        type="button"
        className="app-menu-toggle"
        aria-label={menuAbierto ? "Cerrar menu" : "Abrir menu"}
        aria-expanded={menuAbierto}
        onClick={() => setMenuAbierto((abierto) => !abierto)}
      >
        <span className="app-menu-toggle__bar" aria-hidden="true" />
        <span className="app-menu-toggle__bar" aria-hidden="true" />
        <span className="app-menu-toggle__bar" aria-hidden="true" />
      </button>

      {menuAbierto && (
        <div
          className="app-sidebar__overlay"
          role="presentation"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      <aside className={`app-sidebar${menuAbierto ? " app-sidebar--abierto" : ""}`}>
        <div className="app-brand">
          <img className="app-brand__mark" src="/logo-ecopac.png" alt="Ecopac" />
          <span>
            <span className="app-brand__name">Ecopac</span>
          </span>
        </div>

        <nav className="app-nav" aria-label="Navegacion principal">
          {secciones.map((seccion) => (
            <div key={seccion.id} className="app-nav__group">
              <p className="app-nav__title">{seccion.titulo}</p>
              {seccion.modulos.map((modulo) => (
                <NavLink
                  key={modulo.id}
                  to={modulo.ruta}
                  end={modulo.ruta === "/"}
                  className={({ isActive }) =>
                    `app-nav__item${isActive ? " app-nav__item--active" : ""}`
                  }
                >
                  <IconoModulo nombre={modulo.icono} size={18} />
                  {modulo.nombre}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Punto de entrada a /perfil (issue #102): unica excepcion de alcance de este layout,
            que sigue siendo el de la issue #51 en todo lo demas. No es un boton nuevo ni un
            item de MODULOS, solo el mismo bloque de siempre vuelto navegable. */}
        <NavLink to="/perfil" className="app-user app-user--link">
          <span className="app-user__avatar" aria-hidden="true">
            {iniciales}
          </span>
          <span className="app-user__data">
            <span className="app-user__name">
              {perfil.nombres} {perfil.apellidos}
            </span>
            <span className="app-user__role">
              {etiquetaDeRol(perfil.rol)}
              {perfil.area ? ` · ${perfil.area}` : ""}
            </span>
          </span>
        </NavLink>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div>
            <h1 className="app-header__title">{actual?.nombre ?? "Ecopac Digital"}</h1>
            <p className="app-header__subtitle">
              {actual ? SUBTITULOS[actual.id] : "Ecopac Guatemala"} · {fecha}
            </p>
          </div>
          <div className="app-header__actions">
            {/* Decia "Sistema activo" siempre, con o sin red (issue #762). */}
            <span
              className={`app-status${enLinea ? "" : " app-status--sin-conexion"}`}
              title="Estado de la conexion"
            >
              <span className="app-status__dot" aria-hidden="true" />
              {enLinea ? "En línea" : "Sin conexión"}
            </span>
            <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
              Cerrar sesion
            </Button>
          </div>
        </header>

        <AvisoSinConexion enLinea={enLinea} />

        {/* --ec-acento-modulo es el color con el que el inicio pinta la tarjeta de este modulo.
            Se publica aqui, una vez, para que el filete de PageHeader y los titulos de seccion
            de cualquier pantalla del modulo lo tomen sin repetirlo. */}
        <main
          className="app-content"
          style={{
            "--ec-acento-modulo": actual
              ? `var(--accent-${actual.id}, var(--color-primary))`
              : "var(--color-primary)",
          }}
        >
          {/* Un fallo de render en una pantalla se queda en esa pantalla: el menu sigue, se
              reporta, y al navegar a otra ruta el limite se reinicia (issue #762). */}
          <LimiteDeError
            claveDeReinicio={location.pathname}
            ruta={location.pathname}
            modulo={actual?.id}
            onVolverAlInicio={() => navigate("/")}
          >
            {/* Las pantallas se descargan por ruta desde la #708, asi que al entrar a un modulo
                por primera vez hay un momento sin componente. El respaldo va AQUI DENTRO, alrededor
                del <Outlet /> y no en App.jsx: asi lo unico que cambia es el area de contenido -el
                sidebar, la cabecera y el aviso de inactividad no se desmontan- y la navegacion no
                parpadea. Y va dentro de LimiteDeError a proposito: un chunk que no se puede
                descargar -red caida a mitad de jornada- lanza al renderizar, y ahi lo recoge el
                limite de error en vez de dejar la pantalla en blanco. */}
            <Suspense fallback={<LoadingState message={labels.cargandoPantalla} />}>
              <Outlet />
            </Suspense>
          </LimiteDeError>
        </main>
      </div>

      <AvisoDeInactividad
        visible={avisoVisible}
        segundosRestantes={segundosRestantes}
        onSeguir={seguirConectado}
        onSalir={handleLogout}
      />
    </div>
  );
}
