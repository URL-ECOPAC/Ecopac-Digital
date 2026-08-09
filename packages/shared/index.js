// Exporta toda la lógica compartida entre web y mobile apps
// Mantén este archivo como punto de entrada único (main en package.json)

// Re-export de módulos
export * from './api/index.js';
export * from './hooks/index.js';
export * from './types/index.js';
export * from './validations/index.js';
