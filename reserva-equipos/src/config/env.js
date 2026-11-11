import dotenv from 'dotenv';
dotenv.config();

const port = Number(process.env.PORT ?? 3000);
const nodeEnv = process.env.NODE_ENV ?? 'development';
const sessionSecret = process.env.SESSION_SECRET;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Configuración inválida: PORT debe ser un entero entre 1 y 65535.');
}
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('Configuración inválida: NODE_ENV debe ser development, test o production.');
}
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('Configuración inválida: SESSION_SECRET debe tener al menos 32 caracteres. Copia .env.example a .env y cámbialo.');
}

export const config = Object.freeze({ port, nodeEnv, sessionSecret, isProduction: nodeEnv === 'production' });
