import { z } from 'zod';

const boolish = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),

  SHOPIFY_API_KEY: z.string().min(1, 'SHOPIFY_API_KEY e obrigatorio'),
  SHOPIFY_API_SECRET: z.string().min(1, 'SHOPIFY_API_SECRET e obrigatorio'),
  SHOPIFY_APP_URL: z
    .string()
    .url('SHOPIFY_APP_URL precisa ser uma URL completa')
    .transform((v) => v.replace(/\/+$/, '')),
  SHOPIFY_SCOPES: z.string().default('read_products,write_products,read_orders'),
  SHOPIFY_API_VERSION: z.string().default('2025-10'),
  // Loja unica do app custom. Vazio = aceita qualquer loja (util em dev).
  SHOPIFY_SHOP_DOMAIN: z.string().optional(),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatorio'),

  // 32 bytes em hex (64 chars) ou base64.
  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY e obrigatorio'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET precisa ter ao menos 16 chars'),

  SYNC_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  SYNC_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(2000),
  PRICE_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(300),

  ALLOW_DEV_AUTH: boolish,
});

export type AppConfig = z.infer<typeof schema> & {
  isProduction: boolean;
  scopeList: string[];
};

function load(): AppConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuracao de ambiente invalida:\n${issues}`);
  }

  const value = parsed.data;
  const isProduction = value.NODE_ENV === 'production';

  if (isProduction && value.ALLOW_DEV_AUTH) {
    throw new Error(
      'ALLOW_DEV_AUTH=true nao e permitido com NODE_ENV=production: ' +
        'isso desliga a validacao de assinatura do App Proxy e do App Bridge.',
    );
  }

  return {
    ...value,
    isProduction,
    scopeList: value.SHOPIFY_SCOPES.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cached) cached = load();
  return cached;
}

/** Apenas para testes. */
export function resetConfigCache(): void {
  cached = null;
}
