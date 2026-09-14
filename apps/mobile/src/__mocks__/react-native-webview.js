// Doble minimo de react-native-webview para Jest: la libreria envuelve un modulo nativo
// (RNCWebViewModule) que solo existe en un binario real de iOS/Android, y jest-expo no lo
// simula por defecto (a diferencia de AsyncStorage y otros nativos que si trae en su preset).
// Sin este doble, cualquier prueba que importe algo que use WebView -aunque sea de forma
// indirecta, como AppNavigator.test.js importando ComunidadesScreen- revienta al cargar el
// modulo real. jest.config.js mapea "react-native-webview" a este archivo.
const React = require("react");
const { View } = require("react-native");

const WebView = React.forwardRef(function WebView(props, ref) {
  return React.createElement(View, { ...props, ref, testID: props.testID ?? "webview-mock" });
});

module.exports = { WebView };
