import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Centro de Guatemala, para cuando la comunidad todavia no tiene coordenadas capturadas.
const CENTRO_GUATEMALA = [15.7835, -90.2308];
const ZOOM_PAIS = 7;
const ZOOM_PUNTO = 15;

// Pin propio en vez del icono por defecto de Leaflet (que ademas exige apuntar a sus PNG en
// dist/images, algo que Vite no resuelve solo). `fill`/`stroke` usan las variables de color de
// theme.js -no un hex propio- para que el mapa respete la paleta de la marca si algun dia
// cambia, y para no inventar un color que ui-tokens no declara (issue #756).
const ICONO_COMUNIDAD = L.divIcon({
  className: "icono-comunidad",
  html: `
    <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z"
        fill="var(--color-primary, #2A9C36)"
        stroke="var(--color-surface, #FFFFFF)"
        stroke-width="1.5"
      />
      <circle cx="15" cy="15" r="6" fill="var(--color-surface, #FFFFFF)" />
    </svg>
  `,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

/**
 * Mapa de seleccion de ubicacion para el catalogo de comunidades (issue #756: las columnas
 * `latitud`/`longitud` de la 00008 no las usaba nadie). Un clic en el mapa, o arrastrar el pin,
 * fija el punto; `onCambiarUbicacion(null, null)` lo limpia.
 *
 * Leaflet es imperativo por diseño (no hay virtual DOM que reconciliar dentro del mapa), asi
 * que este componente lo monta una sola vez sobre un div con ref y lo sincroniza a mano con las
 * props en vez de usar una libreria de bindings de React -mismo motivo por el que el proyecto no
 * agrega react-leaflet como dependencia nueva para un solo componente.
 */
export default function MapaUbicacionComunidad({
  latitud,
  longitud,
  onCambiarUbicacion,
  disabled = false,
}) {
  const contenedorRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadorRef = useRef(null);
  const onCambiarUbicacionRef = useRef(onCambiarUbicacion);
  onCambiarUbicacionRef.current = onCambiarUbicacion;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  // Monta el mapa una sola vez. Los cambios de latitud/longitud/disabled los aplica el efecto
  // de abajo, no este: recrear el mapa en cada tecla del formulario perderia el zoom y el pan
  // que la persona ya eligio.
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    const mapa = L.map(contenedorRef.current, {
      center: CENTRO_GUATEMALA,
      zoom: ZOOM_PAIS,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapa);

    mapa.on("click", (evento) => {
      if (disabledRef.current) return;
      onCambiarUbicacionRef.current?.(
        Number(evento.latlng.lat.toFixed(6)),
        Number(evento.latlng.lng.toFixed(6)),
      );
    });

    mapaRef.current = mapa;

    return () => {
      mapa.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
  }, []);

  // Sincroniza el pin y el encuadre con latitud/longitud cada vez que cambian -incluido el
  // primer render, cuando llegan de una comunidad ya existente.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    const hayPunto = typeof latitud === "number" && typeof longitud === "number";

    if (!hayPunto) {
      if (marcadorRef.current) {
        marcadorRef.current.remove();
        marcadorRef.current = null;
      }
      return;
    }

    if (!marcadorRef.current) {
      marcadorRef.current = L.marker([latitud, longitud], {
        icon: ICONO_COMUNIDAD,
        draggable: !disabled,
      }).addTo(mapa);

      marcadorRef.current.on("dragend", (evento) => {
        const posicion = evento.target.getLatLng();
        onCambiarUbicacionRef.current?.(
          Number(posicion.lat.toFixed(6)),
          Number(posicion.lng.toFixed(6)),
        );
      });

      mapa.setView([latitud, longitud], ZOOM_PUNTO);
    } else {
      marcadorRef.current.setLatLng([latitud, longitud]);
    }

    marcadorRef.current.dragging?.[disabled ? "disable" : "enable"]?.();
  }, [latitud, longitud, disabled]);

  return (
    <div>
      <div
        ref={contenedorRef}
        role="application"
        aria-label="Mapa para seleccionar la ubicación de la comunidad"
        style={{
          height: "260px",
          borderRadius: "var(--radio-md)",
          border: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      />
      <div className="d-flex justify-content-between align-items-center mt-2">
        <small style={{ color: "var(--color-text-muted)" }}>
          {typeof latitud === "number" && typeof longitud === "number"
            ? `${latitud}, ${longitud}`
            : "Toca el mapa para marcar la ubicacion (opcional)."}
        </small>
        {typeof latitud === "number" && !disabled && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0"
            onClick={() => onCambiarUbicacion?.(null, null)}
          >
            Quitar punto
          </button>
        )}
      </div>
    </div>
  );
}
