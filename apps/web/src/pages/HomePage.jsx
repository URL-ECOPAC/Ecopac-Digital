import { CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  ETIQUETAS_ESTADO_JORNADA,
  etiquetaDeRol,
  formatearFechaLarga,
  usePanelDeInicio,
} from "@ecopac/shared";

import ErrorState from "../components/ErrorState";
import IconoModulo from "../components/IconoModulo";
import LoadingState from "../components/LoadingState";
import ScreenContainer from "../components/ScreenContainer";
import StatusChip from "../components/StatusChip";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./inicio.css";

// Pantalla de inicio de la web (issue #710).
//
// Lo que decide que se dibuja aqui es usePanelDeInicio(), en packages/shared: los accesos salen
// de modulosVisibles(), la misma funcion que arma el sidebar, para que un modulo nuevo aparezca
// en el inicio sin tocar este archivo. Esta pantalla no decide permisos ni consulta nada.
//
// LA SEGUNDA PASADA DE DISENO. La version anterior cumplia lo que pedia la #710 pero se veia
// como una lista de cosas: un titulo de pagina identico al de cualquier otra pantalla, la
// jornada en curso en una tarjeta igual a las demas y ocho rectangulos con una palabra dentro.
// Tres cambios, en orden de importancia:
//
//   1. La cabecera se vuelve un banner con el degradado de marca, y absorbe el saludo, el rol y
//      la fecha. Es la unica pantalla del sistema con ese tratamiento, a proposito: es a la que
//      cae todo el mundo al entrar, y la que tiene que decir de un vistazo quien eres y que dia
//      es -en jornada se trabaja con el telefono en una mano y una ficha de papel en la otra-.
//   2. La jornada en curso se lee sin entrar: comunidad y fecha estan en la tarjeta, no solo el
//      nombre, y la fila entera sigue siendo el area pulsable.
//   3. Cada acceso dice que hay adentro. La descripcion sale de MODULOS (navegacion.js), no de
//      aqui, por el mismo motivo que el nombre y el icono.
//
// PageHeader no se usa en esta pantalla: el banner ocupa su lugar. Es la unica excepcion, y por
// eso el resto de pantallas no se toco.

export default function HomePage() {
  const navigate = useNavigate();
  const { perfil, rol } = useSesionCompartida();
  const { accesos, jornadasEnCurso, puedeVerJornadaEnCurso, cargando, error, recargar } =
    usePanelDeInicio({ rol: perfil?.rol ?? rol });

  const saludo = perfil?.nombres ? `Hola, ${perfil.nombres}` : "Hola";
  const rolDeLaSesion = perfil?.rol ?? rol;

  return (
    <ScreenContainer>
      <section className="inicio-banner" aria-labelledby="inicio-saludo">
        <h1 className="inicio-saludo" id="inicio-saludo">
          {saludo}
        </h1>
        <p className="inicio-frase">Este es el resumen de tu dia en Ecopac Digital</p>

        <div className="inicio-banner-chips">
          <span className="inicio-banner-chip">
            <CalendarDays size={14} aria-hidden="true" />
            {formatearFechaLarga(new Date())}
          </span>
          {rolDeLaSesion && (
            <span className="inicio-banner-chip">
              <ShieldCheck size={14} aria-hidden="true" />
              {etiquetaDeRol(rolDeLaSesion)}
            </span>
          )}
        </div>
      </section>

      {puedeVerJornadaEnCurso && (
        <section className="inicio-seccion" aria-labelledby="inicio-jornadas-titulo">
          <h2 className="inicio-titulo" id="inicio-jornadas-titulo">
            Jornadas en curso
            {!cargando && !error && jornadasEnCurso.length > 0 && (
              <span className="inicio-titulo-nota">
                {jornadasEnCurso.length === 1 ? "1 activa" : `${jornadasEnCurso.length} activas`}
              </span>
            )}
          </h2>

          {cargando && <LoadingState message="Buscando jornadas en curso..." />}

          {!cargando && error && <ErrorState message={error.mensaje} onRetry={recargar} />}

          {!cargando && !error && jornadasEnCurso.length === 0 && (
            <div className="ec-panel-vacio" style={{ minHeight: "140px" }}>
              <p className="inicio-vacio">
                No hay ninguna jornada en curso ahora mismo. Cuando empiece una, aparecera aqui.
              </p>
            </div>
          )}

          {!cargando && !error && jornadasEnCurso.length > 0 && (
            <div className="inicio-jornadas">
              {jornadasEnCurso.map((jornada) => (
                <button
                  className="inicio-jornada"
                  key={jornada.id}
                  onClick={() => navigate(`/jornadas/${jornada.id}`)}
                  type="button"
                >
                  <span className="inicio-jornada-datos">
                    <span className="inicio-jornada-nombre">{jornada.nombre}</span>
                    <span className="inicio-jornada-detalle">
                      {jornada.comunidad?.nombre && (
                        <>
                          <MapPin size={14} aria-hidden="true" />
                          {jornada.comunidad.nombre}
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      {formatearFechaLarga(jornada.fecha)}
                    </span>
                  </span>
                  <StatusChip
                    label={ETIQUETAS_ESTADO_JORNADA[jornada.estado] ?? jornada.estado}
                    status={jornada.estado}
                  />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="inicio-seccion" aria-labelledby="inicio-accesos-titulo">
        <h2 className="inicio-titulo" id="inicio-accesos-titulo">
          Tus modulos
          <span className="inicio-titulo-nota">Lo que tu rol puede abrir</span>
        </h2>

        <div className="inicio-accesos">
          {accesos.map((modulo) => (
            <button
              className="inicio-acceso"
              key={modulo.id}
              onClick={() => navigate(modulo.ruta)}
              // El acento del modulo sale de --accent-*, publicada por theme.js desde
              // @ecopac/ui-tokens. Ningun color se escribe aqui. Viaja como --ec-acento, que es
              // la variable que leen la cinta, el disco del icono y el estado de foco.
              style={{ "--ec-acento": `var(--accent-${modulo.id}, var(--color-primary))` }}
              type="button"
            >
              <span className="inicio-acceso-icono">
                <IconoModulo nombre={modulo.icono} size={22} />
              </span>
              <span className="inicio-acceso-etiqueta">{modulo.nombre}</span>
              {modulo.descripcion && (
                <span className="inicio-acceso-descripcion">{modulo.descripcion}</span>
              )}
            </button>
          ))}
        </div>
      </section>
    </ScreenContainer>
  );
}
