const path = require("node:path");

module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^react$": path.resolve(__dirname, "node_modules/react"),
    "^@ecopac/shared/(.*)$": path.resolve(__dirname, "../../packages/shared/$1"),
    "^@ecopac/shared$": path.resolve(__dirname, "../../packages/shared/index.js"),
    "^@ecopac/ui-tokens$": path.resolve(__dirname, "../../packages/ui-tokens/index.js"),
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)",
  ],
  testMatch: ["**/*.test.js", "**/*.test.jsx"],
  testPathIgnorePatterns: ["/node_modules/"],
};
