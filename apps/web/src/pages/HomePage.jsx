import { useNavigate } from "react-router-dom";

import { ETIQUETAS_ESTADO_JORNADA, formatearFechaLarga, usePanelDeInicio } from "@ecopac/shared";

import Card from "../components/Card";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import PageHeader from "../components/PageHeader";
import ScreenContainer from "../components/ScreenContainer";
import StatusChip from "../components/StatusChip";
import { useSesionCompartida } from "../contexto/SesionProvider";
import "./inicio.css";

// Pantalla de inicio de la web (issue #710).
//
// Hasta esta issue `/` renderizaba <PaginaPendiente issues="#209" />, y la #209 esta cerrada: la
// primera pantalla que veia cualquier persona al entrar mandaba a esperar algo que ya no iba a
// llegar.
//
// Lo que decide que se dibuja aqui es usePanelDeInicio(), en packages/shared: los accesos salen
// de modulosVisibles(), la misma funcion que arma el sidebar, para que un modulo nuevo aparezca
// en el inicio sin tocar este archivo. Esta pantalla no decide permisos ni consulta nada.

export default function HomePage() {
  const navigate = useNavigate();
  const { perfil } = useSesionCompartida();
  const { accesos, jornadasEnCurso, puedeVerJornadaEnCurso, cargando, error, recargar } =
    usePanelDeInicio({ rol: perfil?.rol });

  const saludo = perfil?.nombres ? `Hola, ${perfil.nombres}` : "Hola";

  return (
    <ScreenContainer>
      <PageHeader title={saludo} subtitle="Este es el resumen de tu dia en Ecopac Digital" />

      {puedeVerJornadaEnCurso && (
        <section className="inicio-seccion" aria-labelledby="inicio-jornadas">
          <h2 className="inicio-titulo" id="inicio-jornadas">
            Jornadas en curso
          </h2>

          {cargando && <LoadingState message="Buscando jornadas en curso..." />}

          {!cargando && error && <ErrorState message={error.mensaje} onRetry={recargar} />}

          {!cargando && !error && jornadasEnCurso.length === 0 && (
            <Card>
              <p className="inicio-vacio">
                No hay ninguna jornada en curso ahora mismo. Cuando empiece una, aparecera aqui.
              </p>
            </Card>
          )}

          {!cargando &&
            !error &&
            jornadasEnCurso.map((jornada) => (
              <Card key={jornada.id}>
                <button
                  className="inicio-jornada"
                  onClick={() => navigate(`/jornadas/${jornada.id}`)}
                  type="button"
                >
                  <span className="inicio-jornada-datos">
                    <strong className="inicio-jornada-nombre">{jornada.nombre}</strong>
                    <span className="inicio-jornada-detalle">
                      {jornada.comunidad?.nombre ? `${jornada.comunidad.nombre} - ` : ""}
                      {formatearFechaLarga(jornada.fecha)}
                    </span>
                  </span>
                  <StatusChip
                    label={ETIQUETAS_ESTADO_JORNADA[jornada.estado] ?? jornada.estado}
                    status={jornada.estado}
                  />
                </button>
              </Card>
            ))}
        </section>
      )}

      <section className="inicio-seccion" aria-labelledby="inicio-accesos">
        <h2 className="inicio-titulo" id="inicio-accesos">
          Tus modulos
        </h2>

        <div className="inicio-accesos">
          {accesos.map((modulo) => (
            <button
              className="inicio-acceso"
              key={modulo.id}
              onClick={() => navigate(modulo.ruta)}
              // El acento del modulo sale de --accent-*, publicada por theme.js desde
              // @ecopac/ui-tokens. Ningun color se escribe aqui.
              style={{ borderTopColor: `var(--accent-${modulo.id}, var(--color-primary))` }}
              type="button"
            >
              <span className="inicio-acceso-etiqueta">{modulo.etiqueta}</span>
            </button>
          ))}
        </div>
      </section>
    </ScreenContainer>
  );
}
