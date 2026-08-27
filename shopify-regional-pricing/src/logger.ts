import pino from 'pino';

// Logs em stdout no formato JSON para o Coolify capturar (Etapa 10.5).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'regional-pricing' },
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'accessToken',
      '*.accessToken',
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers["x-shopify-access-token"]',
    ],
    censor: '[redacted]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
