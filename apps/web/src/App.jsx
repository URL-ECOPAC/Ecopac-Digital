import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MODULOS } from "@ecopac/shared";
import { SesionProvider } from "./contexto/SesionProvider";
import MainLayout from "./components/MainLayout";
import RutaProtegida from "./components/RutaProtegida";
import LoginPage from "./pages/LoginPage";
import RestablecerContrasenaPage from "./pages/RestablecerContrasenaPage";
import NuevaContrasenaPage from "./pages/NuevaContrasenaPage";
import HomePage from "./pages/HomePage";
import PacientesPage from "./pages/PacientesPage";
import FichaPacientePage from "./pages/FichaPacientePage";
import PacientesCronicosPage from "./pages/PacientesCronicosPage";
import DonacionesPage from "./pages/DonacionesPage";
import InventarioPage from "./pages/InventarioPage";
import PresupuestosPage from "./pages/PresupuestosPage";
import ProyectosPage from "./pages/ProyectosPage";
import ReportesPage from "./pages/ReportesPage";
import JornadasPage from "./pages/JornadasPage";
import DetalleJornadaPage from "./pages/DetalleJornadaPage";
import VoluntariosPage from "./pages/VoluntariosPage";
import PerfilPage from "./pages/PerfilPage";
import NotFoundPage from "./pages/NotFoundPage";

// Las rutas siguen la definicion unica de MODULOS en packages/shared/navegacion.js:
// si se agrega un modulo alli, hay que registrar aqui su ruta.
//
// Y los roles permitidos de cada ruta salen de ese mismo MODULOS, no escritos a mano aqui:
// asi el sidebar y el guard no pueden discrepar. Esconder la opcion del menu no es control de
// acceso, y si las dos listas vivieran por separado acabarian diciendo cosas distintas.
const rolesDe = (ruta) => MODULOS.find((m) => m.ruta === ruta)?.roles ?? [];

export default function App() {
  return (
    <BrowserRouter>
      <SesionProvider>
        <Routes>
          {/* Rutas publicas: los puntos de entrada sin sesion.
            Las dos de contrasena tienen que ser publicas por definicion: quien no puede entrar es
            justo quien las necesita. /nueva-contrasena es ademas el destino del enlace que Supabase
            manda por correo, y el que usa el primer administrador que la migracion 00063 crea sin
            contrasena. */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/restablecer-contrasena" element={<RestablecerContrasenaPage />} />
          <Route path="/nueva-contrasena" element={<NuevaContrasenaPage />} />

          {/* Rutas autenticadas.
            El guard de sesion va POR ENCIMA de MainLayout: el layout dibuja el nombre y el rol
            de quien entro, asi que no puede montarse antes de saber si hay sesion. Los roles se
            comprueban despues, ruta por ruta, ya dentro del layout. */}
          <Route element={<RutaProtegida />}>
            <Route element={<MainLayout />}>
              <Route element={<RutaProtegida roles={rolesDe("/")} />}>
                <Route path="/" element={<HomePage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/pacientes")} />}>
                <Route path="/pacientes" element={<PacientesPage />} />
                {/* /pacientes/:id (issue #125): misma excepcion de alcance que /jornadas/:id --
                  no es un modulo del sidebar, asi que no se declara en navegacion.js, y hereda
                  el guard y los roles de /pacientes. Las pestanias clinicas de la ficha las
                  esconde ademas puedeVerHistorial(), porque no todos los roles que entran al
                  modulo pueden ver diagnosticos (RNF-09). */}
                {/* /pacientes/cronicos (issue #132) va ANTES que /pacientes/:id: aunque React
                  Router prioriza el segmento estatico sobre el dinamico, dejarlas en este orden
                  hace evidente por que "cronicos" no cae en la ficha de un paciente. */}
                <Route path="/pacientes/cronicos" element={<PacientesCronicosPage />} />
                <Route path="/pacientes/:id" element={<FichaPacientePage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/donaciones")} />}>
                <Route path="/donaciones" element={<DonacionesPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/inventario")} />}>
                <Route path="/inventario" element={<InventarioPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/presupuestos")} />}>
                <Route path="/presupuestos" element={<PresupuestosPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/proyectos")} />}>
                <Route path="/proyectos" element={<ProyectosPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/reportes")} />}>
                <Route path="/reportes" element={<ReportesPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/jornadas")} />}>
                <Route path="/jornadas" element={<JornadasPage />} />
                {/* /jornadas/:id (issue #181): excepcion de alcance autorizada para esta unica
                  ruta, con el mismo guard y los mismos roles que ya protegen /jornadas -- no se
                  declara en navegacion.js/MODULOS (rolesDe() solo lee de ahi), mismo patron que
                  /perfil mas abajo, que tampoco es un modulo del sidebar. */}
                <Route path="/jornadas/:id" element={<DetalleJornadaPage />} />
              </Route>
              <Route element={<RutaProtegida roles={rolesDe("/voluntarios")} />}>
                {/* Listado y ficha fusionados en una sola pantalla de tarjetas expandibles
                  (arreglo de diseno de 2026-08-30): ya no hay una ruta /voluntarios/:id propia.
                  Ver eme.md para el estado anterior (dos rutas separadas) si hay que revertir. */}
                <Route path="/voluntarios" element={<VoluntariosPage />} />
              </Route>

              {/* /perfil no es uno de los MODULOS: es la cuenta de quien entro, no un modulo de
                negocio, asi que no aparece en el sidebar ni tiene una lista de roles que
                consultar en navegacion.js. Solo exige que haya sesion, igual que la 404 de
                abajo. Se llega desde el bloque .app-user de MainLayout.jsx (issue #102). */}
              <Route path="/perfil" element={<PerfilPage />} />

              {/* La 404 queda dentro del layout y detras de la sesion, pero sin filtro de rol:
              una ruta que no existe no depende de permisos. */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </SesionProvider>
    </BrowserRouter>
  );
}
