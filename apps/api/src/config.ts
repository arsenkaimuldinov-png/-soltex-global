/**
 * API configuration from environment variables only (no secrets in code).
 * Phase A knows only the variables it uses; database, session, mail and storage settings
 * arrive with their phases (see .env.example at the repository root).
 */
export type AppEnv = 'development' | 'test' | 'production';

export interface ApiConfig {
  env: AppEnv;
  host: string;
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

const ENVS: readonly AppEnv[] = ['development', 'test', 'production'];
const LEVELS: readonly ApiConfig['logLevel'][] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

export function loadConfig(source: Record<string, string | undefined> = process.env): ApiConfig {
  const env = (source.NODE_ENV ?? 'development') as AppEnv;
  if (!ENVS.includes(env)) throw new Error(`NODE_ENV must be one of ${ENVS.join(', ')}`);

  const port = Number(source.API_PORT ?? 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT must be an integer 1–65535');

  const logLevel = (source.API_LOG_LEVEL ?? (env === 'test' ? 'silent' : 'info')) as ApiConfig['logLevel'];
  if (!LEVELS.includes(logLevel)) throw new Error(`API_LOG_LEVEL must be one of ${LEVELS.join(', ')}`);

  // The API listens on loopback only; nginx is the public entry point (approved architecture §10).
  return { env, host: source.API_HOST ?? '127.0.0.1', port, logLevel };
}
