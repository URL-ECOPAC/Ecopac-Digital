import { useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radii, spacing, typography } from "@ecopac/ui-tokens";

// Centro de Guatemala, para cuando la comunidad todavia no tiene coordenadas capturadas.
const CENTRO_GUATEMALA = [15.7835, -90.2308];
const ZOOM_PAIS = 7;
const ZOOM_PUNTO = 15;

/**
 * La pagina que corre DENTRO del WebView. Es un documento HTML aislado -sin acceso al runtime
 * de React Native ni a sus variables de estilo-, asi que los colores de la marca se escriben
 * aqui como el hex literal de @ecopac/ui-tokens (issue #756: verificados contra el repo, no
 * inventados), no como una referencia que solo existiera del lado nativo.
 *
 * Leaflet se carga desde unpkg en vez de empaquetarse: mismo motivo que en la web (issue #756),
 * ningun API key ni cuenta de facturacion, y aqui ademas evita meter un paquete JS pesado en el
 * bundle de Expo para un solo componente. El puente con React Native es
 * `window.ReactNativeWebView.postMessage` hacia afuera y `injectJavaScript` hacia adentro.
 */
function paginaDelMapa() {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #mapa { height: 100%; margin: 0; padding: 0; }
      .icono-comunidad { background: none; border: none; }
    </style>
  </head>
  <body>
    <div id="mapa"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var mapa = L.map('mapa', { center: [${CENTRO_GUATEMALA[0]}, ${CENTRO_GUATEMALA[1]}], zoom: ${ZOOM_PAIS} });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapa);

      var icono = L.divIcon({
        className: 'icono-comunidad',
        html: '<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" ' +
          'fill="${colors.primary}" stroke="${colors.surface}" stroke-width="1.5"/>' +
          '<circle cx="15" cy="15" r="6" fill="${colors.surface}"/></svg>',
        iconSize: [30, 42],
        iconAnchor: [15, 42],
      });

      var marcador = null;

      function avisar(lat, lng) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
      }

      function ponerMarcador(lat, lng, avisarRN) {
        if (marcador) { marcador.remove(); }
        marcador = L.marker([lat, lng], { icon: icono, draggable: true }).addTo(mapa);
        marcador.on('dragend', function (evento) {
          var posicion = evento.target.getLatLng();
          avisar(posicion.lat, posicion.lng);
        });
        if (avisarRN) avisar(lat, lng);
      }

      mapa.on('click', function (evento) {
        ponerMarcador(evento.latlng.lat, evento.latlng.lng, true);
      });

      // Puente hacia adentro: React Native llama a estas funciones con injectJavaScript().
      window.fijarPunto = function (lat, lng) {
        ponerMarcador(lat, lng, false);
        mapa.setView([lat, lng], ${ZOOM_PUNTO});
      };
      window.quitarPunto = function () {
        if (marcador) { marcador.remove(); marcador = null; }
      };
    </script>
  </body>
</html>`;
}

/**
 * Mapa de seleccion de ubicacion para el catalogo de comunidades en movil (issue #756), mismo
 * proposito que apps/web/src/components/MapaUbicacionComunidad.jsx: un toque en el mapa, o
 * arrastrar el pin, fija latitud/longitud. WebView + Leaflet (decision del equipo: sin llave de
 * API ni cuenta de Google Cloud, a diferencia de react-native-maps en Android).
 */
export default function MapaUbicacionComunidad({ latitud, longitud, onCambiarUbicacion }) {
  const webviewRef = useRef(null);
  const listoRef = useRef(false);

  const sincronizar = () => {
    if (!webviewRef.current) return;
    if (typeof latitud === "number" && typeof longitud === "number") {
      webviewRef.current.injectJavaScript(`window.fijarPunto(${latitud}, ${longitud}); true;`);
    } else {
      webviewRef.current.injectJavaScript("window.quitarPunto(); true;");
    }
  };

  useEffect(() => {
    if (listoRef.current) sincronizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitud, longitud]);

  const alCargar = () => {
    listoRef.current = true;
    sincronizar();
  };

  const alRecibirMensaje = (evento) => {
    try {
      const { lat, lng } = JSON.parse(evento.nativeEvent.data);
      onCambiarUbicacion?.(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
    } catch {
      // Un mensaje que no se puede leer no tiene forma de aplicarse: se ignora en vez de
      // tumbar la pantalla por un mensaje mal formado del lado del WebView.
    }
  };

  const hayPunto = typeof latitud === "number" && typeof longitud === "number";

  return (
    <View>
      <View style={styles.mapa}>
        <WebView
          ref={webviewRef}
          originWhitelist={["*"]}
          source={{ html: paginaDelMapa() }}
          onLoadEnd={alCargar}
          onMessage={alRecibirMensaje}
          javaScriptEnabled
        />
      </View>
      <View style={styles.pie}>
        <Text style={styles.textoAyuda}>
          {hayPunto ? `${latitud}, ${longitud}` : "Toca el mapa para marcar la ubicacion (opcional)."}
        </Text>
        {hayPunto && (
          <TouchableOpacity onPress={() => onCambiarUbicacion?.(null, null)}>
            <Text style={styles.quitar}>Quitar punto</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapa: {
    height: 260,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pie: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  textoAyuda: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    flexShrink: 1,
  },
  quitar: {
    fontFamily: typography.fontFamilyBase,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
});
